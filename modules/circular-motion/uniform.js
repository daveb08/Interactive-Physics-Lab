import { SimulationClock } from '../../js/core/clock.js';
import { STEP } from '../../js/core/physics.js';
import { CIRCLE_DEFAULTS, TABLE_RADIUS, circleQuantities, createCircularRun, sampleAt, sampleGrid } from '../../js/core/circular-physics.js';
import { CalcGraph } from '../../js/components/calc-graph.js';
import { ACTIVITIES, ACTIVITY_IDS, activityFeedback } from './activities.js';

const $ = id => document.getElementById(id);
const f2 = v => (Math.abs(v) < 5e-3 ? 0 : v).toFixed(2);
const vec = (x, y) => `(${f2(x)}, ${f2(y)})`;
const FREE_DURATION = 12;
const S = 75, CX = 280, CY = 260;                        // px per metre, pin position
const px = (x, y) => [CX + x * S, CY - y * S];
const C = { v: '#2d7fb8', a: '#b65b25', f: '#236d62', ghost: '#9aa7a2', path: '#c7d3cc' };

const state = { experience: 'free', settings: { ...CIRCLE_DEFAULTS }, activity: 'U1', prediction: null, t: 0, done: false, cutRequested: null };
let run, grid, ref = null, refGrid = null;
const clock = new SimulationClock(() => {
  state.t = Math.min(state.t + STEP, run.endTime);
  if (state.t >= run.endTime - 1e-9) { state.done = true; clock.pause(); finish(); }
}, () => render());

const graphs = {
  x: new CalcGraph($('g-x'), 'x', 'Position x, y', 'm', '#3c6cb2'),
  v: new CalcGraph($('g-v'), 'vx', 'Velocity vₓ, v_y', 'm/s', C.v),
  f: new CalcGraph($('g-f'), 'tension', 'String tension', 'N', C.f),
};

/* ---------- settings ---------- */
const CONTROLS = { mass: ['mass', 'kg'], radius: ['radius', 'm'], speed: ['speed', 'm/s'] };
function writeControls(s) {
  for (const [k, [id, unit]] of Object.entries(CONTROLS)) { $(id).value = s[k]; $(`${id}-value`).textContent = `${+(+s[k]).toFixed(2)} ${unit}`; }
}
function readControls() { return Object.fromEntries(Object.entries(CONTROLS).map(([k, [id]]) => [k, +$(id).value])); }
const guided = () => state.experience === 'guided';
const activity = () => ACTIVITIES[state.activity];

/* ---------- runs ---------- */
function rebuild() {
  clock.reset();
  state.t = 0; state.done = false; state.cutRequested = null;
  const s = guided() ? { ...activity().settings } : state.settings;
  writeControls(s);
  let cutAt = null, duration = FREE_DURATION;
  ref = refGrid = null;
  if (guided()) {
    const a = activity(), q = circleQuantities(s);
    if (a.cut) { cutAt = q.period * a.cut.afterRevolutions; duration = cutAt + 1.5; }
    else duration = 2 * Math.max(q.period, circleQuantities(a.reference.settings).period);
    if (a.reference) { ref = createCircularRun(a.reference.settings, { duration }); refGrid = sampleGrid(ref); }
  }
  run = createCircularRun(s, { cutAt, duration });
  grid = sampleGrid(run);
  setRanges();
  hideResults();
  render();
}
function setRanges() {
  const end = run.duration, v = run.speed, F = Math.max(run.force, ref?.force ?? 0);
  graphs.x.setRange([{ x: -TABLE_RADIUS }, { x: TABLE_RADIUS }], end);
  graphs.v.setRange([{ vx: -v }, { vx: v }], end);
  graphs.f.setRange([{ tension: 0 }, { tension: F }], end);
}
function cutNow() {
  if (run.cut || state.done) return;
  run = createCircularRun(state.settings, { cutAt: state.t, duration: FREE_DURATION });
  grid = sampleGrid(run);
  render();
}

/* ---------- drawing ---------- */
const arrow = (x1, y1, x2, y2, color, label, dash = '') => (Math.hypot(x2 - x1, y2 - y1) < 3 ? '' :
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="3.5" ${dash ? `stroke-dasharray="${dash}"` : ''} marker-end="url(#tip-${color.slice(1)})"/>`
  + (label ? `<text x="${x2 + (x2 - x1) * 0.12 + 4}" y="${y2 + (y2 - y1) * 0.12 + 4}" class="cm-vlabel" fill="${color}">${label}</text>` : ''));

function drawScene(s) {
  const show = id => $(id).checked;
  const marks = Object.values(C).map(c => `<marker id="tip-${c.slice(1)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`).join('');
  let h = `<defs>${marks}</defs>`;
  h += `<circle cx="${CX}" cy="${CY}" r="${TABLE_RADIUS * S}" class="cm-table"/>`;
  for (const [lab, x, y] of [['12', 0, 1], ['3', 1, 0], ['6', 0, -1], ['9', -1, 0]]) { const [X, Y] = px(x * (TABLE_RADIUS - 0.18), y * (TABLE_RADIUS - 0.18)); h += `<text x="${X}" y="${Y + 4}" class="cm-clock">${lab}</text>`; }
  h += `<circle cx="${CX}" cy="${CY}" r="${run.radius * S}" class="cm-path"/>`;
  if (ref) {
    const g = sampleAt(ref, Math.min(state.t, ref.endTime)), [gx, gy] = px(g.x, g.y);
    h += `<circle cx="${CX}" cy="${CY}" r="${ref.radius * S}" class="cm-path cm-ref"/>`;
    h += `<line x1="${CX}" y1="${CY}" x2="${gx}" y2="${gy}" class="cm-string cm-ref"/><circle cx="${gx}" cy="${gy}" r="11" class="cm-ghost"/>`;
    h += `<text x="${gx}" y="${gy - 18}" class="cm-ghost-label">${activity().reference.label}</text>`;
  }
  if (show('show-trail')) {
    const from = run.cut && s.t > run.cutAt ? Math.max(0, run.cutAt - 1) : Math.max(0, s.t - 1.2);
    const pts = []; for (let t = from; t <= s.t + 1e-9; t += 0.02) { const p = sampleAt(run, Math.min(t, s.t)); pts.push(px(p.x, p.y).map(n => n.toFixed(1)).join(',')); }
    if (pts.length > 1) h += `<polyline points="${pts.join(' ')}" class="cm-trail"/>`;
  }
  const [x, y] = px(s.x, s.y);
  if (s.attached) h += `<line x1="${CX}" y1="${CY}" x2="${x}" y2="${y}" class="cm-string"/>`;
  else { const [cx2, cy2] = px(run.cut.x * 0.18, run.cut.y * 0.18); h += `<path d="M${CX} ${CY} Q ${CX + 10} ${CY + 14} ${cx2} ${cy2}" class="cm-string cm-slack"/><text x="${CX}" y="${CY + 34}" class="cm-ghost-label">string cut</text>`; }
  h += `<circle cx="${CX}" cy="${CY}" r="5" class="cm-pin"/>`;
  // vectors
  const r = Math.hypot(s.x, s.y) || 1, ux = -s.x / r, uy = -s.y / r;      // toward the pin
  if (show('show-v')) h += arrow(x, y, x + s.vx * 22, y - s.vy * 22, C.v, 'v');
  if (s.attached) {
    const la = Math.min(120, 26 + 12 * Math.sqrt(run.accel)), lf = Math.min(120, 30 + 14 * Math.sqrt(run.force));
    const ox = -uy * 9, oy = ux * 9;                                       // offset a beside F
    if (show('show-f')) h += arrow(x, y, x + ux * lf, y - uy * lf, C.f, 'F');
    if (show('show-a')) h += arrow(x + ox, y - oy, x + ox + ux * la, y - oy - uy * la, C.a, 'a', '6 3');
  } else if (show('show-f') || show('show-a')) h += `<text x="${x + 16}" y="${y + 22}" class="cm-vlabel" fill="${C.f}">F = 0, a = 0</text>`;
  h += `<circle cx="${x}" cy="${y}" r="12" class="cm-puck"/><text x="${x}" y="${y + 4}" class="cm-mass">${+run.mass.toFixed(2)}</text>`;
  $('scene').innerHTML = h;
  $('scene').setAttribute('aria-label', `Top view. Puck at x ${f2(s.x)} m, y ${f2(s.y)} m, speed ${f2(Math.hypot(s.vx, s.vy))} m/s. ${s.attached ? `String tension ${f2(run.force)} N toward the pin.` : 'String cut: no horizontal force.'}`);
}

function render() {
  const s = sampleAt(run, Math.min(state.t, run.endTime));
  drawScene(s);
  const hide = guided() && !state.prediction;
  const q = run, dash = '–';
  $('r-t').textContent = f2(s.t);
  $('r-v').textContent = f2(Math.hypot(s.vx, s.vy));
  $('r-T').textContent = hide ? dash : s.attached ? f2(q.period) : dash;
  $('r-a').textContent = hide ? dash : f2(Math.hypot(s.ax, s.ay));
  $('r-F').textContent = hide ? dash : f2(s.tension);
  $('r-w').textContent = hide ? dash : s.attached ? f2(q.omega) : dash;
  $('eq-values').textContent = hide ? 'values shown after your prediction' : `${+q.mass.toFixed(2)} × ${+q.speed.toFixed(2)}² / ${+q.radius.toFixed(2)} = ${f2(q.force)} N`;
  $('k-T').textContent = hide ? '' : `${f2(q.period)} s`; $('k-w').textContent = hide ? '' : `${f2(q.omega)} rad/s`;
  $('k-a').textContent = hide ? '' : `${f2(q.accel)} m/s²`; $('k-F').textContent = hide ? '' : `${f2(q.force)} N`;
  // calculus panel
  $('c-r').textContent = `${vec(s.x, s.y)} m`; $('c-v').textContent = `${vec(s.vx, s.vy)} m/s`;
  $('c-dot').textContent = `${f2(s.x * s.vx + s.y * s.vy)} m²/s`; $('c-a').textContent = `${vec(s.ax, s.ay)} m/s²`;
  $('c-w2r').textContent = s.attached ? `${vec(-(q.omega ** 2) * s.x, -(q.omega ** 2) * s.y)} m/s²` : 'string cut: a = 0';
  // graphs
  const observed = grid.filter(p => p.t <= state.t + 1e-9);
  const seen = observed.length ? observed : [grid[0]];
  const refSeen = refGrid ? refGrid.filter(p => p.t <= state.t + 1e-9) : [];
  const markers = run.cut && state.t >= run.cutAt ? [{ t: run.cutAt, label: 'cut' }] : [];
  graphs.x.render({ samples: seen, overlays: [{ data: seen, key: 'y', color: '#3c6cb2', dash: '5 3', legend: 'y' }], markers });
  graphs.v.render({ samples: seen, overlays: [{ data: seen, key: 'vy', color: C.v, dash: '5 3', legend: 'v_y' }], markers });
  graphs.f.render({ samples: seen, overlays: refSeen.length > 1 ? [{ data: refSeen, color: C.ghost, dash: '6 4', legend: activity().reference.label }] : [], markers });
  // status
  const running = clock.running;
  $('start').disabled = running || state.done || (guided() && !state.prediction);
  $('pause').disabled = !running;
  $('cut').disabled = guided() || !!run.cut || state.done || state.t === 0;
  $('settings').disabled = running || state.t > 0 || guided();
  $('defaults').disabled = running || guided();
  $('run-status').textContent = state.done ? 'Finished' : running ? 'Running' : state.t > 0 ? 'Paused' : 'Ready';
  $('run-message').textContent = guided() && !state.prediction ? 'Save a prediction above to unlock the experiment.'
    : state.done ? (run.cut ? 'The puck left the table in a straight line along the tangent.' : 'Run complete. Reset to run again.')
    : run.cut && state.t >= run.cutAt ? 'String cut: no horizontal force acts now.'
    : !guided() && running ? 'Press ✂ Cut the string at any moment and watch the path.' : guided() ? 'Prediction saved. Start the experiment to test it.' : '';
}

/* ---------- guided ---------- */
for (const id of ACTIVITY_IDS) { const o = document.createElement('option'); o.value = id; o.textContent = `${id} — ${ACTIVITIES[id].title}`; $('guided-select').append(o); }
function setExperience(exp) {
  state.experience = exp;
  $('free-exploration').setAttribute('aria-pressed', String(exp === 'free'));
  $('guided-experiments').setAttribute('aria-pressed', String(exp === 'guided'));
  $('guided-intro').hidden = exp !== 'guided';
  if (exp === 'guided') loadActivity(); else rebuild();
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
  state.prediction = null;
  for (const i of document.querySelectorAll('input[name=guided-prediction]')) { i.checked = false; i.disabled = false; }
  $('guided-prediction-status').textContent = 'Save a prediction to unlock the experiment.';
  $('reflection-answer').value = ''; $('model-answer-panel').hidden = true;
  rebuild();
}
function hideResults() { $('guided-results').hidden = true; $('reflection-panel').hidden = true; }
function finish() {
  render();
  if (!guided()) return;
  const a = activity(), fb = activityFeedback(state.activity, state.prediction);
  $('guided-verdict').textContent = `${fb.correct ? '✓ ' : ''}You predicted ${state.prediction}. ${fb.message}`;
  $('guided-verdict').classList.toggle('vf-verdict-wrong', !fb.correct);
  $('guided-sections').replaceChildren(...[['Learning objective', a.fullObjective], ['Observation', a.observation], ['Physics explanation', a.explanation], ['Key takeaway', a.takeaway]].map(([h, t]) => {
    const d = document.createElement('div'), h3 = document.createElement('h3'), p = document.createElement('p');
    h3.textContent = h; p.textContent = t; d.append(h3, p); return d;
  }));
  $('reflection-question').textContent = a.reflection;
  $('guided-results').hidden = false; $('reflection-panel').hidden = false;
  for (const i of document.querySelectorAll('input[name=guided-prediction]')) i.disabled = true;
}

/* ---------- events ---------- */
for (const [k, [id, unit]] of Object.entries(CONTROLS)) $(id).addEventListener('input', () => {
  state.settings = readControls(); $(`${id}-value`).textContent = `${+(+$(id).value).toFixed(2)} ${unit}`; rebuild();
});
for (const id of ['show-v', 'show-a', 'show-f', 'show-trail']) $(id).addEventListener('change', render);
$('math-on').addEventListener('change', () => { $('math-body').hidden = !$('math-on').checked; $('math-off').hidden = $('math-on').checked; });
$('start').addEventListener('click', () => { clock.start(); render(); });
$('pause').addEventListener('click', () => { clock.pause(); render(); });
$('cut').addEventListener('click', cutNow);
$('reset').addEventListener('click', () => (guided() ? resetGuided() : rebuild()));
$('defaults').addEventListener('click', () => { state.settings = { ...CIRCLE_DEFAULTS }; rebuild(); });
$('free-exploration').addEventListener('click', () => { if (guided()) setExperience('free'); });
$('guided-experiments').addEventListener('click', () => { if (!guided()) setExperience('guided'); });
$('guided-select').addEventListener('change', () => { state.activity = $('guided-select').value; loadActivity(); });
$('guided-prediction-form').addEventListener('submit', e => {
  e.preventDefault();
  const choice = new FormData(e.currentTarget).get('guided-prediction');
  if (!choice) return;
  rebuild();
  state.prediction = choice;
  for (const i of document.querySelectorAll('input[name=guided-prediction]')) i.checked = i.value === choice;
  $('guided-prediction-status').textContent = `Prediction ${choice} saved. Start the experiment to test it.`;
  render();
});
$('guided-choices').addEventListener('change', () => { if (state.prediction) { state.prediction = null; $('guided-prediction-status').textContent = 'Save your updated prediction before starting.'; rebuild(); } });
$('reflection-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!$('reflection-answer').value.trim()) return;
  $('model-answer').textContent = activity().modelAnswer; $('model-answer-panel').hidden = false;
});
document.addEventListener('keydown', e => { if (e.key === 'c' && !e.target.closest('input,textarea,select') && !$('cut').disabled) cutNow(); });

const params = new URLSearchParams(location.search);
if (params.get('activity') && ACTIVITIES[params.get('activity')]) { state.activity = params.get('activity'); setExperience('guided'); }
else rebuild();
