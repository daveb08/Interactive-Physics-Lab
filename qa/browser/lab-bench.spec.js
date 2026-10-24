import {planetFor as _pf} from '../../js/core/lab-noise.js';
import {test,expect,frozen,evidence,layout} from './helpers.js';
const route='/modules/lab-bench/freefall.html';
const loupeH=async page=>Number((await page.locator('#loupe').getAttribute('aria-label')).match(/at ([\d.]+) metres/)[1]);
test('Lab Bench is linked from the catalog and its hub',async({page})=>{
 await frozen(page,'/index.html');
 await expect(page.getByRole('link',{name:/Lab Bench/})).toHaveAttribute('href','modules/lab-bench/index.html');
 await frozen(page,'/modules/lab-bench/index.html');
 await expect(page.getByRole('link',{name:/Find g/})).toHaveAttribute('href','freefall.html');
});
test('Lab 1 by keyboard: set up, time 15 drops at 3 heights, fit recovers Earth’s g, report and compare',async({page},info)=>{
 await frozen(page,route);
 await page.evaluate(()=>{try{localStorage.clear();}catch{}});await page.reload();
 await expect(page.getByRole('button',{name:/Drop the ball/})).toBeDisabled();
 for(const n of ['Steel ball','Measuring stick (2 m)','Hand stopwatch'])await page.getByRole('button',{name:`Place on bench: ${n}`}).press('Enter');
 await expect(page.locator('#checklist li.done')).toHaveCount(3);
 await expect(page.locator('#bench-status')).toHaveText('Ready to drop');
 const offsets=[-0.012,0.008,0,0.015,-0.006];        // the student's timing errors (s), the same at each height
 for(const key of ['PageDown','PageUp','PageUp']){            // about 0.6 m, 1.0 m, 1.4 m
  const clamp=page.getByRole('button',{name:/^Release clamp/});for(let i=0;i<8;i++)await clamp.press(key);
  const h=await loupeH(page);
  for(const off of offsets){
   await page.getByLabel('Height you read (m)').fill(h.toFixed(3));
   await page.getByRole('button',{name:/Drop the ball/}).click();
   await page.clock.runFor(2100);                     // 3, 2, 1, drop on a steady beat
   await expect(page.locator('#countdown')).toHaveText('Drop!');
   await page.keyboard.press('Space');                // start on the beat
   await page.clock.runFor(Math.round((Math.sqrt(2*h/9.81)+off)*1000));
   await page.keyboard.press('Space');                // stop at impact
   await page.clock.runFor(800);
   await page.getByRole('button',{name:/Record trial/}).click();
  }
 }
 await expect(page.locator('#trial-rows tr')).toHaveCount(15);
 await expect(page.locator('#progress')).toContainText('✓ 3 heights');
 const fit=await page.locator('#f-g').innerText(), g=Number(fit.split(' ')[0]);
 expect(Math.abs(g-9.81)/9.81).toBeLessThan(.08);
 // delete keeps the row, crossed out; undo restores it
 await page.getByRole('button',{name:'Delete trial 2'}).click();await expect(page.locator('#trial-rows tr.deleted')).toHaveCount(1);
 await page.getByRole('button',{name:'Restore trial 2'}).click();await expect(page.locator('#trial-rows tr.deleted')).toHaveCount(0);
 await expect(page.locator('#explain-stats')).toBeVisible();await expect(page.locator('#explain-fit')).toBeVisible();
 await page.locator('#r-g').fill(g.toFixed(2));await page.locator('#r-dg').fill('0.8');
 await page.getByRole('button',{name:'Compare with Earth’s g'}).click();
 await expect(page.locator('#result-msg')).toContainText('inside your range');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:/Download notebook/}).click();
 expect((await download).suggestedFilename()).toBe('lab1-find-g-notebook.csv');
 // the notebook survives a reload (this browser only)
 await page.reload();await expect(page.locator('#trial-rows tr')).toHaveCount(15);
 expect(await page.locator('body').innerText()).not.toMatch(/\bNaN\b|\bInfinity\b|undefined/);
 expect((await layout(page)).overflow).toBe(false);
 await evidence(page,info,'lab1-complete');
});
test('Lab 1 guards: no drop before setup, record needs a reading and a time, clamp limits',async({page})=>{
 await frozen(page,route);
 await page.evaluate(()=>{try{localStorage.clear();}catch{}});await page.reload();
 for(const n of ['Steel ball','Measuring stick (2 m)'])await page.getByRole('button',{name:`Place on bench: ${n}`}).click();
 await expect(page.getByRole('button',{name:/Drop the ball/})).toBeDisabled();
 await expect(page.locator('#bench-msg')).toContainText('hand stopwatch');
 await page.getByRole('button',{name:'Place on bench: Hand stopwatch'}).click();
 await expect(page.getByRole('button',{name:/Record trial/})).toBeDisabled();
 const clamp=page.getByRole('button',{name:/^Release clamp/});
 for(let i=0;i<50;i++)await clamp.press('PageUp');expect(await loupeH(page)).toBeLessThanOrEqual(2.005);
 for(let i=0;i<50;i++)await clamp.press('PageDown');expect(await loupeH(page)).toBeGreaterThanOrEqual(.2);
});

// ---------- Stage 2: electronic timer, ping-pong ball, mystery planets, explain question ----------
const planetFor=_pf;
const fall=(g,h)=>Math.sqrt(2*h/g);
async function setup(page,items){for(const n of items)await page.getByRole('button',{name:new RegExp(`^(Place on bench|Swap into the clamp): ${n.replace(/[()]/g,'\\$&')}$`)}).click();}
async function gateDrops(page,heights,perHeight,g){
 const clamp=page.getByRole('button',{name:/^Release clamp/});
 for(const [key,n] of heights){
  for(let i=0;i<n;i++)await clamp.press(key);
  const h=await loupeH(page);
  for(let i=0;i<perHeight;i++){
   await page.getByLabel('Height you read (m)').fill(h.toFixed(3));
   await page.getByRole('button',{name:/Drop the ball/}).click();
   await page.clock.runFor(2100);await page.clock.runFor(Math.round(fall(g,h)*1300)+400);
   await expect(page.locator('#gate-display')).not.toHaveText('0.000');
   await page.getByRole('button',{name:/Record trial/}).click();
  }
 }
}
test('Stage 2: the electronic timer times every drop itself and the fit recovers Earth’s g to 1 %',async({page},info)=>{
 await frozen(page,route);await page.evaluate(()=>{try{localStorage.clear();}catch{}});await page.reload();
 await setup(page,['Steel ball','Measuring stick (2 m)','Electronic timer']);
 await expect(page.locator('#checklist li.done')).toHaveCount(3);
 await expect(page.locator('#watch')).toBeHidden();await expect(page.locator('#gate')).toBeVisible();
 await gateDrops(page,[['PageDown',8],['PageUp',8],['PageUp',8]],5,9.81);
 await expect(page.locator('#progress')).toContainText('✓ 3 heights');
 const g=Number((await page.locator('#f-g').innerText()).split(' ')[0]);
 expect(Math.abs(g-9.81)/9.81).toBeLessThan(.01);
 await expect(page.locator('#q-text')).toContainText('What now limits your result most');
 await page.getByRole('radio',{name:/How precisely I read the drop height/}).check();
 await page.getByRole('button',{name:'Check my answer'}).click();await expect(page.locator('#q-feedback')).toContainText('✓');
 await evidence(page,info,'stage2-gate-earth');
});
test('Stage 2: in Earth’s air the ping-pong ball gives g too low, and the explain question asks about drag',async({page})=>{
 await frozen(page,route);await page.evaluate(()=>{try{localStorage.clear();}catch{}});await page.reload();
 await setup(page,['Ping-pong ball','Measuring stick (2 m)','Electronic timer']);
 await gateDrops(page,[['PageUp',8],['PageUp',2]],3,9.81);
 const g=Number((await page.locator('#f-g').innerText()).split(' ')[0]);
 expect(g).toBeLessThan(9.6);expect(g).toBeGreaterThan(8);
 await expect(page.locator('#q-text')).toContainText('ping-pong ball gives a value of g that is too low');
 await page.getByRole('radio',{name:/Lighter objects fall more slowly/}).check();await page.getByRole('button',{name:'Check my answer'}).click();
 await expect(page.locator('#q-feedback')).toContainText('vacuum');
 // swapping balls keeps both data sets apart: the combination selector appears
 await setup(page,['Steel ball']);await gateDrops(page,[['PageDown',4]],2,9.81);
 await expect(page.locator('#combo-row')).toBeVisible();await expect(page.locator('#combo option')).toHaveCount(2);
});
test('Stage 2: a student ID gives the same hidden planet every time, its own notebook, and a reveal after submitting',async({page},info)=>{
 test.slow();   // about 30 s alone; it timed out at 60 s when the full suite runs two workers
 await frozen(page,route);await page.evaluate(()=>{try{localStorage.clear();}catch{}});await page.reload();
 const planet=planetFor('QA-Student 01');
 await page.getByRole('button',{name:'Mystery planet'}).click();
 await expect(page.getByRole('button',{name:/Drop the ball/})).toBeDisabled();
 await page.getByLabel('Your student ID').fill('QA-Student 01');await page.getByRole('button',{name:'Go to my planet'}).click();
 await expect(page.locator('#planet-status')).toContainText(planet.name);
 expect(await page.locator('body').innerText()).not.toContain(planet.g.toFixed(2));   // the planet's g is never shown before the reveal
 await setup(page,['Steel ball','Measuring stick (2 m)','Electronic timer']);
 await gateDrops(page,[['PageDown',8],['PageUp',12]],3,planet.g);
 const g=Number((await page.locator('#f-g').innerText()).split(' ')[0]);
 expect(Math.abs(g-planet.g)/planet.g).toBeLessThan(.02);
 await page.locator('#r-g').fill(g.toFixed(2));await page.locator('#r-dg').fill((planet.g*.03).toFixed(2));
 // too few drops: the page warns that the ± cannot be trusted and will not take a submission
 await expect(page.locator('#fit-warn')).toBeVisible();
 await page.getByRole('button',{name:'Submit my result'}).click();
 await expect(page.locator('#result-msg')).toContainText('Not yet');await expect(page.getByRole('button',{name:/Reveal my planet/})).toBeHidden();
 await gateDrops(page,[['PageUp',4],['PageDown',8],['PageDown',4]],5,planet.g);
 await expect(page.locator('#fit-warn')).toBeHidden();
 await page.getByRole('button',{name:'Submit my result'}).click();
 await expect(page.locator('#result-msg')).toContainText('Result recorded');
 await page.getByRole('button',{name:/Reveal my planet/}).click();
 await expect(page.locator('#result-msg')).toContainText(planet.g.toFixed(2));
 await expect(page.locator('#result-msg')).toContainText('inside your range');
 await evidence(page,info,'stage2-planet');
 // same ID after a reload: same planet and its notebook; Earth keeps its own (empty) notebook
 await page.reload();await expect(page.locator('#planet-status')).toContainText(planet.name);
 await expect(page.locator('#trial-rows tr')).toHaveCount(21);
 await page.getByRole('button',{name:'Earth (practice)'}).click();await expect(page.locator('#trial-rows tr')).toHaveCount(0);
 expect((await layout(page)).overflow).toBe(false);
});

// ---------- Stage 3: graded assignments ----------
test('Stage 3: an instructor makes a link, a student completes it with g hidden and gets a code, and the code grades 4 / 4',async({page},info)=>{
 await frozen(page,'/modules/lab-bench/instructor.html');
 await page.getByLabel('Assignment code').fill('QA-Lab1');await page.getByRole('button',{name:'Make the link'}).click();
 const link=await page.locator('#made-link').innerText(), key=await page.locator('#made-key').innerText();
 expect(link).toContain('freefall.html?a=qa-lab1');expect(link).not.toContain(key);
 const u=new URL(link);
 await frozen(page,u.pathname+u.search);await page.evaluate(()=>{try{localStorage.clear();}catch{}});await page.reload();
 await expect(page.locator('#graded-banner')).toContainText('Graded assignment');
 await page.getByLabel('Your student ID').fill('QA 777');await page.getByRole('button',{name:'Go to my planet'}).click();
 const planet=planetFor('QA 777','qa-lab1');
 expect(await page.locator('body').innerText()).not.toContain(planet.g.toFixed(2));
 await setup(page,['Steel ball','Measuring stick (2 m)','Electronic timer']);
 await gateDrops(page,[['PageDown',12],['PageUp',10],['PageUp',10]],5,planet.g);
 const [gv,,dv]=(await page.locator('#f-g').innerText()).split(' ');
 await page.locator('#r-g').fill(gv);await page.locator('#r-dg').fill((Number(dv)*1.5).toPrecision(2));
 await page.getByRole('button',{name:'Submit my result'}).click();
 await expect(page.locator('#result-msg')).toContainText('Answer the “Explain your result” question');
 await page.getByRole('radio',{name:/How precisely I read the drop height/}).check();await page.getByRole('button',{name:'Check my answer'}).click();
 await expect(page.locator('#q-first')).toContainText('recorded for grading');
 await page.getByRole('button',{name:'Submit my result'}).click();
 await expect(page.locator('#result-msg')).toContainText('Submitted');
 await expect(page.getByRole('button',{name:/Reveal/})).toBeHidden();
 const code=await page.locator('#completion-code').innerText();expect(code).toMatch(/^LB-/);expect(code.length).toBeLessThan(60);
 // (the student's own numbers may match g closely; what must never appear is the page stating the planet's g)
 expect(await page.locator('body').innerText()).not.toMatch(/planet’s g is|Planet [A-Z0-9]{4} has/);
 await evidence(page,info,'stage3-student-code');
 expect((await layout(page)).overflow).toBe(false);
 // the code survives a reload
 await page.reload();await expect(page.locator('#completion-code')).toHaveText(code);
 // grading: the key is required; an edited code is refused
 await frozen(page,'/modules/lab-bench/instructor.html');
 await page.getByLabel('Student link for the assignment').fill(link);await page.getByLabel('Grading key').fill('wrong-key-10');
 await page.getByLabel('Completion codes',{exact:true}).fill(`Ann,${code}\nBen,${code.slice(0,-4)}AAAA`);
 await page.getByRole('button',{name:'Grade',exact:true}).click();await expect(page.locator('#g-msg')).toContainText('does not match');
 await page.getByLabel('Grading key').fill(key);await page.getByRole('button',{name:'Grade',exact:true}).click();
 await expect(page.locator('#g-msg')).toContainText('1 student graded');
 await expect(page.locator('#grade-rows tr').first()).toContainText('4 / 4');
 await expect(page.locator('#grade-rows tr').nth(1)).toContainText('Refused');
 await expect(page.getByRole('button',{name:/Download grades/})).toBeEnabled();
 await evidence(page,info,'stage3-grading');
 expect((await layout(page)).overflow).toBe(false);
});
test('Stage 3: graded submission before the minimum asks for confirmation, and the method check then fails',async({page})=>{
 await frozen(page,'/modules/lab-bench/freefall.html?a=qa-lab1b&n=3x5');await page.evaluate(()=>{try{localStorage.clear();}catch{}});await page.reload();
 await page.getByLabel('Your student ID').fill('QA 778');await page.getByRole('button',{name:'Go to my planet'}).click();
 const planet=planetFor('QA 778','qa-lab1b');
 await setup(page,['Steel ball','Measuring stick (2 m)','Electronic timer']);
 await gateDrops(page,[['PageDown',8],['PageUp',12]],2,planet.g);
 await page.locator('#r-g').fill(planet.g.toFixed(2));await page.locator('#r-dg').fill('0.5');
 await page.getByRole('radio',{name:/How precisely I read the drop height/}).check();await page.getByRole('button',{name:'Check my answer'}).click();
 await page.getByRole('button',{name:'Submit my result'}).click();
 await expect(page.locator('#result-msg')).toContainText('Not finished');
 await page.getByRole('button',{name:'Submit anyway'}).click();
 const code=await page.locator('#completion-code').innerText();
 const {decodeSubmission,grade,parseAssignment}=await import('../../modules/lab-bench/grading.js');
 const r=grade(decodeSubmission(code).sub,parseAssignment('?a=qa-lab1b'));
 expect(r.checks.find(c=>c.id==='method').pass).toBe(false);
});
test('Saved assignments: a made link is remembered, fills the grading form after a reload, and can be backed up and removed',async({page})=>{
 await frozen(page,'/modules/lab-bench/instructor.html');await page.evaluate(()=>{try{localStorage.clear();}catch{}});await page.reload();
 await expect(page.locator('#saved-empty')).toBeVisible();
 await page.getByLabel('Assignment code').fill('QA-Saved1');await page.getByRole('button',{name:'Make the link'}).click();
 const link=await page.locator('#made-link').innerText(), key=await page.locator('#made-key').innerText();
 await expect(page.locator('#copy-link-msg')).toContainText('Saved');
 await page.reload();
 await expect(page.locator('#saved-rows tr')).toHaveCount(1);
 await expect(page.locator('#saved-rows tr').first()).toContainText('qa-saved1');
 await expect(page.locator('#saved-rows tr').first()).toContainText(key);
 await expect(page.getByLabel('Student link for the assignment')).toHaveValue('');
 await page.getByRole('button',{name:'Grade qa-saved1'}).click();
 await expect(page.getByLabel('Student link for the assignment')).toHaveValue(link);
 await expect(page.getByLabel('Grading key')).toHaveValue(key);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:/Download backup/}).click();
 const file=await (await download).path();
 await page.getByRole('button',{name:'Remove qa-saved1'}).click();await page.getByRole('button',{name:'Remove qa-saved1'}).click();
 await expect(page.locator('#saved-empty')).toBeVisible();
 await page.locator('#saved-load').setInputFiles(file);
 await expect(page.locator('#saved-msg')).toContainText('Loaded 1 assignment');
 await expect(page.locator('#saved-rows tr')).toHaveCount(1);
 await page.locator('#g-saved').selectOption({index:1});
 await expect(page.getByLabel('Grading key')).toHaveValue(key);
 expect((await layout(page)).overflow).toBe(false);
});
