/**
 * Forces acting on the cart, for the on-object arrows and the free-body diagram.
 * DOM-free and SI. Every force is named F with a subscript (F_A, F_f, F_N, F_W); friction is
 * reported as a positive magnitude whose direction is opposite the motion (or opposite the
 * applied force when static). The net force is listed separately: it is the vector sum,
 * not an additional force.
 */
import { forceBalance, GRAVITY } from './physics.js';

/** @returns {{forces: Array, net: {fx:number, fy:number, magnitude:number}}} */
export function cartForces(run, state = run.state) {
  const balance = forceBalance(run, state);
  const weight = run.mass * GRAVITY;
  const forces = [];
  if (balance.appliedForce !== 0) forces.push({ key: 'applied', sub: 'A', name: 'Applied force', fx: balance.appliedForce, fy: 0 });
  if (run.frictionEnabled && balance.friction !== 0) forces.push({ key: 'friction', sub: 'f', name: balance.regime === 'static' ? 'Static friction' : 'Kinetic friction', fx: balance.friction, fy: 0 });
  forces.push({ key: 'normal', sub: 'N', name: 'Normal force', fx: 0, fy: balance.normal });
  forces.push({ key: 'weight', sub: 'W', name: 'Weight', fx: 0, fy: -weight });
  for (const f of forces) f.magnitude = Math.hypot(f.fx, f.fy);
  const fx = forces.reduce((s, f) => s + f.fx, 0), fy = forces.reduce((s, f) => s + f.fy, 0);
  // Normal and weight cancel exactly on the level track; remove rounding residue.
  const net = { fx: Math.abs(fx) < 1e-9 ? 0 : fx, fy: Math.abs(fy) < 1e-9 ? 0 : fy };
  net.magnitude = Math.hypot(net.fx, net.fy);
  return { forces, net, regime: balance.regime };
}

/**
 * Arrow length in drawing units for a force: one shared scale, so lengths compare honestly.
 * The largest force gets maxLength; a non-zero force is never drawn shorter than minLength.
 */
export function arrowLength(magnitude, largest, { maxLength, minLength = 0 }) {
  if (!magnitude || !largest) return 0;
  return Math.max(minLength, magnitude / largest * maxLength);
}

/** Plain-text description for screen readers, e.g. "F_A 6.0 N to the right; …". */
export function describeForces({ forces, net }) {
  const dir = f => f.fx > 0 ? 'to the right' : f.fx < 0 ? 'to the left' : f.fy > 0 ? 'upward' : 'downward';
  const parts = forces.map(f => `F sub ${f.sub}, ${f.name.toLowerCase()}, ${f.magnitude.toFixed(1)} newtons ${dir(f)}`);
  parts.push(net.magnitude ? `net force ${net.magnitude.toFixed(1)} newtons ${dir(net)}` : 'net force zero');
  return parts.join('; ') + '.';
}
