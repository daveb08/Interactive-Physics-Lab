/**
 * Small statistics for lab data (Lab Bench). Pure and unit-tested.
 * mean / SD (n − 1) / standard error, and an ordinary least-squares line y = a + b x with standard errors.
 */
export function stats(values) {
  const n = values.length;
  if (!n) return { n: 0, mean: NaN, sd: NaN, se: NaN };
  const mean = values.reduce((s, v) => s + v, 0) / n;
  if (n < 2) return { n, mean, sd: NaN, se: NaN };
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
  return { n, mean, sd, se: sd / Math.sqrt(n) };
}

/**
 * Least-squares line through points [{x, y}]. Returns slope b, intercept a, their standard errors,
 * the residual standard deviation and R². Needs ≥ 3 points with at least 2 distinct x for the errors.
 */
export function linearFit(points) {
  const n = points.length;
  if (n < 2) throw new RangeError('Need at least two points to fit a line');
  const mx = points.reduce((s, p) => s + p.x, 0) / n, my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of points) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my); syy += (p.y - my) ** 2; }
  if (!(sxx > 0)) throw new RangeError('All points have the same x: a slope cannot be found');
  const slope = sxy / sxx, intercept = my - slope * mx;
  const ssr = points.reduce((s, p) => s + (p.y - intercept - slope * p.x) ** 2, 0);
  const dof = n - 2, s2 = dof > 0 ? ssr / dof : NaN;
  const slopeSE = Math.sqrt(s2 / sxx);
  const interceptSE = Math.sqrt(s2 * (1 / n + (mx * mx) / sxx));
  return { n, slope, intercept, slopeSE, interceptSE, residualSD: Math.sqrt(s2), r2: syy > 0 ? 1 - ssr / syy : 1 };
}
