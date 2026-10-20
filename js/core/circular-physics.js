/**
 * Uniform circular motion of a puck on a string over a frictionless table (top view), with an optional cut.
 * Exact closed form: while attached, r(t) = R(cos θ, sin θ) with θ = θ₀ + ω t (counterclockwise for v > 0);
 * after the cut the net force is zero, so the puck moves in a straight line with the velocity it had at the cut.
 * SI units, DOM-free.
 */
export const CIRCLE_DEFAULTS = Object.freeze({ mass: 0.5, radius: 1.5, speed: 3 });
export const LIMITS = Object.freeze({ mass: [0.1, 5], radius: [0.5, 2], speed: [0.5, 6] });
export const TABLE_RADIUS = 3.2;          // the run ends when the puck leaves the table after a cut

/** Derived quantities of uniform circular motion. */
export function circleQuantities({ mass, radius, speed }) {
  if (![mass, radius, speed].every(Number.isFinite) || mass <= 0 || radius <= 0 || speed <= 0) throw new RangeError('Use positive mass, radius and speed.');
  const omega = speed / radius, period = 2 * Math.PI * radius / speed;
  return { omega, period, frequency: 1 / period, accel: speed * speed / radius, force: mass * speed * speed / radius };
}

/**
 * @param settings { mass, radius, speed, theta0 = 0 }
 * @param opts { cutAt: time of the cut (s) or null, duration }
 */
export function createCircularRun(settings, { cutAt = null, duration = 12 } = {}) {
  const q = circleQuantities(settings);
  const theta0 = settings.theta0 ?? 0;
  if (cutAt !== null && (!Number.isFinite(cutAt) || cutAt < 0)) throw new RangeError('Cut time must be ≥ 0.');
  const run = { ...settings, ...q, theta0, cutAt, duration, endTime: duration };
  if (cutAt !== null && cutAt < duration) {
    const c = attachedAt(run, cutAt);
    // Leaves the table where |p + v τ| = TABLE_RADIUS; p·v = 0 so τ = √(Rt² − R²)/v.
    const exitAfter = Math.sqrt(TABLE_RADIUS ** 2 - settings.radius ** 2) / settings.speed;
    run.cut = c;
    run.endTime = Math.min(duration, cutAt + exitAfter);
  }
  return run;
}

function attachedAt(run, t) {
  const th = run.theta0 + run.omega * t, R = run.radius, v = run.speed, w = run.omega;
  const c = Math.cos(th), s = Math.sin(th);
  return { t, x: R * c, y: R * s, vx: -v * s, vy: v * c, ax: -w * w * R * c, ay: -w * w * R * s, theta: th, attached: true, tension: run.force };
}

/** Exact state at time t (0 ≤ t ≤ endTime). */
export function sampleAt(run, t) {
  if (!Number.isFinite(t) || t < 0 || t > run.endTime + 1e-9) throw new RangeError('Time outside the run.');
  if (!run.cut || t < run.cutAt) return attachedAt(run, t);
  const c = run.cut, dt = t - run.cutAt;
  return { t, x: c.x + c.vx * dt, y: c.y + c.vy * dt, vx: c.vx, vy: c.vy, ax: 0, ay: 0, theta: Math.atan2(c.y + c.vy * dt, c.x + c.vx * dt), attached: false, tension: 0 };
}

/** Evenly spaced samples (for graphs and CSV). */
export function sampleGrid(run, dt = 0.01) {
  const out = [];
  const n = Math.floor(run.endTime / dt + 1e-9);
  for (let i = 0; i <= n; i++) out.push(sampleAt(run, Math.min(run.endTime, i * dt)));
  if (run.endTime - out.at(-1).t > 1e-9) out.push(sampleAt(run, run.endTime));   // always include the exact final state
  if (run.cut && run.cutAt <= run.endTime) {           // exact samples either side of the cut
    out.push({ ...attachedAt(run, run.cutAt) }, sampleAt(run, run.cutAt));
    out.sort((a, b) => a.t - b.t || (a.attached ? -1 : 1));
  }
  return out.map(s => ({ ...s, speed: Math.hypot(s.vx, s.vy), accel: Math.hypot(s.ax, s.ay) }));
}

/** Time at which the puck first reaches angle φ (radians, counterclockwise from +x) at or after t0. */
export function timeAtAngle(run, phi, t0 = 0) {
  const twoPi = 2 * Math.PI;
  const start = run.theta0 + run.omega * t0;
  let d = (phi - start) % twoPi; if (d < 0) d += twoPi;
  return t0 + d / run.omega;
}
