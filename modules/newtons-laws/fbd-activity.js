import { GRAVITY } from '../../js/core/physics.js';
export function cartForces(run,cart){
 if(!['A','B'].includes(cart))throw new RangeError('Choose Cart A or B.');
 const weight=run['mass'+cart]*GRAVITY;
 return {weight:-weight,normal:weight,spring:run.state['f'+cart],friction:0,contact:run.state.interacting};
}
export function checkForces(run,cart,selected){
 const forces=cartForces(run,cart),expected=['weight','normal',...(forces.contact?['spring']:[])];
 const choices=new Set(selected),correct=expected.every(k=>choices.has(k))&&[...choices].every(k=>expected.includes(k));
 const feedback=['Cart '+cart+' at t = '+run.state.t.toFixed(3)+' s ('+(forces.contact?'contact':'separated')+'): '+(correct?'Correct.':'Not yet.')];
 if(correct)feedback.push('Vertical forces balance. Each horizontal interaction force acts on a different cart.');
 else{
 if(!choices.has('weight')||!choices.has('normal'))feedback.push('Include weight downward and the balancing normal force upward.');
 if(forces.contact&&!choices.has('spring'))feedback.push('During contact, the spring pushes this cart outward.');
 if(!forces.contact&&choices.has('spring'))feedback.push('After separation the spring no longer pushes this cart.');
 if(choices.has('friction'))feedback.push('This track is frictionless.');
 if(choices.has('reaction'))feedback.push('The reaction force belongs on the other cart’s diagram.');
 }
 return {correct,expected,selected:[...choices],feedback:feedback.join(' '),time:run.state.t};
}
export function checkPair(choice){return {correct:choice==='other',feedback:choice==='other'?'Correct. The spring-mediated force exerted by Cart A on Cart B is equal in magnitude and opposite in direction to the force on A.':'The partner is the spring-mediated force exerted by Cart A on Cart B, not another force on Cart A.'};}
export class FbdLearningState{
 constructor(){this.reset();}
 reset(){this.revealed={A:false,B:false};this.answers={A:null,B:null};this.drafts={A:[],B:[]};}
 retry(cart){this.revealed[cart]=false;this.answers[cart]=null;this.drafts[cart]=[];}
 reveal(cart){this.revealed[cart]=true;}
 submit(run,cart,choices){const answer=checkForces(run,cart,choices);this.answers[cart]=answer;this.drafts[cart]=[...choices];if(answer.correct)this.reveal(cart);return answer;}
}
export class FbdActivity{
 constructor(pause){
  this.state=new FbdLearningState();this.pause=pause;this.$=id=>document.getElementById(id);
  this.$('fbd-cart').addEventListener('change',()=>{for(const input of this.$('force-choices').querySelectorAll('input'))input.checked=this.state.drafts[this.cart].includes(input.value);this.showFeedback();this.render(this.run);});
  this.$('force-choices').addEventListener('change',()=>{const choices=[...this.$('force-choices').querySelectorAll('input:checked')].map(input=>input.value);this.state.retry(this.cart);this.state.drafts[this.cart]=choices;this.showFeedback();this.render(this.run);});
  this.$('build-form').addEventListener('submit',e=>{e.preventDefault();this.pause();this.state.submit(this.run,this.cart,new FormData(e.currentTarget).getAll('force'));this.showFeedback();this.render(this.run);});
  this.$('fbd-reveal').addEventListener('click',()=>{this.pause();this.state.reveal(this.cart);this.$('fbd-feedback').textContent=`Correct diagram revealed for Cart ${this.cart}. It follows the simulation when resumed. Compare only forces acting on this object.`;this.render(this.run);});
  this.$('fbd-retry').addEventListener('click',()=>{this.state.retry(this.cart);this.$('build-form').reset();this.showFeedback();this.render(this.run);});
  this.$('pair-form').addEventListener('submit',e=>{e.preventDefault();const answer=checkPair(new FormData(e.currentTarget).get('pair'));this.$('pair-feedback').textContent=answer.feedback+' The forces act on different objects and cannot cancel in either cart’s individual force balance. Weight and normal force on one cart are not a Third Law pair. After separation both interaction forces are zero.';});
 }
 get cart(){return this.$('fbd-cart').value;}
 reset(){this.state.reset();this.$('build-form').reset();this.$('pair-form').reset();this.$('fbd-feedback').textContent='Select forces, then check your diagram. Checking pauses the simulation.';this.$('pair-feedback').textContent='';this.$('pair-followup').open=false;}
 showFeedback(){const a=this.state.answers[this.cart];this.$('fbd-feedback').textContent=a?a.feedback+' Checked state above; verified diagrams follow the simulation.':'Select forces, then check your diagram.';}
 render(run){
  this.run=run;
  this.$('fbd-state').textContent='Simulation now: '+(run.state.interacting?'spring contact':'separated')+' · t = '+run.state.t.toFixed(3)+' s. Checking pauses and evaluates this state.';
  const answer=this.state.answers[this.cart];
  this.$('fbd-retry').hidden=!answer&&!this.state.revealed[this.cart];
  this.$('fbd-reveal').hidden=!answer||this.state.revealed[this.cart];
  this.$('fbd-target-note').textContent='Your proposal for Cart '+this.cart;
  this.$('pair-followup').hidden=!this.state.revealed.A||!this.state.revealed.B;
  this.$('fbd-model-note').hidden=!Object.values(this.state.revealed).some(Boolean);
  for(const cart of ['A','B'])this.$('fbd-'+cart.toLowerCase()).classList.toggle('selected-cart',cart===this.cart);
 }
}