import {test,expect,frozen,start,advance,evidence} from './helpers.js';
import {freeScenarios} from '../manifest.js';
import {free} from './helpers.js';
for(const lab of freeScenarios)test(`content: finite readouts and explicit SI units ${lab.id}`,async({page},info)=>{
 await frozen(page,lab.path);await free(page,lab);await start(page);await advance(page,512);
 await page.locator('#pause').click();
 if(lab.id==='third'){
  await expect(page.locator('#time')).toHaveText(/^\d+(?:\.\d+)? s$/);
 }else{
  const units=['first','second'].includes(lab.id)
   ?{time:'s',position:'m',speed:'m/s',acceleration:'m/s²'}
   :lab.id==='circle'?{'r-t':'s','r-v':'m/s','r-a':'m/s²','r-F':'N'}
   :{'r-t':'s','r-x':'m','r-v':'m/s','r-a':'m/s²'};
  for(const [id,unit] of Object.entries(units)){
   const output=page.locator(`#${id}`),text=(await output.innerText()).trim();
   expect(text,`${id} must contain a numerical measurement`).toMatch(/^-?\d+(?:\.\d+)?$/);
   expect(Number.isFinite(Number(text)),`${id} must be finite`).toBe(true);
   await expect(output.locator('..').locator('small')).toHaveText(unit);
  }
 }
 const rendered=await page.locator('body').innerText();
 expect(rendered).not.toMatch(/\b(?:NaN|Infinity|undefined|TODO|FIXME|Lorem ipsum)\b|\[object Object\]|�/);
 await evidence(page,info,'units-and-content');
});
test('content: quadratic terminal-speed equation stays constant',async({page},info)=>{
 await frozen(page,'/modules/variable-forces/index.html');
 await page.getByLabel('Drag law',{exact:true}).selectOption('quadratic');
 for(const id of ['d-force','d-v0']){await page.locator(`#${id}`).press('Home');for(let i=0;i<4;i++)await page.locator(`#${id}`).press('ArrowRight');}
 // F=2 N, c=.5 kg/m, v0=2 m/s: F-c*v0²=0, hence v(t)=2 for all t.
 await start(page);await advance(page,512);await page.locator('#pause').click();
 await expect(page.locator('#r-v')).toHaveText('2.00');await expect(page.locator('#r-a')).toHaveText('0.00');
 await evidence(page,info,'terminal-equation');
 expect(await page.locator('#math-solution').innerText(),'A terminal-speed solution must not multiply speed by t/tau + phi').not.toMatch(/·\s*\(t\/|φ/);
});
test('content: oscillator solution defines its integration constants',async({page},info)=>{
 await frozen(page,'/modules/variable-forces/index.html');await page.getByRole('button',{name:'Spring and damper',exact:true}).click();
 await evidence(page,info,'oscillator-symbols');
 const text=await page.locator('#math-body').innerText();
 expect.soft(text,'A should be defined in the displayed solution').toMatch(/A\s*=|A (?:and B )?(?:are|is|denotes)/);
 expect.soft(text,'B should be defined in the displayed solution').toMatch(/B\s*=|(?:A and )?B (?:are|is|denotes)/);
});
