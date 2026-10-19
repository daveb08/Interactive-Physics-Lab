import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLES, sampleScenario, newScenario, buildProblem, physics, setValue, readProblemText, QUANTITIES } from '../modules/newtons-laws/problem-builder.js';
import { validateProblem, lintProblem, engineCheck, cleanProblem } from '../modules/newtons-laws/problem-format.js';
import { checkSolution, checkQuantities, correctOrder, correctPlacement } from '../modules/newtons-laws/solve-check.js';
import { createRun, sampleAt } from '../js/core/physics.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test('every sample builds a valid problem with no warnings and answers that match the simulation', () => {
  for (const id of Object.keys(SAMPLES)) {
    const r = buildProblem(sampleScenario(id));
    assert.deepEqual(r.issues, [], id);
    const p = cleanProblem(r.problem);
    assert.deepEqual(validateProblem(p), [], id);
    assert.deepEqual(lintProblem(p), [], id);
    for (const c of engineCheck(p)) assert.ok(c.ok, `${id} ${c.step}: ${c.stated} vs ${c.sim}`);
    assert.equal(checkSolution(p, correctOrder(p)).solved, true);
    assert.equal(checkQuantities(p, correctPlacement(p)).solved, true);
    assert.ok(p.quantities.some(q => q.role === 'none'), `${id} has trap cards`);
  }
});

test('the pallet sample reproduces the hand-written S4 numbers and its usual mistakes', () => {
  const p = buildProblem(sampleScenario('pallet')).problem;
  const text = p.blocks.map(b => b.text).join('\n');
  assert.match(text, /f = μk N = 0\.25 × 1177 = 294\.3 N, opposite the motion \(−x\)/);
  assert.match(text, /F_net = F − f = 400 − 294\.3 = 105\.7 N/);
  assert.match(text, /a = F_net \/ m = 105\.7 \/ 120 = 0\.8808 m\/s²/);
  assert.match(text, /f = μs N = 0\.3 × 1177 = 353\.2 N/);                                    // static-for-kinetic mistake
  assert.match(text, /F_net = F = 400 N/);                             // friction ignored
  assert.deepEqual(Object.keys(p.steps), ['N', 'slides', 'f', 'Fnet', 'a', 'v']);
  assert.deepEqual(p.blocks.find(b => b.id === 'f-ok').after, ['N', 'slides']);
});

test('physics() agrees with the simulation engine over many random scenarios', () => {
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < 300; i++) {
    const friction = rnd() < 0.6, muK = Math.round(rnd() * 60) / 100, muS = Math.min(1, muK + 0.05 + Math.round(rnd() * 30) / 100);
    const sc = newScenario({ mass: 1 + Math.round(rnd() * 100), force: Math.round((rnd() - 0.3) * 200), v0: rnd() < 0.4 ? 0 : Math.round((rnd() - 0.3) * 10), t: 0.5 + Math.round(rnd() * 8) / 2, friction, muS, muK });
    const V = physics(sc);
    const run = createRun({ mass: sc.mass, force: sc.force, velocity: sc.v0, frictionEnabled: friction, muS, muK }, { duration: 30 });
    const s0 = sampleAt(run, 0);
    near(s0.a, V.a, 1e-9);
    if (V.timeValid && sc.t <= run.endTime) { const s = sampleAt(run, sc.t); near(s.v, V.v, 1e-9); near(s.x, V.x, 1e-9); }
    if (V.tstop !== null && friction && V.tstop <= run.endTime) { near(sampleAt(run, V.tstop).v, 0, 1e-9); near(sampleAt(run, V.tstop).x, V.dstop, 1e-9); }
  }
});

test('random role choices: whatever builds is valid, checks against the simulation, and is solvable', () => {
  let seed = 11; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const keys = Object.keys(QUANTITIES);
  let built = 0;
  for (let i = 0; i < 400; i++) {
    const friction = rnd() < 0.5, muK = 0.1 + Math.round(rnd() * 40) / 100;
    const roles = Object.fromEntries(keys.map(k => [k, QUANTITIES[k].input ? (rnd() < 0.75 ? 'given' : k === 'muS' ? 'hidden' : 'find') : ['given', 'find', 'hidden', 'hidden'][Math.floor(rnd() * 4)]]));
    const sc = newScenario({ figure: ['cart', 'crate', 'pallet', 'sprinter'][i % 4], mass: 2 + Math.round(rnd() * 50), force: Math.round(rnd() * 120), v0: rnd() < 0.5 ? 0 : Math.round(rnd() * 8), t: 1 + Math.round(rnd() * 4), friction, muK, muS: Math.min(1, muK + 0.1), roles });
    const r = buildProblem(sc);
    if (!r.problem) { assert.ok(r.issues.length, 'no problem means a reason is given'); continue; }
    built++;
    const p = cleanProblem(r.problem);
    assert.deepEqual(validateProblem(p), [], JSON.stringify(sc));
    for (const c of engineCheck(p)) assert.ok(c.ok, `${c.step}: ${c.stated} vs ${c.sim} in ${JSON.stringify(sc)}`);
    assert.equal(checkSolution(p, correctOrder(p)).solved, true);
    for (const b of p.blocks) assert.ok(b.text.length <= 300 && (b.correct || b.feedback));
  }
  assert.ok(built > 80, `only ${built} of 400 random scenarios built`);
});

test('missing information and impossible times are explained instead of built', () => {
  const sc = newScenario({ roles: { m: 'hidden', a: 'find', v: 'hidden', x: 'hidden' } });
  assert.match(buildProblem(sc).issues.join(' '), /cannot work out the acceleration.*Also give: .*mass/);
  const late = sampleScenario('stop'); late.t = 5; late.roles.v = 'find'; late.roles.t = 'given';
  assert.match(buildProblem(late).issues.join(' '), /stops at 3\.058 s, before t = 5 s/);
  const mu = newScenario({ friction: true, muS: 0.2, muK: 0.25 });
  assert.match(buildProblem(mu).issues.join(' '), /must be greater than/);
  assert.match(buildProblem(newScenario({ roles: { a: 'hidden', v: 'hidden', x: 'hidden' } })).issues.join(' '), /at least one quantity/);
});

test('setting a value on the diagram adjusts the input that produces it', () => {
  let sc = sampleScenario('pallet');
  sc = setValue(sc, 'a', 1.5).sc; near(physics(sc).a, 1.5);
  sc = setValue(sc, 'N', 981).sc; near(sc.mass, 100);
  assert.match(setValue(sc, 'f', -196.2).error, /positive/);
  sc = setValue(sc, 'f', 196.2).sc; near(physics(sc).muK, 0.2); assert.ok(sc.muS > sc.muK);
  sc = setValue(sc, 'v', 4).sc; near(physics(sc).v, 4);
  sc = setValue(sc, 'x', 3).sc; near(physics(sc).x, 3);
  const stop = setValue(sampleScenario('stop'), 'dstop', 12).sc; near(physics(stop).dstop, 12);
  assert.ok(setValue(sampleScenario('pallet'), 'a', 0.0001).error, 'a tiny push cannot overcome static friction');
  assert.ok(setValue(sampleScenario('cart'), 'f', -3).error, 'friction needs friction on');
});

test('reading written problems: numbers, friction, rest, what is asked, and the object', () => {
  const a = readProblemText('A worker pushes a 120 kg pallet of bricks across a level concrete floor with a constant horizontal force of 400 N. For pallet on concrete, μs = 0.30 and μk = 0.25. The pallet starts from rest. Find the normal force, the friction force, the net force, the acceleration and the speed after 2.0 s.');
  assert.equal(a.sc.figure, 'pallet');
  assert.deepEqual([a.sc.mass, a.sc.force, a.sc.v0, a.sc.t, a.sc.muS, a.sc.muK, a.sc.friction], [120, 400, 0, 2, 0.3, 0.25, true]);
  assert.deepEqual(a.asked.sort(), ['F_net', 'N', 'a', 'f', 'v'].sort());
  assert.deepEqual(buildProblem(a.sc).issues, []);
  assert.equal(buildProblem(a.sc).problem.statement, a.sc.statement, 'the instructor’s own wording is kept');

  const b = readProblemText('A 60 kg sprinter accelerates from rest to 9 m/s in 3 s. What is the net force on her?');
  assert.equal(b.sc.figure, 'sprinter'); near(physics(b.sc).v, 9); assert.deepEqual(b.asked, ['F_net']);
  assert.deepEqual(buildProblem(b.sc).order, ['a', 'Fnet']);

  const c = readProblemText('A 1500 kg car traveling at 20 m/s brakes and slides to a stop. The coefficient of kinetic friction is 0.7. How far does it slide before stopping?');
  assert.equal(c.sc.force, 0); assert.equal(c.sc.roles.F, 'given'); assert.deepEqual(c.asked, ['d_stop']);
  near(Math.abs(physics(c.sc).dstop), 400 / (2 * 0.7 * 9.81));

  const d = readProblemText('A 25 kg box starts from rest and accelerates at 1.2 m/s² across a floor where the coefficient of kinetic friction is 0.30. What horizontal force is applied?');
  assert.deepEqual(d.asked, ['F']); near(physics(d.sc).a, 1.2);
  assert.deepEqual(buildProblem(d.sc).order, ['N', 'f', 'Fnet', 'F']);
});

import { updateStatementNumbers } from '../modules/newtons-laws/problem-builder.js';
test('changing a value on the diagram updates that number in the instructor’s own wording', () => {
  const { sc } = readProblemText('A worker pushes a 120 kg pallet with a force of 400 N. μs = 0.30 and μk = 0.25. It starts from rest. Find the acceleration after 2.0 s.');
  let after = setValue(sc, 'm', 150).sc;
  assert.equal(updateStatementNumbers(sc.statement, sc, after), 'A worker pushes a 150 kg pallet with a force of 400 N. μs = 0.30 and μk = 0.25. It starts from rest. Find the acceleration after 2.0 s.');
  after = setValue(sc, 'muK', 0.2).sc;
  assert.match(updateStatementNumbers(sc.statement, sc, after), /μk = 0\.2\./);
  after = setValue(sc, 't', 3).sc;
  assert.match(updateStatementNumbers(sc.statement, sc, after), /after 3 s/);
  assert.equal(readProblemText('A 2 kg cart moves at 3 m/s.', sampleScenario('stop')).sc.friction, false, 'friction is not carried over from the previous problem');
});

import { editValue } from '../modules/newtons-laws/problem-builder.js';
test('editing keeps the values the problem states; the unstated push is re-solved', () => {
  const { sc } = readProblemText('A 60 kg sprinter accelerates from rest to 9 m/s in 3 s. What is the net force on her?');
  const r = editValue(sc, 'm', 80);
  near(physics(r.sc).v, 9); near(r.sc.force, 240); assert.match(r.note, /Kept the stated velocity/);
  assert.equal(updateStatementNumbers(sc.statement, sc, r.sc), 'A 80 kg sprinter accelerates from rest to 9 m/s in 3 s. What is the net force on her?');
  const p = sampleScenario('pallet');                                   // F is stated: nothing else is held
  near(editValue(p, 'm', 100).sc.force, 400);
});
