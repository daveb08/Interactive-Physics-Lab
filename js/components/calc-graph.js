/**
 * Time-series graph for the calculus tier. Unlike MotionGraph, the vertical range is fixed from the
 * exact full-run solution before the run starts, so tangents, shaded areas and numerical overlays
 * share stable axes. Curves outside the range are clipped, not rescaled.
 */
import { graphSize, niceTicks } from './graph.js';
const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs, content) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) node.setAttribute(k, v);
  if (content !== undefined) node.textContent = content;
  return node;
};
let uid = 0;
export const METHOD_STYLES = Object.freeze({
  euler: { color: '#c24c2a', dash: '6 4', label: 'Euler' },
  semiImplicit: { color: '#7851a9', dash: '2 3', label: 'Semi-implicit' },
  rk4: { color: '#b07d12', dash: '10 3 2 3', label: 'RK4' },
});
/**
 * Drawing geometry in screen pixels (1 SVG unit = 1 px), so text stays readable and the plot grows in both
 * directions as its column widens. Before the graph is visible, the original 400 × 165 layout is used.
 */
function geometry(svg) {
  const box = svg.getBoundingClientRect?.() ?? { width: 0 };
  let width = 0;
  if (box.width) { const st = getComputedStyle(svg); width = box.width - parseFloat(st.paddingLeft || 0) - parseFloat(st.paddingRight || 0); }
  const ts = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ts')) || 1;
  const { W, H } = width ? graphSize(width) : { W: 400, H: 165 };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.classList.add('motion-graph');   // graph text follows the A / A+ / A++ control
  return { W, H, ts, L: Math.round(58 * ts), R: W - 14, T: Math.round(34 * ts), B: Math.round(H - 44 * ts) };
}
/** Re-draw a graph when its box changes size (column resized, window resized, text size changed). */
function watch(graph) {
  if (typeof ResizeObserver === 'undefined' || graph.watching) return;
  graph.watching = true;
  let w = 0;
  new ResizeObserver(entries => { const nw = Math.round(entries[0].contentRect.width); if (graph.last && Math.abs(nw - w) > 2) { w = nw; graph.redraw(); } else w = nw; }).observe(graph.svg);
  window.addEventListener('resize', () => graph.last && graph.redraw());
}
/** Round time ticks (0.5, 1, 2, 2.5, 5 … s) that never exceed the end time. */
export function timeTicks(endTime, most = 5) {
  const raw = endTime / most, steps = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50];
  const step = steps.find(s => s >= raw) ?? raw;
  return Array.from({ length: Math.floor(endTime / step + 1e-9) + 1 }, (_, i) => +(i * step).toFixed(6));
}
const tickText = (t, step) => t.toFixed(step < 1 && !Number.isInteger(t) ? (Number.isInteger(t * 2) ? 1 : 2) : t >= 10 ? 0 : 1);
const fmt = v => { const a = Math.abs(v); return a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2); };

export class CalcGraph {
  constructor(svg, key, label, unit, color) {
    Object.assign(this, { svg, key, label, unit, color, id: `cg${++uid}` });
    this.g = { L: 54, R: 384, T: 34, B: 124, W: 400, H: 165, ts: 1 };
    this.setRange([{ t: 0, [key]: 0 }], 1);
    watch(this);
  }
  redraw() { this.render(this.last); }
  setRange(fullSamples, endTime) {
    const vals = fullSamples.map(s => s[this.key]);
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    const pad = Math.max((hi - lo) * 0.15, 0.05);
    this.min = lo - pad; this.max = hi + pad; this.endTime = endTime;
  }
  x(t) { const { L, R } = this.g; return L + t / this.endTime * (R - L); }
  y(v) { const { T, B } = this.g; return B - (v - this.min) / (this.max - this.min) * (B - T); }
  path(data, key = this.key) {
    return data.map((s, i) => `${i ? 'L' : 'M'}${this.x(s.t).toFixed(2)} ${this.y(s[key]).toFixed(2)}`).join(' ');
  }
  render(options) {
    this.last = options;
    const { samples, overlays = [], tangent = null, area = null, markers = [], hlines = [], note = '', points = [] } = options;
    const { svg, key, label, unit, color } = this;
    this.g = geometry(svg);
    const { L, R, T, B, W, ts } = this.g;
    svg.replaceChildren();
    const clip = el('clipPath', { id: `${this.id}-clip` });
    clip.append(el('rect', { x: L, y: T - 2, width: R - L, height: B - T + 4 }));
    svg.append(el('defs', {}).appendChild(clip).parentNode);
    const top = Math.round(18 * ts);
    svg.append(el('text', { x: 10, y: top, class: 'graph-unit' }, `${label} (${unit})`));
    if (note) svg.append(el('text', { x: W - 10, y: top, 'text-anchor': 'end', class: 'graph-tick calc-note' }, note));
    // Round values spaced at least 26 px apart, so the vertical labels never run together.
    const yTicks = niceTicks(this.min, this.max, Math.max(2, Math.floor((B - T) / (26 * ts)) + 1));
    for (const v of yTicks.ticks) {
      if (v === 0) continue;   // the dashed zero line is drawn below
      svg.append(el('path', { d: `M${L} ${this.y(v)}H${R}`, class: 'graph-grid' }));
    }
    for (const v of yTicks.ticks) svg.append(el('text', { x: L - 8, y: this.y(v) + 5, 'text-anchor': 'end', class: 'graph-tick' }, v.toFixed(yTicks.decimals)));
    if (this.min < 0 && this.max > 0) svg.append(el('path', { d: `M${L} ${this.y(0)}H${R}`, class: 'graph-zero' }));
    svg.append(el('path', { d: `M${L} ${T}V${B}H${R}`, class: 'graph-grid' }));
    const ticks = timeTicks(this.endTime, Math.max(3, Math.floor((R - L) / (56 * ts))));
    for (const t of ticks) svg.append(el('text', { x: this.x(t), y: B + Math.round(18 * ts), 'text-anchor': 'middle', class: 'graph-tick' }, tickText(t, ticks[1] - ticks[0])));
    svg.append(el('text', { x: (L + R) / 2, y: B + Math.round(37 * ts), 'text-anchor': 'middle', class: 'graph-tick' }, 'Time (s)'));
    const plot = el('g', { 'clip-path': `url(#${this.id}-clip)` });
    svg.append(plot);
    if (area && area.data.length > 1) {
      const d = `${this.path(area.data)} L${this.x(area.data.at(-1).t).toFixed(2)} ${this.y(0).toFixed(2)} L${this.x(area.data[0].t).toFixed(2)} ${this.y(0).toFixed(2)} Z`;
      plot.append(el('path', { d, class: 'calc-area' }));
    }
    for (const h of hlines) {
      plot.append(el('path', { d: `M${L} ${this.y(h.value)}H${R}`, class: 'calc-hline' }));
      svg.append(el('text', { x: R - 2, y: this.y(h.value) - 4, 'text-anchor': 'end', class: 'graph-tick calc-hlabel' }, h.label));
    }
    for (const m of markers) {
      plot.append(el('path', { d: `M${this.x(m.t)} ${T}V${B}`, class: 'calc-marker' }));
      svg.append(el('text', { x: Math.min(R - 30, this.x(m.t) + 4), y: T + Math.round(14 * ts), class: 'graph-tick' }, m.label));
    }
    for (const o of overlays) plot.append(el('path', { d: this.path(o.data, o.key || key), fill: 'none', stroke: o.color, 'stroke-width': o.width || 2, 'stroke-dasharray': o.dash || '', opacity: o.opacity ?? 1 }));
    plot.append(el('path', { d: this.path(samples), fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
    if (tangent) {
      const span = this.endTime * 0.12, { t, value, slope } = tangent;
      plot.append(el('path', { d: `M${this.x(t - span)} ${this.y(value - slope * span)}L${this.x(t + span)} ${this.y(value + slope * span)}`, class: 'calc-tangent' }));
      plot.append(el('circle', { cx: this.x(t), cy: this.y(value), r: 4, class: 'calc-point' }));
    }
    for (const pt of points) {
      const inRange = pt.value >= this.min && pt.value <= this.max && pt.t >= 0 && pt.t <= this.endTime;
      const cx = this.x(Math.min(Math.max(pt.t, 0), this.endTime)), cy = this.y(Math.min(Math.max(pt.value, this.min), this.max));
      svg.append(el('path', { d: `M${cx - 6} ${cy - 6}L${cx + 6} ${cy + 6}M${cx - 6} ${cy + 6}L${cx + 6} ${cy - 6}`, stroke: pt.color || '#ba622e', 'stroke-width': 2.5, class: 'calc-answer' }));
      svg.append(el('text', { x: Math.min(cx + 8, R - 4), y: cy - 8, 'text-anchor': cx + 8 > R - 60 ? 'end' : 'start', class: 'graph-tick', style: `fill:${pt.color || '#ba622e'}` }, `${pt.label}${inRange ? '' : ' (off scale)'}`));
    }
    const last = samples.at(-1);
    svg.append(el('circle', { cx: this.x(last.t), cy: this.y(last[key]), r: 3, fill: color }));
    const legend = overlays.filter(o => o.legend);
    legend.forEach((o, i) => svg.append(el('text', { x: R - (legend.length - 1 - i) * 96 * ts, y: top, 'text-anchor': 'end', class: 'graph-tick', style: `fill:${o.color}` }, `┄ ${o.legend}`)));
    svg.setAttribute('aria-label', `${label} versus time. Latest ${fmt(last[key])} ${unit} at ${last.t.toFixed(2)} s.${tangent ? ` Tangent slope at ${tangent.t.toFixed(2)} s is ${fmt(tangent.slope)}.` : ''}${legend.length ? ` Overlays: ${legend.map(o => o.legend).join(', ')}.` : ''}`);
  }
}

/** Log-scale plot of |numerical − exact| (or any positive quantity) against time. */
export class LogGraph {
  constructor(svg, label, unit) { Object.assign(this, { svg, label, unit }); }
  render(series, endTime, { floor = 1e-12 } = {}) {
    const { svg } = this;
    this.last = [series, endTime, { floor }];
    if (!this.watching) { this.redraw = () => this.render(...this.last); watch(this); }
    const { L, R, T, B, W, ts } = geometry(svg);
    svg.replaceChildren();
    svg.append(el('text', { x: 10, y: Math.round(18 * ts), class: 'graph-unit' }, `${this.label}${this.unit ? ` (${this.unit})` : ''}, log`));
    const vals = series.flatMap(s => s.data.map(p => p.value)).filter(v => v > floor && Number.isFinite(v));
    if (!vals.length) { svg.append(el('text', { x: W / 2, y: (T + B) / 2, 'text-anchor': 'middle', class: 'graph-tick' }, 'Choose a method to compare.')); return; }
    const lo = Math.floor(Math.log10(Math.min(...vals))), hi = Math.ceil(Math.log10(Math.max(...vals)));
    const top = hi === lo ? hi + 1 : hi;
    const x = t => L + t / endTime * (R - L), y = v => B - (Math.log10(Math.max(v, 10 ** lo)) - lo) / (top - lo) * (B - T);
    const step = Math.max(1, Math.ceil((top - lo) / 4));
    for (let p = lo; p <= top; p += step) {
      svg.append(el('path', { d: `M${L} ${y(10 ** p)}H${R}`, class: 'graph-grid' }));
      svg.append(el('text', { x: L - 6, y: y(10 ** p) + 4, 'text-anchor': 'end', class: 'graph-tick' }, `1e${p}`));
    }
    svg.append(el('path', { d: `M${L} ${T}V${B}H${R}`, class: 'graph-grid' }));
    const ticks = timeTicks(endTime, Math.max(3, Math.floor((R - L) / (56 * ts))));
    for (const t of ticks) svg.append(el('text', { x: x(t), y: B + Math.round(18 * ts), 'text-anchor': 'middle', class: 'graph-tick' }, tickText(t, ticks[1] - ticks[0])));
    svg.append(el('text', { x: (L + R) / 2, y: B + Math.round(37 * ts), 'text-anchor': 'middle', class: 'graph-tick' }, 'Time (s)'));
    series.forEach((s, i) => {
      const pts = s.data.filter(p => p.value > floor);
      if (pts.length > 1) svg.append(el('path', { d: pts.map((p, j) => `${j ? 'L' : 'M'}${x(p.t).toFixed(2)} ${y(p.value).toFixed(2)}`).join(' '), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-dasharray': s.dash || '' }));
      svg.append(el('text', { x: R - (series.length - 1 - i) * 96 * ts, y: Math.round(18 * ts), 'text-anchor': 'end', class: 'graph-tick', style: `fill:${s.color}` }, s.label));
    });
    svg.setAttribute('aria-label', `${this.label} on a log scale. ${series.map(s => `${s.label}: ${s.data.at(-1)?.value.toExponential(1)} at the end`).join('. ')}.`);
  }
}
