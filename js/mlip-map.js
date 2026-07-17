/* ==========================================================================
   MLIP family tree — interactive time map
   Renders into #mlip-map on materials.html. Data: data/mlip-map.json
   Theme follows the site: html.dark, driven by js/site.js.
   ========================================================================== */
(function () {
  'use strict';

  const MOUNT = document.getElementById('mlip-map');
  if (!MOUNT) return;

  /* ---------------------------------------------------------------- taxonomy */
  const TRUNKS = {
    global:    { label: 'Global representation',            c: 'var(--mm-global)',    w: 'var(--mm-global-wash)',    blurb: 'Fit the whole molecule at once' },
    tuples:    { label: 'Explicit sum over atom tuples',     c: 'var(--mm-tuples)',    w: 'var(--mm-tuples-wash)',    blurb: 'Bonds, angles, symmetry functions' },
    harmonics: { label: 'Density trick · spherical harmonics', c: 'var(--mm-harmonics)', w: 'var(--mm-harmonics-wash)', blurb: 'SOAP → ACE → equivariant nets' },
    cartesian: { label: 'Density trick · Cartesian tensors', c: 'var(--mm-cartesian)', w: 'var(--mm-cartesian-wash)', blurb: 'Moment tensors, Cartesian equivariants' },
    attention: { label: 'Learned attention',                 c: 'var(--mm-attention)', w: 'var(--mm-attention-wash)', blurb: 'Transformers over atoms and edges' },
    property:  { label: 'Property prediction',               c: 'var(--mm-property)',  w: 'var(--mm-property-wash)',  blurb: 'Not a PES — direct regression' },
  };
  const TRUNK_ORDER = ['global', 'tuples', 'harmonics', 'cartesian', 'attention', 'property'];

  const BRANCH_TO_TRUNK = {
    'global-pip': 'global', 'classical': 'tuples', 'descriptor-sum': 'tuples',
    'gnn-invariant': 'tuples', 'density-sh': 'harmonics', 'gnn-equivariant': 'harmonics',
    'density-cartesian': 'cartesian', 'transformer': 'attention',
    'property-prediction': 'property', 'other': 'tuples',
  };

  const BENCH_LANES = {
    qm:      { label: 'Small molecules · QM',           c: 'var(--mm-global)',    w: 'var(--mm-global-wash)' },
    mat:     { label: 'Materials · crystals',           c: 'var(--mm-harmonics)', w: 'var(--mm-harmonics-wash)' },
    cat:     { label: 'Catalysis · interfaces · MOFs',  c: 'var(--mm-tuples)',    w: 'var(--mm-tuples-wash)' },
    bio:     { label: 'Biomolecular · drug discovery',  c: 'var(--mm-cartesian)', w: 'var(--mm-cartesian-wash)' },
    harness: { label: 'Software · harnesses',           c: 'var(--mm-attention)', w: 'var(--mm-attention-wash)' },
  };
  const BENCH_LANE_ORDER = ['qm', 'mat', 'cat', 'bio', 'harness'];

  /* ---------------------------------------------------------------- helpers */
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const ok = u => typeof u === 'string' && /^https?:\/\//.test(u.trim());
  const $ = id => document.getElementById(id);

  /* ---------------------------------------------------------------- scale */
  const PAD_L = 30, PAD_R = 210;
  const ROW_H = 27, LANE_PAD = 34, AXIS_H = 30, LABEL_H = 22;

  function makeScale(anchors, ticks) {
    const lo = anchors[0][0], hi = anchors[anchors.length - 1][0];
    const xOf = year => {
      const y = Math.min(hi, Math.max(lo, +year));
      for (let i = 0; i < anchors.length - 1; i++) {
        const [y0, x0] = anchors[i], [y1, x1] = anchors[i + 1];
        if (y >= y0 && y <= y1) return x0 + (y - y0) / (y1 - y0) * (x1 - x0);
      }
      return anchors[anchors.length - 1][1];
    };
    return { xOf, ticks, totalW: xOf(hi) + PAD_L + PAD_R };
  }

  // Models run 1968→2026; half the width goes to 2021+ because that is where
  // the field actually happened.
  const MODEL_SCALE = makeScale([
    [1965, 0], [1980, 110], [1990, 200], [2000, 320], [2007, 440],
    [2012, 600], [2015, 760], [2017, 940], [2019, 1180], [2021, 1520],
    [2023, 1980], [2024, 2340], [2025, 2760], [2026, 3200], [2027, 3480],
  ], [1970, 1990, 2000, 2007, 2012, 2015, 2017, 2019, 2021, 2023, 2024, 2025, 2026]);

  // Datasets only start in 2002, and 90% land after 2017 — its own scale.
  const BENCH_SCALE = makeScale([
    [2001, 0], [2010, 120], [2014, 240], [2017, 400], [2019, 620],
    [2020, 830], [2021, 1080], [2022, 1360], [2023, 1700], [2024, 2070],
    [2025, 2470], [2026, 2760],
  ], [2002, 2010, 2014, 2017, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);

  /* ---------------------------------------------------------------- state */
  let MODELS = [], BENCH = [], RESOURCES = [], GROUPS = [], ROADMAP = { openProblems: [], stack: [] };
  let byId = new Map(), byName = new Map(), childrenOf = new Map();
  let treeChart = null, benchChart = null;

  const lookup = k => byId.get(norm(k)) || byName.get(norm(k)) || null;

  const state = {
    q: '', trunks: new Set(TRUNK_ORDER), fdnOnly: false, selected: null,
    benchQ: '', benchLanes: new Set(BENCH_LANE_ORDER),
    groupQ: '', roadFilter: 'all', resQ: '',
  };

  /* ---------------------------------------------------------------- prep */
  const isVenue = b => /venue|resource|course|journal|conference|workshop|school|review|community|hub/i
    .test(String(b.domain || ''));

  function shapeOf(m) {
    const a = String(m.archClass || '').toLowerCase();
    if (/attention|transformer/.test(a)) return 'diamond';
    if (/mpnn|message|graph|gnn/.test(a)) return 'square';
    return 'circle';
  }

  function benchLane(b) {
    const s = (String(b.domain || '') + ' ' + (b.tasks || []).join(' ') + ' ' + b.name).toLowerCase();
    if (/harness|software|framework|library|engine|arena/.test(s)) return 'harness';
    if (/catalys|adsorb|surface|mof|dac|direct air|interface|electrocat|slab/.test(s)) return 'cat';
    if (/protein|peptide|drug|bio|ligand|pharma|admet|tox|binding|pdb/.test(s)) return 'bio';
    if (/crystal|material|inorganic|solid|alloy|perovskite|phonon|bulk|periodic/.test(s)) return 'mat';
    return 'qm';
  }

  function prep(DATA) {
    MODELS = (DATA.models || []).filter(m => m && m.name && Number.isFinite(+m.year));
    const allB = (DATA.benchmarks || []).filter(b => b && b.name);
    BENCH = allB.filter(b => !isVenue(b) && Number.isFinite(+b.year));
    RESOURCES = allB.filter(isVenue);
    GROUPS = (DATA.groups || []).filter(g => g && g.name);
    ROADMAP = DATA.roadmap || { openProblems: [], stack: [] };

    byId = new Map(); byName = new Map();
    MODELS.forEach(m => { byId.set(norm(m.id || m.name), m); byName.set(norm(m.name), m); });

    MODELS.forEach(m => {
      m._trunk = (m.trunk && TRUNKS[m.trunk]) ? m.trunk : (BRANCH_TO_TRUNK[m.branch] || 'harmonics');
      m._fdn = !!m.fdn;
      m._shape = shapeOf(m);
    });

    childrenOf = new Map();
    MODELS.forEach(m => (m.parents || []).forEach(p => {
      const pm = lookup(p);
      if (!pm || pm === m) return;
      const k = norm(pm.id || pm.name);
      if (!childrenOf.has(k)) childrenOf.set(k, []);
      childrenOf.get(k).push(m);
    }));

    BENCH.forEach(b => { b._lane = benchLane(b); });
  }

  /* ---------------------------------------------------------------- layout */
  function layoutLane(items, getYear, getLabel, sc) {
    const rows = [];
    const sorted = [...items].sort((a, b) => getYear(a) - getYear(b));
    const placed = [];
    for (const it of sorted) {
      const x = sc.xOf(getYear(it)) + PAD_L;
      const w = String(getLabel(it)).length * 6.9 + 34;
      let r = 0;
      while (true) {
        if (!rows[r]) rows[r] = [];
        const clash = rows[r].some(iv => x < iv.x1 + 11 && x + w > iv.x0 - 11);
        if (!clash) { rows[r].push({ x0: x, x1: x + w }); break; }
        r++;
        if (r > 60) break;
      }
      placed.push({ item: it, x, row: r });
    }
    return { placed, rowCount: rows.length || 1 };
  }

  function renderLaneChart(canvas, items, laneDefs, laneOrder, opts) {
    const { getLane, getYear, getLabel, getKey, onPick, decorate } = opts;
    const sc = opts.scale || MODEL_SCALE;
    const TOTAL_W = sc.totalW;
    canvas.innerHTML = '';
    canvas.style.width = TOTAL_W + 'px';

    const axis = document.createElement('div');
    axis.className = 'mm-axis';
    axis.style.width = TOTAL_W + 'px';
    sc.ticks.forEach(t => {
      const el = document.createElement('div');
      el.className = 'mm-axis-tick';
      el.style.left = (sc.xOf(t) + PAD_L) + 'px';
      el.textContent = t;
      axis.appendChild(el);
    });
    canvas.appendChild(axis);

    const lanes = [];
    let y = AXIS_H + 8;
    for (const key of laneOrder) {
      const laneItems = items.filter(it => getLane(it) === key);
      const { placed, rowCount } = layoutLane(laneItems, getYear, getLabel, sc);
      const h = rowCount * ROW_H + LANE_PAD + LABEL_H;
      lanes.push({ key, def: laneDefs[key], placed, y0: y, h, count: laneItems.length });
      y += h;
    }
    const TOTAL_H = y + 14;
    canvas.style.height = TOTAL_H + 'px';

    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', TOTAL_W);
    svg.setAttribute('height', TOTAL_H);
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:1';
    // decorative: every node is a real button beside this, and lineage is repeated
    // as text in the detail rail, so screen readers lose nothing by skipping it
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const defs = document.createElementNS(NS, 'defs');
    const uid = canvas.id;
    defs.innerHTML =
      `<filter id="rough-${uid}">
         <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" result="n"/>
         <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>
       </filter>` +
      laneOrder.map(k =>
        `<linearGradient id="rib-${uid}-${k}" x1="0" x2="1">
           <stop offset="0"   stop-color="${laneDefs[k].w}" stop-opacity="1"/>
           <stop offset=".82" stop-color="${laneDefs[k].w}" stop-opacity="1"/>
           <stop offset="1"   stop-color="${laneDefs[k].w}" stop-opacity="0"/>
         </linearGradient>`).join('');
    svg.appendChild(defs);

    sc.ticks.forEach(t => {
      const l = document.createElementNS(NS, 'line');
      const x = sc.xOf(t) + PAD_L;
      l.setAttribute('x1', x); l.setAttribute('x2', x);
      l.setAttribute('y1', AXIS_H); l.setAttribute('y2', TOTAL_H);
      l.setAttribute('stroke', 'var(--mm-rule)');
      l.setAttribute('stroke-width', '1');
      l.setAttribute('opacity', '.5');
      svg.appendChild(l);
    });

    lanes.forEach(L => {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', 0); r.setAttribute('y', L.y0 - 3);
      r.setAttribute('width', TOTAL_W); r.setAttribute('height', L.h - 12);
      r.setAttribute('rx', 12);
      r.setAttribute('fill', `url(#rib-${uid}-${L.key})`);
      svg.appendChild(r);
    });

    const baseG = document.createElementNS(NS, 'g');
    baseG.setAttribute('class', 'mm-edges-base');
    svg.appendChild(baseG);
    const edgeG = document.createElementNS(NS, 'g');
    svg.appendChild(edgeG);
    const ringG = document.createElementNS(NS, 'g');
    svg.appendChild(ringG);
    canvas.appendChild(svg);

    // lane labels — full-width holder so the label sticks to the scroller's edge
    lanes.forEach(L => {
      const holder = document.createElement('div');
      holder.style.cssText =
        `position:absolute;top:${L.y0 - 2}px;left:0;width:${TOTAL_W}px;z-index:5;pointer-events:none;`;
      const lab = document.createElement('div');
      lab.className = 'mm-lane-label';
      lab.style.background = L.def.w;
      lab.style.color = L.def.c;
      lab.innerHTML =
        `<span class="mm-dot" style="background:${L.def.c}"></span>${esc(L.def.label)}` +
        `<span style="opacity:.55;margin-left:3px">${L.count}</span>`;
      holder.appendChild(lab);
      canvas.appendChild(holder);
    });

    const pos = new Map();
    lanes.forEach(L => {
      L.placed.forEach(({ item, x, row }) => {
        const cy = L.y0 + LABEL_H + 14 + row * ROW_H;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mm-node';
        btn.style.left = x + 'px';
        btn.style.top = (cy - 11) + 'px';
        btn.style.setProperty('--nc', L.def.c);
        btn.dataset.key = getKey(item);
        btn.dataset.shape = opts.getShape ? opts.getShape(item) : 'circle';
        btn.innerHTML = `<span class="mm-bead"></span><span class="mm-nlabel">${esc(getLabel(item))}</span>`;
        if (decorate) decorate(btn, item);
        btn.addEventListener('click', () => onPick(item));
        canvas.appendChild(btn);
        pos.set(getKey(item), { x, y: cy, item, el: btn });
      });
    });

    // Real rendered label widths, in one pass now that every node is in the DOM.
    // The char-count estimate layoutLane uses for collisions is off by up to ~34px
    // on a proportional face, which is fine for reserving space but not for
    // anchoring a line to a label's edge. Reading during the append loop above
    // would force a relayout per node.
    pos.forEach(p => { p.w = p.el.offsetWidth; });

    if (opts.getRing) {
      pos.forEach(p => {
        if (!opts.getRing(p.item)) return;
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', p.x + 4.5); c.setAttribute('cy', p.y); c.setAttribute('r', 9);
        c.setAttribute('fill', 'none');
        c.setAttribute('stroke', 'var(--mm-mark)');
        c.setAttribute('stroke-width', '1.6');
        c.setAttribute('filter', `url(#rough-${uid})`);
        c.setAttribute('opacity', '.85');
        ringG.appendChild(c);
      });
    }
    return { pos, baseG, edgeG, lanes };
  }

  /* ---------------------------------------------------------------- tree */
  function modelMatch(m) {
    if (!state.trunks.has(m._trunk)) return false;
    if (state.fdnOnly && !m._fdn) return false;
    if (!state.q) return true;
    const hay = [m.name, m.fullName, m.oneLiner, m.description, m.authors, m.archClass,
      (m.institutions || []).join(' '), (m.tags || []).join(' ')].join(' ').toLowerCase();
    return hay.includes(state.q.toLowerCase());
  }

  function kinOf(m) {
    const key = norm(m.id || m.name);
    return {
      parents: (m.parents || []).map(lookup).filter(Boolean),
      children: childrenOf.get(key) || [],
    };
  }

  /* Leave from the right edge of the source node rather than its bead: the label
     sits between the two, so a line starting at the bead is drawn straight through
     the node's own text. Reuses layoutLane's width estimate so the two agree.
     Both the faint layer and the hover layer come through here — if they diverged
     by even a pixel, every highlighted line would show a ghost beside it. */
  function edgePath(a, b) {
    const entry = b.x - 3;
    const right = a.x + (a.w || 25 + String(a.item.name || '').length * 6.9);
    // Only leave from the right of the label when the child is clear of it. Rows
    // are packed, so a child can sit level with or underneath a long label — there
    // is no room to route around it, and forcing it would send the line backwards
    // past its own target. Those fall back to leaving from the bead.
    const ax = right < entry - 8 ? right : a.x + 5;
    const dx = Math.max(28, Math.abs(entry - ax) * 0.4);
    return `M ${ax} ${a.y} C ${ax + dx} ${a.y}, ${entry - dx} ${b.y}, ${entry} ${b.y}`;
  }

  /* The resting lineage web: every parent→child edge between two currently visible
     nodes, drawn once per renderTree. One path per trunk instead of ~554 separate
     ones — a single stroked path paints its own overlaps once, so the dense years
     stay an even wash instead of stacking alpha into a dark blob. */
  function drawBaseEdges() {
    if (!treeChart) return;
    const NS = 'http://www.w3.org/2000/svg';
    const buckets = new Map();
    MODELS.forEach(m => {
      const b = treeChart.pos.get(norm(m.id || m.name));
      if (!b) return;
      (m.parents || []).forEach(ref => {
        const pm = lookup(ref);
        if (!pm || pm === m) return;
        const a = treeChart.pos.get(norm(pm.id || pm.name));
        if (!a) return;
        if (!buckets.has(pm._trunk)) buckets.set(pm._trunk, []);
        buckets.get(pm._trunk).push(edgePath(a, b));
      });
    });
    treeChart.baseG.innerHTML = '';
    TRUNK_ORDER.forEach(k => {
      const ds = buckets.get(k);
      if (!ds) return;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', ds.join(' '));
      p.setAttribute('stroke', TRUNKS[k].c);
      treeChart.baseG.appendChild(p);
    });
  }

  function clearKin() {
    if (!treeChart) return;
    treeChart.edgeG.innerHTML = '';
    treeChart.baseG.classList.remove('is-muted');
    treeChart.pos.forEach(p => p.el.classList.remove('is-dim', 'is-kin'));
  }

  function highlightKin(m) {
    if (!treeChart) return;
    const NS = 'http://www.w3.org/2000/svg';
    treeChart.edgeG.innerHTML = '';
    const key = norm(m.id || m.name);
    if (!treeChart.pos.get(key)) { clearKin(); return; }
    treeChart.baseG.classList.add('is-muted');
    const { parents, children } = kinOf(m);
    const kinKeys = new Set([key]);
    const draw = (from, to, color) => {
      const a = treeChart.pos.get(norm(from.id || from.name));
      const b = treeChart.pos.get(norm(to.id || to.name));
      if (!a || !b) return;
      kinKeys.add(norm(from.id || from.name));
      kinKeys.add(norm(to.id || to.name));
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', edgePath(a, b));
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', color);
      p.setAttribute('stroke-width', '1.5');
      p.setAttribute('opacity', '.75');
      treeChart.edgeG.appendChild(p);
    };
    // both directions colour by the parent's trunk, matching the resting layer —
    // otherwise a cross-trunk line changes hue the moment you hover it
    parents.forEach(p => draw(p, m, TRUNKS[p._trunk].c));
    children.forEach(c => draw(m, c, TRUNKS[m._trunk].c));
    treeChart.pos.forEach((p, k) => {
      p.el.classList.toggle('is-dim', !kinKeys.has(k));
      p.el.classList.toggle('is-kin', kinKeys.has(k) && k !== key);
    });
  }

  function paintSelection() {
    if (!treeChart) return;
    const sk = state.selected ? norm(state.selected.id || state.selected.name) : null;
    treeChart.pos.forEach((p, k) => p.el.classList.toggle('is-selected', k === sk));
  }

  function pickModel(m) {
    state.selected = m;
    openModel(m);
    highlightKin(m);
    paintSelection();
  }

  function renderTree() {
    const items = MODELS.filter(modelMatch);
    $('mmTreeShown').textContent = `${items.length} of ${MODELS.length} models shown`;
    const canvas = $('mmTreeCanvas');
    if (!items.length) {
      canvas.innerHTML = '<div class="mm-empty" style="margin:24px">No models match those filters.</div>';
      canvas.style.width = '100%'; canvas.style.height = 'auto';
      treeChart = null;
      return;
    }
    treeChart = renderLaneChart(canvas, items, TRUNKS, TRUNK_ORDER, {
      getLane: m => m._trunk, getYear: m => m.year, getLabel: m => m.name,
      getKey: m => norm(m.id || m.name), getShape: m => m._shape, getRing: m => m._fdn,
      decorate: (btn, m) => {
        if (m._fdn) btn.classList.add('is-fdn');
        btn.addEventListener('mouseenter', () => highlightKin(m));
        btn.addEventListener('mouseleave', () => { state.selected ? highlightKin(state.selected) : clearKin(); });
        btn.addEventListener('focus', () => highlightKin(m));
        btn.addEventListener('blur', () => { state.selected ? highlightKin(state.selected) : clearKin(); });
      },
      onPick: pickModel,
    });
    drawBaseEdges();
    paintSelection();
    // a rebuild starts from a clean chart, so a still-pinned selection has to be
    // re-emphasised or it silently loses its lineage until the next hover
    if (state.selected) highlightKin(state.selected);
  }

  /* ---------------------------------------------------------------- cards */
  function linkRow(pairs) {
    const out = pairs.filter(([, u]) => ok(u))
      .map(([l, u]) => `<a class="mm-linkbtn" href="${esc(u)}" target="_blank" rel="noopener">${esc(l)} ↗</a>`).join('');
    return out ? `<div class="mm-linkrow">${out}</div>` : '';
  }

  function renderModelGrid() {
    const items = MODELS.filter(modelMatch).sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));
    const g = $('mmModelGrid');
    g.innerHTML = items.length ? items.map(m => {
      const T = TRUNKS[m._trunk];
      return `<article class="mm-card" style="--tc:${T.c};--tw:${T.w}">
        <div class="mm-card-hd"><h4>${esc(m.name)}</h4><span class="mm-yr">${esc(m.year)}</span></div>
        <p class="mm-body">${esc(m.oneLiner || m.description || '')}</p>
        <div class="mm-tagrow">
          <span class="mm-tag trunk">${esc(T.label)}</span>
          ${m.archClass ? `<span class="mm-tag">${esc(m.archClass)}</span>` : ''}
          ${m._fdn ? '<span class="mm-tag fdn">foundation</span>' : ''}
          ${m.license ? `<span class="mm-tag">${esc(m.license)}</span>` : ''}
          ${m.unverified ? '<span class="mm-tag unver">unverified</span>' : ''}
        </div>
        ${linkRow([['paper', m.paperUrl], ['arXiv', m.arxiv], ['code', m.github], ['docs', m.docs]])}
        <button type="button" class="mm-linkbtn mm-more" data-open="${esc(norm(m.id || m.name))}">full detail →</button>
      </article>`;
    }).join('') : '<div class="mm-empty">No models match those filters.</div>';
    g.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => {
      const m = lookup(b.dataset.open); if (m) pickModel(m);
    }));
  }

  /* ---------------------------------------------------------------- rail */
  const UNVER_NOTE = `<div class="mm-note warn">
    <strong>Not fully verified</strong><br>
    The research pass could not confirm every field here against a live source.
    Check the primary source before citing.</div>`;

  function fields(rows) {
    const r = rows.filter(([, v]) => v && String(v).trim());
    if (!r.length) return '';
    return `<dl class="mm-fields">${r.map(([k, v]) =>
      `<div class="mm-field"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  }

  function openRail() {
    $('mmRail').classList.add('open');
    $('mmScrim').classList.add('open');
    $('mmRail').setAttribute('aria-hidden', 'false');
    $('mmRailClose').focus();
  }
  function closeRail() {
    $('mmRail').classList.remove('open');
    $('mmScrim').classList.remove('open');
    $('mmRail').setAttribute('aria-hidden', 'true');
    // deliberately keeps the pin: dismissing the card is how you get the card out
    // of the way to study the routes it just drew. releaseModel() ends the pin.
  }

  /* A pinned model holds its routes until it is let go of. Clicking a different
     model re-pins to that one; clicking empty space, or Escape once the card is
     out of the way, lets go. */
  function releaseModel() {
    if (!state.selected) return;
    state.selected = null;
    clearKin();
    paintSelection();
  }

  function openModel(m) {
    const T = TRUNKS[m._trunk];
    $('mmRailStrip').style.background = T.c;
    $('mmRailKicker').textContent = `${T.label} · ${m.year}`;
    $('mmRailTitle').textContent = m.name;
    $('mmRailSub').textContent =
      (m.fullName && norm(m.fullName) !== norm(m.name)) ? m.fullName : (m.oneLiner || '');

    const { parents, children } = kinOf(m);
    const metrics = (m.keyMetrics || []).filter(k => k && k.benchmark);
    const body = $('mmRailBody');
    body.innerHTML = `
      ${m._fdn ? '<div class="mm-note mark">Universal / foundation model</div>' : ''}
      ${m.unverified ? UNVER_NOTE : ''}
      <p class="mm-body lg">${esc(m.description || m.oneLiner || '')}</p>
      ${fields([
        ['Authors', esc(m.authors)],
        ['Where', esc((m.institutions || []).join(' · '))],
        ['Published', esc(m.venue)],
        ['Architecture', esc(m.archClass)],
        ['License', esc(m.license)],
        ['Status', esc(m.status)],
      ])}
      ${m.paperTitle ? `<div><div class="mm-sec">Paper</div>
        <p class="mm-body">${esc(m.paperTitle)}</p>
        ${linkRow([['journal / DOI', m.paperUrl], ['arXiv', m.arxiv]])}</div>` : ''}
      ${(ok(m.github) || ok(m.docs)) ? `<div><div class="mm-sec">Code</div>
        ${linkRow([['repository', m.github], ['documentation', m.docs]])}</div>` : ''}
      ${metrics.length ? `<div><div class="mm-sec">Reported results</div>
        <div class="mm-tbl"><table><thead><tr><th>Benchmark</th><th>Metric</th><th>Value</th></tr></thead><tbody>
        ${metrics.map(k => `<tr><td>${esc(k.benchmark)}</td><td>${esc(k.metric)}</td><td class="num">${esc(k.value)}</td></tr>`).join('')}
        </tbody></table></div></div>` : ''}
      ${parents.length ? `<div><div class="mm-sec">Builds on</div><div class="mm-kinlist">
        ${parents.map(p => `<button type="button" class="mm-kin" data-goto="${esc(norm(p.id || p.name))}">↖ ${esc(p.name)}</button>`).join('')}
        </div></div>` : ''}
      ${children.length ? `<div><div class="mm-sec">Led to</div><div class="mm-kinlist">
        ${children.map(c => `<button type="button" class="mm-kin" data-goto="${esc(norm(c.id || c.name))}">↘ ${esc(c.name)}</button>`).join('')}
        </div></div>` : ''}
      ${(m.tags || []).length ? `<div><div class="mm-sec">Tags</div>
        <div class="mm-tagrow" style="margin-top:0">${m.tags.map(t => `<span class="mm-tag">${esc(t)}</span>`).join('')}</div></div>` : ''}`;
    body.scrollTop = 0;
    body.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => {
      const t = lookup(b.dataset.goto); if (t) pickModel(t);
    }));
    openRail();
  }

  function openBench(b) {
    const L = BENCH_LANES[b._lane];
    $('mmRailStrip').style.background = L.c;
    $('mmRailKicker').textContent = `${L.label} · ${b.year}`;
    $('mmRailTitle').textContent = b.name;
    $('mmRailSub').textContent = b.domain || '';
    const sota = (b.sota || []).filter(s => s && s.model);
    const body = $('mmRailBody');
    body.innerHTML = `
      ${b.unverified ? UNVER_NOTE : ''}
      <p class="mm-body lg">${esc(b.description || '')}</p>
      ${fields([
        ['Size', esc(b.size)], ['Theory', esc(b.levelOfTheory)],
        ['Tasks', esc((b.tasks || []).join(' · '))], ['Built by', esc(b.creators)],
        ['Where', esc((b.institutions || []).join(' · '))], ['License', esc(b.license)],
      ])}
      ${linkRow([['dataset', b.url], ['leaderboard', b.leaderboardUrl], ['paper', b.paperUrl], ['arXiv', b.arxiv], ['code', b.github]])}
      ${sota.length ? `<div><div class="mm-sec">Leading models</div>
        <div class="mm-tbl"><table><thead><tr><th></th><th>Model</th><th>Metric</th><th>Value</th><th>Yr</th></tr></thead><tbody>
        ${sota.map((s, i) => `<tr>
          <td class="mm-rank${i === 0 ? ' first' : ''}">${i + 1}</td>
          <td class="mdl">${esc(s.model)}</td>
          <td class="dim">${esc(s.metric)}</td>
          <td class="num"><strong>${esc(s.value)}</strong></td>
          <td class="num dim">${esc(s.year || '')}</td></tr>
          ${s.note ? `<tr><td></td><td colspan="4" class="mm-note-cell">${esc(s.note)}</td></tr>` : ''}`).join('')}
        </tbody></table></div></div>` : ''}`;
    body.scrollTop = 0;
    openRail();
  }

  /* ---------------------------------------------------------------- bench */
  function benchMatch(b) {
    if (!state.benchLanes.has(b._lane)) return false;
    if (!state.benchQ) return true;
    const hay = [b.name, b.description, b.domain, b.levelOfTheory, b.creators,
      (b.tasks || []).join(' '), (b.sota || []).map(s => s.model).join(' ')].join(' ').toLowerCase();
    return hay.includes(state.benchQ.toLowerCase());
  }

  function renderBench() {
    const items = BENCH.filter(benchMatch);
    $('mmBenchShown').textContent = `${items.length} of ${BENCH.length} shown`;
    const canvas = $('mmBenchCanvas');
    if (items.length) {
      benchChart = renderLaneChart(canvas, items, BENCH_LANES, BENCH_LANE_ORDER, {
        scale: BENCH_SCALE,
        getLane: b => b._lane, getYear: b => b.year, getLabel: b => b.name,
        getKey: b => norm(b.id || b.name),
        getShape: b => (ok(b.leaderboardUrl) ? 'square' : 'circle'),
        getRing: () => false,
        onPick: openBench,
      });
    } else {
      canvas.innerHTML = '<div class="mm-empty" style="margin:24px">No datasets match.</div>';
      canvas.style.width = '100%'; canvas.style.height = 'auto';
    }

    const g = $('mmBenchGrid');
    const sorted = [...items].sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));
    g.innerHTML = sorted.map(b => {
      const L = BENCH_LANES[b._lane];
      const top = (b.sota || []).filter(s => s && s.model).slice(0, 3);
      return `<article class="mm-card" style="--tc:${L.c};--tw:${L.w}">
        <div class="mm-card-hd"><h4>${esc(b.name)}</h4><span class="mm-yr">${esc(b.year)}</span></div>
        <p class="mm-body">${esc(b.description || '')}</p>
        <div class="mm-tagrow">
          <span class="mm-tag trunk">${esc(L.label)}</span>
          ${b.size ? `<span class="mm-tag">${esc(b.size)}</span>` : ''}
          ${b.levelOfTheory ? `<span class="mm-tag">${esc(b.levelOfTheory)}</span>` : ''}
          ${b.unverified ? '<span class="mm-tag unver">unverified</span>' : ''}
        </div>
        ${top.length ? `<div class="mm-tbl"><table><thead><tr><th>Leading</th><th>Metric</th><th>Value</th></tr></thead><tbody>
          ${top.map((s, i) => `<tr><td class="mdl${i === 0 ? ' first' : ''}">${esc(s.model)}</td><td class="dim">${esc(s.metric)}</td><td class="num"><strong>${esc(s.value)}</strong></td></tr>`).join('')}
        </tbody></table></div>` : ''}
        ${linkRow([['dataset', b.url], ['leaderboard', b.leaderboardUrl], ['paper', b.paperUrl || b.arxiv], ['code', b.github]])}
        <button type="button" class="mm-linkbtn mm-more" data-openb="${esc(norm(b.id || b.name))}">full detail →</button>
      </article>`;
    }).join('') || '<div class="mm-empty">No datasets match.</div>';
    g.querySelectorAll('[data-openb]').forEach(btn => btn.addEventListener('click', () => {
      const b = BENCH.find(x => norm(x.id || x.name) === btn.dataset.openb);
      if (b) openBench(b);
    }));
  }

  /* ---------------------------------------------------------------- groups */
  function renderGroups() {
    const q = state.groupQ.toLowerCase();
    const items = GROUPS
      .filter(g => !q || [g.name, g.pi, g.institution, g.country, g.focus, (g.models || []).join(' ')]
        .join(' ').toLowerCase().includes(q))
      .sort((a, b) => String(a.institution).localeCompare(String(b.institution)));
    $('mmGroupGrid').innerHTML = items.length ? items.map(g => `<article class="mm-card">
      <h4>${ok(g.url) ? `<a href="${esc(g.url)}" target="_blank" rel="noopener">${esc(g.name)} ↗</a>` : esc(g.name)}</h4>
      ${g.pi ? `<div class="mm-pi">${esc(g.pi)}</div>` : ''}
      <div class="mm-inst">${esc(g.institution)}</div>
      ${g.country ? `<div class="mm-flag">${esc(g.country)}</div>` : ''}
      ${g.focus ? `<p class="mm-body">${esc(g.focus)}</p>` : ''}
      ${(g.models || []).length ? `<div class="mm-tagrow">${g.models.slice(0, 8).map(m => `<span class="mm-tag">${esc(m)}</span>`).join('')}</div>` : ''}
    </article>`).join('') : '<div class="mm-empty">No groups match.</div>';
  }

  /* ---------------------------------------------------------------- roadmap */
  const MATURITY_ORDER = { nascent: 0, underserved: 1, active: 2, crowded: 3 };

  function renderRoadmap() {
    const paras = (ROADMAP.summaryParagraphs && ROADMAP.summaryParagraphs.length)
      ? ROADMAP.summaryParagraphs : (ROADMAP.summary ? [ROADMAP.summary] : []);
    $('mmBrief').innerHTML = paras.map(p => {
      const m = String(p).match(/^([A-Z][^:.!?\n]{2,44}:)\s*([\s\S]*)$/);
      return m ? `<p><b>${esc(m[1])}</b> ${esc(m[2])}</p>` : `<p>${esc(p)}</p>`;
    }).join('');

    const probs = (ROADMAP.openProblems || [])
      .filter(p => state.roadFilter === 'all' || p.maturity === state.roadFilter)
      .sort((a, b) => (MATURITY_ORDER[a.maturity] ?? 9) - (MATURITY_ORDER[b.maturity] ?? 9));
    $('mmRoadGrid').innerHTML = probs.length ? probs.map(p => `
      <article class="mm-card rm">
        <div class="mm-rm-hd">
          <h4>${esc(p.title)}</h4>
          <span class="mm-maturity" data-m="${esc(p.maturity)}">${esc(p.maturity)}</span>
        </div>
        <p class="mm-body lg">${esc(p.description)}</p>
        ${p.whyHard ? `<p class="mm-whyhard">${esc(p.whyHard)}</p>` : ''}
        ${(p.keyPapers || []).length ? `<div class="mm-papers">${p.keyPapers.filter(k => k && k.title).map(k =>
          `<div class="mm-paper"><span class="py">${esc(k.year || '')}</span>${ok(k.url)
            ? `<a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.title)} ↗</a>`
            : `<span>${esc(k.title)}</span>`}</div>`).join('')}</div>` : ''}
        ${(p.groups || []).length ? `<div class="mm-tagrow">${p.groups.map(g => `<span class="mm-tag">${esc(g)}</span>`).join('')}</div>` : ''}
      </article>`).join('') : '<div class="mm-empty">Nothing at that maturity level.</div>';

    $('mmStackGrid').innerHTML = (ROADMAP.stack || []).map(s => `<article class="mm-card">
      <h4>${ok(s.url) ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)} ↗</a>` : esc(s.name)}</h4>
      <p class="mm-body">${esc(s.role)}</p></article>`).join('');
  }

  /* ---------------------------------------------------------------- resources */
  function renderResources() {
    const q = state.resQ.toLowerCase();
    const items = RESOURCES.filter(r => !q || [r.name, r.description, r.domain].join(' ').toLowerCase().includes(q));
    $('mmResGrid').innerHTML = items.length ? items.map(r => `<article class="mm-card">
      <div class="mm-card-hd"><h4>${esc(r.name)}</h4>${r.year ? `<span class="mm-yr">${esc(r.year)}</span>` : ''}</div>
      <p class="mm-body">${esc(r.description || '')}</p>
      <div class="mm-tagrow">
        ${r.domain ? `<span class="mm-tag">${esc(r.domain)}</span>` : ''}
        ${r.unverified ? '<span class="mm-tag unver">unverified</span>' : ''}
      </div>
      ${linkRow([['open', r.url], ['paper', r.paperUrl || r.arxiv]])}
    </article>`).join('') : '<div class="mm-empty">Nothing matches.</div>';
  }

  /* ---------------------------------------------------------------- controls */
  function buildControls() {
    const tc = $('mmTreeControls');
    tc.innerHTML =
      `<input class="mm-search" id="mmTreeSearch" type="search" placeholder="search models, authors, labs…" aria-label="Search models">
       <span class="mm-ctl-label">trunk</span>
       ${TRUNK_ORDER.map(k => `<button type="button" class="mm-chip" data-trunk="${k}" aria-pressed="true" style="--chip-c:${TRUNKS[k].c}" title="${esc(TRUNKS[k].blurb)}"><span class="mm-sw"></span>${esc(TRUNKS[k].label)}</button>`).join('')}
       <button type="button" class="mm-chip" id="mmFdnChip" aria-pressed="false" style="--chip-c:var(--mm-mark)"><span class="mm-sw"></span>foundation only</button>
       <button type="button" class="mm-chip" id="mmReset" aria-pressed="false">reset</button>`;
    $('mmTreeSearch').addEventListener('input', e => { state.q = e.target.value; renderTree(); renderModelGrid(); });
    tc.querySelectorAll('[data-trunk]').forEach(c => c.addEventListener('click', () => {
      const k = c.dataset.trunk, on = c.getAttribute('aria-pressed') === 'true';
      on ? state.trunks.delete(k) : state.trunks.add(k);
      c.setAttribute('aria-pressed', String(!on));
      renderTree(); renderModelGrid();
    }));
    $('mmFdnChip').addEventListener('click', e => {
      state.fdnOnly = !state.fdnOnly;
      e.currentTarget.setAttribute('aria-pressed', String(state.fdnOnly));
      renderTree(); renderModelGrid();
    });
    $('mmReset').addEventListener('click', () => {
      state.q = ''; state.fdnOnly = false; state.trunks = new Set(TRUNK_ORDER); state.selected = null;
      $('mmTreeSearch').value = '';
      tc.querySelectorAll('[data-trunk]').forEach(c => c.setAttribute('aria-pressed', 'true'));
      $('mmFdnChip').setAttribute('aria-pressed', 'false');
      renderTree(); renderModelGrid();
    });

    const bc = $('mmBenchControls');
    bc.innerHTML =
      `<input class="mm-search" id="mmBenchSearch" type="search" placeholder="search datasets, models, theory…" aria-label="Search benchmarks">
       <span class="mm-ctl-label">domain</span>
       ${BENCH_LANE_ORDER.map(k => `<button type="button" class="mm-chip" data-blane="${k}" aria-pressed="true" style="--chip-c:${BENCH_LANES[k].c}"><span class="mm-sw"></span>${esc(BENCH_LANES[k].label)}</button>`).join('')}`;
    $('mmBenchSearch').addEventListener('input', e => { state.benchQ = e.target.value; renderBench(); });
    bc.querySelectorAll('[data-blane]').forEach(c => c.addEventListener('click', () => {
      const k = c.dataset.blane, on = c.getAttribute('aria-pressed') === 'true';
      on ? state.benchLanes.delete(k) : state.benchLanes.add(k);
      c.setAttribute('aria-pressed', String(!on));
      renderBench();
    }));

    $('mmGroupControls').innerHTML =
      `<input class="mm-search" id="mmGroupSearch" type="search" placeholder="search groups, PIs, institutions…" aria-label="Search groups">`;
    $('mmGroupSearch').addEventListener('input', e => { state.groupQ = e.target.value; renderGroups(); });

    const rc = $('mmRoadControls');
    rc.innerHTML = `<span class="mm-ctl-label">maturity</span>` +
      ['all', 'nascent', 'underserved', 'active', 'crowded'].map(k =>
        `<button type="button" class="mm-chip" data-road="${k}" aria-pressed="${k === 'all'}">${k}</button>`).join('');
    rc.querySelectorAll('[data-road]').forEach(c => c.addEventListener('click', () => {
      state.roadFilter = c.dataset.road;
      rc.querySelectorAll('[data-road]').forEach(x => x.setAttribute('aria-pressed', String(x === c)));
      renderRoadmap();
    }));

    $('mmResControls').innerHTML =
      `<input class="mm-search" id="mmResSearch" type="search" placeholder="search venues, journals, reviews…" aria-label="Search resources">`;
    $('mmResSearch').addEventListener('input', e => { state.resQ = e.target.value; renderResources(); });
  }

  /* ---------------------------------------------------------------- tabs */
  function initTabs() {
    MOUNT.querySelectorAll('.mm-tab').forEach(t => t.addEventListener('click', () => {
      MOUNT.querySelectorAll('.mm-tab').forEach(x => x.setAttribute('aria-selected', String(x === t)));
      MOUNT.querySelectorAll('.mm-view').forEach(v =>
        v.classList.toggle('active', v.id === 'mmView-' + t.dataset.view));
      const top = MOUNT.getBoundingClientRect().top + window.scrollY - 80;
      if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
    }));
    $('mmRailClose').addEventListener('click', closeRail);
    $('mmScrim').addEventListener('click', closeRail);

    /* Click anywhere that isn't a control to let a pinned model go. Controls are
       excluded so filtering or searching doesn't drop the pin out from under you,
       and the scrim is excluded so dismissing the card only dismisses the card. */
    document.addEventListener('click', e => {
      if (!state.selected) return;
      if (e.target.closest('button, a, input, select, label, #mmRail, #mmScrim')) return;
      releaseModel();
    });

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      // first Escape puts the card away, a second one releases the model
      if ($('mmRail').classList.contains('open')) closeRail();
      else releaseModel();
    });
  }

  /* ---------------------------------------------------------------- boot */
  function boot(DATA) {
    prep(DATA);
    const fdn = MODELS.filter(m => m._fdn).length;
    $('mmStats').innerHTML = [
      [MODELS.length, 'methods mapped'], [fdn, 'foundation models'],
      [BENCH.length, 'benchmarks'], [GROUPS.length, 'groups &amp; labs'],
    ].map(([n, l]) => `<div class="mm-stat"><b>${n}</b><span>${l}</span></div>`).join('');

    $('mmCTree').textContent = MODELS.length;
    $('mmCBench').textContent = BENCH.length;
    $('mmCGroups').textContent = GROUPS.length;
    $('mmCRoad').textContent = (ROADMAP.openProblems || []).length;
    $('mmCRes').textContent = RESOURCES.length;

    buildControls();
    initTabs();
    renderTree(); renderModelGrid(); renderBench();
    renderGroups(); renderRoadmap(); renderResources();
    MOUNT.classList.remove('mm-loading');
  }

  fetch('data/mlip-map.json')
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(boot)
    .catch(err => {
      MOUNT.classList.remove('mm-loading');
      $('mmFallback').innerHTML =
        `<div class="mm-empty">Could not load the map data (${esc(err.message)}).<br>
         Expected <code>data/mlip-map.json</code> next to this page.</div>`;
    });
})();
