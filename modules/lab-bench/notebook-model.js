/**
 * Lab notebook data for Lab Bench labs. Pure (no DOM), unit-tested.
 * A trial is { id, object, timer, h (m, as read by the student), t (s, as timed), deleted, note }.
 */
import { stats, linearFit } from '../../js/core/fit.js';

export const MIN = { heights: 3, trialsPerHeight: 5 };

/**
 * The smallest scatter the equipment allows, as standard deviations.
 * Height: read to the nearest millimetre (uniform ±0.5 mm). It is read once per height, so it does not average away.
 * Electronic timer: shown to 1 ms with ±0.5 ms jitter (two uniform 1 ms spreads). Stopwatch: shown to 0.01 s.
 */
export const RESOLUTION = {
  height: 0.001 / Math.sqrt(12),
  time: timer => (/electronic/i.test(timer ?? '') ? Math.sqrt(2 / 12) * 0.001 : 0.01 / Math.sqrt(12)),
};

export function addTrial(book, trial) {
  const id = (book.at(-1)?.id ?? 0) + 1;
  return [...book, { id, deleted: false, note: '', ...trial }];
}
/** Deleting keeps the row (struck through), as in a real notebook. */
export function deleteTrial(book, id, note = 'deleted') {
  return book.map(r => (r.id === id ? { ...r, deleted: !r.deleted, note: r.deleted ? '' : note } : r));
}
export const active = book => book.filter(r => !r.deleted && r.h > 0 && r.t > 0);

/** A combination is one ball with one timer; only trials from the same combination belong in one fit. */
export const comboKey = r => `${r.object} · ${r.timer}`;
/** The combinations in the notebook, most trials first. */
export function combos(book) {
  const m = new Map();
  for (const r of active(book)) m.set(comboKey(r), { key: comboKey(r), object: r.object, timer: r.timer, n: (m.get(comboKey(r))?.n ?? 0) + 1 });
  return [...m.values()].sort((a, b) => b.n - a.n);
}
const pick = (book, key) => (key ? active(book).filter(r => comboKey(r) === key) : active(book));

/** Heights within 0.5 mm count as the same height (students re-read the stick). */
export function groupByHeight(book, key = null) {
  const groups = [];
  for (const r of pick(book, key)) {
    let g = groups.find(x => Math.abs(x.h - r.h) < 0.0005);
    if (!g) groups.push(g = { h: r.h, rows: [] });
    g.rows.push(r);
  }
  return groups.sort((a, b) => a.h - b.h).map(g => {
    const s = stats(g.rows.map(r => r.t));
    const gEach = 2 * g.h / (s.mean * s.mean);
    return { h: g.h, n: s.n, tMean: s.mean, tSD: s.sd, tSE: s.se, gEach, rows: g.rows };
  });
}

/**
 * Fit t² = a + b h through every active trial; g = 2 / b, δg = 2 δb / b².
 * t² goes on the vertical axis because timing is the noisy measurement: least squares assumes the error is in y.
 * (Fitting h against t² instead biases g low; with ±0.04 s stopwatch scatter it averages about 8.9 m/s² on Earth.)
 */
export function analyse(book, key = null) {
  const pts = pick(book, key).map(r => ({ x: r.h, y: r.t * r.t }));
  const groups = groupByHeight(book, key);
  const out = { points: pts, groups, fit: null, g: NaN, gSE: NaN, error: '' };
  if (groups.length < 2) { out.error = 'Measure at least two different heights to draw a line.'; return out; }
  const fit = linearFit(pts);
  const toG = se => (2 * se) / (fit.slope * fit.slope);
  const gSEfit = toG(fit.slopeSE), gSEfloor = toG(slopeFloor(groups, fit.slope));
  // A fit with few points can scatter less than the equipment allows by luck (e.g. 4 points whose timer errors fall on a line).
  // The reported ± never goes below what the ruler and timer can resolve.
  Object.assign(out, { fit, g: 2 / fit.slope, gSEfit, gSEfloor, gSE: Number.isFinite(gSEfit) ? Math.max(gSEfit, gSEfloor) : NaN, floored: !(gSEfit >= gSEfloor) });
  if (!(fit.n > 2)) out.error = 'Add more trials to estimate the uncertainty.';
  return out;
}

/**
 * Slope standard error if the only errors were the equipment's resolution, from the height means:
 * σᵢ² = (2 t̄ᵢ σₜ)² / nᵢ + (slope σₕ)², slope SE = 1 / √Σ wᵢ (hᵢ − h̄_w)², wᵢ = 1/σᵢ².
 */
export function slopeFloor(groups, slope) {
  const w = groups.map(g => 1 / ((2 * g.tMean * RESOLUTION.time(g.rows[0]?.timer)) ** 2 / g.n + (slope * RESOLUTION.height) ** 2));
  const W = w.reduce((s, v) => s + v, 0), hBar = groups.reduce((s, g, i) => s + w[i] * g.h, 0) / W;
  return 1 / Math.sqrt(groups.reduce((s, g, i) => s + w[i] * (g.h - hBar) ** 2, 0));
}

/**
 * The g a perfect experimenter would measure at these heights: exact fall times, fitted the same way.
 * With air this is a little below the true g (drag lengthens each fall), and for a light ball well below it.
 */
export function idealFitG(heights, timeOf) {
  if (new Set(heights).size < 2) return NaN;
  return 2 / linearFit(heights.map(h => ({ x: h, y: timeOf(h) ** 2 }))).slope;
}

/** Progress toward the assignment's minimum design. */
export function progress(book, key = null) {
  const groups = groupByHeight(book, key);
  const full = groups.filter(g => g.n >= MIN.trialsPerHeight).length;
  return { heights: groups.length, fullHeights: full, done: full >= MIN.heights };
}

export function notebookCsv(book) {
  const head = 'trial,object,timer,height_m,time_s,deleted,note';
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  return [head, ...book.map(r => [r.id, q(r.object), q(r.timer), r.h, r.t, r.deleted ? 1 : 0, q(r.note)].join(','))].join('\n') + '\n';
}
