import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, GRAVITY } from '../js/core/physics.js';
import { cartForces, arrowLength, describeForces } from '../js/core/force-diagram.js';
import { clampGraphWidth, maxGraphWidth } from '../js/components/column-resizer.js';

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
const byKey = (data, key) => data.forces.find(f => f.key === key);

test('frictionless: applied, normal and weight; net equals applied', () => {
  const data = cartForces(createRun({ mass: 2, force: 6, velocity: 0 }));
  assert.deepEqual(data.forces.map(f => f.sub), ['A', 'N', 'W']);
  close(byKey(data, 'normal').fy, 2 * GRAVITY, 'normal');
  close(byKey(data, 'weight').fy, -2 * GRAVITY, 'weight');
  close(data.net.fx, 6, 'net x'); close(data.net.fy, 0, 'net y');
});

test('zero applied force is not drawn; zero net force reported as zero', () => {
  const data = cartForces(createRun({ mass: 3, force: 0, velocity: 2 }));
  assert.equal(byKey(data, 'applied'), undefined);
  assert.equal(data.net.magnitude, 0);
  assert.match(describeForces(data), /net force zero/);
});

test('static friction balances the push: positive magnitude, opposite direction', () => {
  const data = cartForces(createRun({ mass: 5, force: 15, velocity: 0, frictionEnabled: true, muS: 0.4, muK: 0.3 }));
  const f = byKey(data, 'friction');
  assert.equal(f.name, 'Static friction');
  close(f.fx, -15, 'friction'); close(f.magnitude, 15, 'friction magnitude');
  assert.equal(data.net.magnitude, 0);
});

test('kinetic friction opposes the velocity, even against the push', () => {
  // Moving left while pushed right: friction points right, with the push.
  const data = cartForces(createRun({ mass: 2, force: 4, velocity: -3, frictionEnabled: true, muS: 0.4, muK: 0.3 }));
  const f = byKey(data, 'friction');
  assert.equal(f.name, 'Kinetic friction');
  close(f.fx, 0.3 * 2 * GRAVITY, 'friction');
  close(data.net.fx, 4 + 0.3 * 2 * GRAVITY, 'net');
});

test('arrow lengths share one scale with a minimum for small forces', () => {
  assert.equal(arrowLength(19.62, 19.62, { maxLength: 60 }), 60);
  close(arrowLength(9.81, 19.62, { maxLength: 60 }), 30, 'half');
  assert.equal(arrowLength(0.1, 100, { maxLength: 60, minLength: 18 }), 18);
  assert.equal(arrowLength(0, 100, { maxLength: 60, minLength: 18 }), 0);
});

test('graph column width is clamped to leave a usable simulation column', () => {
  assert.equal(maxGraphWidth(1376), 1376 - 245 - 320 - 36);
  assert.equal(clampGraphWidth(100, 1376), 260);
  assert.equal(clampGraphWidth(5000, 1376), maxGraphWidth(1376));
  assert.equal(clampGraphWidth(400, 1376), 400);
});
