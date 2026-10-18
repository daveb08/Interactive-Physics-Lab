import test from 'node:test';
import assert from 'node:assert/strict';
import { PROBLEMS, PROBLEM_IDS } from '../modules/newtons-laws/solve-problems.js';
import { checkSolution, requiredSteps, studentModel, shuffled } from '../modules/newtons-laws/solve-check.js';
import { createRun, stepRun, sampleAt } from '../js/core/physics.js';

const near = (a, e, eps = 1e-3, msg = '') => assert.ok(Math.abs(a - e) <= eps, `${msg} ${a} ≠ ${e}`);
const S1 = PROBLEMS.S1, S2 = PROBLEMS.S2;

test('problem data: one correct block per step, dependencies exist, distractors have feedback', () => {
  for (const id of PROBLEM_IDS) {
    const p = PROBLEMS[id];
    const steps = requiredSteps(p);
    assert.deepEqual([...new Set(steps)].sort(), Object.keys(p.steps).sort(), id);
    assert.equal(new Set(steps).size, steps.length, `${id}: one correct block per step`);
    for (const b of p.blocks) {
      for (const s of b.after || []) assert.ok(p.steps[s], `${id}/${b.id} depends on unknown step ${s}`);
      if (!b.correct) assert.ok(b.feedback && p.steps[b.step], `${id}/${b.id} needs feedback and a known step`);
    }
    assert.equal(new Set(p.blocks.map(b => b.id)).size, p.blocks.length, `${id}: unique ids`);
  }
});

test('S1 stated answers match the physics engine', () => {
  const run = createRun(S1.setup, { duration: S1.targetTime });
  while (!run.done) stepRun(run);
  near(run.a, 2.5); near(run.state.v, 9.5); near(run.state.x, 17.25);
});

test('S2 stated answers match the friction engine (stop time and distance)', () => {
  const run = createRun(S2.setup, { duration: 5 });
  near(sampleAt(run, 1).a, -1.962); near(sampleAt(run, 1).a * 3, -5.886);
  const t = S2.targetTime;
  near(t, 3.058); near(sampleAt(run, t).v, 0, 1e-6); near(sampleAt(run, t).x, 9.174); near(sampleAt(run, 4.5).x, 9.174);
});

test('a fully correct solution scores full marks, in either order of commuting steps', () => {
  for (const seq of [['f-ok', 'a-ok', 'v-ok', 'x-ok'], ['f-ok', 'a-ok', 'x-ok', 'v-ok']]) {
    const r = checkSolution(S1, seq);
    assert.equal(r.score, 4); assert.equal(r.total, 4); assert.equal(r.solved, true); assert.deepEqual(r.missing, []);
  }
  const r2 = checkSolution(S2, ['n-ok', 'fr-ok', 'acc-ok', 'd-ok', 't-ok']);
  assert.equal(r2.solved, true); assert.equal(r2.score, 5);
});

test('out-of-order steps are flagged and name what they need', () => {
  const r = checkSolution(S1, ['a-ok', 'f-ok', 'v-ok', 'x-ok']);
  assert.equal(r.blocks[0].status, 'order');
  assert.match(r.blocks[0].message, /Net force/);
  assert.equal(r.score, 3); assert.equal(r.solved, false);
});

test('a correct step after a flawed prerequisite says the prerequisite has a mistake', () => {
  const r = checkSolution(S2, ['n-ok', 'fr-forward', 'acc-ok']);
  assert.equal(r.blocks[2].status, 'order');
  assert.match(r.blocks[2].message, /has a mistake above/);
});

test('distractors are flagged with their misconception feedback and earn no points', () => {
  const r = checkSolution(S1, ['f-ok', 'a-ok', 'v-no-v0', 'x-ok']);
  assert.equal(r.blocks[2].status, 'misconception');
  assert.match(r.blocks[2].message, /v₀ \+ a t/);
  assert.equal(r.score, 3); assert.deepEqual(r.missing, ['Velocity at 3 s']); assert.equal(r.solved, false);
});

test('missing and duplicate steps are reported', () => {
  const r = checkSolution(S1, ['f-ok', 'a-ok', 'a-ok']);
  assert.equal(r.blocks[2].status, 'duplicate');
  assert.deepEqual(r.missing, ['Velocity at 3 s', 'Position at 3 s']);
  assert.equal(checkSolution(S1, []).score, 0);
  assert.throws(() => checkSolution(S1, ['nope']), RangeError);
});

test('student model: distractors change acceleration or v₀ for the ghost cart', () => {
  assert.deepEqual(studentModel(S1, ['f-ok', 'a-ok', 'v-ok', 'x-ok'], 2.5), { a: 2.5, v0: 2, changed: false });
  assert.deepEqual(studentModel(S1, ['f-ok', 'a-inverse', 'v-no-v0'], 2.5), { a: 0.4, v0: 0, changed: true });
  const fwd = studentModel(S2, ['n-ok', 'fr-forward', 'acc-ok'], -1.962);
  near(fwd.a, 1.962); assert.equal(fwd.changed, true);
});

test('shuffle is a deterministic permutation', () => {
  const ids = S1.blocks.map(b => b.id);
  const a = shuffled(ids, 42), b = shuffled(ids, 42);
  assert.deepEqual(a, b); assert.deepEqual([...a].sort(), [...ids].sort());
  assert.notDeepEqual(a, ids);
});
