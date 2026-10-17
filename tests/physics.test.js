import test from 'node:test';
import assert from 'node:assert/strict';
import { acceleration, advance, boundaryTime, createRun, stepRun, comparePrediction, TRACK, STEP } from '../js/core/physics.js';

const near = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} ≠ ${expected}`);
const finish = run => { while (!run.done) stepRun(run); return run; };

test('zero net force produces zero acceleration', () => assert.equal(acceleration(0, 2), 0));
test('positive force produces positive acceleration', () => assert.equal(acceleration(6, 2), 3));
test('negative force produces negative acceleration', () => assert.equal(acceleration(-6, 2), -3));
test('doubling mass halves acceleration', () => assert.equal(acceleration(6, 4), acceleration(6, 2) / 2));
test('doubling force doubles acceleration', () => assert.equal(acceleration(12, 2), 2 * acceleration(6, 2)));
test('zero force retains positive and negative constant velocity', () => {
  for (const velocity of [-5, 0, 5]) {
    const run = finish(createRun({ mass: 2, force: 0, velocity }));
    near(run.state.v, velocity); near(run.state.x, velocity * 6); near(run.state.t, 6);
    assert.ok(run.samples.every(s => s.v === velocity && s.a === 0));
  }
});
test('negative initial velocity reverses continuously under positive acceleration', () => {
  const initial = { t: 0, x: 0, v: -4 };
  near(advance(initial, 2, 1).v, -2);
  near(advance(initial, 2, 2).v, 0);
  near(advance(initial, 2, 2).x, -4);
  near(advance(initial, 2, 3).v, 2);
  near(advance(initial, 2, 3).x, -3);
});
test('fixed-step samples agree with analytical position and velocity across parameter range', () => {
  for (const mass of [1, 2, 10]) for (const force of [-20, -6, 0, 6, 20]) for (const velocity of [-5, 0, 5]) {
    const run = finish(createRun({ mass, force, velocity }));
    for (const s of run.samples) {
      near(s.x, velocity * s.t + 0.5 * force / mass * s.t ** 2);
      near(s.v, velocity + force / mass * s.t);
      near(s.a, force / mass);
      assert.ok(s.x >= TRACK.min - 1e-8 && s.x <= TRACK.max + 1e-8);
    }
    assert.deepEqual(run.samples.at(-1), { ...run.state, a: run.a });
  }
});
test('positive and negative boundary events retain incident velocity and stop at exact time', () => {
  for (const sign of [-1, 1]) {
    const run = finish(createRun({ mass: 1, force: sign * 20, velocity: 0 }));
    near(run.state.t, Math.sqrt(5)); near(run.state.x, sign * 50);
    near(run.state.v, sign * 20 * Math.sqrt(5));
    assert.equal(run.reason, 'boundary');
    const previous = { ...run.state }; stepRun(run); assert.deepEqual(run.state, previous);
  }
});
test('boundary calculation finds first exit even if a large step would leave and return', () => {
  near(boundaryTime({ x: 0, v: 30 }, -5), (30 - Math.sqrt(400)) / 5);
});
test('tangent contact does not create a collision or end the observation', () => {
  near(boundaryTime({ x: 0, v: 10 }, -1), 10 + Math.sqrt(200));
  near(boundaryTime({ x: 50, v: 0 }, -1), Math.sqrt(200));
});
test('boundary starts: outward ends immediately, inward continues', () => {
  near(boundaryTime({ x: 50, v: 1 }, 0), 0);
  near(boundaryTime({ x: -50, v: 0 }, -2), 0);
  near(boundaryTime({ x: 50, v: -5 }, 0), 20);
  assert.equal(boundaryTime({ x: 0, v: 0 }, 0), Infinity);
});
test('constant-acceleration integration is consistent across step sizes', () => {
  for (const dt of [STEP, 1 / 30, 0.7]) {
    const run = createRun({ mass: 2, force: 1, velocity: -1 });
    while (!run.done) stepRun(run, dt);
    near(run.state.t, 6); near(run.state.x, 3); near(run.state.v, 2);
  }
});
test('quantitative predictions use stated tolerances and exact target time', () => {
  const run = createRun({ mass: 2, force: 6, velocity: 0 });
  assert.deepEqual(comparePrediction(run, 3, 9), { time: 3, a: 3, v: 9, correctA: true, correctV: true });
  assert.equal(comparePrediction(run, 3.05, 9.1).correctA, true);
  assert.equal(comparePrediction(run, 3.05, 9.1).correctV, true);
  assert.equal(comparePrediction(run, 3.06, 9.11).correctA, false);
  assert.equal(comparePrediction(run, 3.06, 9.11).correctV, false);
  assert.equal(comparePrediction(run, NaN, Infinity).correctV, false);
});
test('quantitative target falls at the boundary for short runs', () => {
  const run = finish(createRun({ mass: 1, force: 20, velocity: 5 }));
  const result = comparePrediction(run, run.a, run.state.v);
  near(result.time, run.state.t); near(result.v, run.state.v);
});
test('invalid physical values and time steps are rejected', () => {
  for (const mass of [0, -1, NaN, Infinity]) assert.throws(() => acceleration(2, mass), RangeError);
  assert.throws(() => acceleration(Infinity, 2), RangeError);
  assert.throws(() => createRun({ mass: 2, force: 1, velocity: NaN }), RangeError);
  assert.throws(() => advance({ t: 0, x: 0, v: 0 }, 1, -1), RangeError);
  for (const dt of [0, -1, NaN, Infinity]) assert.throws(() => stepRun(createRun({ mass: 1, force: 0, velocity: 0 }), dt), RangeError);
});
