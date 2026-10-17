/**
 * Time-series graph for the calculus tier. Unlike MotionGraph, the vertical range is fixed from the
 * exact full-run solution before the run starts, so tangents, shaded areas and numerical overlays
 * share stable axes. Curves outside the range are clipped, not rescaled.
 */
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
const L = 54, R = 384, T = 34, B = 124;
const fmt = v => { const a = Math.abs(v); return a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2); };

export class CalcGraph {
  constructor(svg, key, label, unit, color) {
    Object.assign(this, { svg, key, label, unit, color, id: `cg${++uid}` });
    this.setRange([{ t: 0, [key]: 0 }], 1);
  }
  setRange(fullSamples, endTime) {
    const vals = fullSamples.map(s => s[this.key]);
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    const pad = Math.max((hi - lo) * 0.15, 0.05);
    this.min = lo - pad; this.max = hi + pad; this.endTime = endTime;
  }
  x(t) { return L + t / this.endTime * (R - L); }
  y(v) { return B - (v - this.min) / (this.max - this.min) * (B - T); }
  path(data, key = this.key) {
    return data.map((s, i) => `${i ? 'L' : 'M'}${this.x(s.t).toFixed(2)} ${this.y(s[key]).toFixed(2)}`).join(' ');
  }
  render({ samples, overlays = [], tangent = null, area = null, markers = [], hlines = [], note = '' }) {
    const { svg, key, label, unit, color } = this;
    svg.replaceChildren();
    const clip = el('clipPath', { id: `${this.id}-clip` });
    clip.append(el('rect', { x: L, y: T - 2, width: R - L, height: B - T + 4 }));
    svg.append(el('defs', {}).appendChild(clip).parentNode);
    svg.append(el('text', { x: 10, y: 17, class: 'graph-unit' }, `${label} (${unit})`));
    if (note) svg.append(el('text', { x: 390, y: 17, 'text-anchor': 'end', class: 'graph-tick calc-note' }, note));
    for (const v of [this.min + (this.max - this.min) * 0.075, (this.min + this.max) / 2, this.max - (this.max - this.min) * 0.075]) {
      svg.append(el('path', { d: `M${L} ${this.y(v)}H${R}`, class: 'graph-grid' }));
      svg.append(el('text', { x: L - 6, y: this.y(v) + 4, 'text-anchor': 'end', class: 'graph-tick' }, fmt(v)));
    }
    if (this.min < 0 && this.max > 0) svg.append(el('path', { d: `M${L} ${this.y(0)}H${R}`, class: 'graph-zero' }));
    svg.append(el('path', { d: `M${L} ${T}V${B}H${R}`, class: 'graph-grid' }));
    for (let i = 0; i <= 4; i++) {
      const t = this.endTime * i / 4;
      svg.append(el('text', { x: this.x(t), y: B + 16, 'text-anchor': 'middle', class: 'graph-tick' }, t.toFixed(t < 10 ? 1 : 0)));
    }
    svg.append(el('text', { x: (L + R) / 2, y: B + 32, 'text-anchor': 'middle', class: 'graph-tick' }, 'Time (s)'));
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
      svg.append(el('text', { x: Math.min(R - 30, this.x(m.t) + 4), y: T + 10, class: 'graph-tick' }, m.label));
    }
    for (const o of overlays) plot.append(el('path', { d: this.path(o.data, o.key || key), fill: 'none', stroke: o.color, 'stroke-width': o.width || 2, 'stroke-dasharray': o.dash || '', opacity: o.opacity ?? 1 }));
    plot.append(el('path', { d: this.path(samples), fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
    if (tangent) {
      const span = this.endTime * 0.12, { t, value, slope } = tangent;
      plot.append(el('path', { d: `M${this.x(t - span)} ${this.y(value - slope * span)}L${this.x(t + span)} ${this.y(value + slope * span)}`, class: 'calc-tangent' }));
      plot.append(el('circle', { cx: this.x(t), cy: this.y(value), r: 4, class: 'calc-point' }));
    }
    const last = samples.at(-1);
    svg.append(el('circle', { cx: this.x(last.t), cy: this.y(last[key]), r: 3, fill: color }));
    const legend = overlays.filter(o => o.legend);
    legend.forEach((o, i) => svg.append(el('text', { x: 160 + i * 74, y: 17, class: 'graph-tick', style: `fill:${o.color}` }, `┄ ${o.legend}`)));
    svg.setAttribute('aria-label', `${label} versus time. Latest ${fmt(last[key])} ${unit} at ${last.t.toFixed(2)} s.${tangent ? ` Tangent slope at ${tangent.t.toFixed(2)} s is ${fmt(tangent.slope)}.` : ''}${legend.length ? ` Overlays: ${legend.map(o => o.legend).join(', ')}.` : ''}`);
  }
}

/** Log-scale plot of |numerical − exact| (or any positive quantity) against time. */
export class LogGraph {
  constructor(svg, label, unit) { Object.assign(this, { svg, label, unit }); }
  render(series, endTime, { floor = 1e-12 } = {}) {
    const { svg } = this;
    svg.replaceChildren();
    svg.append(el('text', { x: 10, y: 17, class: 'graph-unit' }, `${this.label}${this.unit ? ` (${this.unit})` : ''}, log`));
    const vals = series.flatMap(s => s.data.map(p => p.value)).filter(v => v > floor && Number.isFinite(v));
    if (!vals.length) { svg.append(el('text', { x: 200, y: 80, 'text-anchor': 'middle', class: 'graph-tick' }, 'Choose a method to compare.')); return; }
    const lo = Math.floor(Math.log10(Math.min(...vals))), hi = Math.ceil(Math.log10(Math.max(...vals)));
    const top = hi === lo ? hi + 1 : hi;
    const x = t => L + t / endTime * (R - L), y = v => B - (Math.log10(Math.max(v, 10 ** lo)) - lo) / (top - lo) * (B - T);
    const step = Math.max(1, Math.ceil((top - lo) / 4));
    for (let p = lo; p <= top; p += step) {
      svg.append(el('path', { d: `M${L} ${y(10 ** p)}H${R}`, class: 'graph-grid' }));
      svg.append(el('text', { x: L - 6, y: y(10 ** p) + 4, 'text-anchor': 'end', class: 'graph-tick' }, `1e${p}`));
    }
    svg.append(el('path', { d: `M${L} ${T}V${B}H${R}`, class: 'graph-grid' }));
    for (let i = 0; i <= 4; i++) svg.append(el('text', { x: x(endTime * i / 4), y: B + 16, 'text-anchor': 'middle', class: 'graph-tick' }, (endTime * i / 4).toFixed(1)));
    svg.append(el('text', { x: (L + R) / 2, y: B + 32, 'text-anchor': 'middle', class: 'graph-tick' }, 'Time (s)'));
    series.forEach((s, i) => {
      const pts = s.data.filter(p => p.value > floor);
      if (pts.length > 1) svg.append(el('path', { d: pts.map((p, j) => `${j ? 'L' : 'M'}${x(p.t).toFixed(2)} ${y(p.value).toFixed(2)}`).join(' '), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-dasharray': s.dash || '' }));
      svg.append(el('text', { x: 390 - (series.length - 1 - i) * 78, y: 17, 'text-anchor': 'end', class: 'graph-tick', style: `fill:${s.color}` }, s.label));
    });
    svg.setAttribute('aria-label', `${this.label} on a log scale. ${series.map(s => `${s.label}: ${s.data.at(-1)?.value.toExponential(1)} at the end`).join('. ')}.`);
  }
}
