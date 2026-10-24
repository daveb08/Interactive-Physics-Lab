import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAssignment, assignmentQuery, assignmentPlanet, encodeSubmission, decodeSubmission, grade, gradeBatch, gradesCsv, keyCheck, makeKey, questionFor, DEFAULTS } from '../modules/lab-bench/grading.js';
import { planetFor } from '../js/core/lab-noise.js';
import { fallTime, BALLS } from '../js/core/freefall-drag.js';
import { idealFitG } from '../modules/lab-bench/notebook-model.js';

const A = parseAssignment('?a=PHY1201-F26&t=3,15&u=15&n=3x5&air=any');

test('assignment links: defaults, round trip, practice is not an assignment, silly values clamped', () => {
  assert.equal(parseAssignment(''), null); assert.equal(parseAssignment('?a=practice'), null);
  const d = parseAssignment('?a=Lab1');
  assert.deepEqual({ ...d, code: undefined, keyCheck: undefined }, { ...DEFAULTS, code: undefined, keyCheck: undefined });
  assert.equal(d.code, 'lab1');
  const a = { ...A, keyCheck: keyCheck('amber-orbit-42') };
  assert.deepEqual(parseAssignment('?' + assignmentQuery(a)), a);
  const odd = parseAssignment('?a=x&t=-4,999&n=1x100&u=0&air=mars');
  assert.deepEqual([odd.tolGate, odd.tolWatch, odd.heights, odd.trials, odd.maxRel, odd.air], [0.5, 50, 2, 20, 1, 'any']);
});

test('the assignment planet: same as the seeded planet; "no air" removes the air only', () => {
  const p = assignmentPlanet('AB-12', A); assert.deepEqual(p, planetFor('AB-12', 'phy1201-f26'));
  const none = assignmentPlanet('AB-12', { ...A, air: 'none' }); assert.equal(none.g, p.g); assert.equal(none.rho, 0);
});

test('grading key: the link carries only a check value', () => {
  let i = 0; const r = () => [0.1, 0.5, 0.3][i++ % 3];
  const k = makeKey(r); assert.match(k, /^[a-z]+-[a-z]+-\d\d$/);
  assert.equal(keyCheck(k), keyCheck(` ${k.toUpperCase()} `)); assert.notEqual(keyCheck(k), keyCheck(k + 'x'));
});

const sub = { code: 'phy1201-f26', id: 'Jo Smith-7', g: 9.8, dg: 0.05, timer: 'gate', ball: 'steel', heights: [[400, 5], [1000, 5], [1800, 5]], answer: 'a' };

test('completion codes: short, round trip, any edit fails the checksum, damaged codes are explained', () => {
  const c = encodeSubmission(sub);
  assert.match(c, /^LB-[A-Za-z0-9_-]+$/);
  assert.ok(c.length <= 50, `code is ${c.length} characters`);
  const d = decodeSubmission(c, sub.code); assert.equal(d.ok, true);
  assert.deepEqual(d.sub, { ...sub, id: 'josmith7' });
  assert.equal(decodeSubmission(c.slice(0, -6), sub.code).ok, false);
  assert.equal(decodeSubmission('hello').error, 'not a Lab Bench completion code');
  // change one byte inside the code: the checksum catches it
  const bytes = Buffer.from(c.slice(3), 'base64url'); bytes[5] ^= 1;
  const forged = decodeSubmission('LB-' + bytes.toString('base64url'), sub.code);
  assert.equal(forged.ok, false); assert.match(forged.error, /edited|damaged/);
  // a code made for another assignment is named as such
  assert.match(decodeSubmission(c, 'other-assignment').error, /different assignment/);
  assert.equal(decodeSubmission(` ${c.slice(0, 20)}\n ${c.slice(20)} `, sub.code).ok, true);   // wrapped by a text box
  // tiny uncertainties are never rounded to zero
  assert.equal(decodeSubmission(encodeSubmission({ ...sub, dg: 0.0002 }), sub.code).sub.dg, 0.001);
});

test('older LB1- codes (first format) still decode and grade', () => {
  const b64 = s => Buffer.from(s).toString('base64url');
  const { hash32 } = { hash32: str => { let h = 0x811c9dc5; for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; } };
  const payload = ['1', 'phy1201-f26', 'josmith7', 9.8, 0.05, 'gate', 'steel', '400:5;1000:5;1800:5', 'a'].join('|');
  const old = 'LB1-' + b64(`${payload}|${hash32(`ipl-lab-bench-1·g|${payload}`).toString(36).padStart(7, '0')}`);
  const d = decodeSubmission(old); assert.equal(d.ok, true); assert.equal(d.sub.code, 'phy1201-f26'); assert.equal(d.sub.g, 9.8);
  const rows = gradeBatch(`Jo,${old}`, A); assert.equal(rows.length, 1); assert.ok(rows[0].result);
  const forged = decodeSubmission('LB1-' + b64(`${payload.replace('|9.8|', '|9.81|')}|xxxxxxx`));
  assert.equal(forged.ok, false); assert.match(forged.error, /edited/);
});

test('rubric: each check passes and fails at its boundary', () => {
  const p = assignmentPlanet('rubric-1', A), G = p.g, H = [[400, 5], [1000, 5], [1800, 5]];
  const ideal = idealFitG(H.map(([mm]) => mm / 1000), h => fallTime({ g: G, ball: BALLS.steel, rho: p.rho }, h));
  const base = { code: A.code, id: 'rubric-1', timer: 'gate', ball: 'steel', heights: H, answer: 'a', g: ideal, dg: ideal * 0.01 };
  const r = grade(base, A); assert.equal(r.score, 4, JSON.stringify(r.checks));
  const by = s => Object.fromEntries(grade(s, A).checks.map(c => [c.id, c.pass]));
  // value: 3 % with the timer, 15 % with the stopwatch
  assert.equal(by({ ...base, g: G * 1.029, dg: G * 0.1 }).value, true); assert.equal(by({ ...base, g: G * 1.031, dg: G * 0.1 }).value, false);
  assert.equal(by({ ...base, timer: 'watch', g: G * 1.14, dg: G * 0.14 }).value, true);
  // uncertainty: must reach the drag-corrected value within 2 δg, and δg/g at most 15 %
  assert.equal(by({ ...base, g: ideal + 0.019, dg: 0.01 }).uncertainty, true); assert.equal(by({ ...base, g: ideal + 0.021, dg: 0.01 }).uncertainty, false);
  assert.equal(by({ ...base, dg: ideal * 0.16 }).uncertainty, false);
  // method: 3 heights with 5 drops each
  assert.equal(by({ ...base, heights: [[400, 5], [1000, 5], [1800, 4]] }).method, false);
  assert.equal(by({ ...base, heights: [[300, 5], [400, 5], [1000, 5], [1800, 1]] }).method, true);
  // explanation: the first answer must be right; the question follows timer, ball and air
  assert.equal(by({ ...base, answer: 'b' }).explanation, false); assert.equal(by({ ...base, answer: '' }).explanation, false);
  assert.equal(questionFor({ timer: 'watch', ball: 'steel', rho: 0 }), 'watch');
  assert.equal(questionFor({ timer: 'gate', ball: 'pingpong', rho: 1.2 }), 'drag');
  assert.equal(questionFor({ timer: 'gate', ball: 'pingpong', rho: 0.02 }), 'height');
});

test('batch grading: codes found inside any pasted text, later codes replace earlier, wrong assignment and copied data flagged, CSV', () => {
  const mk = (id, extra = {}) => encodeSubmission({ ...sub, id, ...extra });
  const text = `Name,Submission\nAnn,${mk('ann', { g: 9.7 })}\nBen,"${mk('ben', { g: 9.5 })}"\nAnn,${mk('ann', { g: 9.75 })}\n`
    + `Cat,${mk('cat', { g: 9.5 })}\nDee,${encodeSubmission({ ...sub, id: 'dee', code: 'other' })}\nEd,${mk('ed').slice(0, -5)}x`;
  const rows = gradeBatch(text, A);
  assert.equal(rows.length, 6);
  assert.equal(rows[0].replaced, true); assert.equal(rows[2].replaced, undefined);
  assert.match(rows[1].flags[0], /same data as cat/); assert.match(rows[3].flags[0], /same data as ben/);
  assert.match(rows[4].error, /different assignment/); assert.ok(rows[5].error);
  const csv = gradesCsv(rows).trim().split('\n');
  assert.equal(csv.length, 4);   // header + ann (latest), ben, cat
  assert.match(csv[0], /^student_id,score,out_of,value/);
  assert.match(csv.find(l => l.startsWith('"ann"')), /,9\.75,/);
});
