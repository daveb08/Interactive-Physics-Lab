import test from 'node:test';
import assert from 'node:assert/strict';
import { createDragModel, DRAG_DEFAULTS } from '../js/core/drag-physics.js';
import { createRun, stepRun } from '../js/core/physics.js';
import { integrate } from '../js/core/integrators.js';
import { createVariableRun, stepVariableRun } from '../js/core/variable-run.js';

const near = (a, e, eps = 1e-9, msg = '') => assert.ok(Math.abs(a - e) <= eps, `${msg} ${a} ≠ ${e} (±${eps})`);

/** Central differences: dx/dt = v and dv/dt = a. */
function residual(model, t, h = 1e-5) {
  const p = model.at(t + h), q = model.at(t - h), s = model.at(t);
  return [Math.abs((p.x - q.x) / (2 * h) - s.v), Math.abs((p.v - q.v) / (2 * h) - s.a)];
}

const grid = [];
for (const law of ['linear', 'quadratic'])
  for (const mass of [1, 4, 10]) for (const force of [0, 3, 20]) for (const v0 of [0, 2, 10])
    for (const coef of law === 'linear' ? [0.1, 1, 5] : [0.05, 0.5, 2])
      grid.push({ law, mass, force, v0, [law === 'linear' ? 'b' : 'c']: coef });

test('exact drag solutions satisfy the ODE across the parameter grid', () => {
  for (const s of grid) {
    const m = createDragModel(s);
    for (const t of [0.05, 0.5, 1.7, 4]) {
      if (t + 1e-5 > m.endTime) continue;
      const [rx, rv] = residual(m, t);
      assert.ok(rx < 1e-6 && rv < 1e-6, `${JSON.stringify(s)} t=${t}: ${rx}, ${rv}`);
    }
  }
});

test('exact drag solutions match RK4 at h = 1e-4', () => {
  for (const s of grid.filter((_, i) => i % 9 === 0)) {
    const m = createDragModel(s), tEnd = Math.min(3, m.endTime);
    const last = integrate('rk4', m.deriv, m.initial, 1e-4, tEnd).at(-1), ex = m.at(tEnd);
    near(last.x, ex.x, 1e-8, JSON.stringify(s)); near(last.v, ex.v, 1e-8, JSON.stringify(s));
  }
});

test('initial conditions: x = 0 and v = v0 at t = 0', () => {
  for (const s of grid) { const p = createDragModel(s).at(0); near(p.x, 0, 1e-12); near(p.v, s.v0, 1e-12); }
});

test('V1: linear drag approaches terminal speed F/b = 3 m/s with τ = m/b = 1 s', () => {
  const m = createDragModel({ law: 'linear', mass: 2, force: 6, b: 2, v0: 0 });
  near(m.vT, 3); near(m.tau, 1);
  near(m.at(1).v, 3 * (1 - Math.exp(-1)), 1e-12);   // 63% of the approach at t = τ
  assert.ok(Math.abs(m.at(10).v - 3) < 1e-3);
});

test('V2: doubling the mass keeps v_T and doubles τ', () => {
  const a = createDragModel({ law: 'linear', mass: 2, force: 6, b: 2, v0: 0 });
  const b = createDragModel({ law: 'linear', mass: 4, force: 6, b: 2, v0: 0 });
  near(b.vT, a.vT); near(b.tau, 2 * a.tau);
  near(b.at(2 * a.tau).v, a.at(a.tau).v, 1e-12);
});

test('quadratic drag: terminal speed √(F/c), approached from below and above', () => {
  for (const v0 of [0, 1, 6, 10]) {
    const m = createDragModel({ law: 'quadratic', mass: 2, force: 8, c: 0.5, v0 }, { track: { min: -1e9, max: 1e9 } });
    near(m.vT, 4);
    assert.ok(Math.abs(m.at(10).v - 4) < 1e-3, `v0=${v0}`);
    if (v0 < 4) assert.ok(m.at(1).v < 4); if (v0 > 4) assert.ok(m.at(1).v > 4);
  }
  const steady = createDragModel({ law: 'quadratic', mass: 2, force: 8, c: 0.5, v0: 4 });
  near(steady.at(2).v, 4); near(steady.at(2).x, 8);
});

test('quadratic coasting: v = v0/(1 + c v0 t/m)', () => {
  const m = createDragModel({ law: 'quadratic', mass: 2, force: 0, c: 0.5, v0: 8 });
  near(m.at(1).v, 8 / 3, 1e-12); near(m.at(1).x, 4 * Math.log(3), 1e-12);
});

test('as drag vanishes, motion approaches the constant-acceleration engine', () => {
  const lin = createDragModel({ law: 'linear', mass: 2, force: 6, b: 1e-4, v0: 1 }, { validate: false, track: { min: -1e9, max: 1e9 } });
  const quad = createDragModel({ law: 'quadratic', mass: 2, force: 6, c: 1e-7, v0: 1 }, { validate: false, track: { min: -1e9, max: 1e9 } });
  const run = createRun({ mass: 2, force: 6, velocity: 1 });
  while (!run.done) stepRun(run);
  const t = run.state.t;
  for (const m of [lin, quad]) { near(m.at(t).v, run.state.v, 1e-2); near(m.at(t).x, run.state.x, 1e-2); }
});

test('boundary: observation ends exactly where x reaches +50 m', () => {
  const m = createDragModel({ law: 'linear', mass: 1, force: 20, b: 0.1, v0: 10 });
  assert.equal(m.reason, 'boundary');
  near(m.at(m.endTime).x, 50, 1e-9);
  assert.ok(m.endTime < 10);
  assert.equal(createDragModel(DRAG_DEFAULTS).reason, 'duration');
});

test('a variable run steps to the end time with exact samples', () => {
  const m = createDragModel(DRAG_DEFAULTS), run = createVariableRun(m);
  while (!run.done) stepVariableRun(run);
  near(run.state.t, m.endTime, 1e-12);
  for (const s of run.samples.filter((_, i) => i % 97 === 0)) near(s.x, m.at(s.t).x, 1e-12);
});

test('rejects settings outside the restricted ranges', () => {
  assert.throws(() => createDragModel({ ...DRAG_DEFAULTS, force: -1 }), RangeError);
  assert.throws(() => createDragModel({ ...DRAG_DEFAULTS, v0: -1 }), RangeError);
  assert.throws(() => createDragModel({ ...DRAG_DEFAULTS, law: 'cubic' }), RangeError);
  assert.throws(() => createDragModel({ ...DRAG_DEFAULTS, b: 0 }), RangeError);
});
