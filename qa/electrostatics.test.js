import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceForce,referenceField,referenceRod} from './electrostatics-reference.js';
import {pairForce,netForce,fieldAt,potentialAt,zeroForcePoint,rodForceExact,rodForceSlices} from '../js/core/electrostatics.js';
import {ACTIVITIES,text} from '../modules/electromagnetism/coulomb-activities.js';
import {chargingSteps} from '../modules/electromagnetism/electroscope.js';
const near=(actual,expected,tolerance=1e-9)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} expected ${expected}`);
for(const q1 of [-10,0,10])for(const q2 of [-3,0,3])for(const r of [.04,.2,1])test(`independent E1 pair ${q1}/${q2} microC at ${r} m`,()=>{
 const set=[{q:q1*1e-6,x:0,y:0},{q:q2*1e-6,x:r*.6,y:r*.8}];
 const actual=pairForce(...set),expected=referenceForce(set);
 for(const key of ['fx','fy','magnitude'])near(actual[key],expected[key]);
 const other=pairForce(set[1],set[0]);near(actual.fx,-other.fx);near(actual.fy,-other.fy);
});
test('independent E1 four-charge superposition, field and potential',()=>{
 const charges=[{q:2e-6,x:.3,y:.3},{q:3e-6,x:.5,y:.3},{q:-4e-6,x:.42,y:.48},{q:-2e-6,x:.66,y:.14}];
 let fx=0,fy=0;
 for(let i=0;i<charges.length;i++){
  const expected=referenceForce(charges,i),actual=netForce(charges,i);
  for(const key of ['fx','fy','magnitude'])near(actual[key],expected[key]);
  fx+=actual.fx;fy+=actual.fy;
 }
 near(fx,0);near(fy,0);
 const expected=referenceField(charges,.8,.5),actual=fieldAt(charges,.8,.5);
 near(actual.ex,expected.ex);near(actual.ey,expected.ey);near(potentialAt(charges,.8,.5),expected.potential);
});
test('independent E1 zero point and restoring force across balance',()=>{
 near(zeroForcePoint(1e-6,4e-6,.6),.2);
 near(zeroForcePoint(4e-6,-1e-6,.3),.6);
 assert.equal(zeroForcePoint(1e-6,-1e-6,.3),null);
 for(const x of [.399,.4,.401]){
  const set=[{q:1e-6,x:.2,y:.3},{q:4e-6,x:.8,y:.3},{q:1e-6,x,y:.3}];
  const f=netForce(set,2);near(f.fx,referenceForce(set,2).fx);
  if(x!==.4)assert.equal(Math.sign(f.fx),Math.sign(.4-x));else near(f.fx,0);
 }
 assert.throws(()=>pairForce({q:1,x:0,y:0},{q:1,x:0,y:0}),RangeError);
});
for(const d of [.01,.1,10])for(const L of [.1,.4,1])test(`independent E1 rod quadrature L=${L} d=${d}`,()=>{
 const p={Q:5e-6,q:2e-6,L,d},expected=referenceRod(p);
 near(rodForceExact(p),expected,5e-8);
 assert.ok(Math.abs(rodForceSlices(p,100)-expected)<Math.abs(rodForceSlices(p,5)-expected));
});
for(const id of ['C1','C2','C3'])test(`independent E1 ${id} numerical observation`,()=>{
 const a=ACTIVITIES[id],observed=text(a.observation);
 // Conditions are literal reference cases, not imported simulator presets.
 if(id==='C1'){
  const force=referenceForce([{q:2e-6,x:0,y:0},{q:3e-6,x:.2,y:0}]).magnitude;
  assert.ok(observed.includes(`${force.toFixed(2)} N`));
  assert.ok(observed.includes(`${(force/4).toFixed(2)} N`));
 }else if(id==='C2'){
  const force=referenceForce([{q:1e-6,x:0,y:0},{q:8e-6,x:.25,y:0}]).magnitude;
  assert.ok(observed.includes(force.toFixed(2)));
 }else{
  assert.ok(observed.includes('0.40 m'));assert.ok(observed.includes('0.20 m'));
 }
});
for(const sign of [-1,1])for(const method of ['friction','contact','induction'])test(`independent E1 charge accounting ${method}/${sign}`,()=>{
 const steps=chargingSteps(method,sign),total=method==='friction'?0:3*sign;
 for(const step of steps){
  const scopeCharge=step.scope?6-step.scope.knob-step.scope.left-step.scope.right:0;
  const other=step.other?.excess||0;
  assert.equal(step.rod.excess+scopeCharge+other,total);
  assert.equal(step.net.scope,scopeCharge);
 }
 const final=steps.at(-1).net;
 assert.equal(final.rod,method==='contact'?sign:3*sign);
 assert.equal(final.scope,method==='friction'?0:method==='contact'?2*sign:-2*sign);
 assert.equal(final.other,method==='friction'?-3*sign:method==='induction'?2*sign:0);
});
