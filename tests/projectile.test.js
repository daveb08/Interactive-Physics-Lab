import test from 'node:test';
import assert from 'node:assert/strict';
import { flight, frames, project, pxPerM, parallaxFactor, inView, STICK_PLACES, MUZZLE, SPRING, CAMERA } from '../js/core/projectile.js';
import { quadraticFit } from '../js/core/fit.js';
import { scaleOf, points, allPoints, setExcluded, excludedCount, vyPoints, velPoints, handStatus, fitGraph, summary, progress, handOk } from '../modules/lab-bench/projectile-model.js';
import { parseProjectileAssignment, projectileQuery, encodeProjectile, decodeProjectile, gradeProjectile, gradeProjectileBatch, idealG, questionFor2, notesFor2, gradesCsv2 } from '../modules/lab-bench/grading-projectile.js';
import { encodeSubmission } from '../modules/lab-bench/grading.js';
import { assignmentPlanet } from '../modules/lab-bench/grading.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('flight without air is an exact parabola: x linear, y with acceleration −g', () => {
  const fl = flight({ g: 9.81, rho: 0 }, { angle: 45, speed: 5 });
  const v = 5 / Math.SQRT2;
  for (const t of [0, 0.1, 0.3, fl.T * 0.9]) {
    const p = fl.at(t);
    close(p.x, MUZZLE.x + v * t, 1e-6, 'x'); close(p.y, MUZZLE.y + v * t - 4.905 * t * t, 1e-6, 'y');
  }
  close(fl.at(fl.T).y, 0.02, 1e-6, 'lands when the ball (radius 2 cm) touches the floor');
});

test('air drag on the steel ball changes the fitted g by under 0.1 % on Earth', () => {
  const fl = flight({ g: 9.81, rho: 1.2 }, { angle: 60, speed: 6 });
  const pts = frames(fl, 60, 0).filter(f => f.inFlight).map(f => ({ x: f.t, y: f.y }));
  close(-2 * quadraticFit(pts).c, 9.81, 0.01, 'g');
});

test('video frames: n / fps, one before launch, the ball still at the muzzle before launch', () => {
  const fl = flight({ g: 9.81, rho: 0 }, { angle: 30, speed: 4 }), fr = frames(fl, 30, 0.01);
  assert.equal(fr[0].inFlight, false); assert.equal(fr[0].x, MUZZLE.x);
  close(fr[3].t, 0.1, 1e-12, 'frame time');
  assert.ok(fr.filter(f => f.inFlight).length >= Math.floor(fl.T * 30));
});

test('camera: square-on pinhole; the front-edge stick looks 3/2.55 times bigger (the parallax trap)', () => {
  const a = project(1, 1), b = project(2, 1);
  close(b.u - a.u, pxPerM(), 1e-9, 'px per metre in the flight plane');
  close(parallaxFactor('front'), 2.55 / 3, 1e-12, 'scale factor'); assert.equal(parallaxFactor('plane'), 1);
  assert.equal(inView(flight({ g: 9.81, rho: 0 }, { angle: 45, speed: SPRING[5] })), false);
  assert.equal(inView(flight({ g: 9.81, rho: 0 }, { angle: 45, speed: SPRING[2] })), true);
});

/** A student who clicks exactly: scale from the stick's ends (at its place), origin at the muzzle. */
function perfectLaunch(env, { angle, spring, fps, stick = 'plane' }) {
  const fl = flight(env, { angle, speed: SPRING[spring - 1] }), sp = STICK_PLACES[stick];
  const cal = { a: project(sp.x, sp.y, sp.z), b: project(sp.x, sp.y + 1, sp.z) };
  const origin = project(MUZZLE.x, MUZZLE.y), clicks = {};
  for (const f of frames(fl, fps, 0)) if (f.inFlight) { const p = project(f.x, f.y); clicks[f.n] = { u: p.u, v: p.v }; }
  return { id: 1, angle, spring, fps, stick, phase: 0, cal: { a: { u: cal.a.u, v: cal.a.v }, b: { u: cal.b.u, v: cal.b.v } }, origin: { u: origin.u, v: origin.v }, clicks, hand: [], models: {} };
}

test('analysis from clicks: calibration, points in metres, hand vy check, fits with the chosen model', () => {
  const l = perfectLaunch({ g: 9.81, rho: 0 }, { angle: 45, spring: 4, fps: 30 });
  close(1 / scaleOf(l.cal), pxPerM(), 1e-9, 'scale');
  const pts = points(l);
  close(pts[0].x, 0, 1e-9, 'origin at the muzzle');
  const vs = velPoints(pts);
  l.hand = vs.slice(0, 3).map(v => +v.vy.toFixed(3));
  assert.equal(handStatus(l).done, false, 'vx still to do');
  l.handX = vs.slice(0, 3).map(v => +v.vx.toFixed(3));
  assert.equal(handStatus(l).done, true);
  assert.equal(handOk(1.0, 1.05), false); assert.equal(handOk(1.01, 1.0), true);
  assert.equal(fitGraph(l, 'y'), null, 'no model chosen, no fit');
  l.models = { x: 'line', y: 'parabola', vx: 'line', vy: 'line' };
  const fy = fitGraph(l, 'y'), fvy = fitGraph(l, 'vy'), fx = fitGraph(l, 'x'), fvx = fitGraph(l, 'vx');
  close(fvx.B, 0, 0.1, 'vx is constant: no horizontal acceleration'); close(fvx.A, fx.B, 0.02, 'vx line level = x–t slope');
  close(-2 * fy.C, 9.81, 0.03, 'g from the parabola (table rounding only)');
  close(-fvy.B, 9.81, 0.15, 'g from the vy line');
  close(fx.B, SPRING[3] * Math.SQRT1_2, 0.05, 'vx');
  assert.equal(summary(l).analysed, true); assert.equal(summary(l).modelsOk, true);
});

test('the parallax trap: a scale from the front-edge stick makes g low by the same factor', () => {
  const l = { ...perfectLaunch({ g: 9.81, rho: 0 }, { angle: 45, spring: 4, fps: 30, stick: 'front' }), models: { x: 'line', y: 'parabola', vx: 'line', vy: 'line' } };
  close(-2 * fitGraph(l, 'y').C / 9.81, parallaxFactor('front'), 0.005, 'g ratio');
});

test('progress: enough analysed launches, with two different settings', () => {
  const mk = (angle, spring) => { const l = perfectLaunch({ g: 9.81, rho: 0 }, { angle, spring, fps: 30 }); const vs = velPoints(points(l)).slice(0, 3); l.hand = vs.map(v => v.vy); l.handX = vs.map(v => v.vx); l.models = { x: 'line', y: 'parabola', vx: 'line', vy: 'line' }; return l; };
  assert.equal(progress([mk(45, 4), mk(45, 4)]).done, false, 'same setting twice');
  assert.equal(progress([mk(45, 4), mk(60, 4)]).done, true);
});

const A = parseProjectileAssignment('?a=PHY-Lab2&t=5&u=10&n=2x10&px=1&air=any&k=abc');

test('Lab 2 assignment links round trip; the parallax question goes with the trap', () => {
  assert.deepEqual(parseProjectileAssignment('?' + projectileQuery(A)), A);
  assert.equal(A.parallax, true); assert.equal(questionFor2(A), 'parallax');
  assert.equal(questionFor2({ ...A, parallax: false }), 'differencing');
  assert.equal(parseProjectileAssignment('?a=practice'), null);
});

const sub = { code: 'phy-lab2', id: 'Ann 7', g: 12.34, dg: 0.21, answer: 'a', stick: 'plane', launches: [{ angle: 45, spring: 3, fps: 30, n: 18, excluded: 0, modelsOk: true, analysed: true }, { angle: 60, spring: 4, fps: 60, n: 40, excluded: 2, modelsOk: true, analysed: true }] };

test('Lab 2 completion codes: short, round trip, edits and other labs refused', () => {
  const c = encodeProjectile(sub);
  assert.match(c, /^LB-/); assert.ok(c.length < 60, `${c.length} characters`);
  const d = decodeProjectile(c, 'phy-lab2'); assert.equal(d.ok, true);
  assert.deepEqual(d.sub, { ...sub, id: 'ann7' });
  const bytes = Buffer.from(c.slice(3), 'base64url'); bytes[6] ^= 1;
  assert.equal(decodeProjectile('LB-' + bytes.toString('base64url'), 'phy-lab2').ok, false);
  assert.match(decodeProjectile(c, 'other').error, /different assignment/);
  const lab1 = encodeSubmission({ code: 'phy-lab2', id: 'x', g: 9.8, dg: 0.1, timer: 'gate', ball: 'steel', heights: [[500, 5]], answer: 'a' });
  assert.match(decodeProjectile(lab1, 'phy-lab2').error, /Lab 1 code/);
});

test('Lab 2 codes record the points left out; codes made before that still decode with none left out', () => {
  const d = decodeProjectile(encodeProjectile(sub), 'phy-lab2').sub;
  assert.deepEqual(d.launches.map(l => l.excluded), [0, 2]);
  assert.match(notesFor2(d), /40 pts, 2 left out/);
  assert.doesNotMatch(notesFor2(d).split(';')[0], /left out/);
  // An older code: the same bytes with no count byte and bit 7 clear.
  const old = encodeProjectile({ ...sub, launches: sub.launches.map(l => ({ ...l, excluded: 0 })) });
  assert.deepEqual(decodeProjectile(old, 'phy-lab2').sub.launches.map(l => l.excluded), [0, 0]);
  assert.equal(encodeProjectile(sub).length - old.length <= 2, true, 'one extra byte');
  const rows = gradeProjectileBatch(`Ann,${encodeProjectile(sub)}`, A);
  assert.match(gradesCsv2(rows), /points_left_out/);
  assert.match(gradesCsv2(rows).split('\n')[1], /,2,plane,/);
});

test('leaving points out: needs a reason, fits and velocities skip them, re-including restores the fit', () => {
  const l = perfectLaunch({ g: 9.81, rho: 0 }, { angle: 45, spring: 4, fps: 30 });
  l.models = { x: 'line', y: 'parabola', vx: 'line', vy: 'line' };
  const frames = Object.keys(l.clicks).map(Number).sort((a, b) => a - b), bad = frames[6];
  l.clicks[bad] = { u: l.clicks[bad].u + 25, v: l.clicks[bad].v - 25 };   // a badly misplaced mark
  const before = -2 * fitGraph(l, 'y').C;
  assert.equal(setExcluded(l, bad, ''), false, 'a reason is required');
  assert.equal(setExcluded(l, bad, 'ok'), false, 'too short');
  assert.equal(setExcluded(l, 999, 'no such mark'), false);
  assert.equal(setExcluded(l, bad, 'clicked the wrong spot'), true);
  assert.equal(excludedCount(l), 1);
  assert.equal(allPoints(l).length, frames.length); assert.equal(points(l).length, frames.length - 1);
  assert.equal(allPoints(l).find(p => p.n === bad).reason, 'clicked the wrong spot');
  const after = -2 * fitGraph(l, 'y').C;
  assert.ok(Math.abs(after - 9.81) < Math.abs(before - 9.81), `${before} → ${after}`);
  close(after, 9.81, 0.05, 'g without the bad mark');
  assert.equal(fitGraph(l, 'y').n, frames.length - 1);
  // the velocity interval spans the gap: two frames
  const v = velPoints(points(l)).find(q => q.from.n === frames[5]);
  assert.equal(v.to.n, frames[7]); close(v.dt, 2 / 30, 1e-12, 'Δt over the gap');
  assert.equal(summary(l).n, frames.length - 1); assert.equal(summary(l).excluded, 1);
  setExcluded(l, bad, null);
  assert.equal(excludedCount(l), 0); close(-2 * fitGraph(l, 'y').C, before, 1e-9, 'back in the fit');
});

test('Lab 2 rubric: value, uncertainty against the ideal, method, explanation', () => {
  const planet = assignmentPlanet('ann7', A), G = planet.g, ideal = idealG(planet, sub.launches);
  const base = { ...sub, g: ideal, dg: ideal * 0.02 };
  const by = s => Object.fromEntries(gradeProjectile(s, A).checks.map(c => [c.id, c.pass]));
  assert.deepEqual(by(base), { value: true, uncertainty: true, method: true, explanation: true });
  assert.equal(by({ ...base, g: G * parallaxFactor('front'), dg: G * 0.05, stick: 'front' }).value, false, 'parallax: about 15 % low');
  assert.equal(by({ ...base, g: G * 1.049 }).value, true); assert.equal(by({ ...base, g: G * 1.051 }).value, false);
  assert.equal(by({ ...base, dg: ideal * 0.11 }).uncertainty, false);
  assert.equal(by({ ...base, launches: [sub.launches[0], { ...sub.launches[0] }] }).method, false, 'one setting twice');
  assert.equal(by({ ...base, launches: [sub.launches[0], { ...sub.launches[1], modelsOk: false }] }).method, false, 'a wrong model');
  assert.equal(by({ ...base, launches: [sub.launches[0], { ...sub.launches[1], n: 9 }] }).method, false, 'too few points');
  assert.equal(by({ ...base, answer: 'b' }).explanation, false);
  const rows = gradeProjectileBatch(`Ann,${encodeProjectile(base)}\nBob,${encodeProjectile({ ...base, id: 'bob' })}`, A);
  assert.equal(rows.length, 2); assert.ok(rows.every(r => r.result));
});
