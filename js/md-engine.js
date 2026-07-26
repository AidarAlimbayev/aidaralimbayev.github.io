/* ==========================================================================
   md-engine.js — a 2D molecular-dynamics core, no DOM, no dependencies.

   Everything the atomic-interaction lab shows on screen is produced here:
   pair forces, the integrator, the thermostat, and the ensemble averages.
   Kept separate from js/md-lab.js (which owns the canvas and the UI) so the
   physics can be exercised head-less — see the energy-conservation and
   equipartition checks that were run against this file.

   UNITS. Reduced Lennard-Jones units throughout: length σ, energy ε, mass m
   of species A, and k_B = 1. Time is therefore in τ = σ√(m/ε). Mapping those
   onto argon (ε/k_B = 119.8 K, σ = 3.4 Å, m = 39.948 u) gives τ = 2.153 ps,
   which is what the UI uses for its physical read-outs.

   MODEL. Truncated-and-shifted Lennard-Jones with Lorentz-Berthelot mixing,
   optional harmonic bonds (bead-spring molecules), and optional damped
   shifted-force Coulomb for the ionic case. Cell lists keep the pair loop
   linear in N; the integrator is BAOAB, which reduces to velocity Verlet when
   the friction is zero.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MDEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------ constants */

  /* argon, for turning reduced numbers into ones a chemist recognises */
  const ARGON = {
    epsK:    119.8,    // ε/k_B                       [K]
    sigA:    3.4,      // σ                           [Å]
    massU:   39.948,   // m                           [u]
    tauPs:   2.1532,   // τ = σ√(m/ε)                 [ps]
    velMS:   157.9,    // σ/τ                         [m/s]
    forcePN: 4.865,    // ε/σ                         [pN]
    tension: 14.31,    // ε/σ²  (2D "pressure")       [mN/m]
    diffCm2: 5.37e-4,  // σ²/τ                        [cm²/s]
  };

  /* Species are fixed — a slot is an identity, so its colour and parameters
     never move when a preset changes which slots are on screen. σ and ε are
     relative to A; q is the formal charge used by the Coulomb term. */
  const SPECIES = [
    { key: 'A', label: 'A · argon-like', short: 'A',  sig: 1.00, eps: 1.00, mass: 1.0, q:  0 },
    { key: 'B', label: 'B · heavier',    short: 'B',  sig: 1.30, eps: 1.30, mass: 3.0, q:  0 },
    { key: 'C', label: 'cation (+)',     short: '+',  sig: 0.90, eps: 0.60, mass: 1.0, q: +1 },
    { key: 'D', label: 'anion (−)',      short: '−',  sig: 1.15, eps: 0.60, mass: 1.4, q: -1 },
    { key: 'P', label: 'colloid probe',  short: 'P',  sig: 3.00, eps: 1.50, mass: 20.0, q: 0 },
  ];
  const NSP = SPECIES.length;
  const MAXEX = 4;               // max bonded exclusions carried per atom
  const TWO_OVER_SQRTPI = 2 / Math.sqrt(Math.PI);

  /* ------------------------------------------------------------- numerics */

  /* Abramowitz & Stegun 7.1.26, |error| ≤ 1.5e-7 — plenty for a screen. */
  function erfc(z) {
    const t = 1 / (1 + 0.3275911 * z);
    const y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 +
              t * (-1.453152027 + t * 1.061405429))));
    return y * Math.exp(-z * z);
  }

  /* Seeded so "reset" reproduces the same run — a demo you can point at twice. */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------------------------------------------------------- engine */

  class Engine {
    constructor() {
      this.rc      = 2.5;        // cutoff, in units of σ_ij
      this.dt      = 0.004;      // τ
      this.pbc     = true;
      this.thermostat = 'langevin';   // 'langevin' | 'berendsen' | 'nve'
      this.gamma   = 1.0;        // Langevin friction, 1/τ
      this.tauT    = 0.4;        // Berendsen coupling time, τ
      this.T       = 0.7;        // target temperature, ε/k_B
      this.cross   = 1.0;        // ε scale on unlike pairs (demixing knob)
      this.kCoulomb = 0;         // 0 disables the electrostatic term
      this.alpha   = 0.35;       // damped-shifted-force damping, 1/σ
      this.rcq     = 4.5;        // Coulomb cutoff, σ
      /* Hard ceiling on any pair cutoff. Cells must be at least as wide as the
         widest cutoff in play, so one 3σ colloid would otherwise force cells
         7.5σ across and drag every pair in the box into the inner loop. Only
         the colloid is affected: 2.5 σ_ij already sits under this for A and B. */
      this.rcCap   = 4.0;

      this.drag    = null;       // {i, x, y, k} — the pointer spring
      this.ramp    = null;       // {from, to, over, t0} — scripted heating

      this.time = 0; this.steps = 0;
      this.N = 0; this.L = 10; this.rho = 0;
      this.nbond = 0;

      this.rng = mulberry32(0x9E3779B9);
      this._spare = null;

      this._alloc(64);
      this._buildPairTable();
      this.resetSampling();
    }

    /* ------------------------------------------------------------ storage */

    _alloc(n) {
      if (this.cap >= n) return;
      const cap = Math.max(64, n);
      this.cap = cap;
      this.x  = new Float64Array(cap); this.y  = new Float64Array(cap);
      this.vx = new Float64Array(cap); this.vy = new Float64Array(cap);
      this.fx = new Float64Array(cap); this.fy = new Float64Array(cap);
      this.ux = new Float64Array(cap); this.uy = new Float64Array(cap);   // unwrapped, for MSD
      this.x0 = new Float64Array(cap); this.y0 = new Float64Array(cap);   // MSD reference
      this.type = new Uint8Array(cap);
      this.invm = new Float64Array(cap);
      this.pei  = new Float64Array(cap);   // per-atom potential energy
      this.fmag = new Float64Array(cap);   // |f_i|, for colouring and arrows
      this.nbr  = new Int32Array(cap);     // neighbours inside the cutoff
      this.exn  = new Int32Array(cap);
      this.exl  = new Int32Array(cap * MAXEX);
      this.cellNext = new Int32Array(cap);
    }

    /* Lorentz-Berthelot mixing, then everything the inner loop needs is a
       flat lookup: no branching on species inside the pair kernel. */
    _buildPairTable() {
      const n2 = NSP * NSP;
      this.p_sig2 = new Float64Array(n2);
      this.p_e4   = new Float64Array(n2);
      this.p_e24  = new Float64Array(n2);
      this.p_rc2  = new Float64Array(n2);
      this.p_ush  = new Float64Array(n2);
      this.p_sig  = new Float64Array(n2);
      for (let a = 0; a < NSP; a++) {
        for (let b = 0; b < NSP; b++) {
          const sig = 0.5 * (SPECIES[a].sig + SPECIES[b].sig);
          let eps = Math.sqrt(SPECIES[a].eps * SPECIES[b].eps);
          if (a !== b) eps *= this.cross;
          const rc = Math.min(this.rc * sig, this.rcCap);
          const s6 = Math.pow(sig / rc, 6);
          const k = a * NSP + b;
          this.p_sig[k]  = sig;
          this.p_sig2[k] = sig * sig;
          this.p_e4[k]   = 4 * eps;
          this.p_e24[k]  = 24 * eps;
          this.p_rc2[k]  = rc * rc;
          this.p_ush[k]  = 4 * eps * (s6 * s6 - s6);   // energy shift at the cutoff
        }
      }
      /* damped shifted force: the constants that make U and F both vanish at rcq */
      const a = this.alpha, R = this.rcq;
      this._dsfU = erfc(a * R) / R;
      this._dsfF = erfc(a * R) / (R * R) + TWO_OVER_SQRTPI * a * Math.exp(-a * a * R * R) / R;
      this._rcq2 = R * R;

      /* the cell list has to cover the widest pair cutoff actually in play */
      let smax = 0;
      for (let i = 0; i < this.N; i++) smax = Math.max(smax, SPECIES[this.type[i]].sig);
      if (!smax) smax = 1;
      this.RCmax = Math.max(Math.min(this.rc * smax, this.rcCap), this.kCoulomb ? this.rcq : 0);
    }

    /* -------------------------------------------------------- construction */

    /* spec: {n, rho, lattice, assign, types, bond, chainLen, bondK, bondR0, seed} */
    build(spec) {
      const s = Object.assign({
        n: 480, rho: 0.75, lattice: 'tri', assign: 'single',
        types: [0], bond: 'none', chainLen: 12, bondK: 300, bondR0: 1.05, seed: 0x9E3779B9,
      }, spec || {});

      this.rng = mulberry32(s.seed);
      this._spare = null;

      /* --- lattice geometry -------------------------------------------- */
      let nx, ny;
      if (s.lattice === 'square') {
        nx = Math.max(2, Math.round(Math.sqrt(s.n)));
        ny = Math.max(2, Math.round(s.n / nx));
        if (s.assign === 'checker') { nx += nx & 1; ny += ny & 1; }   // even ⇒ alternation survives the wrap
      } else {
        /* triangular: rows are dx·√3/2 apart, so nx/ny → √3/2 for a square box */
        ny = Math.max(2, Math.round(Math.sqrt(s.n * 2 / Math.sqrt(3))));
        nx = Math.max(2, Math.round(ny * Math.sqrt(3) / 2));
      }
      if (s.bond === 'dimer') nx += nx & 1;                            // pairs need an even row
      if (s.bond === 'chain') nx = Math.max(s.chainLen, Math.round(nx / s.chainLen) * s.chainLen);

      /* Molecules are placed by centre of mass, so the site count is per
         molecule, not per atom. */
      const perSite = s.bond === 'dimer' ? 2 : 1;
      let nSite = nx * ny;
      let N = nSite * perSite;

      const L = Math.sqrt(N / s.rho);
      const dx = L / nx, dy = L / ny;

      this._alloc(N + 4);
      this.L = L; this.nbond = 0;
      this.bi = new Int32Array(N); this.bj = new Int32Array(N);
      this.br0 = new Float64Array(N); this.bk = new Float64Array(N);
      this.exn.fill(0);

      const x = this.x, y = this.y, type = this.type, R = this.rng;
      let k = 0;

      for (let row = 0; row < ny; row++) {
        for (let col = 0; col < nx; col++) {
          const off = (s.lattice === 'square') ? 0 : 0.5 * (row & 1);
          const px = (col + off + 0.25) * dx;
          const py = (row + 0.5) * dy;

          if (s.bond === 'dimer') {
            /* one molecule per site: two atoms about the centre, random angle */
            const th = R() * Math.PI * 2, h = 0.5 * s.bondR0;
            const i = k, j = k + 1;
            x[i] = px + h * Math.cos(th); y[i] = py + h * Math.sin(th);
            x[j] = px - h * Math.cos(th); y[j] = py - h * Math.sin(th);
            type[i] = type[j] = s.types[0] | 0;
            this._addBond(i, j, s.bondR0, s.bondK);
            k += 2;
          } else {
            x[k] = px; y[k] = py;
            type[k] = this._pickType(s, col, row, R);
            /* chains run along a row and are bonded at the lattice spacing,
               so the configuration starts with exactly zero bond strain */
            if (s.bond === 'chain' && (col % s.chainLen) !== 0) {
              this._addBond(k - 1, k, dx, s.bondK);
            }
            k++;
          }
        }
      }
      N = k;

      /* --- a colloid displaces the solvent it would otherwise sit on top of */
      if (s.assign === 'probe') {
        const cx = L * 0.5, cy = L * 0.5;
        const rMin = 0.5 * (SPECIES[4].sig + SPECIES[0].sig) * 1.05;
        let m = 0;
        for (let i = 0; i < N; i++) {
          let ddx = x[i] - cx, ddy = y[i] - cy;
          if (ddx > L * 0.5) ddx -= L; else if (ddx < -L * 0.5) ddx += L;
          if (ddy > L * 0.5) ddy -= L; else if (ddy < -L * 0.5) ddy += L;
          if (ddx * ddx + ddy * ddy < rMin * rMin) continue;
          x[m] = x[i]; y[m] = y[i]; type[m] = 0; m++;
        }
        x[m] = cx; y[m] = cy; type[m] = 4; m++;
        N = m;
      }

      this.N = N;
      this.rho = N / (L * L);
      for (let i = 0; i < N; i++) this.invm[i] = 1 / SPECIES[type[i]].mass;

      this._buildPairTable();
      this._cells();
      this.boundary();
      this.minimise();               // never hand a hot start to the integrator
      this.setTemperature(this.T);
      for (let i = 0; i < N; i++) { this.ux[i] = x[i]; this.uy[i] = y[i]; }
      this.time = 0; this.steps = 0;
      this.drag = null; this.ramp = null;
      this.forces();
      this.resetSampling();
      return this;
    }

    _pickType(s, col, row, R) {
      const t = s.types;
      switch (s.assign) {
        case 'checker': return t[(col + row) & 1] | 0;
        case 'random':  return (R() < (s.frac == null ? 0.5 : s.frac)) ? (t[0] | 0) : (t[1] | 0);
        default: return t[0] | 0;
      }
    }

    _addBond(i, j, r0, k) {
      const b = this.nbond++;
      this.bi[b] = i; this.bj[b] = j; this.br0[b] = r0; this.bk[b] = k;
      if (this.exn[i] < MAXEX) this.exl[i * MAXEX + this.exn[i]++] = j;
      if (this.exn[j] < MAXEX) this.exl[j * MAXEX + this.exn[j]++] = i;
    }

    /* --------------------------------------------------------- boundaries */

    boundary() {
      const N = this.N, L = this.L, x = this.x, y = this.y;
      if (this.pbc) {
        /* Wrapped arithmetically, not by a repeat-subtract loop: an atom that
           an unstable timestep has thrown to ±Infinity would spin such a loop
           forever and hang the tab. Here it lands on NaN instead, which
           checkStable() picks up on the next sweep. */
        for (let i = 0; i < N; i++) {
          const xi = x[i], yi = y[i];
          if (xi < 0 || xi >= L) x[i] = xi - Math.floor(xi / L) * L;
          if (yi < 0 || yi >= L) y[i] = yi - Math.floor(yi / L) * L;
        }
      } else {
        const vx = this.vx, vy = this.vy;
        for (let i = 0; i < N; i++) {
          const r = 0.5 * SPECIES[this.type[i]].sig, hi = L - r;
          /* mirror, then clamp: a normal step overshoots a wall by a hair, but
             a mode switch or a blow-up can leave an atom far outside, and
             mirroring that would fling it across the box on top of others */
          if (x[i] < r)  { x[i] = Math.min(2 * r - x[i], hi);  if (vx[i] < 0) { this._wallImp += -2 * vx[i] / this.invm[i]; vx[i] = -vx[i]; } }
          if (x[i] > hi) { x[i] = Math.max(2 * hi - x[i], r);  if (vx[i] > 0) { this._wallImp +=  2 * vx[i] / this.invm[i]; vx[i] = -vx[i]; } }
          if (y[i] < r)  { y[i] = Math.min(2 * r - y[i], hi);  if (vy[i] < 0) { this._wallImp += -2 * vy[i] / this.invm[i]; vy[i] = -vy[i]; } }
          if (y[i] > hi) { y[i] = Math.max(2 * hi - y[i], r);  if (vy[i] > 0) { this._wallImp +=  2 * vy[i] / this.invm[i]; vy[i] = -vy[i]; } }
          /* a confined system has nowhere to diffuse to — keep MSD honest */
          this.ux[i] = x[i]; this.uy[i] = y[i];
        }
      }
    }

    /* Cheap backstop against a diverged integrator — a big timestep with the
       thermostat off will eventually do it, and once a coordinate is NaN every
       downstream read-out is nonsense. The UI polls this and rebuilds. */
    checkStable() {
      const N = this.N;
      for (let i = 0; i < N; i++) {
        if (!(this.x[i] >= 0 && this.x[i] <= this.L) || !(this.y[i] >= 0 && this.y[i] <= this.L) ||
            !isFinite(this.vx[i]) || !isFinite(this.vy[i])) return false;
      }
      return isFinite(this.pe);
    }

    /* -------------------------------------------------------- cell lists */

    _cells() {
      const L = this.L, N = this.N;
      let nc = Math.floor(L / this.RCmax);
      /* clamping *down* only ever makes cells larger, which stays correct */
      nc = Math.min(nc, 96);
      if (!isFinite(nc) || nc < 3) { this.nc = 0; return; }
      this.nc = nc;
      this.cs = L / nc;
      if (!this.cellHead || this.cellHead.length < nc * nc) this.cellHead = new Int32Array(nc * nc);
      this.cellHead.fill(-1, 0, nc * nc);
      const cs = this.cs, head = this.cellHead, next = this.cellNext, x = this.x, y = this.y;
      for (let i = 0; i < N; i++) {
        let cx = Math.floor(x[i] / cs), cy = Math.floor(y[i] / cs);
        if (cx < 0) cx = 0; else if (cx >= nc) cx = nc - 1;
        if (cy < 0) cy = 0; else if (cy >= nc) cy = nc - 1;
        const c = cy * nc + cx;
        next[i] = head[c]; head[c] = i;
      }
    }

    _excluded(i, j) {
      const n = this.exn[i], base = i * MAXEX;
      for (let k = 0; k < n; k++) if (this.exl[base + k] === j) return true;
      return false;
    }

    /* ------------------------------------------------------------- forces */

    forces() {
      const N = this.N, x = this.x, y = this.y, fx = this.fx, fy = this.fy;
      const L = this.L, hL = L * 0.5, pbc = this.pbc;

      fx.fill(0, 0, N); fy.fill(0, 0, N);
      this.pei.fill(0, 0, N); this.nbr.fill(0, 0, N);
      this._pe = 0; this._vir = 0;

      this._cells();
      const nc = this.nc;

      if (nc >= 3) {
        const head = this.cellHead, next = this.cellNext;
        /* half shell: self, +x, +x+y, +y, −x+y — each neighbour pair once */
        const OX = [0, 1, 1, 0, -1], OY = [0, 0, 1, 1, 1];
        for (let cy = 0; cy < nc; cy++) {
          for (let cx = 0; cx < nc; cx++) {
            const c = cy * nc + cx;
            for (let o = 0; o < 5; o++) {
              let ox = cx + OX[o], oy = cy + OY[o];
              if (pbc) {
                if (ox < 0) ox += nc; else if (ox >= nc) ox -= nc;
                if (oy < 0) oy += nc; else if (oy >= nc) oy -= nc;
              } else if (ox < 0 || ox >= nc || oy < 0 || oy >= nc) continue;
              const c2 = oy * nc + ox;
              for (let i = head[c]; i >= 0; i = next[i]) {
                for (let j = (o === 0 ? next[i] : head[c2]); j >= 0; j = next[j]) {
                  let dx = x[i] - x[j], dy = y[i] - y[j];
                  if (pbc) {
                    if (dx > hL) dx -= L; else if (dx < -hL) dx += L;
                    if (dy > hL) dy -= L; else if (dy < -hL) dy += L;
                  }
                  const r2 = dx * dx + dy * dy;
                  if (r2 > 1e-12) this._pair(i, j, dx, dy, r2);
                }
              }
            }
          }
        }
      } else {
        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            let dx = x[i] - x[j], dy = y[i] - y[j];
            if (pbc) {
              if (dx > hL) dx -= L; else if (dx < -hL) dx += L;
              if (dy > hL) dy -= L; else if (dy < -hL) dy += L;
            }
            const r2 = dx * dx + dy * dy;
            if (r2 > 1e-12) this._pair(i, j, dx, dy, r2);
          }
        }
      }

      /* harmonic bonds — bead-spring molecules */
      for (let b = 0; b < this.nbond; b++) {
        const i = this.bi[b], j = this.bj[b];
        let dx = x[i] - x[j], dy = y[i] - y[j];
        if (pbc) {
          if (dx > hL) dx -= L; else if (dx < -hL) dx += L;
          if (dy > hL) dy -= L; else if (dy < -hL) dy += L;
        }
        const r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
        if (r < 1e-9) continue;
        const dr = r - this.br0[b], kb = this.bk[b];
        const fs = -kb * dr / r;
        fx[i] += fs * dx; fy[i] += fs * dy;
        fx[j] -= fs * dx; fy[j] -= fs * dy;
        const u = 0.5 * kb * dr * dr;
        this._pe += u; this._vir += fs * r2;
        this.pei[i] += 0.5 * u; this.pei[j] += 0.5 * u;
      }

      /* the pointer spring, when someone is dragging an atom around */
      const d = this.drag;
      if (d && d.i >= 0 && d.i < N) {
        let dx = d.x - x[d.i], dy = d.y - y[d.i];
        if (pbc) {
          if (dx > hL) dx -= L; else if (dx < -hL) dx += L;
          if (dy > hL) dy -= L; else if (dy < -hL) dy += L;
        }
        fx[d.i] += d.k * dx; fy[d.i] += d.k * dy;
      }

      for (let i = 0; i < N; i++) this.fmag[i] = Math.hypot(fx[i], fy[i]);
      this.pe = this._pe;
      this.virial = this._vir;
      return this.pe;
    }

    _pair(i, j, dx, dy, r2) {
      const ti = this.type[i], tj = this.type[j], p = ti * NSP + tj;
      let fs = 0, u = 0, hit = false;

      if (r2 < this.p_rc2[p]) {
        if (this.nbond > 0 && this._excluded(i, j)) return;
        const s2 = this.p_sig2[p] / r2;
        const s6 = s2 * s2 * s2, s12 = s6 * s6;
        fs = this.p_e24[p] * (2 * s12 - s6) / r2;
        u  = this.p_e4[p] * (s12 - s6) - this.p_ush[p];
        this.nbr[i]++; this.nbr[j]++;
        hit = true;
      }

      if (this.kCoulomb !== 0 && r2 < this._rcq2) {
        const qi = SPECIES[ti].q, qj = SPECIES[tj].q;
        if (qi !== 0 && qj !== 0) {
          if (this.nbond > 0 && !hit && this._excluded(i, j)) return;
          const r = Math.sqrt(r2), a = this.alpha, qq = this.kCoulomb * qi * qj;
          const ec = erfc(a * r), ex = Math.exp(-a * a * r2);
          u  += qq * (ec / r - this._dsfU + this._dsfF * (r - this.rcq));
          fs += qq * (ec / r2 + TWO_OVER_SQRTPI * a * ex / r - this._dsfF) / r;
          hit = true;
        }
      }

      if (!hit) return;
      this.fx[i] += fs * dx; this.fy[i] += fs * dy;
      this.fx[j] -= fs * dx; this.fy[j] -= fs * dy;
      this._pe += u; this._vir += fs * r2;
      this.pei[i] += 0.5 * u; this.pei[j] += 0.5 * u;
    }

    /* The force and potential a bare species-A atom would feel at (px, py).
       This is what the vector field and the energy wash are drawn from — the
       field is a *probe* reading, not an interpolation of the atom forces. */
    probe(px, py, out) {
      const L = this.L, hL = L * 0.5, pbc = this.pbc, nc = this.nc;
      let ffx = 0, ffy = 0, u = 0;
      const scan = (i) => {
        let dx = px - this.x[i], dy = py - this.y[i];
        if (pbc) {
          if (dx > hL) dx -= L; else if (dx < -hL) dx += L;
          if (dy > hL) dy -= L; else if (dy < -hL) dy += L;
        }
        const r2 = dx * dx + dy * dy;
        if (r2 < 1e-9) return;
        const p = this.type[i];                       // probe is species A ⇒ row 0
        if (r2 < this.p_rc2[p]) {
          const s2 = this.p_sig2[p] / r2, s6 = s2 * s2 * s2, s12 = s6 * s6;
          const fs = this.p_e24[p] * (2 * s12 - s6) / r2;
          ffx += fs * dx; ffy += fs * dy;
          u += this.p_e4[p] * (s12 - s6) - this.p_ush[p];
        }
      };
      if (nc >= 3) {
        const cs = this.cs, head = this.cellHead, next = this.cellNext;
        let cx = Math.floor(px / cs), cy = Math.floor(py / cs);
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            let ax = cx + ox, ay = cy + oy;
            if (pbc) { ax = ((ax % nc) + nc) % nc; ay = ((ay % nc) + nc) % nc; }
            else if (ax < 0 || ax >= nc || ay < 0 || ay >= nc) continue;
            for (let i = head[ay * nc + ax]; i >= 0; i = next[i]) scan(i);
          }
        }
      } else {
        for (let i = 0; i < this.N; i++) scan(i);
      }
      out[0] = ffx; out[1] = ffy; out[2] = u;
      return out;
    }

    /* --------------------------------------------------------- integrator */

    /* BAOAB. With gamma = 0 the O step is the identity and this is plain
       velocity Verlet, so NVE and Langevin share one code path and one force
       evaluation per step. */
    step() {
      const N = this.N, dt = this.dt, h = dt * 0.5;
      const x = this.x, y = this.y, vx = this.vx, vy = this.vy;
      const fx = this.fx, fy = this.fy, ux = this.ux, uy = this.uy, im = this.invm;

      if (this.ramp) {
        const p = Math.min(1, (this.time - this.ramp.t0) / this.ramp.over);
        this.T = this.ramp.from + (this.ramp.to - this.ramp.from) * p;
        if (p >= 1) this.ramp = null;
      }

      for (let i = 0; i < N; i++) { vx[i] += h * fx[i] * im[i]; vy[i] += h * fy[i] * im[i]; }

      for (let i = 0; i < N; i++) {
        const ax = h * vx[i], ay = h * vy[i];
        x[i] += ax; y[i] += ay; ux[i] += ax; uy[i] += ay;
      }
      this.boundary();

      if (this.thermostat === 'langevin' && this.gamma > 0) {
        const c1 = Math.exp(-this.gamma * dt);
        const c2b = Math.sqrt(this.T * (1 - c1 * c1));
        for (let i = 0; i < N; i++) {
          const c2 = c2b * Math.sqrt(im[i]);
          vx[i] = c1 * vx[i] + c2 * this._gauss();
          vy[i] = c1 * vy[i] + c2 * this._gauss();
        }
      }

      for (let i = 0; i < N; i++) {
        const ax = h * vx[i], ay = h * vy[i];
        x[i] += ax; y[i] += ay; ux[i] += ax; uy[i] += ay;
      }
      this.boundary();

      this.forces();

      for (let i = 0; i < N; i++) { vx[i] += h * fx[i] * im[i]; vy[i] += h * fy[i] * im[i]; }

      if (this.thermostat === 'berendsen') {
        const Tn = this.temperature();
        if (Tn > 1e-9) {
          let lam = Math.sqrt(1 + (dt / this.tauT) * (this.T / Tn - 1));
          lam = Math.min(1.2, Math.max(0.83, lam));
          for (let i = 0; i < N; i++) { vx[i] *= lam; vy[i] *= lam; }
        }
      }

      this.time += dt; this.steps++;
    }

    _gauss() {
      if (this._spare !== null) { const s = this._spare; this._spare = null; return s; }
      let u, v, s;
      do { u = 2 * this.rng() - 1; v = 2 * this.rng() - 1; s = u * u + v * v; }
      while (s >= 1 || s === 0);
      const m = Math.sqrt(-2 * Math.log(s) / s);
      this._spare = v * m;
      return u * m;
    }

    /* ----------------------------------------------------- initialisation */

    setTemperature(T) {
      const N = this.N, vx = this.vx, vy = this.vy, im = this.invm;
      for (let i = 0; i < N; i++) {
        const sd = Math.sqrt(T * im[i]);
        vx[i] = sd * this._gauss(); vy[i] = sd * this._gauss();
      }
      this._zeroMomentum();
      const Tn = this.temperature();
      if (Tn > 1e-12) {
        const lam = Math.sqrt(T / Tn);
        for (let i = 0; i < N; i++) { vx[i] *= lam; vy[i] *= lam; }
      }
    }

    _zeroMomentum() {
      const N = this.N; if (!N) return;
      let px = 0, py = 0, M = 0;
      for (let i = 0; i < N; i++) {
        const m = 1 / this.invm[i];
        px += m * this.vx[i]; py += m * this.vy[i]; M += m;
      }
      px /= M; py /= M;
      for (let i = 0; i < N; i++) { this.vx[i] -= px; this.vy[i] -= py; }
    }

    /* Normalised steepest descent with backtracking. Cheap insurance: every
       preset starts from a configuration with no overlapping cores, so the
       first integrator step can never launch an atom across the box. */
    minimise(maxIter = 400, maxDisp = 0.02) {
      const N = this.N;
      if (!N) return;
      let disp = maxDisp;
      let pe = this.forces();
      const sx = new Float64Array(N), sy = new Float64Array(N);
      for (let it = 0; it < maxIter; it++) {
        let fmax = 0;
        for (let i = 0; i < N; i++) fmax = Math.max(fmax, this.fmag[i]);
        if (fmax < 1e-4) break;
        sx.set(this.x.subarray(0, N)); sy.set(this.y.subarray(0, N));
        const sc = disp / fmax;
        for (let i = 0; i < N; i++) { this.x[i] += sc * this.fx[i]; this.y[i] += sc * this.fy[i]; }
        this.boundary();
        const pe2 = this.forces();
        if (pe2 > pe) {
          this.x.set(sx, 0); this.y.set(sy, 0);
          this.forces();
          disp *= 0.5;
          if (disp < 1e-5) break;
        } else {
          pe = pe2;
          disp = Math.min(maxDisp, disp * 1.1);
        }
      }
    }

    /* ------------------------------------------------------- observables */

    /* Degrees of freedom: 2 per atom, less the 2 that the conserved centre of
       mass takes away under periodic boundaries. */
    dof() { return Math.max(1, 2 * this.N - (this.pbc ? 2 : 0)); }

    kinetic() {
      let ke = 0;
      for (let i = 0; i < this.N; i++) {
        const m = 1 / this.invm[i];
        ke += 0.5 * m * (this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i]);
      }
      return ke;
    }

    temperature() { return this.N ? 2 * this.kinetic() / this.dof() : 0; }

    /* 2D virial pressure, P = (N k T + ½ Σ r·f) / A. Under reflecting walls
       the virial is not the right object, so the wall impulse is used instead. */
    pressure(T) {
      const A = this.L * this.L;
      if (this.pbc) return (this.N * T + 0.5 * this.virial) / A;
      return this._wallP || 0;
    }

    state() {
      const T = this.temperature();
      const ke = this.kinetic();
      return {
        T, ke, pe: this.pe, tot: ke + this.pe,
        kePer: ke / Math.max(1, this.N),
        pePer: this.pe / Math.max(1, this.N),
        totPer: (ke + this.pe) / Math.max(1, this.N),
        P: this.pressure(T), rho: this.rho, N: this.N, L: this.L, time: this.time,
      };
    }

    /* --------------------------------------------------------- sampling */

    resetSampling() {
      const nb = 120;
      this.rdf = { nb, hist: new Float64Array(nb), frames: 0, rmax: 0, dr: 0 };
      this._wallImp = 0; this._wallT0 = this.time; this._wallP = 0;
      this.msdT0 = this.time;
      for (let i = 0; i < this.N; i++) { this.x0[i] = this.ux[i]; this.y0[i] = this.uy[i]; }
    }

    /* Generic pair walk out to rmax, callback per pair. The force kernel keeps
       its own hand-inlined half-shell loop — this one exists for the analysis
       and drawing paths, where a callback costs nothing that matters. */
    _walk(rmax, cb) {
      const N = this.N, x = this.x, y = this.y, L = this.L, hL = L * 0.5, pbc = this.pbc;
      const nc = this.nc, rm2 = rmax * rmax;
      const reach = nc ? Math.ceil(rmax / this.cs) : 0;
      /* a wrapped cell would be visited twice once the stencil outgrows the box */
      if (nc >= 3 && 2 * reach + 1 <= nc) {
        const head = this.cellHead, next = this.cellNext;
        for (let cy = 0; cy < nc; cy++) for (let cx = 0; cx < nc; cx++) {
          for (let i = head[cy * nc + cx]; i >= 0; i = next[i]) {
            for (let oy = -reach; oy <= reach; oy++) for (let ox = -reach; ox <= reach; ox++) {
              let ay = cy + oy, ax = cx + ox;
              if (pbc) { ay = (ay % nc + nc) % nc; ax = (ax % nc + nc) % nc; }
              else if (ay < 0 || ay >= nc || ax < 0 || ax >= nc) continue;
              for (let j = head[ay * nc + ax]; j >= 0; j = next[j]) {
                if (j <= i) continue;
                let dx = x[i] - x[j], dy = y[i] - y[j];
                if (pbc) {
                  if (dx > hL) dx -= L; else if (dx < -hL) dx += L;
                  if (dy > hL) dy -= L; else if (dy < -hL) dy += L;
                }
                const d2 = dx * dx + dy * dy;
                if (d2 < rm2 && d2 > 1e-12) cb(i, j, dx, dy, d2);
              }
            }
          }
        }
      } else {
        for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
          let dx = x[i] - x[j], dy = y[i] - y[j];
          if (pbc) {
            if (dx > hL) dx -= L; else if (dx < -hL) dx += L;
            if (dy > hL) dy -= L; else if (dy < -hL) dy += L;
          }
          const d2 = dx * dx + dy * dy;
          if (d2 < rm2 && d2 > 1e-12) cb(i, j, dx, dy, d2);
        }
      }
    }

    /* g(r), accumulated over frames. */
    sampleRDF() {
      const rmax = Math.min(this.L * 0.5, 5);
      const r = this.rdf;
      if (r.rmax !== rmax) { r.rmax = rmax; r.dr = rmax / r.nb; r.hist.fill(0); r.frames = 0; }
      const inv = 1 / r.dr, h = r.hist, nb = r.nb;
      this._walk(rmax, (i, j, dx, dy, d2) => {
        const b = (Math.sqrt(d2) * inv) | 0;
        if (b < nb) h[b]++;
      });
      r.frames++;
    }

    /* Every pair closer than `factor` × σ_ij, as a flat stream the link layer
       draws: [i, j, dx, dy, r, f] — f > 0 means the two atoms are pushing
       apart, f < 0 means they are pulling together. */
    pairs(factor) {
      const rmax = factor * 1.35;                 // widest σ_ij in the table
      let n = 0;
      let buf = this._pairBuf || (this._pairBuf = new Float64Array(6 * 4096));
      this._walk(rmax, (i, j, dx, dy, d2) => {
        const p = this.type[i] * NSP + this.type[j];
        const cut = factor * this.p_sig[p];
        if (d2 > cut * cut) return;
        if (this.nbond > 0 && this._excluded(i, j)) return;
        if ((n + 1) * 6 > buf.length) {
          const grown = new Float64Array(buf.length * 2);
          grown.set(buf); buf = this._pairBuf = grown;
        }
        const s2 = this.p_sig2[p] / d2, s6 = s2 * s2 * s2, s12 = s6 * s6;
        const k = n * 6;
        buf[k] = i; buf[k + 1] = j; buf[k + 2] = dx; buf[k + 3] = dy;
        buf[k + 4] = Math.sqrt(d2);
        buf[k + 5] = this.p_e24[p] * (2 * s12 - s6) / Math.sqrt(d2);
        n++;
      });
      return { n, buf };
    }

    /* Normalised g(r): pairs counted once, annulus area 2π r dr in 2D. */
    getRDF() {
      const r = this.rdf, out = new Float64Array(r.nb), rs = new Float64Array(r.nb);
      if (!r.frames || !this.N) return { r: rs, g: out, dr: r.dr };
      const rho = this.rho, N = this.N;
      for (let b = 0; b < r.nb; b++) {
        const r1 = b * r.dr, r2 = r1 + r.dr;
        rs[b] = 0.5 * (r1 + r2);
        const area = Math.PI * (r2 * r2 - r1 * r1);
        out[b] = (2 * r.hist[b]) / (r.frames * N * rho * area);
      }
      return { r: rs, g: out, dr: r.dr };
    }

    /* Mean-square displacement since the last resetSampling, and the Einstein
       diffusion coefficient D = MSD / 4t in two dimensions. */
    msd(typeFilter) {
      let s = 0, n = 0;
      for (let i = 0; i < this.N; i++) {
        if (typeFilter != null && this.type[i] !== typeFilter) continue;
        const dx = this.ux[i] - this.x0[i], dy = this.uy[i] - this.y0[i];
        s += dx * dx + dy * dy; n++;
      }
      const dt = this.time - this.msdT0;
      const m = n ? s / n : 0;
      return { msd: m, dt, D: dt > 1e-6 ? m / (4 * dt) : 0, n };
    }

    speeds(typeFilter) {
      const out = [];
      for (let i = 0; i < this.N; i++) {
        if (typeFilter != null && this.type[i] !== typeFilter) continue;
        out.push(Math.hypot(this.vx[i], this.vy[i]));
      }
      return out;
    }

    /* Wall pressure = total impulse delivered to the walls per unit time per
       unit perimeter. Only meaningful when the boundaries actually are walls. */
    updateWallPressure() {
      const dt = this.time - this._wallT0;
      if (dt > 0.5) {
        this._wallP = this._wallImp / (dt * 4 * this.L);
        this._wallImp = 0; this._wallT0 = this.time;
      }
    }

    /* Nearest atom to a point, in the minimum image — for hover and drag. */
    pick(px, py, maxR) {
      const L = this.L, hL = L * 0.5;
      let best = -1, bd = (maxR || 2) * (maxR || 2);
      for (let i = 0; i < this.N; i++) {
        let dx = px - this.x[i], dy = py - this.y[i];
        if (this.pbc) {
          if (dx > hL) dx -= L; else if (dx < -hL) dx += L;
          if (dy > hL) dy -= L; else if (dy < -hL) dy += L;
        }
        const d2 = dx * dx + dy * dy;
        const rr = 0.5 * SPECIES[this.type[i]].sig;
        if (d2 < Math.max(bd, rr * rr)) { bd = d2; best = i; }
      }
      return best;
    }

    /* Local heating / cooling under the pointer: scale velocities inside a
       disc. Energy in, energy out — the thermostat then fights back. */
    brush(px, py, radius, factor) {
      const L = this.L, hL = L * 0.5, r2 = radius * radius;
      for (let i = 0; i < this.N; i++) {
        let dx = px - this.x[i], dy = py - this.y[i];
        if (this.pbc) {
          if (dx > hL) dx -= L; else if (dx < -hL) dx += L;
          if (dy > hL) dy -= L; else if (dy < -hL) dy += L;
        }
        const d2 = dx * dx + dy * dy;
        if (d2 < r2) {
          const w = 1 - d2 / r2;
          const f = 1 + (factor - 1) * w;
          this.vx[i] *= f; this.vy[i] *= f;
        }
      }
    }

    setCross(v)   { this.cross = v; this._buildPairTable(); }
    setCoulomb(v) { this.kCoulomb = v; this._buildPairTable(); }
    setCutoff(v)  { this.rc = v; this._buildPairTable(); }

    /* Pair potential and force curves, for the inspector plot. */
    curve(ta, tb, n, rmin, rmax) {
      const p = ta * NSP + tb;
      const U = new Float64Array(n), F = new Float64Array(n), R = new Float64Array(n);
      const rcut = Math.sqrt(this.p_rc2[p]);
      for (let k = 0; k < n; k++) {
        const r = rmin + (rmax - rmin) * k / (n - 1);
        R[k] = r;
        if (r > rcut) { U[k] = 0; F[k] = 0; continue; }
        const s2 = this.p_sig2[p] / (r * r), s6 = s2 * s2 * s2, s12 = s6 * s6;
        U[k] = this.p_e4[p] * (s12 - s6) - this.p_ush[p];
        F[k] = this.p_e24[p] * (2 * s12 - s6) / r;
      }
      return { r: R, U, F, rcut, rmin: Math.pow(2, 1 / 6) * this.p_sig[p], sig: this.p_sig[p] };
    }
  }

  /* --------------------------------------------------------------- presets */

  const PRESETS = [
    {
      id: 'liquid', name: 'Liquid argon',
      blurb: 'The reference state. Dense, disordered, and diffusive — every atom keeps six-ish neighbours but never the same six.',
      build: { n: 460, rho: 0.75, lattice: 'tri', assign: 'single', types: [0] },
      run: { T: 0.70, thermostat: 'langevin', gamma: 0.6, pbc: true, cross: 1, kC: 0, dt: 0.004 },
      /* no energy wash here on purpose: at ρ* = 0.75 every point in the box is
         inside some atom's repulsive core, so the wash would be uniformly red
         and say nothing. It earns its place in the dilute presets below. */
      view: { links: true, forces: false, vel: false, field: 'arrows', wash: 'none', color: 'species', trails: false },
    },
    {
      id: 'crystal', name: '2D crystal',
      blurb: 'Cold and dense: atoms lock into the triangular lattice that is 2D close packing, and only rattle inside their cages.',
      build: { n: 460, rho: 0.95, lattice: 'tri', assign: 'single', types: [0] },
      run: { T: 0.15, thermostat: 'langevin', gamma: 0.6, pbc: true, cross: 1, kC: 0, dt: 0.004 },
      view: { links: true, forces: false, vel: false, field: 'none', wash: 'none', color: 'species', trails: false },
    },
    {
      id: 'melt', name: 'Melting run',
      blurb: 'The same crystal, heated from T* = 0.15 to 1.1 over 120 τ. Watch g(r) lose its outer peaks as the lattice gives way.',
      build: { n: 460, rho: 0.92, lattice: 'tri', assign: 'single', types: [0] },
      run: { T: 0.15, thermostat: 'langevin', gamma: 0.6, pbc: true, cross: 1, kC: 0, dt: 0.004,
             ramp: { to: 1.1, over: 120 } },
      view: { links: true, forces: false, vel: false, field: 'none', wash: 'none', color: 'ke', trails: false },
    },
    {
      id: 'gas', name: 'Dilute vapour, in a box',
      blurb: 'Reflecting walls instead of periodic images. Atoms fly ballistically between rare collisions, and the pressure read-out comes straight from wall impulses.',
      build: { n: 230, rho: 0.10, lattice: 'tri', assign: 'single', types: [0] },
      run: { T: 2.0, thermostat: 'langevin', gamma: 0.05, pbc: false, cross: 1, kC: 0, dt: 0.003 },
      view: { links: false, forces: false, vel: true, field: 'lines', wash: 'energy', color: 'speed', trails: true },
    },
    {
      id: 'coexist', name: 'Liquid–vapour coexistence',
      blurb: 'Below the critical temperature at an intermediate density, a uniform fluid is unstable: it separates itself into a drop and its vapour.',
      build: { n: 620, rho: 0.32, lattice: 'tri', assign: 'single', types: [0] },
      run: { T: 0.42, thermostat: 'langevin', gamma: 0.4, pbc: true, cross: 1, kC: 0, dt: 0.004 },
      view: { links: true, forces: false, vel: false, field: 'none', wash: 'energy', color: 'species', trails: false },
    },
    {
      id: 'demix', name: 'Binary demixing',
      blurb: 'Two species that like themselves more than each other (ε_AB scaled to 0.5). B is the bigger, heavier one; unmixing is driven entirely by the pair potential.',
      build: { n: 560, rho: 0.55, lattice: 'tri', assign: 'random', types: [0, 1], frac: 0.5 },
      run: { T: 0.50, thermostat: 'langevin', gamma: 0.6, pbc: true, cross: 0.5, kC: 0, dt: 0.004 },
      view: { links: true, forces: false, vel: false, field: 'none', wash: 'none', color: 'species', trails: false },
    },
    {
      id: 'dimers', name: 'Diatomic molecules',
      blurb: 'Bonded pairs. Temperature now buys three things at once — translation, rotation, and the bond stretch you can watch breathe.',
      build: { n: 240, rho: 0.55, lattice: 'tri', assign: 'single', types: [0], bond: 'dimer', bondR0: 1.05, bondK: 300 },
      run: { T: 0.60, thermostat: 'langevin', gamma: 0.4, pbc: true, cross: 1, kC: 0, dt: 0.003 },
      view: { links: false, forces: false, vel: false, field: 'none', wash: 'none', color: 'ke', trails: false },
    },
    {
      id: 'polymer', name: 'Polymer melt',
      blurb: 'Bead-spring chains of twelve. They start as straight rods and coil up within a few τ, because entropy says so.',
      build: { n: 480, rho: 0.75, lattice: 'tri', assign: 'single', types: [0], bond: 'chain', chainLen: 12, bondK: 400 },
      run: { T: 1.0, thermostat: 'langevin', gamma: 0.6, pbc: true, cross: 1, kC: 0, dt: 0.003 },
      view: { links: false, forces: false, vel: false, field: 'none', wash: 'none', color: 'species', trails: false },
    },
    {
      id: 'ionic', name: 'Ionic crystal',
      blurb: 'Alternating charges on a square lattice with damped shifted-force electrostatics. The field between the ions is the whole point — turn the vector layer on.',
      build: { n: 484, rho: 0.85, lattice: 'square', assign: 'checker', types: [2, 3] },
      run: { T: 0.25, thermostat: 'langevin', gamma: 0.6, pbc: true, cross: 1, kC: 12, dt: 0.002 },
      view: { links: false, forces: false, vel: false, field: 'arrows', wash: 'none', color: 'species', trails: false },
    },
    {
      id: 'brownian', name: 'Brownian probe',
      blurb: 'One colloid, twenty times heavier and three σ across, in a bath of small atoms. Its random walk is the fluctuation–dissipation theorem, drawn.',
      build: { n: 520, rho: 0.70, lattice: 'tri', assign: 'probe', types: [0] },
      run: { T: 1.0, thermostat: 'langevin', gamma: 0.3, pbc: true, cross: 1, kC: 0, dt: 0.003 },
      view: { links: false, forces: false, vel: false, field: 'none', wash: 'none', color: 'species', trails: true },
    },
  ];

  return { Engine, SPECIES, PRESETS, ARGON, NSP, erfc, mulberry32 };
}));
