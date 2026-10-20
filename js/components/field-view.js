/**
 * Charge plane: an SVG grid in metres with draggable point charges and force arrows (Module 06, Unit 1).
 * Charges are draggable by pointer (snapped to 1 cm) and by keyboard: Tab to a charge, arrow keys move it
 * 1 cm (Shift: 5 cm). Charge elements persist between renders so keyboard focus is never lost.
 */
const NS = 'http://www.w3.org/2000/svg';
const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
export const sub = n => String(n).split('').map(d => SUB[+d] ?? d).join('');
export const COLORS = { pos: '#bf4630', neg: '#2f6db5', net: '#1f6b5e', part: '#7a8a84', comp: '#8a6d1f' };
const MAX_ARROW = 175;

export class ChargePlane {
  constructor(svg, { width = 1, height = 0.6, margin = 22, scale = 600, onChange, onSelect, canMove = () => true, constrain = (i, x, y) => ({ x, y }) } = {}) {
    Object.assign(this, { svg, width, height, margin, S: scale, onChange, onSelect, canMove, constrain });
    this.W = width * scale + 2 * margin; this.H = height * scale + 2 * margin;
    svg.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    svg.innerHTML = `<defs>${Object.entries(COLORS).map(([k, c]) => `<marker id="fv-tip-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`).join('')}</defs>`
      + `<g class="fv-grid">${this.grid()}</g><g class="fv-line"></g><g class="fv-arrows"></g><g class="fv-charges"></g><g class="fv-overlay"></g>`;
    this.layer = n => svg.querySelector(`.fv-${n}`);
    this.nodes = [];
    this.drag = null;
    svg.addEventListener('pointermove', e => this.move(e));
    for (const ev of ['pointerup', 'pointercancel']) svg.addEventListener(ev, () => { this.drag = null; this.svg.classList.remove('fv-dragging'); });
  }
  px(x, y) { return [this.margin + x * this.S, this.margin + (this.height - y) * this.S]; }
  toM(X, Y) { return { x: (X - this.margin) / this.S, y: this.height - (Y - this.margin) / this.S }; }
  grid() {
    let h = `<rect x="${this.margin}" y="${this.margin}" width="${this.width * this.S}" height="${this.height * this.S}" class="fv-bg"/>`;
    for (let i = 0; i <= Math.round(this.width * 20); i++) { const [X] = this.px(i / 20, 0); h += `<line x1="${X}" y1="${this.margin}" x2="${X}" y2="${this.H - this.margin}" class="${i % 2 ? 'fv-minor' : 'fv-major'}"/>`; }
    for (let i = 0; i <= Math.round(this.height * 20); i++) { const [, Y] = this.px(0, i / 20); h += `<line x1="${this.margin}" y1="${Y}" x2="${this.W - this.margin}" y2="${Y}" class="${i % 2 ? 'fv-minor' : 'fv-major'}"/>`; }
    for (let i = 0; i <= Math.round(this.width * 10); i += 2) { const [X, Y] = this.px(i / 10, 0); h += `<text x="${X}" y="${Y + 15}" class="fv-tick">${(i / 10).toFixed(1)}</text>`; }
    for (let i = 2; i <= Math.round(this.height * 10); i += 2) { const [X, Y] = this.px(0, i / 10); h += `<text x="${X - 5}" y="${Y + 4}" class="fv-tick fv-tick-y">${(i / 10).toFixed(1)}</text>`; }
    const [X0, Y0] = this.px(this.width, 0);
    h += `<text x="${X0 - 2}" y="${Y0 - 6}" class="fv-axis">x (m)</text>`;
    return h;
  }
  arrow(x, y, fx, fy, scale, kind, label, side = 0) {
    const F = Math.hypot(fx, fy); if (!(F > 0)) return '';
    const len = F * scale, L = Math.min(len, MAX_ARROW); if (L < 3) return '';
    const ux = fx / F, uy = -fy / F, [X, Y] = this.px(x, y), r0 = 13;
    const x1 = X + ux * r0, y1 = Y + uy * r0, x2 = X + ux * (r0 + L), y2 = Y + uy * (r0 + L);
    const cls = `fv-arrow fv-${kind}`;
    let h = `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${cls}" marker-end="url(#fv-tip-${kind})"/>`;
    if (len > MAX_ARROW) { const mx = X + ux * (r0 + L * 0.55), my = Y + uy * (r0 + L * 0.55); h += `<path d="M${mx - uy * 6 - ux * 3} ${my + ux * 6 - uy * 3}l${uy * 12} ${-ux * 12}M${mx - uy * 6 + ux * 3} ${my + ux * 6 + uy * 3}l${uy * 12} ${-ux * 12}" class="fv-break"/>`; }
    const ox = -uy * 11 * side, oy = ux * 11 * side;   // push labels of overlapping arrows to opposite sides
    if (label) h += `<text x="${(x2 + ux * 13 + ox).toFixed(1)}" y="${(y2 + uy * 13 + oy + 4).toFixed(1)}" class="fv-flabel fv-${kind}-t">${label}</text>`;
    return h;
  }
  /**
   * charges: [{ q (C), x, y }], forces: [{ fx, fy, parts: [{ j, fx, fy }] }] or null,
   * opts: { selected, scale (px per N), showParts, showNet, showComponents, line: { y, from, to }, movable: Set }
   */
  render(charges, forces, opts = {}) {
    const { selected = 0, scale = 100, showParts = true, showNet = true, showComponents = false, line = null } = opts;
    this.charges = charges;
    // optional constraint line (C3)
    this.layer('line').innerHTML = line ? (() => { const [a, Y] = this.px(line.from, line.y), [b] = this.px(line.to, line.y); return `<line x1="${a}" y1="${Y}" x2="${b}" y2="${Y}" class="fv-track"/>`; })() : '';
    // arrows
    let h = '';
    if (forces) charges.forEach((c, i) => {
      const f = forces[i], many = charges.length > 2;
      if (showParts) for (const p of f.parts) h += this.arrow(c.x, c.y, p.fx, p.fy, scale, many ? 'part' : 'net', `F${sub(i + 1)}${sub(p.j + 1)}`, many ? 1 : 0);
      if (many && showNet) h += this.arrow(c.x, c.y, f.fx, f.fy, scale, 'net', 'F<tspan class="fv-sub" dy="4">net</tspan>', -1);
      if (showComponents && i === selected) {
        h += this.arrow(c.x, c.y, f.fx, 0, scale, 'comp', 'F<tspan class="fv-sub" dy="4">x</tspan>');
        h += this.arrow(c.x, c.y, 0, f.fy, scale, 'comp', 'F<tspan class="fv-sub" dy="4">y</tspan>');
      }
    });
    this.layer('arrows').innerHTML = h;
    // charges: persistent nodes
    const g = this.layer('charges');
    while (this.nodes.length > charges.length) this.nodes.pop().remove();
    while (this.nodes.length < charges.length) {
      const i = this.nodes.length, n = document.createElementNS(NS, 'g');
      n.setAttribute('tabindex', '0'); n.setAttribute('role', 'button'); n.classList.add('fv-charge');
      n.innerHTML = '<circle class="fv-halo" r="22"/><circle class="fv-body"/><text class="fv-sign" y="6"></text><text class="fv-name" y="-24"></text>';
      n.addEventListener('pointerdown', e => this.down(e, i));
      n.addEventListener('keydown', e => this.key(e, i));
      n.addEventListener('focus', () => this.onSelect?.(i));
      g.append(n); this.nodes.push(n);
    }
    charges.forEach((c, i) => {
      const n = this.nodes[i], [X, Y] = this.px(c.x, c.y), uC = c.q * 1e6, movable = this.canMove(i);
      n.setAttribute('transform', `translate(${X.toFixed(1)} ${Y.toFixed(1)})`);
      n.classList.toggle('fv-selected', i === selected);
      n.classList.toggle('fv-fixed', !movable);
      n.setAttribute('aria-disabled', String(!movable));
      n.querySelector('.fv-body').setAttribute('r', (10 + Math.sqrt(Math.abs(uC)) * 1.6).toFixed(1));
      n.querySelector('.fv-body').setAttribute('fill', uC >= 0 ? COLORS.pos : COLORS.neg);
      n.querySelector('.fv-sign').textContent = uC >= 0 ? '+' : '−';
      n.querySelector('.fv-name').textContent = `q${sub(i + 1)} ${uC > 0 ? '+' : '−'}${+Math.abs(uC).toFixed(1)} μC`;
      n.setAttribute('aria-label', `Charge q${i + 1}, ${uC > 0 ? 'plus' : 'minus'} ${+Math.abs(uC).toFixed(1)} microcoulombs, at x ${c.x.toFixed(2)} metres, y ${c.y.toFixed(2)} metres.${movable ? ' Arrow keys move it.' : ' Fixed in this activity.'}`);
    });
  }
  overlay(html) { this.layer('overlay').innerHTML = html; }
  down(e, i) {
    this.onSelect?.(i);
    if (!this.canMove(i)) return;
    e.preventDefault();
    this.nodes[i].focus({ preventScroll: true });
    this.drag = { i };
    this.svg.setPointerCapture?.(e.pointerId);
    this.svg.classList.add('fv-dragging');
  }
  move(e) {
    if (!this.drag) return;
    const m = this.svg.getScreenCTM(); if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()), q = this.toM(p.x, p.y);
    this.place(this.drag.i, Math.round(q.x * 100) / 100, Math.round(q.y * 100) / 100);
  }
  key(e, i) {
    const d = e.shiftKey ? 0.05 : 0.01, k = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }[e.key];
    if (!k || !this.canMove(i)) return;
    e.preventDefault();
    const c = this.charges[i];
    this.place(i, Math.round((c.x + k[0]) * 100) / 100, Math.round((c.y + k[1]) * 100) / 100);
  }
  place(i, x, y) {
    const pad = 0.02;
    x = Math.min(this.width - pad, Math.max(pad, x)); y = Math.min(this.height - pad, Math.max(pad, y));
    const p = this.constrain(i, x, y);
    if (p) this.onChange?.(i, p.x, p.y);
  }
}
