import test from 'node:test';
import assert from 'node:assert/strict';
import { fallAt, fallTime, terminalSpeed, BALLS, AIR } from '../js/core/freefall-drag.js';
import { stats, linearFit } from '../js/core/fit.js';
import { addTrial, deleteTrial, groupByHeight, analyse, progress, notebookCsv } from '../modules/lab-bench/notebook-model.js';
import { rk4Step as rk4 } from '../js/core/integrators.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);

test('free fall without air: y = ½gt², and fallTime inverts it', () => {
  const s = { g: 9.81 };
  near(fallAt(s, 0.5).y, 0.5 * 9.81 * 0.25); near(fallAt(s, 0.5).v, 4.905);
  near(fallTime(s, 2), Math.sqrt(4 / 9.81));
  assert.equal(fallAt(s, -1).y, 0);
});

test('quadratic drag: terminal speeds, inverse, and agreement with RK4 integration', () => {
  const pp = { g: 9.81, ball: BALLS.pingpong, rho: AIR.earth }, st = { ...pp, ball: BALLS.steel };
  near(terminalSpeed(BALLS.pingpong, 9.81, AIR.earth), 8.64, 2e-3);
  assert.ok(terminalSpeed(BALLS.steel, 9.81, AIR.earth) > 60);
  for (const h of [0.2, 1, 2]) near(fallAt(pp, fallTime(pp, h)).y, h, 1e-10);
  // the ping-pong ball takes measurably longer over 2 m; the steel ball barely
  assert.ok(fallTime(pp, 2) / fallTime({ g: 9.81 }, 2) > 1.02);
  assert.ok(fallTime(st, 2) / fallTime({ g: 9.81 }, 2) < 1.001);
  // numerical check: m v' = m g − ½ρC_dA v²
  const vt = terminalSpeed(BALLS.pingpong, 9.81, AIR.earth), k = 9.81 / (vt * vt);
  let state = [0, 0], t = 0; const h = 1e-3;
  const f = (_, [, v]) => [v, 9.81 - k * v * v];
  for (let i = 0; i < 600; i++) { state = rk4(f, t, state, h); t += h; }
  near(state[0], fallAt(pp, t).y, 1e-8); near(state[1], fallAt(pp, t).v, 1e-8);
  // vanishing air reduces to free fall
  near(fallTime({ g: 9.81, ball: BALLS.pingpong, rho: 1e-12 }, 1.5), fallTime({ g: 9.81 }, 1.5), 1e-9);
});

test('stats: mean, sample SD and standard error', () => {
  const s = stats([2, 4, 4, 4, 5, 5, 7, 9]);
  near(s.mean, 5); near(s.sd, Math.sqrt(32 / 7)); near(s.se, Math.sqrt(32 / 7) / Math.sqrt(8));
  assert.ok(Number.isNaN(stats([3]).sd));
});

test('linear fit: exact line, textbook standard errors, and refusal on a single x', () => {
  const exact = linearFit([0, 1, 2, 3].map(x => ({ x, y: 2 + 3 * x })));
  near(exact.slope, 3); near(exact.intercept, 2); near(exact.slopeSE, 0, 1e-12); near(exact.r2, 1);
  // hand-computed: x = 1..5, y = 2.1, 3.9, 6.2, 7.8, 10.1
  const f = linearFit([[1, 2.1], [2, 3.9], [3, 6.2], [4, 7.8], [5, 10.1]].map(([x, y]) => ({ x, y })));
  near(f.slope, 1.99, 1e-12); near(f.intercept, 0.05, 1e-9);
  const ssr = [[1, 2.1], [2, 3.9], [3, 6.2], [4, 7.8], [5, 10.1]].reduce((s, [x, y]) => s + (y - 0.05 - 1.99 * x) ** 2, 0);
  near(f.slopeSE, Math.sqrt(ssr / 3 / 10));
  assert.throws(() => linearFit([{ x: 1, y: 1 }, { x: 1, y: 2 }]), RangeError);
});

test('the fit recovers g from noisy simulated stopwatch data within its uncertainty about 95% of the time', () => {
  let seed = 11; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
  let covered = 0; const runs = 400;
  for (let r = 0; r < runs; r++) {
    let book = [];
    for (const h of [0.5, 1.0, 1.5, 2.0]) for (let i = 0; i < 5; i++) book = addTrial(book, { object: 'steel', timer: 'stopwatch', h, t: Math.sqrt(2 * h / 9.81) + 0.04 * gauss() });
    const a = analyse(book);
    if (Math.abs(a.g - 9.81) <= 2 * a.gSE) covered++;
  }
  assert.ok(covered / runs > 0.9 && covered / runs < 0.995, `coverage ${covered / runs}`);
});

test('why t² goes on the vertical axis: fitting h against t² biases g low with stopwatch scatter', () => {
  let seed = 5; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
  let gWrong = 0, gRight = 0; const runs = 300;
  for (let r = 0; r < runs; r++) {
    const pts = []; for (const h of [0.5, 1, 1.5, 2]) for (let i = 0; i < 5; i++) pts.push({ h, t: Math.sqrt(2 * h / 9.81) + 0.04 * gauss() });
    gWrong += 2 * linearFit(pts.map(p => ({ x: p.t * p.t, y: p.h }))).slope / runs;
    gRight += 2 / linearFit(pts.map(p => ({ x: p.h, y: p.t * p.t }))).slope / runs;
  }
  assert.ok(gWrong < 9.2, `h vs t² gives ${gWrong}`); assert.ok(Math.abs(gRight - 9.81) < 0.25, `t² vs h gives ${gRight}`);   // ~2 % high: a small, honest bias
});

test('notebook: grouping by height, deleting keeps the row, progress toward 3 heights × 5 trials, CSV', () => {
  let b = [];
  for (const h of [0.5, 1.0, 1.5]) for (let i = 0; i < 5; i++) b = addTrial(b, { object: 'Steel ball', timer: 'Hand stopwatch', h: h + (i === 2 ? 0.0003 : 0), t: Math.sqrt(2 * h / 9.81) });
  assert.equal(groupByHeight(b).length, 3);
  assert.equal(progress(b).done, true);
  b = deleteTrial(b, 3, 'started late');
  assert.equal(b.length, 15); assert.equal(b[2].deleted, true); assert.equal(progress(b).done, false);
  near(analyse(b).g, 9.81, 1e-3);
  const csv = notebookCsv(b);
  assert.match(csv.split('\n')[0], /trial,object,timer,height_m,time_s/);
  assert.match(csv, /"started late"/);
  assert.equal(analyse(b.slice(0, 5)).error.length > 0, true);   // one height: no line yet
  b = deleteTrial(b, 3); assert.equal(b[2].deleted, false);       // undo
});

test('mystery planets: deterministic per ID and code, ID typing does not matter, g spread over 3–20 with all three airs', async () => {
  const { planetFor, normaliseId, hash32 } = await import('../js/core/lab-noise.js');
  const a = planetFor('AB12-345'), b = planetFor('ab 12 345'), c = planetFor('AB12-345', 'quiz-2');
  assert.deepEqual(a, b); assert.notEqual(a.g, c.g);
  assert.equal(normaliseId(' Jo-Smith_7 '), 'josmith7'); assert.equal(hash32('a'), hash32('a'));
  assert.throws(() => planetFor('  '), RangeError);
  const gs = [], airs = new Set();
  for (let i = 0; i < 600; i++) { const p = planetFor(`student${i}`); gs.push(p.g); airs.add(p.air); assert.ok(p.g >= 3 && p.g <= 20); assert.ok(Math.abs(p.g * 100 - Math.round(p.g * 100)) < 1e-9); }
  assert.deepEqual([...airs].sort(), ['earth', 'none', 'thin']);
  const thirds = [gs.filter(g => g < 8.67).length, gs.filter(g => g >= 8.67 && g < 14.33).length, gs.filter(g => g >= 14.33).length];
  for (const n of thirds) assert.ok(n > 150 && n < 250, `uneven spread ${thirds}`);
});

test('notebook combinations: one fit per ball-and-timer, progress counted per combination', async () => {
  const { combos, comboKey } = await import('../modules/lab-bench/notebook-model.js');
  let b = [];
  for (const h of [0.5, 1, 1.5]) for (let i = 0; i < 5; i++) {
    b = addTrial(b, { object: 'Steel ball', timer: 'Electronic timer', h, t: Math.sqrt(2 * h / 9.81) });
    b = addTrial(b, { object: 'Ping-pong ball', timer: 'Electronic timer', h, t: fallTime({ g: 9.81, ball: BALLS.pingpong, rho: AIR.earth }, h) });
  }
  b = addTrial(b, { object: 'Steel ball', timer: 'Hand stopwatch', h: 1, t: 0.4 });
  const cs = combos(b);
  assert.equal(cs.length, 3); assert.equal(cs.at(-1).n, 1);
  const steel = 'Steel ball · Electronic timer', pp = 'Ping-pong ball · Electronic timer';
  near(analyse(b, steel).g, 9.81, 1e-9);
  const gpp = analyse(b, pp).g; assert.ok(gpp < 9.6 && gpp > 8.5, `ping-pong g ${gpp}`);   // drag makes g come out low
  assert.equal(progress(b, steel).done, true); assert.equal(progress(b, 'Steel ball · Hand stopwatch').done, false);
  assert.equal(comboKey(b[0]), steel);
});

test('uncertainty floor: a lucky 4-point fit cannot claim more precision than the ruler and timer allow (planet 1N6H notebook)', async () => {
  const { idealFitG, slopeFloor, RESOLUTION } = await import('../modules/lab-bench/notebook-model.js');
  let b = [];
  for (const [h, t] of [[1.972, 0.805], [0.806, 0.515], [0.564, 0.431], [0.33, 0.33]]) b = addTrial(b, { object: 'Steel ball', timer: 'Electronic timer', h, t });
  const a = analyse(b);
  near(a.g, 6.0915, 1e-4);
  assert.ok(a.gSEfit < 0.0005, `fit SE ${a.gSEfit}`);                     // the timer errors happened to lie on a line
  assert.ok(a.floored && a.gSE > 0.005 && a.gSE < 0.012, `floored SE ${a.gSE}`);
  assert.ok(RESOLUTION.time('Hand stopwatch') > RESOLUTION.time('Electronic timer'));
  assert.ok(Number.isFinite(slopeFloor(a.groups, a.fit.slope)));
  // with Earth-like air a perfect experiment on a g = 6.08 planet measures about 6.070, not 6.08
  const ideal = idealFitG([1.972, 0.806, 0.564, 0.33], h => fallTime({ g: 6.08, ball: BALLS.steel, rho: AIR.earth }, h));
  near(ideal, 6.0696, 2e-4);
  near(idealFitG([0.5, 1, 1.5], h => fallTime({ g: 6.08 }, h)), 6.08, 1e-12);   // no air: exactly g
  assert.ok(Number.isNaN(idealFitG([1, 1], h => h)));
});

test('with 3 heights × 5 timer drops, the reported ± covers the drag-corrected value about 95 % of the time', async () => {
  const { idealFitG } = await import('../modules/lab-bench/notebook-model.js');
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const P = { g: 6.08, ball: BALLS.steel, rho: AIR.earth }; let cov = 0; const runs = 400;
  for (let r = 0; r < runs; r++) {
    const H = [0.3, 1, 1.9].map(h => Math.round((h + rnd() * 0.1) * 1e4) / 1e4); let b = [];
    for (const h of H) for (let i = 0; i < 5; i++) b = addTrial(b, { object: 'Steel ball', timer: 'Electronic timer', h: Math.round(h * 1000) / 1000, t: Math.round((fallTime(P, h) + (rnd() - 0.5) * 0.001) * 1000) / 1000 });
    const a = analyse(b); if (Math.abs(a.g - idealFitG(H, h => fallTime(P, h))) <= 2 * a.gSE) cov++;
  }
  assert.ok(cov / runs > 0.88 && cov / runs < 0.995, `coverage ${cov / runs}`);
});
