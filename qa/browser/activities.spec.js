import {test,expect,frozen,advance,evidence} from './helpers.js';
import {PROBLEMS} from '../../modules/newtons-laws/solve-problems.js';
test('Solve it reveal gates, two-click confirmation and retry',async({page},info)=>{
 await frozen(page,'/modules/newtons-laws/solve.html');
 await expect(page.locator('#reveal-q')).toBeDisabled();
 await page.getByRole('button',{name:'Add to unknowns: m = 4.0 kg',exact:true}).click();
 await page.locator('#check-q').click();await page.locator('#check-q').click();
 await page.locator('#reveal-q').click();await expect(page.locator('#reveal-q')).toContainText('Click again');await page.locator('#reveal-q').click();
 await expect(page.locator('#score')).toContainText('Step 1 revealed');
 const block=page.locator('#bank button').first();await block.click();
 await page.locator('#check').click();await page.locator('#check').click();
 await page.locator('#reveal').click();await page.locator('#reveal').click();await advance(page,7000);
 await expect(page.locator('#score')).toContainText('Step 2 revealed');await evidence(page,info,'revealed');
 await page.getByRole('button',{name:/Try again/}).click();await expect(page.locator('#solution > li')).toHaveCount(0);
 await expect(page.locator('#score')).toContainText('solution was revealed earlier');
});
for(const [id,p] of Object.entries(PROBLEMS))test(`Solve it ${id} sorting, wrong response, correct blocks and simulation`,async({page},info)=>{
 await frozen(page,'/modules/newtons-laws/solve.html');await page.getByRole('combobox',{name:/^Problem/}).selectOption(id);
 // Tap/click and keyboard alternatives exercise the same accessible controls used on tablets.
 const first=p.quantities.find(q=>q.role==='known');
 await page.getByRole('button',{name:`Add to unknowns: ${first.text}`,exact:true}).click();
 await page.getByRole('button',{name:/Check knowns/}).click();await expect(page.locator('#q-summary')).toContainText(/flagged|still/);
 await evidence(page,info,'incorrect-sort');
 await page.getByRole('button',{name:`Move to knowns: ${first.text}`,exact:true}).click();
 for(const q of p.quantities.filter(q=>q.id!==first.id&&q.role!=='none'))await page.getByRole('button',{name:`Add to ${q.role==='known'?'knowns':'unknowns'}: ${q.text}`,exact:true}).click();
 await page.getByRole('button',{name:/Check knowns/}).click();await expect(page.locator('#q-summary')).toContainText('Step 1 complete');
 const wrong=p.blocks.find(b=>!b.correct);await page.getByRole('button',{name:`${wrong.text}. Add to solution.`,exact:true}).click();
 await page.getByRole('button',{name:/Check & run/}).click();await advance(page,250);
 await expect(page.locator('#check-summary')).toBeVisible();await evidence(page,info,'incorrect-block');
 await page.getByRole('button',{name:'Remove: step 1',exact:true}).click();
 const remaining=p.blocks.filter(b=>b.correct),done=new Set();
 while(remaining.length){const i=remaining.findIndex(b=>(b.after||[]).every(s=>done.has(s)));expect(i).toBeGreaterThanOrEqual(0);const b=remaining.splice(i,1)[0];await page.getByRole('button',{name:`${b.text}. Add to solution.`,exact:true}).press('Enter');done.add(b.step);}
 await page.getByRole('button',{name:/Check & run/}).click();await advance(page,22000);
 await expect(page.locator('#check-summary')).toContainText(/correct|complete|solved/i);
 await expect(page.locator('#compare')).toBeVisible();await evidence(page,info,'completed');
});

test('builder JSON download/load round trip, invalid file and detailed-editor handoff',async({page},info)=>{
 await frozen(page,'/modules/newtons-laws/build.html');
 await page.locator('#sample').selectOption('pallet');
 await page.getByLabel('Title',{exact:true}).fill('QA pallet round trip');
 const original=await page.getByRole('textbox',{name:/^Problem statement/}).inputValue();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'⬇ Download .json',exact:true}).click();
 const d=await pending,path=await d.path();
 await page.getByLabel('Title',{exact:true}).fill('Changed');
 const chooserPromise=page.waitForEvent('filechooser');await page.locator('label.solve-file').click();await (await chooserPromise).setFiles(path);
 await expect(page.locator('#open-note')).toContainText('exactly as it was saved');
 await expect(page.getByLabel('Title',{exact:true})).toHaveValue('QA pallet round trip');
 await expect(page.getByRole('textbox',{name:/^Problem statement/})).toHaveValue(original);
 await page.locator('#open-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
 await expect(page.locator('#open-note')).toContainText('not a Solve it problem');
 await evidence(page,info,'builder-loaded');
 await page.getByRole('button',{name:/Fine-tune in the detailed editor/}).click();
 await expect(page).toHaveURL(/author.html/);await expect(page.locator('h1')).toHaveText('Detailed problem editor');
});

test('detailed editor templates, JSON download and student shared link',async({page})=>{
 await frozen(page,'/modules/newtons-laws/author.html');
 for(const id of ['S1','S2','S3','S4']){
  await page.getByRole('combobox',{name:/^Start from/}).selectOption(id);
  await advance(page,200);await expect(page.locator('#share-link')).toHaveValue(/#p=/);
  await expect(page.locator('#download')).toBeEnabled();
  const link=await page.locator('#share-link').inputValue();expect(link).toContain('#p=');
 }
 const link=await page.locator('#share-link').inputValue();await page.goto(link);
 await expect(page.locator('#problem-title')).toContainText(/pallet/i);
});
