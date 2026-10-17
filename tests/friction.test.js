import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, sampleAt, forceBalance, comparePrediction, GRAVITY } from '../js/core/physics.js';
import { EXPERIMENTS, GuidedSession, comparisonRows } from '../modules/newtons-laws/guided-experiments.js';
const near = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) < epsilon, `${a} ≠ ${b}`);
const make = (overrides = {}, options) => createRun({mass:2, force:0, velocity:0, frictionEnabled:true, muS:0.4, muK:0.3, ...overrides}, options);
const finish = (run, dt) => { while (!run.done) stepRun(run, dt); return run; };

test('static friction balances signed subthreshold forces, including equality at the limit', () => {
  for (const force of [0, 3, 5, -5, 0.4 * 2 * GRAVITY, -0.4 * 2 * GRAVITY]) {
    const run = finish(make({force})); const b = forceBalance(run);
    near(b.normal, 19.62); near(b.maxStatic, 7.848); near(b.friction, -force);
    near(run.a, 0); near(run.state.x, 0); near(run.state.v, 0); assert.equal(b.regime, 'static');
  }
});
test('breakaway applies kinetic friction above threshold with exact kinematics', () => {
  for (const sign of [-1, 1]) {
    const run = make({force:sign * 10}); const s = sampleAt(run, 3);
    near(s.friction, -sign * 5.886); near(s.a, sign * 2.057);
    near(s.v, sign * 6.171); near(s.x, sign * 9.2565);
    assert.equal(run.events[0].label, 'Breakaway');
  }
});
test('kinetic friction opposes positive and negative sliding velocity', () => {
  for (const velocity of [-4, 4]) {
    const run = make({velocity}); const s = sampleAt(run, 0.5);
    near(s.friction, -Math.sign(velocity) * 5.886);
    near(s.a, -Math.sign(velocity) * 2.943);
    near(s.v, velocity - Math.sign(velocity) * 2.943 * 0.5);
  }
});
test('sliding stops exactly and remains stuck without overshoot at any step size', () => {
  const stopTime = 4 / 2.943, stopDistance = 16 / (2 * 2.943);
  for (const velocity of [-4, 4]) for (const dt of [1/120, 0.7, 6]) {
    const run = finish(make({velocity}), dt);
    near(run.state.x, Math.sign(velocity) * stopDistance); near(run.state.v, 0); near(run.a, 0);
    near(run.events[0].t, stopTime); assert.equal(run.events[0].label, 'Stop / stick');
    assert.ok(run.samples.every(s => s.v * velocity >= 0));
    for (const t of [stopTime, 2, 3, 6]) { near(sampleAt(run,t).v,0); near(sampleAt(run,t).x,run.state.x); }
  }
});
test('static friction can hold after sliding even when applied force exceeds kinetic friction', () => {
  const run = finish(make({force:7, velocity:-4}));
  near(run.state.v,0); near(run.a,0); near(forceBalance(run).friction,-7);
  assert.equal(run.events[0].label, 'Stop / stick');
});
test('opposing superthreshold force produces an exact stop then physical reversal', () => {
  const run = make({force:10, velocity:-4}); const stop = 4 / 7.943;
  const xStop = -16 / (2 * 7.943);
  near(run.events[0].t,stop); assert.equal(run.events[0].label,'Stop / reverse');
  near(sampleAt(run,stop).v,0); near(sampleAt(run,stop).a,2.057);
  near(sampleAt(run,stop + 1).v,2.057); near(sampleAt(run,stop + 1).x,xStop + 2.057/2);
  finish(run, 0.8);
  const pair = run.samples.filter(s => s.t === stop);
  near(pair[0].a,7.943); near(pair[1].a,2.057);
});
test('different masses have different kinetic forces but equal deceleration and stopping distance', () => {
  const small = make({mass:2,velocity:4}), large = make({mass:4,velocity:4});
  near(sampleAt(large,0).friction,2 * sampleAt(small,0).friction);
  for (const t of [0,0.5,1,2,3]) {
    const a = sampleAt(small,t), b = sampleAt(large,t);
    near(a.a,b.a); near(a.v,b.v); near(a.x,b.x);
  }
});
test('graph samples contain exact analytical regimes and a vertical acceleration jump at stopping', () => {
  const run = finish(make({velocity:4})); const stop = 4 / 2.943;
  for (const s of run.samples) {
    const t = Math.min(s.t,stop);
    near(s.x,4*t - 0.5*2.943*t*t); near(s.v,Math.max(0,4 - 2.943*s.t));
    if (s.t !== stop) near(s.a,s.t < stop ? -2.943 : 0);
  }
  const event = run.samples.filter(s => s.t === stop);
  assert.equal(event.length,2); near(event[0].a,-2.943); near(event[1].a,0);
  assert.equal(event[1].event,'Stop / stick');
});
test('friction-off runs preserve every original sample and prediction regardless of coefficients', () => {
  const a = finish(createRun({mass:2,force:-6,velocity:4}));
  const b = finish(make({force:-6,velocity:4,frictionEnabled:false,muS:1,muK:1}));
  assert.deepEqual(a.samples,b.samples); assert.deepEqual(a.state,b.state);
  assert.deepEqual(comparePrediction(a,-3,-5),comparePrediction(b,-3,-5));
});
test('friction boundaries retain exact incident velocity before and after reversal', () => {
  for (const sign of [-1,1]) {
    const run = finish(make({mass:1,force:sign*20,velocity:-sign*4}));
    assert.equal(run.reason,'boundary'); near(run.state.x,sign*50);
    assert.equal(Math.sign(run.state.v),sign); assert.ok(run.samples.every(s => Math.abs(s.x) <= 50 + 1e-9));
  }
});
test('zero coefficients, tiny velocities and stop exactly at observation end are well defined', () => {
  near(finish(make({muS:0,muK:0,velocity:4})).state.x,24);
  near(finish(make({velocity:1e-12})).state.v,0);
  const run = finish(make({velocity:4},{duration:4/2.943})); near(run.a,0); near(run.state.v,0);
});
test('invalid friction coefficients are rejected and quantitative feedback uses initial acceleration', () => {
  for (const overrides of [{muS:0.1,muK:0.3},{muK:-1},{muS:Infinity},{muS:1.1},{muK:NaN}]) assert.throws(() => make(overrides),RangeError);
  const run = finish(make({velocity:4})); const result = comparePrediction(run,-2.943,0);
  assert.equal(result.correctA,true); assert.equal(result.correctV,true);
});

test('F1 locks three specified trials, requires a saved prediction, and compares static and kinetic friction', () => {
  const session = new GuidedSession('F1');
  assert.equal(session.start(),false); assert.equal(session.nextRun(),false);
  assert.deepEqual(EXPERIMENTS.F1.runs.map(r => [r.mass,r.force,r.velocity,r.muS,r.muK,r.frictionEnabled]),[[2,3,0,0.4,0.3,true],[2,5,0,0.4,0.3,true],[2,10,0,0.4,0.3,true]]);
  session.savePrediction('B');
  for (let i=0;i<3;i++) {
    assert.equal(session.runIndex,i); session.start(); finish(session.run); session.completeRun();
    assert.equal(session.completed,i===2);
    assert.equal(session.nextRun(),i<2);
  }
  const rows = comparisonRows(session.results,3);
  near(rows[0].initialFriction,-3); near(rows[1].initialFriction,-5); near(rows[2].initialFriction,-5.886);
  near(rows[2].initialAcceleration,2.057); near(rows[2].finalVelocity,6.171); near(rows[2].position,9.2565);
  assert.equal(session.results.length,3); assert.equal(session.completeRun(),false);
});
test('F2/F3 presets and complete guided comparisons preserve equal stopping motion and unequal kinetic forces', () => {
  assert.deepEqual(EXPERIMENTS.F2.runs.map(r => [r.mass,r.force,r.velocity,r.muS,r.muK]),[[2,0,4,0.4,0.3]]);
  assert.deepEqual(EXPERIMENTS.F3.runs.map(r => [r.mass,r.force,r.velocity,r.muS,r.muK]),[[2,0,4,0.4,0.3],[4,0,4,0.4,0.3]]);
  for (const id of ['F1','F2','F3']) assert.equal(EXPERIMENTS[id].answer,'B');
  const session = new GuidedSession('F3'); session.savePrediction('B');
  session.start(); finish(session.run); session.completeRun(); session.nextRun(); session.start(); finish(session.run); session.completeRun();
  const [small,large] = comparisonRows(session.results,3);
  near(small.initialFriction,-5.886); near(large.initialFriction,-11.772);
  near(small.initialAcceleration,-2.943); near(large.initialAcceleration,-2.943);
  for (const row of [small,large]) { near(row.finalVelocity,0); near(row.finalFriction,0); near(row.acceleration,0); near(row.position,16/(2*2.943)); }
  assert.equal(session.completed,true);
});

test('friction segments remain consistent over the full classroom control range', () => {
  for (const mass of [1,2,10]) for (const force of [-20,-5,0,5,20]) for (const velocity of [-5,0,5]) for (const [muS,muK] of [[0,0],[0.4,0.3],[1,1]]) {
    const run = finish(make({mass,force,velocity,muS,muK}),0.23);
    assert.ok(run.samples.every(s => Number.isFinite(s.x) && Number.isFinite(s.v) && Math.abs(s.x)<=50+1e-8));
    near(run.a,forceBalance(run).a);
    near(run.state.x,sampleAt(run,run.state.t).x); near(run.state.v,sampleAt(run,run.state.t).v);
  }
});
