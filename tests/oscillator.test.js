import test from 'node:test';
import assert from 'node:assert/strict';
import { createOscillatorModel, criticalDamping, regimeOf, OSC_DEFAULTS } from '../js/core/oscillator-physics.js';
import { integrate } from '../js/core/integrators.js';

const near = (a, e, eps = 1e-9, msg = '') => assert.ok(Math.abs(a - e) <= eps, `${msg} ${a} ≠ ${e} (±${eps})`);

const grid = [];
for (const mass of [0.5, 1, 10]) for (const k of [1, 16, 50]) for (const x0 of [-1, 0.5]) for (const v0 of [0, -3, 2])
  for (const frac of [0, 0.3, 1, 2.5]) grid.push({ mass, k, x0, v0, b: Math.min(20, frac * criticalDamping(mass, k)) });

test('exact oscillator solutions satisfy the ODE in every regime', () => {
  for (const s of grid) {
    const m = createOscillatorModel(s), h = 1e-5;
    for (const t of [0.1, 1.3, 5, 12]) {
      const p = m.at(t + h), q = m.at(t - h), c = m.at(t);
      const rx = Math.abs((p.x - q.x) / (2 * h) - c.v), rv = Math.abs((p.v - q.v) / (2 * h) - c.a);
      assert.ok(rx < 1e-6 && rv < 1e-6, `${JSON.stringify(s)} (${m.regime}) t=${t}: ${rx}, ${rv}`);
    }
    near(m.at(0).x, s.x0, 1e-12); near(m.at(0).v, s.v0, 1e-12);
  }
});

test('exact oscillator solutions match RK4 at h = 1e-4', () => {
  for (const s of grid.filter((_, i) => i % 7 === 0)) {
    const m = createOscillatorModel(s), last = integrate('rk4', m.deriv, m.initial, 1e-4, 5).at(-1), ex = m.at(5);
    near(last.x, ex.x, 1e-8, JSON.stringify(s)); near(last.v, ex.v, 1e-8, JSON.stringify(s));
  }
});

test('regimes are classified from ζ = b / (2√(km))', () => {
  const base = { mass: 1, k: 16, x0: 0.5, v0: 0 };
  assert.equal(createOscillatorModel({ ...base, b: 0 }).regime, 'undamped');
  assert.equal(createOscillatorModel({ ...base, b: 2 }).regime, 'underdamped');
  assert.equal(createOscillatorModel({ ...base, b: 8 }).regime, 'critical');
  assert.equal(createOscillatorModel({ ...base, b: 12 }).regime, 'overdamped');
  assert.equal(regimeOf(1 + 1e-12), 'critical');
});

test('critical damping is continuous with nearby under- and overdamped motion', () => {
  const base = { mass: 1, k: 16, x0: 0.5, v0: 1 };
  const crit = createOscillatorModel({ ...base, b: 8 });
  for (const b of [8 - 1e-6, 8 + 1e-6]) {
    const m = createOscillatorModel({ ...base, b });
    for (const t of [0.2, 1, 3]) { near(m.at(t).x, crit.at(t).x, 1e-5); near(m.at(t).v, crit.at(t).v, 1e-5); }
  }
});

test('V3: critical damping b = 2√(km) = 8 kg/s returns without overshoot and fastest', () => {
  const base = { mass: 1, k: 16, x0: 0.5, v0: 0 };
  near(criticalDamping(1, 16), 8);
  const settle = b => { const m = createOscillatorModel({ ...base, b }); for (let t = 0; t <= 20; t += 0.001) { const p = m.at(t); if (Math.abs(p.x) < 0.005 && [0.1, 0.2, 0.5].every(d => Math.abs(m.at(t + d).x) < 0.005)) return t; } return Infinity; };
  const crit = createOscillatorModel({ ...base, b: 8 });
  for (let t = 0; t <= 5; t += 0.01) assert.ok(crit.at(t).x >= 0, 'critical damping never crosses equilibrium here');
  assert.ok(settle(8) < settle(4) && settle(8) < settle(16));
  assert.ok(Math.min(...Array.from({ length: 500 }, (_, i) => createOscillatorModel({ ...base, b: 4 }).at(i / 100).x)) < 0, 'underdamped overshoots');
});

test('energy bookkeeping: KE + PE + ∫b v² dt equals the initial energy', () => {
  for (const s of grid.filter(s => s.b > 0).slice(0, 20)) {
    const m = createOscillatorModel(s), h = 1e-4, tEnd = 3;
    let integral = 0;
    for (let t = 0; t < tEnd - 1e-12; t += h) {
      const f = tt => s.b * m.at(tt).v ** 2;          // Simpson's rule on each step
      integral += h / 6 * (f(t) + 4 * f(t + h / 2) + f(t + h));
    }
    const end = m.at(tEnd);
    near(end.dissipated, integral, 1e-6 * Math.max(m.e0, 1e-9), JSON.stringify(s));
    near(end.ke + end.pe + integral, m.e0, 1e-6 * Math.max(m.e0, 1e-9));
  }
});

test('undamped motion conserves energy exactly', () => {
  const m = createOscillatorModel({ ...OSC_DEFAULTS, b: 0 });
  for (const t of [1, 7.3, 20]) near(m.at(t).e, m.e0, 1e-12);
});

test('rejects settings outside the supported ranges', () => {
  assert.throws(() => createOscillatorModel({ ...OSC_DEFAULTS, k: 0 }), RangeError);
  assert.throws(() => createOscillatorModel({ ...OSC_DEFAULTS, b: -1 }), RangeError);
  assert.throws(() => createOscillatorModel({ ...OSC_DEFAULTS, x0: 2 }), RangeError);
});
