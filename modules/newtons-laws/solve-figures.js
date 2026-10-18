/**
 * Scene figures for Solve it problems. Each returns SVG markup drawn around x = 0 with the ground at
 * y = 203 (the CartView rail), so it slides along the track with the cart group.
 * `phase` (0 or 1) alternates the sprinter's stride; `ghost` draws a dashed outline for the student's model.
 */
const INK = '#337a68';

function sprinter(phase, ghost) {
  const c = ghost ? '#ba622e' : INK, dash = ghost ? ' stroke-dasharray="4 3"' : '';
  const s = `fill="none" stroke="${c}" stroke-width="${ghost ? 2.5 : 4}" stroke-linecap="round" stroke-linejoin="round"${dash}`;
  // Leaning forward (+x). Two stride poses alternate as she runs.
  const legs = phase
    ? `<path d="M-2 182 L9 192 L6 203" ${s}/><path d="M-2 182 L-10 193 L-21 199" ${s}/>`
    : `<path d="M-2 182 L-6 193 L-2 203" ${s}/><path d="M-2 182 L8 189 L4 198" ${s}/>`;
  const arms = phase
    ? `<path d="M3 166 L12 172 L17 163" ${s}/><path d="M3 166 L-6 171 L-9 180" ${s}/>`
    : `<path d="M3 166 L-5 172 L-1 180" ${s}/><path d="M3 166 L11 170 L14 179" ${s}/>`;
  return `<circle cx="8" cy="153" r="7" fill="${ghost ? 'none' : c}" stroke="${c}" stroke-width="${ghost ? 2 : 0}"${dash}/>
    <path d="M5 161 L-2 182" ${s}/>${arms}${legs}`;
}

function pallet(ghost) {
  if (ghost) return `<rect x="-30" y="160" width="60" height="43" rx="2" fill="none" stroke="#ba622e" stroke-width="2.5" stroke-dasharray="5 3"/>`;
  let bricks = '';
  for (let row = 0; row < 4; row++) {
    const y = 162 + row * 7.5, off = row % 2 ? 7 : 0;
    for (let x = -28 - off; x < 28; x += 14) {
      const x0 = Math.max(x, -28), x1 = Math.min(x + 13, 28);
      if (x1 - x0 > 2) bricks += `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="6.5" fill="#b65b25" stroke="#8f4419" stroke-width="0.6"/>`;
    }
  }
  const deck = `<rect x="-30" y="192" width="60" height="4" fill="#a7814f"/><rect x="-30" y="199" width="60" height="3" fill="#a7814f"/>
    <rect x="-28" y="196" width="7" height="3" fill="#8b6a3e"/><rect x="-3.5" y="196" width="7" height="3" fill="#8b6a3e"/><rect x="21" y="196" width="7" height="3" fill="#8b6a3e"/>`;
  // Worker behind the pallet, leaning in, hands on the load.
  const w = `fill="none" stroke="#3c4a46" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"`;
  const worker = `<circle cx="-44" cy="156" r="6" fill="#3c4a46"/><path d="M-46 163 L-55 185" ${w}/>
    <path d="M-47 168 L-38 172 L-31 172" ${w}/><path d="M-48 171 L-40 177 L-31 178" ${w}/>
    <path d="M-55 185 L-50 194 L-47 203" ${w}/><path d="M-55 185 L-63 194 L-70 203" ${w}/>
    <path d="M-50 148 h12 l-2 -3 h-8 z" fill="#d9a520"/>`;
  return worker + bricks + deck;
}

export function figureMarkup(kind, { phase = 0, ghost = false } = {}) {
  if (kind === 'sprinter') return sprinter(phase, ghost);
  if (kind === 'pallet') return pallet(ghost);
  return null; // default: the CartView cart
}
