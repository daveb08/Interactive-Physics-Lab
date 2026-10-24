/**
 * Draws the cart's forces two ways:
 *  - on the object: arrows from the cart's centre, moving with the cart in the track scene;
 *  - as a free-body diagram: the cart reduced to a dot, in its own small SVG.
 * Both use one shared scale per drawing, F-with-subscript labels, and a dashed F_net drawn apart
 * from the forces (it is their sum, not another force). Optional "= 6.0 N" values on the labels.
 */
import { arrowLength } from '../core/force-diagram.js';

const NS = 'http://www.w3.org/2000/svg';
export const FORCE_COLORS = { applied: '#c24c2a', friction: '#7851a9', normal: '#2f6db5', weight: '#3f4b47', net: '#236d62' };
function markers(svg, prefix) {
  if (svg.querySelector(`#${prefix}-weight`)) return;
  let defs = svg.querySelector('defs');
  if (!defs) { defs = document.createElementNS(NS, 'defs'); svg.prepend(defs); }
  defs.insertAdjacentHTML('beforeend', Object.entries(FORCE_COLORS).map(([key, color]) =>
    `<marker id="${prefix}-${key}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${color}"/></marker>`).join(''));
}

/** "F_A" as SVG text with a subscript; value (if given) after it. */
function label(sub, value) {
  return `F<tspan dy="5" font-size="0.72em">${sub}</tspan><tspan dy="-5">${value == null ? '' : ` = ${value.toFixed(1)} N`}</tspan>`;
}

/**
 * Every arrow starts at the object's centre (cx, cy). `inset` hides the part of each arrow that lies under
 * the object's outline (on the cart), so the visible length is the to-scale part; on the dot it is zero.
 * Arrows go into `arrows` and labels into `labels`, so on the cart the body can sit between them.
 */
function drawArrows({ arrows, labels }, { forces, net }, { cx, cy, maxLength, minLength, prefix, showValues, netY, inset = { x: 0, up: 0, down: 0 }, weightLabelMid = false, backdrops = false }) {
  const largest = Math.max(...forces.map(f => f.magnitude), net.magnitude);
  const len = f => arrowLength(f.magnitude, largest, { maxLength, minLength });
  // Longer horizontal arrows first, so a shorter one pointing the same way is drawn on top and stays visible.
  const ordered = [...forces].sort((a, b) => (b.fy === 0 && a.fy === 0 ? len(b) - len(a) : 0));
  let arrowHtml = '', labelHtml = '';
  for (const f of ordered) {
    const color = FORCE_COLORS[f.key], value = showValues ? f.magnitude : null, l = len(f);
    if (f.fy === 0) {
      const dir = Math.sign(f.fx), x2 = cx + dir * (inset.x + l);
      // Applied-force label above the line, friction label below, so the two never collide.
      const ly = f.key === 'friction' ? cy + 20 : cy - 9;
      arrowHtml += `<path class="fd-arrow fd-${f.key}" d="M${cx} ${cy}H${x2.toFixed(1)}" stroke="${color}" marker-end="url(#${prefix}-${f.key})"/>`;
      labelHtml += `<text class="fd-label" x="${(x2 + dir * 5).toFixed(1)}" y="${ly}" fill="${color}" text-anchor="${dir > 0 ? 'start' : 'end'}">${label(f.sub, value)}</text>`;
    } else {
      const dir = Math.sign(f.fy), y2 = cy - dir * ((dir > 0 ? inset.up : inset.down) + l);
      arrowHtml += `<path class="fd-arrow fd-${f.key}" d="M${cx} ${cy}V${y2.toFixed(1)}" stroke="${color}" marker-end="url(#${prefix}-${f.key})"/>`;
      // In the track scene the weight label sits beside the shaft so it stays clear of the tick numbers.
      const ly = f.key === 'weight' && weightLabelMid ? cy + inset.down + l * 0.6 : y2 + (dir > 0 ? 6 : 4);
      labelHtml += `<text class="fd-label" x="${cx + 9}" y="${ly.toFixed(1)}" fill="${color}">${label(f.sub, value)}</text>`;
    }
  }
  const nlen = arrowLength(net.magnitude, largest, { maxLength, minLength });
  if (nlen) {
    const dir = Math.sign(net.fx), x2 = cx + dir * nlen;
    arrowHtml += `<path class="fd-arrow fd-net" d="M${cx} ${netY}H${x2.toFixed(1)}" stroke="${FORCE_COLORS.net}" stroke-dasharray="6 4" marker-end="url(#${prefix}-net)"/>`;
    labelHtml += `<text class="fd-label fd-net-label" x="${(x2 + dir * 5).toFixed(1)}" y="${netY + 5}" fill="${FORCE_COLORS.net}" text-anchor="${dir > 0 ? 'start' : 'end'}">${label('net', showValues ? net.magnitude : null)}</text>`;
  } else {
    labelHtml += `<text class="fd-label fd-net-label" x="${cx}" y="${netY + 5}" fill="${FORCE_COLORS.net}" text-anchor="middle">F<tspan dy="5" font-size="0.72em">net</tspan><tspan dy="-5"> = 0</tspan></text>`;
  }
  arrows.innerHTML = arrowHtml;
  labels.innerHTML = labelHtml;
  // In the busy track scene, a soft backdrop keeps labels readable over the rail, wheels and ticks.
  if (backdrops) for (const text of labels.querySelectorAll('.fd-label')) {
    let box;
    try { box = text.getBBox(); } catch { continue; }   // not rendered (e.g. hidden): skip
    if (!box.width) continue;
    const rect = document.createElementNS(NS, 'rect');
    for (const [k, v] of Object.entries({ x: box.x - 3, y: box.y - 1, width: box.width + 6, height: box.height + 2, rx: 3, class: 'fd-backdrop' })) rect.setAttribute(k, v);
    labels.insertBefore(rect, text);
  }
}

/**
 * Arrows drawn on the cart in the track scene (inside the cart group, so they move with it).
 * The arrows sit behind the cart body (so the mass written on it is never covered) and the labels in front.
 */
export class OnObjectForces {
  constructor(sceneSvg, cartGroup, { scale = 1 } = {}) {
    markers(sceneSvg, 'oo');
    this.svg = sceneSvg;
    this.scale = scale;
    const group = cls => { const g = document.createElementNS(NS, 'g'); g.setAttribute('class', cls); return g; };
    this.arrows = group('forces-on-object fd-arrows');
    this.labels = group('forces-on-object fd-labels');
    const shape = cartGroup.querySelector('.cart-shape');
    cartGroup.insertBefore(this.arrows, shape || cartGroup.firstChild);
    cartGroup.append(this.labels);
  }
  render(data, { visible, showValues }) {
    this.svg.classList.toggle('forces-on', visible);
    for (const g of [this.arrows, this.labels]) g.style.display = visible ? '' : 'none';
    if (!visible) return;
    // (The groups must be displayed before drawing so label backdrops can be measured.)
    // Body centre and half-extents follow the cart scale (body 48 × 32 at y 158–190, rail at 203).
    const s = this.scale, cy = 203 - 29 * s, half = { x: 24 * s, up: 16 * s, down: 16 * s };
    const maxLength = 50;
    drawArrows(this, data, { cx: 0, cy, maxLength, minLength: 16, prefix: 'oo', showValues, inset: half,
      netY: Math.round(cy - half.up - maxLength - 24), weightLabelMid: true, backdrops: true });
  }
}

/** The free-body diagram: the cart as a dot, every arrow starting at the dot's centre. */
export class FreeBodyDiagram {
  constructor(svg) {
    this.svg = svg;
    markers(svg, 'fbd');
    svg.insertAdjacentHTML('beforeend', '<g class="fbd-arrows"></g><g class="fbd-labels"></g><circle class="fbd-dot" cx="180" cy="128" r="7"/>');
    this.arrows = svg.querySelector('.fbd-arrows');
    this.labels = svg.querySelector('.fbd-labels');
  }
  render(data, { showValues, description }) {
    drawArrows(this, data, { cx: 180, cy: 128, maxLength: 84, minLength: 18, prefix: 'fbd', showValues, netY: 20 });
    this.svg.setAttribute('aria-label', `Free-body diagram of the cart. ${description}`);
  }
}
