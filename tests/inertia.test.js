import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, sampleAt, forceBalance } from '../js/core/physics.js';
import { GuidedSession } from '../modules/newtons-laws/guided-experiments.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
test('I1/I2 preserve stationary and constant-velocity motion without friction',()=>{
  for(const [id,v,x] of [['I1',0,0],['I2',3,18]]) {
    const s=new GuidedSession(id); assert.equal(s.run.frictionEnabled,false); assert.equal(s.start(),false);
    assert.equal(s.experiment.answer,'B'); s.savePrediction('B'); assert.equal(s.start(),true);
    stepRun(s.run,6); near(s.run.state.x,x); near(s.run.state.v,v); near(s.run.a,0); assert.ok(s.completeRun());
  }
});
test('I3 removes force exactly at 2 seconds with continuous position and velocity',()=>{
 const r=new GuidedSession('I3').run;
 near(sampleAt(r,2).x,4); near(sampleAt(r,2).v,4); near(sampleAt(r,2).a,0);
 near(sampleAt(r,2-1e-9).x,4); near(sampleAt(r,2-1e-9).v,4); near(sampleAt(r,2-1e-9).a,2);
 near(forceBalance(r,{t:2-1e-9,v:4}).netForce,4); near(forceBalance(r,{t:2,v:4}).netForce,0);
 near(sampleAt(r,3).x,8); near(sampleAt(r,3).v,4); near(sampleAt(r,6).x,20);
 assert.equal(r.endTime,6); assert.equal(r.reason,'duration');
});
test('I3 graph samples show an exact acceleration jump for small and large steps',()=>{
 for(const dt of [1/120,.7,2,6]) {
  const r=new GuidedSession('I3').run; while(!r.done) stepRun(r,dt);
  const jump=r.samples.filter(s=>s.t===2); assert.deepEqual(jump.map(s=>s.a),[2,0]);
  jump.forEach(s=>{near(s.x,4);near(s.v,4);});
  for(const s of r.samples) {near(s.x,s.t<=2?s.t*s.t:4+4*(s.t-2));near(s.v,s.t<=2?2*s.t:4);}
  near(r.state.x,20);near(r.state.v,4);near(r.a,0);assert.equal(r.events[0].label,'Force removed');
 }
});
test('scheduled force removal respects boundaries and short observations',()=>{
 const short=createRun({mass:2,force:4,velocity:0,removeForceAt:2},{duration:1});stepRun(short,6);near(short.state.x,1);near(short.a,2);assert.equal(short.events.length,0);
 const exact=createRun({mass:2,force:4,velocity:0,removeForceAt:2},{duration:2});stepRun(exact,6);near(exact.a,0);near(exact.state.v,4);
 for(const force of [-20,20]) {const r=createRun({mass:1,force,velocity:0,removeForceAt:4}); stepRun(r,6); near(Math.abs(r.state.x),50);assert.equal(r.reason,'boundary');assert.equal(r.events.length,0);}
 const coast=createRun({mass:2,force:4,velocity:0,removeForceAt:2},{duration:20});stepRun(coast,20);near(coast.state.x,50);near(coast.state.t,13.5);
 assert.throws(()=>createRun({mass:2,force:4,velocity:0,removeForceAt:0}),RangeError);
});
