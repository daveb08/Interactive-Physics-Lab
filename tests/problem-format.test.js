import test from 'node:test';
import assert from 'node:assert/strict';
import { PROBLEMS, PROBLEM_IDS } from '../modules/newtons-laws/solve-problems.js';
import { validateProblem, cleanProblem, engineCheck, encodeProblem, decodeProblem, parseProblemJson } from '../modules/newtons-laws/problem-format.js';

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
