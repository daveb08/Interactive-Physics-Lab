/** Instructor-authored guided activities for Forces That Change. Pure data + checks (unit-tested). */
export const ACTIVITIES = Object.freeze({
  V1: {
    title: 'What speed does the cart approach?',
    scenario: 'drag',
    settings: { law: 'linear', mass: 2, force: 6, b: 2, v0: 0 },
    conditions: 'Linear drag. m = 2 kg, F = +6 N, b = 2 kg/s, starting from rest.',
    objective: 'Predict the speed a cart approaches when drag grows in proportion to its speed.',
    fullObjective: 'Terminal velocity is reached when drag balances the applied force: F − b v_T = 0, so v_T = F/b.',
    question: 'After a long time, the cart’s speed will…',
    choices: [
      { id: 'A', text: 'Keep increasing at a steady rate, a = F/m = 3 m/s²' },
      { id: 'B', text: 'Level off at 3 m/s' },
      { id: 'C', text: 'Level off at 6 m/s' },
      { id: 'D', text: 'Rise, then fall back to zero' },
    ],
    correct: 'B',
    misconceptions: {
      A: 'a = F/m only holds at t = 0. Drag grows as the cart speeds up, so the net force, and with it the acceleration, shrinks toward zero.',
      C: '6 is the applied force in newtons. Speed levels off where drag equals the push: b v = 6 N, so v = 6/2 = 3 m/s.',
      D: 'Drag can only reduce the net force to zero; it cannot reverse the motion while the push continues.',
    },
    observation: 'The velocity curve rises steeply, then flattens toward the dashed line at 3 m/s. At t = τ = 1 s it has covered 63% of the approach; acceleration decays exponentially to zero.',
    explanation: 'm dv/dt = F − b v has solution v(t) = (F/b)(1 − e^(−t/τ)) with τ = m/b. The slope of v(t) is the acceleration, which equals (F − b v)/m and vanishes as v → F/b.',
    takeaway: 'Terminal velocity v_T = F/b is a force balance, not a limit on acceleration you can read from a = F/m.',
    reflection: 'Explain why the acceleration is largest at the start and zero at terminal velocity, using the graphs.',
    modelAnswer: 'At t = 0 the cart is at rest, so drag is zero and the net force is the full 6 N: a = 3 m/s², the steepest slope of v(t). As v grows, drag b v grows, the net force F − b v shrinks, and so does the slope. When b v = F (v = 3 m/s), the net force is zero and the velocity stops changing.',
  },
  V2: {
    title: 'Double the mass: what changes?',
    scenario: 'drag',
    settings: { law: 'linear', mass: 4, force: 6, b: 2, v0: 0 },
    reference: { settings: { law: 'linear', mass: 2, force: 6, b: 2, v0: 0 }, label: '2 kg (V1)' },
    conditions: 'Same as V1 (F = +6 N, b = 2 kg/s, from rest), but m = 4 kg. The 2 kg curve is overlaid after the run.',
    objective: 'Separate what mass changes from what it does not when drag is present.',
    fullObjective: 'Terminal speed v_T = F/b does not depend on mass; the time constant τ = m/b does.',
    question: 'Compared with the 2 kg cart, the 4 kg cart…',
    choices: [
      { id: 'A', text: 'Reaches half the terminal speed, in the same time' },
      { id: 'B', text: 'Reaches the same terminal speed, but takes twice as long to approach it' },
      { id: 'C', text: 'Reaches the same terminal speed in the same time' },
      { id: 'D', text: 'Reaches twice the terminal speed' },
    ],
    correct: 'B',
    misconceptions: {
      A: 'Terminal speed comes from F = b v_T; mass does not appear. Mass sets how quickly the cart gets there.',
      C: 'A heavier cart accelerates less for the same net force, so the approach is slower: τ = m/b doubles from 1 s to 2 s.',
      D: 'Heavier objects fall faster in air because their weight (the driving force) grows with mass. Here the applied force is fixed at 6 N.',
    },
    observation: 'Both curves level off at 3 m/s. The 4 kg curve reaches 63% of v_T at t = 2 s instead of 1 s.',
    explanation: 'v(t) = (F/b)(1 − e^(−b t/m)). Mass appears only in the exponent: doubling m stretches the time axis by 2 without changing the asymptote.',
    takeaway: 'In m dv/dt = F − b v, the steady state is set by the forces and the timescale by the inertia.',
    reflection: 'A falling skydiver is heavier than a falling feather. Why does the skydiver’s terminal speed depend on mass when this cart’s does not?',
    modelAnswer: 'For the cart, the driving force is a fixed 6 N, so v_T = F/b is independent of mass. For a falling object, the driving force is its weight m g, so v_T = m g/b (or √(m g/c) for quadratic drag): mass enters through the force, not through inertia.',
  },
  V3: {
    title: 'Which damping returns fastest without overshoot?',
    scenario: 'oscillator',
    settings: { mass: 1, k: 16, b: 8, x0: 0.5, v0: 0 },
    choiceSettings: { A: { b: 4 }, B: { b: 8 }, C: { b: 16 } },
    compare: [4, 8, 16],
    conditions: 'm = 1 kg, k = 16 N/m, released from rest at x = +0.5 m. Your chosen damping is run; all three are overlaid after the run.',
    objective: 'Find the damping that returns the cart to equilibrium fastest without crossing it.',
    fullObjective: 'Critical damping, b = 2√(k m) (ζ = 1), gives the fastest return without overshoot.',
    question: 'Which damping coefficient returns the cart to x = 0 fastest without overshooting?',
    choices: [
      { id: 'A', text: 'b = 4 kg/s' },
      { id: 'B', text: 'b = 8 kg/s' },
      { id: 'C', text: 'b = 16 kg/s' },
    ],
    correct: 'B',
    misconceptions: {
      A: 'With b = 4 kg/s, ζ = 0.5: the cart is underdamped, so it overshoots and rings before settling.',
      C: 'More damping is not faster. With b = 16 kg/s, ζ = 2: the cart is overdamped and creeps back slowly.',
    },
    observation: 'b = 4 kg/s overshoots below zero; b = 16 kg/s never overshoots but is still about 0.06 m from zero after 2 s; b = 8 kg/s reaches equilibrium soonest without crossing.',
    explanation: 'ζ = b/(2√(k m)) = b/8 here. At ζ = 1 the characteristic equation has a repeated root r = −ω0 = −4 s⁻¹, giving x(t) = (A + B t)e^(−4t): the fastest decay with no oscillation.',
    takeaway: 'Critical damping is a design target: car suspensions, door closers and instrument needles are tuned near ζ = 1.',
    reflection: 'Use the characteristic equation m r² + b r + k = 0 to explain what changes at b = 8 kg/s.',
    modelAnswer: 'The roots are r = [−b ± √(b² − 4 k m)]/(2m). For b < 8 the discriminant is negative: complex roots, oscillation. For b > 8 there are two real roots, and the slower one (closer to zero) dominates and delays the return. At b = 8 the roots coincide at r = −4 s⁻¹, the most negative the slow root can be, so the decay is fastest without oscillating.',
  },
  V4: {
    title: 'Does Euler’s method conserve energy?',
    scenario: 'oscillator',
    settings: { mass: 1, k: 16, b: 0, x0: 0.5, v0: 0 },
    numerical: { methods: ['euler'], h: 0.1 },
    conditions: 'Undamped spring: m = 1 kg, k = 16 N/m, x0 = 0.5 m, from rest. Euler’s method with h = 0.1 s is overlaid on the exact solution.',
    objective: 'Test whether a simple numerical method respects conservation of energy.',
    fullObjective: 'Explicit Euler multiplies the oscillator’s energy by 1 + (ω h)² every step, so it grows without bound.',
    question: 'With no damping, the total energy computed by Euler’s method will…',
    choices: [
      { id: 'A', text: 'Stay constant, like the real system' },
      { id: 'B', text: 'Grow over time' },
      { id: 'C', text: 'Decay over time' },
    ],
    correct: 'B',
    misconceptions: {
      A: 'The exact system conserves energy, but the method does not have to. Each Euler step uses the slope at the start of the step, which overshoots outward on a circle in phase space.',
      C: 'Decay would look like damping. Euler adds energy here; the semi-implicit variant and RK4 behave very differently.',
    },
    observation: 'The Euler curve oscillates with growing amplitude while the exact curve keeps a constant amplitude. The energy plot rises by 16% every step.',
    explanation: 'For x′ = v, v′ = −ω² x, one Euler step maps (x, ω⁻¹v) by a matrix with determinant 1 + (ω h)². With ω = 4 s⁻¹ and h = 0.1 s, energy grows by a factor 1.16 per step.',
    takeaway: 'A method can be consistent and still violate a conservation law. Check energy, not just the curve shape.',
    reflection: 'Turn on the semi-implicit method and RK4 in Free Exploration. What do you notice about their energy, and why might that matter for long simulations?',
    modelAnswer: 'Semi-implicit Euler keeps the energy bounded, oscillating slightly around the true value, because it is symplectic. RK4 is far more accurate per step but slowly loses energy. For long simulations of conservative systems (orbits, molecules), bounded energy error often matters more than per-step accuracy.',
  },
});

export const ACTIVITY_IDS = Object.keys(ACTIVITIES);

/** Settings for the run a student will see, given the saved prediction. */
export function activitySettings(id, choice) {
  const a = ACTIVITIES[id];
  return { ...a.settings, ...(a.choiceSettings?.[choice] || {}) };
}

export function activityFeedback(id, choice) {
  const a = ACTIVITIES[id];
  const correct = choice === a.correct;
  return { correct, message: correct ? 'Your prediction matches the evidence.' : a.misconceptions[choice] || 'Compare your prediction with the evidence below.' };
}
