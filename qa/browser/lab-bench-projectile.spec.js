import {test,expect,open,evidence,layout} from './helpers.js';
import {STICK_PLACES,MUZZLE,project} from '../../js/core/projectile.js';
import {planetFor} from '../../js/core/lab-noise.js';

const ROUTE='/modules/lab-bench/projectile.html';
const MINP=10;
test.slow();   // each launch is marked frame by frame

/** Click a point of the 800 × 560 video frame (scrolls the frame into view first). */
async function at(page,u,v){const box=await page.locator('#frame').boundingBox();await page.locator('#frame').click({position:{x:u/800*box.width,y:v/560*box.height}});}
async function fire(page,angle,spring,{stick='plane'}={}){
 await page.locator('#angle').fill(String(angle));await page.locator('#spring').fill(String(spring));
 if(await page.locator('#stick-fields').isVisible())await page.locator(`[name=stick][value=${stick}]`).check();
 const before=await page.locator('#launch-rows tr').count();
 await page.getByRole('button',{name:/Fire and film/}).click();
 await expect(page.locator('#launch-rows tr')).toHaveCount(before+1,{timeout:10000});
}
async function calibrate(page,stick='plane'){
 const sp=STICK_PLACES[stick],bot=project(sp.x,sp.y,sp.z),top=project(sp.x,sp.y+1,sp.z),mz=project(MUZZLE.x,MUZZLE.y);
 await page.getByRole('button',{name:'① Set scale'}).click();
 await at(page,bot.u,bot.v);await at(page,top.u,top.v);
 await expect(page.locator('#tool-status')).toHaveText('Scale set');
 await page.getByRole('button',{name:'② Set origin'}).click();await at(page,mz.u,mz.v);
}
/** Mark the ball on every frame in flight, about 1 px off its centre (a careful student). */
async function track(page){
 const mz=project(MUZZLE.x,MUZZLE.y);
 await page.getByRole('button',{name:'③ Mark the ball'}).click();
 await page.getByRole('button',{name:'First frame'}).click();
 for(let i=0;i<80;i++){
  const c=page.locator('#frame circle.pj-ball').first(),cx=+(await c.getAttribute('cx')),cy=+(await c.getAttribute('cy'));
  const label=await page.locator('#frame-label').innerText();
  const still=Math.hypot(cx-mz.u,cy-mz.v)<0.5, landed=/of (\d+)/.exec(label)&&cy>=project(0,0.02).v-1;
  if(still||landed){ if(landed&&!still)break; await page.getByRole('button',{name:'Next ▶'}).click(); continue; }
  await at(page,cx+((i*7)%3-1)*0.6,cy+((i*5)%3-1)*0.6);
  if((await page.locator('#frame-label').innerText())===label)break;   // last frame
 }
}
/** Work out the first three vx and vy values from the velocity table (Δx, Δy, Δt), as a student would. */
/** Leave the given row of the Positions table out of the fit, with a reason. */
async function leaveOut(page,row,reason){
 const tr=page.locator('#data-rows tr:not(.pj-out-note)').nth(row),frame=(await tr.locator('.pj-go').innerText()).trim();
 await tr.locator('.pj-use').uncheck();
 await page.locator('#out-reason').fill(reason);await page.getByRole('button',{name:'Leave it out'}).click();
 await expect(page.locator('#data-rows tr.pj-out-note')).toContainText(`Frame ${frame} left out: ${reason}`);
 return frame;
}
async function handVy(page){
 const rows=page.locator('#vel-rows tr');
 const num=s=>Number(s.replace('−','-'));
 for(let i=0;i<3;i++){
  const c=await rows.nth(i).locator('td').allInnerTexts();   // interval, t_mid, Δt, Δx, Δy, vx, vy
  const dt=num(c[2]);
  await rows.nth(i).locator('input').nth(0).fill((num(c[3])/dt).toFixed(3));await rows.nth(i).locator('input').nth(0).press('Tab');
  await rows.nth(i).locator('input').nth(1).fill((num(c[4])/dt).toFixed(3));await rows.nth(i).locator('input').nth(1).press('Tab');
 }
 await page.getByRole('button',{name:/Check my v/}).click();
 await expect(page.locator('#hand-msg')).toContainText('All 6 are right');
}
async function fitAll(page){
 for(const [key,model] of [['x','line'],['y','parabola'],['vx','line'],['vy','line']]){
  await page.locator(`.pj-model[data-key="${key}"]`).selectOption(model);   // choosing the model fits straight away
  await expect(page.locator(`#c-${key}`)).toContainText('A =');
 }
 const c=await page.locator('#c-y').innerText();
 const C=Number(/C = (\S+) ± (\S+)/.exec(c)[1].replace('−','-')), dC=Number(/C = (\S+) ± (\S+)/.exec(c)[2]);
 return {g:-2*C,dg:2*dC};
}

test('Lab 2 practice: fire, calibrate, mark, work out vy, fit, and get Earth’s g back from the parabola',async({page},info)=>{
 await open(page,ROUTE);await page.evaluate(()=>{try{localStorage.clear();}catch{}});await page.reload();
 await expect(page.getByRole('button',{name:'③ Mark the ball'})).toBeDisabled();
 // a shot out of the picture is refused
 await page.locator('#angle').fill('45');await page.locator('#spring').fill('6');await page.getByRole('button',{name:/Fire and film/}).click();
 await expect(page.locator('#fire-msg')).toContainText('left the camera',{timeout:10000});
 await expect(page.locator('#launch-rows tr')).toHaveCount(0);
 await fire(page,45,3);await calibrate(page);await track(page);
 expect(Number((await page.locator('#data-count').innerText()).split(' ')[0])).toBeGreaterThanOrEqual(10);
 // the page never states g, and vy needs the hand-worked values first
 await expect(page.locator('#g-vy')).toContainText('check your v_x and v_y values first');
 await page.locator('#vel-rows tr').first().locator('input').first().fill('99');await page.getByRole('button',{name:/Check my v/}).click();
 await expect(page.locator('#hand-msg')).toContainText('Not yet');
 await handVy(page);
 // a fit needs a model choice
 await page.locator('.pj-fit[data-key="x"]').click();await expect(page.locator('#c-x')).toContainText('Choose a model first');
 let r1=await fitAll(page);
 // the menu and the fit always agree: switching the model refits without pressing Fit
 await page.locator('.pj-model[data-key="y"]').selectOption('line');
 await expect(page.locator('#c-y')).toContainText('y = A + B t');await expect(page.locator('#c-y')).not.toContainText('C =');
 await page.locator('.pj-model[data-key="y"]').selectOption('parabola');await expect(page.locator('#c-y')).toContainText('C =');
 // leaving a mark out of the fit: a reason is required, the row is struck through, the point goes hollow
 const n0=Number((await page.locator('#data-count').innerText()).split(' ')[0]);
 const tr=page.locator('#data-rows tr').nth(5);
 await tr.locator('.pj-use').uncheck();
 await page.getByRole('button',{name:'Leave it out'}).click();
 await expect(page.locator('#out-msg')).toContainText('Write a short reason first');
 await page.getByRole('button',{name:'Keep it'}).click();
 await expect(page.locator('#out-reason')).toHaveCount(0);await expect(tr.locator('.pj-use')).toBeChecked();
 const frame=await leaveOut(page,5,'ball blurred');
 await expect(page.locator('#data-rows tr.pj-out')).toHaveCount(1);
 await expect(page.locator('#data-count')).toContainText(`${n0-1} points in the fit · 1 left out`);
 await expect(page.locator('#c-y')).toContainText(`fitted ${n0-1} of ${n0} points`);
 await expect(page.locator('#g-y circle.xy-hollow')).toHaveCount(1);
 await expect(page.locator('#launch-rows tr').first()).toContainText('(1 left out)');
 // the frame-number button shows that frame in the video
 await page.locator('#data-rows tr.pj-out .pj-go').click();
 await expect(page.locator('#frame-label')).toContainText(`Frame ${frame} of`);
 await expect(page.locator('#frame-label')).toContainText('left out of the fit');
 // the velocities skip it
 await expect(page.locator('#vel-rows')).toContainText(`${Number(frame)-1} → ${Number(frame)+1}`);
 // put it back
 await page.locator('#data-rows tr.pj-out .pj-use').click();
 await expect(page.locator('#data-rows tr.pj-out')).toHaveCount(0);
 await expect(page.locator('#c-y')).toContainText(`(fitted ${n0} points)`);
 r1=await fitAll(page);
 expect(Math.abs(r1.g-9.81)/9.81).toBeLessThan(0.03);
 expect(await page.locator('.pj-graphs').innerText()).not.toMatch(/\bg\s*=/);   // the page never states g from the fits
 // second launch: the calibration carries over because the camera and stick have not moved
 await fire(page,60,4);await expect(page.locator('#fire-msg')).toContainText('calibration from launch');
 await track(page);await handVy(page);const r2=await fitAll(page);
 await expect(page.locator('#progress')).toContainText('2 of 2 launches analysed');
 const g=(r1.g+r2.g)/2, dg=Math.max(Math.abs(r1.g-r2.g)/2, r1.dg, r2.dg, 0.02);
 await page.locator('#r-g').fill(g.toFixed(2));await page.locator('#r-dg').fill((dg*2).toFixed(2));
 await page.getByRole('button',{name:'Compare with Earth’s g'}).click();
 await expect(page.locator('#result-msg')).toContainText('agrees');
 await expect(page.locator('#explain-q')).toBeVisible();
 await evidence(page,info,'lab2-practice');
 expect((await layout(page)).overflow).toBe(false);
 // the notebook survives a reload
 await page.reload();await expect(page.locator('#launch-rows tr')).toHaveCount(2);
});

test('Lab 2 graded: instructor makes a link with the parallax trap, the student moves the stick, submits, and the code grades 4 / 4',async({page},info)=>{
 await open(page,'/modules/lab-bench/instructor.html');await page.evaluate(()=>{try{localStorage.clear();}catch{}});await page.reload();
 await page.getByLabel('Lab 2 · g from a projectile').check();
 await page.getByLabel('Assignment code').fill('QA-Lab2');await page.locator('#m2-px').check();
 await page.getByRole('button',{name:'Make the link'}).click();
 const link=await page.locator('#made-link').innerText(),key=await page.locator('#made-key').innerText();
 expect(link).toContain('projectile.html?a=qa-lab2');expect(link).toContain('px=1');
 await expect(page.locator('#saved-rows tr').first()).toContainText('Lab 2');
 const u=new URL(link);
 await open(page,u.pathname+u.search);
 await expect(page.locator('#graded-banner')).toContainText('Graded assignment');
 await page.getByLabel('Your student ID').fill('QA 902');await page.getByRole('button',{name:'Go to my planet'}).click();
 const planet=planetFor('QA 902','qa-lab2');
 await expect(page.locator('#stick-fields')).toBeVisible();
 await expect(page.locator('[name=stick][value=front]')).toBeChecked();   // the trap: the stick starts on the front edge
 const ok=[[45,2],[60,3],[30,3],[45,4],[60,5],[45,6]].filter(([a,s])=>true);
 let fired=0;const results=[];
 for(const [angle,spring] of ok){
  if(fired===2)break;
  await page.locator('#angle').fill(String(angle));await page.locator('#spring').fill(String(spring));await page.locator('#fps').selectOption('60');await page.locator('[name=stick][value=plane]').check();
  const before=await page.locator('#launch-rows tr').count();
  await page.getByRole('button',{name:/Fire and film/}).click();
  await expect(page.getByRole('button',{name:/Fire and film/})).toBeEnabled({timeout:10000});   // filming finished
  if(await page.locator('#launch-rows tr').count()===before)continue;
  if((await page.locator('#tool-status').innerText())==='Not calibrated')await calibrate(page,'plane');
  await track(page);
  const n=Number((await page.locator('#data-count').innerText()).split(' ')[0]);
  if(n<10){await page.getByRole('button',{name:/Delete launch/}).last().click();await page.getByRole('button',{name:/Delete launch/}).last().click();continue;}
  if(fired===0&&n>=MINP+1)await leaveOut(page,n-1,'ball partly off the frame');
  await handVy(page);results.push(await fitAll(page));fired++;
 }
 expect(fired).toBe(2);
 const g=(results[0].g+results[1].g)/2,dg=Math.max(Math.abs(results[0].g-results[1].g)/2,results[0].dg,results[1].dg)*2;
 expect(Math.abs(g-planet.g)/planet.g).toBeLessThan(0.04);
 await page.locator('#r-g').fill(g.toFixed(2));await page.locator('#r-dg').fill(Math.max(dg,0.05).toFixed(2));
 await page.getByRole('button',{name:'Submit my result'}).click();
 await expect(page.locator('#result-msg')).toContainText('Answer the “Explain your result” question');
 await page.getByRole('radio',{name:/Things nearer the camera look bigger/}).check();await page.getByRole('button',{name:'Check my answer'}).click();
 await page.getByRole('button',{name:'Submit my result'}).click();
 await expect(page.locator('#result-msg')).toContainText('Submitted');
 const code=await page.locator('#completion-code').innerText();
 expect(code).toMatch(/^LB-/);expect(code.length).toBeLessThan(70);
 // The page never states the planet's g. (The student's own fits and tables can land on it by chance: that is their measurement.)
 const pageText=await page.evaluate(()=>{const b=document.body.cloneNode(true);b.querySelectorAll('.pj-graphs,#data-table,#vel-table,#launch-rows').forEach(e=>e.remove());return b.textContent;});
 expect(pageText).not.toContain(planet.g.toFixed(2));
 await evidence(page,info,'lab2-graded-student');
 // grading: choose the saved assignment, paste the code
 await open(page,'/modules/lab-bench/instructor.html');
 await page.getByRole('button',{name:'Grade qa-lab2'}).click();
 await expect(page.getByLabel('Grading key')).toHaveValue(key);
 await page.getByLabel('Completion codes',{exact:true}).fill(`Ann,${code}`);
 await page.getByRole('button',{name:'Grade',exact:true}).click();
 await expect(page.locator('#g-msg')).toContainText('1 student graded');
 await expect(page.locator('#grade-rows tr').first()).toContainText('4 / 4');
 await expect(page.locator('#grade-rows tr').first()).toContainText('stick in the flight plane');
 await expect(page.locator('#grade-rows tr').first()).toContainText('1 left out');
 await evidence(page,info,'lab2-grading');
 expect((await layout(page)).overflow).toBe(false);
});
