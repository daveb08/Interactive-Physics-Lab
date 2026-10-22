/**
 * A ball dropped from rest, with or without quadratic air drag (Lab Bench). SI units, DOM-free.
 * No air:  y(t) = ½ g t²   (distance fallen)
 * Air:     F_drag = ½ ρ C_d A v²  →  v(t) = v_t tanh(g t / v_t),  y(t) = (v_t² / g) ln cosh(g t / v_t),
 *          v_t = √(2 m g / (ρ C_d A)). Exact closed forms; no integrator needed.
 */
export const C_D_SPHERE = 0.47;
export const AIR = Object.freeze({ none: 0, thin: 0.02, earth: 1.2 });   // kg/m³

/** Balls on the shelf. */
export const BALLS = Object.freeze({
  steel: { name: 'Steel ball', diameter: 0.0254, mass: 0.067 },
  pingpong: { name: 'Ping-pong ball', diameter: 0.040, mass: 0.0027 },
});

export function terminalSpeed(ball, g, rho) {
  if (!(rho > 0)) return Infinity;
  const A = Math.PI * (ball.diameter / 2) ** 2;
  return Math.sqrt((2 * ball.mass * g) / (rho * C_D_SPHERE * A));
}

/** ln(cosh x) without overflow for large x. */
const lnCosh = x => { const a = Math.abs(x); return a + Math.log1p(Math.exp(-2 * a)) - Math.LN2; };

/** Distance fallen and speed at time t. */
export function fallAt({ g, ball = BALLS.steel, rho = 0 }, t) {
  if (!(g > 0)) throw new RangeError('g must be positive');
  if (t <= 0) return { y: 0, v: 0 };
  const vt = terminalSpeed(ball, g, rho);
  if (!Number.isFinite(vt)) return { y: 0.5 * g * t * t, v: g * t };
  const u = (g * t) / vt;
  return { y: (vt * vt / g) * lnCosh(u), v: vt * Math.tanh(u) };
}

/** Time to fall a distance h (exact inverse). */
export function fallTime({ g, ball = BALLS.steel, rho = 0 }, h) {
  if (!(h > 0)) throw new RangeError('Drop height must be positive');
  const vt = terminalSpeed(ball, g, rho);
  if (!Number.isFinite(vt)) return Math.sqrt((2 * h) / g);
  // ln cosh u = g h / v_t²  →  u = arccosh(exp(g h / v_t²)), computed stably.
  const k = (g * h) / (vt * vt);
  const u = k > 20 ? k + Math.LN2 : Math.log(Math.exp(k) + Math.sqrt(Math.expm1(2 * k)));   // acosh(eᵏ), stable for small k
  return (u * vt) / g;
}
