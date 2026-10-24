/**
 * Lab Bench · Lab 2 data analysis. Pure (no DOM), unit-tested.
 *
 * A launch is the record of one video and the student's work on it:
 *   { id, angle, spring, fps, stick: 'plane'|'front', phase,
 *     cal: { a: {u, v}, b: {u, v} } | null,      // the two ends of the metre stick, clicked by the student
 *     origin: {u, v} | null,                      // the origin, clicked by the student (x right, y up)
 *     clicks: { [frame]: {u, v} },                // the ball's centre, clicked on each frame the student chose
 *     hand: [vy1, vy2, vy3], handX: [vx1, vx2, vx3], // the first three vy and vx values, worked out by hand
 *     models: { x, y, vx, vy } ('line'|'parabola'), // the model the student chose for each graph
 *     excluded: { [frame]: reason },               // marks kept in the table but left out of the fits, with the student's reason
 *     note }
 * Nothing here knows the true g: every number comes from the student's clicks.
 */
import { linearFit, quadraticFit } from '../../js/core/fit.js';

export const HAND_VY = 3;
export const MIN_DEFAULT = Object.freeze({ launches: 2, points: 10 });
export const MODELS = Object.freeze({ line: 'Straight line', parabola: 'Parabola' });
export const CORRECT_MODELS = Object.freeze({ x: 'line', y: 'parabola', vx: 'line', vy: 'line' });

/** Metres per pixel from the two clicked ends of a 1.000 m stick. */
export function scaleOf(cal, length = 1) {
  if (!cal?.a || !cal?.b) return NaN;
  const d = Math.hypot(cal.b.u - cal.a.u, cal.b.v - cal.a.v);
  return d > 0 ? length / d : NaN;
}
export const calibrated = l => Number.isFinite(scaleOf(l.cal)) && !!l.origin;

/** Every marked point in metres, from the student's own calibration and origin (y up), sorted by frame.
 *  Points the student left out of the fit carry `out: true` and their `reason`. */
export function allPoints(l) {
  const s = scaleOf(l.cal);
  if (!calibrated(l)) return [];
  return Object.entries(l.clicks || {}).map(([n, c]) => {
    const reason = l.excluded?.[n];
    return { n: +n, t: +n / l.fps, x: (c.u - l.origin.u) * s, y: (l.origin.v - c.v) * s, out: reason != null, reason: reason ?? '' };
  }).sort((a, b) => a.n - b.n);
}
/** The points used in the fits (and for the velocities): every mark the student has not left out. */
export const points = l => allPoints(l).filter(p => !p.out);
/** A reason is needed to leave a point out: at least a few characters. */
export const MIN_REASON = 3;
export const reasonOk = r => String(r ?? '').trim().length >= MIN_REASON;
/** Leave a marked frame out of the fit (needs a reason), or put it back (reason null). Returns false if refused. */
export function setExcluded(l, n, reason) {
  if (reason == null) { if (l.excluded) delete l.excluded[n]; return true; }
  if (!reasonOk(reason) || !l.clicks?.[n]) return false;
  l.excluded = { ...(l.excluded || {}), [n]: String(reason).trim().slice(0, 120) };
  return true;
}
export const excludedCount = l => Object.keys(l.excluded || {}).filter(n => l.clicks?.[n]).length;
/** Rounded as shown in the data table (the student works from these). */
export const shown = p => ({ ...p, t: +p.t.toFixed(4), x: +p.x.toFixed(3), y: +p.y.toFixed(3) });

/** Velocities between consecutive tracked points, at the middle of each interval: vx = (x₂ − x₁)/Δt, vy = (y₂ − y₁)/Δt. */
export function velPoints(pts) {
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    // Positions as shown (to the millimetre); times exact (n / fps), so every Δt of one frame is the same.
    const a = shown(pts[i]), b = shown(pts[i + 1]), dt = pts[i + 1].t - pts[i].t;
    if (dt > 0) out.push({ i, t: (pts[i].t + pts[i + 1].t) / 2, vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt, dx: +(b.x - a.x).toFixed(3), dy: +(b.y - a.y).toFixed(3), dt, from: a, to: b });
  }
  return out;
}
export const vyPoints = velPoints;
/** Is a hand-worked velocity right? Within 2 % or 0.02 m/s of the value from the table (rounding differs). */
export const handOk = (entered, exact) => Number.isFinite(entered) && Math.abs(entered - exact) <= Math.max(0.02, 0.02 * Math.abs(exact));
/** The first three vx and vy, worked out by hand. Both columns must be right before either velocity graph appears. */
export function handStatus(l) {
  const vs = velPoints(points(l)).slice(0, HAND_VY);
  const ok = (arr, i, v) => arr?.[i] !== '' && arr?.[i] != null && handOk(+arr[i], v);
  const marks = vs.map((v, i) => ({ ...v, enteredY: l.hand?.[i], enteredX: l.handX?.[i], okY: ok(l.hand, i, v.vy), okX: ok(l.handX, i, v.vx) }))
    .map(m => ({ ...m, ok: m.okY && m.okX }));
  return { marks, done: marks.length === HAND_VY && marks.every(m => m.ok) };
}

/** Fit one graph with the student's chosen model. Returns null if there is not enough data. */
export function fitGraph(l, key) {
  const model = l.models?.[key];
  if (!model) return null;
  const pts = key === 'vy' || key === 'vx' ? (handStatus(l).done ? velPoints(points(l)).map(v => ({ x: v.t, y: v[key] })) : [])
    : points(l).map(p => ({ x: p.t, y: key === 'x' ? p.x : p.y }));
  if (pts.length < (model === 'parabola' ? 4 : 3)) return null;
  try {
    if (model === 'line') { const f = linearFit(pts); return { model, n: f.n, A: f.intercept, B: f.slope, ASE: f.interceptSE, BSE: f.slopeSE, r2: f.r2, rsd: f.residualSD }; }
    const f = quadraticFit(pts); return { model, n: f.n, A: f.a, B: f.b, C: f.c, ASE: f.aSE, BSE: f.bSE, CSE: f.cSE, r2: f.r2, rsd: f.residualSD };
  } catch { return null; }
}

/** One launch's status, as the notebook and the grading code describe it. */
export function summary(l) {
  const pts = points(l), fits = { x: fitGraph(l, 'x'), y: fitGraph(l, 'y'), vx: fitGraph(l, 'vx'), vy: fitGraph(l, 'vy') };
  const modelsOk = Object.entries(CORRECT_MODELS).every(([k, m]) => l.models?.[k] === m);
  return { id: l.id, angle: l.angle, spring: l.spring, fps: l.fps, stick: l.stick, n: pts.length, excluded: excludedCount(l), calibrated: calibrated(l), hand: handStatus(l).done, fits, modelsOk,
    analysed: !!(fits.x && fits.y && fits.vx && fits.vy) };
}

/**
 * Progress against the assignment: at least `launches` analysed launches with `points` points each, from at least two
 * different launches (angle or spring), with the four graphs fitted.
 */
export function progress(launches, min = MIN_DEFAULT) {
  const sums = launches.map(summary), good = sums.filter(s => s.analysed && s.n >= min.points);
  const settings = new Set(good.map(s => `${s.angle}|${s.spring}`));
  return { sums, good: good.length, distinct: settings.size, done: good.length >= min.launches && settings.size >= Math.min(2, min.launches) };
}
