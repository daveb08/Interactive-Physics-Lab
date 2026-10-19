import test from 'node:test';
import assert from 'node:assert/strict';
import { PROBLEMS, PROBLEM_IDS } from '../modules/newtons-laws/solve-problems.js';
import { validateProblem, lintProblem, quantitiesIn, forcesAt, cleanProblem, engineCheck, encodeProblem, decodeProblem, parseProblemJson } from '../modules/newtons-laws/problem-format.js';

const clone = o => JSON.parse(JSON.stringify(o));

test('all built-in problems are valid authored problems and pass the engine check', () => {
  for (const id of PROBLEM_IDS) {
    const p = cleanProblem(clone(PROBLEMS[id]));
    assert.deepEqual(validateProblem(p), [], id);
    for (const r of engineCheck(p)) if (!(id === 'S2' && r.key === 'v')) assert.ok(r.ok, `${id} ${r.step}: stated ${r.stated} vs sim ${r.sim}`);
  }
});

test('validation catches the common authoring mistakes with readable messages', () => {
  const p = cleanProblem(clone(PROBLEMS.S1));
  p.blocks.find(b => b.id === 'v-no-v0').feedback = '';
  p.blocks.push({ id: 'v-ok2', step: 'velocity', correct: true, text: 'another correct one' });
  p.quantities = p.quantities.filter(q => q.role !== 'unknown');
  p.targetTime = 99;
  const e = validateProblem(p).join(' | ');
  assert.match(e, /needs misconception feedback/);
  assert.match(e, /exactly one correct block \(it has 2\)/);
  assert.match(e, /at least one Unknown card/);
  assert.match(e, /Target time/);
});

test('dependency loops are reported', () => {
  const p = cleanProblem(clone(PROBLEMS.S1));
  p.blocks.find(b => b.id === 'f-ok').after = ['law'];
  assert.match(validateProblem(p).join(' '), /loop/);
});

test('clean drops unknown fields and keeps only whitelisted figures', () => {
  const raw = { ...clone(PROBLEMS.S3), script: 'alert(1)', figure: 'rocket' };
  raw.blocks[0].onclick = 'x';
  const c = cleanProblem(raw);
  assert.equal(c.script, undefined); assert.equal(c.figure, undefined); assert.equal(c.blocks[0].onclick, undefined);
  assert.equal(cleanProblem(clone(PROBLEMS.S3)).figure, 'sprinter');
});

test('engine check flags a stated answer that disagrees with the simulation', () => {
  const p = cleanProblem(clone(PROBLEMS.S1));
  p.blocks.find(b => b.id === 'v-ok').answer.value = 10;
  const bad = engineCheck(p).find(r => r.id === 'v-ok');
  assert.equal(bad.ok, false); assert.ok(Math.abs(bad.sim - 9.5) < 1e-9);
});

test('share link round-trips (compressed) and rejects damaged links', async () => {
  const code = await encodeProblem(PROBLEMS.S4);
  assert.equal(code[0], 'z');
  const { problem, errors } = await decodeProblem(code);
  assert.equal(errors, undefined);
  assert.deepEqual(problem, cleanProblem(clone(PROBLEMS.S4)));
  assert.ok(code.length < 4000, `link payload ${code.length} chars`);
  assert.ok((await decodeProblem('zAAAA')).errors);
  assert.ok((await decodeProblem('q123')).errors);
  assert.ok(parseProblemJson('{not json').errors);
});

test('warnings: built-in problems produce none', () => {
  for (const id of PROBLEM_IDS) assert.deepEqual(lintProblem(cleanProblem(clone(PROBLEMS[id]))), [], id);
});

test('warnings: statement vs settings, block arithmetic, plotted-answer mismatch, coverage', () => {
  const p = cleanProblem(clone(PROBLEMS.S1));
  p.setup.mass = 2;
  p.blocks.find(b => b.id === 'v-ok').text = 'v = 2.0 + 2.5 × 3.0 = +8.5 m/s';
  const x = p.blocks.find(b => b.id === 'x-ok'); delete x.answer; x.text = 'Use the position equation.';
  p.blocks.push({ id: 'w9', step: 'law', text: 'a = 3', feedback: 'no' });
  const w = lintProblem(p).join(' | ');
  assert.match(w, /mentions 4 kg, but the mass is set to 2 kg/);
  assert.match(w, /ends in 8.5 m\/s, but its plotted answer is 9.5/);
  assert.match(w, /simulation gives v = 17.000/);
  assert.match(w, /not checked against the simulation/);
  assert.match(w, /no ghost setting and no plotted answer/);
});

test('warnings: forces in block text are checked against applied, normal, friction and net forces', () => {
  const p = cleanProblem(clone(PROBLEMS.S4));
  p.blocks.find(b => b.id === 'fr-ok').text = 'f = −μk N = −250 N';
  assert.match(lintProblem(p).join(' '), /ends in -250 N/);
  const f = forcesAt(p, 2);
  assert.ok(Math.abs(f.normal - 1177.2) < 1e-9 && Math.abs(f.friction + 294.3) < 0.01 && Math.abs(f.net - 105.7) < 0.01);
});

test('unit parsing keeps m/s² distinct from m/s and m, and reads ramp angles', () => {
  const q = quantitiesIn('g = 9.81 m/s², v = 2.0 m/s, d = 4 m, t = 3.0 s, m = 4.0 kg, F = −5.9 N, θ = 30°');
  const by = u => q.filter(x => x.unit === u).map(x => x.value);
  assert.deepEqual(by('a'), [9.81]); assert.deepEqual(by('v'), [2]); assert.deepEqual(by('x'), [4]);
  assert.deepEqual(by('t'), [3]); assert.deepEqual(by('mass'), [4]); assert.deepEqual(by('force'), [-5.9]); assert.deepEqual(by('angle'), [30]);
});

import { resolveProblem, resolveText, placeholderValues, frictionError, prepareProblem } from '../modules/newtons-laws/problem-format.js';

test('friction rule for authored problems: 0 ≤ μk < μs ≤ 1', () => {
  assert.equal(frictionError(0.3, 0.25), null);
  assert.match(frictionError(0.3, 0.3), /must be greater than/);
  assert.match(frictionError(0.2, 0.25), /must be greater than/);
  assert.match(frictionError(4.3, 2.25), /at most 1/);
  assert.match(frictionError(0.3, -0.1), /negative/);
  const p = cleanProblem(clone(PROBLEMS.S4)); p.setup.muS = 0.25;
  assert.match(validateProblem(p).join(' '), /must be greater than the kinetic/);
});

test('placeholders fill settings, simulation results and timed values; unknown ones are reported', () => {
  const p = cleanProblem(clone(PROBLEMS.S4));
  const ctx = placeholderValues(p);
  assert.equal(resolveText('{m} kg, {F} N, μk {muK}, a {a}, v {v}, N {N}, f {f}, Fnet {Fnet}, fmax {fmax}, x(3) {x@3}', ctx),
    '120 kg, 400 N, μk 0.25, a 0.8808, v 1.762, N 1177, f −294.3, Fnet 105.7, fmax 353.2, x(3) 3.964');
  const probs = []; resolveText('{zz} {tstop} {q@2}', ctx, probs);
  assert.equal(probs.length, 3);
  assert.equal(resolveText('stops at {tstop} s', placeholderValues(cleanProblem(clone(PROBLEMS.S2)))), 'stops at 3.058 s');
});

test('resolveProblem fills text everywhere and blank plotted answers from the simulation', () => {
  const p = cleanProblem(clone(PROBLEMS.S1));
  p.statement = 'A {m} kg cart at +{v0} m/s, push {F} N. Find v after {t} s.';
  p.setup.velocity = 6;
  const v = p.blocks.find(b => b.id === 'v-ok'); v.text = 'v = {v0} + {a} × {t} = {v} m/s'; delete v.answer.value;
  const { problem, errors } = resolveProblem(p);
  assert.deepEqual(errors, []);
  assert.equal(problem.statement, 'A 4 kg cart at +6 m/s, push 10 N. Find v after 3 s.');
  assert.equal(problem.blocks.find(b => b.id === 'v-ok').text, 'v = 6 + 2.5 × 3 = 13.5 m/s');
  assert.equal(problem.blocks.find(b => b.id === 'v-ok').answer.value, 13.5);
  assert.ok(!prepareProblem(p).errors);
  assert.equal(p.statement.includes('{m}'), true, 'the source keeps its placeholders');
});

test('share links and files carry resolved values; raw files with placeholders load too', async () => {
  const p = cleanProblem(clone(PROBLEMS.S1)); p.statement = 'A {m} kg cart. Find a after {t} s please.';
  const { problem } = parseProblemJson(JSON.stringify(p));
  assert.equal(problem.statement, 'A 4 kg cart. Find a after 3 s please.');
  const { problem: fromLink } = await decodeProblem(await encodeProblem(problem));
  assert.equal(fromLink.statement, problem.statement);
});
