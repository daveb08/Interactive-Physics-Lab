/**
 * Fixed-step integrators for y' = f(t, y). The state is an array; for the 1D mechanics modules
 * y = [x, v]. Used to compare numerical methods against the exact solutions.
 */
export const METHODS = Object.freeze({
  euler: 'Euler',
  semiImplicit: 'Semi-implicit Euler',
  rk4: 'RK4',
});
export const STEP_SIZES = Object.freeze([0.5, 0.2, 0.1, 0.05, 0.01]);

const add = (y, k, h) => y.map((yi, i) => yi + h * k[i]);

export function eulerStep(f, t, y, h) { return add(y, f(t, y), h); }

/** Symplectic (semi-implicit) Euler for y = [x, v]: update v first, then x with the new v. */
export function semiImplicitStep(f, t, y, h) {
  const v = y[1] + h * f(t, y)[1];
  return [y[0] + h * v, v];
}

export function rk4Step(f, t, y, h) {
  const k1 = f(t, y);
  const k2 = f(t + h / 2, add(y, k1, h / 2));
  const k3 = f(t + h / 2, add(y, k2, h / 2));
  const k4 = f(t + h, add(y, k3, h));
  return y.map((yi, i) => yi + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

const STEPPERS = { euler: eulerStep, semiImplicit: semiImplicitStep, rk4: rk4Step };

/** Integrates from t = 0 to tEnd; the last step is shortened to land exactly on tEnd. */
export function integrate(method, f, y0, h, tEnd) {
  const step = STEPPERS[method];
  if (!step) throw new RangeError(`Unknown method ${method}.`);
  if (!(h > 0) || !(tEnd >= 0)) throw new RangeError('Step must be positive and end time nonnegative.');
  let t = 0, y = [...y0];
  const out = [{ t, x: y[0], v: y[1] }];
  while (t < tEnd - 1e-12) {
    const dt = Math.min(h, tEnd - t);
    y = step(f, t, y, dt); t += dt;
    if (Math.abs(t - tEnd) < 1e-12) t = tEnd;
    out.push({ t, x: y[0], v: y[1] });
  }
  return out;
}
