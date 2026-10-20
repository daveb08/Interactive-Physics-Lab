import {test,expect,frozen,free,start,advance,evidence} from './helpers.js';
import {freeScenarios,labs} from '../manifest.js';
import {constant,linear,ode} from '../reference.js';
for(const lab of freeScenarios.filter(l=>l.id!=='third'))test(`independent displayed measurements ${lab.id}`,async({page})=>{
 await frozen(page,lab.path);await free(page,lab);await start(page);await advance(page,512);await page.locator('#pause').click();
 const t=parseFloat(await page.locator(lab.time).innerText());
 if(lab.id==='circle'){
  expect(Number(await page.locator('#r-v').innerText())).toBe(3);expect(Number(await page.locator('#r-a').innerText())).toBe(6);expect(Number(await page.locator('#r-F').innerText())).toBe(3);return;
 }
 const referenceAt=u=>lab.id==='first'?constant(2,0,3,u):lab.id==='second'?constant(2,6,0,u):lab.id==='drag'?linear(2,6,2,0,u):lab.id==='quadratic'?ode((x,v)=>(6-.5*v*v)/2,0,0,u):ode((x,v)=>-16*x-v,.5,0,u);
 // The displayed time is rounded to .01 s. Compare against the independent
 // range over that rounding interval, plus .005 for each readout's rounding.
 const possible=Array.from({length:11},(_,i)=>referenceAt(Math.max(0,t-.005+i*.001)));
 const ids=['first','second'].includes(lab.id)?['position','speed','acceleration']:['r-x','r-v','r-a'];
 for(const [i,k] of ['x','v','a'].entries()){
  const value=Number(await page.locator(`#${ids[i]}`).innerText());
  expect(value).toBeGreaterThanOrEqual(Math.min(...possible.map(s=>s[k]))-.0051);
  expect(value).toBeLessThanOrEqual(Math.max(...possible.map(s=>s[k]))+.0051);
 }
 // MotionGraph exposes its plotted terminal sample through an accessible description.
 if(['first','second'].includes(lab.id))for(const [i,id] of ['position','velocity','acceleration'].entries()){
  const label=await page.locator(`#${id}-graph`).getAttribute('aria-label');
  expect(label).toContain(`${Number(await page.locator(`#${ids[i]}`).innerText()).toFixed(2)}`);
 }
});
test('critical damping outside slider range leaves a usable oscillator',async({page},info)=>{
 await frozen(page,labs[3].path);await page.getByRole('button',{name:'Spring and damper',exact:true}).click();
 await page.locator('#o-mass').press('End');await page.locator('#o-k').press('End');
 await page.getByRole('button',{name:'Set critical damping',exact:true}).click();
 await expect(page.locator('#run-message')).toContainText('above the 20 kg/s limit');
 await page.getByRole('button',{name:'Drag',exact:true}).click();
 await page.getByRole('button',{name:'Spring and damper',exact:true}).click();
 await evidence(page,info,'critical-limit');await start(page);await advance(page,200);
 await expect(page.locator('#run-status')).toHaveText('Running');
});
test('touch and keyboard navigation through modules',async({page},info)=>{
 await frozen(page,'/index.html');
 const enter=page.getByRole('link',{name:/Newton’s Laws/});
 if(info.project.name==='ipad-touch')await enter.tap();else await enter.press('Enter');
 await expect(page).toHaveURL(/newtons-laws\/index.html/);
 await page.getByRole('link',{name:/First Law/}).click();await expect(page).toHaveURL(/first-law.html/);
 await page.getByRole('link',{name:/Third Law/}).click();await expect(page).toHaveURL(/third-law.html/);
 await page.locator('a.brand').click();await page.getByRole('link',{name:/Forces That Change/}).click();await expect(page).toHaveURL(/variable-forces/);
});
