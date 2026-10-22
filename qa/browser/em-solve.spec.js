import {test,expect,frozen,advance,evidence,layout} from './helpers.js';
import {PROBLEMS} from '../../modules/electromagnetism/solve-problems.js';
import {referenceForce} from '../electrostatics-reference.js';
const route='/modules/electromagnetism/solve.html';
const number=text=>Number(text.replaceAll('−','-').match(/[-+]?\d*\.?\d+/)?.[0]);
// Independent answers (reference physics, not the app's engine) for the number each problem asks for.
const uC=c=>({q:c.uC*1e-6,x:c.x,y:c.y});
const independent={
 S1:{F21:referenceForce(PROBLEMS.S1.charges.map(uC),1).magnitude},
 S2:{Fnet:referenceForce(PROBLEMS.S2.charges.map(uC),1).fx},
 S3:(f=>({Fnet:f.magnitude,angle:Math.atan2(f.fy,f.fx)*180/Math.PI}))(referenceForce(PROBLEMS.S3.charges.map(uC),2)),
 S4:{x:.2},
};
test('E&M Solve it is linked from the Unit 1 nav and the hub',async({page})=>{
 await frozen(page,'/modules/electromagnetism/coulomb.html');
 await page.getByRole('navigation',{name:'Unit 1: Electrostatics'}).getByRole('link',{name:/Solve it/}).click();
 await expect(page.locator('h1')).toContainText('Solve it');
 await frozen(page,'/modules/electromagnetism/index.html');
 await expect(page.getByRole('link',{name:/Solve it · Build the Solution/})).toHaveAttribute('href','solve.html');
});
for(const [id,p] of Object.entries(PROBLEMS))test(`E&M Solve it ${id}: sorting, a flagged mistake with a ghost force, then the correct solution`,async({page},info)=>{
 await frozen(page,route);await page.getByRole('combobox',{name:/^Problem/}).selectOption(id);
 const first=p.quantities.find(q=>q.role==='known');
 await page.getByRole('button',{name:`+ Unknown: ${first.text}`,exact:true}).click();
 await page.getByRole('button',{name:/Check knowns/}).click();await expect(page.locator('#q-summary')).toContainText(/flagged|still/);
 await page.getByRole('button',{name:`Move to knowns: ${first.text}`,exact:true}).click();
 for(const q of p.quantities.filter(q=>q.id!==first.id&&q.role!=='none'))await page.getByRole('button',{name:`Add to ${q.role==='known'?'knowns':'unknowns'}: ${q.text}`,exact:true}).click();
 await page.getByRole('button',{name:/Check knowns/}).click();await expect(page.locator('#q-summary')).toContainText('Step 1 complete');
 // A mistake that changes the physics must be flagged and drawn as a dashed "your F" ghost.
 const wrong=p.blocks.find(b=>!b.correct&&b.effect&&!(b.after||[]).length)||p.blocks.find(b=>!b.correct&&b.effect);
 const order=[],done=new Set(),pending=p.blocks.filter(b=>b.correct);
 while(pending.length){const i=pending.findIndex(b=>(b.after||[]).every(s=>done.has(s)));const b=pending.splice(i,1)[0];order.push(b);done.add(b.step);}
 for(const b of order)await page.getByRole('button',{name:`${(b.step===wrong.step?wrong:b).text}. Add to solution.`,exact:true}).click();
 await page.getByRole('button',{name:/Check & run/}).click();await advance(page,1000);
 await expect(page.locator('#solution .st-misconception')).toHaveCount(1);
 await expect(page.locator('.fv-ghost')).not.toHaveCount(0);await expect(page.locator('#key-ghost')).toBeVisible();
 await evidence(page,info,`${id}-mistake`);
 while(await page.locator('#solution > li').count())await page.getByRole('button',{name:'Remove: step 1',exact:true}).click();
 for(const b of order)await page.getByRole('button',{name:`${b.text}. Add to solution.`,exact:true}).press('Enter');
 await page.getByRole('button',{name:/Check & run/}).click();await advance(page,1000);
 await expect(page.locator('#check-summary')).toContainText('Solved!');
 await expect(page.locator('#score')).toContainText(`Step 2 ${order.length}/${order.length}`);
 await expect(page.locator('.fv-ghost')).toHaveCount(0);
 // Every number in the comparison table matches the independent reference to 0.5 %.
 const rows=page.locator('#compare-body tr');
 for(let i=0;i<await rows.count();i++){
  const cells=rows.nth(i).locator('td');await expect(cells.nth(1)).toContainText('✓');
  const yours=number(await cells.nth(1).innerText()),physics=number(await cells.nth(2).innerText());
  expect(Math.abs(yours-physics)).toBeLessThanOrEqual(.005*Math.abs(physics)+.001);
 }
 for(const [key,value] of Object.entries(independent[id])){
  const b=order.find(x=>x.answer?.key===key);expect(b,`${id} states ${key}`).toBeTruthy();
  expect(Math.abs(b.answer.value-value)).toBeLessThanOrEqual(.005*Math.abs(value));
 }
 expect(await page.locator('body').innerText()).not.toMatch(/\bNaN\b|\bInfinity\b|undefined/);
 expect((await layout(page)).overflow).toBe(false);
 await evidence(page,info,`${id}-solved`);
});
