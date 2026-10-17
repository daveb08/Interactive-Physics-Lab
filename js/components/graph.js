const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs, content) => {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (content !== undefined) node.textContent = content;
  return node;
};
export class MotionGraph {
  constructor(svg, key, label, unit, color) { Object.assign(this, { svg, key, label, unit, color }); }
  render(samples, endTime, { reference = null, references = reference ? [reference] : [], events = [], seriesLabels = null } = {}) {
    const { svg, key, label, unit, color } = this;
    svg.replaceChildren();
    // Always include zero and pad both extrema so signed values remain legible.
    const values = [...samples, ...references.flat()].map(s => s[key]);
    const low = Math.min(0, ...values), high = Math.max(0, ...values);
    const pad = Math.max((high - low) * 0.18, key === 'a' ? 0.5 : 1);
    const min = low - pad, max = high + pad;
    const x = t => 54 + t / endTime * 330;
    const y = value => 120 - (value - min) / (max - min) * 86;
    svg.append(el('text', { x: 10, y: 17, class: 'graph-unit' }, `${label} (${unit})`));
    for (let i = 0; i < 3; i++) {
      const value = low + (high - low) * i / 2;
      if (high === low && i !== 0) continue;
      svg.append(el('path', { d: `M54 ${y(value)}H384`, class: value === 0 ? 'graph-zero' : 'graph-grid' }));
      svg.append(el('text', { x: 46, y: y(value) + 4, 'text-anchor': 'end', class: 'graph-tick' }, value.toFixed(Math.abs(value) < 10 ? 1 : 0)));
    }
    svg.append(el('path', { d: 'M54 30V120H384', class: 'graph-grid' }));
    for (let i = 0; i <= 3; i++) {
      const t = endTime * i / 3;
      svg.append(el('text', { x: x(t), y: 137, 'text-anchor': 'middle', class: 'graph-tick' }, t.toFixed(1)));
    }
    svg.append(el('text', { x: 220, y: 155, 'text-anchor': 'middle', class: 'graph-tick' }, 'Time (s)'));
    const curve = (data, stroke, dash = '') => el('path', { d: data.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(2)} ${y(s[key]).toFixed(2)}`).join(' '), fill: 'none', stroke, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-dasharray': dash });
    const colors = [color, '#b65b25', '#7851a9'];
    const dashes = ['', '6 4', '2 3'];
    references.forEach((data, i) => svg.append(curve(data, colors[i], dashes[i])));
    if (references.length) {
      for (let i = 0; i <= references.length; i++) svg.append(el('text', {x:155 + i*77, y:17, class:'graph-tick', style:`fill:${colors[i]}`}, `${['—','┄','··'][i]} ${seriesLabels?.[i] || `Run ${i+1}`}`));
    }
    const activeColor = colors[references.length];
    svg.append(curve(samples, activeColor, dashes[references.length]));
    for (const event of events) {
      svg.append(el('path', {d:`M${x(event.t)} 30V120`, stroke:'#707b73', 'stroke-width':1, 'stroke-dasharray':'2 3', fill:'none'}));
      svg.append(el('text', {x:Math.max(56,Math.min(300,x(event.t)+4)),y:28,class:'graph-tick'}, `${event.label.startsWith('Stop') ? 'Stop' : event.label} ${event.t.toFixed(2)} s`));
    }
    const last = samples.at(-1);
    svg.append(el('circle', { cx: x(last.t), cy: y(last[key]), r: 3, fill: activeColor }));
    const referenceDescription = references.map((data,i) => `${seriesLabels?.[i] || `Run ${i+1}`}: ${data.at(-1)[key].toFixed(2)} ${unit} at ${data.at(-1).t.toFixed(2)} seconds. `).join('');
    svg.setAttribute('aria-label', `${label} versus time. ${referenceDescription}${references.length ? `${seriesLabels?.[references.length] || `Run ${references.length+1}`}: ` : 'Latest: '}${last[key].toFixed(2)} ${unit} at ${last.t.toFixed(2)} seconds. ${events.map(e => `${e.label} at ${e.t.toFixed(3)} seconds.`).join(' ')}`);
  }
}
