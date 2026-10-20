import {test,expect,open,frozen,free,start,status,advance,evidence,guided,complete,reflection,layout} from './helpers.js';
import {routes,labs,freeScenarios} from '../manifest.js';
import {EXPERIMENTS} from '../../modules/newtons-laws/guided-experiments.js';
import {THIRD_EXPERIMENTS} from '../../modules/newtons-laws/third-law-activities.js';
import {ACTIVITIES as VA} from '../../modules/variable-forces/activities.js';
import {ACTIVITIES as CA} from '../../modules/circular-motion/activities.js';
import {ode} from '../reference.js';

for(const lab of labs)test(`prediction gating and correct feedback ${lab.id}`,async({page})=>{
 await frozen(page,lab.path);await guided(page,lab,lab.activities[0],lab.id==='circle'?0:1);
 const form=page.locator(lab.form||'#guided-prediction-form');
 await form.getByRole('radio').nth(lab.id==='circle'?1:0).check();await expect(page.locator('#start')).toBeDisabled();
 await form.getByRole('radio').nth(lab.id==='circle'?0:1).check();await form.getByRole('button',{name:'Save prediction',exact:true}).click();
 await complete(page,lab);
 const feedback=page.locator(lab.id==='third'?'#results':lab.id==='drag'||lab.id==='circle'?'#guided-results':'#guided-feedback');
 await expect(feedback).toContainText(/matches|match/i);
});

for(const path of routes)test(`route loads and local navigation ${path}`,async({page},info)=>{
 await open(page,path);
 const links=await page.locator('a[href]').evaluateAll(es=>es.map(e=>e.href).filter(h=>h.startsWith(location.origin)&&!h.includes('#')));
 for(const href of new Set(links))expect((await page.request.get(href)).ok(),href).toBeTruthy();
 const geometry=await layout(page);await info.attach('geometry-candidates',{body:JSON.stringify(geometry,null,2),contentType:'application/json'});
 await evidence(page,info,'initial');
 expect.soft(geometry.overflow,'Page horizontal overflow').toBe(false);
 const text=await page.locator('body').innerText();
 expect.soft(text,'Unresolved generated content').not.toMatch(/\b(?:undefined|NaN|Lorem ipsum|TODO|FIXME)\b|\[object Object\]|�/);
 await page.locator('a.brand').click();await expect(page).toHaveURL(/\/index.html$/);
});

for(const lab of freeScenarios)test(`free transport and graph updates ${lab.id}`,async({page},info)=>{
 await frozen(page,lab.path);await free(page,lab);
 await evidence(page,info,'free');
 const before=await page.locator('svg').evaluateAll(es=>es.map(e=>e.innerHTML).join(''));
 await start(page);await advance(page,320);await expect(status(page,lab)).toHaveText('Running');
 await evidence(page,info,'running');
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 const time=await page.locator(lab.time).innerText();expect(parseFloat(time)).toBeGreaterThan(0);
 await advance(page,500);await expect(page.locator(lab.time)).toHaveText(time);
 await evidence(page,info,'paused');
 expect(await page.locator('svg').evaluateAll(es=>es.map(e=>e.innerHTML).join(''))).not.toBe(before);
 await start(page);await advance(page,320);expect(parseFloat(await page.locator(lab.time).innerText())).toBeGreaterThan(parseFloat(time));
 await page.getByRole('button',{name:/^↺ Reset$|^Reset$/}).click();
 expect(parseFloat(await page.locator(lab.time).innerText())).toBe(0);
});

for(const lab of freeScenarios)test(`parameter endpoints zero and signed values ${lab.id}`,async({page})=>{
 await frozen(page,lab.path);await free(page,lab);
 if(['first','second'].includes(lab.id))await page.getByLabel('Enable Friction',{exact:true}).check();
 const sliders=page.getByRole('slider');
 for(let i=0;i<await sliders.count();i++){
  const s=sliders.nth(i);if(!await s.isVisible()||!await s.isEnabled()||await s.getAttribute('id')==='scrub')continue;
  const min=Number(await s.getAttribute('min')),max=Number(await s.getAttribute('max'));
  await s.focus();await s.press('Home');expect(Number(await s.inputValue())).toBe(min);
  await s.press('End');expect(Number(await s.inputValue())).toBe(max);
  if(min<0&&max>0){await s.press('Home');const step=Number(await s.getAttribute('step'))||1;for(let n=0;n<Math.round(-min/step);n++)await s.press('ArrowRight');expect(Number(await s.inputValue())).toBe(0);}
 }
 if(['first','second'].includes(lab.id))expect(Number(await page.locator('#mu-k').inputValue())).toBeLessThanOrEqual(Number(await page.locator('#mu-s').inputValue()));
 if(lab.id==='second'){await page.getByRole('radio',{name:'Velocity increases',exact:true}).check();await page.getByRole('button',{name:'Save prediction',exact:true}).click();}
 await start(page);await advance(page,250);await expect(status(page,lab)).toHaveText(/Running|Complete|Finished/);
 expect(await page.locator('body').innerText()).not.toMatch(/\bNaN\b|undefined/);
});

for(const lab of labs)for(const id of lab.activities)test(`guided ${lab.id} ${id}: incorrect prediction, all trials, reflection, reset`,async({page},info)=>{
 await frozen(page,lab.path);
 const data=lab.id==='third'?THIRD_EXPERIMENTS[id]:lab.id==='drag'?VA[id]:lab.id==='circle'?CA[id]:EXPERIMENTS[id];
 const correct=data.answer||data.correct,wrong=correct==='A'?1:0;
 await guided(page,lab,id,wrong);await complete(page,lab);
 const feedback=page.locator(lab.id==='third'?'#results':lab.id==='drag'||lab.id==='circle'?'#guided-results':'#guided-feedback');
 await expect(feedback).toBeVisible();await expect(feedback).not.toHaveText('');
 await evidence(page,info,`${id}-incorrect-completed`);await reflection(page,lab);await evidence(page,info,`${id}-reflection`);
 await page.locator('#reset').click();await expect(page.locator('#start')).toBeDisabled();
});

test('second law quantitative feedback and independent UI values',async({page})=>{
 await frozen(page,labs[1].path);await page.getByRole('button',{name:'Quantitative',exact:true}).click();
 await page.locator('#predicted-a').fill('3');await page.locator('#predicted-v').fill('9');
 await page.getByRole('button',{name:'Save prediction',exact:true}).click();await start(page);await advance(page,3024);
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 const t=Number(await page.locator('#time').innerText());
 expect(Number(await page.locator('#acceleration').innerText())).toBe(3);
 expect(Number(await page.locator('#speed').innerText())).toBeCloseTo(3*t,1);
 expect(Number(await page.locator('#position').innerText())).toBeCloseTo(1.5*t*t,1);
 await expect(page.locator('#feedback')).toContainText('within tolerance');
});

test('circular cut and force vector toggles',async({page})=>{
 await frozen(page,labs[4].path);await page.getByLabel('Velocity v',{exact:true}).uncheck();
 await page.getByLabel('Velocity v',{exact:true}).check();
 await start(page);await advance(page,512);await page.getByRole('button',{name:/Cut the string/}).click();await advance(page,128);
 await expect(page.locator('#r-F')).toHaveText('0.00');await expect(page.locator('#r-a')).toHaveText('0.00');
 await expect(page.locator('#r-v')).toHaveText('3.00');
 await page.locator('#math-on').check();await expect(page.locator('#math-body')).toBeVisible();
});

test('third law force diagram rejects other-cart reaction and accepts correct forces',async({page},info)=>{
 await frozen(page,labs[2].path);await free(page,labs[2]);
 await page.getByLabel('Reaction force acting on the other cart',{exact:true}).check();
 await page.getByRole('button',{name:'Check diagram',exact:true}).click();
 await expect(page.locator('#fbd-feedback')).not.toHaveText('');await evidence(page,info,'incorrect-fbd');
 await page.getByLabel('Reaction force acting on the other cart',{exact:true}).uncheck();
 for(const name of ['Weight (mg)','Normal force (N)','Spring interaction force'])await page.getByLabel(name,{exact:true}).check();
 await page.getByRole('button',{name:'Check diagram',exact:true}).click();
 await expect(page.locator('#fbd-feedback')).toContainText(/correct|match/i);
 await page.locator('#fbd-cart').selectOption('B');await expect(page.locator('#fbd-target-note')).toContainText('B');
 for(const name of ['Weight (mg)','Normal force (N)','Spring interaction force'])await page.getByLabel(name,{exact:true}).check();
 await page.getByRole('button',{name:'Check diagram',exact:true}).click();
 await page.getByText('Compare both diagrams: identify the Third Law pair',{exact:true}).click();
 await page.getByRole('radio',{name:'The normal force acting on Cart A',exact:true}).check();await page.getByRole('button',{name:'Check force pair',exact:true}).click();
 await expect(page.locator('#pair-feedback')).toContainText('not another force');
 await page.getByRole('radio',{name:'The spring-mediated force exerted by Cart A on Cart B',exact:true}).check();await page.getByRole('button',{name:'Check force pair',exact:true}).click();
 await expect(page.locator('#pair-feedback')).toContainText('Correct');
});

test('variable-force numerical overlays, scrub and CSV',async({page})=>{
 await frozen(page,labs[3].path);await page.getByRole('button',{name:'Spring and damper',exact:true}).click();
 for(const name of ['Euler','Semi-implicit Euler','RK4'])await page.getByLabel(name,{exact:true}).check();
 await page.locator('#step-size').selectOption('0.05');await start(page);await advance(page,1024);await page.locator('#pause').click();
 await page.locator('#scrub').press('Home');await expect(page.locator('#scrub-value')).toHaveText('0.00 s');
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:/Download CSV/}).click();
 const download=await pending;expect(download.suggestedFilename()).toMatch(/\.csv$/);
 const stream=await download.createReadStream();let csv='';for await(const part of stream)csv+=part;
 expect(csv).toMatch(/time|t \(s\)|t_s/i);expect(csv.split('\n').length).toBeGreaterThan(10);
 const rows=csv.trim().split('\n').slice(1).map(s=>s.split(',').map(Number));
 for(const row of [rows[0],rows[50],rows.at(-1)]){
  const [t,x,v,a]=row,ref=ode((x,v)=>-16*x-v,.5,0,t);
  for(const [actual,expected] of [[x,ref.x],[v,ref.v],[a,ref.a]])expect(Math.abs(actual-expected)).toBeLessThan(1e-6);
 }
});
