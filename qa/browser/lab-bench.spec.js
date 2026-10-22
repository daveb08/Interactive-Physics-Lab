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
