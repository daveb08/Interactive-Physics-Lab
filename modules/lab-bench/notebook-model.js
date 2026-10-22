/**
 * Lab notebook data for Lab Bench labs. Pure (no DOM), unit-tested.
 * A trial is { id, object, timer, h (m, as read by the student), t (s, as timed), deleted, note }.
 */
import { stats, linearFit } from '../../js/core/fit.js';

export const MIN = { heights: 3, trialsPerHeight: 5 };

export function addTrial(book, trial) {
  const id = (book.at(-1)?.id ?? 0) + 1;
  return [...book, { id, deleted: false, note: '', ...trial }];
}
/** Deleting keeps the row (struck through), as in a real notebook. */
export function deleteTrial(book, id, note = 'deleted') {
  return book.map(r => (r.id === id ? { ...r, deleted: !r.deleted, note: r.deleted ? '' : note } : r));
}
export const active = book => book.filter(r => !r.deleted && r.h > 0 && r.t > 0);

/** Heights within 0.5 mm count as the same height (students re-read the stick). */
export function groupByHeight(book) {
  const groups = [];
  for (const r of active(book)) {
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
export function analyse(book) {
  const pts = active(book).map(r => ({ x: r.h, y: r.t * r.t }));
  const groups = groupByHeight(book);
  const out = { points: pts, groups, fit: null, g: NaN, gSE: NaN, error: '' };
  if (groups.length < 2) { out.error = 'Measure at least two different heights to draw a line.'; return out; }
  const fit = linearFit(pts);
  Object.assign(out, { fit, g: 2 / fit.slope, gSE: (2 * fit.slopeSE) / (fit.slope * fit.slope) });
  if (!(fit.n > 2)) out.error = 'Add more trials to estimate the uncertainty.';
  return out;
}

/** Progress toward the assignment's minimum design. */
export function progress(book) {
  const groups = groupByHeight(book);
  const full = groups.filter(g => g.n >= MIN.trialsPerHeight).length;
  return { heights: groups.length, fullHeights: full, done: full >= MIN.heights };
}

export function notebookCsv(book) {
  const head = 'trial,object,timer,height_m,time_s,deleted,note';
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  return [head, ...book.map(r => [r.id, q(r.object), q(r.timer), r.h, r.t, r.deleted ? 1 : 0, q(r.note)].join(','))].join('\n') + '\n';
}
