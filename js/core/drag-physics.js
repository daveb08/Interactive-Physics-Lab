/**
 * Horizontal cart with velocity-dependent drag. SI units, x0 = 0, positive to the right.
 * Applied force F and initial velocity v0 are restricted to F ≥ 0 and v0 ≥ 0, so velocity never
 * changes sign and both drag laws have exact closed-form solutions.
 *   linear:    m dv/dt = F − b v
 *   quadratic: m dv/dt = F − c v²
 */
import { TRACK } from './physics.js';

export const DRAG_DEFAULTS = Object.freeze({ mass: 2, force: 6, v0: 0, law: 'linear', b: 2, c: 0.5 });
export const DRAG_LIMITS = Object.freeze({ mass: [1, 10], force: [0, 20], v0: [0, 10], b: [0.1, 5], c: [0.05, 2] });
export const DRAG_DURATION = 10;

const LN2 = Math.LN2;
// ln cosh(u) and ln sinh(u) without overflow for large u.
const logCosh = u => { const a = Math.abs(u); return a + Math.log1p(Math.exp(-2 * a)) - LN2; };
const logSinh = u => u + Math.log1p(-Math.exp(-2 * u)) - LN2; // u > 0

function check(name, value) {
  const [lo, hi] = DRAG_LIMITS[name];
  if (!Number.isFinite(value) || value < lo - 1e-12 || value > hi + 1e-12) throw new RangeError(`${name} must be between ${lo} and ${hi}.`);
}

/** Returns a model with exact position/velocity functions and the ODE right-hand side. */
export function createDragModel(settings = DRAG_DEFAULTS, { track = TRACK, duration = DRAG_DURATION, validate = true } = {}) {
  const { mass: m, force: F, v0, law } = { ...DRAG_DEFAULTS, ...settings };
  if (law !== 'linear' && law !== 'quadratic') throw new RangeError('Drag law must be linear or quadratic.');
  const coef = law === 'linear' ? settings.b ?? DRAG_DEFAULTS.b : settings.c ?? DRAG_DEFAULTS.c;
  if (validate) { check('mass', m); check('force', F); check('v0', v0); check(law === 'linear' ? 'b' : 'c', coef); }
  else if (!(m > 0) || !(F >= 0) || !(v0 >= 0) || !(coef > 0)) throw new RangeError('Need m > 0, F ≥ 0, v0 ≥ 0 and a positive drag coefficient.');

  let pos, vel, vT, tau;
  if (law === 'linear') {
    const b = coef;
    vT = F / b; tau = m / b;
    // expm1 keeps the small-t behaviour exact to rounding.
    pos = t => vT * t - tau * (v0 - vT) * Math.expm1(-t / tau);
    vel = t => vT + (v0 - vT) * Math.exp(-t / tau);
  } else {
    const c = coef;
    if (F === 0) {
      vT = 0; tau = v0 > 0 ? m / (c * v0) : Infinity;
      pos = t => v0 > 0 ? (m / c) * Math.log1p(c * v0 * t / m) : 0;
      vel = t => v0 / (1 + c * v0 * t / m);
    } else {
      vT = Math.sqrt(F / c); tau = m / (c * vT);
      if (Math.abs(v0 - vT) <= 1e-12 * vT) {
        pos = t => vT * t; vel = () => vT;
      } else if (v0 < vT) {
        const phi = Math.atanh(v0 / vT);
        pos = t => vT * tau * (logCosh(t / tau + phi) - logCosh(phi));
        vel = t => vT * Math.tanh(t / tau + phi);
      } else {
        const phi = 0.5 * Math.log((v0 + vT) / (v0 - vT));
        pos = t => vT * tau * (logSinh(t / tau + phi) - logSinh(phi));
        vel = t => vT / Math.tanh(t / tau + phi);
      }
    }
  }
  const dragForce = v => law === 'linear' ? -coef * v : -coef * v * v;
  const accel = v => (F + dragForce(v)) / m;

  // Velocity is never negative, so x(t) is nondecreasing: a single outward crossing of the right edge.
  let endTime = duration, reason = 'duration';
  if (pos(duration) > track.max) {
    let lo = 0, hi = duration;
    for (let i = 0; i < 200 && hi - lo > 1e-12; i++) { const mid = (lo + hi) / 2; if (pos(mid) > track.max) hi = mid; else lo = mid; }
    endTime = hi; reason = 'boundary';
  }

  return {
    kind: 'drag', law, mass: m, force: F, v0, coef, vT, tau, endTime, reason, duration,
    at(t) {
      const v = vel(t), Fd = dragForce(v);
      return { t, x: pos(t), v, a: (F + Fd) / m, fApplied: F, fDrag: Fd, ke: 0.5 * m * v * v };
    },
    /** dy/dt for y = [x, v], for the numerical integrators. */
    deriv: (t, [, v]) => [v, accel(v)],
    initial: [0, v0],
  };
}
