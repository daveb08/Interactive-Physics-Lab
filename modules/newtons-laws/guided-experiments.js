import { createRun, forceBalance } from '../../js/core/physics.js';
import { FRICTION_EXPERIMENTS } from './friction-experiments.js';

// Instructor-authored content is kept separate from the simulator and UI.
export const EXPERIMENTS = {
  ...FRICTION_EXPERIMENTS,
  C: {
    title: 'How does mass affect acceleration?',
    previewObjective: 'Investigate how changing mass affects acceleration while keeping net force constant.',
    objective: 'Understand that acceleration is inversely proportional to mass when net force is constant.',
    runs: [{ mass: 2, force: 6, velocity: 0 }, { mass: 4, force: 6, velocity: 0 }],
    observationTime: 3,
    question: 'If the mass doubles while net force remains constant, what happens to acceleration?',
    options: ['It doubles.', 'It is reduced by half.', 'It remains unchanged.', 'It becomes zero.'],
    answer: 'B',
    observation: 'At the same 3 s observation time, the 2 kg cart reached 9 m/s and 13.5 m; the 4 kg cart reached 4.5 m/s and 6.75 m. The second velocity curve has half the slope of the first.',
    explanation: 'With net force held at +6 N, a = Fnet / m gives 3 m/s² for 2 kg and 1.5 m/s² for 4 kg. Only mass changed; force and initial velocity were controlled. Doubling the denominator halves acceleration.',
    takeaway: 'At constant net force, doubling mass halves acceleration.',
    misconceptions: {
      A: 'Greater mass does not amplify a fixed force’s effect. More mass requires more force to produce the same acceleration.',
      C: 'The same force does not guarantee the same acceleration: acceleration also depends on mass.',
      D: 'A larger mass reduces acceleration but does not eliminate it when a nonzero net force acts on a finite mass.',
    },
    reflection: 'Why does doubling mass reduce acceleration when the net force is unchanged?',
    modelAnswer: 'Newton’s Second Law gives a = Fnet / m. Holding force constant and doubling mass halves acceleration, from 3 to 1.5 m/s² here. The more massive cart’s velocity changes more slowly under the same force.',
  },
  D: {
    title: 'How does force affect acceleration?',
    previewObjective: 'Investigate how changing net force affects acceleration while keeping mass constant.',
    objective: 'Understand that acceleration is directly proportional to net force when mass is constant.',
    runs: [{ mass: 2, force: 4, velocity: 0 }, { mass: 2, force: 8, velocity: 0 }],
    observationTime: 3,
    question: 'If the net force doubles while mass remains constant, what happens to acceleration?',
    options: ['It doubles.', 'It is reduced by half.', 'It remains unchanged.', 'It becomes zero.'],
    answer: 'A',
    observation: 'At the same 3 s observation time, the +4 N run reached 6 m/s and 9 m; the +8 N run reached 12 m/s and 18 m. The second velocity curve has twice the slope of the first.',
    explanation: 'With mass held at 2 kg, a = Fnet / m gives 2 m/s² for +4 N and 4 m/s² for +8 N. Only net force changed; mass and initial velocity were controlled. Doubling the numerator doubles acceleration.',
    takeaway: 'At constant mass, doubling net force doubles acceleration.',
    misconceptions: {
      B: 'Acceleration is directly proportional to force, not inversely proportional: a larger net force produces a larger change in velocity each second.',
      C: 'Keeping mass fixed does not keep acceleration fixed when net force changes.',
      D: 'Zero acceleration requires zero net force. Doubling a nonzero net force cannot make the acceleration zero.',
    },
    reflection: 'Why does doubling net force increase acceleration when mass is unchanged?',
    modelAnswer: 'At fixed mass, a = Fnet / m is proportional to net force. Doubling force from +4 N to +8 N on the same 2 kg mass doubles acceleration from 2 to 4 m/s², so velocity increases twice as fast.',
  },
  A: {
    title: 'Does motion require a force?',
    previewObjective: 'Investigate whether an already moving cart needs a continuing net force.',
    objective: 'Understand that zero net force means zero acceleration, not zero velocity.',
    runs: [{ mass: 2, force: 0, velocity: 3 }],
    question: 'A cart is moving to the right on a frictionless track. The net force acting on it is zero. What happens to its velocity?',
    options: ['It gradually decreases to zero.', 'It remains constant at +3 m/s.', 'It continuously increases.', 'It immediately stops.'],
    answer: 'B',
    observation: 'The cart continued to the right at +3 m/s throughout the run. Its position increased linearly, and its acceleration stayed at zero.',
    explanation: 'Newton’s Second Law gives a = Fnet / m = 0 / 2 = 0 m/s². With no acceleration, the velocity does not change. The frictionless model has no force that would slow the cart down.',
    takeaway: 'An object can continue moving at constant velocity without a continuing net force.',
    misconceptions: {
      A: 'Slowing down would require a net force opposing motion. There is no friction in this experiment.',
      C: 'Increasing velocity requires nonzero acceleration and therefore a nonzero net force.',
      D: 'Zero net force does not imply zero velocity. An immediate stop would require an interaction that changes momentum.',
    },
    reflection: 'Can an object move without a net force acting on it? Explain.',
    modelAnswer: 'Yes. Zero net force produces zero acceleration, so velocity stays constant. Here the cart keeps moving at +3 m/s because no net force changes that velocity.',
  },
  B: {
    title: 'Can force oppose motion?',
    previewObjective: 'Distinguish velocity, speed, and acceleration when force and motion point in different directions.',
    objective: 'Distinguish velocity, speed, and acceleration.',
    runs: [{ mass: 2, force: 4, velocity: -4 }],
    question: "The cart is initially moving left, but the net force points right. What happens to the cart's speed initially?",
    options: ['Its speed increases.', 'Its speed decreases.', 'Its speed remains constant.', 'It immediately reverses direction.'],
    answer: 'B',
    observation: 'The cart initially moved left and slowed down. At t = 2 s, it momentarily stopped at x = −4 m, then reversed and moved right with increasing speed.',
    explanation: 'The rightward force gives a = +4 / 2 = +2 m/s² while initial velocity is −4 m/s. Velocity becomes less negative, so its magnitude (speed) first decreases. The velocity graph crosses zero at 2 s; acceleration remains +2 m/s² even at that instant.',
    takeaway: 'Force sets the direction of acceleration, which can oppose the direction of velocity.',
    misconceptions: {
      A: 'A force does not always increase speed: when acceleration opposes velocity, speed decreases initially.',
      C: 'Nonzero net force changes velocity. Here its magnitude decreases before the cart reverses.',
      D: 'A finite force changes velocity continuously, not instantaneously. This cart needs 2 s to reach zero velocity.',
    },
    reflection: 'How can a cart accelerate to the right while initially moving to the left?',
    modelAnswer: 'Velocity describes current motion; acceleration describes how velocity changes. A rightward net force gives positive acceleration. Starting with negative velocity, the cart slows, reaches zero velocity at 2 s, then gains positive velocity and moves right.',
  },
};

export class GuidedSession {
  constructor(id) {
    if (!EXPERIMENTS[id]) throw new RangeError('Unknown guided experiment.');
    this.id = id;
    this.experiment = EXPERIMENTS[id];
    this.prediction = null;
    this.started = false;
    this.completed = false;
    this.runIndex = 0;
    this.results = [];
    this.run = this.createCurrentRun();
  }
  createCurrentRun() {
    return createRun(this.experiment.runs[this.runIndex], { duration: this.experiment.observationTime });
  }
  savePrediction(choice) {
    if (this.started || !['A', 'B', 'C', 'D'].includes(choice)) return false;
    this.prediction = choice;
    return true;
  }
  start() {
    if (!this.prediction || this.run.done) return false;
    this.started = true;
    return true;
  }
  completeRun() {
    if (!this.started || !this.run.done || this.results.length > this.runIndex) return false;
    this.results.push(this.run);
    this.completed = this.results.length === this.experiment.runs.length;
    return true;
  }
  nextRun() {
    if (!this.run.done || this.results.length !== this.runIndex + 1 || this.completed) return false;
    this.runIndex += 1;
    this.run = this.createCurrentRun();
    return true;
  }
}

/** Compare observed states, never extrapolate an early boundary event to the requested time. */
export function comparisonRows(runs, time) {
  if (runs.length < 2 || runs.some(run => !run.done || Math.abs(run.state.t - time) > 1e-9)) {
    throw new RangeError('Both runs must finish at the common observation time.');
  }
  return runs.map(resultRow);
}

export function resultRow(run) {
  const row = { mass: run.mass, force: run.force, velocity: run.initial.v, acceleration: run.a, time: run.state.t, finalVelocity: run.state.v, position: run.state.x };
  if (run.frictionEnabled) {
    const initial = forceBalance(run,run.initial), final = forceBalance(run);
    Object.assign(row, {normal:final.normal, maxStatic:final.maxStatic, initialFriction:initial.friction, initialAcceleration:run.initialA, finalFriction:final.friction, netForce:final.netForce});
  }
  return row;
}
