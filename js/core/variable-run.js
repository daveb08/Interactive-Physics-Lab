import { STEP } from './physics.js';

/** A run over any model exposing at(t) and endTime. Every sample is evaluated exactly from t = 0. */
export function createVariableRun(model) {
  const first = model.at(0);
  return { model, endTime: model.endTime, reason: model.reason, state: first, samples: [first], done: false };
}

export function stepVariableRun(run, dt = STEP) {
  if (run.done) return run.state;
  const t = Math.min(run.state.t + dt, run.endTime);
  run.state = run.model.at(t);
  run.samples.push(run.state);
  if (t >= run.endTime) run.done = true;
  return run.state;
}

/** Exact samples on a regular grid (used for CSV export and full-run plots). */
export function sampleGrid(model, dt = 0.01, tEnd = model.endTime) {
  const n = Math.round(tEnd / dt), out = [];
  for (let i = 0; i <= n; i++) out.push(model.at(Math.min(i * dt, tEnd)));
  if (out.at(-1).t < tEnd) out.push(model.at(tEnd));
  return out;
}
