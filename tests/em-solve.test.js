import test from 'node:test';
import assert from 'node:assert/strict';
import { PROBLEMS, PROBLEM_IDS, UNITS, trueForces, studentModel, s3, a1 } from '../modules/electromagnetism/solve-problems.js';
import { checkSolution, checkQuantities, correctOrder, correctPlacement, shuffled } from '../modules/newtons-laws/solve-check.js';
import { netForce } from '../js/core/electrostatics.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test('E1 Solve it: four problems with complete data', () => {
  assert.deepEqual(PROBLEM_IDS, ['S1', 'S2', 'S3', 'S4']);
  for (const id of PROBLEM_IDS) {
    const p = PROBLEMS[id];
    for (const step of Object.keys(p.steps)) assert.equal(p.blocks.filter(b => b.correct && b.step === step).length, 1, `${id} ${step}: one correct block`);
    for (const b of p.blocks) {
      assert.ok(p.steps[b.step], `${id} ${b.id}: unknown step`);
      for (const s of b.after || []) assert.ok(p.steps[s], `${id} ${b.id}: unknown dependency ${s}`);
      if (!b.correct) assert.ok(b.feedback?.length > 40, `${id} ${b.id}: distractor needs feedback`);
      if (b.answer) { assert.ok(b.answer.key in p.truth, `${id} ${b.id}: answer key`); assert.ok(UNITS[b.answer.key]); }
      assert.doesNotMatch(b.text, /NaN|undefined|Infinity/);
    }
    for (const q of p.quantities) if (q.role === 'none') assert.ok(q.feedback, `${id} ${q.id}: trap needs feedback`);
    assert.ok(p.blocks.filter(b => !b.correct).length >= Object.keys(p.steps).length, `${id}: at least one distractor per step on average`);
  }
});

test('E1 Solve it: correct blocks state the engine’s answers, wrong blocks do not', () => {
  for (const id of PROBLEM_IDS) {
    const p = PROBLEMS[id];
    for (const b of p.blocks.filter(x => x.answer)) {
      const ok = Math.abs(b.answer.value - p.truth[b.answer.key]) <= 0.005 * Math.abs(p.truth[b.answer.key]) + 1e-9;
      if (b.correct) assert.ok(ok, `${id} ${b.id}: ${b.answer.value} vs ${p.truth[b.answer.key]}`);
    }
  }
  const T = Object.fromEntries(PROBLEM_IDS.map(id => [id, PROBLEMS[id].truth]));
  near(T.S1.F21, 1.498, 1e-3); near(T.S1.ang21, 180);
  near(T.S2.Fnet, -0.1498, 1e-3); near(T.S2.F21, 1.3482, 1e-4); near(T.S2.F23, 1.1984, 1e-4);
  near(T.S3.Fnet, 1.0453, 1e-4); near(T.S3.angle, 139.844, 1e-4);
  near(T.S4.x, 0.20);
});

test('E1 Solve it: truth agrees with an independent superposition of the forces', () => {
  const S2 = trueForces(PROBLEMS.S2)[1]; near(S2.fx, PROBLEMS.S2.truth.Fnet); near(S2.fy, 0, 1e-12);
  const S3 = trueForces(PROBLEMS.S3)[2]; near(S3.magnitude, PROBLEMS.S3.truth.Fnet);
  const S4 = trueForces(PROBLEMS.S4, { uC: 2, x: PROBLEMS.S4.truth.x })[2]; near(S4.fx, 0, 1e-9);
  const S1 = trueForces(PROBLEMS.S1); near(S1[0].fx, -S1[1].fx);
});

test('E1 Solve it: the correct order solves, in any dependency-respecting order', () => {
  for (const id of PROBLEM_IDS) {
    const p = PROBLEMS[id], order = correctOrder(p), c = checkSolution(p, order);
    assert.equal(c.solved, true, id); assert.equal(c.score, Object.keys(p.steps).length);
    assert.equal(studentModel(p, order).changed, false, `${id}: correct blocks imply the true physics`);
    const q = checkQuantities(p, correctPlacement(p)); assert.equal(q.solved, true, `${id} step 1`);
    assert.ok(shuffled(p.blocks.map(b => b.id), 3).length === p.blocks.length);
  }
  // S2: the two pair forces commute
  const p = PROBLEMS.S2;
  assert.equal(checkSolution(p, ['b-ok', 'a-ok', 'c-ok', 'd-ok']).solved, true);
  assert.equal(checkSolution(p, ['c-ok', 'a-ok', 'b-ok', 'd-ok']).blocks[0].status, 'order');
});

test('E1 Solve it: distractors are flagged and change the ghost force', () => {
  const p = PROBLEMS.S1;
  const c = checkSolution(p, ['u-ok', 's-nosq', 'd-ok', 't-ok']);
  assert.equal(c.solved, false); assert.equal(c.blocks[1].status, 'misconception');
  const m = studentModel(p, ['u-ok', 's-nosq', 'd-ok', 't-small']);
  near(m.forces[1][0], -0.4494, 1e-3); near(m.forces[0][0], 0.6 * p.truth.F12);
  const s3m = studentModel(PROBLEMS.S3, ['a-ok', 'b-ok', 'c-ok', 'd-calc']).forces[2];
  const tru = trueForces(PROBLEMS.S3)[2];
  near(s3m[0], -tru.fx, 1e-9); near(s3m[1], -tru.fy, 1e-9);           // the calculator angle points the opposite way
  assert.equal(studentModel(PROBLEMS.S4, ['a-ok', 'b-ok', 'c-noroot', 'd-ok']).x, 0.08);
  // ghost q₃ placed at the wrong x feels a non-zero net force
  const f = netForce([{ q: 1e-6, x: 0, y: 0 }, { q: 9e-6, x: 0.8, y: 0 }, { q: 2e-6, x: 0.4, y: 0 }], 2);
  assert.ok(Math.abs(f.fx) > 0.5);
});

test('s3 formats three significant figures with a real minus sign', () => {
  assert.equal(s3(1.498), '1.50'); assert.equal(s3(-0.1498), '−0.150'); assert.equal(a1(139.844), '139.8'); assert.equal(a1(-40.156), '−40.2');
  assert.match(s3(1.498e12), /1\.50 × 10¹²/);
});
