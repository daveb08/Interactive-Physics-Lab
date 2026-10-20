import test from 'node:test';
import assert from 'node:assert/strict';
import { K, MICRO } from '../js/core/em-constants.js';
import { pairForce, netForce, fieldAt, potentialAt, zeroForcePoint, rodForceExact, rodForceSlices, rodForcePointLimit } from '../js/core/electrostatics.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const c = (uC, x, y) => ({ q: uC * MICRO, x, y });

test('Coulomb force: k|q₁q₂|/r² with the textbook value', () => {
  const f = pairForce(c(2, 0, 0), c(3, 0.2, 0));
  near(f.magnitude, K * 6e-12 / 0.04);
  near(f.magnitude, 1.3482);                     // 2 μC and 3 μC, 20 cm apart
  near(f.fx, -f.magnitude); near(f.fy, 0);       // like charges: q1 pushed away from q2 (−x)
  assert.equal(f.repel, true);
});

test('unlike charges attract; the force points from a toward b', () => {
  const f = pairForce(c(2, 0, 0), c(-3, 0, 0.5));
  assert.ok(f.fy > 0); near(f.fx, 0); assert.equal(f.repel, false);
});

test('inverse square: doubling r quarters F, doubling one charge doubles F', () => {
  const a = c(2, 0.1, 0.1), F = pairForce(a, c(3, 0.3, 0.1)).magnitude;
  near(pairForce(a, c(3, 0.5, 0.1)).magnitude, F / 4);
  near(pairForce(c(4, 0.1, 0.1), c(3, 0.3, 0.1)).magnitude, 2 * F);
  near(pairForce(c(4, 0.1, 0.1), c(6, 0.5, 0.1)).magnitude, F);       // ×2 ×2 ÷4
});

test("Newton's third law: equal and opposite forces even for unequal charges", () => {
  const a = c(1, 0.2, 0.3), b = c(8, 0.5, 0.1);
  const ab = pairForce(a, b), ba = pairForce(b, a);
  near(ab.fx, -ba.fx); near(ab.fy, -ba.fy); near(ab.magnitude, ba.magnitude);
});

test('superposition: the net force is the vector sum of pair forces', () => {
  const set = [c(2, 0.3, 0.3), c(-4, 0.6, 0.3), c(5, 0.3, 0.7), c(-1, 0.1, 0.1)];
  const n = netForce(set, 0);
  let fx = 0, fy = 0;
  for (const j of [1, 2, 3]) { const f = pairForce(set[0], set[j]); fx += f.fx; fy += f.fy; }
  near(n.fx, fx); near(n.fy, fy); near(n.magnitude, Math.hypot(fx, fy));
  assert.equal(n.parts.length, 3);
  // Internal forces cancel: the total force on the whole set is zero.
  let tx = 0, ty = 0; set.forEach((_, i) => { const f = netForce(set, i); tx += f.fx; ty += f.fy; });
  near(tx, 0, 1e-12); near(ty, 0, 1e-12);
});

test('F = qE: the field times a test charge gives the force on it', () => {
  const src = [c(3, 0.2, 0.2), c(-2, 0.6, 0.4)], t = c(1, 0.4, 0.1);
  const E = fieldAt(src, t.x, t.y), F = netForce([...src, t], 2);
  near(F.fx, t.q * E.ex); near(F.fy, t.q * E.ey);
});

test('dipole: on the bisector V = 0 and E ≠ 0; E = −∇V by finite differences', () => {
  const dip = [c(2, -0.1, 0), c(-2, 0.1, 0)];
  near(potentialAt(dip, 0, 0.3), 0, 1e-12);
  assert.ok(fieldAt(dip, 0, 0.3).magnitude > 0);
  const h = 1e-6, x = 0.07, y = 0.21, E = fieldAt(dip, x, y);
  near(-(potentialAt(dip, x + h, y) - potentialAt(dip, x - h, y)) / (2 * h), E.ex, 1e-6);
  near(-(potentialAt(dip, x, y + h) - potentialAt(dip, x, y - h)) / (2 * h), E.ey, 1e-6);
});

test('zero-force point between like charges sits nearer the smaller charge', () => {
  near(zeroForcePoint(1e-6, 4e-6, 0.6), 0.2);
  near(zeroForcePoint(1e-6, 1e-6, 0.5), 0.25);
  const d = zeroForcePoint(1e-6, 4e-6, 0.6), set = [c(1, 0, 0), c(4, 0.6, 0), c(1, d, 0)];
  near(netForce(set, 2).fx, 0, 1e-9);
});

test('zero-force point for unlike charges lies outside, beyond the smaller charge', () => {
  const x = zeroForcePoint(4e-6, -1e-6, 0.3);      // beyond charge 2
  near(x, 0.6);
  near(netForce([c(4, 0, 0), c(-1, 0.3, 0), c(1, x, 0)], 2).fx, 0, 1e-9);
  const y = zeroForcePoint(-1e-6, 4e-6, 0.3);      // beyond charge 1
  near(y, -0.3);
  near(netForce([c(-1, 0, 0), c(4, 0.3, 0), c(1, y, 0)], 2).fx, 0, 1e-9);
  assert.equal(zeroForcePoint(2e-6, -2e-6, 0.4), null);
});

test('charged rod: slices converge to k Q q /(d(d + L)); far away it acts like a point charge', () => {
  const p = { Q: 5e-6, L: 0.4, q: 2e-6, d: 0.1 };
  const exact = rodForceExact(p);
  near(exact, K * 1e-11 / (0.1 * 0.5));
  near(rodForceSlices(p, 1), rodForcePointLimit(p));          // one slice = all charge at the centre
  near(rodForceSlices(p, 2000), exact, 1e-6);
  assert.ok(Math.abs(rodForceSlices(p, 50) - exact) < Math.abs(rodForceSlices(p, 5) - exact));
  const far = { ...p, d: 40 };
  near(rodForcePointLimit(far) / rodForceExact(far), 1, 1e-4);
  assert.ok(rodForcePointLimit(p) < exact);                   // close up the near end dominates
});

test('bad input throws', () => {
  assert.throws(() => pairForce(c(1, 0, 0), c(1, 0, 0)), RangeError);
  assert.throws(() => zeroForcePoint(0, 1, 1), RangeError);
  assert.throws(() => rodForceExact({ Q: 1, L: 0, q: 1, d: 1 }), RangeError);
});
