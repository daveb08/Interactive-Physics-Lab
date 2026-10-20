import test from 'node:test';
import assert from 'node:assert/strict';
import { netForce, pairForce } from '../js/core/electrostatics.js';
import { ACTIVITIES, ACTIVITY_IDS, C3_ZERO_X, activityFeedback, toSI, text } from '../modules/electromagnetism/coulomb-activities.js';
import { chargingSteps, leafNet, ROD_UNITS } from '../modules/electromagnetism/electroscope.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const at = (id, u) => { const a = ACTIVITIES[id], set = a.charges.map(c => ({ ...c })); Object.assign(set[a.mover], a.path(u)); return toSI(set); };

test('E1 guided activities C1–C3 exist, each correct choice is listed, and every wrong choice has feedback', () => {
  assert.deepEqual(ACTIVITY_IDS, ['C1', 'C2', 'C3']);
  for (const id of ACTIVITY_IDS) {
    const a = ACTIVITIES[id];
    assert.ok(a.choices.some(c => c.id === a.correct));
    for (const c of a.choices) if (c.id !== a.correct) assert.ok(a.misconceptions[c.id], `${id} ${c.id} lacks feedback`);
    assert.equal(activityFeedback(id, a.correct).correct, true);
    for (const k of ['observation', 'explanation', 'modelAnswer']) assert.ok(text(a[k]).length > 40);
  }
  assert.throws(() => activityFeedback('C9', 'A'), RangeError);
});

test('C1: the path doubles r and the force falls to ¼, matching choice B', () => {
  const r0 = pairForce(...at('C1', 0)), r1 = pairForce(...at('C1', 1));
  near(r0.r, 0.2); near(r1.r, 0.4);
  const ratio = r1.magnitude / r0.magnitude;
  near(ratio, 0.25);
  near(ACTIVITIES.C1.choices.find(c => c.id === ACTIVITIES.C1.correct).value, ratio);
  assert.match(text(ACTIVITIES.C1.observation), /1\.35 N.*0\.34 N.*4\.00/);
});

test('C2: equal and opposite at every point of the path, distance fixed', () => {
  for (const u of [0, 0.3, 0.5, 0.9, 1]) {
    const set = at('C2', u), a = netForce(set, 0), b = netForce(set, 1);
    near(a.fx, -b.fx); near(a.fy, -b.fy); near(pairForce(...set).r, 0.25);
    for (const c of set) assert.ok(c.x > 0 && c.x < 1 && c.y > 0 && c.y < 0.6);
  }
});

test('C3: F_x on q₃ changes sign once along the scan and the run ends at the zero-force point', () => {
  near(C3_ZERO_X, 0.4);
  const fx = u => netForce(at('C3', u), 2).fx;
  assert.ok(fx(0) > 0 && fx(0.75) < 0);
  near(at('C3', 1)[2].x, 0.4);
  near(fx(1), 0, 1e-9);
  assert.ok(C3_ZERO_X - 0.2 < 0.8 - C3_ZERO_X);   // nearer the smaller charge: choice B
});

for (const sign of [-1, 1]) {
  test(`charging sequences conserve charge at every step (rod ${sign < 0 ? 'negative' : 'positive'})`, () => {
    for (const m of ['friction', 'contact', 'induction']) {
      const steps = chargingSteps(m, sign), total = steps[0].net.total;
      for (const s of steps) assert.equal(s.net.total, total, `${m} "${s.label}"`);
    }
  });

  test(`end states: friction opposite pair, contact same sign, induction opposite sign (rod ${sign})`, () => {
    const f = chargingSteps('friction', sign).at(-1).net;
    assert.equal(f.rod, sign * ROD_UNITS); assert.equal(f.other, -f.rod); assert.equal(f.total, 0);
    const c = chargingSteps('contact', sign).at(-1);
    assert.equal(Math.sign(c.net.scope), sign); assert.equal(Math.sign(leafNet(c.scope)), sign);
    assert.equal(c.predict.correct, 'same');
    const ind = chargingSteps('induction', sign);
    assert.equal(ind[1].net.scope, 0);                       // polarised, still neutral overall
    assert.notEqual(leafNet(ind[1].scope), 0);               // …but the leaves are charged and spread
    assert.equal(leafNet(ind[2].scope), 0);                  // grounded: leaves close
    assert.equal(Math.sign(ind.at(-1).net.scope), -sign);
    assert.equal(ind.at(-1).net.rod, sign * ROD_UNITS);      // the rod never loses charge in induction
    assert.equal(ind.at(-1).predict.correct, 'opposite');
  });
}

test('charging: bad input throws', () => {
  assert.throws(() => chargingSteps('magic', -1), RangeError);
  assert.throws(() => chargingSteps('contact', 0), RangeError);
});
