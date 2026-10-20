import test from 'node:test';
import assert from 'node:assert/strict';
import { circleQuantities, createCircularRun, sampleAt, sampleGrid, timeAtAngle, TABLE_RADIUS } from '../js/core/circular-physics.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const S = { mass: 0.5, radius: 1.5, speed: 3 };

test('sampleGrid ends exactly at endTime, evenly spaced, never past it (QA-01)', () => {
  for (const opts of [{ cutAt: Math.PI }, { cutAt: 1.234 }, { duration: 12 }, { duration: 7.005 }]) {
    const run = createCircularRun(S, opts), g = sampleGrid(run);
    near(g.at(-1).t, run.endTime);
    assert.ok(g.every(s => s.t <= run.endTime + 1e-12));
    for (let i = 1; i < g.length; i++) assert.ok(g[i].t >= g[i - 1].t);
    const end = sampleAt(run, run.endTime); near(g.at(-1).x, end.x); near(g.at(-1).y, end.y);
  }
});

test('derived quantities: ω = v/r, T = 2πr/v, a = v²/r, F = m v²/r', () => {
  const q = circleQuantities(S);
  near(q.omega, 2); near(q.period, Math.PI); near(q.frequency, 1 / Math.PI); near(q.accel, 6); near(q.force, 3);
  assert.throws(() => circleQuantities({ ...S, radius: 0 }), RangeError);
});

test('while attached: constant speed, velocity ⟂ radius, acceleration points to the centre with size v²/r', () => {
  const run = createCircularRun(S);
  for (const t of [0, 0.3, 1.1, 2.7, 5.9]) {
    const s = sampleAt(run, t);
    near(Math.hypot(s.x, s.y), 1.5); near(Math.hypot(s.vx, s.vy), 3);
    near(s.x * s.vx + s.y * s.vy, 0);                         // r · v = 0
    near(s.ax, -4 * s.x); near(s.ay, -4 * s.y);               // a = −ω² r
    near(Math.hypot(s.ax, s.ay), 6);
  }
  const back = sampleAt(run, run.period); near(back.x, 1.5); near(back.y, 0, 1e-9);
});

test('velocity and acceleration are the time derivatives of position (finite differences)', () => {
  const run = createCircularRun(S), h = 1e-5;
  for (const t of [0.4, 1.7]) {
    const a = sampleAt(run, t - h), b = sampleAt(run, t + h), s = sampleAt(run, t);
    near((b.x - a.x) / (2 * h), s.vx, 1e-6); near((b.vy - a.vy) / (2 * h), s.ay, 1e-6);
  }
});

test('after the cut: straight line along the tangent at constant velocity, no force, leaves the table', () => {
  const tc = timeAtAngle(createCircularRun(S), 0, 1);       // at the 3 o’clock point, moving +y
  const run = createCircularRun(S, { cutAt: tc });
  const c = sampleAt(run, tc);
  near(c.x, 1.5); near(c.y, 0, 1e-9); near(c.vx, 0, 1e-9); near(c.vy, 3);
  const later = sampleAt(run, tc + 0.5);
  assert.equal(later.attached, false); assert.equal(later.tension, 0);
  near(later.x, 1.5); near(later.y, 1.5, 1e-9);              // straight up the page, not outward
  near(Math.hypot(sampleAt(run, run.endTime).x, sampleAt(run, run.endTime).y), TABLE_RADIUS);
  const g = sampleGrid(run);
  const i = g.findIndex(s => !s.attached);
  assert.ok(g[i - 1].attached && Math.abs(g[i - 1].t - g[i].t) < 1e-12, 'samples on both sides of the cut');
  near(g[i - 1].accel, 6); near(g[i].accel, 0);
});

test('timeAtAngle finds the next time the puck reaches an angle', () => {
  const run = createCircularRun(S);
  near(timeAtAngle(run, Math.PI / 2), Math.PI / 4);
  near(timeAtAngle(run, 0, 0.1), Math.PI);
  near(sampleAt(run, timeAtAngle(run, Math.PI, 2)).x, -1.5);
});

import { ACTIVITIES, ACTIVITY_IDS, activityFeedback } from '../modules/circular-motion/activities.js';
test('guided activities: data complete, and every correct answer agrees with the physics', () => {
  for (const id of ACTIVITY_IDS) {
    const a = ACTIVITIES[id];
    for (const k of ['title', 'conditions', 'objective', 'fullObjective', 'question', 'observation', 'explanation', 'takeaway', 'reflection', 'modelAnswer']) assert.ok(a[k], `${id}.${k}`);
    for (const c of a.choices) if (c.id !== a.correct) assert.ok(a.misconceptions[c.id], `${id} feedback for ${c.id}`);
    assert.equal(activityFeedback(id, a.correct).correct, true);
    if (a.reference) {
      const ratio = circleQuantities(a.settings).force / circleQuantities(a.reference.settings).force;
      near(ratio, a.choices.find(c => c.id === a.correct).value);
      near(ratio, a.ratio(a.settings));
    }
  }
  // Numbers quoted in the observations
  near(circleQuantities(ACTIVITIES.U2.settings).force, 66.6667, 1e-4); near(circleQuantities(ACTIVITIES.U2.reference.settings).force, 16.6667, 1e-4);
  near(circleQuantities(ACTIVITIES.U3.settings).force, 3); near(circleQuantities(ACTIVITIES.U3.reference.settings).force, 6);
  near(circleQuantities(ACTIVITIES.U4.reference.settings).period, circleQuantities(ACTIVITIES.U4.settings).period);
  near(circleQuantities(ACTIVITIES.U4.reference.settings).force, 1.5);
});
