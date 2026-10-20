import { SimulationClock } from '../../js/core/clock.js';
import { STEP } from '../../js/core/physics.js';
import { K, MICRO, E_CHARGE } from '../../js/core/em-constants.js';
import { netForce, pairForce, rodForceExact, rodForceSlices, rodForcePointLimit } from '../../js/core/electrostatics.js';
import { ChargePlane, COLORS, sub } from '../../js/components/field-view.js';
import { XYPlot } from '../../js/components/xy-plot.js';
import { ACTIVITIES, ACTIVITY_IDS, C3_ZERO_X, activityFeedback, toSI, text } from './coulomb-activities.js';
import { chargingSteps, regionNet } from './electroscope.js';

const $ = id => document.getElementById(id);
const fN = v => { const a = Math.abs(v); return (a < 5e-5 ? '0.00' : a >= 100 ? v.toFixed(0) : a >= 0.1 ? v.toFixed(2) : v.toPrecision(2)).replace('-', '−'); };
const fM = v => v.toFixed(2).replace('-', '−');
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(+v.toFixed(2));
const sci = v => { if (v === 0) return '0'; const e = Math.floor(Math.log10(Math.abs(v))), m = v / 10 ** e; const sup = String(e).replace(/-/g, '⁻').replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]); return `${m.toFixed(2)} × 10${sup}`; };
const MIN_SEP = 0.04;

const DEFAULT_SLOTS = [{ uC: 2, x: 0.30, y: 0.30 }, { uC: 3, x: 0.50, y: 0.30 }, { uC: -4, x: 0.42, y: 0.48 }, { uC: -2, x: 0.66, y: 0.14 }];
const state = {
  experience: 'free', slots: DEFAULT_SLOTS.map(c => ({ ...c })), count: 2, selected: 0,
  activity: 'C1', prediction: null, t: 0, done: false, scale: 100, plotMax: 1, prevR: null, prevCurve: null,
};
const guided = () => state.experience === 'guided';
const activity = () => ACTIVITIES[state.activity];

/* ---------- current configuration ---------- */
function uNow() { return guided() && state.prediction ? Math.min(1, state.t / activity().duration) : 0; }
function chargesAt(u) {
  if (!guided()) return state.slots.slice(0, state.count);
  const a = activity(), set = a.charges.map(c => ({ ...c }));
  if (u > 0) Object.assign(set[a.mover], a.path(u));
  if (state.override) Object.assign(set[a.mover], state.override);
  return set;
}
const current = () => chargesAt(uNow());
const forcesOf = set => { const si = toSI(set); return si.map((_, i) => netForce(si, i)); };
const reveal = () => !guided() || !!state.prediction;

/* ---------- plane ---------- */
const plane = new ChargePlane($('plane'), {
  onSelect: i => { if (i !== state.selected) { state.selected = i; render(); } },
  canMove: i => (!guided() ? true : state.done && activity().lockToLine && i === activity().mover),
  constrain: (i, x, y) => {
    const set = current();
    if (guided() && activity().lockToLine) { y = set[i].y; x = Math.min(set[1].x - MIN_SEP, Math.max(set[0].x + MIN_SEP, x)); }
    return set.every((c, j) => j === i || Math.hypot(c.x - x, c.y - y) >= MIN_SEP - 1e-9) ? { x, y } : null;
  },
  onChange: (i, x, y) => {
    if (guided()) state.override = { x, y };
    else Object.assign(state.slots[i], { x, y });
    render();
  },
});
const plot = new XYPlot($('plot'), { width: 330, height: 240, title: 'Force between q₁ and q₂', xLabel: 'distance r (m)', yLabel: 'force F (N)' });

function rescale() {
  const set = current(), fs = forcesOf(set);
  let m = 0;
  for (const f of fs) { m = Math.max(m, f.magnitude); for (const p of f.parts) m = Math.max(m, p.magnitude); }
  const ref = guided() && activity().arrowN ? activity().arrowN : m;
  state.scale = ref > 0 ? 110 / ref : 100;
  if (set.length >= 2) {
    const si = toSI(set), F = pairForce(si[0], si[1]).magnitude;
    state.plotMax = Math.max(F * 1.6, K * Math.abs(si[0].q * si[1].q) / 0.15 ** 2);
  }
}

/* ---------- drawing ---------- */
function scaleBar() {
  const target = 70 / state.scale, p = 10 ** Math.floor(Math.log10(target)), m = target / p;
  const F = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p, L = F * state.scale, x2 = plane.W - 30, x1 = x2 - L;
  return `<g class="fv-scale"><rect x="${x1 - 8}" y="28" width="${L + 16}" height="30" rx="4"/><line x1="${x1}" y1="48" x2="${x2}" y2="48"/><line x1="${x1}" y1="43" x2="${x1}" y2="53"/><line x1="${x2}" y1="43" x2="${x2}" y2="53"/><text x="${(x1 + x2) / 2}" y="41">${+F.toPrecision(2)} N</text></g>`;
}

function renderPlot(set) {
  const pal = { a: COLORS.net, b: '#c27b22', ghost: '#a9b4b0' };
  if (!guided()) {
    $('plot-help').hidden = false;
    if (set.length < 2) return;
    const si = toSI(set), kqq = K * Math.abs(si[0].q * si[1].q), r = pairForce(si[0], si[1]).r;
    const curve = []; for (let x = 0.04; x <= 1.2; x += 0.005) curve.push([x, kqq / (x * x)]);
    const series = [];
    if (state.prevCurve && Math.abs(state.prevCurve - kqq) > 1e-12) { const g = []; for (let x = 0.04; x <= 1.2; x += 0.005) g.push([x, state.prevCurve / (x * x)]); series.push({ points: g, color: pal.ghost, dash: '5 4', width: 1.6, legend: 'before' }); }
    series.push({ points: curve, color: pal.a, legend: 'F = k|q₁q₂|/r²' });
    const markers = [];
    if (state.prevR) markers.push({ x: state.prevR.r, y: state.prevR.F, color: '#8a9a94', r: 3.5 });
    markers.push({ x: r, y: kqq / (r * r), color: pal.b, label: `${fN(kqq / (r * r))} N` });
    plot.title = 'Force between q₁ and q₂'; plot.xLabel = 'distance r (m)'; plot.yLabel = 'force F (N)';
    plot.render({ x: [0, 1.2], y: [0, state.plotMax], series, markers });
    return;
  }
  $('plot-help').hidden = true;
  const a = activity(), k = a.plot, uEnd = uNow(), started = !!state.prediction && state.t > 0;
  const samples = []; for (let i = 0; i <= 150; i++) { const u = (i / 150) * uEnd; samples.push({ u, set: toSI(chargesAt(u)) }); }
  if (!started) samples.length = 0;
  if (k.kind === 'force-r') {
    const si = toSI(a.charges), kqq = K * Math.abs(si[0].q * si[1].q), F0 = kqq / 0.04;
    plot.title = 'Force between q₁ and q₂'; plot.xLabel = 'distance r (m)'; plot.yLabel = 'force F (N)';
    const pts = samples.map(s => { const f = pairForce(s.set[0], s.set[1]); return [f.r, f.magnitude]; });
    const markers = pts.length ? [{ x: pts.at(-1)[0], y: pts.at(-1)[1], color: pal.b, label: `${fN(pts.at(-1)[1])} N` }] : [];
    if (pts.length) markers.unshift({ x: 0.2, y: F0, color: '#8a9a94', r: 3.5, label: `${fN(F0)} N` });
    plot.render({ x: [0.15, 0.45], y: [0, F0 * 1.15], series: [{ points: pts, color: pal.a, width: 2.6 }], markers, note: started ? '' : 'appears when you run' });
  } else if (k.kind === 'pair-both') {
    const F = pairForce(...toSI(a.charges)).magnitude;
    plot.title = 'Size of each force as q₂ moves round'; plot.xLabel = 'angle of q₂ around q₁ (°)'; plot.yLabel = 'force (N)';
    const on1 = samples.map(s => [s.u * 180, pairForce(s.set[0], s.set[1]).magnitude]), on2 = samples.map(s => [s.u * 180, pairForce(s.set[1], s.set[0]).magnitude]);
    plot.render({ x: [0, 180], y: [0, F * 1.6], series: [{ points: on1, color: pal.a, width: 3.2, legend: 'force on q₁ by q₂' }, { points: on2, color: pal.b, dash: '7 5', legend: 'force on q₂ by q₁' }], note: started ? '' : 'appears when you run' });
  } else if (k.kind === 'fx-x') {
    plot.title = 'Net force on q₃ along the line'; plot.xLabel = 'position of q₃, x (m)'; plot.yLabel = 'Fₓ on q₃ (N)';
    const fx = x => netForce(toSI(a.charges.map((c, i) => (i === 2 ? { ...c, x } : c))), 2).fx;
    const scan = []; for (let x = k.from; x <= k.to + 1e-9; x += 0.004) scan.push([x, fx(x)]);
    const seen = state.done ? scan : samples.filter(s => s.u <= 0.75).map(s => [s.set[2].x, fx(s.set[2].x)]);
    const q3 = current()[2], markers = started ? [{ x: q3.x, y: fx(q3.x), color: pal.b, label: `${fN(fx(q3.x))} N` }] : [];
    plot.render({ x: [k.from, k.to], y: [-3, 3], series: [{ points: seen, color: pal.a, width: 2.6 }], markers, note: started ? '' : 'appears when you run' });
  }
}

function render() {
  const set = current(), fs = forcesOf(set), sel = Math.min(state.selected, set.length - 1), shown = reveal();
  state.selected = sel;
  const a = guided() ? activity() : null;
  plane.render(toSI(set), shown ? fs : null, {
    selected: sel, scale: state.scale, showParts: $('show-parts').checked, showNet: $('show-net').checked, showComponents: $('show-comp').checked,
    line: a?.lockToLine ? { y: a.charges[0].y, from: a.charges[0].x, to: a.charges[1].x } : null,
  });
  plane.overlay(shown ? scaleBar() : '');
  // readouts for the selected charge
  const f = fs[sel], c = set[sel], dash = '–';
  $('r-name').textContent = `q${sub(sel + 1)} ${sgn(c.uC)} μC`;
  $('r-pos').textContent = `(${fM(c.x)}, ${fM(c.y)})`;
  $('r-F').textContent = shown ? fN(f.magnitude) : dash;
  $('r-Fx').textContent = shown ? fN(f.fx) : dash;
  $('r-Fy').textContent = shown ? fN(f.fy) : dash;
  $('r-dir').textContent = shown && f.magnitude > 1e-6 ? (Math.atan2(f.fy, f.fx) * 180 / Math.PI).toFixed(0).replace('-', '−') : dash;
  $('force-rows').replaceChildren(...set.map((q, i) => {
    const tr = document.createElement('tr'), F = fs[i];
    tr.innerHTML = `<th scope="row">q${sub(i + 1)} (${sgn(q.uC)} μC)</th><td><output>${shown ? fN(F.magnitude) : dash}</output></td><td>${shown ? fN(F.fx) : dash}</td><td>${shown ? fN(F.fy) : dash}</td>`;
    if (i === sel) tr.classList.add('e1-row-sel');
    return tr;
  }));
  // Coulomb's law with numbers (q₁ and q₂)
  const si = toSI(set), p12 = pairForce(si[0], si[1]);
  $('eq-values').textContent = shown ? `k·|(${sgn(set[0].uC)})(${sgn(set[1].uC)})| μC² / ${fM(p12.r)}² = ${fN(p12.magnitude)} N` : 'values shown after your prediction';
  $('r12-value').textContent = `${fM(p12.r)} m`;
  $('k-F').textContent = shown ? `F₁₂ = ${fN(p12.magnitude)} N` : '';
  $('k-n').textContent = `q${sub(sel + 1)} = ${sci(Math.abs(c.uC) * MICRO / E_CHARGE)} e`;
  $('c-r').textContent = `(${fM(si[0].x - si[1].x)}, ${fM(si[0].y - si[1].y)}) m, |r| = ${fM(p12.r)} m`;
  $('c-F').textContent = shown ? `(${fN(p12.fx)}, ${fN(p12.fy)}) N` : '–';
  // controls
  const free = !guided();
  for (const b of document.querySelectorAll('[data-count]')) { b.setAttribute('aria-pressed', String(+b.dataset.count === state.count)); b.disabled = !free; }
  const sb = $('select-buttons');
  if (sb.children.length !== set.length) sb.replaceChildren(...set.map((_, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = `q${sub(i + 1)}`; b.addEventListener('click', () => { state.selected = i; render(); }); return b; }));
  [...sb.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === sel)));
  $('charge-name').textContent = `q${sub(sel + 1)}`;
  $('charge').value = c.uC; $('charge-value').textContent = `${sgn(c.uC)} μC`;
  $('settings').disabled = !free;
  $('half-q').disabled = !free || Math.abs(c.uC) <= 0.5;
  $('double-q').disabled = !free || Math.abs(c.uC) > 5;
  // run controls
  const running = clock.running;
  $('start').hidden = free;
  $('start').disabled = running || state.done || !state.prediction;
  $('defaults').disabled = !free;
  $('run-status').textContent = free ? 'Live' : state.done ? 'Finished' : running ? 'Running' : state.t > 0 ? 'Paused' : 'Ready';
  $('run-message').textContent = free ? 'Drag a charge, or select it and use the arrow keys (Shift for bigger steps).'
    : !state.prediction ? 'Save a prediction above to unlock the experiment. The force arrows stay hidden until then.'
    : state.done ? (a.lockToLine ? 'Experiment complete. Now drag q₃ along the line yourself and find the balance point.' : 'Experiment complete. Read the results below.')
    : running ? 'Watch the arrows and the graph.' : 'Prediction saved. Run the experiment to test it.';
  renderPlot(set);
}

/* ---------- free-exploration actions ---------- */
function note(msg) { $('change-note').textContent = msg; }
function remember() { const si = toSI(current()); const p = pairForce(si[0], si[1]); state.prevR = { r: p.r, F: p.magnitude }; state.prevCurve = K * Math.abs(si[0].q * si[1].q); return p.magnitude; }
function reportChange(before, what) {
  const si = toSI(current()), after = pairForce(si[0], si[1]).magnitude;
  note(`${what}: F₁₂ went from ${fN(before)} N to ${fN(after)} N, ×${+(after / before).toFixed(3)}.`);
}
function scaleDistance(factor) {
  const s = state.slots, a = s[0], b = s[1], dx = b.x - a.x, dy = b.y - a.y;
  const x = Math.round((a.x + dx * factor) * 100) / 100, y = Math.round((a.y + dy * factor) * 100) / 100;
  if (x < 0.02 || x > 0.98 || y < 0.02 || y > 0.58) return note(`No room to ${factor > 1 ? 'double' : 'halve'} r there. Drag q₂ to a new spot first.`);
  if (Math.hypot(x - a.x, y - a.y) < MIN_SEP - 1e-9) return note('That would put the charges closer than 4 cm.');
  if (s.slice(2, state.count).some(c => Math.hypot(c.x - x, c.y - y) < MIN_SEP)) return note('Another charge is in the way. Move it first.');
  const before = remember();
  Object.assign(b, { x, y });
  reportChange(before, factor > 1 ? 'Doubled r' : 'Halved r');
  render();
}
function setCharge(i, uC, what) {
  const before = remember();
  state.slots[i].uC = uC;
  if (what && i <= 1) reportChange(before, what);
  else if (what) note(`${what}. F₁₂ is unchanged, but the net forces change.`);
  render();
}

/* ---------- guided ---------- */
const clock = new SimulationClock(() => {
  state.t = Math.min(state.t + STEP, activity().duration);
  if (state.t >= activity().duration - 1e-9) { state.done = true; clock.pause(); finish(); }
}, () => render());

for (const id of ACTIVITY_IDS) { const o = document.createElement('option'); o.value = id; o.textContent = `${id} — ${ACTIVITIES[id].title}`; $('guided-select').append(o); }
function setExperience(exp) {
  clock.reset();
  state.experience = exp;
  $('free-exploration').setAttribute('aria-pressed', String(exp === 'free'));
  $('guided-experiments').setAttribute('aria-pressed', String(exp === 'guided'));
  $('guided-intro').hidden = exp !== 'guided';
  hideResults();
  if (exp === 'guided') loadActivity(); else { state.selected = 0; rescale(); render(); }
}
function loadActivity() {
  const a = activity();
  $('guided-select').value = state.activity;
  $('guided-title').textContent = `${state.activity} — ${a.title}`;
  $('guided-objective').textContent = a.objective;
  $('guided-conditions').textContent = a.conditions;
  $('guided-question').textContent = a.question;
  $('guided-choices').replaceChildren(...a.choices.map(c => {
    const label = document.createElement('label'), input = document.createElement('input');
    Object.assign(input, { type: 'radio', name: 'guided-prediction', value: c.id, required: true });
    label.append(input, document.createTextNode(` ${c.id}. ${c.text}`));
    return label;
  }));
  resetGuided();
}
function resetGuided() {
  clock.reset();
  Object.assign(state, { prediction: null, t: 0, done: false, override: null, selected: activity().mover });
  for (const i of document.querySelectorAll('input[name=guided-prediction]')) { i.checked = false; i.disabled = false; }
  $('guided-prediction-status').textContent = 'Save a prediction to unlock the experiment.';
  $('reflection-answer').value = ''; $('model-answer-panel').hidden = true;
  hideResults();
  rescale(); render();
}
function hideResults() { $('guided-results').hidden = true; $('reflection-panel').hidden = true; }
function finish() {
  render();
  const a = activity(), fb = activityFeedback(state.activity, state.prediction);
  $('guided-verdict').textContent = `${fb.correct ? '✓ ' : ''}You predicted ${state.prediction}. ${fb.message}`;
  $('guided-verdict').classList.toggle('vf-verdict-wrong', !fb.correct);
  $('guided-sections').replaceChildren(...[['Learning objective', a.fullObjective], ['Observation', a.observation], ['Physics explanation', a.explanation], ['Key takeaway', a.takeaway]].map(([h, t]) => {
    const d = document.createElement('div'), h3 = document.createElement('h3'), p = document.createElement('p');
    h3.textContent = h; p.textContent = text(t); d.append(h3, p); return d;
  }));
  $('reflection-question').textContent = a.reflection;
  $('guided-results').hidden = false; $('reflection-panel').hidden = false;
  for (const i of document.querySelectorAll('input[name=guided-prediction]')) i.disabled = true;
}

/* ---------- calculus: charged rod ---------- */
const ROD_q = 2e-6;
function renderRod() {
  const Q = +$('rod-Q').value * MICRO, L = +$('rod-L').value, d = 10 ** +$('rod-d').value, n = +$('rod-n').value, p = { Q, L, q: ROD_q, d };
  $('rod-Q-v').textContent = `+${$('rod-Q').value} μC`; $('rod-L-v').textContent = `${L.toFixed(2)} m`;
  $('rod-d-v').textContent = `${d < 1 ? d.toFixed(3) : d.toFixed(2)} m`; $('rod-n-v').textContent = n;
  const ex = rodForceExact(p), sum = rodForceSlices(p, n), pt = rodForcePointLimit(p);
  $('rod-exact').textContent = `${fN(ex)} N`;
  $('rod-sum').textContent = `${fN(sum)} N (${((sum / ex - 1) * 100).toFixed(2)} %)`;
  $('rod-point').textContent = `${fN(pt)} N (${((pt / ex - 1) * 100).toFixed(2)} %)`;
  // schematic: rod is drawn 200 px; the gap is drawn on a log scale
  const x0 = 24, W = 200, gap = 18 + 22 * (Math.log10(d) + 2), cx = x0 + W + gap;
  let s = `<rect x="${x0}" y="34" width="${W}" height="14" rx="3" class="rod-body"/>`;
  if (n <= 40) for (let i = 1; i < n; i++) s += `<line x1="${x0 + (W * i) / n}" y1="34" x2="${x0 + (W * i) / n}" y2="48" class="rod-slice"/>`;
  for (let i = 0; i < Math.min(n, 40); i++) s += `<circle cx="${x0 + (W * (i + 0.5)) / Math.min(n, 40)}" cy="41" r="1.8" class="rod-dot"/>`;
  s += `<circle cx="${cx}" cy="41" r="9" fill="${COLORS.pos}"/><text x="${cx}" y="45.5" class="rod-sign">+</text><text x="${cx}" y="66" class="rod-lab">q = +2 μC</text>`;
  s += `<line x1="${x0 + W}" y1="70" x2="${cx}" y2="70" class="rod-dim"/><text x="${(x0 + W + cx) / 2}" y="82" class="rod-lab">d (log scale)</text><text x="${x0 + W / 2}" y="24" class="rod-lab">rod: Q spread evenly over L, ${n} slice${n > 1 ? 's' : ''}</text>`;
  $('rod').innerHTML = s;
  $('rod').setAttribute('aria-label', `Charged rod, length ${L.toFixed(2)} metres, charge ${$('rod-Q').value} microcoulombs, point charge ${d.toFixed(3)} metres from its end. Exact force ${fN(ex)} newtons.`);
}

/* ---------- charging: electroscope ---------- */
const ch = { method: 'friction', sign: -1, step: 0, answered: {} };
const steps = () => chargingSteps(ch.method, ch.sign);
function symbols(x, y, plus, minus, spread = 14, cols = 3, extra = '') {
  const all = [...Array(plus).fill('+'), ...Array(minus).fill('−')];
  return all.map((t, i) => { const r = Math.floor(i / cols), c = i % cols; return `<text x="${x + (c - (cols - 1) / 2) * spread}" y="${y + r * 13}" class="${t === '+' ? 'es-plus' : 'es-minus'}${extra}">${t}</text>`; }).join('');
}
function renderScope() {
  const all = steps(), st = all[ch.step], svg = $('scope'), isF = ch.method === 'friction';
  let s = '';
  if (isF) {
    const rub = st.rod.pos === 'rub', rodX = rub ? 120 : 60, clothX = rub ? 235 : 290;
    const rodPlus = 4, rodMinus = 4 - st.rod.excess, clothMinus = 4 - st.other.excess;
    s += `<rect x="${rodX}" y="120" width="170" height="34" rx="16" class="${ch.sign < 0 ? 'es-plastic' : 'es-glass'}"/><text x="${rodX + 85}" y="110" class="es-lab">${ch.sign < 0 ? 'plastic rod' : 'glass rod'}</text>`;
    s += symbols(rodX + 85, 136, rodPlus, rodMinus, 14, 6, ch.sign < 0 ? ' es-on-dark' : '');
    s += `<rect x="${clothX}" y="170" width="130" height="80" rx="10" class="es-cloth"/><text x="${clothX + 65}" y="266" class="es-lab">${ch.sign < 0 ? 'wool' : 'silk'}</text>`;
    s += symbols(clothX + 65, 195, 4, clothMinus, 16, 4);
    if (rub) s += `<path d="M${clothX + 10} 165 q 20 -12 40 0 t 40 0" class="es-rub"/><text x="${clothX + 65}" y="160" class="es-lab es-flow">↔ rubbing</text>`;
  } else {
    const kx = 300, ky = 70;
    s += `<rect x="220" y="140" width="160" height="140" rx="16" class="es-jar"/><line x1="${kx}" y1="${ky}" x2="${kx}" y2="175" class="es-stem"/><circle cx="${kx}" cy="${ky}" r="22" class="es-knob"/>`;
    s += symbols(kx, ky - 3, 2, st.scope.knob, 11, 3);
    const leaf = side => regionNet(st.scope, side), q = Math.abs(leaf('left')) + Math.abs(leaf('right')), th = Math.min(38, q * 9) * Math.PI / 180;
    for (const [side, dir] of [['left', -1], ['right', 1]]) {
      const x2 = kx + dir * Math.sin(th) * 80, y2 = 175 + Math.cos(th) * 80;
      s += `<line x1="${kx}" y1="175" x2="${x2}" y2="${y2}" class="es-leaf"/>`;
      s += symbols(kx + dir * Math.sin(th) * 45 + dir * 10, 175 + Math.cos(th) * 45 - 6, 2, st.scope[side], 10, 1);
    }
    s += `<text x="${kx}" y="296" class="es-lab">electroscope ${q ? '· leaves repel' : '· leaves hang together'}</text>`;
    // rod
    const tip = { away: 70, near: 252, touch: 279 }[st.rod.pos];
    s += `<rect x="${tip - 190}" y="${ky - 12}" width="190" height="24" rx="11" class="${ch.sign < 0 ? 'es-plastic' : 'es-glass'}"/>`;
    s += symbols(tip - 40, ky + 5, st.rod.excess > 0 ? st.rod.excess : 0, st.rod.excess < 0 ? -st.rod.excess : 0, 13, 4, ch.sign < 0 ? ' es-on-dark' : '');
    s += `<text x="${Math.max(60, tip - 95)}" y="${ky - 20}" class="es-lab">rod</text>`;
    if (st.other?.kind === 'ground') {
      const gx = 420, on = st.other.connected;
      s += `<path d="M${kx + 22} ${ky} H${gx} V${on ? 250 : 200}" class="es-wire${on ? '' : ' es-wire-off'}"/>${on ? '' : `<path d="M${gx} 214 V250" class="es-wire"/>`}`;
      s += `<path d="M${gx - 18} 250 h36 M${gx - 12} 257 h24 M${gx - 6} 264 h12" class="es-ground"/><text x="${gx}" y="282" class="es-lab">ground</text>`;
      if (st.other.excess) s += symbols(gx - 2, 232, st.other.excess > 0 ? st.other.excess : 0, st.other.excess < 0 ? -st.other.excess : 0, 11, 2);
      if (on) s += `<text x="${gx - 50}" y="${ky - 8}" class="es-lab es-flow">${ch.sign < 0 ? 'electrons → ground' : 'electrons ← ground'}</text>`;
    }
  }
  svg.innerHTML = s;
  svg.setAttribute('aria-label', `${st.label}. ${st.caption}`);
  $('step-caption').textContent = st.caption;
  const t = v => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');
  $('t-rod').textContent = t(st.net.rod);
  $('t-scope').textContent = isF ? '–' : t(st.net.scope);
  $('t-scope-label').textContent = isF ? 'Electroscope (not used)' : 'Electroscope';
  $('t-other-label').textContent = isF ? (ch.sign < 0 ? 'Wool' : 'Silk') : ch.method === 'induction' ? 'Ground' : 'Ground (not used)';
  $('t-other').textContent = ch.method === 'contact' ? '–' : t(st.net.other);
  $('t-total').textContent = t(st.net.total);
  $('step-list').replaceChildren(...all.map((x, i) => { const li = document.createElement('li'); li.textContent = x.label; if (i === ch.step) li.setAttribute('aria-current', 'step'); if (i < ch.step) li.classList.add('done'); return li; }));
  // prediction gate before a step that asks for one
  const next = all[ch.step + 1], key = `${ch.method}${ch.sign}${ch.step + 1}`, gate = next?.predict && !ch.answered[key];
  $('step-predict').hidden = !next?.predict;
  if (next?.predict) {
    $('step-predict-q').textContent = `Predict before the next step: ${next.predict.question}`;
    $('step-predict-choices').replaceChildren(...next.predict.choices.map(([v, label]) => {
      const l = document.createElement('label'), i = document.createElement('input');
      Object.assign(i, { type: 'radio', name: 'step-predict', value: v, checked: ch.answered[key] === v });
      i.addEventListener('change', () => { ch.answered[key] = v; renderScope(); });
      l.append(i, document.createTextNode(` ${label}`)); return l;
    }));
    const a = ch.answered[key];
    $('step-predict-fb').textContent = !a ? 'Choose an answer to continue.' : a === next.predict.correct ? '✓ Correct. Take the next step to see why.' : next.predict.feedback[a];
  }
  $('step-back').disabled = ch.step === 0;
  $('step-next').disabled = ch.step === all.length - 1 || !!gate;
}

/* ---------- events ---------- */
for (const b of document.querySelectorAll('[data-count]')) b.addEventListener('click', () => {
  state.count = +b.dataset.count; state.selected = Math.min(state.selected, state.count - 1); note('Use ×2 r or ×2 q and watch how the force changes.'); rescale(); render();
});
$('charge').addEventListener('input', () => {
  let v = +$('charge').value; const old = state.slots[state.selected].uC;
  if (v === 0) { v = old > 0 ? -0.5 : 0.5; $('charge').value = v; }
  setCharge(state.selected, v, '');
});
$('double-q').addEventListener('click', () => setCharge(state.selected, state.slots[state.selected].uC * 2, `Doubled q${sub(state.selected + 1)}`));
$('half-q').addEventListener('click', () => setCharge(state.selected, state.slots[state.selected].uC / 2, `Halved q${sub(state.selected + 1)}`));
$('flip-q').addEventListener('click', () => setCharge(state.selected, -state.slots[state.selected].uC, `Flipped the sign of q${sub(state.selected + 1)}`));
$('double-r').addEventListener('click', () => scaleDistance(2));
$('half-r').addEventListener('click', () => scaleDistance(0.5));
for (const id of ['show-parts', 'show-net', 'show-comp']) $(id).addEventListener('change', render);
$('rescale').addEventListener('click', () => { rescale(); render(); });
$('reset').addEventListener('click', () => { if (guided()) resetGuided(); else { state.prevR = state.prevCurve = null; note('Use ×2 r or ×2 q and watch how the force changes.'); rescale(); render(); } });
$('defaults').addEventListener('click', () => { state.slots = DEFAULT_SLOTS.map(c => ({ ...c })); state.count = 2; state.selected = 0; state.prevR = state.prevCurve = null; note('Use ×2 r or ×2 q and watch how the force changes.'); rescale(); render(); });
$('start').addEventListener('click', () => { if (state.prediction && !state.done) { clock.start(); render(); } });
$('free-exploration').addEventListener('click', () => { if (guided()) setExperience('free'); });
$('guided-experiments').addEventListener('click', () => { if (!guided()) setExperience('guided'); });
$('guided-select').addEventListener('change', () => { state.activity = $('guided-select').value; loadActivity(); });
$('guided-prediction-form').addEventListener('submit', e => {
  e.preventDefault();
  const choice = new FormData(e.currentTarget).get('guided-prediction');
  if (!choice) return;
  resetGuided();
  state.prediction = choice;
  for (const i of document.querySelectorAll('input[name=guided-prediction]')) i.checked = i.value === choice;
  $('guided-prediction-status').textContent = `Prediction ${choice} saved. Run the experiment to test it.`;
  render();
});
$('guided-choices').addEventListener('change', () => { if (state.prediction) { const keep = new FormData($('guided-prediction-form')).get('guided-prediction'); resetGuided(); for (const i of document.querySelectorAll('input[name=guided-prediction]')) i.checked = i.value === keep; $('guided-prediction-status').textContent = 'Save your updated prediction before running.'; } });
$('reflection-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!$('reflection-answer').value.trim()) return;
  $('model-answer').textContent = text(activity().modelAnswer); $('model-answer-panel').hidden = false;
});
$('math-on').addEventListener('change', () => { $('math-body').hidden = !$('math-on').checked; $('math-off').hidden = $('math-on').checked; });
for (const id of ['rod-Q', 'rod-L', 'rod-d', 'rod-n']) $(id).addEventListener('input', renderRod);
for (const b of document.querySelectorAll('[data-method]')) b.addEventListener('click', () => {
  ch.method = b.dataset.method; ch.step = 0; ch.answered = {};
  for (const x of document.querySelectorAll('[data-method]')) x.setAttribute('aria-pressed', String(x === b));
  renderScope();
});
for (const b of document.querySelectorAll('[data-sign]')) b.addEventListener('click', () => {
  ch.sign = +b.dataset.sign; ch.step = 0; ch.answered = {};
  for (const x of document.querySelectorAll('[data-sign]')) x.setAttribute('aria-pressed', String(x === b));
  renderScope();
});
$('step-next').addEventListener('click', () => { ch.step = Math.min(ch.step + 1, steps().length - 1); renderScope(); });
$('step-back').addEventListener('click', () => { ch.step = Math.max(ch.step - 1, 0); renderScope(); });

renderRod();
renderScope();
const params = new URLSearchParams(location.search);
if (params.get('activity') && ACTIVITIES[params.get('activity')]) { state.activity = params.get('activity'); setExperience('guided'); }
else { rescale(); render(); }
export { C3_ZERO_X };
