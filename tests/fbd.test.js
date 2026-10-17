import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpringRun,stepSpringRun} from '../js/core/spring-physics.js';
import {cartForces,checkForces,checkPair,FbdLearningState} from '../modules/newtons-laws/fbd-activity.js';
import {SpringView} from '../js/components/spring-view.js';
const correct=['weight','normal','spring'];
test('Cart A and B accept only forces acting on that cart during contact',()=>{
 const run=createSpringRun({massB:4});for(const cart of ['A','B']){assert.equal(checkForces(run,cart,correct).correct,true);assert.equal(checkForces(run,cart,[...correct,'reaction']).correct,false);assert.equal(checkForces(run,cart,['weight']).correct,false);}
});
test('FBD magnitudes have vertical balance, opposite horizontal forces, and no friction',()=>{
 const run=createSpringRun({massA:2,massB:4});stepSpringRun(run,.3);const a=cartForces(run,'A'),b=cartForces(run,'B');assert.equal(a.normal+a.weight,0);assert.equal(b.normal+b.weight,0);assert.equal(a.spring,-b.spring);assert.equal(a.normal,19.62);assert.equal(b.normal,39.24);assert.equal(a.friction,0);assert.equal(checkForces(run,'A',[...correct,'friction']).correct,false);
});
test('after separation only normal force and weight belong in either FBD',()=>{
 const run=createSpringRun();stepSpringRun(run,run.releaseTime);for(const cart of ['A','B']){assert.equal(Math.abs(cartForces(run,cart).spring),0);assert.equal(checkForces(run,cart,['normal','weight']).correct,true);assert.equal(checkForces(run,cart,correct).correct,false);}
});
test('pair activity distinguishes other-cart reaction from same-cart forces',()=>{
 assert.equal(checkPair('other').correct,true);for(const choice of ['normal','weight','cancel',null])assert.equal(checkPair(choice).correct,false);
});
test('answers reveal chosen cart only; retry and reset restore hidden state',()=>{
 const state=new FbdLearningState(),run=createSpringRun();assert.deepEqual(state.revealed,{A:false,B:false});state.submit(run,'A',correct);assert.deepEqual(state.revealed,{A:true,B:false});state.reveal('B');state.retry('A');assert.deepEqual(state.revealed,{A:false,B:true});state.reset();assert.deepEqual(state.revealed,{A:false,B:false});assert.deepEqual(state.answers,{A:null,B:null});
});
test('grading does not advance paused physics and feedback retains its submission state',()=>{
 const run=createSpringRun(),state=new FbdLearningState();stepSpringRun(run,.2);const snapshot=structuredClone(run.state);const answer=state.submit(run,'B',correct);assert.deepEqual(run.state,snapshot);assert.equal(answer.time,.2);stepSpringRun(run,6);assert.equal(state.answers.B.time,.2);assert.equal(state.answers.B.correct,true);assert.equal(checkForces(run,'B',correct).correct,false);
});
const svg=()=>({innerHTML:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;}});
test('diagram renderer hides all solution arrows until reveal and removes spring arrow after separation',()=>{
 const scene=svg(),a=svg(),b=svg(),view=new SpringView(scene,a,b),run=createSpringRun();view.render(run,true);assert.match(a.attrs['aria-label'],/hidden/);assert.doesNotMatch(a.innerHTML,/<path/);view.render(run,false,{A:true,B:false});assert.match(a.innerHTML,/B on A/);assert.match(a.innerHTML,/M177 114h-75/);assert.doesNotMatch(b.innerHTML,/<path/);stepSpringRun(run,6);view.render(run,true,{A:true,B:true});assert.doesNotMatch(a.innerHTML,/M177 114h/);assert.doesNotMatch(b.innerHTML,/M223 114h/);assert.match(a.innerHTML,/mg = 19.62/);assert.match(b.innerHTML,/N = 19.62/);
});
test('simulation reset restores contact while a new learning state hides diagrams',()=>{
 const state=new FbdLearningState();let run=createSpringRun();state.reveal('A');stepSpringRun(run,6);assert.equal(run.state.interacting,false);run=createSpringRun();state.reset();assert.equal(run.state.interacting,true);assert.equal(run.state.t,0);assert.equal(state.revealed.A,false);assert.equal(checkForces(run,'A',correct).correct,true);
});



test('incorrect proposals remain hidden until explicit reveal; drafts and retries stay per cart',()=>{
 const state=new FbdLearningState(),run=createSpringRun();
 state.submit(run,'A',['friction']);
 assert.equal(state.revealed.A,false);
 assert.deepEqual(state.drafts.A,['friction']);
 state.submit(run,'B',correct);
 assert.equal(state.revealed.B,true);
 state.reveal('A');assert.equal(state.revealed.A,true);
 state.retry('A');
 assert.deepEqual(state.drafts.A,[]);
 assert.deepEqual(state.drafts.B,correct);
 state.reset();assert.deepEqual(state.drafts,{A:[],B:[]});
});

test('UI disclosure follows selected cart, reveal state, and simulation reset',async()=>{
 const {FbdActivity}=await import('../modules/newtons-laws/fbd-activity.js');
 const elements=new Map();
 const activity=Object.create(FbdActivity.prototype);
 activity.state=new FbdLearningState();
 activity.$=id=>{if(!elements.has(id))elements.set(id,{value:'A',hidden:false,textContent:'',classList:{toggle(){}}});return elements.get(id);};
 const run=createSpringRun();
 activity.render(run);
 assert.equal(activity.$('fbd-reveal').hidden,true);
 assert.equal(activity.$('fbd-retry').hidden,true);
 assert.equal(activity.$('pair-followup').hidden,true);
 activity.state.submit(run,'A',[]);activity.render(run);
 assert.equal(activity.$('fbd-reveal').hidden,false);
 assert.equal(activity.$('fbd-retry').hidden,false);
 activity.state.reveal('A');activity.render(run);
 assert.equal(activity.$('fbd-reveal').hidden,true);
 activity.$('fbd-cart').value='B';activity.render(run);
 assert.equal(activity.$('fbd-retry').hidden,true);
 activity.state.submit(run,'B',correct);activity.render(run);
 assert.equal(activity.$('pair-followup').hidden,false);
 stepSpringRun(run,6);activity.render(run);
 assert.match(activity.$('fbd-state').textContent,/separated.*6.000/);
 assert.equal(activity.state.answers.B.time,0);
 activity.state.reset();activity.render(createSpringRun());
 assert.equal(activity.$('pair-followup').hidden,true);
 assert.match(activity.$('fbd-state').textContent,/contact.*0.000/);
});
