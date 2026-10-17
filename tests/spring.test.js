import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpringRun,springState,stepSpringRun,SPRING_DEFAULTS,CART_WIDTH,SPRING_LENGTH} from '../js/core/spring-physics.js';
import {ThirdLawSession,THIRD_EXPERIMENTS} from '../modules/newtons-laws/third-law-activities.js';
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const finish=(r,dt)=>{while(!r.done)stepSpringRun(r,dt);return r;};
test('spring forces are equal/opposite with equal-mass acceleration symmetry',()=>{
 const r=finish(createSpringRun(),1/120);
 for(const s of r.samples){near(s.fA,-s.fB);near(s.aA,-s.aB);near(s.vA,-s.vB);near(s.xA,-s.xB);}
 near(r.samples[0].fA,-2);near(r.samples[0].aA,-1);
});
test('unequal masses have equal forces and inverse-mass accelerations',()=>{
 const r=createSpringRun({massA:2,massB:4});for(const t of [0,.1,.5]){const s=springState(r,t);near(s.fA,-s.fB);near(s.aA,-2*s.aB);near(s.vA,-2*s.vB);}
});
test('exact harmonic release has analytical timing, continuity, and no attraction',()=>{
 const r=createSpringRun();near(r.releaseTime,Math.PI/(2*Math.sqrt(2)));
 const before=springState(r,r.releaseTime-1e-10),at=springState(r,r.releaseTime),after=springState(r,r.releaseTime+1e-10);
 near(at.compression,0);assert.equal(at.interacting,false);near(at.fA,0);near(at.fB,0);
 near(at.vA,-Math.SQRT1_2);near(at.vB,Math.SQRT1_2);near(at.xB-at.xA,CART_WIDTH+SPRING_LENGTH);
 for(const key of ['xA','xB','vA','vB']){near(before[key],at[key],1e-8);near(after[key],at[key],1e-8);}
 const end=springState(r,6);near(end.fA,0);near(end.aA,0);near(end.vA,at.vA);near(end.xA,at.xA+at.vA*(6-r.releaseTime));
});
test('momentum and energy are conserved and carts never overlap over supported parameter grid',()=>{
 for(const massA of [1,2,10])for(const massB of [1,4,10])for(const stiffness of [1,2,20])for(const compression of [.2,1,2]){
 const r=createSpringRun({massA,massB,stiffness,compression}),energy=.5*stiffness*compression**2;
 for(let i=0;i<=60;i++) {const s=springState(r,r.endTime*i/60);near(s.momentum,0);near(s.energy,energy);near(s.fA,-s.fB);assert.ok(s.xB-s.xA>=CART_WIDTH);assert.ok(s.fA<=0&&s.fB>=0);assert.ok(s.xA-CART_WIDTH/2>=-50-1e-9&&s.xB+CART_WIDTH/2<=50+1e-9);}
 }
});
test('graph histories include exact separation and are independent of step size',()=>{
 for(const dt of [1/120,.7,6]){const r=finish(createSpringRun({massB:4}),dt);assert.ok(r.samples.some(s=>s.t===r.releaseTime));for(const s of r.samples){const actual=springState(r,s.t);near(s.fA,actual.fA);near(s.fB,actual.fB);near(s.aA,actual.aA);near(s.aB,actual.aB);}near(r.state.xA,springState(r,6).xA);}
});
test('outer-edge boundary events retain incident velocities for either cart',()=>{
 for(const [massA,massB] of [[1,10],[10,1]]){const r=finish(createSpringRun({massA,massB,stiffness:20,compression:2},{duration:30}),.73);assert.equal(r.reason,'boundary');near(Math.max(Math.abs(r.state.xA),Math.abs(r.state.xB))+.5,50);assert.ok(r.state.vA<0&&r.state.vB>0);const last=r.state;assert.equal(stepSpringRun(r),last);}
});
test('guided presets, predictions, and free settings are isolated',()=>{
 for(const id of ['T1','T2','T3']){const s=new ThirdLawSession('guided',id);assert.equal(s.start(),false);assert.equal(s.savePrediction('Z'),false);assert.ok(s.savePrediction(THIRD_EXPERIMENTS[id].answer));assert.ok(s.start());assert.equal(s.savePrediction('A'),false);near(s.run.state.vA,0);near(s.run.state.vB,0);}
 const free=new ThirdLawSession('free','T2',{massA:8,massB:3,stiffness:5,compression:2});assert.ok(free.start());near(free.run.massA,8);near(new ThirdLawSession('guided','T2').run.massA,2);near(new ThirdLawSession('guided','T2').run.massB,4);assert.deepEqual(SPRING_DEFAULTS,{massA:2,massB:2,stiffness:2,compression:1});
});
test('spring inputs and time steps validate and short observations remain compressed',()=>{
 for(const settings of [{massA:0},{massB:11},{stiffness:Infinity},{compression:-1},{compression:3}])assert.throws(()=>createSpringRun(settings),RangeError);
 const r=createSpringRun({}, {duration:.1});assert.equal(r.events.length,0);finish(r,6);assert.ok(r.state.interacting);near(r.state.t,.1);assert.throws(()=>stepSpringRun(r,0),RangeError);assert.throws(()=>springState(r,-1),RangeError);
});
