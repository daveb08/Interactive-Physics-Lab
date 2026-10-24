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

/**
 * Least-squares parabola y = a + b x + c x² through points [{x, y}], with standard errors from the covariance
 * s² (XᵀX)⁻¹. Needs ≥ 3 points with at least 3 distinct x; the errors need ≥ 4 points.
 */
export function quadraticFit(points) {
  const n = points.length;
  if (n < 3) throw new RangeError('Need at least three points to fit a parabola');
  // Centre x for numerical stability, then convert back.
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const S = [0, 0, 0, 0, 0], T = [0, 0, 0];
  for (const p of points) { const u = p.x - mx; let w = 1; for (let k = 0; k <= 4; k++) { S[k] += w; if (k <= 2) T[k] += w * p.y; w *= u; } }
  const M = [[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]];
  const inv = invert3(M);
  if (!inv) throw new RangeError('Need at least three different x values to fit a parabola');
  const [a0, b0, c] = [0, 1, 2].map(i => inv[i][0] * T[0] + inv[i][1] * T[1] + inv[i][2] * T[2]);
  // y = a0 + b0 u + c u², u = x − mx  →  a = a0 − b0 mx + c mx², b = b0 − 2 c mx
  const a = a0 - b0 * mx + c * mx * mx, b = b0 - 2 * c * mx;
  const ssr = points.reduce((s, p) => s + (p.y - (a + b * p.x + c * p.x * p.x)) ** 2, 0);
  const my = points.reduce((s, p) => s + p.y, 0) / n, syy = points.reduce((s, p) => s + (p.y - my) ** 2, 0);
  const dof = n - 3, s2 = dof > 0 ? ssr / dof : NaN;
  // Var(b) = Var(b0) + 4 mx² Var(c) − 4 mx Cov(b0, c); Var(a) from the full transform.
  const cov = (i, j) => s2 * inv[i][j];
  const varC = cov(2, 2), varB = cov(1, 1) + 4 * mx * mx * varC - 4 * mx * cov(1, 2);
  const J = [1, -mx, mx * mx];   // a = J · (a0, b0, c)
  let varA = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) varA += J[i] * J[j] * cov(i, j);
  return { n, a, b, c, aSE: Math.sqrt(varA), bSE: Math.sqrt(varB), cSE: Math.sqrt(varC), residualSD: Math.sqrt(s2), r2: syy > 0 ? 1 - ssr / syy : 1 };
}
function invert3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  if (!(Math.abs(det) > 1e-18 * Math.max(1, Math.abs(a * e * i)))) return null;
  return [[A, -(b * i - c * h), b * f - c * e], [B, a * i - c * g, -(a * f - c * d)], [C, -(a * h - b * g), a * e - b * d]].map(r => r.map(v => v / det));
}
