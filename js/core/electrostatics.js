/**
 * Point-charge electrostatics, DOM-free and SI (Module 06, Unit 1).
 * A charge is { q, x, y } in coulombs and metres. Forces in newtons, fields in N/C, potentials in volts.
 * Shared by E1 (Coulomb's law) and, later, E2–E4 (field, field lines, potential).
 */
import { K } from './em-constants.js';

/** Coulomb's law for one pair: the force on charge a due to charge b. */
export function pairForce(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, r2 = dx * dx + dy * dy;
  if (!(r2 > 0)) throw new RangeError('Two charges cannot sit at the same point');
  const r = Math.sqrt(r2), mag = K * Math.abs(a.q * b.q) / r2;
  const s = K * a.q * b.q / (r2 * r);           // signed: + pushes a away from b (repulsion)
  return { fx: s * dx, fy: s * dy, magnitude: mag, r, repel: a.q * b.q > 0 };
}

/** Net force on charges[i] by superposition, with each pair's contribution. */
export function netForce(charges, i) {
  let fx = 0, fy = 0;
  const parts = [];
  charges.forEach((c, j) => {
    if (j === i) return;
    const f = pairForce(charges[i], c);
    fx += f.fx; fy += f.fy;
    parts.push({ j, ...f });
  });
  return { fx, fy, magnitude: Math.hypot(fx, fy), parts };
}

/** Electric field at a point (no charge needed there). */
export function fieldAt(charges, x, y) {
  let ex = 0, ey = 0;
  for (const c of charges) {
    const dx = x - c.x, dy = y - c.y, r2 = dx * dx + dy * dy;
    if (!(r2 > 0)) return { ex: NaN, ey: NaN, magnitude: Infinity };
    const s = K * c.q / (r2 * Math.sqrt(r2));
    ex += s * dx; ey += s * dy;
  }
  return { ex, ey, magnitude: Math.hypot(ex, ey) };
}

/** Electric potential at a point (zero at infinity): a scalar sum. */
export function potentialAt(charges, x, y) {
  let v = 0;
  for (const c of charges) {
    const r = Math.hypot(x - c.x, y - c.y);
    if (!(r > 0)) return c.q > 0 ? Infinity : -Infinity;
    v += K * c.q / r;
  }
  return v;
}

/**
 * Where on the line through two fixed charges is the net force on a third charge zero?
 * Returns the distance from charge 1 along the line toward charge 2 (negative = beyond charge 1,
 * greater than separation = beyond charge 2), or null if there is no such point (equal and opposite charges).
 */
export function zeroForcePoint(q1, q2, separation) {
  if (!(separation > 0) || q1 === 0 || q2 === 0) throw new RangeError('Need two non-zero charges a positive distance apart');
  const ratio = Math.sqrt(Math.abs(q2 / q1));
  if (q1 * q2 > 0) return separation / (1 + ratio);           // like charges: between them, nearer the smaller
  if (Math.abs(ratio - 1) < 1e-12) return null;               // equal and opposite: no zero point at finite distance
  return ratio < 1 ? separation / (1 - ratio)                 // beyond charge 2 (the smaller one)
    : -separation / (ratio - 1);                              // beyond charge 1 (the smaller one)
}

/* ---------- calculus tier: a uniformly charged rod acting on a point charge on its axis ---------- */
/* Rod of length L and total charge Q along the x-axis from 0 to L; point charge q at x = L + d. */

/** Exact: F = ∫₀ᴸ k λ q dx / (L + d − x)² = k Q q / (d (d + L)). Positive = pushes q away from the rod. */
export function rodForceExact({ Q, L, q, d }) {
  if (!(L > 0) || !(d > 0)) throw new RangeError('Rod length and distance must be positive');
  return K * Q * q / (d * (d + L));
}

/** Riemann sum with n slices, each slice treated as a point charge at its midpoint. */
export function rodForceSlices({ Q, L, q, d }, n) {
  if (!(n >= 1)) throw new RangeError('Need at least one slice');
  const dq = Q / n, w = L / n;
  let f = 0;
  for (let i = 0; i < n; i++) { const r = L + d - (i + 0.5) * w; f += K * dq * q / (r * r); }
  return f;
}

/** Point-charge approximation: all of Q at the rod's centre. Good when d ≫ L. */
export function rodForcePointLimit({ Q, L, q, d }) {
  const r = d + L / 2;
  return K * Q * q / (r * r);
}
