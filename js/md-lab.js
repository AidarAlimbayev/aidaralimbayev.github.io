/* ==========================================================================
   md-lab.js — the atomic interaction lab: canvas, charts, controls.
   Physics lives in js/md-engine.js; this file never integrates anything, it
   only reads the engine and draws it.

   Four layers stack inside the viewport, back to front:
     1. energy wash   — U(r) a probe atom would feel, on a grid (diverging ramp)
     2. force field   — arrows or field lines of −∇U, same probe (sequential ramp)
     3. interactions  — one segment per close pair, warm = pushing apart,
                        cool = pulling together
     4. atoms         — plus optional per-atom force and velocity vectors
   Every colour comes from a --md-* custom property so the theme toggle drives
   the canvas as well as the CSS.

   Chart colours are a three-slot categorical palette validated for CVD
   separation and contrast in both modes against the card surfaces this page
   uses (#ffffff / #0f172a): worst all-pairs CVD ΔE 13.7 light / 13.8 dark,
   normal-vision 24.6 / 20.9, all three ≥ 3:1 against the surface.
   ========================================================================== */
(function () {
  'use strict';

  const MOUNT = document.getElementById('md-lab');
  if (!MOUNT || !window.MDEngine) return;

  const { Engine, SPECIES, PRESETS, ARGON } = window.MDEngine;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

  /* ====================================================== colour utilities */

  /* OKLab, so ramps stay perceptually even instead of muddying through sRGB. */
  function hexToRgb(h) {
    h = h.trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  const toLin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const toSrgb = c => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

  function rgbToOklab(r, g, b) {
    r = toLin(r); g = toLin(g); b = toLin(b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ];
  }
  function oklabToRgb(L, A, B) {
    const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
    const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
    const s = Math.pow(L - 0.0894841775 * A - 1.2914855480 * B, 3);
    return [
      clamp(toSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), 0, 1),
      clamp(toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), 0, 1),
      clamp(toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s), 0, 1),
    ];
  }
  const hexOf = (r, g, b) => '#' +
    [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

  /* n evenly spaced steps through a list of hex stops, interpolated in OKLab */
  function makeRamp(stops, n) {
    const lab = stops.map(h => rgbToOklab.apply(null, hexToRgb(h)));
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      const t = (n === 1) ? 0 : i / (n - 1);
      const seg = Math.min(lab.length - 2, Math.floor(t * (lab.length - 1)));
      const u = t * (lab.length - 1) - seg;
      const a = lab[seg], b = lab[seg + 1];
      const rgb = oklabToRgb(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u);
      out[i] = hexOf(rgb[0], rgb[1], rgb[2]);
    }
    return out;
  }
  function rampBytes(stops, n) {
    const hex = makeRamp(stops, n), out = new Uint8ClampedArray(n * 3);
    for (let i = 0; i < n; i++) {
      const c = hexToRgb(hex[i]);
      out[i * 3] = c[0] * 255; out[i * 3 + 1] = c[1] * 255; out[i * 3 + 2] = c[2] * 255;
    }
    return out;
  }
  function withAlpha(hex, a) {
    const c = hexToRgb(hex);
    return `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
  }

  /* ------------------------------------------------------------ the theme */
  const TOK = ['surface', 'surface2', 'ink', 'ink2', 'ink3', 'rule', 'rule2', 'accent',
    's1', 's2', 's3', 'pos', 'neg', 'mid', 'stage', 'seq0', 'seq1', 'grid',
    'wash0', 'wash1', 'wash2'];
  let C = {};
  function readTheme() {
    const cs = getComputedStyle(MOUNT);
    TOK.forEach(k => { C[k] = (cs.getPropertyValue('--md-' + k) || '#888').trim(); });
    C.speciesFill = [C.s1, C.s2, C.pos, C.neg, C.s3];
    /* sequential = one hue, light→dark (inverted for the dark stage) */
    C.seqHex = makeRamp([C.seq0, C.seq1], 12);
    /* the same ramp, minus the four steps nearest the surface: an atom fill
       has to stay visible, where a background arrow may recede to nothing */
    C.seqAtom = makeRamp([C.seq0, C.seq1], 16).slice(4);
    /* diverging = two opposite hues + a neutral midpoint. Saturated for marks
       (links, ions); a soft parallel ramp for the background wash, which must
       stay recessive under the atoms. */
    C.divHex = makeRamp([C.neg, C.mid, C.pos], 12);
    C.washLUT = rampBytes([C.wash0, C.wash1, C.wash2], 256);
    C.washHex = makeRamp([C.wash0, C.wash1, C.wash2], 12);
    /* field *magnitude* has no polarity, so its wash is sequential — one hue
       climbing out of the neutral midpoint, never the diverging ramp */
    C.washSeqLUT = rampBytes([C.wash1, C.seq1], 256);
    C.washSeqHex = makeRamp([C.wash1, C.seq1], 12);
    washDirty = true;
  }

  /* ================================================================ state */

  const eng = new Engine();
  const V = {                       // what the viewport draws
    links: false, forces: false, vel: false, trails: false,
    field: 'arrows', wash: 'energy', color: 'species', ghosts: true,
  };
  const UI = {
    running: false, rate: 4, preset: 'liquid', tool: 'drag',
    hover: -1, pinned: -1, brushing: 0, showTable: false,
  };

  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------- ring buffer */
  class Ring {
    constructor(n) { this.a = new Float32Array(n); this.cap = n; this.n = 0; this.i = 0; }
    push(v) { this.a[this.i] = v; this.i = (this.i + 1) % this.cap; if (this.n < this.cap) this.n++; }
    at(k) { return this.a[(this.i - this.n + k + this.cap * 2) % this.cap]; }
    last() { return this.n ? this.at(this.n - 1) : 0; }
    clear() { this.n = 0; this.i = 0; }
    range() {
      let lo = Infinity, hi = -Infinity;
      for (let k = 0; k < this.n; k++) { const v = this.at(k); if (v < lo) lo = v; if (v > hi) hi = v; }
      return this.n ? [lo, hi] : [0, 1];
    }
  }
  const SERIES_N = 720;
  const H = {
    t: new Ring(SERIES_N), T: new Ring(SERIES_N), ke: new Ring(SERIES_N),
    pe: new Ring(SERIES_N), tot: new Ring(SERIES_N), P: new Ring(SERIES_N),
    msdT: new Ring(SERIES_N), msd: new Ring(SERIES_N),
  };
  function clearHistory() { Object.values(H).forEach(r => r.clear()); }

  /* trails: a handful of tracked atoms, so the layer stays cheap */
  const TRAIL_LEN = 140, TRAIL_MAX = 40;
  let trailIdx = [], trailX = null, trailY = null, trailHead = 0, trailN = 0;
  function resetTrails() {
    const n = eng.N;
    trailIdx = [];
    // always follow the heaviest atom (the colloid, when there is one)
    let heavy = -1, hm = 0;
    for (let i = 0; i < n; i++) { const m = 1 / eng.invm[i]; if (m > hm) { hm = m; heavy = i; } }
    if (heavy >= 0 && hm > 5) trailIdx.push(heavy);
    const want = Math.min(TRAIL_MAX, n);
    const stride = Math.max(1, Math.floor(n / want));
    for (let i = 0; i < n && trailIdx.length < want; i += stride) if (i !== heavy) trailIdx.push(i);
    trailX = new Float32Array(trailIdx.length * TRAIL_LEN);
    trailY = new Float32Array(trailIdx.length * TRAIL_LEN);
    trailHead = 0; trailN = 0;
  }
  function pushTrail() {
    if (!trailIdx.length) return;
    for (let k = 0; k < trailIdx.length; k++) {
      trailX[k * TRAIL_LEN + trailHead] = eng.x[trailIdx[k]];
      trailY[k * TRAIL_LEN + trailHead] = eng.y[trailIdx[k]];
    }
    trailHead = (trailHead + 1) % TRAIL_LEN;
    if (trailN < TRAIL_LEN) trailN++;
  }

  /* ============================================================== presets */

  function applyPreset(id, keepView) {
    const p = PRESETS.find(q => q.id === id) || PRESETS[0];
    UI.preset = p.id;
    eng.T = p.run.T; eng.thermostat = p.run.thermostat; eng.gamma = p.run.gamma;
    eng.pbc = p.run.pbc; eng.dt = p.run.dt;
    eng.setCross(p.run.cross); eng.setCoulomb(p.run.kC);
    eng.build(p.build);
    if (p.run.ramp) eng.ramp = { from: eng.T, to: p.run.ramp.to, over: p.run.ramp.over, t0: 0 };
    if (!keepView) Object.assign(V, p.view);
    UI.pinned = -1; UI.hover = -1;
    eng.drag = null;
    clearHistory(); resetTrails(); washDirty = true; streamDirty = true;
    $('mdBlowup').hidden = true;
    syncControls();
    $('mdPresetBlurb').textContent = p.blurb;
    render(true);
  }

  /* Rebuild with the current N / density but keep every run-time knob. */
  function rebuild() {
    const p = PRESETS.find(q => q.id === UI.preset) || PRESETS[0];
    const spec = Object.assign({}, p.build, {
      n: +$('mdN').value, rho: +$('mdRho').value,
    });
    eng.build(spec);
    eng.ramp = null;
    clearHistory(); resetTrails(); washDirty = true; streamDirty = true;
    UI.pinned = -1;
    render(true);
  }

  /* ============================================================== charts */

  function fit(cv) {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function niceTicks(lo, hi, want) {
    if (!isFinite(lo) || !isFinite(hi) || hi - lo < 1e-12) { hi = lo + 1; }
    const raw = (hi - lo) / Math.max(1, want);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const stepN = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
    const step = stepN * mag;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 0.001; v += step) out.push(v);
    return out;
  }
  const fmt = (v, d) => {
    if (!isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a !== 0 && (a < 1e-3 || a >= 1e5)) return v.toExponential(1);
    return v.toFixed(d != null ? d : (a < 1 ? 3 : a < 10 ? 2 : 1));
  };

  /* Enough decimals that neighbouring ticks never print the same string —
     a "0, 0, 0, 0" axis is worse than no axis. */
  function autoFmt(ticks) {
    let step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : Math.abs(ticks[0]) || 1;
    if (!isFinite(step) || step === 0) step = 1;
    const dec = clamp(Math.ceil(-Math.log10(step)), 0, 6);
    return v => {
      const a = Math.abs(v);
      if (a >= 1e5 || (a !== 0 && a < 1e-4)) return v.toExponential(1);
      return v.toFixed(dec);
    };
  }

  const PAD = { l: 44, r: 14, t: 10, b: 22 };

  /* One axis, always. Where two quantities of different units belong together
     (U and F below) they get stacked panels sharing x, never a second y scale. */
  function frame(ctx, w, h, xlo, xhi, ylo, yhi, opts) {
    const o = opts || {};
    const p = Object.assign({}, PAD, o.pad);
    const px = x => p.l + (x - xlo) / (xhi - xlo || 1) * (w - p.l - p.r);
    const py = y => (h - p.b) - (y - ylo) / (yhi - ylo || 1) * (h - p.t - p.b);

    ctx.lineWidth = 1;
    ctx.font = '10px "Space Grotesk", system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    const yt = niceTicks(ylo, yhi, o.yTicks || 4);
    const yf = o.yFmt || autoFmt(yt);
    ctx.strokeStyle = C.grid;
    ctx.beginPath();
    yt.forEach(v => { const Y = Math.round(py(v)) + 0.5; ctx.moveTo(p.l, Y); ctx.lineTo(w - p.r, Y); });
    ctx.stroke();
    ctx.fillStyle = C.ink3; ctx.textAlign = 'right';
    yt.forEach(v => ctx.fillText(yf(v), p.l - 6, py(v)));

    if (o.xTicks !== 0) {
      const xt = niceTicks(xlo, xhi, o.xTicks || 4);
      const xf = o.xFmt || autoFmt(xt);
      ctx.fillStyle = C.ink3; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      xt.forEach(v => { if (px(v) > p.l - 2 && px(v) < w - p.r + 2) ctx.fillText(xf(v), px(v), h - p.b + 5); });
      ctx.textBaseline = 'middle';
    }

    ctx.strokeStyle = C.rule2;
    ctx.beginPath();
    ctx.moveTo(p.l + 0.5, p.t); ctx.lineTo(p.l + 0.5, h - p.b + 0.5); ctx.lineTo(w - p.r, h - p.b + 0.5);
    ctx.stroke();
    return { px, py, p };
  }

  /* Direct end labels, nudged apart so two series never collide. Labels wear
     an ink token, not the series colour — the line beside them carries identity. */
  function endLabels(ctx, items, w, h, p) {
    items.sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) {
      if (items[i].y - items[i - 1].y < 11) items[i].y = items[i - 1].y + 11;
    }
    ctx.textAlign = 'left'; ctx.font = '600 10px "Space Grotesk", system-ui, sans-serif';
    items.forEach(it => {
      const y = clamp(it.y, p.t + 5, h - p.b - 5);
      ctx.fillStyle = it.color;
      ctx.fillRect(w - p.r + 4, y - 1.5, 9, 3);
      ctx.fillStyle = C.ink2;
      ctx.fillText(it.text, w - p.r + 17, y);
    });
  }

  /* --- time series ------------------------------------------------------ */
  function drawTimeSeries(cv, spec) {
    const { ctx, w, h } = fit(cv);
    const xr = H.t;
    if (xr.n < 2) return;
    const xlo = xr.at(0), xhi = Math.max(xr.last(), xlo + 1e-6);
    let ylo = Infinity, yhi = -Infinity;
    spec.series.forEach(s => { const r = s.ring.range(); ylo = Math.min(ylo, r[0]); yhi = Math.max(yhi, r[1]); });
    if (spec.ref != null) { ylo = Math.min(ylo, spec.ref); yhi = Math.max(yhi, spec.ref); }
    if (spec.zero) { ylo = Math.min(ylo, 0); yhi = Math.max(yhi, 0); }
    const pad = (yhi - ylo) * 0.12 || Math.abs(yhi) * 0.1 || 0.1;
    ylo -= pad; yhi += pad;

    const multi = spec.series.length > 1;
    const g = frame(ctx, w, h, xlo, xhi, ylo, yhi, multi ? { pad: { r: 74 } } : null);

    if (spec.ref != null) {
      ctx.save();
      ctx.strokeStyle = C.ink3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(g.p.l, g.py(spec.ref)); ctx.lineTo(w - g.p.r, g.py(spec.ref)); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = C.ink3; ctx.textAlign = 'left'; ctx.font = '10px "Space Grotesk", system-ui, sans-serif';
      ctx.fillText(spec.refLabel || 'target', g.p.l + 4, g.py(spec.ref) - 7);
    }

    ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const labels = [];
    spec.series.forEach(s => {
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      for (let k = 0; k < s.ring.n; k++) {
        const X = g.px(xr.at(k)), Y = g.py(s.ring.at(k));
        if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.stroke();
      if (multi) labels.push({ y: g.py(s.ring.last()), text: s.label, color: s.color });
    });
    if (labels.length) endLabels(ctx, labels, w, h, g.p);

    cv._hit = (mx) => {
      if (mx < g.p.l || mx > w - g.p.r) return null;
      const t = xlo + (mx - g.p.l) / (w - g.p.l - g.p.r) * (xhi - xlo);
      let best = 0, bd = Infinity;
      for (let k = 0; k < xr.n; k++) { const d = Math.abs(xr.at(k) - t); if (d < bd) { bd = d; best = k; } }
      return {
        x: g.px(xr.at(best)),
        rows: spec.series.map(s => ({ color: s.color, label: s.label, value: fmt(s.ring.at(best)) })),
        head: 't* = ' + fmt(xr.at(best), 1),
      };
    };
  }

  /* --- speed distribution ---------------------------------------------- */
  let speedBins = new Float64Array(34);
  function drawSpeeds(cv) {
    const { ctx, w, h } = fit(cv);
    // the majority species, so the theory curve has one unambiguous mass
    const count = new Array(SPECIES.length).fill(0);
    for (let i = 0; i < eng.N; i++) count[eng.type[i]]++;
    let ts = 0; for (let k = 1; k < count.length; k++) if (count[k] > count[ts]) ts = k;
    const m = SPECIES[ts].mass;
    const T = Math.max(1e-4, eng.temperature());
    const vmax = 3.6 * Math.sqrt(T / m);
    const nb = speedBins.length;
    speedBins.fill(0);
    let n = 0;
    for (let i = 0; i < eng.N; i++) {
      if (eng.type[i] !== ts) continue;
      const v = Math.hypot(eng.vx[i], eng.vy[i]);
      const b = Math.min(nb - 1, (v / vmax * nb) | 0);
      speedBins[b]++; n++;
    }
    if (!n) return;
    const dv = vmax / nb;
    let ymax = 0;
    for (let b = 0; b < nb; b++) { speedBins[b] /= (n * dv); ymax = Math.max(ymax, speedBins[b]); }
    // 2D Maxwell–Boltzmann: p(v) = (m v / kT) exp(−m v²/2kT)
    const mb = v => (m * v / T) * Math.exp(-m * v * v / (2 * T));
    for (let k = 0; k <= 60; k++) ymax = Math.max(ymax, mb(k / 60 * vmax));
    const g = frame(ctx, w, h, 0, vmax, 0, ymax * 1.1, { yTicks: 3, xTicks: 4 });

    ctx.fillStyle = C.s1;
    const bw = (g.px(dv) - g.px(0));
    for (let b = 0; b < nb; b++) {
      if (speedBins[b] <= 0) continue;
      const x0 = g.px(b * dv), y0 = g.py(speedBins[b]), y1 = g.py(0);
      ctx.fillRect(x0 + 1, y0, Math.max(1, bw - 2), Math.max(1, y1 - y0));   // 2px surface gap
    }
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath();
    for (let k = 0; k <= 120; k++) {
      const v = k / 120 * vmax, X = g.px(v), Y = g.py(mb(v));
      if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.stroke();
    cv._hit = null;
    cv._table = () => {
      const rows = [];
      for (let b = 0; b < nb; b += 2) rows.push([fmt((b + 0.5) * dv, 2), fmt(speedBins[b], 3), fmt(mb((b + 0.5) * dv), 3)]);
      return { head: ['v*', 'measured p(v)', 'Maxwell–Boltzmann'], rows };
    };
  }

  /* --- radial distribution --------------------------------------------- */
  function drawRDF(cv) {
    const { ctx, w, h } = fit(cv);
    const d = eng.getRDF();
    if (!eng.rdf.frames) return;
    let ymax = 1.4;
    for (let b = 0; b < d.g.length; b++) ymax = Math.max(ymax, d.g[b]);
    const g = frame(ctx, w, h, 0, eng.rdf.rmax, 0, ymax * 1.08, { yTicks: 3 });

    ctx.save();
    ctx.strokeStyle = C.ink3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(g.p.l, g.py(1)); ctx.lineTo(w - g.p.r, g.py(1)); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = C.ink3; ctx.textAlign = 'left'; ctx.font = '10px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText('g = 1 (no structure)', g.p.l + 4, g.py(1) - 8);

    ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let b = 0; b < d.g.length; b++) {
      const X = g.px(d.r[b]), Y = g.py(d.g[b]);
      if (b === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.stroke();

    cv._hit = (mx) => {
      if (mx < g.p.l || mx > w - g.p.r) return null;
      const r = (mx - g.p.l) / (w - g.p.l - g.p.r) * eng.rdf.rmax;
      const b = clamp(Math.round(r / d.dr - 0.5), 0, d.g.length - 1);
      return { x: g.px(d.r[b]), head: 'r = ' + fmt(d.r[b], 2) + ' σ',
               rows: [{ color: C.s1, label: 'g(r)', value: fmt(d.g[b], 2) }] };
    };
    cv._table = () => {
      const rows = [];
      for (let b = 0; b < d.g.length; b += 3) rows.push([fmt(d.r[b], 2), fmt(d.g[b], 3)]);
      return { head: ['r / σ', 'g(r)'], rows };
    };
  }

  /* --- mean-square displacement ---------------------------------------- */
  function drawMSD(cv) {
    const { ctx, w, h } = fit(cv);
    if (H.msd.n < 2) return;
    const xlo = H.msdT.at(0), xhi = Math.max(H.msdT.last(), xlo + 1e-6);
    const r = H.msd.range();
    const g = frame(ctx, w, h, xlo, xhi, 0, Math.max(r[1] * 1.15, 1e-6), { yTicks: 3 });
    // Einstein reference: MSD = 4 D t through the latest point
    const D = eng.msd().D;
    if (D > 0) {
      ctx.save();
      ctx.strokeStyle = C.ink3; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(g.px(xlo), g.py(4 * D * (xlo - eng.msdT0)));
      ctx.lineTo(g.px(xhi), g.py(4 * D * (xhi - eng.msdT0)));
      ctx.stroke(); ctx.restore();
      ctx.fillStyle = C.ink3; ctx.textAlign = 'left'; ctx.font = '10px "Space Grotesk", system-ui, sans-serif';
      ctx.fillText('4Dt', g.p.l + 4, g.p.t + 8);
    }
    ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let k = 0; k < H.msd.n; k++) {
      const X = g.px(H.msdT.at(k)), Y = g.py(H.msd.at(k));
      if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.stroke();
    cv._hit = null;
  }

  /* --- pair potential inspector ---------------------------------------- */
  /* U(r) and F(r) have different units, so they get two stacked panels on a
     shared r axis — small multiples, never a second y axis on one plot. */
  function drawPair(cv) {
    const { ctx, w, h } = fit(cv);
    const ta = +$('mdPairA').value, tb = +$('mdPairB').value;
    const rmin = 0.85, rmax = eng.rc * ((SPECIES[ta].sig + SPECIES[tb].sig) / 2) + 0.4;
    const c = eng.curve(ta, tb, 260, rmin, rmax);
    const half = (h - 8) / 2;

    const drawPanel = (top, arr, label, yZero) => {
      let lo = Infinity, hi = -Infinity;
      for (let k = 0; k < arr.length; k++) { lo = Math.min(lo, arr[k]); hi = Math.max(hi, arr[k]); }
      hi = Math.min(hi, Math.abs(lo) * 2.6 + 0.4);
      if (yZero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
      const pad = (hi - lo) * 0.12;
      ctx.save(); ctx.translate(0, top);
      const g = frame(ctx, w, half, rmin, rmax, lo - pad, hi + pad,
        { yTicks: 3, xTicks: top ? 4 : 0, pad: { l: 44, r: 66, t: 8, b: top ? 22 : 8 } });
      // zero line
      ctx.save(); ctx.strokeStyle = C.rule2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(g.p.l, g.py(0)); ctx.lineTo(w - g.p.r, g.py(0)); ctx.stroke(); ctx.restore();
      // r_min and r_cut guides
      [[c.rmin, 'r₀'], [c.rcut, 'r_cut']].forEach(([r, tag]) => {
        if (r > rmax) return;
        ctx.save(); ctx.strokeStyle = C.rule2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(g.px(r), g.p.t); ctx.lineTo(g.px(r), half - g.p.b); ctx.stroke(); ctx.restore();
        if (!top) {
          ctx.fillStyle = C.ink3; ctx.textAlign = 'center'; ctx.font = '9px "Space Grotesk", system-ui, sans-serif';
          ctx.fillText(tag, g.px(r), g.p.t + 4);
        }
      });
      ctx.strokeStyle = C.s1; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let k = 0; k < arr.length; k++) {
        const X = g.px(c.r[k]), Y = g.py(clamp(arr[k], lo - pad, hi + pad));
        if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.stroke();
      ctx.fillStyle = C.ink2; ctx.textAlign = 'left';
      ctx.font = '600 10px "Space Grotesk", system-ui, sans-serif';
      ctx.fillText(label, w - g.p.r + 6, g.p.t + 6);
      // marker at the hovered atom's nearest-neighbour distance
      if (pairMarker > rmin && pairMarker < rmax) {
        const k = clamp(Math.round((pairMarker - rmin) / (rmax - rmin) * (arr.length - 1)), 0, arr.length - 1);
        ctx.fillStyle = C.s2;
        ctx.beginPath(); ctx.arc(g.px(pairMarker), g.py(clamp(arr[k], lo - pad, hi + pad)), 4, 0, 7); ctx.fill();
        ctx.strokeStyle = C.surface; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.restore();
    };
    drawPanel(0, c.U, 'U(r) / ε', true);
    drawPanel(half + 8, c.F, 'F(r) / (ε/σ)', true);
  }

  /* ================================================== the simulation view */

  let stage, sctx, SW = 0, sc = 1;
  let washCv = null, washCtx = null, washRes = 0, washDirty = true, washAge = 0;
  let streamPaths = [], streamDirty = true, streamAge = 0;
  let fieldArrows = null, fieldRes = 0, fieldAge = 0;
  let quality = 1;                 // dialled down automatically if frames get long
  let pairMarker = -1;

  const P3 = [0, 0, 0];

  /* Two barbs at (x1,y1), swept back along the screen-space unit vector (sx,sy). */
  const HA_C = Math.cos(0.5), HA_S = Math.sin(0.5);
  function arrowHead(path, x1, y1, sx, sy, hl) {
    const bx = -sx, by = -sy;
    path.moveTo(x1, y1); path.lineTo(x1 + hl * (bx * HA_C - by * HA_S), y1 + hl * (bx * HA_S + by * HA_C));
    path.moveTo(x1, y1); path.lineTo(x1 + hl * (bx * HA_C + by * HA_S), y1 + hl * (by * HA_C - bx * HA_S));
  }

  /* The box is square, so the canvas is square: CSS width and height are both
     pinned, rather than letting a 100%-wide canvas stretch the drawing. */
  function fitStage() {
    const box = stage.parentElement.getBoundingClientRect();
    const size = Math.round(Math.max(240, Math.min(box.width, 780)));
    stage.style.width = size + 'px';
    stage.style.height = size + 'px';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (stage.width !== Math.round(size * dpr)) {
      stage.width = Math.round(size * dpr); stage.height = Math.round(size * dpr);
    }
    SW = size;
    sctx = stage.getContext('2d');
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sc = SW / eng.L;
    washDirty = true; streamDirty = true;
  }
  const PX = x => x * sc;
  const PY = y => SW - y * sc;

  /* --- layer 1: the energy a probe atom would feel --------------------- */
  function drawWash() {
    const res = [40, 56, 72][quality] || 56;
    if (!washCv || washRes !== res) {
      washCv = document.createElement('canvas');
      washCv.width = washCv.height = res; washRes = res;
      washCtx = washCv.getContext('2d');
      washDirty = true;
    }
    if (washDirty || washAge <= 0) {
      const img = washCtx.createImageData(res, res);
      const energy = V.wash === 'energy';
      const d = img.data, L = eng.L, LUT = energy ? C.washLUT : C.washSeqLUT;
      /* Both quantities span several decades between the attractive tail and
         the repulsive core, so both are log-compressed — signed about zero for
         the diverging energy, from zero up for the sequential magnitude. */
      const U0 = 0.2, UM = 12, dU = Math.log1p(UM / U0);
      const F0 = 0.1, FM = 60, dF = Math.log1p(FM / F0);
      for (let gy = 0; gy < res; gy++) {
        const py = (gy + 0.5) / res * L;
        for (let gx = 0; gx < res; gx++) {
          const px = (gx + 0.5) / res * L;
          eng.probe(px, py, P3);
          let t;
          if (energy) {
            const u = P3[2];
            t = clamp(0.5 + 0.5 * Math.sign(u) * Math.log1p(Math.abs(u) / U0) / dU, 0, 1);
          } else {
            t = clamp(Math.log1p(Math.hypot(P3[0], P3[1]) / F0) / dF, 0, 1);
          }
          const c = Math.min(255, (t * 255) | 0) * 3;
          // canvas y grows downward; the box has y up
          const o = (((res - 1 - gy) * res) + gx) * 4;
          d[o] = LUT[c]; d[o + 1] = LUT[c + 1]; d[o + 2] = LUT[c + 2]; d[o + 3] = 255;
        }
      }
      washCtx.putImageData(img, 0, 0);
      washDirty = false; washAge = 5;
    }
    washAge--;
    sctx.save();
    sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';
    sctx.globalAlpha = 0.9;
    sctx.drawImage(washCv, 0, 0, SW, SW);
    sctx.restore();
  }

  /* --- layer 2: the force field itself --------------------------------- */
  function drawArrows() {
    const n = [16, 22, 28][quality] || 22;
    if (!fieldArrows || fieldRes !== n) { fieldArrows = new Float32Array(n * n * 3); fieldRes = n; }
    if (fieldAge <= 0) {
      const L = eng.L;
      let k = 0;
      for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
        eng.probe((gx + 0.5) / n * L, (gy + 0.5) / n * L, P3);
        fieldArrows[k++] = P3[0]; fieldArrows[k++] = P3[1];
        fieldArrows[k++] = Math.hypot(P3[0], P3[1]);
      }
      fieldAge = 2;
    }
    fieldAge--;

    const L = eng.L, cell = SW / n, maxLen = cell * 0.44;
    const overWash = V.wash !== 'none';
    // magnitude → length and colour, log-compressed: the core is 10^6 times
    // the tail, and a linear scale would show nothing but the cores
    const F0 = 0.05, FM = 40;
    const denom = Math.log1p(FM / F0);
    sctx.save();
    sctx.lineCap = 'round';
    const buckets = 10;
    const paths = []; for (let b = 0; b < buckets; b++) paths.push(new Path2D());
    let k = 0;
    for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
      const fx = fieldArrows[k], fy = fieldArrows[k + 1], f = fieldArrows[k + 2]; k += 3;
      if (f < 1e-4) continue;
      const s = clamp(Math.log1p(f / F0) / denom, 0, 1);
      const len = 4 + maxLen * s;
      const sx = fx / f, sy = -fy / f;                  // screen y grows downward
      const cx = PX((gx + 0.5) / n * L), cy = PY((gy + 0.5) / n * L);
      const x0 = cx - sx * len * 0.5, y0 = cy - sy * len * 0.5;
      const x1 = cx + sx * len * 0.5, y1 = cy + sy * len * 0.5;
      const b = Math.min(buckets - 1, (s * buckets) | 0);
      paths[b].moveTo(x0, y0); paths[b].lineTo(x1, y1);
      arrowHead(paths[b], x1, y1, sx, sy, Math.min(5, len * 0.42));
    }
    for (let b = 0; b < buckets; b++) {
      const t = b / (buckets - 1);
      sctx.strokeStyle = overWash ? withAlpha(C.ink, 0.25 + 0.5 * t) : C.seqHex[Math.round(t * 11)];
      sctx.lineWidth = 1 + t * 0.9;
      sctx.stroke(paths[b]);
    }
    sctx.restore();
  }

  /* Field lines: gradient-flow curves of −∇U, so they run downhill into the
     atoms. Recomputed on a slow cadence — the picture barely changes per frame. */
  function drawStreamlines() {
    if (streamDirty || streamAge <= 0) {
      const seeds = [70, 100, 130][quality] || 100;
      const L = eng.L, side = Math.ceil(Math.sqrt(seeds));
      const stepLen = L / 90, steps = 15;
      streamPaths = [];
      for (let gy = 0; gy < side; gy++) for (let gx = 0; gx < side; gx++) {
        let px = (gx + 0.5) / side * L, py = (gy + 0.5) / side * L;
        const pts = [[px, py]];
        for (let s = 0; s < steps; s++) {
          eng.probe(px, py, P3);
          let f = Math.hypot(P3[0], P3[1]);
          if (f < 1e-3) break;
          const mx = px + P3[0] / f * stepLen * 0.5, my = py + P3[1] / f * stepLen * 0.5;
          eng.probe(mx, my, P3);
          f = Math.hypot(P3[0], P3[1]);
          if (f < 1e-3) break;
          px += P3[0] / f * stepLen; py += P3[1] / f * stepLen;
          pts.push([px, py]);
          if (f > 60) break;                       // arrived at an atom
        }
        if (pts.length > 3) streamPaths.push(pts);
      }
      streamDirty = false; streamAge = 4;
    }
    streamAge--;
    sctx.save();
    sctx.lineCap = 'round'; sctx.lineJoin = 'round';
    sctx.strokeStyle = V.wash !== 'none' ? withAlpha(C.ink, 0.4) : C.seqHex[8];
    sctx.lineWidth = 1.4;
    const hL = eng.L * 0.5;
    for (const pts of streamPaths) {
      sctx.beginPath();
      let prev = null;
      for (const [x, y] of pts) {
        if (prev && (Math.abs(x - prev[0]) > hL || Math.abs(y - prev[1]) > hL)) { sctx.moveTo(PX(x), PY(y)); }
        else if (!prev) sctx.moveTo(PX(x), PY(y));
        else sctx.lineTo(PX(x), PY(y));
        prev = [x, y];
      }
      sctx.stroke();
      const [ex, ey] = pts[pts.length - 1];
      sctx.beginPath(); sctx.arc(PX(ex), PY(ey), 1.6, 0, 7); sctx.fill();
    }
    sctx.restore();
  }

  /* --- layer 3: pair interactions -------------------------------------- */
  function drawLinks() {
    const { n, buf } = eng.pairs(1.55);
    const B = 9, paths = []; for (let b = 0; b < B; b++) paths.push(new Path2D());
    const hL = eng.L * 0.5;
    for (let k = 0; k < n; k++) {
      const o = k * 6, i = buf[o], j = buf[o + 1], dx = buf[o + 2], dy = buf[o + 3], f = buf[o + 5];
      // −1 fully attractive … +1 fully repulsive, log-compressed
      const s = clamp(Math.sign(f) * Math.log1p(Math.abs(f) / 0.4) / Math.log1p(30 / 0.4), -1, 1);
      const b = clamp(Math.round((s + 1) / 2 * (B - 1)), 0, B - 1);
      const p = paths[b];
      const xi = eng.x[i], yi = eng.y[i], xj = eng.x[j], yj = eng.y[j];
      if (Math.abs(xi - xj) > hL || Math.abs(yi - yj) > hL) {
        // wrapped pair: draw both halves so it reads as leaving one edge
        p.moveTo(PX(xi), PY(yi)); p.lineTo(PX(xi - dx), PY(yi - dy));
        p.moveTo(PX(xj), PY(yj)); p.lineTo(PX(xj + dx), PY(yj + dy));
      } else {
        p.moveTo(PX(xi), PY(yi)); p.lineTo(PX(xj), PY(yj));
      }
    }
    sctx.save();
    sctx.lineCap = 'round';
    for (let b = 0; b < B; b++) {
      const t = b / (B - 1);
      const strength = Math.abs(t - 0.5) * 2;
      sctx.strokeStyle = withAlpha(C.divHex[Math.round(t * 11)], 0.22 + 0.55 * strength);
      sctx.lineWidth = 1 + 1.8 * strength;
      sctx.stroke(paths[b]);
    }
    sctx.restore();
  }

  /* --- layer 4: the atoms ---------------------------------------------- */
  function atomTint(i) {
    switch (V.color) {
      case 'speed': {
        const v = Math.hypot(eng.vx[i], eng.vy[i]);
        const vr = 2.6 * Math.sqrt(Math.max(1e-4, eng.T) * eng.invm[i]);
        return C.seqAtom[clamp(Math.round(v / vr * 11), 0, 11)];
      }
      case 'ke': {
        const ke = 0.5 * (eng.vx[i] * eng.vx[i] + eng.vy[i] * eng.vy[i]) / eng.invm[i];
        return C.seqAtom[clamp(Math.round(ke / (3.2 * Math.max(1e-4, eng.T)) * 11), 0, 11)];
      }
      case 'force': {
        const s = Math.log1p(eng.fmag[i] / 0.4) / Math.log1p(60 / 0.4);
        return C.seqAtom[clamp(Math.round(s * 11), 0, 11)];
      }
      case 'pe': {
        const t = clamp(0.5 + eng.pei[i] / 8, 0, 1);
        return C.divHex[clamp(Math.round(t * 11), 0, 11)];
      }
      default: return C.speciesFill[eng.type[i]] || C.s1;
    }
  }

  function drawAtoms() {
    const L = eng.L, groups = new Map();
    const ghosts = V.ghosts && eng.pbc;
    for (let i = 0; i < eng.N; i++) {
      const col = atomTint(i);
      let p = groups.get(col);
      if (!p) { p = new Path2D(); groups.set(col, p); }
      const r = 0.42 * SPECIES[eng.type[i]].sig * sc;
      const x = eng.x[i], y = eng.y[i];
      p.moveTo(PX(x) + r, PY(y)); p.arc(PX(x), PY(y), r, 0, 7);
      if (ghosts) {
        const ox = x < r / sc ? L : (x > L - r / sc ? -L : 0);
        const oy = y < r / sc ? L : (y > L - r / sc ? -L : 0);
        if (ox) { p.moveTo(PX(x + ox) + r, PY(y)); p.arc(PX(x + ox), PY(y), r, 0, 7); }
        if (oy) { p.moveTo(PX(x) + r, PY(y + oy)); p.arc(PX(x), PY(y + oy), r, 0, 7); }
        if (ox && oy) { p.moveTo(PX(x + ox) + r, PY(y + oy)); p.arc(PX(x + ox), PY(y + oy), r, 0, 7); }
      }
    }
    const ring = 0.42 * sc > 4.5;
    sctx.save();
    groups.forEach((p, col) => {
      if (ring) { sctx.strokeStyle = C.stage; sctx.lineWidth = 2; sctx.stroke(p); }
      sctx.fillStyle = col; sctx.fill(p);
    });
    sctx.restore();
  }

  function drawBonds() {
    if (!eng.nbond) return;
    const hL = eng.L * 0.5;
    const p = new Path2D();
    for (let b = 0; b < eng.nbond; b++) {
      const i = eng.bi[b], j = eng.bj[b];
      let dx = eng.x[i] - eng.x[j], dy = eng.y[i] - eng.y[j];
      if (eng.pbc) {
        if (dx > hL) dx -= eng.L; else if (dx < -hL) dx += eng.L;
        if (dy > hL) dy -= eng.L; else if (dy < -hL) dy += eng.L;
      }
      p.moveTo(PX(eng.x[i]), PY(eng.y[i])); p.lineTo(PX(eng.x[i] - dx), PY(eng.y[i] - dy));
      p.moveTo(PX(eng.x[j]), PY(eng.y[j])); p.lineTo(PX(eng.x[j] + dx), PY(eng.y[j] + dy));
    }
    sctx.save();
    sctx.strokeStyle = withAlpha(C.ink2, 0.85);
    sctx.lineWidth = Math.max(2, 0.14 * sc); sctx.lineCap = 'round';
    sctx.stroke(p);
    sctx.restore();
  }

  function drawVectors(which) {
    const p = new Path2D();
    const isF = which === 'f';
    const k = isF ? Math.min(0.9, 4 / meanForce()) : 0.5 / Math.sqrt(Math.max(0.05, eng.T));
    for (let i = 0; i < eng.N; i++) {
      const ax = isF ? eng.fx[i] : eng.vx[i], ay = isF ? eng.fy[i] : eng.vy[i];
      const m = Math.hypot(ax, ay);
      if (m < 1e-6) continue;
      const len = clamp(m * k, 0, 2.2) * sc;
      if (len < 2) continue;
      const sx = ax / m, sy = -ay / m;
      const x0 = PX(eng.x[i]), y0 = PY(eng.y[i]);
      const x1 = x0 + sx * len, y1 = y0 + sy * len;
      p.moveTo(x0, y0); p.lineTo(x1, y1);
      arrowHead(p, x1, y1, sx, sy, Math.min(5, len * 0.35));
    }
    sctx.save();
    sctx.strokeStyle = isF ? withAlpha(C.s2, 0.9) : withAlpha(C.s3, 0.9);
    sctx.lineWidth = 1.4; sctx.lineCap = 'round';
    sctx.stroke(p);
    sctx.restore();
  }
  let _mfCache = { s: -1, v: 1 };
  function meanForce() {
    if (_mfCache.s === eng.steps) return _mfCache.v;
    let s = 0;
    for (let i = 0; i < eng.N; i++) s += eng.fmag[i];
    _mfCache = { s: eng.steps, v: Math.max(0.5, s / Math.max(1, eng.N)) };
    return _mfCache.v;
  }

  function drawTrails() {
    if (!trailIdx.length || trailN < 2) return;
    const hL = eng.L * 0.5;
    sctx.save();
    sctx.lineWidth = 1.4; sctx.lineCap = 'round';
    for (let k = 0; k < trailIdx.length; k++) {
      const heavy = 1 / eng.invm[trailIdx[k]] > 5;
      sctx.strokeStyle = withAlpha(heavy ? C.s3 : C.ink3, heavy ? 0.9 : 0.35);
      sctx.lineWidth = heavy ? 2 : 1.2;
      sctx.beginPath();
      let started = false, px = 0, py = 0;
      for (let s = 0; s < trailN; s++) {
        const idx = (trailHead - trailN + s + TRAIL_LEN * 2) % TRAIL_LEN;
        const x = trailX[k * TRAIL_LEN + idx], y = trailY[k * TRAIL_LEN + idx];
        if (!started || Math.abs(x - px) > hL || Math.abs(y - py) > hL) sctx.moveTo(PX(x), PY(y));
        else sctx.lineTo(PX(x), PY(y));
        px = x; py = y; started = true;
      }
      sctx.stroke();
    }
    sctx.restore();
  }

  /* highlight for the atom under the pointer: its partners and its net force */
  function drawFocus() {
    const i = UI.pinned >= 0 ? UI.pinned : UI.hover;
    if (i < 0 || i >= eng.N) { pairMarker = -1; return; }
    const hL = eng.L * 0.5;
    let nearest = Infinity;
    sctx.save();
    sctx.strokeStyle = withAlpha(C.accent, 0.75); sctx.lineWidth = 1.6;
    sctx.beginPath();
    for (let j = 0; j < eng.N; j++) {
      if (j === i) continue;
      let dx = eng.x[j] - eng.x[i], dy = eng.y[j] - eng.y[i];
      if (eng.pbc) {
        if (dx > hL) dx -= eng.L; else if (dx < -hL) dx += eng.L;
        if (dy > hL) dy -= eng.L; else if (dy < -hL) dy += eng.L;
      }
      const r = Math.hypot(dx, dy);
      if (r > 1.9) continue;
      nearest = Math.min(nearest, r);
      sctx.moveTo(PX(eng.x[i]), PY(eng.y[i]));
      sctx.lineTo(PX(eng.x[i] + dx), PY(eng.y[i] + dy));
    }
    sctx.stroke();
    const r = 0.42 * SPECIES[eng.type[i]].sig * sc;
    sctx.beginPath(); sctx.arc(PX(eng.x[i]), PY(eng.y[i]), r + 4, 0, 7);
    sctx.strokeStyle = C.accent; sctx.lineWidth = 2; sctx.stroke();
    sctx.restore();
    pairMarker = isFinite(nearest) ? nearest : -1;
  }

  /* --------------------------------------------------------- compose all */
  function drawStage() {
    sc = SW / eng.L;
    sctx.fillStyle = C.stage;
    sctx.fillRect(0, 0, SW, SW);
    if (V.wash !== 'none') drawWash();
    if (V.field === 'arrows') drawArrows();
    else if (V.field === 'lines') drawStreamlines();
    if (V.trails) drawTrails();
    if (V.links) drawLinks();
    drawBonds();
    drawAtoms();
    if (V.forces) drawVectors('f');
    if (V.vel) drawVectors('v');
    drawFocus();
    // the cell frame, so the periodic box reads as a box
    sctx.strokeStyle = C.rule2; sctx.lineWidth = 1;
    sctx.strokeRect(0.5, 0.5, SW - 1, SW - 1);
  }

  /* ============================================================== read-outs */

  function setTile(id, value, sub) {
    const v = $(id); if (v) v.textContent = value;
    const s = $(id + 'Sub'); if (s) s.textContent = sub;
  }

  function updateStats() {
    const s = eng.state();
    const m = eng.msd();
    setTile('mdStatT', fmt(s.T, 3), (s.T * ARGON.epsK).toFixed(0) + ' K for argon');
    setTile('mdStatP', fmt(s.P, 3), eng.pbc ? 'virial, ε/σ²' : 'wall impulse, ε/σ²');
    setTile('mdStatE', fmt(s.totPer, 3), 'kinetic ' + fmt(s.kePer, 2) + ' · potential ' + fmt(s.pePer, 2));
    setTile('mdStatD', fmt(m.D, 3), (m.D * ARGON.diffCm2).toExponential(1) + ' cm²/s');
    setTile('mdStatRho', fmt(s.rho, 3), s.N + ' atoms in ' + fmt(s.L, 1) + 'σ box');
    setTile('mdStatTime', fmt(s.time, 1), (s.time * ARGON.tauPs).toFixed(0) + ' ps of argon');
    const phase = $('mdPhase');
    if (phase) {
      const g = eng.getRDF();
      let label = '—';
      if (eng.rdf.frames > 4) {
        // a crude but honest classifier: structure in g(r) plus mobility
        let peaks = 0;
        for (let b = 2; b < g.g.length - 2; b++) {
          if (g.r[b] > 1.6 && g.g[b] > 1.35 && g.g[b] > g.g[b - 2] && g.g[b] > g.g[b + 2]) peaks++;
        }
        const D = m.D;
        label = (D < 0.01 && peaks >= 1) ? 'crystalline' : (s.rho < 0.25 && s.pePer > -0.6) ? 'gas-like' : 'liquid-like';
      }
      phase.textContent = label;
    }
    const rampEl = $('mdRampNote');
    if (rampEl) rampEl.hidden = !eng.ramp;
  }

  /* ---------------------------------------------------------- the tooltip */
  function updateTip(cx, cy) {
    const tip = $('mdTip');
    const i = UI.pinned >= 0 ? UI.pinned : UI.hover;
    if (i < 0 || i >= eng.N) { tip.hidden = true; return; }
    const v = Math.hypot(eng.vx[i], eng.vy[i]);
    const ke = 0.5 * v * v / eng.invm[i];
    tip.hidden = false;
    tip.innerHTML =
      '<b>' + SPECIES[eng.type[i]].label + '</b> #' + i +
      '<span><i>|v|</i>' + fmt(v, 2) + ' σ/τ · ' + (v * ARGON.velMS).toFixed(0) + ' m/s</span>' +
      '<span><i>KE</i>' + fmt(ke, 3) + ' ε</span>' +
      '<span><i>PE</i>' + fmt(eng.pei[i], 3) + ' ε</span>' +
      '<span><i>|F|</i>' + fmt(eng.fmag[i], 2) + ' ε/σ · ' + fmt(eng.fmag[i] * ARGON.forcePN, 1) + ' pN</span>' +
      '<span><i>neighbours</i>' + eng.nbr[i] + ' inside r_cut</span>';
    // cx/cy are canvas-relative; the tip is positioned against the box around it
    const sr = stage.getBoundingClientRect(), br = stage.parentElement.getBoundingClientRect();
    const tw = tip.offsetWidth || 190, th = tip.offsetHeight || 90;
    tip.style.left = clamp(cx + (sr.left - br.left) + 14, 4, br.width - tw - 4) + 'px';
    tip.style.top = clamp(cy + (sr.top - br.top) - th - 10, 4, br.height - th - 4) + 'px';
  }

  /* ============================================================== the loop */

  let frameMs = 16, lastT = 0, rdfCountdown = 0, stableCountdown = 0;

  function tick(now) {
    const dtms = now - lastT; lastT = now;
    frameMs = frameMs * 0.9 + Math.min(120, dtms) * 0.1;
    quality = frameMs > 34 ? 0 : frameMs > 22 ? 1 : 2;

    if (UI.running) {
      /* Substeps are capped by wall-clock as well as by count: a big or highly
         charged system should slow down, never freeze the page. */
      const deadline = now + 11;
      for (let s = 0; s < UI.rate; s++) {
        if (UI.brushing) eng.brush(brushX, brushY, 2.6, UI.brushing > 0 ? 1.06 : 0.94);
        eng.step();
        if (s > 0 && performance.now() > deadline) break;
      }
      if (!eng.pbc) eng.updateWallPressure();
      /* A large timestep with the thermostat off can diverge. Catch it, say so,
         and put the system back rather than filling every read-out with NaN. */
      if (++stableCountdown >= 30) {
        stableCountdown = 0;
        if (!eng.checkStable()) {
          $('mdBlowup').hidden = false;
          rebuild();
          return requestAnimationFrame(tick);
        }
      }
      washDirty = true; streamDirty = true;
      pushTrail();
      if (--rdfCountdown <= 0) { eng.sampleRDF(); rdfCountdown = 4; }
      const st = eng.state();
      H.t.push(st.time); H.T.push(st.T); H.ke.push(st.kePer);
      H.pe.push(st.pePer); H.tot.push(st.totPer); H.P.push(st.P);
      const m = eng.msd();
      H.msdT.push(st.time); H.msd.push(m.msd);
    }
    render(false);
    requestAnimationFrame(tick);
  }

  let chartCountdown = 0;
  function render(force) {
    drawStage();
    if (force || --chartCountdown <= 0) {
      chartCountdown = 3;
      updateStats();
      drawTimeSeries($('mdChartT'), {
        series: [{ ring: H.T, color: C.s1, label: 'T*' }],
        ref: eng.T, refLabel: 'target T* = ' + fmt(eng.T, 2),
      });
      drawTimeSeries($('mdChartE'), {
        series: [
          { ring: H.ke, color: C.s1, label: 'kinetic' },
          { ring: H.pe, color: C.s2, label: 'potential' },
          { ring: H.tot, color: C.s3, label: 'total' },
        ],
      });
      drawSpeeds($('mdChartV'));
      drawRDF($('mdChartG'));
      drawMSD($('mdChartM'));
      drawPair($('mdChartPair'));
      if (UI.showTable) renderTables();
    }
    if (crossX >= 0) drawCrosshair();
  }

  /* ------------------------------------------------ chart hover crosshair */
  let crossX = -1, crossCv = null;
  function drawCrosshair() {
    if (!crossCv || !crossCv._hit) return;
    const hit = crossCv._hit(crossX);
    const tip = $('mdChartTip');
    if (!hit) { tip.hidden = true; return; }
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const ctx = crossCv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.strokeStyle = withAlpha(C.ink, 0.35); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hit.x, 0); ctx.lineTo(hit.x, crossCv.height / dpr); ctx.stroke();
    ctx.restore();
    const r = crossCv.getBoundingClientRect();
    const host = MOUNT.getBoundingClientRect();
    tip.hidden = false;
    tip.innerHTML = '<b>' + hit.head + '</b>' + hit.rows.map(row =>
      '<span><i style="background:' + row.color + '"></i>' + row.label + '<em>' + row.value + '</em></span>').join('');
    tip.style.left = clamp(r.left - host.left + hit.x + 12, 0, host.width - 170) + 'px';
    tip.style.top = (r.top - host.top + 8) + 'px';
  }

  /* ================================================================ tables */

  function renderTables() {
    const wrap = $('mdTableWrap');
    const s = eng.state(), m = eng.msd();
    const rows = [
      ['Temperature', fmt(s.T, 4), 'ε/k_B', (s.T * ARGON.epsK).toFixed(1) + ' K'],
      ['Target temperature', fmt(eng.T, 4), 'ε/k_B', (eng.T * ARGON.epsK).toFixed(1) + ' K'],
      ['Kinetic energy / atom', fmt(s.kePer, 4), 'ε', (s.kePer * ARGON.epsK * 1.380649e-23 * 6.02214e20).toFixed(3) + ' kJ/mol'],
      ['Potential energy / atom', fmt(s.pePer, 4), 'ε', (s.pePer * ARGON.epsK * 1.380649e-23 * 6.02214e20).toFixed(3) + ' kJ/mol'],
      ['Total energy / atom', fmt(s.totPer, 4), 'ε', '—'],
      [eng.pbc ? 'Pressure (virial)' : 'Pressure (wall impulse)', fmt(s.P, 4), 'ε/σ²', (s.P * ARGON.tension).toFixed(3) + ' mN/m'],
      ['Number density', fmt(s.rho, 4), '1/σ²', '—'],
      ['Atoms', String(s.N), '', '—'],
      ['Box side', fmt(s.L, 3), 'σ', (s.L * ARGON.sigA).toFixed(1) + ' Å'],
      ['Elapsed time', fmt(s.time, 3), 'τ', (s.time * ARGON.tauPs).toFixed(2) + ' ps'],
      ['Mean-square displacement', fmt(m.msd, 4), 'σ²', '—'],
      ['Diffusion coefficient', fmt(m.D, 5), 'σ²/τ', (m.D * ARGON.diffCm2).toExponential(2) + ' cm²/s'],
    ];
    let html = '<div class="md-tscroll"><table class="md-table"><caption>Current state</caption><thead><tr>' +
      '<th scope="col">Quantity</th><th scope="col" class="num">Reduced</th><th scope="col">Unit</th>' +
      '<th scope="col" class="num">Argon equivalent</th></tr></thead><tbody>' +
      rows.map(r => '<tr><th scope="row">' + r[0] + '</th><td class="num">' + r[1] + '</td><td>' + r[2] + '</td><td class="num">' + r[3] + '</td></tr>').join('') +
      '</tbody></table></div>';

    [['mdChartG', 'Radial distribution function'], ['mdChartV', 'Speed distribution']].forEach(([id, cap]) => {
      const cv = $(id);
      if (!cv || !cv._table) return;
      const t = cv._table();
      html += '<div class="md-tscroll"><table class="md-table"><caption>' + cap + '</caption><thead><tr>' +
        t.head.map(hh => '<th scope="col" class="num">' + hh + '</th>').join('') + '</tr></thead><tbody>' +
        t.rows.map(r => '<tr>' + r.map(c => '<td class="num">' + c + '</td>').join('') + '</tr>').join('') +
        '</tbody></table></div>';
    });
    wrap.innerHTML = html;
  }

  function exportCsv() {
    const lines = ['# Atomic interaction lab — ' + UI.preset + ' — reduced Lennard-Jones units'];
    lines.push('# sigma=' + ARGON.sigA + ' A, eps/kB=' + ARGON.epsK + ' K, tau=' + ARGON.tauPs + ' ps (argon mapping)');
    lines.push('t,T,ke_per_atom,pe_per_atom,e_per_atom,pressure,msd');
    for (let k = 0; k < H.t.n; k++) {
      lines.push([H.t.at(k), H.T.at(k), H.ke.at(k), H.pe.at(k), H.tot.at(k), H.P.at(k), H.msd.at(k)]
        .map(v => v.toPrecision(7)).join(','));
    }
    lines.push('', 'r,g_of_r');
    const g = eng.getRDF();
    for (let b = 0; b < g.g.length; b++) lines.push(g.r[b].toPrecision(5) + ',' + g.g[b].toPrecision(6));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'md-lab-' + UI.preset + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  /* ============================================================== controls */

  function syncControls() {
    $('mdPreset').value = UI.preset;
    $('mdT').value = eng.T; $('mdTval').textContent = fmt(eng.T, 2) + ' ε/k_B  ·  ' + (eng.T * ARGON.epsK).toFixed(0) + ' K';
    $('mdRho').value = eng.rho.toFixed(2); $('mdRhoval').textContent = fmt(eng.rho, 2) + ' σ⁻²';
    $('mdN').value = eng.N; $('mdNval').textContent = eng.N + ' atoms';
    $('mdDt').value = eng.dt; $('mdDtval').textContent = fmt(eng.dt, 3) + ' τ  ·  ' + (eng.dt * ARGON.tauPs * 1000).toFixed(1) + ' fs';
    $('mdGamma').value = eng.gamma; $('mdGammaval').textContent = fmt(eng.gamma, 2) + ' τ⁻¹';
    $('mdCross').value = eng.cross; $('mdCrossval').textContent = '×' + fmt(eng.cross, 2);
    $('mdCoulomb').value = eng.kCoulomb; $('mdCoulval').textContent = eng.kCoulomb ? fmt(eng.kCoulomb, 0) + ' εσ/q²' : 'off';
    $('mdThermo').value = eng.thermostat;
    $('mdBoundary').value = eng.pbc ? 'pbc' : 'wall';
    $('mdColor').value = V.color; $('mdField').value = V.field; $('mdWash').value = V.wash;
    ['links', 'forces', 'vel', 'trails', 'ghosts'].forEach(k => { const el = $('md' + k[0].toUpperCase() + k.slice(1)); if (el) el.checked = V[k]; });
    $('mdGammaRow').hidden = eng.thermostat !== 'langevin';
    $('mdPlay').setAttribute('aria-pressed', String(UI.running));
    $('mdPlay').innerHTML = UI.running ? '❙❙ Pause' : '▶ Run';
    updateScaleLegend();
  }

  function updateScaleLegend() {
    const el = $('mdScale');
    const parts = [];
    if (V.field !== 'none') {
      parts.push(legendSwatch('Force on a probe atom, |F|', C.seqHex, ['weak', 'strong']));
    }
    if (V.wash === 'energy') parts.push(legendSwatch('Potential a probe atom would feel, U', C.washHex, ['attractive −', 'repulsive +']));
    else if (V.wash === 'force') parts.push(legendSwatch('Field magnitude, |F|', C.washSeqHex, ['weak', 'strong']));
    if (V.links) parts.push(legendSwatch('Pair interaction', C.divHex, ['pulling together', 'pushing apart']));
    if (['speed', 'ke', 'force'].includes(V.color)) {
      parts.push(legendSwatch('Atom ' + ({ speed: 'speed', ke: 'kinetic energy', force: 'net force' })[V.color],
        C.seqAtom, ['low', 'high']));
    }
    if (V.color === 'pe') parts.push(legendSwatch('Atom potential energy', C.divHex, ['bound −', 'strained +']));
    if (V.color === 'species') {
      const seen = new Set();
      for (let i = 0; i < eng.N; i++) seen.add(eng.type[i]);
      parts.push('<span class="md-lg">' + [...seen].sort().map(t =>
        '<span class="md-key"><i style="background:' + C.speciesFill[t] + '"></i>' + SPECIES[t].label + '</span>').join('') + '</span>');
    }
    el.innerHTML = parts.join('');
  }
  function legendSwatch(label, hexes, ends) {
    return '<span class="md-lg"><span class="md-lgl">' + label + '</span>' +
      '<span class="md-ramp">' + hexes.map(h => '<i style="background:' + h + '"></i>').join('') + '</span>' +
      '<span class="md-lge">' + ends[0] + ' → ' + ends[1] + '</span></span>';
  }

  /* --------------------------------------------------------- pointer work */
  let brushX = 0, brushY = 0;
  function stageCoords(ev) {
    const r = stage.getBoundingClientRect();
    const cx = ev.clientX - r.left, cy = ev.clientY - r.top;
    return { cx, cy, x: cx / r.width * eng.L, y: (1 - cy / r.height) * eng.L };
  }

  function wireStage() {
    stage.addEventListener('pointermove', ev => {
      const p = stageCoords(ev);
      brushX = p.x; brushY = p.y;
      if (eng.drag) { eng.drag.x = p.x; eng.drag.y = p.y; }
      if (UI.pinned < 0) UI.hover = eng.pick(p.x, p.y, 1.2);
      updateTip(p.cx, p.cy);
      if (!UI.running) render(true);
    });
    stage.addEventListener('pointerleave', () => {
      UI.hover = -1; if (UI.pinned < 0) $('mdTip').hidden = true;
      if (!UI.running) render(true);
    });
    stage.addEventListener('pointerdown', ev => {
      stage.setPointerCapture(ev.pointerId);
      const p = stageCoords(ev);
      brushX = p.x; brushY = p.y;
      if (UI.tool === 'drag') {
        const i = eng.pick(p.x, p.y, 1.2);
        if (i >= 0) { eng.drag = { i, x: p.x, y: p.y, k: 90 }; UI.pinned = i; }
        else UI.pinned = -1;
      } else {
        UI.brushing = UI.tool === 'heat' ? 1 : -1;
        if (!UI.running) { eng.brush(p.x, p.y, 2.6, UI.brushing > 0 ? 1.3 : 0.7); render(true); }
      }
      ev.preventDefault();
    });
    const release = () => { eng.drag = null; UI.brushing = 0; };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('dblclick', () => { UI.pinned = -1; $('mdTip').hidden = true; });

    stage.addEventListener('keydown', ev => {
      const k = ev.key;
      if (k === ' ') { toggleRun(); ev.preventDefault(); }
      else if (k === 'ArrowUp' || k === 'ArrowDown') {
        eng.T = clamp(eng.T + (k === 'ArrowUp' ? 0.05 : -0.05), 0.02, 4);
        eng.ramp = null; syncControls(); ev.preventDefault();
      } else if (k === 's' || k === 'S') { eng.step(); render(true); }
      else if (k === 'r' || k === 'R') { rebuild(); }
    });
  }

  function toggleRun() { UI.running = !UI.running; syncControls(); }

  function wireCharts() {
    ['mdChartT', 'mdChartE', 'mdChartG'].forEach(id => {
      const cv = $(id);
      cv.addEventListener('pointermove', ev => {
        const r = cv.getBoundingClientRect();
        crossX = ev.clientX - r.left; crossCv = cv;
        chartCountdown = 0;                       // repaint, or the rule smears
        if (!UI.running) render(true);
      });
      cv.addEventListener('pointerleave', () => {
        crossX = -1; crossCv = null; $('mdChartTip').hidden = true;
        if (!UI.running) render(true);
      });
    });
  }

  function wireControls() {
    $('mdPreset').addEventListener('change', e => {
      applyPreset(e.target.value);
      // a shareable link straight to one demo
      if (history.replaceState) history.replaceState(null, '', '#preset=' + e.target.value);
    });
    $('mdPlay').addEventListener('click', toggleRun);
    $('mdStep').addEventListener('click', () => { for (let i = 0; i < UI.rate; i++) eng.step(); pushTrail(); render(true); });
    $('mdReset').addEventListener('click', () => applyPreset(UI.preset));
    $('mdRate').addEventListener('change', e => { UI.rate = +e.target.value; });

    $('mdT').addEventListener('input', e => {
      eng.T = +e.target.value; eng.ramp = null;
      $('mdTval').textContent = fmt(eng.T, 2) + ' ε/k_B  ·  ' + (eng.T * ARGON.epsK).toFixed(0) + ' K';
      $('mdRampNote').hidden = true;
      if (!UI.running) render(true);
    });
    $('mdDt').addEventListener('input', e => {
      eng.dt = +e.target.value;
      $('mdDtval').textContent = fmt(eng.dt, 3) + ' τ  ·  ' + (eng.dt * ARGON.tauPs * 1000).toFixed(1) + ' fs';
    });
    $('mdGamma').addEventListener('input', e => {
      eng.gamma = +e.target.value; $('mdGammaval').textContent = fmt(eng.gamma, 2) + ' τ⁻¹';
    });
    $('mdCross').addEventListener('input', e => {
      eng.setCross(+e.target.value); $('mdCrossval').textContent = '×' + fmt(eng.cross, 2);
      washDirty = true; if (!UI.running) render(true);
    });
    $('mdCoulomb').addEventListener('input', e => {
      eng.setCoulomb(+e.target.value);
      $('mdCoulval').textContent = eng.kCoulomb ? fmt(eng.kCoulomb, 0) + ' εσ/q²' : 'off';
      if (!UI.running) render(true);
    });
    $('mdThermo').addEventListener('change', e => { eng.thermostat = e.target.value; syncControls(); });
    /* Periodic and confined are genuinely different systems — and carrying a
       dense periodic configuration across would leave atoms overlapping at the
       new walls. Rebuild instead. */
    $('mdBoundary').addEventListener('change', e => {
      eng.pbc = e.target.value === 'pbc';
      rebuild();
    });

    ['mdRho', 'mdN'].forEach(id => {
      $(id).addEventListener('input', e => {
        $(id + 'val').textContent = id === 'mdRho' ? fmt(+e.target.value, 2) + ' σ⁻²' : (+e.target.value) + ' atoms';
      });
      $(id).addEventListener('change', rebuild);
    });

    $('mdColor').addEventListener('change', e => { V.color = e.target.value; updateScaleLegend(); render(true); });
    $('mdField').addEventListener('change', e => { V.field = e.target.value; streamDirty = true; updateScaleLegend(); render(true); });
    $('mdWash').addEventListener('change', e => { V.wash = e.target.value; washDirty = true; updateScaleLegend(); render(true); });
    ['links', 'forces', 'vel', 'trails', 'ghosts'].forEach(k => {
      const el = $('md' + k[0].toUpperCase() + k.slice(1));
      el.addEventListener('change', () => { V[k] = el.checked; updateScaleLegend(); render(true); });
    });
    MOUNT.querySelectorAll('[name="mdTool"]').forEach(r => {
      r.addEventListener('change', () => { UI.tool = r.value; stage.dataset.tool = r.value; });
    });
    ['mdPairA', 'mdPairB'].forEach(id => $(id).addEventListener('change', () => render(true)));

    $('mdRamp').addEventListener('click', () => {
      eng.ramp = { from: eng.T, to: eng.T < 0.8 ? 1.4 : 0.15, over: 90, t0: eng.time };
      $('mdRampNote').hidden = false;
      UI.running = true; syncControls();
    });
    $('mdTableToggle').addEventListener('click', () => {
      UI.showTable = !UI.showTable;
      $('mdTableWrap').hidden = !UI.showTable;
      $('mdTableToggle').setAttribute('aria-expanded', String(UI.showTable));
      $('mdTableToggle').textContent = UI.showTable ? 'Hide data tables' : 'Show data tables';
      if (UI.showTable) renderTables();
    });
    $('mdCsv').addEventListener('click', exportCsv);
  }

  /* ================================================================== boot */

  function boot() {
    stage = $('mdCanvas');
    MOUNT.classList.remove('md-loading');

    $('mdPreset').innerHTML = PRESETS.map(p =>
      '<option value="' + p.id + '">' + p.name + '</option>').join('');
    const speciesOpts = SPECIES.map((s, i) => '<option value="' + i + '">' + s.label + '</option>').join('');
    $('mdPairA').innerHTML = speciesOpts; $('mdPairB').innerHTML = speciesOpts;
    $('mdPairA').value = '0'; $('mdPairB').value = '0';

    readTheme();
    fitStage();                     // sctx has to exist before the first render
    const asked = (location.hash.match(/preset=([a-z]+)/) || [])[1];
    applyPreset(PRESETS.some(p => p.id === asked) ? asked : 'liquid');
    fitStage();                     // again, now that the real box size is known
    wireStage(); wireCharts(); wireControls();

    new MutationObserver(() => { readTheme(); render(true); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { fitStage(); render(true); }, 120);
    });

    UI.running = !reduceMotion;
    if (reduceMotion) $('mdMotionNote').hidden = false;
    syncControls();
    lastT = performance.now();
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
