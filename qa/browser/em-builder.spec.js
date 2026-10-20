import {test,expect,frozen,advance,evidence,layout} from './helpers.js';
import {referenceForce} from '../electrostatics-reference.js';
const route='/modules/electromagnetism/build.html';
const number=text=>Number(text.replaceAll('−','-').match(/[-+]?\d*\.?\d+/)?.[0]);
test('E&M builder: Solve it links to it; samples, editing and the answers match the independent reference',async({page},info)=>{
 await frozen(page,'/modules/electromagnetism/solve.html');
 await expect(page.getByRole('link',{name:/Create your own problem/})).toHaveAttribute('href','build.html');
 await frozen(page,route);
 await page.evaluate(()=>{try{localStorage.clear();}catch{}});await page.reload();
 await page.getByLabel('Start from').selectOption('S3');
 const ref=referenceForce([{q:4e-6,x:.30,y:0},{q:-6e-6,x:0,y:.40},{q:2e-6,x:0,y:0}],2);
 const rows=page.locator('#answers tr');
 await expect(rows.filter({hasText:'|F_net|'}).locator('td')).toHaveText(/1\.05 N/);
 expect(Math.abs(number(await rows.filter({hasText:'|F_net|'}).locator('td').innerText())-ref.magnitude)).toBeLessThan(.006);
 await expect(page.locator('#steps > li')).toHaveCount(5);
 // keyboard move: q2 one step right changes the answers
 const before=await page.locator('#answers').innerText();
 const q2=page.getByRole('button',{name:/^Charge q2,/});await q2.press('ArrowRight');
 await expect(page.locator('#answers')).not.toHaveText(before);
 // four charges, then the balance type
 await page.getByRole('group',{name:'How many charges'}).getByRole('button',{name:'4',exact:true}).click();
 await expect(page.locator('#steps > li')).toHaveCount(6);
 await page.getByRole('button',{name:'Balance point',exact:true}).click();
 await expect(page.locator('#answers')).toContainText('Position x of q₃');
 await page.getByLabel('Start from').selectOption('S4');
 await expect(page.locator('#answers td')).toHaveText('0.200 m');
 expect(await page.locator('body').innerText()).not.toMatch(/\bNaN\b|\bInfinity\b|undefined/);
 expect((await layout(page)).overflow).toBe(false);
 await evidence(page,info,'builder-S4');
});
test('E&M builder: overlapping charges are refused and the last valid problem is kept',async({page})=>{
 await frozen(page,route);
 await page.getByLabel('Start from').selectOption('S1');
 await page.getByLabel('x (m)').fill('0.58');await page.getByLabel('x (m)').press('Enter');
 await expect(page.locator('#open-note')).toContainText('closer than 4 cm');
 await expect(page.locator('#preview')).toBeEnabled();
});
test('E&M builder: the student link opens the custom problem in Solve it, and it can be solved',async({page},info)=>{
 await frozen(page,route);
 await page.getByLabel('Start from').selectOption('S2');
 await page.getByLabel('Title').fill('Quiz 3: charges in a line');
 const link=await page.locator('#share-link').inputValue();
 expect(link).toMatch(/solve\.html#s=e/);
 await frozen(page,link.replace(/^https?:\/\/[^/]+/,''));
 await expect(page.locator('#problem-title')).toHaveText('Quiz 3: charges in a line');
 await expect(page.getByRole('combobox',{name:/^Problem/})).toContainText('★ Quiz 3');
 // Step 1 via the reveal path (after two tries), then the reveal for Step 2.
 await page.locator('#qbank button').first().click();
 for(let i=0;i<2;i++)await page.locator('#check-q').click();
 await page.locator('#reveal-q').click();await page.locator('#reveal-q').click();
 await expect(page.locator('#score')).toContainText('Step 1 revealed');
 await page.locator('#bank .block').first().click();
 for(let i=0;i<2;i++)await page.locator('#check').click();
 await page.locator('#reveal').click();await page.locator('#reveal').click();
 await expect(page.locator('#score')).toContainText('Step 2 revealed');await advance(page,1000);
 await expect(page.locator('#compare')).toBeVisible();
 await expect(page.locator('#compare-body')).toContainText('−0.150 N');
 await evidence(page,info,'shared-solved');
});
