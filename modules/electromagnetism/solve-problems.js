/**
 * "Solve it" problems for Unit 1, Electrostatics. Same format as the Newton's Laws problems
 * (modules/newtons-laws/solve-problems.js), so the same checker (solve-check.js) marks them.
 *
 * Every number written on a card or block is computed here from the electrostatics engine, never typed.
 *   charges  — the problem's charges: { uC, x, y } in the problem's own frame (metres)
 *   offset   — where the problem's origin sits on the 1.0 m × 0.6 m display plane
 *   targets  — indices of the charges whose forces are shown in "Run it"
 *   truth    — the engine's answers, keyed like block `answer.key`
 *   block.answer = { key, value }   the number the block states, compared with truth[key]
 *   block.effect = { on, force: [fx, fy] }  the net force on charge `on` that this block's mistake implies
 *               or { x }             (balance problem) where the student's solution puts the third charge
 */
import { K, MICRO } from '../../js/core/em-constants.js';
import { pairForce, netForce, zeroForcePoint } from '../../js/core/electrostatics.js';

const SI = set => set.map(c => ({ q: c.uC * MICRO, x: c.x, y: c.y }));
const mag = (a, b, r) => K * Math.abs(a * b) * MICRO * MICRO / (r * r);
/** 3 significant figures, with a real minus sign. */
export const s3 = v => (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(2).replace(/e([+-])(\d+)/, (_, s, d) => ` × 10${s === '-' ? '⁻' : ''}${[...d].map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]).join('')}`) : v.toPrecision(3)).replace('-', '−');
/** Angles to 0.1°. */
export const a1 = v => v.toFixed(1).replace('-', '−');
const deg = (fx, fy) => { const d = Math.atan2(fy, fx) * 180 / Math.PI; return d <= -180 + 1e-9 ? d + 360 : d; };   // (−180°, 180°]

/* ---------- S1: two charges ---------- */
const S1_Q = [{ uC: 3, x: 0, y: 0 }, { uC: -5, x: 0.30, y: 0 }];
const S1_F = mag(3, 5, 0.30);                        // 1.498 N
const S1_NOSQ = K * 15e-12 / 0.30;                   // r not squared
const S1_UC = K * 15 / 0.09;                         // μC left as C
const S1_F21 = pairForce(...SI(S1_Q).reverse());     // force on q₂ by q₁

/* ---------- S2: three charges in a line ---------- */
const S2_Q = [{ uC: 2, x: 0, y: 0 }, { uC: -3, x: 0.20, y: 0 }, { uC: 4, x: 0.50, y: 0 }];
const S2_21 = mag(2, 3, 0.20), S2_23 = mag(3, 4, 0.30), S2_23W = mag(3, 4, 0.50);
const S2_NET = netForce(SI(S2_Q), 1);                // fx = −0.150 N

/* ---------- S3: right angle ---------- */
const S3_Q = [{ uC: 4, x: 0.30, y: 0 }, { uC: -6, x: 0, y: 0.40 }, { uC: 2, x: 0, y: 0 }];
const S3_31 = mag(2, 4, 0.30), S3_32 = mag(2, 6, 0.40), S3_32W = mag(2, 6, 0.50);
const S3_NET = netForce(SI(S3_Q), 2);
const S3_ANG = deg(S3_NET.fx, S3_NET.fy);            // 139.8°
const S3_CALC = Math.atan(S3_NET.fy / S3_NET.fx) * 180 / Math.PI;   // −40.2°, the calculator answer

/* ---------- S4: balance point ---------- */
const S4_Q = [{ uC: 1, x: 0, y: 0 }, { uC: 9, x: 0.80, y: 0 }];
const S4_X = zeroForcePoint(1 * MICRO, 9 * MICRO, 0.80);              // 0.20 m

export const PROBLEMS = Object.freeze({
  S1: {
    title: 'Two charges: how hard, which way?',
    statement: 'A +3.0 μC charge q₁ is at x = 0 and a −5.0 μC charge q₂ is at x = 0.30 m. Find the size and direction of the electric force on q₂ (call it F₂₁: the force on q₂ due to q₁), and the force on q₁. Use k = 8.99 × 10⁹ N·m²/C².',
    charges: S1_Q, offset: { x: 0.30, y: 0.30 }, targets: [0, 1],
    truth: { F21: S1_F, ang21: deg(S1_F21.fx, S1_F21.fy), F12: S1_F, ang12: 0 },
    quantities: [
      { id: 'q-q1', text: 'q₁ = +3.0 μC', role: 'known' },
      { id: 'q-q2', text: 'q₂ = −5.0 μC', role: 'known' },
      { id: 'q-r', text: 'r = 0.30 m', role: 'known' },
      { id: 'q-k', text: 'k = 8.99 × 10⁹ N·m²/C²', role: 'known' },
      { id: 'q-F21', text: 'F₂₁ (size and direction) = ?', role: 'unknown' },
      { id: 'q-F12', text: 'F₁₂ (size and direction) = ?', role: 'unknown' },
      { id: 'q-m', text: 'm = ? (mass of each charge)', role: 'none', feedback: 'Coulomb’s law uses only the charges and the distance. Mass would matter only if you went on to find an acceleration.' },
      { id: 'q-big', text: 'q₂ = −5.0 C', role: 'none', feedback: 'μ means micro, 10⁻⁶. The charge is −5.0 × 10⁻⁶ C. A whole coulomb is an enormous charge.' },
      { id: 'q-g', text: 'g = 9.81 m/s²', role: 'none', feedback: 'Gravity plays no part here. The problem is about the electric force between the two charges.' },
    ],
    steps: { units: 'Convert to coulombs', size: 'Size of the force', dir: 'Direction of F₂₁', third: 'Force on q₁' },
    blocks: [
      { id: 'u-ok', step: 'units', correct: true, text: 'Convert μC to C: q₁ = +3.0 × 10⁻⁶ C, q₂ = −5.0 × 10⁻⁶ C.' },
      { id: 'u-keep', step: 'units', text: 'Keep the charges in μC: q₁ = 3.0, q₂ = −5.0. The units cancel anyway.', effect: { on: 1, force: [-S1_UC, 0] },
        feedback: 'k is in N·m²/C², so the charges must be in coulombs. Leaving them in μC makes the force 10¹² times too big.' },
      { id: 's-ok', step: 'size', correct: true, after: ['units'], text: `|F| = k|q₁q₂|/r² = (8.99 × 10⁹)(3.0 × 10⁻⁶)(5.0 × 10⁻⁶)/(0.30)² = ${s3(S1_F)} N`, answer: { key: 'F21', value: S1_F } },
      { id: 's-nosq', step: 'size', after: ['units'], text: `|F| = k|q₁q₂|/r = (8.99 × 10⁹)(3.0 × 10⁻⁶)(5.0 × 10⁻⁶)/0.30 = ${s3(S1_NOSQ)} N`, answer: { key: 'F21', value: S1_NOSQ }, effect: { on: 1, force: [-S1_NOSQ, 0] },
        feedback: 'Coulomb’s law is an inverse-square law: divide by r², not r. Check the units: N·m²/C² × C² ÷ m gives N·m, not N.' },
      { id: 's-sign', step: 'size', after: ['units'], text: `F = kq₁q₂/r² = −${s3(S1_F)} N, a negative force, so it must be smaller than zero.`,
        feedback: 'The minus sign is not a size. A negative product q₁q₂ tells you the charges attract. The size is |F| = 1.50 N; the direction comes from attraction or repulsion.' },
      { id: 'd-ok', step: 'dir', correct: true, after: ['size'], text: 'Unlike charges attract, so F₂₁ points from q₂ toward q₁: the −x direction (180°).', answer: { key: 'ang21', value: 180 } },
      { id: 'd-repel', step: 'dir', after: ['size'], text: 'q₁q₂ is negative, so the charges repel: F₂₁ points away from q₁, in the +x direction (0°).', answer: { key: 'ang21', value: 0 }, effect: { on: 1, force: [S1_F, 0] },
        feedback: 'A negative product means opposite signs, and opposite charges attract. Like charges (product positive) repel.' },
      { id: 'd-neg', step: 'dir', after: ['size'], text: 'q₂ is negative, so the force on it points toward −y, “down”.', answer: { key: 'ang21', value: -90 }, effect: { on: 1, force: [0, -S1_F] },
        feedback: 'The sign of a charge is not a direction in space. The force between two point charges always acts along the line joining them.' },
      { id: 't-ok', step: 'third', correct: true, after: ['dir'], text: `By Newton’s third law F₁₂ = ${s3(S1_F)} N toward q₂, the +x direction (0°): same size, opposite direction.`, answer: { key: 'F12', value: S1_F } },
      { id: 't-small', step: 'third', after: ['dir'], text: `q₁ is the smaller charge, so it feels less force: F₁₂ = (3/5)(${s3(S1_F)}) = ${s3(S1_F * 0.6)} N.`, answer: { key: 'F12', value: S1_F * 0.6 }, effect: { on: 0, force: [S1_F * 0.6, 0] },
        feedback: 'Both charges are in the same product q₁q₂, so each feels the same size of force. The forces are a Newton’s third law pair.' },
    ],
  },

  S2: {
    title: 'Three in a line: add the forces',
    statement: 'Three charges sit on the x-axis: q₁ = +2.0 μC at x = 0, q₂ = −3.0 μC at x = 0.20 m and q₃ = +4.0 μC at x = 0.50 m. Find the net electric force on q₂. Use k = 8.99 × 10⁹ N·m²/C² and take +x to the right.',
    charges: S2_Q, offset: { x: 0.20, y: 0.30 }, targets: [1],
    truth: { F21: S2_21, F23: S2_23, Fnet: S2_NET.fx },
    quantities: [
      { id: 'q-q1', text: 'q₁ = +2.0 μC', role: 'known' },
      { id: 'q-q2', text: 'q₂ = −3.0 μC', role: 'known' },
      { id: 'q-q3', text: 'q₃ = +4.0 μC', role: 'known' },
      { id: 'q-r21', text: 'r₂₁ = 0.20 m', role: 'known' },
      { id: 'q-r23', text: 'r₂₃ = 0.30 m', role: 'known' },
      { id: 'q-k', text: 'k = 8.99 × 10⁹ N·m²/C²', role: 'known' },
      { id: 'q-net', text: 'F_net on q₂ = ?', role: 'unknown' },
      { id: 'q-r23w', text: 'r₂₃ = 0.50 m', role: 'none', feedback: '0.50 m is where q₃ is measured from the origin. The distance from q₂ to q₃ is 0.50 − 0.20 = 0.30 m.' },
      { id: 'q-zero', text: 'F_net = 0 (q₂ is between the others)', role: 'none', feedback: 'Being between two charges does not make the forces cancel. The two pulls have different sizes, so you have to calculate them.' },
      { id: 'q-neg3', text: 'q₃ = −4.0 μC', role: 'none', feedback: 'Read the sign carefully: q₃ is positive, +4.0 μC.' },
    ],
    steps: { f21: 'Force on q₂ from q₁', f23: 'Force on q₂ from q₃', add: 'Add the forces', result: 'State the result' },
    blocks: [
      { id: 'a-ok', step: 'f21', correct: true, text: `F₂₁ = k(2.0 × 10⁻⁶)(3.0 × 10⁻⁶)/(0.20)² = ${s3(S2_21)} N. Unlike charges attract: toward q₁, so −x.`, answer: { key: 'F21', value: S2_21 } },
      { id: 'a-repel', step: 'f21', text: `F₂₁ = ${s3(S2_21)} N. q₂ is negative, so it is pushed away from q₁: +x.`, answer: { key: 'F21', value: S2_21 }, effect: { on: 1, force: [S2_21 + S2_23, 0] },
        feedback: 'q₁ is positive and q₂ is negative: opposite charges attract. F₂₁ points from q₂ toward q₁, the −x direction.' },
      { id: 'b-ok', step: 'f23', correct: true, text: `F₂₃ = k(3.0 × 10⁻⁶)(4.0 × 10⁻⁶)/(0.30)² = ${s3(S2_23)} N. Unlike charges attract: toward q₃, so +x.`, answer: { key: 'F23', value: S2_23 } },
      { id: 'b-dist', step: 'f23', text: `F₂₃ = k(3.0 × 10⁻⁶)(4.0 × 10⁻⁶)/(0.50)² = ${s3(S2_23W)} N, toward q₃ (+x).`, answer: { key: 'F23', value: S2_23W }, effect: { on: 1, force: [S2_23W - S2_21, 0] },
        feedback: 'r is the distance between the two charges, not a position. q₂ is at 0.20 m and q₃ at 0.50 m, so r₂₃ = 0.30 m.' },
      { id: 'c-ok', step: 'add', correct: true, after: ['f21', 'f23'], text: `Add with signs: F_net = −${s3(S2_21)} + ${s3(S2_23)} = ${s3(S2_NET.fx)} N.`, answer: { key: 'Fnet', value: S2_NET.fx } },
      { id: 'c-mag', step: 'add', after: ['f21', 'f23'], text: `Add the sizes: F_net = ${s3(S2_21)} + ${s3(S2_23)} = ${s3(S2_21 + S2_23)} N.`, answer: { key: 'Fnet', value: S2_21 + S2_23 }, effect: { on: 1, force: [-(S2_21 + S2_23), 0] },
        feedback: 'Forces are vectors. These two pull q₂ in opposite directions, so they partly cancel: give each one a sign (+x or −x) before adding.' },
      { id: 'd-ok', step: 'result', correct: true, after: ['add'], text: `F_net = ${s3(Math.abs(S2_NET.fx))} N in the −x direction, toward q₁. The closer charge wins, just.` },
      { id: 'd-big', step: 'result', after: ['add'], text: `F_net points in +x, toward q₃, because q₃ is the bigger charge.`, effect: { on: 1, force: [-S2_NET.fx, 0] },
        feedback: 'Charge size is only half of it. q₁ is closer, and the 1/r² factor makes its pull slightly larger. Trust the signed sum: it is negative, so −x.' },
    ],
  },

  S3: {
    title: 'Right angle: components and direction',
    statement: 'A +2.0 μC charge q₃ is at the origin. A +4.0 μC charge q₁ is at (0.30 m, 0) and a −6.0 μC charge q₂ is at (0, 0.40 m). Find the size and direction (angle from the +x axis) of the net electric force on q₃. Use k = 8.99 × 10⁹ N·m²/C².',
    charges: S3_Q, offset: { x: 0.30, y: 0.08 }, targets: [2],
    truth: { F31: S3_31, F32: S3_32, Fnet: S3_NET.magnitude, angle: S3_ANG },
    quantities: [
      { id: 'q-q1', text: 'q₁ = +4.0 μC at (0.30, 0) m', role: 'known' },
      { id: 'q-q2', text: 'q₂ = −6.0 μC at (0, 0.40) m', role: 'known' },
      { id: 'q-q3', text: 'q₃ = +2.0 μC at the origin', role: 'known' },
      { id: 'q-k', text: 'k = 8.99 × 10⁹ N·m²/C²', role: 'known' },
      { id: 'q-F', text: '|F_net| on q₃ = ?', role: 'unknown' },
      { id: 'q-th', text: 'angle θ of F_net = ?', role: 'unknown' },
      { id: 'q-hyp', text: 'r = 0.50 m (for both forces)', role: 'none', feedback: '0.50 m is the distance between q₁ and q₂. Each force on q₃ uses the distance from q₃ to that charge: 0.30 m and 0.40 m.' },
      { id: 'q-sum', text: '|F_net| = F₃₁ + F₃₂', role: 'none', feedback: 'The two forces are at right angles, so their sizes do not simply add. Combine them by components.' },
    ],
    steps: { f31: 'Force from q₁', f32: 'Force from q₂', size: 'Size of the net force', angle: 'Direction of the net force' },
    blocks: [
      { id: 'a-ok', step: 'f31', correct: true, text: `F₃₁ = k(2.0 × 10⁻⁶)(4.0 × 10⁻⁶)/(0.30)² = ${s3(S3_31)} N. Like charges repel: away from q₁, so (−${s3(S3_31)}, 0) N.`, answer: { key: 'F31', value: S3_31 } },
      { id: 'a-attract', step: 'f31', text: `F₃₁ = ${s3(S3_31)} N toward q₁: (+${s3(S3_31)}, 0) N.`, answer: { key: 'F31', value: S3_31 }, effect: { on: 2, force: [S3_31, S3_32] },
        feedback: 'q₁ and q₃ are both positive, so they repel. The force on q₃ points away from q₁, in −x.' },
      { id: 'b-ok', step: 'f32', correct: true, text: `F₃₂ = k(2.0 × 10⁻⁶)(6.0 × 10⁻⁶)/(0.40)² = ${s3(S3_32)} N. Unlike charges attract: toward q₂, so (0, +${s3(S3_32)}) N.`, answer: { key: 'F32', value: S3_32 } },
      { id: 'b-hyp', step: 'f32', text: `F₃₂ = k(2.0 × 10⁻⁶)(6.0 × 10⁻⁶)/(0.50)² = ${s3(S3_32W)} N, toward q₂: (0, +${s3(S3_32W)}) N.`, answer: { key: 'F32', value: S3_32W }, effect: { on: 2, force: [-S3_31, S3_32W] },
        feedback: 'Use the distance from q₃ to q₂, which is 0.40 m. The 0.50 m hypotenuse is the distance between q₁ and q₂ and plays no part in the force on q₃.' },
      { id: 'c-ok', step: 'size', correct: true, after: ['f31', 'f32'], text: `Components: F_x = −${s3(S3_31)} N, F_y = +${s3(S3_32)} N. |F_net| = √(F_x² + F_y²) = ${s3(S3_NET.magnitude)} N.`, answer: { key: 'Fnet', value: S3_NET.magnitude } },
      { id: 'c-add', step: 'size', after: ['f31', 'f32'], text: `|F_net| = ${s3(S3_31)} + ${s3(S3_32)} = ${s3(S3_31 + S3_32)} N.`, answer: { key: 'Fnet', value: S3_31 + S3_32 },
        feedback: 'Adding sizes only works when forces point the same way. At right angles, use the Pythagorean theorem on the components.' },
      { id: 'c-sub', step: 'size', after: ['f31', 'f32'], text: `|F_net| = ${s3(S3_31)} − ${s3(S3_32)} = ${s3(S3_31 - S3_32)} N.`, answer: { key: 'Fnet', value: S3_31 - S3_32 },
        feedback: 'Subtracting sizes only works when forces point in opposite directions. These are perpendicular: |F| = √(F_x² + F_y²).' },
      { id: 'd-ok', step: 'angle', correct: true, after: ['size'], text: `F_x < 0 and F_y > 0, so F_net points up and to the left (second quadrant): θ = 180° − tan⁻¹(${s3(S3_32)}/${s3(S3_31)}) = ${a1(S3_ANG)}°.`, answer: { key: 'angle', value: S3_ANG } },
      { id: 'd-calc', step: 'angle', after: ['size'], text: `θ = tan⁻¹(F_y/F_x) = tan⁻¹(${s3(S3_32)}/−${s3(S3_31)}) = ${a1(S3_CALC)}°.`, answer: { key: 'angle', value: S3_CALC },
        effect: { on: 2, force: [S3_NET.magnitude * Math.cos(S3_CALC * Math.PI / 180), S3_NET.magnitude * Math.sin(S3_CALC * Math.PI / 180)] },
        feedback: 'A calculator’s tan⁻¹ only returns angles between −90° and +90°. Here F_x is negative, so the force is in the second quadrant: add 180° to get 139.8°. Sketch the components first.' },
    ],
  },

  S4: {
    title: 'The balance point',
    statement: 'A +1.0 μC charge q₁ is at x = 0 and a +9.0 μC charge q₂ is at x = 0.80 m. Where on the line between them should a third charge q₃ = +2.0 μC be placed so that the net electric force on it is zero?',
    charges: S4_Q, offset: { x: 0.10, y: 0.30 }, targets: [], third: { uC: 2 },
    truth: { x: S4_X },
    quantities: [
      { id: 'q-q1', text: 'q₁ = +1.0 μC at x = 0', role: 'known' },
      { id: 'q-q2', text: 'q₂ = +9.0 μC at x = 0.80 m', role: 'known' },
      { id: 'q-q3', text: 'q₃ = +2.0 μC', role: 'known' },
      { id: 'q-zero', text: 'F_net on q₃ = 0', role: 'known' },
      { id: 'q-x', text: 'position x of q₃ = ?', role: 'unknown' },
      { id: 'q-k', text: 'k = ? (must be looked up first)', role: 'none', feedback: 'k appears on both sides of the balance equation and cancels, so its value is not needed here.' },
      { id: 'q-mid', text: 'x = 0.40 m (the midpoint)', role: 'none', feedback: 'That is a guess, not a given. At the midpoint the 9 μC charge pushes 9 times harder, so q₃ would not balance there.' },
    ],
    steps: { setup: 'Balance condition', cancel: 'Simplify', root: 'Take the square root', solve: 'Solve for x' },
    blocks: [
      { id: 'a-ok', step: 'setup', correct: true, text: 'Between two like charges the pushes oppose. Set them equal: k q₁ q₃ / x² = k q₂ q₃ / (0.80 − x)².' },
      { id: 'a-out', step: 'setup', text: 'The balance point must be outside the pair, beyond q₁: k q₁ q₃ / x² = k q₂ q₃ / (0.80 + x)².',
        feedback: 'Outside a pair of like charges both pushes point the same way, so they can never cancel there. For like charges the balance point is between them.' },
      { id: 'b-ok', step: 'cancel', correct: true, after: ['setup'], text: 'k and q₃ cancel: q₁ / x² = q₂ / (0.80 − x)², so (0.80 − x)² / x² = q₂ / q₁ = 9.' },
      { id: 'b-q3', step: 'cancel', after: ['setup'], text: 'Substitute q₃ = 2.0 μC on both sides and solve the quadratic (k q₃ does not cancel).',
        feedback: 'k q₃ is on both sides, so it cancels. That is why the answer does not depend on the size (or sign) of q₃.' },
      { id: 'c-ok', step: 'root', correct: true, after: ['cancel'], text: 'Square root of both sides: (0.80 − x) / x = √9 = 3.' },
      { id: 'c-noroot', step: 'root', after: ['cancel'], text: 'Drop the squares: (0.80 − x) / x = 9.', effect: { x: 0.80 / 10 },
        feedback: 'The distances are squared, so the ratio of distances is the square root of the charge ratio: √9 = 3, not 9.' },
      { id: 'c-flip', step: 'root', after: ['cancel'], text: 'Square root of both sides: x / (0.80 − x) = 3.', effect: { x: 0.80 * 3 / 4 },
        feedback: 'This puts q₃ three times further from q₁ than from q₂, right next to the big charge, where its push is strongest. The balance point is nearer the smaller charge.' },
      { id: 'd-ok', step: 'solve', correct: true, after: ['root'], text: `0.80 − x = 3x, so 4x = 0.80 and x = ${s3(S4_X)} m from q₁ (nearer the smaller charge).`, answer: { key: 'x', value: S4_X } },
      { id: 'd-mid', step: 'solve', after: ['root'], text: 'By symmetry the balance point is the midpoint: x = 0.40 m.', answer: { key: 'x', value: 0.40 }, effect: { x: 0.40 },
        feedback: 'The setup is not symmetric: q₂ is 9 times larger. At 0.40 m it pushes 9 times harder than q₁.' },
    ],
  },
});
export const PROBLEM_IDS = Object.keys(PROBLEMS);

/** Units for each answer key. */
export const UNITS = { F21: 'N', F12: 'N', F23: 'N', F31: 'N', F32: 'N', Fnet: 'N', ang21: '°', ang12: '°', angle: '°', x: 'm' };

/** Net force on each target charge, in the problem frame: the "simulation". */
export function trueForces(problem, third = null) {
  const set = SI(problem.charges);
  if (third) set.push({ q: third.uC * MICRO, x: third.x, y: 0 });
  return set.map((_, i) => netForce(set, i));
}

/** The forces (or balance position) the student's blocks imply: the first mistake per charge wins. */
export function studentModel(problem, sequence) {
  const byId = Object.fromEntries(problem.blocks.map(b => [b.id, b]));
  const forces = {}; let x = null;
  for (const id of sequence) {
    const e = byId[id]?.effect; if (!e) continue;
    if (e.force && !(e.on in forces)) forces[e.on] = e.force;
    if (e.x !== undefined && x === null) x = e.x;
  }
  return { forces, x, changed: Object.keys(forces).length > 0 || x !== null };
}
