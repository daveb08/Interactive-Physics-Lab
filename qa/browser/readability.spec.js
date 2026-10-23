import {test,expect,open} from './helpers.js';

const SECOND='/modules/newtons-laws/index.html';
const wide=test=>test.skip(({viewport})=>viewport.width<1201,'graph column resizes on wide screens only');

test('text-size control scales page text and is remembered',async({page})=>{
 await open(page,SECOND);
 const body=()=>page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize));
 expect(await body()).toBe(15);
 await page.getByRole('button',{name:'A++ extra-large text',exact:true}).click();
 await expect(page.getByRole('button',{name:'A++ extra-large text',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(await body()).toBeCloseTo(19.5,1);
 await page.reload();
 expect(await body()).toBeCloseTo(19.5,1);
 const over=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
 expect(over).toBe(false);
});

test.describe('graph column',()=>{
 wide(test);
 test('buttons and keyboard widen and narrow the graphs',async({page})=>{
  await open(page,SECOND);
  const width=()=>page.locator('.graphs').evaluate(e=>e.getBoundingClientRect().width);
  const start=await width();
  await page.getByRole('button',{name:'Wider graphs',exact:true}).click();
  expect(await width()).toBeGreaterThan(start+60);
  const handle=page.getByRole('separator',{name:/Resize motion graphs/});
  await handle.focus();await page.keyboard.press('Home');
  expect(await width()).toBeLessThan(start);
  await page.keyboard.press('End');
  const sim=await page.locator('.simulation').evaluate(e=>e.getBoundingClientRect().width);
  expect(sim).toBeGreaterThanOrEqual(319);
 });
 test('dragging the handle resizes the column',async({page})=>{
  await open(page,SECOND);
  await page.locator('.graphs').scrollIntoViewIfNeeded();
  await page.evaluate(()=>window.scrollTo(0,document.querySelector('.graphs').getBoundingClientRect().top+scrollY-20));
  const box=await page.locator('.column-resizer span').boundingBox();
  const before=await page.locator('.graphs').evaluate(e=>e.getBoundingClientRect().width);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x-150,box.y+box.height/2,{steps:5});await page.mouse.up();
  const after=await page.locator('.graphs').evaluate(e=>e.getBoundingClientRect().width);
  expect(after).toBeGreaterThan(before+120);
 });
});

test('forces on the cart and the free-body diagram (free exploration)',async({page})=>{
 await open(page,SECOND);
 await page.getByLabel('Enable Friction').check();
 await page.locator('#show-forces-object').check();
 await expect(page.locator('#cart-scene .forces-on-object .fd-friction')).toHaveCount(1); // at rest: static friction balances the 6 N push
 await page.locator('#show-fbd').check();
 await expect(page.locator('#fbd-panel')).toBeVisible();
 for(const key of ['applied','friction','normal','weight'])await expect(page.locator(`#fbd .fd-${key}`)).toHaveCount(1);
 await expect(page.locator('#fbd')).toHaveAttribute('aria-label',/static friction, 6\.0 newtons to the left.*net force zero/i);
 await page.locator('#show-force-values').check();
 await expect(page.locator('#fbd')).toContainText('= 19.6 N');
 // The old applied-force arrow is replaced while forces are drawn on the cart.
 await expect(page.locator('#force-arrow')).toBeHidden();
});

test('guided experiments keep forces hidden until a prediction is saved',async({page})=>{
 await open(page,SECOND);
 await page.getByRole('button',{name:'Guided Experiments',exact:true}).click();
 await expect(page.locator('#show-fbd')).toBeDisabled();
 await expect(page.locator('#force-options-note')).toContainText('Save your prediction');
 await page.locator('#guided-choices input').first().check();
 await page.locator('#guided-save').click();
 await expect(page.locator('#show-fbd')).toBeEnabled();
 await page.locator('#show-fbd').check();
 await expect(page.locator('#fbd-panel')).toBeVisible();
});
