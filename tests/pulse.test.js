import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,stepRun,sampleAt,forceBalance} from '../js/core/physics.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const finish=(r,dt=6)=>{while(!r.done)stepRun(r,dt);return r;};
test('zero pulses preserve signed velocities for every pulse duration and varied mass',()=>{
 for(const mass of [1,2,10]) for(const velocity of [-5,0,3,5]) for(const removeForceAt of [.5,2,5]) {
 const r=finish(createRun({mass,velocity,force:0,removeForceAt})); near(r.state.v,velocity);near(r.state.x,6*velocity);near(r.a,0);
 }
});
test('positive and negative pulses use exact analytical timing and mass dependence',()=>{
 for(const mass of [1,2,10]) for(const force of [-4,4]) for(const velocity of [-3,0,3]) {
 const t=.7,a=force/mass,r=createRun({mass,force,velocity,removeForceAt:t});
 const event=r.events.find(e=>e.label==='Force removed');near(event.t,t);near(event.before.v,event.after.v);near(event.before.x,event.after.x);
 finish(r,.31);near(r.state.v,velocity+a*t);near(r.state.x,velocity*t+.5*a*t*t+(velocity+a*t)*(6-t));near(r.a,0);
 }
});
test('negative pulse can reverse motion then coast without reversing again',()=>{
 const r=finish(createRun({mass:2,force:-4,velocity:3,removeForceAt:2}));near(sampleAt(r,1.5).v,0);near(sampleAt(r,2).v,-1);near(r.state.v,-1);near(r.state.x,-2);
});
test('friction continues after pulse removal and stops without artificial reversal',()=>{
 for(const sign of [-1,1]) for(const dt of [1/120,.7,6]) {
 const r=createRun({mass:2,force:sign*10,velocity:0,removeForceAt:1,frictionEnabled:true});
 const removal=sampleAt(r,1);near(removal.v,sign*2.057);near(removal.a,-sign*2.943);
 finish(r,dt);near(r.state.v,0);near(r.a,0);near(r.state.x,sign*(1.0285+2.057**2/(2*2.943)));
 const event=r.events.find(e=>e.label==='Force removed');near(event.before.v,event.after.v);near(event.before.x,event.after.x);
 near(forceBalance(r).netForce,0);
 }
});
test('static friction releases its balancing force when a subthreshold pulse ends',()=>{
 const r=finish(createRun({mass:2,force:3,velocity:0,removeForceAt:2,frictionEnabled:true}));near(r.state.x,0);near(sampleAt(r,1).friction,-3);near(sampleAt(r,2).friction,0);
});
test('simultaneous stop and pulse removal leaves the cart at rest',()=>{
 const r=finish(createRun({mass:2,force:-4,velocity:4.943,removeForceAt:1,frictionEnabled:true}));near(sampleAt(r,1).v,0);near(r.state.v,0);near(r.state.x,4.943/2);near(r.a,0);
});
test('track boundaries before and after pulse removal retain incident velocity',()=>{
 for(const sign of [-1,1]) {
 const before=finish(createRun({mass:1,force:20*sign,velocity:0,removeForceAt:5}));near(before.state.x,sign*50);assert.equal(before.reason,'boundary');assert.equal(before.events.length,0);
 const after=finish(createRun({mass:1,force:20*sign,velocity:0,removeForceAt:1}));near(after.state.x,sign*50);near(after.state.t,3);near(after.state.v,sign*20);assert.equal(after.reason,'boundary');
 }
});
test('friction pulse grid has continuous segments and step-independent final states',()=>{
 for(const force of [-20,0,20])for(const velocity of [-5,0,5])for(const mass of [1,2,10])for(const removeForceAt of [.5,2,5]){
 const config={mass,force,velocity,removeForceAt,frictionEnabled:true};const a=finish(createRun(config),.19),b=finish(createRun(config),6);
 near(a.state.x,b.state.x);near(a.state.v,b.state.v);assert.ok(Math.abs(a.state.x)<=50+1e-8);
 for(const event of a.events.filter(e=>e.before)){near(event.before.x,event.after.x);near(event.before.v,event.after.v);}
 for(const s of a.samples)assert.ok([s.t,s.x,s.v,s.a].every(Number.isFinite));
 }
});
