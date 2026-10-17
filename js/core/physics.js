/** SI units throughout. Optional Coulomb friction; no collisions or air resistance. */
export const GRAVITY = 9.81;
export const TRACK = Object.freeze({ min: -50, max: 50 });
export const STEP = 1 / 120;
export const DURATION = 6;

export function acceleration(force, mass) {
  if (!Number.isFinite(mass) || mass <= 0 || !Number.isFinite(force)) throw new RangeError('Use finite force and positive finite mass.');
  return force / mass;
}

export function advance(state, a, dt) {
  if (![state.t, state.x, state.v, a, dt].every(Number.isFinite) || dt < 0) throw new RangeError('State and acceleration must be finite; dt must be nonnegative.');
  // Exact for constant acceleration, including a reversal within a time step.
  return { t: state.t + dt, x: state.x + state.v * dt + 0.5 * a * dt * dt, v: state.v + a * dt };
}

/** Earliest outward crossing of a track endpoint; touching then returning is allowed. */
export function boundaryTime(state, a, track = TRACK) {
  let earliest = Infinity;
  for (const edge of [track.min, track.max]) {
    const sign = edge === track.max ? 1 : -1;
    const c = state.x - edge;
    let roots;
    if (a === 0) roots = state.v === 0 ? [] : [-c / state.v];
    else {
      const discriminant = state.v * state.v - 2 * a * c;
      if (discriminant < 0) continue;
      // Stable quadratic roots avoid cancellation near an endpoint.
      const q = -0.5 * (state.v + (state.v >= 0 ? 1 : -1) * Math.sqrt(discriminant));
      roots = q === 0 ? [0] : [q / (0.5 * a), c / q];
    }
    for (const t of roots) {
      if (t < -1e-10) continue;
      const time = Math.max(0, t);
      const outwardV = sign * (state.v + a * time);
      if (outwardV > 1e-10 || (Math.abs(outwardV) <= 1e-10 && sign * a > 0)) earliest = Math.min(earliest, time);
    }
  }
  return earliest;
}

export function createRun({ mass, force, velocity, frictionEnabled = false, muS = 0.4, muK = 0.3 }, { duration = DURATION } = {}) {
  const a = acceleration(force, mass);
  if (!Number.isFinite(velocity)) throw new RangeError('Use finite initial velocity.');
  if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Observation duration must be positive and finite.');
  const initial = { t: 0, x: 0, v: velocity };
  if (![muS, muK].every(Number.isFinite) || muK < 0 || muS < muK || muS > 1) throw new RangeError('Coefficients must satisfy 0 ≤ μk ≤ μs ≤ 1.');
  const endTime = Math.min(duration, boundaryTime(initial, a));
  const run = { mass, force, a, initial, state: { ...initial }, endTime, reason: endTime < duration ? 'boundary' : 'duration', done: false, samples: [{ ...initial, a }], frictionEnabled, muS, muK };
  if (frictionEnabled) {
    planFriction(run, duration);
    run.a = sampleAt(run, 0).a;
    run.initialA = run.a;
    run.samples = [sampleAt(run, 0)];
  }
  return run;
}

/** Static friction is whatever balances F, up to μs N; kinetic friction opposes sliding. */
export function forceBalance(run, state = run.state) {
  const normal = run.mass * GRAVITY;
  const maxStatic = run.frictionEnabled ? run.muS * normal : 0;
  let friction = 0;
  let regime = 'frictionless';
  if (run.frictionEnabled) {
    if (state.v === 0 && Math.abs(run.force) <= maxStatic) {
      friction = -run.force;
      regime = 'static';
    } else {
      friction = -Math.sign(state.v || run.force) * run.muK * normal;
      regime = 'kinetic';
    }
  }
  const netForce = run.force + friction;
  return { normal, maxStatic, friction: friction || 0, netForce, a: netForce / run.mass, regime,
    motion: state.v > 0 ? 'Sliding Right' : state.v < 0 ? 'Sliding Left' : 'Stationary' };
}

function planFriction(run, duration) {
  // With fixed F and coefficients, acceleration is constant between zero-velocity events.
  // Solve each segment analytically, including its exact stop/boundary time.
  run.segments = [];
  run.events = [];
  let initial = { ...run.initial };
  if (initial.v === 0 && forceBalance(run, initial).regime === 'kinetic') run.events.push({ t: 0, label: 'Breakaway' });
  while (initial.t < duration) {
    const balance = forceBalance(run, initial);
    const stopping = initial.v * balance.a < 0 ? -initial.v / balance.a : Infinity;
    const boundary = boundaryTime(initial, balance.a);
    const dt = Math.min(duration - initial.t, stopping, boundary);
    const state = advance(initial, balance.a, dt);
    const stop = stopping === dt;
    if (stop) state.v = 0; // exact event, not a numerical clamp after an overshoot
    run.segments.push({ initial, end: state.t, ...balance });
    if (boundary === dt) {
      run.endTime = state.t; run.reason = 'boundary';
      return;
    }
    if (stop) {
      const next = forceBalance(run, state);
      run.events.push({ t: state.t, label: next.regime === 'static' ? 'Stop / stick' : 'Stop / reverse', before: { ...state, ...balance }, after: { ...state, ...next } });
      // Retain the right-hand force state even if stopping coincides with observation end.
      if (state.t === duration) run.segments.push({ initial: state, end: duration, ...next });
    }
    initial = state;
  }
  run.endTime = duration;
  run.reason = 'duration';
}

/** The same exact solution supplies predictions, animation, readouts, and graph samples. */
export function sampleAt(run, time) {
  if (!Number.isFinite(time) || time < 0 || time > run.endTime + 1e-9) throw new RangeError('Time must be within the observed track interval.');
  const t = Math.min(time, run.endTime);
  if (!run.frictionEnabled) return { ...advance(run.initial, run.a, t), a: run.a };
  const segment = run.segments.findLast(s => s.initial.t <= t);
  const state = advance(segment.initial, segment.a, t - segment.initial.t);
  const event = run.events.find(e => e.t === t && e.after);
  if (event) state.v = 0;
  return { ...state, a: segment.a, friction: segment.friction, netForce: segment.netForce, regime: segment.regime };
}

export function stepRun(run, dt = STEP) {
  if (!Number.isFinite(dt) || dt <= 0) throw new RangeError('Time step must be positive and finite.');
  if (run.done) return run.state;
  const t = Math.min(run.state.t + dt, run.endTime);
  if (run.frictionEnabled) {
    for (const event of run.events) {
      if (event.before && event.t > run.state.t && event.t <= t) {
        // Two samples at one instant draw the actual acceleration jump, not a ramp.
        run.samples.push({ ...event.before, event: event.label }, { ...event.after, event: event.label });
      }
    }
    const sample = sampleAt(run, t);
    run.state = { t: sample.t, x: sample.x, v: sample.v };
    run.a = sample.a;
    if (run.samples.at(-1).t !== t) run.samples.push(sample);
    run.done = t >= run.endTime;
    return run.state;
  }
  // Evaluate from the initial state to avoid accumulating numerical drift.
  run.state = advance(run.initial, run.a, t);
  run.done = t >= run.endTime;
  run.samples.push({ ...run.state, a: run.a });
  return run.state;
}

export function predictionTarget(run) { return Math.min(3, run.endTime); }

export function comparePrediction(run, predictedA, predictedV) {
  const time = predictionTarget(run);
  const actual = sampleAt(run, time);
  const a = run.frictionEnabled ? run.initialA : run.a;
  return { time, a, v: actual.v, correctA: Number.isFinite(predictedA) && Math.abs(predictedA - a) <= 0.05 + 1e-12, correctV: Number.isFinite(predictedV) && Math.abs(predictedV - actual.v) <= 0.1 + 1e-12 };
}
