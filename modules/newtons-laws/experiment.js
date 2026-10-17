import { createRun, stepRun, predictionTarget, comparePrediction, forceBalance, DURATION } from '../../js/core/physics.js';
import { SimulationClock } from '../../js/core/clock.js';
import { CartView } from '../../js/components/cart.js';
import { MotionGraph } from '../../js/components/graph.js';
import { GuidedActivity } from './guided-activity.js';

const $ = id => document.getElementById(id);
const format = (value, digits = 2) => (Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value).toFixed(digits);
const signed = value => `${value > 0 ? '+' : ''}${value}`;
let mode = 'conceptual';
let experience = 'free';
let freeSettings = null;
let run, prediction = null, started = false;
const guided = new GuidedActivity(() => reset(), choice => { prediction = choice ? { choice } : null; render(); }, nextRun => {
  clock.reset();
  run = nextRun;
  started = false;
  syncControls();
  const number = guided.session.runIndex + 1;
  $('run-status').textContent = `Run ${number} ready`;
  $('start').textContent = `▶ Start Run ${number}`;
  $('run-message').textContent = `Previous runs are recorded below. Start Run ${number} to continue the comparison.`;
  render();
});
const cart = new CartView($('cart-scene'));
const graphs = [
  new MotionGraph($('position-graph'), 'x', 'Position', 'm', '#287b71'),
  new MotionGraph($('velocity-graph'), 'v', 'Velocity', 'm/s', '#3c6cb2'),
  new MotionGraph($('acceleration-graph'), 'a', 'Acceleration', 'm/s²', '#b26b29'),
];
const clock = new SimulationClock(() => {
  stepRun(run);
  if (run.done) {
    clock.pause();
    $('run-status').textContent = 'Complete';
    $('start').textContent = 'Experiment complete';
    $('run-message').textContent = run.reason === 'boundary'
      ? `Boundary reached at x = ${format(run.state.x)} m. Experiment ended; velocity is ${format(run.state.v)} m/s at the boundary. No impact or reversal is simulated.`
      : `${format(run.state.t)} seconds observed. Run complete; the displayed state is the final measurement.`;
    if (experience === 'guided') guided.complete();
    else feedback();
  }
}, render);

function render() {
  const reveal = experience === 'free' || started;
  cart.render(run, { reveal });
  $('time').value = format(run.state.t);
  $('position').value = format(run.state.x);
  $('speed').value = format(run.state.v);
  const balance = forceBalance(run);
  $('force-readouts').hidden = !run.frictionEnabled;
  $('force-legend').hidden = !run.frictionEnabled;
  for (const [id, value] of [['normal-force',balance.normal],['max-static',balance.maxStatic],['friction-force',balance.friction],['net-force',balance.netForce]]) $(id).value = reveal ? format(value) : '—';
  $('motion-state').textContent = reveal ? balance.motion : 'Observe after starting';
  $('friction-regime').textContent = reveal ? balance.regime : '—';
  $('motion-events').textContent = reveal && run.events ? run.events.filter(event => event.t <= run.state.t).map(event => `${event.label} at ${format(event.t,3)} s`).join(' · ') : '';
  $('equation-detail').textContent = `a = ${format(balance.netForce)} N / ${run.mass} kg = ${format(run.a)} m/s²`;
  $('acceleration').value = reveal ? format(run.a) : '—';
  $('equation-detail').hidden = !reveal;
  document.querySelectorAll('.graphs svg').forEach(svg => svg.toggleAttribute('hidden', !reveal));
  document.querySelector('.graph-help').textContent = reveal ? 'Same data. Three perspectives.' : 'Graphs appear when you run the experiment.';
  graphs.forEach(graph => {
    const comparison = experience === 'guided' && guided.session.runIndex > 0 && graph.key === 'v';
    graph.render(run.samples, run.endTime, { references: comparison ? guided.session.results.slice(0,guided.session.runIndex).map(r => r.samples) : [], events: reveal ? (run.events || []).filter(e => e.t <= run.state.t) : [] });
  });
  $('start').disabled = !prediction || clock.running || run.done;
  $('pause').disabled = !clock.running;
}

function updateQuestion() {
  const t = predictionTarget(run);
  $('target-time').textContent = format(t, 3);
  $('question').textContent = mode === 'conceptual'
    ? `A ${run.mass} kg cart starts with velocity ${signed(run.initial.v)} m/s under a constant horizontal force of ${signed(run.force)} N. How will its signed velocity change over time? Increasing means more positive; decreasing means more negative.`
    : `A ${run.mass} kg cart starts at ${signed(run.initial.v)} m/s with a net force of ${signed(run.force)} N. Predict its acceleration and velocity at t = ${format(t, 3)} s${t < 3 ? ' (the track boundary)' : ''}. The calculation uses the exact target time; the label is rounded.`;
  $('acceleration-prompt').textContent = run.frictionEnabled ? 'Initial acceleration (m/s²)' : 'Acceleration (m/s²)';
  if (run.frictionEnabled) $('question').textContent = `A ${run.mass} kg cart starts at ${signed(run.initial.v)} m/s with applied force ${signed(run.force)} N, μs = ${run.muS.toFixed(2)} and μk = ${run.muK.toFixed(2)}. ${mode === 'conceptual' ? 'How does its signed velocity initially change? A later stop can change the acceleration.' : `Predict its initial acceleration and velocity at ${format(t,3)} s. Reevaluate friction if velocity reaches zero.`}`;
}

function reset() {
  clock.reset();
  run = experience === 'guided' ? guided.reset() : createRun({ mass: +$('mass').value, force: +$('force').value, velocity: +$('velocity').value, frictionEnabled: $('friction-enabled').checked, muS: +$('mu-s').value, muK: +$('mu-k').value });
  prediction = null;
  started = false;
  $('settings').disabled = experience === 'guided';
  $('friction-settings').disabled = experience === 'guided';
  $('prediction-fields').disabled = false;
  $('save-prediction').disabled = false;
  $('prediction-form').reset();
  $('feedback').hidden = true;
  $('run-status').textContent = 'Ready';
  $('run-message').textContent = experience === 'guided' ? 'Save your prediction above, then start the experiment.' : 'Make a prediction below, then start your experiment.';
  $('prediction-status').textContent = mode === 'conceptual' ? 'Choose an answer to unlock the experiment.' : 'Enter both predictions to unlock the experiment.';
  $('start').textContent = experience === 'guided' && guided.session.experiment.runs.length > 1 ? '▶ Start Run 1' : '▶ Start experiment';
  $('next-run').hidden = true;
  const duration = experience === 'guided' ? guided.session.experiment.observationTime ?? DURATION : DURATION;
  $('track-description').textContent = `The track spans −50 to +50 m. Each run ends at ${duration} s or at the first outward boundary crossing. The final velocity is retained; no collision is modeled.`;
  syncControls();
  updateQuestion();
  render();
}

function syncControls() {
  $('mass').value = run.mass; $('force').value = run.force; $('velocity').value = run.initial.v;
  $('mass-value').value = `${run.mass} kg`;
  $('force-value').value = `${signed(run.force)} N`;
  $('velocity-value').value = `${signed(run.initial.v)} m/s`;
  $('friction-enabled').checked = run.frictionEnabled;
  $('mu-s').value = run.muS; $('mu-k').value = run.muK;
  $('mu-s-value').value = run.muS.toFixed(2); $('mu-k-value').value = run.muK.toFixed(2);
  $('coefficient-controls').hidden = !run.frictionEnabled;
  $('surface-description').textContent = run.frictionEnabled ? 'Sliding-contact model · N = mg · g = 9.81 m/s². Static friction adjusts up to μsN; kinetic friction = μkN.' : 'Ideal surface · no friction or air resistance.';
  $('equation-detail').textContent = `a = ${run.force} N / ${run.mass} kg = ${format(run.a)} m/s²`;
}

function feedback() {
  if (experience === 'guided') return;
  if (!prediction || !started) return;
  const target = predictionTarget(run);
  if (mode === 'quantitative' && run.state.t + 1e-9 < target) return;
  const box = $('feedback');
  box.hidden = false;
  if (run.frictionEnabled) {
    const result = comparePrediction(run, prediction.a, prediction.v);
    const events = run.events.filter(e => e.t <= run.state.t).map(e => `${e.label} at ${format(e.t,3)} s`).join('; ');
    const actual = run.initialA > 0 ? 'increase' : run.initialA < 0 ? 'decrease' : 'same';
    box.textContent = mode === 'conceptual'
      ? `${prediction.choice === actual ? 'Prediction confirmed.' : 'Compare your prediction with the initial change in velocity.'} Initial acceleration is ${format(run.initialA,3)} m/s². At ${format(run.state.t)} s, velocity is ${format(run.state.v)} m/s and acceleration is ${format(run.a,3)} m/s². `
      : `Initial acceleration = ${format(result.a,3)} m/s² (${result.correctA ? 'within tolerance' : `your prediction: ${prediction.a} m/s²`}); velocity at ${format(result.time,3)} s = ${format(result.v,3)} m/s (${result.correctV ? 'within tolerance' : `your prediction: ${prediction.v} m/s`}). `;
    box.textContent += `While sliding, friction opposes velocity and has magnitude μkN. At rest, static friction balances applied force up to μsN; it need not equal μsN. Acceleration is (applied force + signed friction) / mass. Apply constant-acceleration kinematics separately between events. ${events}`;
    return;
  }
  if (mode === 'conceptual') {
    const actual = run.a > 0 ? 'increase' : run.a < 0 ? 'decrease' : 'same';
    const correct = prediction.choice === actual;
    box.textContent = `${correct ? 'Prediction confirmed.' : 'Compare your prediction with the observation.'} ${run.a === 0
      ? `Zero net force means zero acceleration. Velocity remains ${format(run.initial.v)} m/s; a moving cart does not need a force to keep moving.`
      : `The signed velocity ${run.a > 0 ? 'increases' : 'decreases'} by ${format(Math.abs(run.a))} m/s each second because a = Fnet / m = ${format(run.a)} m/s². ${run.initial.v * run.a < 0 ? 'The cart first slows down, then reverses direction if the run lasts long enough.' : 'Force determines the change in velocity, rather than velocity itself.'}`} At t = ${format(run.state.t)} s, v = ${format(run.state.v)} m/s. On the graphs, velocity has slope a and position has slope v.`;
  } else {
    const result = comparePrediction(run, prediction.a, prediction.v);
    box.textContent = `At t = ${format(result.time, 3)} s: acceleration = ${format(result.a, 3)} m/s² (${result.correctA ? 'within tolerance' : `your prediction: ${prediction.a} m/s²`}); velocity = ${format(result.v, 3)} m/s (${result.correctV ? 'within tolerance' : `your prediction: ${prediction.v} m/s`}). Use a = Fnet / m and v = v₀ + at. Position follows x = v₀t + ½at². The velocity graph’s slope equals acceleration, and the position graph’s slope equals velocity.`;
  }
}

$('prediction-form').addEventListener('submit', event => {
  event.preventDefault();
  if (started) return;
  prediction = mode === 'conceptual'
    ? { choice: new FormData(event.currentTarget).get('prediction') }
    : { a: +$('predicted-a').value, v: +$('predicted-v').value };
  $('prediction-status').textContent = 'Prediction saved. Start the experiment to test it.';
  render();
});

$('start').addEventListener('click', () => {
  if (!prediction || run.done) return;
  if (experience === 'guided' && !guided.start()) return;
  started = true;
  $('settings').disabled = true;
  $('friction-settings').disabled = true;
  $('prediction-fields').disabled = true;
  $('save-prediction').disabled = true;
  $('run-status').textContent = 'Running';
  $('run-message').textContent = 'Observe the cart and connect its motion to the graphs. You can pause to inspect a measurement.';
  $('start').textContent = '▶ Resume';
  clock.start();
  render();
});
$('pause').addEventListener('click', () => {
  clock.pause();
  $('run-status').textContent = 'Paused';
  $('run-message').textContent = 'Paused at the displayed simulation time. Resume to continue the same run.';
  feedback();
  render();
});
$('reset').addEventListener('click', reset);
for (const id of ['mass', 'force', 'velocity']) $(id).addEventListener('input', reset);
$('friction-enabled').addEventListener('change', reset);
for (const id of ['mu-s','mu-k']) $(id).addEventListener('input', () => {
  if (+$('mu-s').value < +$('mu-k').value) $(id === 'mu-s' ? 'mu-k' : 'mu-s').value = $(id).value;
  reset();
});
for (const next of ['conceptual', 'quantitative']) $(`${next}-mode`).addEventListener('click', () => {
  if (next === mode) return;
  mode = next;
  $('conceptual-mode').setAttribute('aria-pressed', String(mode === 'conceptual'));
  $('quantitative-mode').setAttribute('aria-pressed', String(mode === 'quantitative'));
  $('conceptual-fields').hidden = mode !== 'conceptual';
  $('quantitative-fields').hidden = mode !== 'quantitative';
  document.querySelectorAll('[name="prediction"]').forEach(input => { input.required = mode === 'conceptual'; });
  for (const id of ['predicted-a', 'predicted-v']) $(id).required = mode === 'quantitative';
  reset();
  $('run-message').textContent = 'Learning mode changed; a new experiment is ready. Make a new prediction.';
});
for (const [id, next] of [['free-exploration', 'free'], ['guided-experiments', 'guided']]) $(id).addEventListener('click', () => {
  if (experience === next) return;
  if (next === 'guided') freeSettings = { mass: $('mass').value, force: $('force').value, velocity: $('velocity').value, 'mu-s': $('mu-s').value, 'mu-k': $('mu-k').value, frictionEnabled: $('friction-enabled').checked };
  else {
    for (const key of ['mass', 'force', 'velocity','mu-s','mu-k']) $(key).value = freeSettings[key];
    $('friction-enabled').checked = freeSettings.frictionEnabled;
  }
  experience = next;
  $('free-exploration').setAttribute('aria-pressed', String(next === 'free'));
  $('guided-experiments').setAttribute('aria-pressed', String(next === 'guided'));
  $('guided-intro').hidden = next !== 'guided';
  $('free-activity').hidden = next !== 'free';
  document.querySelector('[aria-label="Learning mode"]').hidden = next !== 'free';
  $('settings-help').textContent = next === 'guided' ? 'Parameters are locked for this guided experiment. Return to Free Exploration to adjust them independently.' : 'Settings stay fixed during a run. Reset to change them.';
  reset();
  if (next === 'free') for (const id of ['guided-results', 'guided-feedback', 'reflection-panel']) $(id).hidden = true;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && clock.running) $('pause').click();
});
reset();
