import test from 'node:test';
import assert from 'node:assert/strict';
import { integrate } from '../js/core/integrators.js';
import { createOscillatorModel } from '../js/core/oscillator-physics.js';
import { createDragModel } from '../js/core/drag-physics.js';
import { sampleGrid } from '../js/core/variable-run.js';
import { buildCsv } from '../js/components/csv-export.js';

const errAt = (method, model, h, t) => Math.abs(integrate(method, model.deriv, model.initial, h, t).at(-1).x - model.at(t).x);

test('convergence order: halving h cuts Euler error ~2× and RK4 error ~16×', () => {
  const m = createOscillatorModel({ mass: 1, k: 16, b: 1, x0: 0.5, v0: 0 });
  const euler = errAt('euler', m, 0.002, 2) / errAt('euler', m, 0.001, 2);
  const rk4 = errAt('rk4', m, 0.02, 2) / errAt('rk4', m, 0.01, 2);
  assert.ok(euler > 1.8 && euler < 2.2, `Euler ratio ${euler}`);
  assert.ok(rk4 > 14 && rk4 < 18, `RK4 ratio ${rk4}`);
});

test('semi-implicit Euler is first order but bounded in energy; explicit Euler gains energy', () => {
  const m = createOscillatorModel({ mass: 1, k: 16, b: 0, x0: 0.5, v0: 0 });
  const energy = s => m.energy([s.x, s.v]);
  const euler = integrate('euler', m.deriv, m.initial, 0.1, 20);
  const semi = integrate('semiImplicit', m.deriv, m.initial, 0.1, 20);
  // V4: explicit Euler multiplies energy by (1 + (ωh)²) every step for an undamped spring.
  for (let i = 1; i < euler.length; i++) assert.ok(energy(euler[i]) > energy(euler[i - 1]));
  assert.ok(Math.abs(energy(euler[1]) / m.e0 - (1 + (4 * 0.1) ** 2)) < 1e-12);
  assert.ok(Math.max(...semi.map(energy)) < 1.3 * m.e0 && Math.min(...semi.map(energy)) > 0.7 * m.e0);
});

test('integrate lands exactly on the end time with a shortened last step', () => {
  const m = createDragModel({ law: 'linear', mass: 2, force: 6, b: 2, v0: 0 });
  const out = integrate('rk4', m.deriv, m.initial, 0.2, 1.05);
  assert.equal(out.at(-1).t, 1.05);
  assert.throws(() => integrate('leapfrog', m.deriv, m.initial, 0.1, 1), RangeError);
});

test('sampleGrid and CSV: header with units, one row per exact sample', () => {
  const m = createDragModel({ law: 'linear', mass: 2, force: 6, b: 2, v0: 0 });
  const samples = sampleGrid(m, 0.01);
  assert.equal(samples.length, 1001);
  const csv = buildCsv(samples, [{ key: 't', label: 't', unit: 's' }, { key: 'x', label: 'x', unit: 'm' }, { key: 'v', label: 'v', unit: 'm/s' }],
    [{ column: { label: 'x_euler', unit: 'm' }, values: samples.map(s => s.x * 2) }]);
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 't (s),x (m),v (m/s),x_euler (m)');
  assert.equal(lines.length, 1002);
  const [t, x, v, xe] = lines[500].split(',').map(Number);
  assert.ok(Math.abs(t - 4.99) < 1e-9 && Math.abs(x - m.at(t).x) < 1e-7 && Math.abs(v - m.at(t).v) < 1e-7 && Math.abs(xe - 2 * x) < 1e-7);
});
