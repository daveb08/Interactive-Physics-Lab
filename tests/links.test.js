import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hrefs = page => [...readFileSync(join(root, page), 'utf8').matchAll(/href="([^"#:]+)"/g)].map(m => m[1]);

for (const page of ['index.html', 'modules/electromagnetism/index.html', 'modules/electromagnetism/coulomb.html', 'modules/electromagnetism/solve.html', 'modules/electromagnetism/build.html', 'modules/circular-motion/index.html', 'modules/circular-motion/uniform.html']) {
  test(`${page}: every local link points at an existing file (no bare directory links)`, () => {
    for (const href of hrefs(page)) {
      assert.ok(!href.endsWith('/'), `${href} is a directory link; static hosts need an explicit file`);
      assert.ok(existsSync(join(root, dirname(page), href)), `${href} does not exist`);
    }
  });
}

test('Electromagnetism hub lists the 11 topics E1–E11', () => {
  const html = readFileSync(join(root, 'modules/electromagnetism/index.html'), 'utf8');
  const ids = [...html.matchAll(/class="module-number">(E\d+)</g)].map(m => m[1]);
  assert.deepEqual(ids, Array.from({ length: 11 }, (_, i) => `E${i + 1}`));
});

test('Circular Motion hub lists C1–C9 and links the C1 lab', () => {
  const html = readFileSync(join(root, 'modules/circular-motion/index.html'), 'utf8');
  const ids = [...html.matchAll(/class="module-number">(C\d+)</g)].map(m => m[1]);
  assert.deepEqual(ids, Array.from({ length: 9 }, (_, i) => `C${i + 1}`));
  assert.ok(hrefs('modules/circular-motion/index.html').includes('uniform.html'));
});

test('Electromagnetism hub links the E1 Coulomb lab; Unit 1 nav lists E1–E4', () => {
  assert.ok(hrefs('modules/electromagnetism/index.html').includes('coulomb.html'));
  const html = readFileSync(join(root, 'modules/electromagnetism/coulomb.html'), 'utf8');
  const nav = html.match(/<nav class="law-nav"[^]*?<\/nav>/)[0];
  assert.deepEqual([...nav.matchAll(/<b>(E\d)<\/b>/g)].map(m => m[1]), ['E1', 'E2', 'E3', 'E4']);
  assert.ok(nav.includes('href="solve.html"'), 'Unit 1 nav links Solve it');
  assert.ok(hrefs('modules/electromagnetism/index.html').includes('solve.html'), 'hub links Solve it');
});
