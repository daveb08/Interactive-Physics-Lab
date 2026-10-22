/** Small SVG x–y plot (curves, markers, zero line) for graphs whose x-axis is not time. */
const nice = (lo, hi, n = 4) => {
  const span = hi - lo || 1, raw = span / n, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
  const step = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p, out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-6; v += step) out.push(+v.toPrecision(10));
  return out;
};
const fmt = v => (Math.abs(v) >= 100 ? v.toFixed(0) : +v.toPrecision(3)).toString();

export class XYPlot {
  constructor(svg, { title, xLabel, yLabel, width = 400, height = 210 } = {}) {
    Object.assign(this, { svg, title, xLabel, yLabel, w: width, h: height, L: 48, R: 14, T: 26, B: 34 });
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  /** { x: [lo, hi], y: [lo, hi], series: [{ points: [[x, y]], color, dash, width, legend }], markers: [{ x, y, color, label, r, ey }] } (ey: optional ± error bar in y units) */
  render({ x, y, series = [], markers = [], note = '' }) {
    const { L, R, T, B, w, h } = this, X = v => L + (v - x[0]) / (x[1] - x[0]) * (w - L - R), Y = v => h - B - (v - y[0]) / (y[1] - y[0]) * (h - T - B);
    const inY = v => Math.min(h - B, Math.max(T, Y(v)));
    let s = `<text x="${L}" y="15" class="xy-title">${this.title}</text>`;
    if (note) s += `<text x="${w - R}" y="15" class="xy-note">${note}</text>`;
    for (const v of nice(...y)) s += `<line x1="${L}" x2="${w - R}" y1="${Y(v)}" y2="${Y(v)}" class="${Math.abs(v) < 1e-12 ? 'xy-zero' : 'xy-grid'}"/><text x="${L - 6}" y="${Y(v) + 3.5}" class="xy-tick xy-tick-y">${fmt(v)}</text>`;
    for (const v of nice(...x, 5)) s += `<line x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${h - B}" class="xy-grid"/><text x="${X(v)}" y="${h - B + 14}" class="xy-tick">${fmt(v)}</text>`;
    s += `<text x="${(L + w - R) / 2}" y="${h - 4}" class="xy-label">${this.xLabel}</text>`;
    s += `<text transform="translate(12 ${(T + h - B) / 2}) rotate(-90)" class="xy-label">${this.yLabel}</text>`;
    s += `<clipPath id="${this.svg.id}-clip"><rect x="${L}" y="${T}" width="${w - L - R}" height="${h - T - B}"/></clipPath><g clip-path="url(#${this.svg.id}-clip)">`;
    for (const se of series) if (se.points.length > 1) s += `<polyline points="${se.points.map(([a, b]) => `${X(a).toFixed(1)},${inY(b).toFixed(1)}`).join(' ')}" fill="none" stroke="${se.color}" stroke-width="${se.width ?? 2.2}" ${se.dash ? `stroke-dasharray="${se.dash}"` : ''} stroke-linejoin="round"/>`;
    s += '</g>';
    let ly = T + 10;   // legend: stacked at the top right, inside the plot area
    for (const se of series) if (se.legend) { const lx = w - R - 8 - se.legend.length * 5.4; s += `<rect x="${lx - 24}" y="${ly - 8}" width="${se.legend.length * 5.4 + 30}" height="15" class="xy-legend-bg"/><line x1="${lx - 20}" x2="${lx - 4}" y1="${ly}" y2="${ly}" stroke="${se.color}" stroke-width="2.4" ${se.dash ? `stroke-dasharray="${se.dash}"` : ''}/><text x="${lx}" y="${ly + 3.5}" class="xy-legend">${se.legend}</text>`; ly += 16; }
    for (const m of markers) if (m.ey > 0 && m.x >= x[0] && m.x <= x[1]) { const X1 = X(m.x).toFixed(1), a = inY(m.y - m.ey), b = inY(m.y + m.ey); s += `<path d="M${X1} ${a}V${b}M${+X1 - 4} ${a}h8M${+X1 - 4} ${b}h8" stroke="${m.color}" stroke-width="1.4" fill="none"/>`; }   // optional ± error bar
    for (const m of markers) if (m.x >= x[0] && m.x <= x[1]) s += `<circle cx="${X(m.x)}" cy="${inY(m.y)}" r="${m.r ?? 4.5}" fill="${m.color}" stroke="white" stroke-width="1.5"/>${m.label ? `<text x="${X(m.x) + 7}" y="${inY(m.y) - 7}" class="xy-mlabel" fill="${m.color}">${m.label}</text>` : ''}`;
    this.svg.innerHTML = s;
  }
}
