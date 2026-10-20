/**
 * Instructor-authored guided activities for E1 Coulomb's law. Pure data + checks (unit-tested).
 * Charges are given in μC and metres; every number quoted in feedback is computed from the engine.
 */
import { MICRO } from '../../js/core/em-constants.js';
import { pairForce, netForce, zeroForcePoint } from '../../js/core/electrostatics.js';

export const toSI = set => set.map(c => ({ q: c.uC * MICRO, x: c.x, y: c.y }));
const n2 = v => v.toFixed(2);

/* ---- C1: doubling the distance ---- */
const C1_START = [{ uC: 2, x: 0.30, y: 0.30 }, { uC: 3, x: 0.50, y: 0.30 }];
const c1Force = r => pairForce(toSI(C1_START)[0], { ...toSI(C1_START)[1], x: 0.30 + r }).magnitude;

/* ---- C2: third-law pair ---- */
const C2_START = [{ uC: 1, x: 0.40, y: 0.30 }, { uC: 8, x: 0.65, y: 0.30 }];
const C2_R = 0.25;
const c2Force = () => pairForce(...toSI(C2_START)).magnitude;

/* ---- C3: zero-force point ---- */
const C3_START = [{ uC: 1, x: 0.20, y: 0.30 }, { uC: 4, x: 0.80, y: 0.30 }, { uC: 1, x: 0.26, y: 0.30 }];
export const C3_ZERO_X = 0.20 + zeroForcePoint(1 * MICRO, 4 * MICRO, 0.60);
const c3Fx = x => netForce(toSI([C3_START[0], C3_START[1], { ...C3_START[2], x }]), 2).fx;

export const ACTIVITIES = Object.freeze({
  C1: {
    title: 'Double the distance',
    charges: C1_START,
    mover: 1,
    // q₂ slides from r = 0.20 m to r = 0.40 m.
    path: u => ({ x: 0.50 + 0.20 * u, y: 0.30 }),
    duration: 2.5,
    plot: { kind: 'force-r', pair: [0, 1] },
    conditions: 'Two positive charges: q₁ = +2 μC and q₂ = +3 μC, 0.20 m apart. During the experiment q₂ is moved directly away from q₁ until they are 0.40 m apart.',
    objective: 'Predict how the electric force changes when the distance between two charges doubles.',
    fullObjective: 'Coulomb’s law is an inverse-square law, F = k|q₁q₂|/r²: doubling r divides the force by 2² = 4.',
    question: 'When the distance doubles from 0.20 m to 0.40 m, the force each charge exerts on the other becomes…',
    choices: [
      { id: 'A', text: 'Half as large', value: 0.5 },
      { id: 'B', text: 'One quarter as large', value: 0.25 },
      { id: 'C', text: 'The same, because the charges did not change', value: 1 },
      { id: 'D', text: 'Zero, because they are now too far apart', value: 0 },
    ],
    correct: 'B',
    misconceptions: {
      A: 'The force does not fall in proportion to r. It falls with r², so doubling the distance gives (1/2)² = 1/4 of the force. Watch the graph: it is a curve, not a straight line.',
      C: 'The charges are the same, but Coulomb’s law depends on the distance too: F = k|q₁q₂|/r². More distance, less force.',
      D: 'The force gets weaker with distance but never switches off. Even at 0.40 m it is still a measurable fraction of a newton.',
    },
    observation: () => `The force fell from ${n2(c1Force(0.2))} N at 0.20 m to ${n2(c1Force(0.4))} N at 0.40 m, a factor of ${n2(c1Force(0.2) / c1Force(0.4))}. At 0.28 m (about 1.4 × 0.20 m) it was already half: ${n2(c1Force(0.2 * Math.SQRT2))} N.`,
    explanation: 'In F = k|q₁q₂|/r² the distance is squared. Replacing r with 2r multiplies the denominator by 4, so the force is divided by 4. The arrows on both charges shrink together because they are a Newton’s third law pair.',
    takeaway: 'Electric force is an inverse-square law, like gravity: ×2 distance → ¼ force, ×3 distance → ⅑ force.',
    reflection: 'Predict the force if the distance is tripled to 0.60 m, then explain your reasoning in one or two sentences.',
    modelAnswer: () => `Tripling r multiplies r² by 9, so the force is ${n2(c1Force(0.2))} N ÷ 9 = ${n2(c1Force(0.6))} N. Only the distance changed, and Coulomb’s law depends on 1/r².`,
  },
  C2: {
    title: 'Who pushes harder?',
    charges: C2_START,
    mover: 1,
    // q₂ swings half-way round q₁ at fixed separation, so students see the pair stay equal in every direction.
    path: u => ({ x: 0.40 + C2_R * Math.cos(Math.PI * u), y: 0.30 + C2_R * Math.sin(Math.PI * u) }),
    duration: 3,
    plot: { kind: 'pair-both', pair: [0, 1] },
    conditions: 'A small charge q₁ = +1 μC and a large charge q₂ = +8 μC, 0.25 m apart. During the experiment q₂ is carried half-way round q₁, keeping the distance fixed.',
    objective: 'Compare the force the large charge exerts on the small one with the force the small charge exerts on the large one.',
    fullObjective: 'The electric forces two charges exert on each other are a Newton’s third law pair: equal in size and opposite in direction, whatever the sizes of the charges.',
    question: 'Compare the force of the +8 μC charge on the +1 μC charge with the force of the +1 μC charge on the +8 μC charge.',
    choices: [
      { id: 'A', text: 'The 8 μC charge pushes 8 times harder' },
      { id: 'B', text: 'They are equal in size and opposite in direction' },
      { id: 'C', text: 'The 1 μC charge pushes harder, because it is smaller' },
      { id: 'D', text: 'Only the 8 μC charge exerts a force' },
    ],
    correct: 'B',
    misconceptions: {
      A: 'The 8 μC charge does not push harder. Both q₁ and q₂ appear in k|q₁q₂|/r², so the product, and the force, is the same for each. A bigger charge feels a bigger force from a given field, but here the small charge’s field is weaker by the same factor.',
      C: 'Size of charge does not give either one an advantage: the force on each uses the same product q₁q₂ and the same distance r.',
      D: 'Every charge exerts a force on every other charge. If q₂ pushes q₁, then q₁ pushes q₂ back equally (Newton’s third law).',
    },
    observation: () => `In every position both arrows measured ${n2(c2Force())} N and pointed in opposite directions along the line joining the charges. The two curves on the graph lie exactly on top of each other.`,
    explanation: 'Coulomb’s law gives one number for the pair, k|q₁q₂|/r², and it applies to both charges. The force on q₁ points away from q₂ and the force on q₂ points away from q₁: equal and opposite, as Newton’s third law requires.',
    takeaway: 'Electric forces come in equal and opposite pairs. A larger charge does not push harder than it is pushed.',
    reflection: 'The two charges feel equal forces. Why would the +1 μC charge still speed up more if both were released? (Assume it has much less mass.)',
    modelAnswer: 'Equal forces do not mean equal accelerations. By Newton’s second law a = F/m, so the charge with less mass accelerates more. The size of a charge sets how strongly it interacts, but the pair of forces is always equal; mass decides how each object responds.',
  },
  C3: {
    title: 'The balance point',
    charges: C3_START,
    mover: 2,
    // q₃ scans the line from left to right, then moves to the balance point.
    path: u => ({ x: u < 0.75 ? 0.26 + 0.48 * (u / 0.75) : 0.74 + (C3_ZERO_X - 0.74) * ((u - 0.75) / 0.25), y: 0.30 }),
    duration: 4,
    plot: { kind: 'fx-x', on: 2, from: 0.24, to: 0.76 },
    lockToLine: true,
    arrowN: 0.5,      // arrows scaled for the forces near the balance point
    conditions: 'Two fixed positive charges 0.60 m apart: q₁ = +1 μC on the left and q₂ = +4 μC on the right. A +1 μC test charge q₃ is placed on the line between them and moved from left to right.',
    objective: 'Find where between two like charges the net electric force on a third charge is zero.',
    fullObjective: 'The two forces on q₃ cancel where k q₁/x² = k q₂/(d − x)². Because the force falls with r², the balance point is nearer the smaller charge.',
    question: 'Where between q₁ (+1 μC) and q₂ (+4 μC) is the net force on q₃ zero?',
    choices: [
      { id: 'A', text: 'Exactly at the midpoint, 0.30 m from each' },
      { id: 'B', text: 'Closer to the smaller charge q₁' },
      { id: 'C', text: 'Closer to the larger charge q₂' },
      { id: 'D', text: 'Nowhere: the larger charge always wins' },
    ],
    correct: 'B',
    misconceptions: {
      A: 'At the midpoint the distances are equal, so the 4 μC charge pushes 4 times harder and q₃ is pushed toward q₁. To balance, q₃ must be nearer the weaker charge.',
      C: 'Near q₂ its push is strongest, so q₃ would be shoved back toward q₁. The balance point is where the smaller charge’s push is boosted by being close.',
      D: 'Close enough to q₁, its push becomes as large as you like (1/r² grows without limit), so somewhere the two pushes must match.',
    },
    observation: () => `F_x on q₃ was +${n2(c3Fx(0.26))} N (pushed right) near q₁ and ${n2(c3Fx(0.74))} N (pushed left) near q₂. It crossed zero at x = ${n2(C3_ZERO_X)} m: ${n2(C3_ZERO_X - 0.2)} m from q₁ and ${n2(0.8 - C3_ZERO_X)} m from q₂.`,
    explanation: () => `For the pushes to match, q₁/x² = q₂/(d − x)², so (d − x)/x = √(q₂/q₁) = √4 = 2. The balance point is twice as far from q₂ as from q₁: x = d/3 = ${n2(C3_ZERO_X - 0.2)} m from q₁.`,
    takeaway: 'Superposition: add the forces from each charge as vectors. Between two like charges the zero-force point lies nearer the smaller charge, at a distance set by the square root of the charge ratio.',
    reflection: 'Is the balance point a stable place for q₃? Describe what happens if q₃ is nudged slightly toward q₂, using the graph.',
    modelAnswer: 'Along the line it is stable: nudged toward q₂, the push from q₂ grows and the push from q₁ shrinks, so the net force points back toward the balance point (the graph slopes downward through zero). Sideways (off the line) it is unstable: both charges push q₃ further away from the line.',
  },
});
export const ACTIVITY_IDS = Object.keys(ACTIVITIES);

export function activityFeedback(id, choice) {
  const a = ACTIVITIES[id];
  if (!a) throw new RangeError(`Unknown activity ${id}`);
  if (choice === a.correct) return { correct: true, message: 'That matches the experiment.' };
  return { correct: false, message: a.misconceptions[choice] || 'Compare your prediction with the experiment.' };
}

/** Resolve a text field that may be a string or a function computed from the engine. */
export const text = v => (typeof v === 'function' ? v() : v);
