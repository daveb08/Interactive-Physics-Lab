import { TRACK, forceBalance } from '../core/physics.js';

export class CartView {
  /** scale > 1 draws a larger cart (wheels stay on the rail); force arrows above it move up to match. */
  constructor(svg, { scale = 1 } = {}) {
    this.svg = svg;
    this.scale = scale;
    this.lift = Math.round((scale - 1) * (203 - 158));   // how far the cart top rises
    const ticks = Array.from({ length: 11 }, (_, i) => {
      const x = 70 + i * 64;
      return `<path d="M${x} 207v9"/><text x="${x}" y="239">${i * 10 - 50}</text>`;
    }).join('');
    svg.innerHTML = `<defs>${[['force','#c24c2a'],['friction','#7851a9'],['net','#236d62']].map(([id,color]) => `<marker id="${id}-tip" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${color}"/></marker>`).join('')}</defs>
      <text id="surface-label" x="390" y="35" class="scene-note">FRICTIONLESS HORIZONTAL TRACK</text>
      <path d="M70 203H710" class="rail"/><path d="M70 207H710" class="axis"/>
      <g class="ticks">${ticks}</g><path d="M390 65V200" class="origin"/>
      <path d="M70 178v25M710 178v25" class="limit"/>
      <text x="390" y="269" class="scene-note axis-note">Position x (m) · origin at center · positive to the right →</text>
      <g id="cart">${scale > 1 ? '<path class="cart-pointer" d="M0 208l-6 10h12z"/>' : ''}<g class="cart-shape"${scale === 1 ? '' : ` transform="translate(0 203) scale(${scale}) translate(0 -203)"`}><rect x="-24" y="158" width="48" height="32" rx="6" class="cart-body"/><path d="M-16 166H16" class="cart-highlight"/><circle cx="-14" cy="195" r="7" class="wheel"/><circle cx="14" cy="195" r="7" class="wheel"/><text id="cart-mass" y="180" class="cart-mass"></text></g><path id="force-arrow" class="force-arrow" marker-end="url(#force-tip)"/><text id="force-label" class="force-label"></text><g id="extra-forces"><path id="friction-arrow" class="friction-arrow" marker-end="url(#friction-tip)"/><text id="friction-label" class="friction-label"></text><path id="net-arrow" class="net-arrow" marker-end="url(#net-tip)"/><text id="net-label" class="net-label"></text></g></g>`;
    this.cart = svg.querySelector('#cart');
    this.arrow = svg.querySelector('#force-arrow');
    this.label = svg.querySelector('#force-label');
    this.mass = svg.querySelector('#cart-mass');
    this.view = TRACK;
    this.defaultTicks = svg.querySelector('.ticks').innerHTML;
  }
  /** Map positions onto the scene. Default is the full ±50 m track; a narrower view zooms in (display only). */
  toPx(x) { return 70 + (x - this.view.min) / (this.view.max - this.view.min) * 640; }
  setView(view = TRACK) {
    this.view = view;
    const full = view.min === TRACK.min && view.max === TRACK.max, q = s => this.svg.querySelector(s);
    if (full) q('.ticks').innerHTML = this.defaultTicks;
    else {
      const span = view.max - view.min, step = [0.5, 1, 2, 5, 10].find(s => span / s <= 12) ?? 10;
      let html = '';
      for (let v = Math.ceil(view.min / step) * step; v <= view.max + 1e-9; v += step) {
        const x = this.toPx(v);
        html += `<path d="M${x} 207v9"/><text x="${x}" y="239">${+v.toFixed(2)}</text>`;
      }
      q('.ticks').innerHTML = html;
    }
    q('.origin').setAttribute('d', `M${this.toPx(0)} 65V200`);
    q('.limit').style.display = full ? '' : 'none';   // ±50 m ends are off-screen in a zoomed view
    q('.axis-note').textContent = full ? 'Position x (m) · origin at center · positive to the right →' : `Position x (m) · zoomed view ${view.min} to ${view.max} m · positive to the right →`;
  }
  render(run, { reveal = true } = {}) {
    const px = this.toPx(run.state.x);
    this.cart.setAttribute('transform', `translate(${px} 0)`);
    // Capped so large forces (e.g. 350 N in applied problems) stay on screen; ≤ 20 N is unchanged.
    const length = Math.sign(run.force) * Math.min(22 + Math.abs(run.force) * 2, 140);
    const up = this.lift;
    this.arrow.setAttribute('d', `M0 ${137 - up}h${length}`);
    this.arrow.style.display = run.force === 0 ? 'none' : '';
    this.label.textContent = `${run.force > 0 ? '+' : ''}${run.force} N`;
    this.label.setAttribute('x', '0');
    this.label.setAttribute('y', String(120 - up));
    this.svg.querySelector('#extra-forces').style.display = run.frictionEnabled && reveal ? '' : 'none';
    const label = this.svg.querySelector('#surface-label');
    if (run.frictionEnabled) label.innerHTML = 'HORIZONTAL TRACK · DRY FRICTION · f = μF<tspan dy="3" font-size="0.8em">N</tspan>';
    else label.textContent = 'FRICTIONLESS HORIZONTAL TRACK';
    if (run.frictionEnabled) {
      const balance = forceBalance(run);
      const scale = 60 / Math.max(20, Math.abs(run.force), Math.abs(balance.friction), Math.abs(balance.netForce));
      this.arrow.setAttribute('d', `M0 ${85 - up}h${run.force * scale}`);
      this.label.setAttribute('y', String(75 - up));
      for (const [id, value, y] of [['friction',balance.friction,115 - up],['net',balance.netForce,145 - up]]) {
        const arrow = this.svg.querySelector(`#${id}-arrow`);
        arrow.setAttribute('d', `M0 ${y}h${value * scale}`);
        arrow.style.display = value === 0 ? 'none' : '';
        const text = this.svg.querySelector(`#${id}-label`);
        text.setAttribute('y', String(y - 10));
        text.textContent = `${value > 0 ? '+' : ''}${value.toFixed(2)} N`;
      }
    }
    this.mass.textContent = `${run.mass} kg`;
    this.svg.setAttribute('aria-label', `Cart at ${run.state.x.toFixed(2)} meters, velocity ${run.state.v.toFixed(2)} meters per second; applied force ${run.force} newtons.`);
  }
}
