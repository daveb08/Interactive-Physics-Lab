import { SimulationClock } from '../../js/core/clock.js';
import { MotionGraph } from '../../js/components/graph.js';
import { SpringView } from '../../js/components/spring-view.js';
import { SPRING_DEFAULTS, stepSpringRun, springState } from '../../js/core/spring-physics.js';
import { ThirdLawSession } from './third-law-activities.js';
const $=id=>document.getElementById(id);
const units={massA:'kg',massB:'kg',stiffness:'N/m',compression:'m'};
let mode='guided',freeSettings={...SPRING_DEFAULTS},session;
const view=new SpringView($('two-carts'),$('fbd-a'),$('fbd-b'));
const graphs=[new MotionGraph($('force-graph'),'value','Force','N','#3c6cb2'),new MotionGraph($('accel-graph'),'value','Acceleration','m/s²','#3c6cb2')];
const clock=new SimulationClock(()=>{
 stepSpringRun(session.run);
 if(session.run.done){clock.pause();$('status').textContent='Complete';$('message').textContent=session.run.reason==='boundary'?'Track limit reached: a cart’s outer edge is at ±50 m. Both carts stop being observed; their incident velocities are retained. No collision is simulated.':'6 seconds observed. The displayed state is the final measurement.';showResults();}
},render);
function render(){
 const r=session.run,s=r.state,reveal=mode==='free'||session.started;
 $('view-note').textContent=`View: ±${view.render(r,reveal).toFixed(1)} m. Physical boundaries remain ±50 m; carts are drawn 1 m wide.`;
 $('time').textContent=`${s.t.toFixed(3)} s`;
 $('contact').textContent=s.interacting?'Interacting · spring compressed':'Separated · interaction ended';
 $('force-equality').textContent=reveal?`F on A = ${s.fA.toFixed(3)} N; F on B = ${s.fB.toFixed(3)} N. Sum = ${(s.fA+s.fB).toFixed(3)} N.`:'Observe the interaction force on each cart after starting.';
 $('measurements').innerHTML=[['Position (m)','x'],['Velocity (m/s)','v'],['Force (N)','f'],['Acceleration (m/s²)','a']].map(([label,key])=>`<tr><th scope="row">${label}</th>${['A','B'].map(cart=>`<td>${reveal||['x','v'].includes(key)?s[key+cart].toFixed(3):'—'}</td>`).join('')}</tr>`).join('');
 $('momentum').textContent=reveal?`Total horizontal momentum: ${s.momentum.toFixed(6)} kg·m/s (initially zero).`:'Both carts start at rest. The system has no external horizontal force.';
 const events=r.events.filter(e=>e.t<=s.t);
 graphs.forEach((graph,i)=>{graph.svg.hidden=!reveal;graph.svg.style.display=reveal?'':'none';const key=i?'a':'f';graph.render(r.samples.map(s=>({t:s.t,value:s[key+'B']})),r.endTime,{references:[r.samples.map(s=>({t:s.t,value:s[key+'A']}))],seriesLabels:['Cart A','Cart B'],events});});
 $('graph-note').textContent=reveal?'Cart A solid blue; Cart B dashed orange. Both series use the same axes. Separation is marked when it occurs.':'Graphs appear when the experiment starts.';
 $('start').disabled=clock.running||r.done||(mode==='guided'&&!session.prediction);
 $('start').textContent=r.done?'Experiment complete':session.started?'▶ Resume':'▶ Start experiment';
 $('pause').disabled=!clock.running;
}
function reset(){
 clock.reset();session=new ThirdLawSession(mode,$('activity-select').value,freeSettings);
 const e=session.experiment,r=session.run;
 for(const [key,unit] of Object.entries(units)){$(key).value=r[key];$(key+'-value').value=`${r[key]} ${unit}`;}
 $('settings').disabled=mode==='guided';$('defaults').hidden=mode!=='free';$('guided-panel').hidden=mode!=='guided';
 $('settings-note').textContent=mode==='guided'?'Guided conditions are locked. Switch to Free Exploration to adjust the spring and masses.':'Both carts start at rest. Reset to edit parameters; forces are always linked by the same spring.';
 $('activity-title').textContent=e.title;$('objective').textContent=e.objective;
 $('conditions').textContent=`Cart A ${r.massA} kg · Cart B ${r.massB} kg · stiffness ${r.stiffness} N/m · initial compression ${r.compression} m · both at rest · no friction.`;
 $('question').textContent=e.question;$('choices').replaceChildren();
 e.options.forEach((text,i)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='prediction';input.value='ABCD'[i];input.required=true;label.append(input,document.createTextNode(`${input.value}. ${text}`));$('choices').append(label);});
 $('prediction-fields').disabled=false;$('save-prediction').disabled=false;
 $('prediction-status').textContent='Save a prediction before starting.';
 $('results').hidden=true;$('reflection').hidden=true;$('reflection-form').reset();$('model-answer').hidden=true;$('explanation').setCustomValidity('');
 $('status').textContent='Ready';$('message').textContent=mode==='guided'?'Save your prediction, then release the spring.':'Adjust the controls, then release the spring. Compare force and acceleration on the two carts.';render();
}
function showResults(){
 const e=session.experiment,r=session.run,release=springState(r,r.releaseTime);
 const sections=mode==='guided'?[['Observation',e.observation],['Physics explanation',e.explanation],['Your prediction',session.prediction===e.answer?'Your prediction matches the observation.':'Compare your prediction with the separate diagrams and explanation. Equal force magnitudes do not imply equal accelerations; forces in the pair act on different objects.']]:[['Observation',`Initial interaction force magnitudes were ${(r.stiffness*r.compression).toFixed(3)} N. Separation occurred at ${r.releaseTime.toFixed(3)} s. Velocities at separation: A ${release.vA.toFixed(3)} m/s, B ${release.vB.toFixed(3)} m/s.`],['Physics explanation','The forces share one magnitude kδ and have opposite signs. Acceleration is force divided by each cart’s mass. At zero compression the interaction ends; there is no attractive force and both carts coast.']];
 sections.push(['Key takeaway','Equal and opposite interaction forces act on different objects. Different masses can have different accelerations.']);
 $('results').replaceChildren();for(const [heading,text] of sections){const section=document.createElement('section'),h=document.createElement('h3'),p=document.createElement('p');h.textContent=heading;p.textContent=text;section.append(h,p);$('results').append(section);}$('results').hidden=false;
 if(mode==='guided'){$('reflection-question').textContent=e.reflection;$('reflection').hidden=false;}
}
$('prediction-form').addEventListener('submit',event=>{event.preventDefault();if(session.savePrediction(new FormData(event.currentTarget).get('prediction'))){$('prediction-status').textContent='Prediction saved. Release the spring to test it.';render();}});
$('choices').addEventListener('change',()=>{if(!session.started){session.prediction=null;$('prediction-status').textContent='Save your updated prediction before starting.';render();}});
$('start').addEventListener('click',()=>{if(!session.start())return;$('settings').disabled=true;$('prediction-fields').disabled=true;$('save-prediction').disabled=true;$('status').textContent='Running';$('message').textContent='Observe both carts and compare their force and acceleration graphs. Pause to inspect the interaction.';clock.start();render();});
$('pause').addEventListener('click',()=>{clock.pause();$('status').textContent='Paused';$('message').textContent='Paused at the displayed simulation time. Resume to continue.';render();});
$('reset').addEventListener('click',reset);$('activity-select').addEventListener('change',reset);
for(const key of Object.keys(units))$(key).addEventListener('input',()=>{freeSettings[key]=+$(key).value;reset();});
$('defaults').addEventListener('click',()=>{freeSettings={...SPRING_DEFAULTS};reset();});
for(const next of ['free','guided'])$(next+'-mode').addEventListener('click',()=>{if(mode===next)return;mode=next;for(const value of ['free','guided'])$(value+'-mode').setAttribute('aria-pressed',String(mode===value));reset();});
$('reflection-form').addEventListener('submit',event=>{event.preventDefault();if(!session.run.done)return;if(!$('explanation').value.trim()){$('explanation').setCustomValidity('Write a brief explanation.');$('explanation').reportValidity();return;}$('model-answer').textContent='Instructor-authored model answer: '+session.experiment.model;$('model-answer').hidden=false;});
$('explanation').addEventListener('input',()=>$('explanation').setCustomValidity(''));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&clock.running)$('pause').click();});
reset();
