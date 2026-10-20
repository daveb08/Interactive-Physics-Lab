import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {routes} from './manifest.js';
import {constant,pulse,stopping,linear,ode,G} from './reference.js';
import {createRun,sampleAt,stepRun,forceBalance} from '../js/core/physics.js';
import {createSpringRun,springState} from '../js/core/spring-physics.js';
import {createDragModel} from '../js/core/drag-physics.js';
import {createOscillatorModel} from '../js/core/oscillator-physics.js';
import {createCircularRun,sampleAt as circleAt,sampleGrid} from '../js/core/circular-physics.js';
import {PROBLEMS} from '../modules/newtons-laws/solve-problems.js';
const near=(a,b,tol=1e-8)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} expected ${b}, tolerance ${tol}`);
const compare=(s,r,tol)=>{for(const k of ['x','v','a'])near(s[k],r[k],tol);};
test('inventory includes every HTML route',()=>{
 const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${d}/${e.name}`):e.name.endsWith('.html')?[`/${d}/${e.name}`]:[]);
 assert.deepEqual(['/index.html',...walk('modules')].sort(),[...routes].sort());
});
for(const m of [1,2,10])for(const F of [-20,0,20])for(const v of [-5,0,5])test(`reference Newton m=${m} F=${F} v=${v}`,()=>{
 const run=createRun({mass:m,force:F,velocity:v});
 for(const t of [0,run.endTime/2,run.endTime])compare(sampleAt(run,t),constant(m,F,v,t));
 while(!run.done)stepRun(run);
 for(const s of run.samples)compare(s,constant(m,F,v,s.t));
 assert.ok(Math.abs(run.state.x)<=50+1e-8);
 if(run.reason==='boundary')near(Math.abs(run.state.x),50);
});
for(const F of [-4,0,4])test(`reference pulse ${F}`,()=>{
 const r=createRun({mass:2,force:F,velocity:-2,removeForceAt:2});
 for(const t of [0,2-1e-6,2,2+1e-6,6])compare(sampleAt(r,t),pulse(2,F,-2,2,t));
});
for(const v of [-6,6])test(`reference friction stop ${v}`,()=>{
 const r=createRun({mass:3,force:0,velocity:v,frictionEnabled:true,muS:.4,muK:.2});
 const end=Math.abs(v)/(.2*G);
 for(const t of [0,end-1e-6,end+1e-6,6])compare(sampleAt(r,t),stopping(v,.2,t));
 // At a discontinuity, floating-point event placement may select either side.
 near(sampleAt(r,end).x,stopping(v,.2,end).x);near(sampleAt(r,end).v,0);
});
test('reference static threshold and breakaway in both directions',()=>{
 for(const sign of [-1,1])for(const delta of [-1e-5,0,1e-5]){
  const F=sign*(.4*2*G+delta),r=createRun({mass:2,force:F,velocity:0,frictionEnabled:true,muS:.4,muK:.3});
  const f=forceBalance(r); near(f.normal,2*G); near(f.a,delta<=0?0:(F-sign*.3*2*G)/2);
 }
});
for(const massA of [1,2,10])for(const massB of [1,4,10])test(`reference spring conservation ${massA}/${massB}`,()=>{
 const k=20,d=2,r=createSpringRun({massA,massB,stiffness:k,compression:d});
 const mu=massA*massB/(massA+massB), release=Math.PI/2*Math.sqrt(mu/k);
 near(r.releaseTime,release);
 for(const t of [0,release/2,release,release+1]){
  const s=springState(r,t),compression=t<release?d*Math.cos(Math.sqrt(k/mu)*t):0;
  near(s.fA,-k*compression);near(s.fB,k*compression);
  near(massA*s.vA+massB*s.vB,0);near(.5*massA*s.vA**2+.5*massB*s.vB**2+.5*k*s.compression**2,.5*k*d*d);
  near(s.aA,s.fA/massA);near(s.aB,s.fB/massB);
 }
});
for(const law of ['linear','quadratic'])for(const F of [0,6,20])for(const v0 of [0,3,10])test(`reference drag ${law} F=${F} v=${v0}`,()=>{
 const r=createDragModel({law,mass:2,force:F,b:2,c:.5,v0});
 for(const t of [0,.25,Math.min(2,r.endTime)]){
  const expected=law==='linear'?linear(2,F,2,v0,t):ode((x,v)=>(F-.5*v*v)/2,0,v0,t);
  compare(r.at(t),expected,1e-7);assert.ok(r.at(t).v>=0);assert.ok(r.at(t).fDrag<=0);
 }
 if(r.reason==='boundary')near(r.at(r.endTime).x,50);
});
for(const b of [0,4,8-1e-6,8,8+1e-6,16])for(const v0 of [-3,0,3])test(`reference oscillator b=${b} v=${v0}`,()=>{
 const r=createOscillatorModel({mass:1,k:16,b,x0:-.5,v0});let previous=Infinity;
 for(const t of [0,.1,.5,2]){const s=r.at(t);compare(s,ode((x,v)=>-16*x-b*v,-.5,v0,t),1e-7);assert.ok(s.e<=previous+1e-7);previous=s.e;near(s.e+s.dissipated,2+.5*v0*v0);}
});
test('reference circular vectors, cut continuity, table boundary and graph endpoint',()=>{
 const r=createCircularRun({mass:.5,radius:1.5,speed:3},{cutAt:Math.PI});
 for(const t of [0,.2,Math.PI-1e-6]){const s=circleAt(r,t);near(s.x,1.5*Math.cos(2*t));near(s.y,1.5*Math.sin(2*t));near(s.vx,-3*Math.sin(2*t));near(s.vy,3*Math.cos(2*t));near(s.tension,3);near(s.x*s.vx+s.y*s.vy,0);}
 for(const t of [Math.PI,Math.PI+.2,r.endTime]){const s=circleAt(r,t);near(s.x,1.5);near(s.y,3*(t-Math.PI));near(s.tension,0);near(s.vy,3);}
 near(Math.hypot(circleAt(r,r.endTime).x,circleAt(r,r.endTime).y),3.2);
 near(sampleGrid(r).at(-1).t,r.endTime);
});
for(const [id,p] of Object.entries(PROBLEMS))test(`reference authored answers ${id}`,()=>{
 for(const block of p.blocks.filter(b=>b.correct&&b.answer)){
  const {key,t,value}=block.answer,s=p.setup;
  let expected;
  if(s.frictionEnabled&&s.force===0)expected=stopping(s.velocity,s.muK,t);
  else expected=constant(s.mass,s.force-(s.frictionEnabled?s.muK*s.mass*G:0),s.velocity,t);
  near(value,expected[key],.001); // instructional rounding, not engine precision
 }
});
