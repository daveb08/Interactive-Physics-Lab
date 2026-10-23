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
// Horizontal forces are offset slightly so equal-and-opposite or same-direction arrows never hide each other.
const OFFSET = { applied: -7, friction: 7 };

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

function drawArrows(group, { forces, net }, { cx, cy, maxLength, minLength, prefix, showValues, netY, weightLabelMid = false, backdrops = false }) {
  const largest = Math.max(...forces.map(f => f.magnitude), net.magnitude);
  let html = '';
  for (const f of forces) {
    const len = arrowLength(f.magnitude, largest, { maxLength, minLength });
    const color = FORCE_COLORS[f.key];
    const value = showValues ? f.magnitude : null;
    if (f.fy === 0) {
      const y = cy + (OFFSET[f.key] ?? 0), dir = Math.sign(f.fx), x2 = cx + dir * len;
      const ly = f.key === 'friction' ? y + 17 : y - 8;
      html += `<path class="fd-arrow fd-${f.key}" d="M${cx} ${y}H${x2.toFixed(1)}" stroke="${color}" marker-end="url(#${prefix}-${f.key})"/>`;
      html += `<text class="fd-label" x="${(x2 + dir * 5).toFixed(1)}" y="${ly}" fill="${color}" text-anchor="${dir > 0 ? 'start' : 'end'}">${label(f.sub, value)}</text>`;
    } else {
      const dir = Math.sign(f.fy), y2 = cy - dir * len;
      html += `<path class="fd-arrow fd-${f.key}" d="M${cx} ${cy}V${y2.toFixed(1)}" stroke="${color}" marker-end="url(#${prefix}-${f.key})"/>`;
      // In the track scene the weight label sits beside the shaft so it stays clear of the tick numbers.
      const ly = f.key === 'weight' && weightLabelMid ? cy + len * 0.55 : y2 + (dir > 0 ? 6 : 4);
      html += `<text class="fd-label" x="${cx + 9}" y="${ly.toFixed(1)}" fill="${color}">${label(f.sub, value)}</text>`;
    }
  }
  const nlen = arrowLength(net.magnitude, largest, { maxLength, minLength });
  if (nlen) {
    const dir = Math.sign(net.fx), x2 = cx + dir * nlen;
    html += `<path class="fd-arrow fd-net" d="M${cx} ${netY}H${x2.toFixed(1)}" stroke="${FORCE_COLORS.net}" stroke-dasharray="6 4" marker-end="url(#${prefix}-net)"/>`;
    html += `<text class="fd-label fd-net-label" x="${(x2 + dir * 5).toFixed(1)}" y="${netY + 5}" fill="${FORCE_COLORS.net}" text-anchor="${dir > 0 ? 'start' : 'end'}">${label('net', showValues ? net.magnitude : null)}</text>`;
  } else {
    html += `<text class="fd-label fd-net-label" x="${cx}" y="${netY + 5}" fill="${FORCE_COLORS.net}" text-anchor="middle">F<tspan dy="5" font-size="0.72em">net</tspan><tspan dy="-5"> = 0</tspan></text>`;
  }
  group.innerHTML = html;
  // In the busy track scene, a soft backdrop keeps labels readable over the rail, wheels and ticks.
  if (backdrops) for (const text of group.querySelectorAll('.fd-label')) {
    let box;
    try { box = text.getBBox(); } catch { continue; }   // not rendered (e.g. hidden): skip
    if (!box.width) continue;
    const rect = document.createElementNS(NS, 'rect');
    for (const [k, v] of Object.entries({ x: box.x - 3, y: box.y - 1, width: box.width + 6, height: box.height + 2, rx: 3, class: 'fd-backdrop' })) rect.setAttribute(k, v);
    group.insertBefore(rect, text);
  }
}

/** Arrows drawn on the cart in the track scene (inside the cart group, so they move with it). */
export class OnObjectForces {
  constructor(sceneSvg, cartGroup) {
    markers(sceneSvg, 'oo');
    this.svg = sceneSvg;
    this.group = document.createElementNS(NS, 'g');
    this.group.setAttribute('class', 'forces-on-object');
    cartGroup.append(this.group);
  }
  render(data, { visible, showValues }) {
    this.svg.classList.toggle('forces-on', visible);
    this.group.style.display = visible ? '' : 'none';
    if (!visible) return;
    // (The group must be displayed before drawing so label backdrops can be measured.)
    // Cart body centre is (0, 174). F_net sits above the tallest arrow (174 − 66 − 24).
    drawArrows(this.group, data, { cx: 0, cy: 174, maxLength: 66, minLength: 22, prefix: 'oo', showValues, netY: 84, weightLabelMid: true, backdrops: true });
  }
}

/** The free-body diagram: the cart as a dot. */
export class FreeBodyDiagram {
  constructor(svg) {
    this.svg = svg;
    markers(svg, 'fbd');
    svg.insertAdjacentHTML('beforeend', '<g class="fbd-arrows"></g><circle class="fbd-dot" cx="180" cy="128" r="7"/>');
    this.group = svg.querySelector('.fbd-arrows');
  }
  render(data, { showValues, description }) {
    drawArrows(this.group, data, { cx: 180, cy: 128, maxLength: 84, minLength: 18, prefix: 'fbd', showValues, netY: 20 });
    this.svg.setAttribute('aria-label', `Free-body diagram of the cart. ${description}`);
  }
}
