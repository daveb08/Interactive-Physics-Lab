import { STEP, TRACK } from './physics.js';

export const SPRING_DEFAULTS = Object.freeze({ massA: 2, massB: 2, stiffness: 2, compression: 1 });
export const SPRING_LIMITS = Object.freeze({ massA:[1,10], massB:[1,10], stiffness:[1,20], compression:[0.2,2] });
export const CART_WIDTH = 1;
export const SPRING_LENGTH = 4;

/** Exact harmonic time propagator for a massless, compression-only spring.
 * Reduced-mass relative motion is harmonic while compressed; after its first
 * zero compression, the carts coast. This exact integrator has no step-size
 * stability restriction or accumulated energy drift. No attraction is allowed.
 */
export function createSpringRun(settings = SPRING_DEFAULTS, { duration = 6 } = {}) {
  const config = { ...SPRING_DEFAULTS, ...settings };
  for (const [key,[min,max]] of Object.entries(SPRING_LIMITS)) {
    if (!Number.isFinite(config[key]) || config[key] < min || config[key] > max) throw new RangeError(`Invalid ${key}.`);
  }
  if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Invalid duration.');
  const {massA,massB,stiffness,compression} = config;
  const totalMass = massA + massB;
  const reducedMass = massA * massB / totalMass;
  const omega = Math.sqrt(stiffness / reducedMass);
  const releaseTime = Math.PI / (2 * omega);
  const initialGap = CART_WIDTH + SPRING_LENGTH - compression;
  const run = { ...config, totalMass, reducedMass, omega, releaseTime, initialGap,
    center: (massB-massA)*initialGap/(2*totalMass), endTime: duration, reason:'duration', done:false };
  // Maximum compressed-phase displacement is <2 m, so permitted presets cannot
  // hit the ±50 m boundaries before release. Solve coasting exits for cart edges.
  const release = springState(run,releaseTime);
  const edge = TRACK.max-CART_WIDTH/2;
  const exitA = releaseTime + (-edge-release.xA)/release.vA;
  const exitB = releaseTime + (edge-release.xB)/release.vB;
  const exit = Math.min(exitA,exitB);
  if (exit < duration) {run.endTime=exit;run.reason='boundary';}
  run.events = releaseTime <= run.endTime ? [{t:releaseTime,label:'Separation'}] : [];
  run.state = springState(run,0);
  run.samples = [run.state];
  return run;
}

/** Both carts derive from one relative coordinate and one force, guaranteeing
 * equal/opposite forces and conserving total momentum up to floating-point error.
 */
export function springState(run,t) {
  if (!Number.isFinite(t) || t < 0) throw new RangeError('Time must be nonnegative and finite.');
  const interacting = t < run.releaseTime;
  const phase = run.omega * Math.min(t,run.releaseTime);
  const compression = interacting ? run.compression*Math.cos(phase) : 0;
  const relativeSpeed = run.compression*run.omega*(interacting ? Math.sin(phase) : 1);
  const gap = CART_WIDTH+SPRING_LENGTH-compression + (interacting ? 0 : relativeSpeed*(t-run.releaseTime));
  const xA = run.center-run.massB/run.totalMass*gap;
  const xB = run.center+run.massA/run.totalMass*gap;
  const vA = -run.massB/run.totalMass*relativeSpeed;
  const vB = run.massA/run.totalMass*relativeSpeed;
  const force = run.stiffness*compression;
  const fA = -force, fB = force;
  return {t,xA,xB,vA,vB,fA,fB,aA:fA/run.massA,aB:fB/run.massB,compression,interacting,
    momentum:run.massA*vA+run.massB*vB,
    energy:0.5*run.massA*vA*vA+0.5*run.massB*vB*vB+0.5*run.stiffness*compression*compression};
}

export function stepSpringRun(run,dt=STEP) {
  if (!Number.isFinite(dt) || dt<=0) throw new RangeError('Time step must be positive.');
  if(run.done)return run.state;
  const t=Math.min(run.state.t+dt,run.endTime);
  if(run.state.t<run.releaseTime && t>=run.releaseTime)run.samples.push(springState(run,run.releaseTime));
  run.state=springState(run,t);
  if(run.samples.at(-1).t!==t)run.samples.push(run.state);
  run.done=t>=run.endTime;
  return run.state;
}
