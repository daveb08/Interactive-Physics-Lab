/**
 * Lab Bench · Lab 2 physics and camera. Pure (no DOM), unit-tested.
 *
 * A 40 mm steel ball is fired by a spring launcher in a vertical plane (the "flight plane") and filmed by a camera standing
 * square-on to that plane. Air drag is included (quadratic, Cd 0.47): on Earth it changes the measured g of this ball
 * by well under 1 % over these short flights, like the steel ball in Lab 1.
 *
 * Camera: a pinhole at distance D in front of the flight plane, looking straight at it. A point at depth Z (distance
 * from the camera) and position (X, Y) in metres appears at u = U0 + F (X − XC) / Z, v = V0 − F (Y − YC) / Z pixels.
 * Anything nearer the camera than the flight plane (Z < D) looks bigger: that is the parallax trap. A metre stick on
 * the front edge of the bench appears longer than a metre at the ball's distance, so a scale taken from it is too big
 * and every length, and g, comes out too small by the same factor.
 */
import { AIR } from './freefall-drag.js';

export const BALL = Object.freeze({ name: 'Steel ball', diameter: 0.04, mass: 0.263, cd: 0.47 });
/** Spring settings 1–6: launch speeds in m/s (the launcher's own label, not measured: students do not need it). */
export const SPRING = Object.freeze([2.0, 3.0, 4.0, 5.0, 6.0, 7.0]);
export const ANGLE = Object.freeze({ min: 15, max: 75, step: 5 });
export const FPS = Object.freeze([10, 20, 30, 60]);
/** The launcher's muzzle (where the ball leaves) in flight-plane metres; the floor is y = 0. */
export const MUZZLE = Object.freeze({ x: 0.30, y: 0.12 });

/** Camera: image W × H px, centred on (XC, YC) of the flight plane, D metres away. The flight plane spans 4.0 m across. */
export const CAMERA = Object.freeze({ W: 800, H: 560, D: 3.0, XC: 2.05, YC: 1.32, U0: 400, V0: 280, F: 600 });
/** Where the metre stick can stand: in the flight plane (correct) or on the front edge of the bench, 0.45 m nearer. */
export const STICK_PLACES = Object.freeze({
  plane: { z: CAMERA.D, x: 3.55, y: 0.05, label: 'In the flight plane, beside the launcher' },
  front: { z: CAMERA.D - 0.45, x: 3.30, y: 0.30, label: 'On the front edge of the bench (nearer the camera)' },
});
export const STICK_LENGTH = 1.0;   // standing upright, bottom at (x, y) of its place

export function project(X, Y, Z = CAMERA.D) {
  const { F, U0, V0, XC, YC } = CAMERA;
  return { u: U0 + (F * (X - XC)) / Z, v: V0 - (F * (Y - YC)) / Z };
}
/** Pixels per metre for objects at depth Z. */
export const pxPerM = (Z = CAMERA.D) => CAMERA.F / Z;
/** The factor by which a scale taken from the stick at depth Z mis-measures lengths in the flight plane. */
export const parallaxFactor = place => STICK_PLACES[place].z / CAMERA.D;

/** Air drag constant k (1/m) for the ball: a_drag = −k |v| v. */
export function dragK(rho) {
  const r = BALL.diameter / 2;
  return (0.5 * rho * BALL.cd * Math.PI * r * r) / BALL.mass;
}

/**
 * The flight from the muzzle to the floor, integrated with RK4 (1 ms steps). Returns sample arrays and the time of
 * landing (the ball's bottom touching the floor). `at(t)` interpolates linearly between steps (error < 1 µm).
 */
export function flight({ g, rho = 0 }, { angle, speed }) {
  const k = dragK(rho), dt = 0.001, r = BALL.diameter / 2, th = (angle * Math.PI) / 180;
  let s = { x: MUZZLE.x, y: MUZZLE.y, vx: speed * Math.cos(th), vy: speed * Math.sin(th) };
  const acc = st => { const v = Math.hypot(st.vx, st.vy); return { ax: -k * v * st.vx, ay: -g - k * v * st.vy }; };
  const deriv = st => { const a = acc(st); return { x: st.vx, y: st.vy, vx: a.ax, vy: a.ay }; };
  const add = (a, b, h) => ({ x: a.x + b.x * h, y: a.y + b.y * h, vx: a.vx + b.vx * h, vy: a.vy + b.vy * h });
  const ts = [0], xs = [s.x], ys = [s.y], vys = [s.vy];
  let t = 0;
  while (t < 10) {
    const k1 = deriv(s), k2 = deriv(add(s, k1, dt / 2)), k3 = deriv(add(s, k2, dt / 2)), k4 = deriv(add(s, k3, dt));
    const next = { x: s.x + (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x), y: s.y + (dt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
      vx: s.vx + (dt / 6) * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx), vy: s.vy + (dt / 6) * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy) };
    t += dt;
    if (next.y - r <= 0 && next.vy < 0) {   // landing: interpolate to the touch
      const f = (s.y - r) / (s.y - next.y);
      const tl = t - dt + f * dt;
      ts.push(tl); xs.push(s.x + f * (next.x - s.x)); ys.push(r); vys.push(s.vy + f * (next.vy - s.vy));
      break;
    }
    s = next; ts.push(t); xs.push(s.x); ys.push(s.y); vys.push(s.vy);
  }
  const T = ts.at(-1);
  const at = time => {
    const tc = Math.min(Math.max(time, 0), T), i = Math.min(ts.length - 2, Math.floor(tc / dt));
    const f = (tc - ts[i]) / (ts[i + 1] - ts[i] || 1);
    return { x: xs[i] + f * (xs[i + 1] - xs[i]), y: ys[i] + f * (ys[i + 1] - ys[i]), vy: vys[i] + f * (vys[i + 1] - vys[i]) };
  };
  return { T, at, apex: Math.max(...ys), range: xs.at(-1) };
}

/**
 * The video: the camera records at `fps`; the ball leaves the muzzle at time `phase` (0 ≤ phase < 1/fps) after frame 0.
 * Frame n is at t = n / fps. Frames run from one before launch to one after landing.
 */
export function frames(fl, fps, phase) {
  const out = [], dtf = 1 / fps, n1 = Math.ceil((phase + fl.T) / dtf) + 1;
  for (let n = 0; n <= n1; n++) {
    const t = n * dtf, tf = t - phase, inFlight = tf >= 0 && tf <= fl.T;
    const p = tf < 0 ? { x: MUZZLE.x, y: MUZZLE.y } : fl.at(tf);
    out.push({ n, t, inFlight, x: p.x, y: tf > fl.T ? BALL.diameter / 2 : p.y, landed: tf > fl.T });
  }
  return out;
}
/** Is the whole flight inside the camera's picture (with a small margin)? */
export function inView(fl) {
  const pts = [];
  for (let i = 0; i <= 60; i++) pts.push(fl.at((fl.T * i) / 60));
  return pts.every(p => { const { u, v } = project(p.x, p.y); return u > 12 && u < CAMERA.W - 12 && v > 12 && v < CAMERA.H - 4; });
}
