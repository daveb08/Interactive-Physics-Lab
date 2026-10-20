import {test,expect,frozen,guided,advance} from './helpers.js';
test('visual E1 exploration, running, completed, incorrect and charging states',async({page})=>{
 await frozen(page,'/modules/electromagnetism/coulomb.html');
 await expect(page).toHaveScreenshot('E1-free.png',{fullPage:true});
 await guided(page,{},'C1',0);await page.locator('#start').click();await advance(page,160);
 await expect(page).toHaveScreenshot('E1-running.png',{fullPage:true});
 await advance(page,3500);await expect(page.locator('#run-status')).toHaveText('Finished');
 await expect(page).toHaveScreenshot('E1-incorrect-completed.png',{fullPage:true});
 await page.getByRole('button',{name:'Induction',exact:true}).click();
 await page.locator('#step-next').click();await page.locator('#step-next').click();
 await expect(page).toHaveScreenshot('E1-induction-grounded.png',{fullPage:true});
 // E1 has no pause/resume UI: its guided scans run to completion, and free
 // exploration is a live static configuration. Do not invent a paused state.
});
