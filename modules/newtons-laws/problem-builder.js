/**
 * Visual problem builder: a scenario (the object, its numbers, and which quantities are given or asked for)
 * becomes a complete Solve it problem: statement, Step 1 cards, solution steps with misconception blocks,
 * plotted answers and ghost settings. Every number comes from the same physics as the simulation.
 * Pure module (no DOM) so it is unit-tested.
 *
 * Level track only for now. A ramp adds the angle to `physics()` (N = mg cos θ, gravity component mg sin θ)
 * and rules that use it; everything else (roles, chaining, cards, blocks) stays the same.
 */
import { GRAVITY, createRun, sampleAt } from '../../js/core/physics.js';
import { formatValue, frictionError } from './problem-format.js';

const n = formatValue;
const p = x => (x < 0 ? `(${n(x)})` : n(x));            // parenthesise negatives inside arithmetic
const abs = Math.abs;
const sgnWord = s => (s > 0 ? '+x' : '−x');

/** Everything a problem can mention. `input` quantities drive the simulation; the rest follow from them. */
export const QUANTITIES = {
  m: { sym: 'm', label: 'Mass', unit: 'kg', input: true },
  F: { sym: 'F', label: 'Applied force', unit: 'N', input: true },
  v0: { sym: 'v₀', label: 'Initial velocity', unit: 'm/s', input: true },
  muS: { sym: 'μs', label: 'Static friction coefficient', unit: '', input: true, friction: true },
  muK: { sym: 'μk', label: 'Kinetic friction coefficient', unit: '', input: true, friction: true },
  t: { sym: 't', label: 'Time', unit: 's', input: true },
  W: { sym: 'W', label: 'Weight', unit: 'N' },
  N: { sym: 'N', label: 'Normal force', unit: 'N' },
  f: { sym: 'f', label: 'Friction force', unit: 'N', friction: true },
  Fnet: { sym: 'F_net', label: 'Net force', unit: 'N' },
  a: { sym: 'a', label: 'Acceleration', unit: 'm/s²' },
  v: { sym: 'v', label: 'Velocity at time t', unit: 'm/s' },
  x: { sym: 'x', label: 'Displacement at time t', unit: 'm' },
  tstop: { sym: 't_stop', label: 'Stopping time', unit: 's', stop: true },
  dstop: { sym: 'd_stop', label: 'Stopping distance', unit: 'm', stop: true },
};
export const ROLES = ['given', 'find', 'hidden'];

export const FIGURE_INFO = {
  cart: { noun: 'cart', surface: 'track', pushed: 'A constant horizontal force of {F} N pushes it in the {dir} direction.', subj: 'it', obj: 'it', poss: 'its', title: 'Pushed cart' },
  crate: { noun: 'crate', surface: 'floor', pushed: 'Someone pushes it with a constant horizontal force of {F} N in the {dir} direction.', subj: 'it', obj: 'it', poss: 'its', title: 'Pushing a crate' },
  pallet: { noun: 'pallet', surface: 'concrete floor', pushed: 'A worker pushes it with a constant horizontal force of {F} N in the {dir} direction.', subj: 'it', obj: 'it', poss: 'its', title: 'Pushing a pallet' },
  sprinter: { noun: 'runner', surface: 'running track', pushed: 'The track pushes her with a constant horizontal force of {F} N in the {dir} direction.', subj: 'she', obj: 'her', poss: 'her', title: 'Sprinter’s start', pushesOff: true, single: 'Treat her as a single object moving in a straight line.' },
};

/** A new scenario with sensible defaults. */
export function newScenario(over = {}) {
  const sc = {
    figure: 'cart', title: '', statement: '', autoStatement: true,
    mass: 4, force: 10, v0: 2, friction: false, muS: 0.3, muK: 0.2, t: 3,
    roles: { m: 'given', F: 'given', v0: 'given', muS: 'hidden', muK: 'given', t: 'given', W: 'hidden', N: 'hidden', f: 'hidden', Fnet: 'hidden', a: 'find', v: 'find', x: 'find', tstop: 'hidden', dstop: 'hidden' },
    ...over,
  };
  sc.roles = { ...newScenarioRoles(), ...(over.roles || {}) };
  return sc;
}
function newScenarioRoles() {
  return { m: 'given', F: 'given', v0: 'given', muS: 'hidden', muK: 'given', t: 'given', W: 'hidden', N: 'hidden', f: 'hidden', Fnet: 'hidden', a: 'find', v: 'find', x: 'hidden', tstop: 'hidden', dstop: 'hidden' };
}

/** Starting points that mirror the built-in problems. */
export const SAMPLES = {
  cart: { label: 'Pushed cart (frictionless)', sc: { figure: 'cart', mass: 4, force: 10, v0: 2, t: 3, friction: false, roles: { a: 'find', v: 'find', x: 'find' } } },
  stop: { label: 'Crate sliding to a stop', sc: { figure: 'crate', mass: 3, force: 0, v0: 6, friction: true, muS: 0.3, muK: 0.2, t: 2, roles: { t: 'hidden', N: 'find', f: 'find', a: 'find', v: 'hidden', tstop: 'find', dstop: 'find' } } },
  sprinter: { label: 'Sprinter’s start (exercise science)', sc: { figure: 'sprinter', mass: 70, force: 350, v0: 0, t: 1.5, friction: false, roles: { a: 'find', v: 'find', x: 'find' } } },
  pallet: { label: 'Pushing a pallet (construction management)', sc: { figure: 'pallet', mass: 120, force: 400, v0: 0, t: 2, friction: true, muS: 0.3, muK: 0.25, roles: { muS: 'given', N: 'find', f: 'find', Fnet: 'find', a: 'find', v: 'find' } } },
  force: { label: 'Find the force (work backwards)', sc: { figure: 'crate', mass: 25, force: 0, v0: 0, t: 4, friction: true, muS: 0.4, muK: 0.3, roles: { F: 'find', a: 'given', t: 'hidden', muS: 'hidden', N: 'hidden', f: 'hidden', Fnet: 'hidden', v: 'hidden' } }, a: 1.2 },
};
export function sampleScenario(id) {
  const s = SAMPLES[id];
  let sc = newScenario(JSON.parse(JSON.stringify(s.sc)));
  if (s.a !== undefined) sc = setValue(sc, 'a', s.a).sc;
  return sc;
}

/* ---------- physics of a scenario (level surface, constant forces) ---------- */

export function physics(sc) {
  const m = sc.mass, F = sc.force, v0 = sc.v0, t = sc.t, friction = !!sc.friction;
  const muS = friction ? sc.muS : 0, muK = friction ? sc.muK : 0;
  const W = m * GRAVITY, N = W, fmax = muS * N;
  const regime = !friction ? 'none' : v0 === 0 && abs(F) <= fmax ? 'static' : 'kinetic';
  const s = Math.sign(v0) || Math.sign(F) || 1;                        // direction of sliding
  const f = regime === 'kinetic' ? -s * muK * N : regime === 'static' ? -F : 0;
  const Fnet = F + f, a = Fnet / m;
  const stops = v0 !== 0 && v0 * a < 0;
  const tstop = stops ? -v0 / a : null;
  const dstop = stops ? v0 * tstop + 0.5 * a * tstop * tstop : null;
  // With friction the motion changes once it stops, so v = v0 + a t only holds up to t_stop.
  const timeValid = !(friction && stops && t > tstop + 1e-9);
  return { m, F, v0, t, muS, muK, friction, W, N, fmax, regime, s, f, Fnet, a, tstop, dstop, timeValid,
    v: v0 + a * t, x: v0 * t + 0.5 * a * t * t, g: GRAVITY };
}

/** Which quantities make sense for this scenario (others are greyed out). */
export function applicable(sc, V = physics(sc)) {
  const out = {};
  for (const [k, q] of Object.entries(QUANTITIES)) out[k] = (!q.friction || V.friction) && (!q.stop || V.tstop !== null);
  return out;
}

/* ---------- solution rules: target ← inputs, with the correct block and common mistakes ---------- */

const R = (target, inputs, step, correct, wrongs = () => [], opts = {}) => ({ target, inputs: typeof inputs === 'function' ? inputs : () => inputs, step, correct, wrongs, ...opts });
const fb = {
  weightVertical: 'Weight acts vertically and is balanced by the normal force. Only horizontal forces change horizontal motion.',
  aUnits: 'Check the units: kg/N is s²/m, not m/s². From F = m a, a = F_net / m: a larger force gives a larger acceleration.',
  aProduct: 'N·kg is not an acceleration. A heavier object accelerates less for the same force, so mass divides: a = F_net / m.',
};

const RULES = [
  R('N', ['m'], 'Normal force', V => `Vertical forces balance: N = m g = ${n(V.m)} × 9.81 = ${n(V.N)} N`,
    V => [
      { text: `N = m = ${n(V.m)} N`, value: V.m, feedback: 'The normal force is a force in newtons. It balances the weight, m g, so multiply the mass by g.' },
      ...(V.F ? [{ text: `N = m g + |F| = ${n(V.W)} + ${n(abs(V.F))} = ${n(V.W + abs(V.F))} N`, value: V.W + abs(V.F), feedback: 'The applied force is horizontal, so it does not press the object into the surface. Vertically only W and N act, so N = m g.' }] : []),
    ], { usesG: true }),
  R('W', ['m'], 'Weight', V => `W = m g = ${n(V.m)} × 9.81 = ${n(V.W)} N`,
    V => [{ text: `W = m = ${n(V.m)} N`, value: V.m, feedback: 'Mass (kg) and weight (N) are different quantities. Weight is the gravitational force on the object: W = m g.' }], { usesG: true }),
  R('N', ['W'], 'Normal force', V => `Vertical forces balance on a level surface: N = W = ${n(V.N)} N`,
    V => (V.F ? [{ text: `N = W + |F| = ${n(V.W)} + ${n(abs(V.F))} = ${n(V.W + abs(V.F))} N`, value: V.W + abs(V.F), feedback: 'The applied force is horizontal, so it does not press the object into the surface. Vertically only W and N act, so N = W.' }] : [])),
  R('m', ['N'], 'Mass', V => `Vertical balance N = m g, so m = N / g = ${n(V.N)} / 9.81 = ${n(V.m)} kg`,
    V => [{ text: `m = N × g = ${n(V.N)} × 9.81 = ${n(V.N * GRAVITY)} kg`, value: V.N * GRAVITY, feedback: 'From N = m g, divide by g to get the mass: m = N / g.' }], { usesG: true }),
  R('m', ['W'], 'Mass', V => `W = m g, so m = W / g = ${n(V.W)} / 9.81 = ${n(V.m)} kg`,
    V => [{ text: `m = W = ${n(V.W)} kg`, value: V.W, feedback: 'Weight is in newtons, mass in kilograms. From W = m g, m = W / g.' }], { usesG: true }),

  // Does it start to slide? (starts from rest, friction on, μs given)
  R('slides', ['muS', 'N', 'F'], 'Does it slide?',
    V => (V.regime === 'kinetic'
      ? `Maximum static friction μs N = ${n(V.muS)} × ${n(V.N)} = ${n(V.fmax)} N is less than |F| = ${n(abs(V.F))} N, so it slides: kinetic friction acts.`
      : `Maximum static friction μs N = ${n(V.muS)} × ${n(V.N)} = ${n(V.fmax)} N is at least |F| = ${n(abs(V.F))} N, so it stays at rest.`),
    (V, c) => (V.regime === 'kinetic'
      ? [{ text: 'It starts from rest, so static friction holds it in place: it does not move.', effect: { a: 0 }, feedback: `Static friction can supply at most μs N = ${n(V.fmax)} N. The push, ${n(abs(V.F))} N, is larger, so the ${c.noun} breaks free and slides.` }]
      : [{ text: 'Any push starts it moving, so it slides.', effect: { a: (V.F - Math.sign(V.F) * V.muK * V.N) / V.m }, feedback: `Static friction can supply up to μs N = ${n(V.fmax)} N, more than the ${n(abs(V.F))} N push. Static friction matches the push, so the ${c.noun} stays at rest.` }]),
    { when: V => V.friction && V.v0 === 0 && V.F !== 0 }),

  // Friction
  R('f', V => (V.v0 === 0 ? ['muK', 'N', 'slides'] : ['muK', 'N']), 'Friction force',
    V => `Sliding, so kinetic friction opposes the motion: f = ${V.s > 0 ? '−' : '+'}μk N = ${V.s > 0 ? '−' : '+'}${n(V.muK)} × ${n(V.N)} = ${n(V.f)} N`,
    (V, c) => [
      { text: `f = ${V.s > 0 ? '+' : '−'}μk N = ${n(-V.f)} N`, value: -V.f, feedback: `Kinetic friction opposes the sliding. The ${c.noun} moves in the ${sgnWord(V.s)} direction, so friction points the other way.` },
      ...(c.given.has('muS') ? [{ text: `f = ${V.s > 0 ? '−' : '+'}μs N = ${V.s > 0 ? '−' : '+'}${n(V.muS)} × ${n(V.N)} = ${n(-V.s * V.muS * V.N)} N`, value: -V.s * V.muS * V.N, feedback: 'μs N is the most static friction can supply before the object starts to slide. Once it slides, friction is kinetic: f = μk N.' }] : []),
      { text: `f = ${V.s > 0 ? '−' : '+'}μk m = ${V.s > 0 ? '−' : '+'}${n(V.muK)} × ${n(V.m)} = ${n(-V.s * V.muK * V.m)} N`, value: -V.s * V.muK * V.m, feedback: 'μk m has units of kg, not newtons. Friction is μk times the normal force: f = μk N = μk m g.' },
    ], { when: V => V.regime === 'kinetic' }),
  R('f', ['F', 'slides'], 'Friction force', V => `It stays at rest, so static friction balances the push: f = −F = ${n(V.f)} N`,
    V => [{ text: `f = ${V.F > 0 ? '−' : '+'}μs N = ${n(-Math.sign(V.F) * V.fmax)} N`, value: -Math.sign(V.F) * V.fmax, feedback: 'μs N is the largest static friction can be, not its value. While the object stays at rest, static friction is only as large as needed to balance the push: f = −F.' }],
    { when: V => V.regime === 'static' }),
  R('f', ['Fnet', 'F'], 'Friction force', V => `F_net = F + f, so f = F_net − F = ${n(V.Fnet)} − ${p(V.F)} = ${n(V.f)} N`,
    V => [{ text: `f = F − F_net = ${n(V.F)} − ${p(V.Fnet)} = ${n(V.F - V.Fnet)} N`, value: V.F - V.Fnet, feedback: 'Solve F_net = F + f for f: f = F_net − F. Friction comes out with the opposite sign to the motion because it opposes it.' }],
    { when: V => V.friction }),

  // Net force
  R('Fnet', ['F', 'f'], 'Net force',
    V => (V.F === 0 ? `Only friction acts horizontally: F_net = f = ${n(V.Fnet)} N` : `F_net = F + f = ${n(V.F)} + ${p(V.f)} = ${n(V.Fnet)} N`),
    (V, c) => (V.F === 0
      ? [{ text: `Nothing pushes the ${c.noun}, so F_net = 0`, value: 0, feedback: 'Friction is a horizontal force too. With no push, friction alone is the net force, which is why the object slows down.' }]
      : V.f === 0 ? [] : [
        { text: `F_net = F = ${n(V.F)} N (friction does not count once it moves)`, value: V.F, feedback: 'Friction acts the whole time the object slides, so it is part of the net force: F_net = F + f.' },
        { text: `F_net = F + |f| = ${n(V.F)} + ${n(abs(V.f))} = ${n(V.F + abs(V.f))} N`, value: V.F + abs(V.f), feedback: 'Friction points opposite the motion, so it reduces the net force. Add it with its sign: F_net = F + f.' },
      ]),
    { when: V => V.friction }),
  R('Fnet', ['F'], 'Net force',
    V => (V.F === 0 ? 'No horizontal force acts: F_net = 0 (weight and normal force cancel vertically)' : `Horizontal net force: F_net = F = ${n(V.F)} N (weight and normal force cancel vertically)`),
    (V, c) => [
      { text: `F_net = F + m g = ${n(V.F)} + ${n(V.W)} = ${n(V.F + V.W)} N`, value: V.F + V.W, feedback: fb.weightVertical },
      ...(V.v0 !== 0 && V.F !== 0 ? [{ text: `The ${c.noun} is already moving, so it needs no net force: F_net = 0`, value: 0, feedback: `Motion does not need a net force, but one is acting here: ${n(V.F)} N. Zero net force would mean constant velocity.` }] : []),
    ], { when: V => !V.friction }),
  R('Fnet', ['m', 'a'], 'Net force (Newton’s second law)', V => `F_net = m a = ${n(V.m)} × ${p(V.a)} = ${n(V.Fnet)} N`,
    V => [
      ...(V.a !== 0 ? [{ text: `F_net = m / a = ${n(V.m)} / ${p(V.a)} = ${n(V.m / V.a)} N`, value: V.m / V.a, feedback: 'Newton’s second law multiplies: F_net = m a. kg ÷ (m/s²) is not a force.' }] : []),
      { text: `F_net = m g = ${n(V.m)} × 9.81 = ${n(V.W)} N`, value: V.W, feedback: 'm g is the weight, a vertical force. The horizontal net force is m a.' },
    ]),

  // Applied force (working backwards)
  R('F', ['Fnet', 'f'], 'Applied force', V => `F_net = F + f, so F = F_net − f = ${n(V.Fnet)} − ${p(V.f)} = ${n(V.F)} N`,
    V => [{ text: `F = F_net = ${n(V.Fnet)} N`, value: V.Fnet, feedback: 'The push must also overcome friction. From F_net = F + f, F = F_net − f.' }],
    { when: V => V.friction && V.regime === 'kinetic' }),
  R('F', ['Fnet'], 'Applied force', V => `The push is the only horizontal force: F = F_net = ${n(V.F)} N`,
    V => [{ text: `F = F_net + m g = ${n(V.Fnet)} + ${n(V.W)} = ${n(V.Fnet + V.W)} N`, value: V.Fnet + V.W, feedback: fb.weightVertical }],
    { when: V => !V.friction }),

  // Acceleration
  R('a', ['Fnet', 'm'], 'Acceleration (Newton’s second law)', V => `a = F_net / m = ${n(V.Fnet)} / ${n(V.m)} = ${n(V.a)} m/s²`,
    V => [
      ...(V.Fnet !== 0 ? [{ text: `a = m / F_net = ${n(V.m)} / ${p(V.Fnet)} = ${n(V.m / V.Fnet)} m/s²`, value: V.m / V.Fnet, feedback: fb.aUnits }] : []),
      ...(V.friction && V.F !== 0 && V.f !== 0 ? [{ text: `a = F / m = ${n(V.F)} / ${n(V.m)} = ${n(V.F / V.m)} m/s²`, value: V.F / V.m, feedback: 'Use the net force, not the applied force alone: friction also acts on the object.' }] : []),
      { text: `a = F_net × m = ${n(V.Fnet)} × ${n(V.m)} = ${n(V.Fnet * V.m)} m/s²`, value: V.Fnet * V.m, feedback: fb.aProduct },
    ]),
  R('a', ['v', 'v0', 't'], 'Acceleration', V => `a = (v − v₀) / t = (${n(V.v)} − ${p(V.v0)}) / ${n(V.t)} = ${n(V.a)} m/s²`,
    V => [
      ...(V.v0 !== 0 ? [{ text: `a = v / t = ${n(V.v)} / ${n(V.t)} = ${n(V.v / V.t)} m/s²`, value: V.v / V.t, feedback: 'Acceleration is the change in velocity per second, (v − v₀) / t. The object did not start from rest.' }] : []),
      { text: `a = (v − v₀) × t = ${n((V.v - V.v0) * V.t)} m/s²`, value: (V.v - V.v0) * V.t, feedback: '(m/s) × s is a distance, not an acceleration. Divide the change in velocity by the time.' },
    ], { valid: V => V.timeValid }),
  R('a', ['x', 'v0', 't'], 'Acceleration', V => `From x = v₀ t + ½ a t²: a = 2(x − v₀ t) / t² = 2 × (${n(V.x)} − ${p(V.v0)} × ${n(V.t)}) / ${n(V.t)}² = ${n(V.a)} m/s²`,
    V => [{ text: `a = x / t² = ${n(V.x)} / ${n(V.t)}² = ${n(V.x / V.t ** 2)} m/s²`, value: V.x / V.t ** 2, feedback: 'This drops the ½ (and the v₀ t term) from x = v₀ t + ½ a t². Solve that equation for a: a = 2(x − v₀ t) / t².' }],
    { valid: V => V.timeValid }),
  R('a', ['tstop', 'v0'], 'Acceleration', V => `It stops when v = 0: a = −v₀ / t_stop = −${p(V.v0)} / ${n(V.tstop)} = ${n(V.a)} m/s²`,
    V => [{ text: `a = v₀ / t_stop = ${n(V.v0 / V.tstop)} m/s²`, value: V.v0 / V.tstop, feedback: 'The velocity drops to zero, so the acceleration points opposite v₀: a = (0 − v₀) / t_stop.' }],
    { when: V => V.tstop !== null }),

  // Kinematics
  R('v', ['v0', 'a', 't'], V => `Velocity at ${n(V.t)} s`, V => `v = v₀ + a t = ${n(V.v0)} + ${p(V.a)} × ${n(V.t)} = ${n(V.v)} m/s`,
    V => [
      ...(V.v0 !== 0 ? [{ text: `v = a t = ${p(V.a)} × ${n(V.t)} = ${n(V.a * V.t)} m/s`, value: V.a * V.t, effect: { v0: 0 }, feedback: 'This treats the object as starting from rest. The acceleration adds to the velocity it already had: v = v₀ + a t.' }]
        : [{ text: `v = a / t = ${p(V.a)} / ${n(V.t)} = ${n(V.a / V.t)} m/s`, value: V.a / V.t, feedback: '(m/s²) / s is m/s³, not a velocity. Acceleration is the change in velocity per second, so multiply: v = v₀ + a t.' }]),
      { text: `v = v₀ + a t² = ${n(V.v0)} + ${p(V.a)} × ${n(V.t)}² = ${n(V.v0 + V.a * V.t ** 2)} m/s`, value: V.v0 + V.a * V.t ** 2, feedback: 'a t² has units of m, a distance, not a velocity. Velocity changes by a every second: v = v₀ + a t.' },
    ], { valid: V => V.timeValid }),
  R('v', ['x', 'v0', 't'], V => `Velocity at ${n(V.t)} s`, V => `Average velocity (v₀ + v)/2 = x / t, so v = 2x / t − v₀ = 2 × ${n(V.x)} / ${n(V.t)} − ${p(V.v0)} = ${n(V.v)} m/s`,
    V => [{ text: `v = x / t = ${n(V.x)} / ${n(V.t)} = ${n(V.x / V.t)} m/s`, value: V.x / V.t, feedback: 'x / t is the average velocity, not the final one. With constant acceleration the average is (v₀ + v)/2, so v = 2x / t − v₀.' }],
    { valid: V => V.timeValid }),
  R('x', ['v0', 'a', 't'], V => `Displacement at ${n(V.t)} s`, V => `x = v₀ t + ½ a t² = ${n(V.v0)} × ${n(V.t)} + ½ × ${p(V.a)} × ${n(V.t)}² = ${n(V.x)} m`,
    V => [
      ...(V.a !== 0 ? [{ text: `x = v t = ${n(V.v)} × ${n(V.t)} = ${n(V.v * V.t)} m`, value: V.v * V.t, feedback: `x = v t only works when the velocity is constant. Here it changes from ${n(V.v0)} to ${n(V.v)} m/s, so use x = v₀ t + ½ a t².` }] : []),
      ...(V.v0 !== 0 ? [{ text: `x = ½ a t² = ½ × ${p(V.a)} × ${n(V.t)}² = ${n(0.5 * V.a * V.t ** 2)} m`, value: 0.5 * V.a * V.t ** 2, effect: { v0: 0 }, feedback: `½ a t² is the displacement from rest. The object was already moving at ${n(V.v0)} m/s, which adds v₀ t = ${n(V.v0 * V.t)} m.` }] : []),
      { text: `x = v₀ t + a t² = ${n(V.v0 * V.t + V.a * V.t ** 2)} m`, value: V.v0 * V.t + V.a * V.t ** 2, feedback: 'The ½ is missing: x = v₀ t + ½ a t². Over time t the velocity rises steadily, so the extra distance is the average gain, ½ a t, times t.' },
    ], { valid: V => V.timeValid }),
  R('x', ['v0', 'v', 't'], V => `Displacement at ${n(V.t)} s`, V => `x = ½ (v₀ + v) t = ½ × (${n(V.v0)} + ${p(V.v)}) × ${n(V.t)} = ${n(V.x)} m`,
    V => [{ text: `x = v t = ${n(V.v)} × ${n(V.t)} = ${n(V.v * V.t)} m`, value: V.v * V.t, feedback: 'The velocity was not v the whole time. With constant acceleration use the average velocity: x = ½ (v₀ + v) t.' }],
    { valid: V => V.timeValid }),
  R('tstop', ['v0', 'a'], 'Stopping time', V => `It stops when v = 0: t_stop = (0 − v₀) / a = −${p(V.v0)} / ${p(V.a)} = ${n(V.tstop)} s`,
    V => [{ text: `t_stop = v₀ × |a| = ${n(abs(V.v0))} × ${n(abs(V.a))} = ${n(abs(V.v0 * V.a))} s`, value: abs(V.v0 * V.a), feedback: '(m/s)(m/s²) is not a time. Solve 0 = v₀ + a t for t: t = −v₀ / a.' }],
    { when: V => V.tstop !== null }),
  R('dstop', ['v0', 'a'], 'Stopping distance', V => `From v² = v₀² + 2 a d with v = 0: d = v₀² / (2|a|) = ${n(abs(V.v0))}² / (2 × ${n(abs(V.a))}) = ${n(abs(V.dstop))} m`,
    V => [
      { text: `d = v₀ t_stop = ${n(abs(V.v0))} × ${n(V.tstop)} = ${n(abs(V.v0) * V.tstop)} m`, value: V.v0 * V.tstop, feedback: 'v₀ t_stop assumes it keeps its initial speed. It slows steadily to zero, so its average speed is v₀/2: d = (v₀/2) t_stop.' },
      { text: `d = v₀² / |a| = ${n(V.v0 ** 2 / abs(V.a))} m`, value: Math.sign(V.v0) * V.v0 ** 2 / abs(V.a), feedback: 'The 2 is missing. From 0 = v₀² + 2 a d, d = v₀² / (2|a|).' },
    ], { when: V => V.tstop !== null }),
  R('t', ['v', 'v0', 'a'], 'Time', V => `t = (v − v₀) / a = (${n(V.v)} − ${p(V.v0)}) / ${p(V.a)} = ${n(V.t)} s`,
    V => (V.v0 !== 0 ? [{ text: `t = v / a = ${n(V.v)} / ${p(V.a)} = ${n(V.v / V.a)} s`, value: V.v / V.a, feedback: 'The velocity only has to change by v − v₀, not by v: t = (v − v₀) / a.' }] : []),
    { when: V => V.a !== 0, valid: V => V.timeValid }),
  R('v0', ['v', 'a', 't'], 'Initial velocity', V => `v₀ = v − a t = ${n(V.v)} − ${p(V.a)} × ${n(V.t)} = ${n(V.v0)} m/s`,
    V => [{ text: `v₀ = v = ${n(V.v)} m/s`, value: V.v, feedback: 'The velocity changed during those seconds by a t. Undo that change: v₀ = v − a t.' }], { valid: V => V.timeValid }),
  R('muK', ['f', 'N'], 'Coefficient of kinetic friction', V => `|f| = μk N, so μk = |f| / N = ${n(abs(V.f))} / ${n(V.N)} = ${n(V.muK)}`,
    V => [{ text: `μk = |f| / m = ${n(abs(V.f))} / ${n(V.m)} = ${n(abs(V.f) / V.m)}`, value: abs(V.f) / V.m, feedback: 'μk compares two forces: friction and the normal force. Divide by N = m g, not by the mass.' }],
    { when: V => V.regime === 'kinetic' }),
  R('muK', ['a'], 'Coefficient of kinetic friction', V => `Friction alone: |a| = μk N / m = μk g, so μk = |a| / g = ${n(abs(V.a))} / 9.81 = ${n(V.muK)}`,
    V => [{ text: `μk = |a| = ${n(abs(V.a))}`, value: abs(V.a), feedback: 'μk has no units; |a| is in m/s². With friction alone, |a| = μk g, so divide by g.' }],
    { when: V => V.regime === 'kinetic' && V.F === 0, usesG: true }),
];

/* ---------- build ---------- */

const close = (a, b) => abs(a - b) <= 1e-6 * Math.max(1, abs(b));
const roleOf = (sc, k, app) => (app[k] ? sc.roles[k] || 'hidden' : 'hidden');

/** How a wrong value of `key` would change the motion the student predicts (for the ghost). */
function ghostEffect(V, key, value) {
  if (!Number.isFinite(value)) return undefined;
  let a;
  if (key === 'W' || key === 'N') a = V.regime === 'kinetic' ? (V.F - V.s * V.muK * value) / V.m : undefined;
  else if (key === 'f') a = (V.F + value) / V.m;
  else if (key === 'Fnet') a = value / V.m;
  else if (key === 'a') a = value;
  else if (key === 'F') a = (value + (V.regime === 'kinetic' ? V.f : 0)) / V.m;
  else if (key === 'm' && value > 0) a = V.Fnet / value;
  else if (key === 'muK' && V.regime === 'kinetic') a = (V.F - V.s * value * V.N) / V.m;
  return a === undefined || close(a, V.a) ? undefined : { a: Number(a.toPrecision(6)) };
}
function answerFor(V, key, value, aTime) {
  if (!Number.isFinite(value)) return undefined;
  const r = v => Number(v.toPrecision(6));
  if (key === 'a') return { key: 'a', t: aTime, value: r(value) };
  if (key === 'v') return { key: 'v', t: V.t, value: r(value) };
  if (key === 'x') return { key: 'x', t: V.t, value: r(value) };
  if (key === 'tstop') return value >= 0 && value <= 30 ? { key: 'v', t: r(value), value: 0 } : undefined;
  if (key === 'dstop') return { key: 'x', t: r(V.tstop), value: r(value) };
  return undefined;
}

/**
 * Turn a scenario into a Solve it problem.
 * @returns {{ problem, issues: string[], notes: string[], values, roles, order }}
 *   issues block sharing; notes are information for the instructor.
 */
export function buildProblem(sc) {
  const issues = [], notes = [];
  const bad = (cond, msg) => { if (cond) issues.push(msg); return cond; };
  bad(!(sc.mass > 0 && sc.mass <= 10000), 'The mass must be a positive number up to 10 000 kg.');
  bad(!Number.isFinite(sc.force) || abs(sc.force) > 100000, 'The applied force must be a number of newtons.');
  bad(!Number.isFinite(sc.v0) || abs(sc.v0) > 1000, 'The initial velocity must be a number of m/s.');
  bad(!(sc.t > 0 && sc.t <= 30), 'The time t must be between 0 and 30 s.');
  if (sc.friction) { const fe = frictionError(sc.muS, sc.muK); if (fe) issues.push(fe); }
  if (issues.length) return { problem: null, issues, notes, values: null, roles: {}, order: [] };

  const V = physics(sc), app = applicable(sc, V), info = FIGURE_INFO[sc.figure] || FIGURE_INFO.cart;
  const roles = Object.fromEntries(Object.keys(QUANTITIES).map(k => [k, roleOf(sc, k, app)]));
  const given = new Set(Object.keys(roles).filter(k => roles[k] === 'given'));
  const finds = Object.keys(roles).filter(k => roles[k] === 'find');
  const ctx = { noun: info.noun, given };
  if (!finds.length) issues.push('Choose at least one quantity for students to find: click it in the diagram and pick “Students find”.');

  // Whether it slides is stated in the problem unless students can work it out from μs.
  const known = new Set(given);
  if (!(V.friction && V.v0 === 0 && V.F !== 0 && given.has('muS') && given.has('F'))) known.add('slides');
  const derivation = {}, order = [];
  for (let changed = true; changed;) {
    changed = false;
    for (const r of RULES) {
      if (known.has(r.target) || (r.when && !r.when(V))) continue;
      if (r.inputs(V).every(i => known.has(i))) {
        if (r.valid && !r.valid(V)) continue;
        derivation[r.target] = r; order.push(r.target); known.add(r.target); changed = true;
      }
    }
  }
  for (const k of finds) if (!known.has(k)) {
    const q = QUANTITIES[k];
    if (k === 'muS') issues.push('Students cannot find μs from the motion: it only decides whether the object starts to slide. Make μs a given or leave it out.');
    else if ((k === 'v' || k === 'x') && !V.timeValid) issues.push(`It stops at ${n(V.tstop)} s, before t = ${n(V.t)} s, so v = v₀ + a t no longer applies at t. Choose t of at most ${n(V.tstop)} s, or ask for the stopping time and distance instead.`);
    else {
      const want = RULES.filter(r => r.target === k && (!r.when || r.when(V))).map(r => r.inputs(V).filter(i => !known.has(i) && i !== 'slides').map(i => QUANTITIES[i]?.label.toLowerCase()).join(' and ')).filter(Boolean);
      issues.push(`Students cannot work out the ${q.label.toLowerCase()} from what is given.${want.length ? ` Also give: ${[...new Set(want)].slice(0, 2).join(', or ')}.` : ''}`);
    }
  }
  if (issues.length) {
    const statement = sc.autoStatement === false && sc.statement?.trim() ? sc.statement.trim() : writeStatement(sc, V, roles, info, { usesG: V.friction || ['W', 'N'].some(k => roles[k] !== 'hidden'), steps: [] });
    return { problem: null, statement, issues, notes, values: V, roles, order: [] };
  }

  // Keep only the steps that lead to something asked for.
  const needed = new Set();
  const need = k => { if (needed.has(k) || !derivation[k]) return; needed.add(k); for (const i of derivation[k].inputs(V)) need(i); };
  finds.forEach(need);
  const steps = order.filter(k => needed.has(k));
  const usesG = steps.some(k => derivation[k].usesG) || steps.includes('slides') || (V.friction && steps.some(k => ['f', 'muK'].includes(k)));

  // Times: when the question is about (target), and how long to run the simulation.
  const timeUsed = roles.t !== 'hidden' || steps.some(k => derivation[k].inputs(V).includes('t'));
  const targetTime = timeUsed ? V.t : V.tstop !== null ? Math.floor(V.tstop * 1000) / 1000 : V.t;
  const runTime = Math.min(30, Math.max(2, Math.ceil(Math.max(targetTime, V.tstop ?? 0) * 1.25 * 2) / 2));
  const aTime = Number(((V.friction && V.tstop !== null ? Math.min(targetTime, V.tstop) : targetTime) / 2).toPrecision(4));
  const setup = { mass: sc.mass, force: sc.force, velocity: sc.v0, ...(V.friction ? { frictionEnabled: true, muS: sc.muS, muK: sc.muK } : {}) };
  const run = createRun(setup, { duration: runTime });
  if (run.endTime < targetTime - 1e-9) issues.push(`It reaches the end of the simulated track (±50 m) at ${n(run.endTime)} s, before ${n(targetTime)} s. Use a smaller force, speed or time.`);

  // Blocks
  const stepNames = {}, blocks = [];
  for (const k of steps) {
    const r = derivation[k];
    stepNames[k] = typeof r.step === 'function' ? r.step(V) : r.step;
    const after = r.inputs(V).filter(i => steps.includes(i));
    const dep = after.length ? { after } : {};
    const okAnswer = answerFor(V, k, k === 'dstop' ? V.dstop : V[k], aTime);
    blocks.push({ id: `${k}-ok`, step: k, correct: true, text: r.correct(V, ctx), ...dep, ...(okAnswer ? { answer: okAnswer } : {}) });
    const seen = new Set([r.correct(V, ctx)]), seenValues = [];
    let i = 0;
    for (const w of r.wrongs(V, ctx)) {
      if (i >= 2 || seen.has(w.text)) continue;
      if (w.value !== undefined && (!Number.isFinite(w.value) || close(w.value, k === 'dstop' ? V.dstop : V[k]))) continue;
      if (w.value !== undefined && seenValues.some(v => close(v, w.value))) continue;
      seen.add(w.text); if (w.value !== undefined) seenValues.push(w.value);
      const effect = w.effect ?? ghostEffect(V, k, w.value);
      const answer = answerFor(V, k, w.value, aTime);
      blocks.push({ id: `${k}-w${++i}`, step: k, text: w.text, feedback: w.feedback, ...dep, ...(effect ? { effect } : {}), ...(answer ? { answer } : {}) });
    }
  }

  const values = { ...V };
  const statement = sc.autoStatement === false && sc.statement?.trim() ? sc.statement.trim() : writeStatement(sc, V, roles, info, { usesG, steps });
  const problem = {
    title: sc.title?.trim() || info.title,
    statement,
    ...(sc.figure && sc.figure !== 'cart' ? { figure: sc.figure } : {}),
    noun: info.noun,
    ...(roles.m === 'given' ? { label: `${n(sc.mass)} kg` } : {}),
    surface: V.friction ? `${info.surface.toUpperCase()} · μk = ${n(sc.muK)}` : info.pushesOff ? `${info.surface.toUpperCase()} · ${info.noun.toUpperCase()} MODELED AS ONE OBJECT` : `FRICTIONLESS ${info.surface.toUpperCase()}`,
    setup, targetTime, runTime,
    quantities: cards(sc, V, roles, steps, { usesG, timeUsed, info }),
    steps: stepNames, blocks,
  };
  const view = autoView(run, runTime);
  if (view) problem.view = view;
  if (sc.statement && sc.autoStatement === false) notes.push('Using your own problem statement. Check that it matches the diagram.');
  return { problem: issues.length ? null : problem, draft: problem, statement, issues, notes, values, roles, order: steps };
}

function autoView(run, runTime) {
  let lo = 0, hi = 0;
  for (let i = 0; i <= 60; i++) { const x = sampleAt(run, Math.min(run.endTime, runTime * i / 60)).x; lo = Math.min(lo, x); hi = Math.max(hi, x); }
  const span = hi - lo;
  if (span > 70) return null;
  const pad = Math.max(1, span * 0.15);
  const min = Math.floor(lo - pad), max = Math.ceil(hi + pad);
  return { min: Math.max(-50, min), max: Math.min(50, Math.max(max, min + 4)) };
}

/* ---------- statement and Step 1 cards ---------- */

function writeStatement(sc, V, roles, info, { usesG, steps }) {
  const G = k => roles[k] === 'given';
  const P = s => s.charAt(0).toUpperCase() + s.slice(1);
  const parts = [];
  const surface = V.friction || info.pushesOff ? `a level ${info.surface}` : `a frictionless level ${info.surface}`;
  const subject = G('m') ? `A ${n(sc.mass)} kg ${info.noun}` : `A ${info.noun}`;
  const motion = G('v0') ? (V.v0 === 0 ? ` starts from rest on ${surface}` : ` is moving at ${n(abs(V.v0))} m/s in the ${sgnWord(V.v0)} direction on ${surface}`) : ` is on ${surface}`;
  parts.push(`${subject}${motion}.`);
  if (info.single) parts.push(info.single);
  if (G('F')) parts.push(V.F === 0 ? 'No horizontal force is applied to it.' : info.pushed.replace('{F}', n(abs(V.F))).replace('{dir}', sgnWord(V.F)));
  const mus = [G('muS') && `μs = ${n(V.muS)}`, G('muK') && `μk = ${n(V.muK)}`].filter(Boolean);
  if (mus.length) parts.push(`The coefficient${mus.length > 1 ? 's' : ''} of ${mus.length > 1 ? 'static and kinetic' : roles.muS === 'given' ? 'static' : 'kinetic'} friction ${mus.length > 1 ? 'are' : 'is'} ${mus.join(' and ')}.`);
  if (V.friction && V.v0 === 0 && V.F !== 0 && !(G('muS') && G('F'))) parts.push(V.regime === 'kinetic' ? `The push is enough to make ${info.obj} slide.` : `The push is not enough to move ${info.obj}.`);
  const at = `after ${n(V.t)} s`;
  const facts = {
    W: `${P(info.poss)} weight is ${n(V.W)} N.`, N: `The normal force on ${info.obj} is ${n(V.N)} N.`,
    f: `The friction force on ${info.obj} has magnitude ${n(abs(V.f))} N.`, Fnet: `The net force on ${info.obj} is ${n(V.Fnet)} N.`,
    a: `${P(info.poss)} acceleration is ${n(V.a)} m/s².`, v: `${P(at)}, ${info.poss} velocity is ${n(V.v)} m/s.`,
    x: `${P(at)}, ${info.subj} has moved ${n(V.x)} m.`, tstop: `${P(info.subj)} comes to a stop after ${n(V.tstop)} s.`,
    dstop: `${P(info.subj)} slides ${n(abs(V.dstop ?? 0))} m before stopping.`,
  };
  for (const k of Object.keys(facts)) if (G(k)) parts.push(facts[k]);
  const asks = {
    m: `${info.poss} mass`, F: 'the applied force', v0: `${info.poss} initial velocity`, muK: 'the coefficient of kinetic friction',
    W: `${info.poss} weight`, N: 'the normal force', f: 'the friction force', Fnet: 'the net force', a: `${info.poss} acceleration`,
    v: `${info.poss} velocity ${at}`, x: `how far ${info.subj} moves in ${n(V.t)} s`, tstop: `how long ${info.subj} takes to stop`,
    dstop: `how far ${info.subj} slides before stopping`, t: `how long ${info.subj} takes to reach ${n(V.v)} m/s`,
  };
  const findList = Object.keys(asks).filter(k => roles[k] === 'find').map(k => asks[k]);
  if (G('t') && !findList.some(s => s.includes(`${n(V.t)} s`)) && !G('v') && !G('x')) parts.push(`Consider the first ${n(V.t)} s of the motion.`);
  if (findList.length) parts.push(`Find ${findList.length > 1 ? `${findList.slice(0, -1).join(', ')} and ${findList.at(-1)}` : findList[0]}.`);
  if (steps.includes('x') || roles.x !== 'hidden') parts.push('Take x = 0 at t = 0.');
  if (usesG) parts.push('Use g = 9.81 m/s².');
  return parts.join(' ');
}

function cards(sc, V, roles, steps, { usesG, timeUsed, info }) {
  const out = [], add = (id, text, role, feedback) => out.push({ id, text, role, ...(feedback ? { feedback } : {}) });
  const val = k => {
    const q = QUANTITIES[k], v = k === 'dstop' ? abs(V.dstop) : V[k];
    if (k === 'v0' && v === 0) return 'v₀ = 0 (starts from rest)';
    if (k === 'F' && v === 0) return 'F = 0 (no push)';
    if (k === 'f') return `f = ${n(abs(v))} N, opposite the ${V.regime === 'static' ? 'push' : 'motion'}`;
    if (k === 'v' || k === 'x') return `${q.sym}(${n(V.t)} s) = ${n(v)} ${q.unit}`;
    return `${q.sym} = ${n(v)}${q.unit ? ` ${q.unit}` : ''}`;
  };
  for (const k of Object.keys(QUANTITIES)) if (roles[k] === 'given') add(`q-${k}`, val(k), 'known');
  if (usesG) add('q-g', 'g = 9.81 m/s²', 'known');
  if (roles.x !== 'hidden' || roles.dstop !== 'hidden') add('q-x0', 'x₀ = 0 m', 'known');
  if (roles.tstop === 'find' || roles.dstop === 'find') add('q-vend', 'v_final = 0 (it stops)', 'known');
  for (const k of Object.keys(QUANTITIES)) if (roles[k] === 'find') {
    const q = QUANTITIES[k];
    add(`q-${k}`, k === 'v' || k === 'x' ? `${q.sym}(${n(V.t)} s) = ?` : `${q.sym} = ?`, 'unknown');
  }

  // Trap cards: common wrong readings of this kind of problem (at most three).
  const traps = [];
  if (roles.v0 === 'given' && V.v0 !== 0) traps.push(['v₀ = 0 (starts from rest)', `It is already moving at ${n(V.v0)} m/s when the problem starts, so v₀ = ${n(V.v0)} m/s, not 0.`]);
  if (V.friction && roles.F === 'given' && V.F !== 0 && roles.Fnet !== 'given') traps.push([`F_net = ${n(V.F)} N (given)`, `${n(abs(V.F))} N is the applied force, not the net force. Friction acts too, so the net force is something you must work out.`]);
  if (V.friction && V.regime === 'kinetic' && roles.muS === 'given') traps.push([`μs = ${n(V.muS)} sets the friction while it slides`, `μs only decides whether it starts to slide. Once it slides, friction is kinetic: use μk = ${n(V.muK)}.`]);
  if (!V.friction && info.pushesOff) traps.push(['Friction opposes her: subtract μ m g', 'The forward push IS static friction from the track on her shoes. Her foot pushes back on the track; the track pushes her forward. No separate friction slows her here.']);
  else if (!V.friction) traps.push(['μk = ?', 'The surface is frictionless: there is no friction coefficient in this problem, known or unknown.']);
  traps.push([`F_net = m g = ${n(V.W)} N`, 'Weight is vertical and is balanced by the normal force. It is not part of the horizontal net force.']);
  if (!timeUsed) traps.push([`t = ${n(V.t)} s (given)`, 'No time is given. Work with the quantities the problem states.']);
  const notAsked = ['x', 'v', 'a'].find(k => roles[k] === 'hidden' && timeUsed && !steps.includes(k));
  if (notAsked && traps.length < 3) traps.push([`${QUANTITIES[notAsked].sym}${notAsked === 'a' ? '' : `(${n(V.t)} s)`} = ?`, 'The problem does not ask for this. Put only what you are asked to find in Unknowns.']);
  traps.slice(0, 3).forEach(([text, feedback], i) => add(`q-trap${i + 1}`, text, 'none', feedback));
  return out;
}

/* ---------- editing values on the diagram ---------- */

const round6 = v => Number(v.toPrecision(6));
/**
 * Set any quantity's value. Inputs change directly; for the others the builder changes the input that
 * produces them (mass for W and N, μk for friction, the applied force for F_net, a, v and x).
 * @returns {{ sc, note? , error? }}
 */
export function setValue(sc0, key, value) {
  const sc = JSON.parse(JSON.stringify(sc0));
  if (!Number.isFinite(value)) return { sc: sc0, error: 'Enter a number.' };
  const V = physics(sc);
  const direct = { m: 'mass', F: 'force', v0: 'v0', muS: 'muS', muK: 'muK', t: 't' };
  if (direct[key]) { sc[direct[key]] = value; return { sc }; }
  const forceFor = Fnet => {
    // Choose F so the net force is Fnet with kinetic friction opposing the resulting motion.
    if (!V.friction) return Fnet;
    const dir = Math.sign(V.v0) || Math.sign(Fnet) || 1;
    return Fnet + dir * V.muK * V.N;
  };
  const viaNet = (Fnet, what) => {
    sc.force = round6(forceFor(Fnet));
    const W2 = physics(sc);
    if (!close(W2.Fnet, Fnet)) return { sc: sc0, error: `With static friction up to ${n(V.fmax)} N, that ${what} cannot start it sliding. Lower μs or choose a larger value.` };
    return { sc, note: `Set the applied force to ${n(sc.force)} N to give this ${what}.` };
  };
  switch (key) {
    case 'W': case 'N':
      if (value <= 0) return { sc: sc0, error: 'Must be positive.' };
      sc.mass = round6(value / GRAVITY); return { sc, note: `Set the mass to ${n(sc.mass)} kg.` };
    case 'f':
      if (!V.friction) return { sc: sc0, error: 'Turn friction on first.' };
      // Friction is entered as a size; its direction always opposes the motion (or the push, at rest).
      if (value < 0) return { sc: sc0, error: 'Enter the size of the friction force (a positive number). Its direction is set by the motion: it always points opposite the sliding, as the arrow shows.' };
      if (V.regime === 'static') {
        if (value > V.fmax + 1e-9) return { sc: sc0, error: `Static friction can be at most μs N = ${n(V.fmax)} N here.` };
        sc.force = round6((Math.sign(V.F) || 1) * value);
        return { sc, note: `At rest, static friction balances the push: set F to ${n(sc.force)} N.` };
      }
      sc.muK = round6(value / V.N);
      if (sc.muK > 1) return { sc: sc0, error: `That needs μk = ${n(sc.muK)}, more than 1.` };
      if (!(sc.muS > sc.muK)) sc.muS = Math.min(1, round6(sc.muK + 0.1));
      return { sc, note: `Set μk to ${n(sc.muK)}.` };
    case 'Fnet': return viaNet(value, 'net force');
    case 'a': return viaNet(value * V.m, 'acceleration');
    case 'v': return viaNet((value - V.v0) / V.t * V.m, 'velocity');
    case 'x': return viaNet(2 * (value - V.v0 * V.t) / V.t ** 2 * V.m, 'displacement');
    case 'tstop': case 'dstop': {
      if (!V.v0) return { sc: sc0, error: 'It needs an initial velocity to stop from.' };
      if (value <= 0) return { sc: sc0, error: 'Must be positive.' };
      const aNeed = key === 'tstop' ? -V.v0 / value : -Math.sign(V.v0) * V.v0 ** 2 / (2 * value);
      return viaNet(aNeed * V.m, key === 'tstop' ? 'stopping time' : 'stopping distance');
    }
    default: return { sc: sc0, error: 'This value cannot be set directly.' };
  }
}

/* ---------- reading a written problem ---------- */

const NUMRE = String.raw`([+\-−]?\d*\.?\d+)`;
const toNum = s => Number(s.replace('−', '-'));

/**
 * Read a written problem: numbers with units, friction coefficients, "from rest", the object, and what it asks
 * for. Returns a scenario and a list of what was recognised (for the instructor to confirm on the diagram).
 */
export function readProblemText(text, base = newScenario()) {
  const src = String(text || '').replace(/\s+/g, ' ').trim();
  let sc = JSON.parse(JSON.stringify(base));
  sc.statement = src; sc.autoStatement = false; sc.title = '';
  for (const k of Object.keys(sc.roles)) sc.roles[k] = 'hidden';
  sc.friction = false;
  const found = [];
  const sentences = src.split(/(?<=[.?!])\s+/);
  const isQuestion = s => /\b(find|determine|calculate|compute|what|how|show|predict)\b/i.test(s) || /\?$/.test(s);
  const question = sentences.filter(isQuestion).join(' ');
  const facts = sentences.filter(s => !isQuestion(s)).join(' ') || src;
  const lower = src.toLowerCase();

  // Object → figure
  const figs = [['sprinter', /\b(sprinter|runner|athlete)\b/], ['pallet', /\bpallet\b/], ['crate', /\b(crate|box|block|sled|package|load)\b/], ['cart', /\b(cart|car|trolley|wagon)\b/]];
  sc.figure = figs.find(([, re]) => re.test(lower))?.[0] || 'cart';

  // Friction
  const mu = kind => {
    const a = src.match(new RegExp(String.raw`(?:μ|mu|u)\s*_?\s*${kind}\s*(?:=|is|of)?\s*${NUMRE}`, 'i'));
    const b = src.match(new RegExp(String.raw`coefficient of ${kind === 's' ? 'static' : 'kinetic'} friction\D{0,40}?${NUMRE}`, 'i'));
    return a ? toNum(a[1]) : b ? toNum(b[1]) : undefined;
  };
  let muS = mu('s'), muK = mu('k');
  const generic = src.match(new RegExp(String.raw`coefficient of friction\D{0,40}?${NUMRE}`, 'i'));
  if (muK === undefined && generic) muK = toNum(generic[1]);
  if (/frictionless|negligible friction|ignore friction/i.test(src)) sc.friction = false;
  else if (muK !== undefined || muS !== undefined || /\bfriction\b/i.test(facts)) sc.friction = true;
  if (sc.friction) {
    if (muK !== undefined) { sc.muK = muK; sc.roles.muK = 'given'; found.push(`μk = ${n(muK)}`); }
    if (muS !== undefined) { sc.muS = muS; sc.roles.muS = 'given'; found.push(`μs = ${n(muS)}`); }
    if (muS === undefined) sc.muS = Math.min(1, round6(Math.max(sc.muK + 0.1, sc.muK * 1.2)));
    if (muK === undefined && muS !== undefined) sc.muK = round6(muS * 0.8);
  }

  // Numbers with units in the facts, read with the words just before them.
  // Numbers anywhere (questions often carry the time: "… after 2.0 s?"), read with the words just before them.
  const before = (idx, len = 45) => src.slice(Math.max(0, idx - len), idx).toLowerCase();
  if (/\b(from rest|at rest|stationary|starts? from 0)\b/i.test(src)) { sc.v0 = 0; sc.roles.v0 = 'given'; found.push('v₀ = 0 (from rest)'); }
  const derived = [];
  const re = new RegExp(String.raw`${NUMRE}\s*(m\s*/\s*s(?:²|\^2|2)|m\s*/\s*s|kg|N\b|s\b|m\b)`, 'g');
  let forceSet = false;
  for (const mt of src.matchAll(re)) {
    const v = toNum(mt[1]), u = mt[2].replace(/\s/g, ''), ctxt = before(mt.index);
    if (u === 'kg') { sc.mass = v; sc.roles.m = 'given'; found.push(`m = ${n(v)} kg`); }
    else if (u === 'N') {
      if (/weigh/.test(ctxt)) derived.push(['W', v]);
      else if (/normal/.test(ctxt)) derived.push(['N', v]);
      else if (/friction/.test(ctxt)) derived.push(['f', abs(v)]);
      else if (/net/.test(ctxt)) derived.push(['Fnet', v]);
      else if (!forceSet) { sc.force = v * (/\b(left|backward|opposite|−x|-x)\b/.test(src.slice(mt.index, mt.index + 60).toLowerCase()) ? -1 : 1); sc.roles.F = 'given'; forceSet = true; found.push(`F = ${n(sc.force)} N`); }
    } else if (/^m\/s(²|\^2|2)$/.test(u)) {
      if (abs(v) === 9.8 || abs(v) === 9.81) continue;            // g
      derived.push(['a', /(decelerat|slow)/.test(ctxt) ? -abs(v) : v]);
    } else if (u === 'm/s') {
      if (/(reach|final|after|end|\bto\b)/.test(ctxt) && sc.roles.v0 !== 'hidden') derived.push(['v', v]);
      else if (sc.roles.v0 === 'hidden') { sc.v0 = v; sc.roles.v0 = 'given'; found.push(`v₀ = ${n(v)} m/s`); }
      else derived.push(['v', v]);
    } else if (u === 's') { sc.t = v; sc.roles.t = 'given'; found.push(`t = ${n(v)} s`); }
    else if (u === 'm') derived.push([/stop/.test(ctxt + src.slice(mt.index, mt.index + 30).toLowerCase()) ? 'dstop' : 'x', v]);
  }
  if (sc.roles.v0 === 'hidden') sc.v0 = 0;
  if (!forceSet) sc.force = 0;
  // No push mentioned: a sliding, coasting or braking object has no applied force.
  if (!forceSet && !derived.some(([k]) => k !== 'W' && k !== 'N') && (/\b(no (applied |horizontal )?force|coast|slid|skid|brak)/i.test(src) || !/\b(push|pull|force)/i.test(facts))) { sc.roles.F = 'given'; found.push('F = 0 (no push)'); }
  if (sc.roles.t === 'hidden' && !(sc.t > 0)) sc.t = 2;

  // Values that are results (a, v, x, N …) are set by adjusting the inputs, then marked as given.
  for (const [k, v] of derived) {
    const r = setValue(sc, k, v);
    if (!r.error) { sc = r.sc; sc.roles[k] = 'given'; found.push(`${QUANTITIES[k].sym} = ${n(v)} ${QUANTITIES[k].unit}`); }
  }

  // What is asked
  const q = question.toLowerCase();
  const asks = [
    ['N', /normal force/], ['W', /\bweight\b/], ['f', /(friction(al)? force|force of friction|the friction\b)/], ['Fnet', /net force/],
    ['tstop', /(how long|time).{0,40}(stop|rest)|stopping time/], ['dstop', /(how far|distance).{0,40}(stop|rest)|stopping distance/],
    ['a', /accelerat/], ['muK', /coefficient of (kinetic )?friction/], ['m', /\bmass\b/],
    ['F', /(applied force|what (horizontal )?force|how (hard|much force)|force (is )?(needed|required)|magnitude of the (push|pull)|the (push|pull)\b)/],
  ];
  for (const [k, re] of asks) if (re.test(q)) sc.roles[k] = 'find';
  if (/(velocity|speed|how fast)/.test(q) && sc.roles.tstop !== 'find') sc.roles.v = sc.roles.v === 'given' ? 'given' : 'find';
  if (/(how far|distance|displacement|position)/.test(q) && sc.roles.dstop !== 'find') sc.roles.x = sc.roles.x === 'given' ? 'given' : 'find';
  if (/how long/.test(q) && sc.roles.tstop !== 'find') sc.roles.t = 'find';
  if (sc.roles.muK === 'find') { sc.friction = true; }
  const asked = Object.keys(sc.roles).filter(k => sc.roles[k] === 'find').map(k => QUANTITIES[k]?.sym || k);
  return { sc, found, asked };
}

/* ---------- keeping the instructor's own wording in step with the diagram ---------- */

const UNIT_RE = { kg: 'kg', N: 'N\\b', 'm/s': 'm\\s*/\\s*s(?![²^2])', 'm/s²': 'm\\s*/\\s*s(?:²|\\^2)', s: 's\\b', m: 'm(?![/a-zA-Z])', '': '' };
/**
 * After a value changes on the diagram, replace the old number in the instructor's statement with the new one
 * (only for quantities the problem gives, and only where the old number appears with its unit).
 */
export function updateStatementNumbers(text, scBefore, scAfter) {
  const A = physics(scBefore), B = physics(scAfter);
  let out = String(text || '');
  for (const k of Object.keys(QUANTITIES)) {
    if (scAfter.roles[k] !== 'given') continue;
    const a = valueOfQ(A, k), b = valueOfQ(B, k);
    if (!Number.isFinite(a) || !Number.isFinite(b) || close(a, b)) continue;
    const unit = UNIT_RE[QUANTITIES[k].unit] ?? '';
    const re = new RegExp(String.raw`([+\-−]?)(\d*\.?\d+)(?=\s*${unit})`, 'g');
    out = out.replace(re, (all, sign, num, at) => {
      const v = Number(num);
      if (!unit && !/(μ|mu|coefficient|friction)/i.test(out.slice(Math.max(0, at - 40), at))) return all;
      if (Math.abs(v - Math.abs(a)) > 0.005 * Math.max(1, Math.abs(a))) return all;
      return sign && b < 0 ? `−${n(Math.abs(b))}` : `${sign}${n(sign ? Math.abs(b) : Math.abs(b))}`;
    });
  }
  return out;
}
const valueOfQ = (V, k) => (k === 'dstop' ? abs(V.dstop ?? NaN) : V[k]);

/**
 * setValue for the diagram: values the problem states stay fixed. If the applied force is not stated, it is the
 * free setting, so after a change it is re-solved to keep the first stated result (a, v, x, F_net, t_stop, d_stop).
 */
export function editValue(sc, key, value) {
  const r = setValue(sc, key, value);
  if (r.error || sc.roles.F === 'given') return r;
  const before = physics(sc);
  const keep = ['a', 'v', 'x', 'Fnet', 'tstop', 'dstop'].find(k => k !== key && sc.roles[k] === 'given' && Number.isFinite(valueOfQ(before, k)) && !close(valueOfQ(physics(r.sc), k), valueOfQ(before, k)));
  if (!keep) return r;
  const target = keep === 'dstop' ? abs(before.dstop) : before[keep];
  const r2 = setValue(r.sc, keep, target);
  if (r2.error) return { ...r, note: `${r.note ? `${r.note} ` : ''}The stated ${QUANTITIES[keep].label.toLowerCase()} changes as a result.` };
  return { sc: r2.sc, note: `${r.note ? `${r.note} ` : ''}Kept the stated ${QUANTITIES[keep].label.toLowerCase()} (${n(target)} ${QUANTITIES[keep].unit}); the applied force is now ${n(r2.sc.force)} N.` };
}
