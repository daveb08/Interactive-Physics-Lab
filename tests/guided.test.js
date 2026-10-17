import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENTS, GuidedSession, comparisonRows } from '../modules/newtons-laws/guided-experiments.js';
import { stepRun, advance, createRun } from '../js/core/physics.js';

const near = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-9, `${value} ≠ ${expected}`);
const finish = session => { while (!session.run.done) stepRun(session.run); session.completeRun(); };

test('A and B have the specified initial conditions and correct predictions', () => {
  assert.deepEqual(EXPERIMENTS.A.runs, [{ mass: 2, force: 0, velocity: 3 }]);
  assert.deepEqual(EXPERIMENTS.B.runs, [{ mass: 2, force: 4, velocity: -4 }]);
  for (const id of ['A', 'B']) {
    assert.equal(EXPERIMENTS[id].answer, 'B');
    assert.equal(EXPERIMENTS[id].options.length, 4);
  }
});
test('guided runs require a saved prediction and accept misconceptions without blocking observation', () => {
  const session = new GuidedSession('A');
  assert.equal(session.start(), false);
  assert.equal(session.savePrediction('invalid'), false);
  assert.equal(session.savePrediction('A'), true);
  assert.equal(session.start(), true);
  assert.equal(session.savePrediction('B'), false);
  assert.equal(session.completeRun(), false);
  finish(session);
  assert.equal(session.completed, true);
  assert.equal(session.results.length, 1);
  assert.equal(session.completeRun(), false);
});
test('A continues at +3 m/s with zero acceleration for six seconds', () => {
  const session = new GuidedSession('A');
  session.savePrediction('B'); session.start(); finish(session);
  near(session.run.a, 0); near(session.run.state.v, 3); near(session.run.state.x, 18);
  near(session.run.state.t, 6);
});
test('B slows, stops at two seconds, then reverses while acceleration stays positive', () => {
  const session = new GuidedSession('B');
  near(session.run.a, 2);
  const before = advance(session.run.initial, session.run.a, 1);
  const stop = advance(session.run.initial, session.run.a, 2);
  const after = advance(session.run.initial, session.run.a, 3);
  near(before.v, -2); near(stop.v, 0); near(stop.x, -4); near(after.v, 2);
  session.savePrediction('B'); session.start(); finish(session);
  near(session.run.state.v, 8); near(session.run.state.x, 12);
});
test('every incorrect option has misconception feedback and each activity has reflection content', () => {
  for (const e of Object.values(EXPERIMENTS)) {
    for (const choice of 'ABCD') if (choice !== e.answer) assert.ok(e.misconceptions[choice]);
    for (const field of ['observation', 'explanation', 'takeaway', 'reflection', 'modelAnswer']) assert.ok(e[field]);
  }
});

test('C and D initial conditions change only the intended variable and have the specified correct answers', () => {
  assert.deepEqual(EXPERIMENTS.C.runs, [{mass:2, force:6, velocity:0}, {mass:4, force:6, velocity:0}]);
  assert.deepEqual(EXPERIMENTS.D.runs, [{mass:2, force:4, velocity:0}, {mass:2, force:8, velocity:0}]);
  assert.equal(EXPERIMENTS.C.answer, 'B');
  assert.equal(EXPERIMENTS.D.answer, 'A');
});
test('C compares 3 and 1.5 m/s² with analytical velocity and position at exactly 3 s', () => {
  const session = new GuidedSession('C');
  session.savePrediction('B'); session.start(); finish(session);
  assert.equal(session.completed, false);
  assert.equal(session.nextRun(), true);
  session.start(); finish(session);
  assert.equal(session.completed, true);
  assert.deepEqual(comparisonRows(session.results, 3), [
    {mass:2, force:6, velocity:0, acceleration:3, time:3, finalVelocity:9, position:13.5},
    {mass:4, force:6, velocity:0, acceleration:1.5, time:3, finalVelocity:4.5, position:6.75},
  ]);
});
test('D compares 2 and 4 m/s² with analytical velocity and position at exactly 3 s', () => {
  const session = new GuidedSession('D');
  session.savePrediction('A'); session.start(); finish(session); session.nextRun(); session.start(); finish(session);
  assert.deepEqual(comparisonRows(session.results, 3), [
    {mass:2, force:4, velocity:0, acceleration:2, time:3, finalVelocity:6, position:9},
    {mass:2, force:8, velocity:0, acceleration:4, time:3, finalVelocity:12, position:18},
  ]);
});
test('two-run sequence cannot skip runs, repeat advancement, or edit the saved prediction after starting', () => {
  const session = new GuidedSession('C');
  assert.equal(session.nextRun(), false);
  session.savePrediction('A'); session.start();
  assert.equal(session.nextRun(), false);
  finish(session);
  assert.equal(session.nextRun(), true);
  assert.equal(session.nextRun(), false);
  assert.equal(session.savePrediction('B'), false);
  assert.equal(session.prediction, 'A');
  assert.equal(session.results.length, 1);
  session.start(); finish(session);
  assert.equal(session.nextRun(), false);
  assert.equal(session.completeRun(), false);
  const reset = new GuidedSession('C');
  assert.equal(reset.prediction, null); assert.equal(reset.results.length, 0); assert.equal(reset.runIndex, 0);
});
test('comparison data and both overlay histories have the same time origin, endpoint, and analytical samples', () => {
  for (const id of ['C', 'D']) {
    const session = new GuidedSession(id);
    session.savePrediction('B'); session.start(); finish(session); session.nextRun(); session.start(); finish(session);
    for (const run of session.results) {
      assert.equal(run.samples[0].t, 0); assert.equal(run.samples.at(-1).t, 3);
      assert.equal(run.reason, 'duration');
      for (const sample of run.samples) {
        const expected = advance(run.initial, run.a, sample.t);
        near(sample.x, expected.x); near(sample.v, expected.v);
      }
    }
  }
});
test('shorter observation windows retain exact boundary handling in either direction', () => {
  const runs = [-1, 1].map(sign => createRun({mass:1, force:sign * 20, velocity:0}, {duration:3}));
  for (const [i, run] of runs.entries()) {
    while (!run.done) stepRun(run);
    near(run.state.t, Math.sqrt(5)); near(run.state.x, (i ? 1 : -1) * 50);
    near(run.state.v, (i ? 1 : -1) * 20 * Math.sqrt(5));
    assert.equal(run.reason, 'boundary');
  }
  assert.throws(() => comparisonRows(runs, 3), RangeError);
  assert.throws(() => comparisonRows([runs[0]], 3), RangeError);
  assert.throws(() => comparisonRows([createRun(EXPERIMENTS.C.runs[0]), createRun(EXPERIMENTS.C.runs[1])], 3), RangeError);
});
test('custom observation duration validates input and leaves the original six-second default intact', () => {
  const params = {mass:2, force:0, velocity:3};
  assert.equal(createRun(params).endTime, 6);
  assert.equal(createRun(params, {duration:3}).endTime, 3);
  for (const duration of [0, -1, NaN, Infinity]) assert.throws(() => createRun(params, {duration}), RangeError);
});
