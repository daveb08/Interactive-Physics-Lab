import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProblem, sampleScenario, SAMPLES, newScenario, cleanScenario, scenarioErrors, encodeScenario, decodeScenario, scenarioFile, parseScenarioJson } from '../modules/electromagnetism/em-builder.js';
import { PROBLEMS, studentModel, trueForces } from '../modules/electromagnetism/solve-problems.js';
import { checkSolution, checkQuantities, correctOrder, correctPlacement } from '../modules/newtons-laws/solve-check.js';
import { netForce } from '../js/core/electrostatics.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

/** Structural checks every built problem must pass, the same as the hand-made ones. */
function wellFormed(p, label) {
  for (const step of Object.keys(p.steps)) assert.equal(p.blocks.filter(b => b.correct && b.step === step).length, 1, `${label} ${step}: one correct block`);
  const ids = new Set();
  for (const b of p.blocks) {
    assert.ok(!ids.has(b.id), `${label}: duplicate id ${b.id}`); ids.add(b.id);
    assert.ok(p.steps[b.step], `${label} ${b.id}: step`);
    for (const s of b.after || []) assert.ok(p.steps[s], `${label} ${b.id}: after ${s}`);
    if (!b.correct) assert.ok(b.feedback?.length > 30, `${label} ${b.id}: feedback`);
    assert.doesNotMatch(b.text, /NaN|undefined|Infinity|null/, `${label} ${b.id}`);
    if (b.answer) {
      assert.ok(b.answer.key in p.truth && p.units[b.answer.key], `${label} ${b.id}: answer key`);
      const ok = Math.abs(b.answer.value - p.truth[b.answer.key]) <= 0.005 * Math.abs(p.truth[b.answer.key]) + 1e-9;
      if (b.correct) assert.ok(ok, `${label} ${b.id}: correct block states the engine value`);
    }
  }
  for (const q of p.quantities) { assert.doesNotMatch(q.text, /NaN|undefined/); if (q.role === 'none') assert.ok(q.feedback); }
  assert.ok(p.blocks.some(b => !b.correct), `${label}: has mistakes`);
  const order = correctOrder(p);
  assert.equal(checkSolution(p, order).solved, true, `${label}: correct order solves`);
  assert.equal(checkQuantities(p, correctPlacement(p)).solved, true, `${label}: step 1 solvable`);
  assert.equal(studentModel(p, order).changed, false, `${label}: correct blocks imply the true physics`);
  assert.doesNotMatch(p.statement, /NaN|undefined/);
}

test('builder samples S1–S4 reproduce the hand-made problems’ answers', () => {
  const map = { S1: { F21: 'F21', angT: 'ang21', F12: 'F12' }, S2: { F21: 'F21', F23: 'F23', Fnet: 'Fnet' }, S3: { F31: 'F31', F32: 'F32', Fnet: 'Fnet', angle: 'angle' }, S4: { x: 'x' } };
  for (const [id, keys] of Object.entries(map)) {
    const { problem } = buildProblem(sampleScenario(id));
    for (const [k, hk] of Object.entries(keys)) near(problem.truth[k], PROBLEMS[id].truth[hk], 1e-9);
  }
});

test('every sample builds a well-formed, solvable problem', () => {
  for (const id of Object.keys(SAMPLES)) { const r = buildProblem(sampleScenario(id)); assert.ok(!r.errors, `${id}: ${r.errors}`); wellFormed(r.problem, id); }
});

test('the built truth agrees with superposition on the plane, for the target charge', () => {
  for (const id of ['S2', 'S3', 'square']) {
    const sc = sampleScenario(id), { problem } = buildProblem(sc);
    const f = netForce(sc.charges.map(c => ({ q: c.uC * 1e-6, x: c.x, y: c.y })), sc.target);
    if ('angle' in problem.truth) { near(problem.truth.Fnet, f.magnitude); near(problem.truth.Fx, f.fx); }
    else near(Math.abs(problem.truth.Fnet), f.magnitude);
    const tf = trueForces(problem)[sc.target]; near(tf.fx, f.fx); near(tf.fy, f.fy);
  }
});

test('balance points: the built x gives zero net force on q₃ (like and unlike, either order)', () => {
  const cases = [[1, 9], [9, 1], [2, 2], [-2, 8], [8, -2], [2.5, -10], [-5, -1.5]];
  for (const [a, b] of cases) {
    const sc = newScenario({ kind: 'balance', charges: [{ uC: a, x: 0.2, y: 0.3 }, { uC: b, x: 0.6, y: 0.3 }], third: { uC: 1.5 } });
    const r = buildProblem(sc); assert.ok(!r.errors, `${a},${b}: ${r.errors}`);
    const p = r.problem; wellFormed(p, `balance ${a},${b}`);
    const f = netForce([{ q: a * 1e-6, x: 0, y: 0 }, { q: b * 1e-6, x: 0.4, y: 0 }, { q: 1.5e-6, x: p.truth.x, y: 0 }], 2);
    near(f.fx, 0, 1e-9);
    if (a * b > 0) assert.ok(p.truth.x > 0 && p.truth.x < 0.4); else assert.ok(p.truth.x < 0 || p.truth.x > 0.4);
    for (const blk of p.blocks.filter(x => x.effect?.x !== undefined)) assert.ok(Math.abs(blk.effect.x - p.truth.x) > 1e-6, `${a},${b} ${blk.id}: ghost differs`);
  }
});

test('property: random 2–4 charge layouts always build solvable problems with honest mistakes', () => {
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  let built = 0;
  for (let trial = 0; trial < 400; trial++) {
    const n = 2 + Math.floor(rnd() * 3), charges = [];
    while (charges.length < n) {
      const c = { uC: (Math.floor(rnd() * 40) - 20) / 2 || 1, x: Math.round((0.05 + rnd() * 0.9) * 100) / 100, y: Math.round((0.05 + rnd() * 0.5) * 100) / 100 };
      if (rnd() < 0.3 && charges.length) c.y = charges[0].y;                                 // some collinear layouts
      if (charges.every(o => Math.hypot(o.x - c.x, o.y - c.y) >= 0.05)) charges.push(c);
    }
    const sc = newScenario({ charges, target: Math.floor(rnd() * n), origin: Math.floor(rnd() * n), thirdLaw: rnd() < 0.5 });
    const r = buildProblem(sc); assert.ok(!r.errors, JSON.stringify(sc));
    wellFormed(r.problem, `trial ${trial}`); built++;
    // each distractor that changes the physics implies a force different from the truth
    const truth = trueForces(r.problem);
    for (const b of r.problem.blocks.filter(x => x.effect?.force)) {
      const t = truth[b.effect.on];
      assert.ok(Math.hypot(b.effect.force[0] - t.fx, b.effect.force[1] - t.fy) > 1e-6 * t.magnitude, `trial ${trial} ${b.id}`);
    }
  }
  assert.equal(built, 400);
});

test('scenario errors: overlap, zero charge, balance off-line or ±equal', () => {
  assert.match(scenarioErrors(newScenario({ charges: [{ uC: 1, x: 0.3, y: 0.3 }, { uC: 2, x: 0.32, y: 0.3 }] })).join(), /closer than 4 cm/);
  assert.match(scenarioErrors(newScenario({ charges: [{ uC: 0, x: 0.3, y: 0.3 }, { uC: 2, x: 0.6, y: 0.3 }] })).join(), /zero charge/);
  assert.match(scenarioErrors(newScenario({ kind: 'balance', charges: [{ uC: 1, x: 0.3, y: 0.3 }, { uC: 2, x: 0.6, y: 0.4 }] })).join(), /same horizontal line/);
  assert.match(scenarioErrors(newScenario({ kind: 'balance', charges: [{ uC: 2, x: 0.3, y: 0.3 }, { uC: -2, x: 0.6, y: 0.3 }] })).join(), /no balance point/);
  assert.ok(buildProblem(newScenario({ charges: [{ uC: 1, x: 0.3, y: 0.3 }] })).errors);
});

test('cleanScenario whitelists, clamps and rounds untrusted input', () => {
  const c = cleanScenario({ kind: 'evil', charges: [{ uC: 99, x: -5, y: 9, extra: '<script>' }, { uC: '2.3', x: 0.456, y: 0.3 }], target: 7, title: 42, statement: 'x'.repeat(5000) });
  assert.equal(c.kind, 'force'); assert.deepEqual(c.charges[0], { uC: 10, x: 0.02, y: 0.58 }); assert.deepEqual(c.charges[1], { uC: 2.5, x: 0.46, y: 0.3 });
  assert.equal(c.target, 1); assert.equal(c.title, ''); assert.equal(c.statement.length, 2000);
});

test('share links and files round-trip to the same problem', () => {
  const sc = { ...sampleScenario('S3'), title: 'Corner charge ✓ μC' };
  const code = encodeScenario(sc), back = decodeScenario(code);
  assert.ok(back.problem); assert.equal(back.problem.title, 'Corner charge ✓ μC'); near(back.problem.truth.angle, buildProblem(sc).problem.truth.angle);
  assert.ok(parseScenarioJson(scenarioFile(sc)).problem);
  assert.ok(decodeScenario('zzz').errors); assert.ok(decodeScenario('e%%%').errors);
  assert.ok(parseScenarioJson('{"a":1}').errors); assert.ok(parseScenarioJson('not json').errors);
});

test('a hand-edited statement is kept; otherwise it is written from the diagram', () => {
  const sc = { ...sampleScenario('S1'), autoStatement: false, statement: 'My own wording.' };
  assert.equal(buildProblem(sc).problem.statement, 'My own wording.');
  assert.match(buildProblem(sampleScenario('S1')).problem.statement, /\+3\.0 μC charge q₁ is at the origin/);
});
