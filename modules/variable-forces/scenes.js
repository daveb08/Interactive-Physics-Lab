/** SVG scenes for the Forces That Change module. Positions in metres; forces in newtons. */
const tip = (id, color) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${color}"/></marker>`;
const signed = (v, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`;

function setArrow(path, label, y, length, text) {
  path.setAttribute('d', `M0 ${y}h${length}`);
  path.style.display = Math.abs(length) < 1 ? 'none' : '';
  label.textContent = text;
  label.setAttribute('x', String(Math.max(-150, Math.min(150, length / 2))));
  label.setAttribute('y', String(y - 8));
}

export class DragScene {
  constructor(svg) {
    this.svg = svg;
    const ticks = Array.from({ length: 6 }, (_, i) => { const x = 70 + i * 128; return `<path d="M${x} 207v9"/><text x="${x}" y="239">${i * 10}</text>`; }).join('');
    svg.innerHTML = `<defs>${tip('vf-applied', '#c24c2a')}${tip('vf-drag', '#7851a9')}</defs>
      <text x="390" y="30" class="scene-note" id="drag-surface">HORIZONTAL TRACK · DRAG OPPOSES MOTION</text>
      <path d="M70 203H710" class="rail"/><path d="M70 207H710" class="axis"/><g class="ticks">${ticks}</g>
      <path d="M710 178v25" class="limit"/>
      <text x="390" y="262" class="scene-note">Position x (m) · start at 0 · positive to the right →</text>
      <g id="drag-cart"><g id="drag-streaks"></g><rect x="-24" y="158" width="48" height="32" rx="6" class="cart-body"/><path d="M-16 166H16" class="cart-highlight"/><circle cx="-14" cy="195" r="7" class="wheel"/><circle cx="14" cy="195" r="7" class="wheel"/><text id="drag-mass" y="180" class="cart-mass"></text>
      <path id="drag-applied" class="force-arrow" marker-end="url(#vf-applied)"/><text id="drag-applied-label" class="force-label"></text>
      <path id="drag-drag" class="drag-arrow" marker-end="url(#vf-drag)"/><text id="drag-drag-label" class="drag-label"></text></g>`;
    this.cart = svg.querySelector('#drag-cart');
  }
  setModel(model) {
    this.model = model;
    const maxDrag = model.law === 'linear' ? model.coef * Math.max(model.v0, model.vT) : model.coef * Math.max(model.v0, model.vT) ** 2;
    this.scale = 110 / Math.max(model.force, maxDrag, 1);
    this.svg.querySelector('#drag-mass').textContent = `${model.mass} kg`;
  }
  render(s) {
    const q = this.svg.querySelector.bind(this.svg);
    this.cart.setAttribute('transform', `translate(${70 + s.x / 50 * 640} 0)`);
    setArrow(q('#drag-applied'), q('#drag-applied-label'), 112, s.fApplied * this.scale, `F = ${signed(s.fApplied, 1)} N`);
    setArrow(q('#drag-drag'), q('#drag-drag-label'), 140, s.fDrag * this.scale, `F_drag = ${signed(s.fDrag)} N`);
    const n = Math.min(4, Math.round(s.v));
    q('#drag-streaks').innerHTML = Array.from({ length: n }, (_, i) => `<path d="M${-34 - i * 9} ${166 + i * 6}h${-12 - s.v * 2}" class="streak"/>`).join('');
    this.svg.setAttribute('aria-label', `Cart at ${s.x.toFixed(2)} m moving at ${s.v.toFixed(2)} m/s. Applied force ${s.fApplied} N; drag force ${s.fDrag.toFixed(2)} N.`);
  }
}

export class OscillatorScene {
  constructor(svg) {
    this.svg = svg;
    svg.innerHTML = `<defs>${tip('vf-spring', '#236d62')}${tip('vf-damp', '#7851a9')}
      <pattern id="vf-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v8" stroke="#9fb0a4" stroke-width="2"/></pattern></defs>
      <text x="390" y="30" class="scene-note">SPRING AND DAMPER · FRICTIONLESS FLOOR</text>
      <rect x="40" y="90" width="20" height="120" fill="url(#vf-hatch)"/><path d="M60 90V210" class="limit"/>
      <path d="M60 203H740" class="rail"/>
      <path id="osc-eq" d="M390 70V210" class="origin"/><text id="osc-eq-label" x="390" y="62" class="scene-note">x = 0</text>
      <path id="osc-spring" class="spring-coil"/>
      <g id="osc-damper"><path d="M60 182H120" class="damper-rod"/><rect x="120" y="172" width="70" height="20" rx="3" class="damper-body"/><path id="osc-piston" class="damper-rod"/></g>
      <g id="osc-cart"><rect x="-24" y="140" width="48" height="50" rx="6" class="cart-body"/><path d="M-16 148H16" class="cart-highlight"/><circle cx="-14" cy="195" r="7" class="wheel"/><circle cx="14" cy="195" r="7" class="wheel"/><text id="osc-mass" y="170" class="cart-mass"></text>
      <path id="osc-fs" class="spring-arrow" marker-end="url(#vf-spring)"/><text id="osc-fs-label" class="spring-label"></text>
      <path id="osc-fd" class="drag-arrow" marker-end="url(#vf-damp)"/><text id="osc-fd-label" class="drag-label"></text></g>
      <g class="ticks" id="osc-ticks"></g>
      <text x="390" y="262" class="scene-note">Displacement x (m) from the relaxed spring · positive away from the wall →</text>`;
  }
  setModel(model, fullSamples) {
    this.model = model;
    const maxX = Math.max(...fullSamples.map(s => Math.abs(s.x)), 0.2);
    this.scale = Math.min(250, 300 / maxX);            // px per metre
    const maxF = Math.max(...fullSamples.map(s => Math.max(Math.abs(s.fSpring), Math.abs(s.fDamping))), 1);
    this.fScale = 90 / maxF;
    this.svg.querySelector('#osc-mass').textContent = `${model.mass} kg`;
    const step = maxX > 4 ? 2 : maxX > 2 ? 1 : 0.5, n = Math.floor(330 / this.scale / step);
    let html = '';
    for (let i = -n; i <= n; i++) { const px = 390 + i * step * this.scale; if (px < 80 || px > 740) continue; html += `<path d="M${px} 207v9"/><text x="${px}" y="239">${(i * step).toFixed(step < 1 ? 1 : 0)}</text>`; }
    this.svg.querySelector('#osc-ticks').innerHTML = html;
    this.svg.querySelector('#osc-damper').style.display = model.b > 0 ? '' : 'none';
  }
  render(s) {
    const q = this.svg.querySelector.bind(this.svg), cx = 390 + s.x * this.scale, left = cx - 24;
    q('#osc-cart').setAttribute('transform', `translate(${cx} 0)`);
    const coils = 12, y = 155, w = left - 60;
    let d = `M60 ${y}h${w * 0.06}`;
    for (let i = 0; i < coils; i++) d += `l${(w * 0.88) / coils / 2} ${i % 2 ? 12 : -12}l${(w * 0.88) / coils / 2} ${i % 2 ? -12 : 12}`;
    q('#osc-spring').setAttribute('d', `${d}H${left}`);
    q('#osc-piston').setAttribute('d', `M${Math.max(130, Math.min(185, left - 120))} 175v14M${Math.max(130, Math.min(185, left - 120))} 182H${left}`);
    setArrow(q('#osc-fs'), q('#osc-fs-label'), 92, s.fSpring * this.fScale, `F_spring = ${signed(s.fSpring)} N`);
    setArrow(q('#osc-fd'), q('#osc-fd-label'), 124, s.fDamping * this.fScale, this.model.b > 0 ? `F_damp = ${signed(s.fDamping)} N` : '');
    this.svg.setAttribute('aria-label', `Cart at x = ${s.x.toFixed(3)} m, v = ${s.v.toFixed(3)} m/s. Spring force ${s.fSpring.toFixed(2)} N, damping force ${s.fDamping.toFixed(2)} N.`);
  }
}
