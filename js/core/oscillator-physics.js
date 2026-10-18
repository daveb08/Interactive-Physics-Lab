/**
 * Cart on a spring attached to a wall, with a linear damper. SI units; x is displacement from
 * the spring's relaxed position, positive away from the wall.
 *   m x'' + b x' + k x = 0
 * Exact solutions for undamped, underdamped, critically damped and overdamped motion.
 */
export const OSC_DEFAULTS = Object.freeze({ mass: 1, k: 16, b: 1, x0: 0.5, v0: 0 });
export const OSC_LIMITS = Object.freeze({ mass: [0.5, 10], k: [1, 50], b: [0, 20], x0: [-1, 1], v0: [-3, 3] });
export const OSC_DURATION = 20;
export const CRITICAL_TOLERANCE = 1e-9;

function check(name, value) {
  const [lo, hi] = OSC_LIMITS[name];
  if (!Number.isFinite(value) || value < lo - 1e-12 || value > hi + 1e-12) throw new RangeError(`${name} must be between ${lo} and ${hi}.`);
}

export const criticalDamping = (mass, k) => 2 * Math.sqrt(k * mass);

export function regimeOf(zeta) {
  if (zeta === 0) return 'undamped';
  if (Math.abs(zeta - 1) < CRITICAL_TOLERANCE) return 'critical';
  return zeta < 1 ? 'underdamped' : 'overdamped';
}

export function createOscillatorModel(settings = OSC_DEFAULTS, { duration = OSC_DURATION, validate = true } = {}) {
  const { mass: m, k, b, x0, v0 } = { ...OSC_DEFAULTS, ...settings };
  if (validate) for (const [n, v] of Object.entries({ mass: m, k, b, x0, v0 })) check(n, v);
  else if (!(m > 0) || !(k > 0) || !(b >= 0)) throw new RangeError('Need m > 0, k > 0, b ≥ 0.');
  const w0 = Math.sqrt(k / m), g = b / (2 * m), zeta = g / w0, regime = regimeOf(zeta);

  let state; // t -> [x, v]
  if (regime === 'undamped' || regime === 'underdamped') {
    const wd = w0 * Math.sqrt(1 - zeta * zeta), A = x0, B = (v0 + g * x0) / wd;
    state = t => {
      const e = Math.exp(-g * t), c = Math.cos(wd * t), s = Math.sin(wd * t);
      return [e * (A * c + B * s), e * ((-g * A + wd * B) * c + (-g * B - wd * A) * s)];
    };
  } else if (regime === 'critical') {
    const A = x0, B = v0 + w0 * x0; // uses γ = ω0 exactly at critical damping
    state = t => { const e = Math.exp(-w0 * t); return [(A + B * t) * e, (B - w0 * (A + B * t)) * e]; };
  } else {
    const root = w0 * Math.sqrt(zeta * zeta - 1), r1 = -g + root, r2 = -g - root;
    const C1 = (v0 - r2 * x0) / (r1 - r2), C2 = x0 - C1;
    state = t => { const e1 = Math.exp(r1 * t), e2 = Math.exp(r2 * t); return [C1 * e1 + C2 * e2, C1 * r1 * e1 + C2 * r2 * e2]; };
  }
  const e0 = 0.5 * m * v0 * v0 + 0.5 * k * x0 * x0;

  return {
    kind: 'oscillator', mass: m, k, b, x0, v0, w0, gamma: g, zeta, regime, bCritical: criticalDamping(m, k),
    endTime: duration, reason: 'duration', duration, e0,
    at(t) {
      const [x, v] = state(t), fSpring = -k * x, fDamping = -b * v;
      const ke = 0.5 * m * v * v, pe = 0.5 * k * x * x;
      // Energy balance: what the damper has removed so far equals the drop in mechanical energy.
      return { t, x, v, a: (fSpring + fDamping) / m, fSpring, fDamping, ke, pe, e: ke + pe, dissipated: e0 - ke - pe };
    },
    deriv: (t, [x, v]) => [v, (-k * x - b * v) / m],
    energy: ([x, v]) => 0.5 * m * v * v + 0.5 * k * x * x,
    initial: [x0, v0],
  };
}
