import {test as base,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
export {expect};
export const test=base.extend({
 page:async({page},use,testInfo)=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(`Unhandled: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')errors.push(`Console: ${m.text()}`);});
  page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()} ${r.url()}`);});
  page.on('requestfailed',r=>{if(!r.failure()?.errorText.includes('ERR_ABORTED'))errors.push(`Request: ${r.url()} ${r.failure()?.errorText}`);});
  await use(page);
  await testInfo.attach('runtime-errors',{body:JSON.stringify(errors,null,2),contentType:'application/json'});
  expect(errors,'Browser runtime/HTTP errors').toEqual([]);
 },
});
export async function open(page,path){await page.goto(path);await expect(page.locator('h1')).toBeVisible();}
export async function frozen(page,path){
 await page.clock.install({time:new Date('2026-10-19T12:00:00Z')});
 await page.clock.pauseAt(new Date('2026-10-19T12:00:01Z'));
 await open(page,path);
}
export async function free(page,lab){
 await page.getByRole('button',{name:'Free Exploration',exact:true}).click();
 if(lab.id==='oscillator')await page.getByRole('button',{name:'Spring and damper',exact:true}).click();
 if(lab.id==='quadratic')await page.getByLabel('Drag law',{exact:true}).selectOption('quadratic');
 if(lab.id==='second'){
  await page.getByRole('radio',{name:'Velocity increases',exact:true}).check();
  await page.getByRole('button',{name:'Save prediction',exact:true}).click();
 }
}
export const start=page=>page.locator('#start').click();
export const status=(page,lab)=>page.locator(lab.id==='third'?'#status':'#run-status');
export async function advance(page,ms){
 // 80 ms frames stay below the application's 100 ms cap. This exercises its
 // fixed-step loop without rendering every 16 ms of a long virtual observation.
 if(ms>2000){for(let left=ms;left>0;left-=80)await page.clock.fastForward(Math.min(left,80));}
 else await page.clock.runFor(ms);
}
export async function evidence(page,info,name){
 const screenshot=info.outputPath(`${name}.png`),transcript=info.outputPath(`${name}.txt`);
 await page.screenshot({path:screenshot,fullPage:true,animations:'disabled'});await info.attach(`${name}.png`,{path:screenshot,contentType:'image/png'});
 await writeFile(transcript,await page.locator('body').innerText());await info.attach(`${name}.txt`,{path:transcript,contentType:'text/plain'});
 const text=await page.locator('body').innerText();
 const candidates=text.split('\n').filter(line=>/\b(undefined|NaN|TODO|FIXME|Lorem ipsum)\b|\[object Object\]|�|\{(?:m|F|v0|a|v|x)(?:@[^}]*)?\}/.test(line));
 // Deliberately review-only: headings, intentional prompts and distractors can
 // end this way. These patterns cannot prove that prose or math is incorrect.
 const incomplete=text.split('\n').map(s=>s.trim()).filter(line=>
  /(?:\b(?:because|therefore|which|with|and|the)|[=+÷×])\s*$/i.test(line));
 const geometry=await layout(page);
 await info.attach(`${name}-review-candidates.json`,{body:JSON.stringify({content:candidates,incompleteTextOrEquation:incomplete,geometry},null,2),contentType:'application/json'});
}
export async function guided(page,lab,id,choiceIndex=0){
 await page.getByRole('button',{name:/^Guided/}).click();
 await page.locator(lab.select||'#guided-select').selectOption(id);
 await expect(page.locator('#start')).toBeDisabled();
 const form=page.locator(lab.form||'#guided-prediction-form');
 await form.getByRole('radio').nth(choiceIndex).check();
 await form.getByRole('button',{name:'Save prediction',exact:true}).click();
 await expect(page.locator('#start')).toBeEnabled();
}
export async function complete(page,lab){
 for(let i=0;i<3;i++){
  await start(page);await advance(page,22000);
  const next=page.locator('#next-run');
  if(await next.count()&&await next.isVisible()){await next.click();continue;}
  break;
 }
 await expect(status(page,lab)).toContainText(/complete|finished|ended/i);
}
export async function reflection(page,lab){
 const answer=page.locator(lab.id==='third'?'#explanation':'#reflection-answer');
 await expect(answer).toBeVisible();await answer.fill('The measured motion follows the net force and the stated model.');
 await page.getByRole('button',{name:'Submit explanation',exact:true}).click();
 await expect(page.locator('#model-answer')).toBeVisible();
 await expect(page.locator('#model-answer')).not.toHaveText('');
}
export async function layout(page){
 return page.evaluate(()=>{
  const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
  const controls=[...document.querySelectorAll('button,input,select,textarea')].filter(visible);
  const clipped=controls.filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+2||r.left< -2;}).map(e=>e.id||e.outerHTML.slice(0,150));
  const overlaps=[];
  for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
   const a=controls[i],b=controls[j],r=a.getBoundingClientRect(),s=b.getBoundingClientRect();
   if(!a.contains(b)&&!b.contains(a)&&Math.min(r.right,s.right)-Math.max(r.left,s.left)>3&&Math.min(r.bottom,s.bottom)-Math.max(r.top,s.top)>3)overlaps.push([a.id||a.textContent,b.id||b.textContent]);
  }
  const textCandidates=[...document.querySelectorAll('p,label,button,summary,th,td,output')].filter(visible).filter(e=>e.scrollWidth>e.clientWidth+3&&e.clientWidth>0||parseFloat(getComputedStyle(e).fontSize)<10).map(e=>({element:e.id||e.tagName,text:e.textContent.trim().slice(0,180),font:getComputedStyle(e).fontSize}));
  return {overflow:document.documentElement.scrollWidth>innerWidth+2,clipped,overlaps,textCandidates};
 });
}
