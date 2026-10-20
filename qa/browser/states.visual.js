import {test,expect,frozen,free,start,advance,guided,complete} from './helpers.js';
import {freeScenarios,routes} from '../manifest.js';
for(const path of routes.filter(p=>!freeScenarios.some(l=>l.path===p)))test(`visual page ${path}`,async({page})=>{
 await frozen(page,path);
 // The approved E1 feature changes the hub from planned to available. Keep the
 // original reference files intact and compare against a separately named state.
 const snapshot=path==='/modules/electromagnetism/index.html'?'electromagnetism-hub-e1-available.png':`${path.replaceAll('/','-')}.png`;
 await expect(page).toHaveScreenshot(snapshot,{fullPage:true});
});
for(const lab of freeScenarios)test(`visual states ${lab.id}`,async({page})=>{
 await frozen(page,lab.path);
 await expect(page).toHaveScreenshot(`${lab.id}-initial.png`,{fullPage:true});
 await free(page,lab);await expect(page).toHaveScreenshot(`${lab.id}-free.png`,{fullPage:true});
 await start(page);await advance(page,320);
 await expect(page).toHaveScreenshot(`${lab.id}-running.png`,{fullPage:true});
 await page.locator('#pause').click();await expect(page).toHaveScreenshot(`${lab.id}-paused.png`,{fullPage:true});
 if(lab.activities){
  await page.locator('#reset').click();
  // All first activities have B as correct except U1 (A).
  await guided(page,lab,lab.activities[0],lab.id==='circle'?1:0);await complete(page,lab);
  await expect(page).toHaveScreenshot(`${lab.id}-incorrect-completed.png`,{fullPage:true});
 }
});
