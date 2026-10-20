import {test,expect,frozen,advance,evidence,guided,reflection,layout} from './helpers.js';
import {referenceForce,referenceRod} from '../electrostatics-reference.js';
const route='/modules/electromagnetism/coulomb.html';
const number=text=>Number(text.replaceAll('−','-').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i)?.[0]);
async function measurement(page,id,expected,unit='N'){
 const output=page.locator(`#${id}`),actual=number(await output.innerText());
 expect(Number.isFinite(actual)).toBe(true);
 expect(Math.abs(actual-expected)).toBeLessThanOrEqual(.0051*Math.max(1,Math.abs(expected)));
 if(['r-F','r-Fx','r-Fy'].includes(id))await expect(output.locator('..').locator('small')).toHaveText(unit);
}
test('E1 free controls, independent readouts, graph and vector toggles',async({page},info)=>{
 await frozen(page,route);
 const initial=referenceForce([{q:2e-6,x:.3,y:.3},{q:3e-6,x:.5,y:.3}]);
 await measurement(page,'r-F',initial.magnitude);await measurement(page,'r-Fx',initial.fx);
 await expect(page.locator('#plot')).toContainText('1.35 N');
 const graph=await page.locator('#plot').innerHTML();
 await page.getByRole('button',{name:'×2 r',exact:true}).click();
 await measurement(page,'r-F',initial.magnitude/4);
 expect(await page.locator('#plot').innerHTML()).not.toBe(graph);
 await expect(page.locator('#change-note')).toContainText('×0.25');
 await page.getByRole('button',{name:'×2 q',exact:true}).click();
 await measurement(page,'r-F',initial.magnitude/2);
 await page.getByRole('button',{name:'± flip sign',exact:true}).click();
 await measurement(page,'r-Fx',initial.magnitude/2);
 await page.getByRole('button',{name:'Defaults',exact:true}).click();
 for(const count of ['3','4']){
  await page.getByRole('group',{name:'How many charges'}).getByRole('button',{name:count,exact:true}).click();
  await expect(page.locator('#force-rows tr')).toHaveCount(Number(count));
 }
 const four=[{q:2e-6,x:.3,y:.3},{q:3e-6,x:.5,y:.3},{q:-4e-6,x:.42,y:.48},{q:-2e-6,x:.66,y:.14}];
 const net=referenceForce(four);
 await measurement(page,'r-F',net.magnitude);await measurement(page,'r-Fx',net.fx);await measurement(page,'r-Fy',net.fy);
 await page.locator('#show-parts').uncheck();await expect(page.locator('.fv-arrow.fv-part')).toHaveCount(0);
 await page.locator('#show-net').uncheck();await expect(page.locator('.fv-arrow.fv-net')).toHaveCount(0);
 await page.locator('#show-comp').check();expect(await page.locator('.fv-arrow.fv-comp').count()).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Rescale arrows',exact:true}).click();
 await evidence(page,info,'E1-four-charges');
 expect((await layout(page)).overflow).toBe(false);
 await page.getByRole('button',{name:'Defaults',exact:true}).click();
 await measurement(page,'r-F',initial.magnitude);await expect(page.locator('#force-rows tr')).toHaveCount(2);
});
test('E1 signed charge limits, zero crossing and minimum separation',async({page})=>{
 await frozen(page,route);
 const slider=page.getByRole('slider',{name:/^Charge/});
 for(const [key,value] of [['Home',-10],['End',10]]){
  await slider.press(key);expect(Number(await slider.inputValue())).toBe(value);
  const f=referenceForce([{q:value*1e-6,x:.3,y:.3},{q:3e-6,x:.5,y:.3}]);
  await measurement(page,'r-Fx',f.fx);
 }
 // The UI intentionally crosses zero to the opposite ±0.5 μC setting.
 await slider.press('Home');for(let i=0;i<20;i++)await slider.press('ArrowRight');
 expect(Math.abs(Number(await slider.inputValue()))).toBe(.5);
 await expect(page.getByRole('button',{name:'×½ q',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Defaults',exact:true}).click();
 const q2=page.getByRole('button',{name:/^Charge q2,/});
 for(let i=0;i<30;i++)await q2.press('ArrowLeft');
 await expect(page.locator('#r12-value')).toHaveText('0.04 m');
 expect(await page.locator('body').innerText()).not.toMatch(/\bNaN\b|\bInfinity\b|undefined/);
});
test('E1 keyboard and pointer movement keep forces consistent',async({page},info)=>{
 await frozen(page,route);
 const q2=page.getByRole('button',{name:/^Charge q2,/});
 await q2.press('ArrowUp');await expect(q2).toHaveAttribute('aria-label',/y 0.31 metres/);
 const expected=referenceForce([{q:2e-6,x:.3,y:.3},{q:3e-6,x:.5,y:.31}],1);
 await measurement(page,'r-Fx',expected.fx);await measurement(page,'r-Fy',expected.fy);
 await q2.scrollIntoViewIfNeeded();
 if(info.project.name==='ipad-touch'){
  await q2.tap();await expect(page.locator('#r-name')).toContainText('q₂');
 }else{
  const body=q2.locator('.fv-body'),box=await body.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+25,box.y+box.height/2-15,{steps:5});await page.mouse.up();
  await expect(q2).not.toHaveAttribute('aria-label',/x 0.50 metres, y 0.31 metres/);
 }
 await evidence(page,info,'E1-moved');
});
for(const id of ['C1','C2','C3'])for(const correct of [false,true])test(`E1 guided ${id} ${correct?'correct':'incorrect'} prediction, graph, reflection and reset`,async({page},info)=>{
 await frozen(page,route);await guided(page,{},id,correct?1:0);
 const graph=await page.locator('#plot').innerHTML();
 await page.locator('#start').click();await advance(page,160);await expect(page.locator('#run-status')).toHaveText('Running');
 await advance(page,4500);await expect(page.locator('#run-status')).toHaveText('Finished');
 await expect(page.locator('#guided-verdict')).toContainText(correct?'matches the experiment':'You predicted A');
 await expect(page.locator('#guided-verdict')).toHaveClass(correct?/^feedback$/:/vf-verdict-wrong/);
 const expected=id==='C1'?1.3482/4:id==='C2'?1.150464:0;
 await measurement(page,'r-F',expected);
 expect(await page.locator('#plot').innerHTML()).not.toBe(graph);
 await reflection(page,{id:'e1'});await evidence(page,info,`E1-${id}-completed`);
 if(id==='C3'){
  const q3=page.getByRole('button',{name:/^Charge q3,/});
  await q3.press('ArrowRight');expect(number(await page.locator('#r-Fx').innerText())).toBeLessThan(0);
 }
 await page.locator('#reset').click();await expect(page.locator('#start')).toBeDisabled();
 await expect(page.locator('#guided-results')).toBeHidden();
 await page.getByRole('button',{name:'Free Exploration',exact:true}).click();
 await expect(page.locator('#run-status')).toHaveText('Live');
});
test('E1 charged rod integral, numerical convergence, controls and units',async({page},info)=>{
 await frozen(page,route);await page.locator('#math-on').check();
 const expected=referenceRod({Q:5e-6,L:.4,q:2e-6,d:.1});
 await measurement(page,'rod-exact',expected);
 const coarse=Math.abs(number(await page.locator('#rod-sum').innerText())-expected);
 await page.locator('#rod-n').press('End');
 expect(Math.abs(number(await page.locator('#rod-sum').innerText())-expected)).toBeLessThan(coarse);
 for(const id of ['rod-Q','rod-L','rod-d']){
  await page.locator(`#${id}`).press('Home');await page.locator(`#${id}`).press('End');
 }
 await measurement(page,'rod-exact',referenceRod({Q:10e-6,L:1,q:2e-6,d:10}));
 await expect(page.locator('#rod-exact')).toContainText(' N');
 await expect(page.locator('#rod')).toHaveAttribute('aria-label',/length 1.00 metres/);
 await evidence(page,info,'E1-calculus');
});
for(const method of ['Friction','Contact','Induction'])for(const sign of [-1,1])test(`E1 ${method} charging sign ${sign}, prediction gates and conserved charge`,async({page},info)=>{
 await frozen(page,route);await page.getByRole('button',{name:method,exact:true}).click();
 await page.getByRole('button',{name:sign<0?'Plastic + wool (−)':'Glass + silk (+)',exact:true}).click();
 const total=method==='Friction'?0:3*sign,count=method==='Induction'?5:3;
 for(let step=0;step<count;step++){
  expect(number(await page.locator('#t-total').innerText())).toBe(total);
  if(step===count-1)break;
  if(await page.locator('#step-predict').isVisible()){
   await expect(page.locator('#step-next')).toBeDisabled();
   await page.locator('#step-predict-choices').getByRole('radio').last().check();
   await expect(page.locator('#step-predict-fb')).not.toHaveText('');
   await expect(page.locator('#step-next')).toBeEnabled();
   const correct=method==='Contact'?0:1;
   await page.locator('#step-predict-choices').getByRole('radio').nth(correct).check();
   await expect(page.locator('#step-predict-fb')).toContainText('Correct');
  }
  await page.locator('#step-next').click();
 }
 await expect(page.locator('#step-next')).toBeDisabled();
 expect(number(await page.locator('#t-rod').innerText())).toBe(method==='Contact'?sign:3*sign);
 if(method!=='Friction')expect(number(await page.locator('#t-scope').innerText())).toBe(method==='Contact'?2*sign:-2*sign);
 await evidence(page,info,`E1-${method}-${sign}`);
 await page.locator('#step-back').click();await expect(page.locator('#step-next')).toBeEnabled();
});
