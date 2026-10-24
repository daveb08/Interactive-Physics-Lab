const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs, content) => {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (content !== undefined) node.textContent = content;
  return node;
};

/**
 * Round tick values ("nice" steps of 1, 2, 2.5 or 5 × 10ⁿ) covering [min, max], using at most
 * maxTicks labels so they never crowd. Zero is a tick whenever it lies in the range.
 */
export function niceTicks(min, max, maxTicks) {
  const span = max - min;
  if (!(span > 0) || maxTicks < 2) return { step: 1, ticks: [min], decimals: 0 };
  const raw = span / (maxTicks - 1), pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= raw * (1 - 1e-9));
  let decimals = 0;
  while (decimals < 4 && Math.abs(Math.round(step * 10 ** decimals) - step * 10 ** decimals) > 1e-6) decimals++;
  const ticks = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toFixed(decimals + 2));
  return { step, ticks, decimals };
}

/** Drawing size in screen pixels: text stays the same size, and the plot grows in both directions as the column widens. */
export function graphSize(width) {
  const W = Math.max(300, Math.round(width || 400));
  return { W, H: Math.min(330, Math.max(175, Math.round(W * 0.5))) };
}

export class MotionGraph {
  constructor(svg, key, label, unit, color) {
    Object.assign(this, { svg, key, label, unit, color, last: null, width: 0 });
    svg.classList.add('motion-graph');
    // Re-draw at the new size when the graph column is resized (by the user or the window).
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => {
      if (this.last && Math.abs(this.measure() - this.width) > 2) this.render(...this.last);
    }).observe(svg);
    // The text-size control (A / A+ / A++) fires a resize event: re-draw so spacing follows the text.
    if (typeof window !== 'undefined') window.addEventListener('resize', () => { if (this.last) this.render(...this.last); });
  }
  measure() {
    const { svg } = this, box = svg.getBoundingClientRect();
    if (!box.width) return this.width || 400;
    const style = getComputedStyle(svg);
    return box.width - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
  }
  render(samples, endTime, options = {}) {
    this.last = [samples, endTime, options];
    const { reference = null, references = reference ? [reference] : [], events = [], seriesLabels = null } = options;
    const { svg, key, label, unit, color } = this;
    this.width = this.measure();
    const { W, H } = graphSize(this.width);
    // (ts: the page text scale; graph text follows it because the drawing is 1 unit = 1 screen pixel.)
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren();
    const ts = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ts')) || 1;
    const L = Math.round(58 * ts), R = W - 14, T = Math.round(30 * ts), B = Math.round(H - 40 * ts);
    // Always include zero and pad both extrema so signed values remain legible.
    const values = [...samples, ...references.flat()].map(s => s[key]);
    const low = Math.min(0, ...values), high = Math.max(0, ...values);
    const pad = Math.max((high - low) * 0.18, key === 'a' ? 0.5 : 1);
    const min = low - pad, max = high + pad;
    const x = t => L + t / endTime * (R - L);
    const y = value => B - (value - min) / (max - min) * (B - T);
    svg.append(el('text', { x: 10, y: Math.round(18 * ts), class: 'graph-unit' }, `${label} (${unit})`));
    // Vertical labels at least 26 px apart, so they never run together.
    const yTicks = niceTicks(min, max, Math.max(2, Math.floor((B - T) / (26 * ts)) + 1));
    for (const value of yTicks.ticks) {
      svg.append(el('path', { d: `M${L} ${y(value).toFixed(1)}H${R}`, class: value === 0 ? 'graph-zero' : 'graph-grid' }));
      svg.append(el('text', { x: L - 8, y: (y(value) + 5).toFixed(1), 'text-anchor': 'end', class: 'graph-tick' }, value.toFixed(yTicks.decimals)));
    }
    svg.append(el('path', { d: `M${L} ${T}V${B}H${R}`, class: 'graph-grid' }));
    const xTicks = niceTicks(0, endTime, Math.max(2, Math.floor((R - L) / (56 * ts)) + 1));
    for (const t of xTicks.ticks) svg.append(el('text', { x: x(t).toFixed(1), y: B + Math.round(18 * ts), 'text-anchor': 'middle', class: 'graph-tick' }, t.toFixed(xTicks.decimals)));
    svg.append(el('text', { x: (L + R) / 2, y: H - 4, 'text-anchor': 'middle', class: 'graph-tick' }, 'Time (s)'));
    const curve = (data, stroke, dash = '') => el('path', { d: data.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(2)} ${y(s[key]).toFixed(2)}`).join(' '), fill: 'none', stroke, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-dasharray': dash });
    const colors = [color, '#b65b25', '#7851a9'];
    const dashes = ['', '6 4', '2 3'];
    references.forEach((data, i) => svg.append(curve(data, colors[i], dashes[i])));
    if (references.length) {
      const n = references.length + 1;
      for (let i = 0; i < n; i++) svg.append(el('text', { x: R - (n - 1 - i) * 80, y: Math.round(18 * ts), 'text-anchor': 'end', class: 'graph-tick graph-series', style: `fill:${colors[i]}` }, `${['—', '┄', '··'][i]} ${seriesLabels?.[i] || `Run ${i + 1}`}`));
    }
    const activeColor = colors[references.length];
    svg.append(curve(samples, activeColor, dashes[references.length]));
    for (const event of events) svg.append(el('path', { d: `M${x(event.t)} ${T}V${B}`, stroke: '#707b73', 'stroke-width': 1, 'stroke-dasharray': '2 3', fill: 'none' }));
    // Event names go in one line above the plot (top right), where they cannot cover the curves.
    if (events.length && !references.length) svg.append(el('text', { x: R, y: Math.round(18 * ts), 'text-anchor': 'end', class: 'graph-tick graph-event' },
      events.map(e => `${e.label.startsWith('Stop') ? 'Stop' : e.label} ${e.t.toFixed(2)} s`).join(' · ')));
    const last = samples.at(-1);
    svg.append(el('circle', { cx: x(last.t), cy: y(last[key]), r: 3.5, fill: activeColor }));
    const referenceDescription = references.map((data,i) => `${seriesLabels?.[i] || `Run ${i+1}`}: ${data.at(-1)[key].toFixed(2)} ${unit} at ${data.at(-1).t.toFixed(2)} seconds. `).join('');
    svg.setAttribute('aria-label', `${label} versus time. ${referenceDescription}${references.length ? `${seriesLabels?.[references.length] || `Run ${references.length+1}`}: ` : 'Latest: '}${last[key].toFixed(2)} ${unit} at ${last.t.toFixed(2)} seconds. ${events.map(e => `${e.label} at ${e.t.toFixed(3)} seconds.`).join(' ')}`);
  }
}
