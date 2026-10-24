import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAssignments, parseBackup, backupText, labForLink } from '../modules/lab-bench/saved-assignments.js';

const rec = (code, created, extra = {}) => ({ code, lab: 'freefall', link: `https://x.io/modules/lab-bench/freefall.html?a=${code}`, key: 'amber-orbit-42', settings: 's', created, ...extra });

test('saved assignments: newest first, same lab and code replaced by the newer record, junk dropped', () => {
  const list = mergeAssignments([rec('lab1', '2026-10-01T10:00:00Z')], [rec('lab1b', '2026-10-05T10:00:00Z'), rec('lab1', '2026-10-09T10:00:00Z', { key: 'new-key-11' }), { code: '' }, null, 'x']);
  assert.deepEqual(list.map(r => r.code), ['lab1', 'lab1b']);
  assert.equal(list[0].key, 'new-key-11');
});

test('saved assignments: the lab comes from the link', () => {
  assert.equal(labForLink('https://a.b/modules/lab-bench/freefall.html?a=x').id, 'freefall');
  assert.equal(labForLink('https://a.b/modules/lab-bench/projectile.html?a=x').id, 'projectile');
});

test('backups: round trip, and anything else is refused with a readable message', () => {
  const list = [rec('lab1', '2026-10-01T10:00:00Z')];
  assert.deepEqual(parseBackup(backupText(list)), list);
  assert.throws(() => parseBackup('not json'), /not a saved-assignments backup/);
  assert.throws(() => parseBackup('{"hello":1}'), /not a saved-assignments backup/);
  assert.throws(() => parseBackup('{"assignments":[]}'), /no assignments/);
});
