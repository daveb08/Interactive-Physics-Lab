import { initGraphResizer } from '../../js/components/column-resizer.js';
import { SimulationClock } from '../../js/core/clock.js';
import { createDragModel, DRAG_DEFAULTS } from '../../js/core/drag-physics.js';
import { createOscillatorModel, OSC_DEFAULTS, criticalDamping } from '../../js/core/oscillator-physics.js';
import { createVariableRun, stepVariableRun, sampleGrid } from '../../js/core/variable-run.js';
import { integrate } from '../../js/core/integrators.js';
import { CalcGraph, LogGraph, METHOD_STYLES } from '../../js/components/calc-graph.js';
import { buildCsv, downloadCsv } from '../../js/components/csv-export.js';
import { DragScene, OscillatorScene } from './scenes.js';
import { ACTIVITIES, ACTIVITY_IDS, activitySettings, activityFeedback } from './activities.js';

const $ = id => document.getElementById(id);
const f2 = v => (Math.abs(v) < 5e-3 ? 0 : v).toFixed(2);
const f3 = v => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3);
const REGIME_TEXT = { undamped: 'undamped', underdamped: 'underdamped', critical: 'critically damped', overdamped: 'overdamped' };

const state = {
  scenario: 'drag', experience: 'free',
  free: { drag: { ...DRAG_DEFAULTS }, oscillator: { ...OSC_DEFAULTS } },
  activity: 'V1', prediction: null,
  methods: new Set(), h: 0.1, scrub: null,
};
let model, full, run, numeric = {}, references = [];

const graphs = {
  x: new CalcGraph($('g-x'), 'x', 'Position x', 'm', '#3c6cb2'),
  v: new CalcGraph($('g-v'), 'v', 'Velocity v', 'm/s', '#236d62'),
  a: new CalcGraph($('g-a'), 'a', 'Acceleration a', 'm/s²', '#b65b25'),
};
const errGraph = new LogGraph($('g-err'), '|x_numerical − x_exact|', 'm');
const energyGraph = new LogGraph($('g-energy'), 'Total energy', 'J');
let scene;

/* ---------- settings <-> controls ---------- */
const DRAG_CONTROLS = { mass: ['d-mass', 'kg'], force: ['d-force', 'N'], v0: ['d-v0', 'm/s'], b: ['d-b', 'kg/s'], c: ['d-c', 'kg/m'] };
const OSC_CONTROLS = { mass: ['o-mass', 'kg'], k: ['o-k', 'N/m'], b: ['o-b', 'kg/s'], x0: ['o-x0', 'm'], v0: ['o-v0', 'm/s'] };
const controlsFor = s => s === 'drag' ? DRAG_CONTROLS : OSC_CONTROLS;

function writeControls(settings) {
  for (const [key, [id, unit]] of Object.entries(controlsFor(state.scenario))) {
    if (settings[key] === undefined) continue;
    $(id).value = settings[key];
    $(`${id}-value`).textContent = `${+(+settings[key]).toFixed(2)} ${unit}`;
  }
  if (state.experience === 'guided' && !state.prediction && ACTIVITIES[state.activity].choiceSettings) $('o-b-value').textContent = 'your choice';
  if (state.scenario === 'drag') {
    $('drag-law').value = settings.law;
    $('d-b-control').hidden = settings.law !== 'linear';
    $('d-c-control').hidden = settings.law !== 'quadratic';
  }
}
function readControls() {
  const s = {};
  for (const [key, [id]] of Object.entries(controlsFor(state.scenario))) s[key] = +$(id).value;
  if (state.scenario === 'drag') s.law = $('drag-law').value;
  return s;
}

/* ---------- building a run ---------- */
function currentSettings() {
  if (state.experience === 'guided') {
    const a = ACTIVITIES[state.activity];
    return state.prediction ? activitySettings(state.activity, state.prediction) : { ...a.settings };
  }
  return state.free[state.scenario];
}
const makeModel = (scenario, settings) => scenario === 'drag' ? createDragModel(settings) : createOscillatorModel(settings);

function rebuild() {
  clock.reset();
  const settings = currentSettings();
  writeControls(settings);
  model = makeModel(state.scenario, settings);
  full = sampleGrid(model, 0.01);
  run = createVariableRun(model);
  state.scrub = null;
  for (const k of ['x', 'v', 'a']) graphs[k].setRange(full, model.endTime);
  scene.setModel(model, full);
  computeNumeric();
  references = [];
  describeModel();
  setRunning(false);
  $('start').textContent = '▶ Start';
  updateStartGate();
  hideResults();
  render();
}

function computeNumeric() {
  numeric = {};
  for (const m of state.methods) numeric[m] = integrate(m, model.deriv, model.initial, state.h, model.endTime);
}

function referencesForActivity() {
  const a = ACTIVITIES[state.activity];
  const colors = ['#8a978e', '#c24c2a', '#7851a9'];
  if (a.reference) return [{ data: sampleGrid(makeModel(a.scenario, a.reference.settings), 0.02), color: '#8a978e', dash: '6 4', legend: a.reference.label }];
  if (a.compare) return a.compare.filter(b => b !== model.b).map((b, i) => ({ data: sampleGrid(makeModel(a.scenario, { ...a.settings, b }), 0.02), color: colors[i + 1], dash: '6 4', legend: `b = ${b}` }));
  return [];
}

/* ---------- text about the model ---------- */
function describeModel() {
  const guidedHidden = state.experience === 'guided' && !run.done;
  let params = [];
  if (model.kind === 'drag') {
    const lin = model.law === 'linear', coef = lin ? `b = ${model.coef} kg/s` : `c = ${model.coef} kg/m`;
    $('ode-short').textContent = lin ? 'm v′ = F − b v' : 'm v′ = F − c v²';
    $('ode-params').textContent = `m = ${model.mass} kg · F = ${model.force} N · ${coef}`;
    $('math-ode').textContent = lin ? `${model.mass} dv/dt = ${model.force} − ${model.coef} v` : `${model.mass} dv/dt = ${model.force} − ${model.coef} v²`;
    if (lin) $('math-solution').textContent = `v(t) = ${f3(model.vT)} + (${f3(model.v0)} − ${f3(model.vT)}) e^(−t/${f3(model.tau)})   [v_T = F/b, τ = m/b]`;
    else if (model.force === 0) $('math-solution').textContent = `v(t) = v₀ / (1 + c v₀ t / m) = ${model.v0} / (1 + ${f3(model.coef * model.v0 / model.mass)} t)`;
    else if (Math.abs(model.v0 - model.vT) < 1e-9 * Math.max(1, model.vT)) $('math-solution').textContent = `v(t) = v_T = ${f3(model.vT)} m/s for all t: the push and the drag balance from the start   [v_T = √(F/c)]`;
    else {
      // v₀ below v_T: v = v_T tanh(t/τ + φ), φ = artanh(v₀/v_T); above: v = v_T coth(t/τ + φ), φ = artanh(v_T/v₀) (QA-02)
      const below = model.v0 < model.vT, phi = Math.atanh(below ? model.v0 / model.vT : model.vT / model.v0);
      $('math-solution').textContent = `v(t) = ${f3(model.vT)} ${below ? 'tanh' : 'coth'}(t/${f3(model.tau)} + φ),  φ = ${below ? 'artanh(v₀/v_T)' : 'artanh(v_T/v₀)'} = ${f3(phi)}   [v_T = √(F/c), τ = m/(c v_T)]`;
    }
    if (!guidedHidden && model.force > 0) params.push(['Terminal speed v_T', `${f3(model.vT)} m/s`]);
    if (!guidedHidden && Number.isFinite(model.tau)) params.push(['Time constant τ', `${f3(model.tau)} s`]);
    $('model-note').textContent = `Applied force constant at ${model.force} N; drag ${lin ? 'proportional to v' : 'proportional to v²'} and opposite the motion. ${model.reason === 'boundary' ? `The cart reaches x = 50 m at t = ${f3(model.endTime)} s, where observation ends.` : 'Observation lasts 10 s.'}`;
    $('energy').hidden = true; $('g-energy').toggleAttribute('hidden', true);
  } else {
    $('ode-short').textContent = 'm x″ + b x′ + k x = 0';
    $('ode-params').textContent = `m = ${model.mass} kg · b = ${model.b} kg/s · k = ${model.k} N/m`;
    $('math-ode').textContent = `${model.mass} x″ + ${model.b} x′ + ${model.k} x = 0,   x(0) = ${model.x0} m,  v(0) = ${model.v0} m/s`;
    const g = f3(model.gamma), x0 = model.x0, v0 = model.v0, ga = model.gamma, w0 = model.w0;
    // The constants are fixed by x(0) = x₀ and x′(0) = v₀; show how, with their values (QA-03).
    const wd = w0 * Math.sqrt(Math.max(0, 1 - model.zeta ** 2)), s = w0 * Math.sqrt(Math.max(0, model.zeta ** 2 - 1)), r1 = -ga + s, r2 = -ga - s;
    const C1 = (v0 - r2 * x0) / (r1 - r2), C2 = x0 - C1;
    $('math-solution').textContent = {
      undamped: `x(t) = A cos(${f3(w0)} t) + B sin(${f3(w0)} t),  where A = x₀ = ${f3(x0)} m and B = v₀/ω₀ = ${f3(v0 / w0)} m`,
      underdamped: `x(t) = e^(−${g} t)[A cos(ω_d t) + B sin(ω_d t)],  ω_d = ${f3(wd)} s⁻¹,  where A = x₀ = ${f3(x0)} m and B = (v₀ + γx₀)/ω_d = ${f3((v0 + ga * x0) / wd)} m  (γ = b/2m = ${g} s⁻¹)`,
      critical: `x(t) = (A + B t) e^(−${f3(w0)} t),  where A = x₀ = ${f3(x0)} m and B = v₀ + ω₀x₀ = ${f3(v0 + w0 * x0)} m/s`,
      overdamped: `x(t) = C₁ e^(r₁ t) + C₂ e^(r₂ t),  r₁, r₂ = −${g} ± ${f3(s)} s⁻¹,  where C₁ = (v₀ − r₂x₀)/(r₁ − r₂) = ${f3(C1)} m and C₂ = x₀ − C₁ = ${f3(C2)} m`,
    }[model.regime];
    params = [['ω₀ = √(k/m)', `${f3(model.w0)} s⁻¹`]];
    if (!guidedHidden) params.push(['ζ = b/(2√(km))', f3(model.zeta)], ['Regime', REGIME_TEXT[model.regime]], ['b for ζ = 1', `${f3(model.bCritical)} kg/s`]);
    if (guidedHidden) $('math-solution').textContent = 'The solution and damping regime are revealed after the run.';
    $('model-note').textContent = 'Ideal massless spring and linear damper; frictionless floor. The damper removes energy at the rate b v². Observation lasts 20 s.';
    $('energy').hidden = false; $('g-energy').toggleAttribute('hidden', false);
    $('e0').textContent = f3(model.e0);
  }
  $('params').replaceChildren(...params.map(([k, v]) => { const d = document.createElement('div'); const dt = document.createElement('dt'); const dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; d.append(dt, dd); return d; }));
}

/* ---------- rendering ---------- */
function mathTime() {
  const t = state.scrub ?? run.state.t;
  return Math.min(t, run.state.t);
}
function trapezoid(samples, key, tEnd) {
  let sum = 0;
  for (let i = 1; i < samples.length && samples[i].t <= tEnd + 1e-12; i++) sum += (samples[i].t - samples[i - 1].t) * (samples[i][key] + samples[i - 1][key]) / 2;
  return sum;
}

function render() {
  const s = run.state, done = run.done;
  scene.render(s);
  $('r-t').textContent = s.t.toFixed(2); $('r-x').textContent = f2(s.x); $('r-v').textContent = f2(s.v); $('r-a').textContent = f2(s.a);
  if (model.kind === 'oscillator') {
    const pct = v => `${Math.max(0, v / (model.e0 || 1) * 100)}%`;
    const bar = $('energy-bar').children;
    bar[0].style.width = pct(s.ke); bar[1].style.width = pct(s.pe); bar[2].style.width = pct(s.dissipated);
    $('e-ke').textContent = f3(s.ke); $('e-pe').textContent = f3(s.pe); $('e-lost').textContent = f3(s.dissipated);
    $('energy-bar').setAttribute('aria-label', `Kinetic ${f3(s.ke)} J, spring ${f3(s.pe)} J, removed by damper ${f3(s.dissipated)} J`);
  }

  const showMath = $('math-on').checked, tm = mathTime();
  const observed = run.samples;
  const inWindow = observed.filter(p => p.t <= tm + 1e-12);
  const methodOverlays = key => [...state.methods].map(m => ({ data: numeric[m].filter(p => p.t <= s.t + 1e-9), key, color: METHOD_STYLES[m].color, dash: METHOD_STYLES[m].dash, legend: METHOD_STYLES[m].label }));
  const refOverlays = done ? references : [];
  const hide = state.experience === 'guided' && !done;
  const hlines = model.kind === 'drag' && model.force > 0 && !hide ? [{ value: model.vT, label: `v_T = ${f2(model.vT)} m/s` }] : [];
  const markers = model.kind === 'drag' && Number.isFinite(model.tau) && model.tau < model.endTime && model.force > 0 && !hide ? [{ t: model.tau, label: 't = τ' }] : [];
  const dt = 1e-4, at = t => model.at(Math.max(0, Math.min(model.endTime, t)));
  const slope = key => (at(tm + dt)[key] - at(tm - dt)[key]) / ((Math.min(model.endTime, tm + dt)) - Math.max(0, tm - dt));
  const p = model.at(tm);
  graphs.x.render({ samples: observed, overlays: [...refOverlays.map(r => ({ ...r, key: 'x' })), ...methodOverlays('x')], tangent: showMath ? { t: tm, value: p.x, slope: slope('x') } : null });
  graphs.v.render({ samples: observed, overlays: [...refOverlays.map(r => ({ ...r, key: 'v' })), ...methodOverlays('v')], tangent: showMath ? { t: tm, value: p.v, slope: slope('v') } : null, area: showMath ? { data: inWindow } : null, hlines, markers });
  graphs.a.render({ samples: observed, overlays: refOverlays.map(r => ({ ...r, key: 'a' })), area: showMath ? { data: inWindow } : null });

  $('math-body').hidden = !showMath;
  if (showMath) {
    $('scrub').max = String(Math.max(s.t, 1e-3)); $('scrub').value = String(tm);
    $('scrub-value').textContent = `${tm.toFixed(2)} s`;
    $('m-slope-x').textContent = f3(slope('x')); $('m-v').textContent = f3(p.v);
    $('m-slope-v').textContent = f3(slope('v')); $('m-a').textContent = f3(p.a);
    $('m-area-v').textContent = f3(trapezoid(observed, 'v', tm)); $('m-dx').textContent = f3(p.x - model.at(0).x);
    $('m-area-a').textContent = f3(trapezoid(observed, 'a', tm)); $('m-dv').textContent = f3(p.v - model.at(0).v);
  }
  renderNumericPlots();
  const status = done ? 'Complete' : clock.running ? 'Running' : s.t > 0 ? 'Paused' : 'Ready';
  $('run-status').textContent = status;
}

let numericKey = '';
function renderNumericPlots() {
  const key = `${model.kind}|${[...state.methods].join()}|${state.h}|${JSON.stringify(currentSettings())}|${state.prediction}`;
  if (key === numericKey) return;
  numericKey = key;
  const series = [...state.methods].map(m => ({ label: METHOD_STYLES[m].label, color: METHOD_STYLES[m].color, dash: METHOD_STYLES[m].dash, data: numeric[m].map(p => ({ t: p.t, value: Math.abs(p.x - model.at(p.t).x) })) }));
  errGraph.render(series, model.endTime);
  if (model.kind === 'oscillator') {
    const exact = { label: 'Exact', color: '#236d62', data: full.filter((_, i) => i % 5 === 0).map(p => ({ t: p.t, value: p.e })) };
    energyGraph.render([exact, ...[...state.methods].map(m => ({ label: METHOD_STYLES[m].label, color: METHOD_STYLES[m].color, dash: METHOD_STYLES[m].dash, data: numeric[m].map(p => ({ t: p.t, value: model.energy([p.x, p.v]) })) }))], model.endTime, { floor: 1e-9 });
  }
}

/* ---------- transport ---------- */
const clock = new SimulationClock(() => {
  stepVariableRun(run);
  if (run.done) finish();
}, () => render());

function setRunning(running) {
  $('pause').disabled = !running;
  for (const id of ['drag-settings', 'osc-settings']) $(id).disabled = running || run.state.t > 0 || state.experience === 'guided';
  $('set-critical').disabled = $('osc-settings').disabled;
  $('defaults').disabled = running || state.experience === 'guided';
}
function updateStartGate() {
  const needPrediction = state.experience === 'guided' && !state.prediction;
  $('start').disabled = run.done || needPrediction;
  $('run-message').textContent = run.done ? 'Run complete. Reset to run again.'
    : needPrediction ? 'Save a prediction above to unlock the experiment.'
    : run.state.t > 0 ? 'Paused. Drag the t* slider in Show the math to inspect any observed time.'
    : state.experience === 'guided' ? 'Prediction saved. Start the experiment to test it.'
    : 'Adjust the controls, then start. Turn on numerical methods to compare them with the exact solution.';
}
function finish() {
  clock.pause();
  setRunning(false);
  $('start').textContent = '▶ Start';
  updateStartGate();
  if (state.experience === 'guided') { references = referencesForActivity(); describeModel(); showResults(); }
  render();
}

$('start').addEventListener('click', () => {
  if (run.done) return;
  state.scrub = null;
  clock.start(); setRunning(true);
  $('start').disabled = true;
  $('run-message').textContent = 'Running…';
});
$('pause').addEventListener('click', () => {
  clock.pause(); setRunning(false);
  $('start').textContent = '▶ Resume';
  updateStartGate(); render();
});
$('reset').addEventListener('click', () => { if (state.experience === 'guided') resetGuidedResponses(); rebuild(); });
$('defaults').addEventListener('click', () => {
  state.free[state.scenario] = state.scenario === 'drag' ? { ...DRAG_DEFAULTS } : { ...OSC_DEFAULTS };
  rebuild();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && clock.running) $('pause').click(); });

/* ---------- controls ---------- */
for (const scenario of ['drag', 'oscillator']) {
  const fs = $(scenario === 'drag' ? 'drag-settings' : 'osc-settings');
  fs.addEventListener('input', () => {
    if (state.experience !== 'free' || state.scenario !== scenario) return;
    state.free[scenario] = { ...state.free[scenario], ...readControls() };
    rebuild();
  });
}
$('set-critical').addEventListener('click', () => {
  const s = state.free.oscillator, bc = criticalDamping(s.mass, s.k);
  // Check the limit before storing: a rejected value must not be left in the settings (QA-05).
  if (bc > 20) { $('run-message').textContent = `Critical damping would need b = ${f2(bc)} kg/s, above the 20 kg/s limit. Lower m or k.`; return; }
  state.free.oscillator = { ...s, b: +bc.toFixed(4) };
  rebuild();
});

function setScenario(scenario) {
  state.scenario = scenario;
  $('scenario-drag').setAttribute('aria-pressed', String(scenario === 'drag'));
  $('scenario-oscillator').setAttribute('aria-pressed', String(scenario === 'oscillator'));
  $('drag-settings').hidden = scenario !== 'drag';
  $('osc-settings').hidden = scenario !== 'oscillator';
  scene = scenario === 'drag' ? new DragScene($('scene')) : new OscillatorScene($('scene'));
  $('simulation-title').textContent = scenario === 'drag' ? 'Cart with drag' : 'Cart on a spring with a damper';
}
$('scenario-drag').addEventListener('click', () => { if (state.experience === 'guided') return; setScenario('drag'); rebuild(); });
$('scenario-oscillator').addEventListener('click', () => { if (state.experience === 'guided') return; setScenario('oscillator'); rebuild(); });

$('math-on').addEventListener('change', render);
$('scrub').addEventListener('input', () => { state.scrub = +$('scrub').value; if (!clock.running) render(); });
$('method-fields').addEventListener('change', () => {
  state.methods = new Set([...document.querySelectorAll('input[name=method]:checked')].map(i => i.value));
  computeNumeric(); render();
});
$('step-size').addEventListener('change', () => { state.h = +$('step-size').value; computeNumeric(); render(); });
function syncMethodInputs() {
  for (const i of document.querySelectorAll('input[name=method]')) i.checked = state.methods.has(i.value);
  $('step-size').value = String(state.h);
}

$('csv').addEventListener('click', () => {
  const cols = model.kind === 'drag'
    ? [['t', 's'], ['x', 'm'], ['v', 'm/s'], ['a', 'm/s²'], ['fApplied', 'N', 'F_applied'], ['fDrag', 'N', 'F_drag'], ['ke', 'J', 'KE']]
    : [['t', 's'], ['x', 'm'], ['v', 'm/s'], ['a', 'm/s²'], ['fSpring', 'N', 'F_spring'], ['fDamping', 'N', 'F_damping'], ['ke', 'J', 'KE'], ['pe', 'J', 'PE'], ['e', 'J', 'E_total'], ['dissipated', 'J', 'E_dissipated']];
  const extra = [];
  for (const m of state.methods) {
    const xs = new Array(full.length).fill(null), vs = new Array(full.length).fill(null);
    for (const p of numeric[m]) { const i = Math.round(p.t / 0.01); if (i < full.length && Math.abs(full[i].t - p.t) < 1e-9) { xs[i] = p.x; vs[i] = p.v; } }
    extra.push({ column: { label: `x_${m}`, unit: 'm' }, values: xs }, { column: { label: `v_${m}`, unit: 'm/s' }, values: vs });
  }
  const csv = buildCsv(full, cols.map(([key, unit, label]) => ({ key, unit, label: label || key })), extra);
  downloadCsv(csv, `forces-that-change-${model.kind}.csv`);
});

/* ---------- guided activities ---------- */
for (const id of ACTIVITY_IDS) { const o = document.createElement('option'); o.value = id; o.textContent = `${id} — ${ACTIVITIES[id].title}`; $('guided-select').append(o); }

function setExperience(exp) {
  state.experience = exp;
  $('free-exploration').setAttribute('aria-pressed', String(exp === 'free'));
  $('guided-experiments').setAttribute('aria-pressed', String(exp === 'guided'));
  $('guided-intro').hidden = exp !== 'guided';
  for (const id of ['scenario-drag', 'scenario-oscillator']) $(id).disabled = exp === 'guided';
  if (exp === 'guided') loadActivity(); else { state.methods = new Set(); syncMethodInputs(); setScenario(state.scenario); rebuild(); }
}
function loadActivity() {
  const a = ACTIVITIES[state.activity];
  resetGuidedResponses();
  setScenario(a.scenario);
  state.methods = new Set(a.numerical?.methods || []);
  if (a.numerical) state.h = a.numerical.h;
  syncMethodInputs();
  $('guided-title').textContent = `${state.activity} — ${a.title}`;
  $('guided-objective').textContent = a.objective;
  $('guided-conditions').textContent = a.conditions;
  $('guided-question').textContent = a.question;
  $('guided-choices').replaceChildren(...a.choices.map(c => {
    const label = document.createElement('label'), input = document.createElement('input');
    Object.assign(input, { type: 'radio', name: 'guided-prediction', value: c.id, required: true });
    label.append(input, ` ${c.id}. ${c.text}`);
    return label;
  }));
  rebuild();
}
function resetGuidedResponses() {
  state.prediction = null;
  for (const i of document.querySelectorAll('input[name=guided-prediction]')) { i.checked = false; i.disabled = false; }
  $('guided-prediction-status').textContent = 'Save a prediction to unlock the experiment.';
  $('reflection-answer').value = '';
  $('model-answer-panel').hidden = true;
}
$('free-exploration').addEventListener('click', () => { if (state.experience !== 'free') setExperience('free'); });
$('guided-experiments').addEventListener('click', () => { if (state.experience !== 'guided') setExperience('guided'); });
$('guided-select').addEventListener('change', () => { state.activity = $('guided-select').value; loadActivity(); });
$('guided-choices').addEventListener('change', () => {
  if (run.state.t > 0) return;
  if (state.prediction) { state.prediction = null; $('guided-prediction-status').textContent = 'Save your updated prediction before starting.'; rebuild(); }
});
$('guided-prediction-form').addEventListener('submit', e => {
  e.preventDefault();
  if (run.state.t > 0) return;
  const choice = new FormData(e.currentTarget).get('guided-prediction');
  if (!choice) return;
  const keep = choice;
  state.prediction = keep;
  rebuild();
  for (const i of document.querySelectorAll('input[name=guided-prediction]')) i.checked = i.value === keep;
  $('guided-prediction-status').textContent = `Prediction ${keep} saved. Start the experiment to test it.`;
});

function hideResults() { $('guided-results').hidden = true; $('reflection-panel').hidden = true; }
function showResults() {
  const a = ACTIVITIES[state.activity], fb = activityFeedback(state.activity, state.prediction);
  $('guided-verdict').textContent = `${fb.correct ? '✓ ' : ''}You predicted ${state.prediction}. ${fb.message}`;
  $('guided-verdict').classList.toggle('vf-verdict-wrong', !fb.correct);
  $('guided-sections').replaceChildren(...[['Learning objective', a.fullObjective], ['Observation', a.observation], ['Physics explanation', a.explanation], ['Key takeaway', a.takeaway]].map(([h, t]) => {
    const s = document.createElement('section'), h3 = document.createElement('h3'), p = document.createElement('p');
    h3.textContent = h; p.textContent = t; s.append(h3, p); return s;
  }));
  $('reflection-question').textContent = a.reflection;
  $('guided-results').hidden = false; $('reflection-panel').hidden = false;
  for (const i of document.querySelectorAll('input[name=guided-prediction]')) i.disabled = true;
}
$('reflection-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!$('reflection-answer').value.trim()) return;
  $('model-answer').textContent = ACTIVITIES[state.activity].modelAnswer;
  $('model-answer-panel').hidden = false;
});

setScenario('drag');
rebuild();

initGraphResizer(document.querySelector('.workspace'), document.querySelector('.graphs'));
