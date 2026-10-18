import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITIES, ACTIVITY_IDS, activitySettings, activityFeedback } from '../modules/variable-forces/activities.js';
import { createDragModel } from '../js/core/drag-physics.js';
import { createOscillatorModel } from '../js/core/oscillator-physics.js';
import { integrate } from '../js/core/integrators.js';

const make = (a, s) => a.scenario === 'drag' ? createDragModel(s) : createOscillatorModel(s);

test('every activity builds valid models for every choice and names a correct choice', () => {
  assert.deepEqual(ACTIVITY_IDS, ['V1', 'V2', 'V3', 'V4']);
  for (const id of ACTIVITY_IDS) {
    const a = ACTIVITIES[id];
    assert.ok(a.choices.some(c => c.id === a.correct));
    for (const c of a.choices) { make(a, activitySettings(id, c.id)); if (c.id !== a.correct) assert.ok(a.misconceptions[c.id], `${id}${c.id}`); }
    assert.equal(activityFeedback(id, a.correct).correct, true);
  }
});

test('V3 numbers stated in the activity text hold', () => {
  const at = b => createOscillatorModel(activitySettings('V3', { 4: 'A', 8: 'B', 16: 'C' }[b]));
  assert.equal(at(8).regime, 'critical'); assert.equal(at(4).regime, 'underdamped'); assert.equal(at(16).regime, 'overdamped');
  assert.ok(Math.min(...Array.from({ length: 300 }, (_, i) => at(4).at(i / 100).x)) < 0);
  const x2 = at(16).at(2).x; assert.ok(x2 > 0.05 && x2 < 0.08, `b=16 at 2 s: ${x2}`);
  assert.ok(Math.abs(at(8).at(2).x) < 0.01);
});

test('V4: Euler energy grows by 1 + (ωh)² = 1.16 per step', () => {
  const a = ACTIVITIES.V4, m = createOscillatorModel(a.settings);
  const out = integrate('euler', m.deriv, m.initial, a.numerical.h, 1);
  const e = out.map(p => m.energy([p.x, p.v]));
  for (let i = 1; i < e.length; i++) assert.ok(Math.abs(e[i] / e[i - 1] - 1.16) < 1e-9);
});
