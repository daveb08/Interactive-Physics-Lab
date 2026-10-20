/**
 * Visual problem builder for Unit 1 Solve it. A scenario (charges placed on the plane, the problem type and
 * what students find) becomes a complete Solve it problem in the same format as solve-problems.js:
 * statement, Step 1 cards (with traps), solution steps with common-mistake blocks, answers and ghost forces.
 * Every number comes from the electrostatics engine. Pure module (no DOM), unit-tested.
 *
 * Scenario: {
 *   kind: 'force' | 'balance',
 *   charges: [{ uC, x, y }]   plane coordinates (m), 2–4 charges (exactly 2 for 'balance')
 *   target                    index of the charge whose net force is asked ('force')
 *   origin                    index of the charge placed at the origin in the statement
 *   thirdLaw                  2 charges only: also ask for the force on the other charge
 *   third: { uC }             'balance': the charge to be placed
 *   title, statement, autoStatement
 * }
 */
import { K, MICRO } from '../../js/core/em-constants.js';
import { pairForce, netForce } from '../../js/core/electrostatics.js';
import { s3, a1 } from './solve-problems.js';

export const LIMITS = { uC: 10, count: [2, 4], minSep: 0.04, plane: { w: 1, h: 0.6 } };
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
const sub = n => String(n).split('').map(d => SUBS[+d]).join('');
const qn = i => `q${sub(i + 1)}`;
const Fn = (i, j) => `F${sub(i + 1)}${sub(j + 1)}`;
const key = (i, j) => `F${i + 1}${j + 1}`;
const sign = v => (v > 0 ? '+' : '−');
const qText = uC => `${sign(uC)}${Math.abs(uC).toFixed(1)} μC`;
const qC = uC => `${sign(uC)}${Math.abs(uC).toFixed(1)} × 10⁻⁶ C`;
const qAbs = uC => `${Math.abs(uC).toFixed(1)} × 10⁻⁶`;
const m2 = v => `${(Math.abs(v) < 5e-4 ? 0 : v).toFixed(2).replace('-', '−')}`;
const vec = (x, y) => `(${s3z(x)}, ${s3z(y)}) N`;
const s3z = v => (Math.abs(v) < 1e-12 ? '0' : s3(v));
const deg = (fx, fy) => { const d = Math.atan2(fy, fx) * 180 / Math.PI; return d <= -180 + 1e-9 ? d + 360 : d; };
const AX = 1e-9;
const K_TEXT = 'k = 8.99 × 10⁹ N·m²/C²';

/* ---------- scenarios ---------- */
export function newScenario(over = {}) {
  return {
    kind: 'force', charges: [{ uC: 3, x: 0.30, y: 0.30 }, { uC: -5, x: 0.60, y: 0.30 }], target: 1, origin: 0,
    thirdLaw: true, third: { uC: 2 }, title: '', statement: '', autoStatement: true, ...over,
  };
}

/** Starting points that rebuild the four built-in problems S1–S4. */
export const SAMPLES = {
  S1: { label: 'S1 · Two charges (with the third-law pair)', sc: { kind: 'force', charges: [{ uC: 3, x: 0.30, y: 0.30 }, { uC: -5, x: 0.60, y: 0.30 }], target: 1, origin: 0, thirdLaw: true } },
  S2: { label: 'S2 · Three charges in a line', sc: { kind: 'force', charges: [{ uC: 2, x: 0.20, y: 0.30 }, { uC: -3, x: 0.40, y: 0.30 }, { uC: 4, x: 0.70, y: 0.30 }], target: 1, origin: 0 } },
  S3: { label: 'S3 · Right angle (components and direction)', sc: { kind: 'force', charges: [{ uC: 4, x: 0.60, y: 0.08 }, { uC: -6, x: 0.30, y: 0.48 }, { uC: 2, x: 0.30, y: 0.08 }], target: 2, origin: 2 } },
  S4: { label: 'S4 · Balance point between like charges', sc: { kind: 'balance', charges: [{ uC: 1, x: 0.10, y: 0.30 }, { uC: 9, x: 0.90, y: 0.30 }], third: { uC: 2 } } },
  square: { label: 'Four charges on a square', sc: { kind: 'force', charges: [{ uC: 2, x: 0.30, y: 0.15 }, { uC: -2, x: 0.60, y: 0.15 }, { uC: 2, x: 0.60, y: 0.45 }, { uC: -2, x: 0.30, y: 0.45 }], target: 0, origin: 0 } },
  outside: { label: 'Balance point outside unlike charges', sc: { kind: 'balance', charges: [{ uC: -2, x: 0.45, y: 0.30 }, { uC: 8, x: 0.75, y: 0.30 }], third: { uC: 1 } } },
};
export function sampleScenario(id) { return newScenario(JSON.parse(JSON.stringify(SAMPLES[id].sc))); }

/** Whitelist and clamp a scenario from a file or link (never trust its shape). */
export function cleanScenario(raw) {
  const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);
  const r2 = v => Math.round(v * 100) / 100;
  const src = raw && typeof raw === 'object' ? raw : {};
  const charges = (Array.isArray(src.charges) ? src.charges : []).slice(0, LIMITS.count[1]).map(c => ({
    uC: Math.round(num(c?.uC, -LIMITS.uC, LIMITS.uC, 1) * 2) / 2,
    x: r2(num(c?.x, 0.02, LIMITS.plane.w - 0.02, 0.5)), y: r2(num(c?.y, 0.02, LIMITS.plane.h - 0.02, 0.3)),
  }));
  const n = charges.length;
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  return {
    kind: src.kind === 'balance' ? 'balance' : 'force', charges,
    target: Math.round(num(src.target, 0, Math.max(0, n - 1), n - 1)), origin: Math.round(num(src.origin, 0, Math.max(0, n - 1), 0)),
    thirdLaw: !!src.thirdLaw, third: { uC: Math.round(num(src.third?.uC, -LIMITS.uC, LIMITS.uC, 2) * 2) / 2 || 1 },
    title: str(src.title, 120), statement: str(src.statement, 2000), autoStatement: src.autoStatement !== false,
  };
}

/** Problems that cannot be built. */
export function scenarioErrors(sc) {
  const e = [], cs = sc.charges, n = cs.length;
  if (sc.kind === 'balance' && n !== 2) e.push('A balance-point problem uses exactly two fixed charges.');
  if (sc.kind === 'force' && (n < LIMITS.count[0] || n > LIMITS.count[1])) e.push('Use 2 to 4 charges.');
  cs.forEach((c, i) => { if (!c.uC) e.push(`${qn(i)} has zero charge. Give it a value.`); });
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y) < LIMITS.minSep - 1e-9) e.push(`${qn(i)} and ${qn(j)} are closer than 4 cm. Move them apart.`);
  if (sc.kind === 'balance' && n === 2) {
    if (Math.abs(cs[0].y - cs[1].y) > 1e-9) e.push('For a balance point, put both charges on the same horizontal line.');
    if (cs[0].uC === -cs[1].uC) e.push('Equal and opposite charges have no balance point at a finite distance. Change one of them.');
    if (!sc.third?.uC) e.push('Give the third charge a value.');
  }
  return e;
}

/* ---------- build ---------- */
/** Scenario → { problem } or { errors }. */
export function buildProblem(sc0) {
  const sc = cleanScenario(sc0);
  const errors = scenarioErrors(sc);
  if (errors.length) return { errors };
  const p = sc.kind === 'balance' ? buildBalance(sc) : sc.charges.length === 2 ? buildPair(sc) : buildSuperposition(sc);
  if (sc.title) p.title = sc.title;
  if (!sc.autoStatement && sc.statement.trim()) p.statement = sc.statement;
  p.source = 'builder';
  return { problem: p, scenario: sc };
}

/** Coordinates relative to the chosen origin charge, as the statement states them. */
function frame(sc) {
  const o = sc.charges[sc.origin];
  return { o, charges: sc.charges.map(c => ({ uC: c.uC, x: +(c.x - o.x).toFixed(2), y: +(c.y - o.y).toFixed(2) })) };
}
const SI = set => set.map(c => ({ q: c.uC * MICRO, x: c.x, y: c.y }));
function where(charges) {
  const sameY = charges.every(c => Math.abs(c.y - charges[0].y) < AX), sameX = charges.every(c => Math.abs(c.x - charges[0].x) < AX);
  if (sameY && Math.abs(charges[0].y) < AX) return { line: 'x', text: c => (Math.abs(c.x) < AX ? 'at the origin' : `at x = ${m2(c.x)} m`) };
  if (sameX && Math.abs(charges[0].x) < AX) return { line: 'y', text: c => (Math.abs(c.y) < AX ? 'at the origin' : `at y = ${m2(c.y)} m`) };
  return { line: null, text: c => (Math.abs(c.x) < AX && Math.abs(c.y) < AX ? 'at the origin' : `at (${m2(c.x)} m, ${m2(c.y)} m)`) };
}
function dirOf(fx, fy) {
  if (Math.abs(fy) < 1e-12 * Math.max(1, Math.abs(fx))) return fx > 0 ? 'the +x direction (0°)' : 'the −x direction (180°)';
  if (Math.abs(fx) < 1e-12 * Math.max(1, Math.abs(fy))) return fy > 0 ? 'the +y direction (90°)' : 'the −y direction (−90°)';
  return `θ = ${a1(deg(fx, fy))}° from +x`;
}
const common = (statement, quantities) => ({ statement, quantities });
const knownCards = (charges, w) => charges.map((c, i) => ({ id: `q-q${i + 1}`, text: `${qn(i)} = ${qText(c.uC)} ${w.text(c)}`.replace(' at the origin', ' at the origin'), role: 'known' }));

/* --- two charges: the S1 template --- */
function buildPair(sc) {
  const { o, charges } = frame(sc), t = sc.target, s = 1 - t, w = where(charges);
  const set = SI(charges), f = pairForce(set[t], set[s]), F = f.magnitude, r = f.r;
  const like = charges[t].uC * charges[s].uC > 0, ang = deg(f.fx, f.fy), angBack = deg(-f.fx, -f.fy);
  const noSq = F * r, uc = F * 1e12, Tt = qn(t), Ts = qn(s);
  const truth = { [key(t, s)]: F, angT: ang };
  const statement = `A ${qText(charges[0].uC)} charge q₁ is ${w.text(charges[0])} and a ${qText(charges[1].uC)} charge q₂ is ${w.text(charges[1])}. Find the size and direction of the electric force on ${Tt} (call it ${Fn(t, s)}: the force on ${Tt} due to ${Ts})${sc.thirdLaw ? `, and the force on ${Ts}` : ''}. Use ${K_TEXT}.`;
  const quantities = [
    ...knownCards(charges, w),
    { id: 'q-r', text: `r = ${m2(r)} m`, role: 'known' },
    { id: 'q-k', text: K_TEXT, role: 'known' },
    { id: 'q-F', text: `${Fn(t, s)} (size and direction) = ?`, role: 'unknown' },
    ...(sc.thirdLaw ? [{ id: 'q-F2', text: `${Fn(s, t)} (size and direction) = ?`, role: 'unknown' }] : []),
    { id: 'q-m', text: 'm = ? (mass of each charge)', role: 'none', feedback: 'Coulomb’s law uses only the charges and the distance. Mass would matter only if you went on to find an acceleration.' },
    { id: 'q-big', text: `${Ts} = ${sign(charges[s].uC)}${Math.abs(charges[s].uC).toFixed(1)} C`, role: 'none', feedback: `μ means micro, 10⁻⁶. The charge is ${qC(charges[s].uC)}. A whole coulomb is an enormous charge.` },
    { id: 'q-g', text: 'g = 9.81 m/s²', role: 'none', feedback: 'Gravity plays no part here. The problem is about the electric force between the two charges.' },
  ];
  const steps = { units: 'Convert to coulombs', size: 'Size of the force', dir: `Direction of ${Fn(t, s)}`, ...(sc.thirdLaw ? { third: `Force on ${Ts}` } : {}) };
  const dir = dirOf(f.fx, f.fy), opp = dirOf(-f.fx, -f.fy);
  const kq = `(8.99 × 10⁹)(${qAbs(charges[0].uC)})(${qAbs(charges[1].uC)})`;
  const blocks = [
    { id: 'u-ok', step: 'units', correct: true, text: `Convert μC to C: q₁ = ${qC(charges[0].uC)}, q₂ = ${qC(charges[1].uC)}.` },
    { id: 'u-keep', step: 'units', text: `Keep the charges in μC: q₁ = ${charges[0].uC.toFixed(1).replace('-', '−')}, q₂ = ${charges[1].uC.toFixed(1).replace('-', '−')}. The units cancel anyway.`, effect: { on: t, force: [f.fx * 1e12, f.fy * 1e12] },
      feedback: 'k is in N·m²/C², so the charges must be in coulombs. Leaving them in μC makes the force 10¹² times too big.' },
    { id: 's-ok', step: 'size', correct: true, after: ['units'], text: `|F| = k|q₁q₂|/r² = ${kq}/(${m2(r)})² = ${s3(F)} N`, answer: { key: key(t, s), value: F } },
    { id: 's-nosq', step: 'size', after: ['units'], text: `|F| = k|q₁q₂|/r = ${kq}/${m2(r)} = ${s3(noSq)} N`, answer: { key: key(t, s), value: noSq }, effect: { on: t, force: [f.fx * r, f.fy * r] },
      feedback: 'Coulomb’s law is an inverse-square law: divide by r², not r. Check the units: N·m²/C² × C² ÷ m gives N·m, not N.' },
    ...(like ? [] : [{ id: 's-sign', step: 'size', after: ['units'], text: `F = kq₁q₂/r² = −${s3(F)} N, a negative force, so it must be smaller than zero.`,
      feedback: `The minus sign is not a size. A negative product q₁q₂ tells you the charges attract. The size is |F| = ${s3(F)} N; the direction comes from attraction or repulsion.` }]),
    { id: 'd-ok', step: 'dir', correct: true, after: ['size'], text: `${like ? 'Like charges repel' : 'Unlike charges attract'}, so ${Fn(t, s)} points ${like ? `away from ${Ts}` : `from ${Tt} toward ${Ts}`}: ${dir}.`, answer: { key: 'angT', value: ang } },
    { id: 'd-swap', step: 'dir', after: ['size'], text: `q₁q₂ is ${like ? 'positive, so the charges attract' : 'negative, so the charges repel'}: ${Fn(t, s)} points ${like ? `toward ${Ts}` : `away from ${Ts}`}, ${opp}.`, answer: { key: 'angT', value: angBack }, effect: { on: t, force: [-f.fx, -f.fy] },
      feedback: like ? 'A positive product means the charges have the same sign, and like charges repel.' : 'A negative product means opposite signs, and opposite charges attract. Like charges (product positive) repel.' },
  ];
  if (charges[t].uC < 0 && w.line !== 'y') blocks.push({ id: 'd-neg', step: 'dir', after: ['size'], text: `${Tt} is negative, so the force on it points toward −y, “down”.`, answer: { key: 'angT', value: -90 }, effect: { on: t, force: [0, -F] },
    feedback: 'The sign of a charge is not a direction in space. The force between two point charges always acts along the line joining them.' });
  if (sc.thirdLaw) {
    const small = Math.abs(charges[s].uC) < Math.abs(charges[t].uC), ratio = small ? Math.abs(charges[s].uC / charges[t].uC) : Math.abs(charges[t].uC / charges[s].uC);
    truth[key(s, t)] = F;
    blocks.push({ id: 't-ok', step: 'third', correct: true, after: ['dir'], text: `By Newton’s third law ${Fn(s, t)} = ${s3(F)} N, ${opp}: same size, opposite direction.`, answer: { key: key(s, t), value: F } });
    if (Math.abs(charges[s].uC) !== Math.abs(charges[t].uC)) {
      const wrongF = small ? F * ratio : F / ratio;
      blocks.push({ id: 't-size', step: 'third', after: ['dir'], text: `${Ts} is the ${small ? 'smaller' : 'larger'} charge, so it feels ${small ? 'less' : 'more'} force: ${Fn(s, t)} = ${s3(wrongF)} N.`, answer: { key: key(s, t), value: wrongF }, effect: { on: s, force: [-f.fx * wrongF / F, -f.fy * wrongF / F] },
        feedback: 'Both charges are in the same product q₁q₂, so each feels the same size of force. The forces are a Newton’s third law pair.' });
    } else blocks.push({ id: 't-same', step: 'third', after: ['dir'], text: `${Fn(s, t)} = ${s3(F)} N in the same direction as ${Fn(t, s)}, ${dir}.`, effect: { on: s, force: [f.fx, f.fy] },
      feedback: 'Newton’s third law pairs point in opposite directions: each charge is pushed or pulled along the line toward or away from the other.' });
  }
  return finish(sc, o, charges, { title: 'Two charges: how hard, which way?', ...common(statement, quantities), steps, blocks, truth,
    targets: sc.thirdLaw ? [t, s] : [t], units: { [key(t, s)]: 'N', [key(s, t)]: 'N', angT: '°' }, labels: { [key(t, s)]: `${Fn(t, s)} (size)`, [key(s, t)]: `${Fn(s, t)} (size)`, angT: `Direction of ${Fn(t, s)}` } });
}

/* --- three or four charges: the S2/S3 template --- */
function buildSuperposition(sc) {
  const { o, charges } = frame(sc), t = sc.target, w = where(charges), set = SI(charges);
  const sources = charges.map((_, j) => j).filter(j => j !== t);
  const pairs = Object.fromEntries(sources.map(j => [j, pairForce(set[t], set[j])]));
  const net = netForce(set, t);
  const netWith = (j, v) => { let fx = 0, fy = 0; for (const k of sources) { const g = k === j ? v : [pairs[k].fx, pairs[k].fy]; fx += g[0]; fy += g[1]; } return [fx, fy]; };
  const onX = sources.every(j => Math.abs(pairs[j].fy) < 1e-9 * pairs[j].magnitude), onY = sources.every(j => Math.abs(pairs[j].fx) < 1e-9 * pairs[j].magnitude);
  const axis = onX ? 'x' : onY ? 'y' : null, comp = v => (axis === 'y' ? v[1] : v[0]);
  const Tt = qn(t), truth = {}, units = {}, labels = {}, blocks = [], steps = {};
  const list = charges.map((c, i) => `${qn(i)} = ${qText(c.uC)} ${w.text(c)}`).join(', ');
  const statement = `${['', '', 'Two', 'Three', 'Four'][charges.length]} point charges are fixed in place: ${list}. Find the ${axis ? '' : 'size and direction (angle from the +x axis) of the '}net electric force on ${Tt}${axis ? ` (take +${axis} as positive)` : ''}. Use ${K_TEXT}.`;
  // trap: a distance between two *other* charges, when it differs from every real distance
  const others = sources.length >= 2 ? Math.hypot(charges[sources[0]].x - charges[sources[1]].x, charges[sources[0]].y - charges[sources[1]].y) : 0;
  const realR = sources.map(j => pairs[j].r);
  const trapR = sources.length >= 2 && realR.every(r => Math.abs(r - others) > 0.02);
  const quantities = [
    ...knownCards(charges, w),
    ...sources.map(j => ({ id: `q-r${j + 1}`, text: `r${sub(t + 1)}${sub(j + 1)} = ${m2(pairs[j].r)} m`, role: 'known' })),
    { id: 'q-k', text: K_TEXT, role: 'known' },
    { id: 'q-net', text: axis ? `F_net on ${Tt} = ?` : `|F_net| on ${Tt} = ?`, role: 'unknown' },
    ...(axis ? [] : [{ id: 'q-th', text: 'angle θ of F_net = ?', role: 'unknown' }]),
    ...(trapR ? [{ id: 'q-wrongr', text: `r = ${m2(others)} m (for each force)`, role: 'none', feedback: `${m2(others)} m is the distance between ${qn(sources[0])} and ${qn(sources[1])}. Each force on ${Tt} uses the distance from ${Tt} to that charge.` }] : []),
    { id: 'q-zero', text: `F_net = 0 (${Tt} is surrounded by charges)`, role: 'none', feedback: 'Being among several charges does not make the forces cancel. Work out each force and add them as vectors.' },
    { id: 'q-big', text: `${qn(sources[0])} = ${sign(charges[sources[0]].uC)}${Math.abs(charges[sources[0]].uC).toFixed(1)} C`, role: 'none', feedback: `μ means micro, 10⁻⁶: the charge is ${qC(charges[sources[0]].uC)}.` },
  ];
  for (const j of sources) {
    const f = pairs[j], like = charges[t].uC * charges[j].uC > 0, st = `f${j + 1}`, k = key(t, j);
    steps[st] = `Force on ${Tt} from ${qn(j)}`;
    truth[k] = f.magnitude; units[k] = 'N'; labels[k] = `${Fn(t, j)} (size)`;
    const head = `${Fn(t, j)} = k(${qAbs(charges[t].uC)})(${qAbs(charges[j].uC)})/(${m2(f.r)})² = ${s3(f.magnitude)} N.`;
    const toward = axis ? `so ${s3(comp([f.fx, f.fy]))} N along ${axis}` : `${dirOf(f.fx, f.fy)}: ${vec(f.fx, f.fy)}`;
    blocks.push({ id: `${st}-ok`, step: st, correct: true, text: `${head} ${like ? `Like charges repel: away from ${qn(j)}` : `Unlike charges attract: toward ${qn(j)}`}, ${toward}.`, answer: { key: k, value: f.magnitude } });
    const flip = [-f.fx, -f.fy];
    blocks.push({ id: `${st}-swap`, step: st, text: `${Fn(t, j)} = ${s3(f.magnitude)} N. ${like ? `The charges attract: toward ${qn(j)}` : `${Tt} is pushed away from ${qn(j)}`}, ${axis ? `so ${s3(comp(flip))} N along ${axis}` : vec(...flip)}.`, answer: { key: k, value: f.magnitude }, effect: { on: t, force: netWith(j, flip) },
      feedback: like ? `${Tt} and ${qn(j)} have the same sign, so they repel: the force on ${Tt} points away from ${qn(j)}.` : `${Tt} and ${qn(j)} have opposite signs, so they attract: the force on ${Tt} points toward ${qn(j)}.` });
    const wrongD = sources.filter(x => x !== j).map(x => Math.hypot(charges[j].x - charges[x].x, charges[j].y - charges[x].y))[0];
    if (wrongD && Math.abs(wrongD - f.r) > 0.02) {
      const F2 = f.magnitude * (f.r / wrongD) ** 2, v = [f.fx * F2 / f.magnitude, f.fy * F2 / f.magnitude];
      blocks.push({ id: `${st}-dist`, step: st, text: `${Fn(t, j)} = k(${qAbs(charges[t].uC)})(${qAbs(charges[j].uC)})/(${m2(wrongD)})² = ${s3(F2)} N, ${like ? `away from ${qn(j)}` : `toward ${qn(j)}`}.`, answer: { key: k, value: F2 }, effect: { on: t, force: netWith(j, v) },
        feedback: `r is the distance from ${Tt} to ${qn(j)}, which is ${m2(f.r)} m. ${m2(wrongD)} m is the distance from ${qn(j)} to another charge and plays no part in this force.` });
    } else {
      const F2 = f.magnitude * f.r, v = [f.fx * f.r, f.fy * f.r];
      blocks.push({ id: `${st}-nosq`, step: st, text: `${Fn(t, j)} = k(${qAbs(charges[t].uC)})(${qAbs(charges[j].uC)})/${m2(f.r)} = ${s3(F2)} N, ${like ? `away from ${qn(j)}` : `toward ${qn(j)}`}.`, answer: { key: k, value: F2 }, effect: { on: t, force: netWith(j, v) },
        feedback: 'Coulomb’s law is an inverse-square law: divide by r², not r.' });
    }
  }
  const after = sources.map(j => `f${j + 1}`), sumMag = sources.reduce((a, j) => a + pairs[j].magnitude, 0);
  const unit = net.magnitude > 0 ? [net.fx / net.magnitude, net.fy / net.magnitude] : [1, 0];
  steps.add = 'Add the forces';
  if (axis) {
    const val = comp([net.fx, net.fy]), terms = sources.map(j => comp([pairs[j].fx, pairs[j].fy]));
    truth.Fnet = val; units.Fnet = 'N'; labels.Fnet = `F_net (along ${axis})`;
    blocks.push({ id: 'add-ok', step: 'add', correct: true, after, text: `Add with signs: F_net = ${terms.map((v, i) => (i && v >= 0 ? '+ ' : '') + s3(v)).join(' ')} = ${s3(val)} N.`, answer: { key: 'Fnet', value: val } });
    if (Math.abs(sumMag - net.magnitude) > 1e-6 * sumMag) blocks.push({ id: 'add-mag', step: 'add', after, text: `Add the sizes: F_net = ${sources.map(j => s3(pairs[j].magnitude)).join(' + ')} = ${s3(sumMag)} N.`, answer: { key: 'Fnet', value: sumMag }, effect: { on: t, force: [unit[0] * sumMag, unit[1] * sumMag] },
      feedback: 'Forces are vectors. Give each one a sign (+ or −) for its direction before adding; forces in opposite directions partly cancel.' });
    else blocks.push({ id: 'add-avg', step: 'add', after, text: `Average the forces: F_net = (${sources.map(j => s3(pairs[j].magnitude)).join(' + ')}) / ${sources.length} = ${s3(sumMag / sources.length)} N.`, answer: { key: 'Fnet', value: Math.sign(val) * sumMag / sources.length }, effect: { on: t, force: [unit[0] * sumMag / sources.length, unit[1] * sumMag / sources.length] },
      feedback: `Forces add; they are not averaged. Here every force on ${Tt} points the same way, so the net force is their full sum.` });
    if (Math.abs(val) > 1e-12) {
      steps.result = 'State the result';
      const d = val > 0 ? `+${axis}` : `−${axis}`, od = val > 0 ? `−${axis}` : `+${axis}`;
      const big = sources.reduce((a, j) => (Math.abs(charges[j].uC) > Math.abs(charges[a].uC) ? j : a), sources[0]);
      const bigPull = Math.sign(comp([pairs[big].fx, pairs[big].fy])) !== Math.sign(val);
      blocks.push({ id: 'res-ok', step: 'result', correct: true, after: ['add'], text: `F_net = ${s3(Math.abs(val))} N in the ${d} direction.` });
      blocks.push({ id: 'res-flip', step: 'result', after: ['add'], text: bigPull ? `F_net points in the ${od} direction, because ${qn(big)} is the biggest charge.` : `F_net is negative, so it points in the ${od} direction.`, effect: { on: t, force: [-net.fx, -net.fy] },
        feedback: bigPull ? 'Charge size is only half of it: distance matters too, through 1/r². Trust the signed sum: its sign gives the direction.' : `The sign of the sum gives the direction: ${val > 0 ? 'positive means +' : 'negative means −'}${axis}.` });
    }
  } else {
    truth.Fx = net.fx; truth.Fy = net.fy; units.Fx = units.Fy = 'N'; labels.Fx = 'F_net,x'; labels.Fy = 'F_net,y';
    const sx = sources.map(j => pairs[j].fx), sy = sources.map(j => pairs[j].fy), sum = v => v.map((x, i) => (i && x >= 0 ? '+ ' : '') + s3z(x)).join(' ');
    blocks.push({ id: 'add-ok', step: 'add', correct: true, after, text: `Add components: F_x = ${sum(sx)} = ${s3z(net.fx)} N; F_y = ${sum(sy)} = ${s3z(net.fy)} N.`, answer: { key: 'Fx', value: net.fx } });
    if (Math.abs(sumMag - net.magnitude) > 1e-6 * sumMag) blocks.push({ id: 'add-mag', step: 'add', after, text: `Add the sizes: |F_net| = ${sources.map(j => s3(pairs[j].magnitude)).join(' + ')} = ${s3(sumMag)} N.`, effect: { on: t, force: [unit[0] * sumMag, unit[1] * sumMag] },
      feedback: 'The forces point in different directions, so their sizes do not simply add. Add the x components and the y components separately.' });
    steps.size = 'Size of the net force';
    truth.Fnet = net.magnitude; units.Fnet = 'N'; labels.Fnet = '|F_net|';
    blocks.push({ id: 'size-ok', step: 'size', correct: true, after: ['add'], text: `|F_net| = √(F_x² + F_y²) = √((${s3z(net.fx)})² + (${s3z(net.fy)})²) = ${s3(net.magnitude)} N.`, answer: { key: 'Fnet', value: net.magnitude } });
    blocks.push({ id: 'size-sum', step: 'size', after: ['add'], text: `|F_net| = |F_x| + |F_y| = ${s3(Math.abs(net.fx))} + ${s3(Math.abs(net.fy))} = ${s3(Math.abs(net.fx) + Math.abs(net.fy))} N.`, answer: { key: 'Fnet', value: Math.abs(net.fx) + Math.abs(net.fy) },
      feedback: 'Components are perpendicular, so they combine by the Pythagorean theorem: |F| = √(F_x² + F_y²).' });
    steps.angle = 'Direction of the net force';
    const ang = deg(net.fx, net.fy), calc = Math.atan(net.fy / net.fx) * 180 / Math.PI;
    truth.angle = ang; units.angle = '°'; labels.angle = 'Angle θ of F_net';
    const quad = net.fx < 0 ? (net.fy >= 0 ? 'up and to the left (second quadrant)' : 'down and to the left (third quadrant)') : (net.fy >= 0 ? 'up and to the right (first quadrant)' : 'down and to the right (fourth quadrant)');
    blocks.push({ id: 'ang-ok', step: 'angle', correct: true, after: ['size'], text: `F_x ${net.fx < 0 ? '<' : '>'} 0 and F_y ${net.fy < 0 ? '<' : '>'} 0, so F_net points ${quad}: θ = ${a1(ang)}° from +x.`, answer: { key: 'angle', value: ang } });
    if (net.fx < 0) {
      const rad = calc * Math.PI / 180;
      blocks.push({ id: 'ang-calc', step: 'angle', after: ['size'], text: `θ = tan⁻¹(F_y/F_x) = tan⁻¹(${s3z(net.fy)}/${s3z(net.fx)}) = ${a1(calc)}°.`, answer: { key: 'angle', value: calc }, effect: { on: t, force: [net.magnitude * Math.cos(rad), net.magnitude * Math.sin(rad)] },
        feedback: `A calculator’s tan⁻¹ only returns angles between −90° and +90°. Here F_x is negative, so add 180°: θ = ${a1(ang)}°. Sketch the components first.` });
    } else {
      const fromY = 90 - ang, rad = fromY * Math.PI / 180;
      blocks.push({ id: 'ang-y', step: 'angle', after: ['size'], text: `θ = tan⁻¹(F_x/F_y) = ${a1(fromY)}° from +x.`, answer: { key: 'angle', value: fromY }, effect: { on: t, force: [net.magnitude * Math.cos(rad), net.magnitude * Math.sin(rad)] },
        feedback: 'tan θ = F_y/F_x for an angle measured from the +x axis. F_x/F_y gives the angle from the y axis instead.' });
    }
  }
  return finish(sc, o, charges, { title: `${['', '', 'Two', 'Three', 'Four'][charges.length]} charges: add the forces`, ...common(statement, quantities), steps, blocks, truth, targets: [t], units, labels });
}

/* --- balance point: the S4 template --- */
function buildBalance(sc) {
  const sorted = [...sc.charges].sort((a, b) => a.x - b.x);
  const d = +(sorted[1].x - sorted[0].x).toFixed(2), Q1 = sorted[0].uC, Q2 = sorted[1].uC, q3 = sc.third.uC;
  const like = Q1 * Q2 > 0, smallFirst = Math.abs(Q1) <= Math.abs(Q2);
  const s = Math.sqrt(Math.abs(Q2 / Q1));                         // (distance to q₂)/(distance to q₁) at balance
  // Like charges: between, nearer the smaller (distance ratio √(Q2/Q1)). Unlike: outside, beyond the smaller.
  let x;
  if (like) x = d / (1 + s);
  else { const r = Math.sqrt(Math.max(Math.abs(Q1), Math.abs(Q2)) / Math.min(Math.abs(Q1), Math.abs(Q2))); x = smallFirst ? -d / (r - 1) : d + d / (r - 1); }
  const ratio = Math.abs(Q2 / Q1), rt = Math.sqrt(ratio);
  const fmtR = v => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : s3(v));
  const charges = [{ uC: Q1, x: 0, y: 0 }, { uC: Q2, x: d, y: 0 }];
  const smallName = Math.abs(Q1) <= Math.abs(Q2) ? 'q₁' : 'q₂';
  const statement = `A ${qText(Q1)} charge q₁ is at x = 0 and a ${qText(Q2)} charge q₂ is at x = ${m2(d)} m. Where on the x-axis should a third charge q₃ = ${qText(q3)} be placed so that the net electric force on it is zero?`;
  const quantities = [
    { id: 'q-q1', text: `q₁ = ${qText(Q1)} at x = 0`, role: 'known' },
    { id: 'q-q2', text: `q₂ = ${qText(Q2)} at x = ${m2(d)} m`, role: 'known' },
    { id: 'q-q3', text: `q₃ = ${qText(q3)}`, role: 'known' },
    { id: 'q-zero', text: 'F_net on q₃ = 0', role: 'known' },
    { id: 'q-x', text: 'position x of q₃ = ?', role: 'unknown' },
    { id: 'q-k', text: 'k = ? (must be looked up first)', role: 'none', feedback: 'k appears on both sides of the balance equation and cancels, so its value is not needed here.' },
    ...(Math.abs(x - d / 2) > 0.01 ? [{ id: 'q-mid', text: `x = ${m2(d / 2)} m (the midpoint)`, role: 'none', feedback: `That is a guess, not a given. ${Math.abs(Q1) === Math.abs(Q2) ? '' : 'The charges are not equal, so q₃ does not balance at the midpoint.'}` }] : []),
  ];
  const steps = { setup: 'Balance condition', cancel: 'Simplify', root: 'Take the square root', solve: 'Solve for x' };
  const blocks = [];
  if (like) {
    blocks.push({ id: 'a-ok', step: 'setup', correct: true, text: `Between two like charges the pushes oppose. Set them equal: k q₁ q₃ / x² = k q₂ q₃ / (${m2(d)} − x)².` });
    blocks.push({ id: 'a-out', step: 'setup', text: `The balance point must be outside the pair, beyond q₁: k q₁ q₃ / x² = k q₂ q₃ / (${m2(d)} + x)².`,
      feedback: 'Outside a pair of like charges both pushes point the same way, so they can never cancel there. For like charges the balance point is between them.' });
    blocks.push({ id: 'b-ok', step: 'cancel', correct: true, after: ['setup'], text: `k and q₃ cancel: (${m2(d)} − x)² / x² = q₂ / q₁ = ${fmtR(ratio)}.` });
    blocks.push({ id: 'b-q3', step: 'cancel', after: ['setup'], text: `Substitute q₃ = ${qText(q3)} on both sides and solve the quadratic (k q₃ does not cancel).`,
      feedback: 'k q₃ is on both sides, so it cancels. That is why the answer does not depend on the size (or sign) of q₃.' });
    blocks.push({ id: 'c-ok', step: 'root', correct: true, after: ['cancel'], text: `Square root of both sides: (${m2(d)} − x) / x = √${fmtR(ratio)} = ${fmtR(rt)}.` });
    if (Math.abs(ratio - 1) > 1e-9) blocks.push({ id: 'c-noroot', step: 'root', after: ['cancel'], text: `Drop the squares: (${m2(d)} − x) / x = ${fmtR(ratio)}.`, effect: { x: d / (1 + ratio) },
      feedback: `The distances are squared, so the ratio of distances is the square root of the charge ratio: √${fmtR(ratio)} = ${fmtR(rt)}.` });
    else blocks.push({ id: 'c-neg', step: 'root', after: ['cancel'], text: `Square root of both sides: (${m2(d)} − x) / x = −1, so there is no balance point.`,
      feedback: 'Both sides are distances, so take the positive root: (d − x)/x = +1. Equal like charges balance at the midpoint.' });
    if (Math.abs(rt - 1) > 1e-9) blocks.push({ id: 'c-flip', step: 'root', after: ['cancel'], text: `Square root of both sides: x / (${m2(d)} − x) = ${fmtR(rt)}.`, effect: { x: d * rt / (1 + rt) },
      feedback: 'This puts q₃ nearer the larger charge, where its push is strongest. The balance point is nearer the smaller charge.' });
    blocks.push({ id: 'd-ok', step: 'solve', correct: true, after: ['root'], text: `${m2(d)} − x = ${fmtR(rt)}x, so x = ${m2(d)} / ${fmtR(1 + rt)} = ${s3(x)} m${Math.abs(rt - 1) > 1e-9 ? ` (nearer the smaller charge, ${smallName})` : ' (the midpoint, because the charges are equal)'}.`, answer: { key: 'x', value: x } });
    if (Math.abs(rt - 1) > 1e-9) blocks.push({ id: 'd-mid', step: 'solve', after: ['root'], text: `By symmetry the balance point is the midpoint: x = ${m2(d / 2)} m.`, answer: { key: 'x', value: d / 2 }, effect: { x: d / 2 },
      feedback: `The setup is not symmetric: one charge is ${fmtR(Math.max(ratio, 1 / ratio))} times larger, so its push at the midpoint is that much bigger.` });
    else blocks.push({ id: 'd-near', step: 'solve', after: ['root'], text: `x = ${m2(d / 4)} m, a quarter of the way from q₁.`, answer: { key: 'x', value: d / 4 }, effect: { x: d / 4 },
      feedback: 'With equal charges the distances must be equal: (d − x)/x = 1, so x = d/2.' });
  } else {
    const beyond1 = smallFirst, r = beyond1 ? Math.sqrt(Math.abs(Q2 / Q1)) : Math.sqrt(Math.abs(Q1 / Q2));
    const u = Math.abs(x - (beyond1 ? 0 : d));                     // distance beyond the smaller charge
    const nm = beyond1 ? 'q₁' : 'q₂', side = beyond1 ? 'left of q₁ (x < 0)' : `right of q₂ (x > ${m2(d)} m)`;
    const cr = fmtR(r * r), rr = fmtR(r);
    blocks.push({ id: 'a-ok', step: 'setup', correct: true, text: `Between unlike charges both forces point the same way, so the balance point is outside, beyond the smaller charge ${nm}: ${side}. With u = distance from ${nm}: k|q_small|q₃/u² = k|q_big|q₃/(${m2(d)} + u)².` });
    blocks.push({ id: 'a-between', step: 'setup', text: `The balance point is between the charges: k|q₁|q₃/x² = k|q₂|q₃/(${m2(d)} − x)².`, effect: { x: beyond1 ? d / (1 + r) : d - d / (1 + r) },
      feedback: 'Between opposite charges q₃ is pushed by one and pulled by the other in the same direction, so the forces add and can never cancel there.' });
    blocks.push({ id: 'b-ok', step: 'cancel', correct: true, after: ['setup'], text: `k and q₃ cancel: (${m2(d)} + u)² / u² = |q_big| / |q_small| = ${cr}.` });
    blocks.push({ id: 'b-q3', step: 'cancel', after: ['setup'], text: `Substitute q₃ = ${qText(q3)} on both sides and solve the quadratic (k q₃ does not cancel).`,
      feedback: 'k q₃ is on both sides, so it cancels. That is why the answer does not depend on the size (or sign) of q₃.' });
    blocks.push({ id: 'c-ok', step: 'root', correct: true, after: ['cancel'], text: `Square root of both sides: (${m2(d)} + u) / u = √${cr} = ${rr}.` });
    blocks.push({ id: 'c-noroot', step: 'root', after: ['cancel'], text: `Drop the squares: (${m2(d)} + u) / u = ${cr}.`, effect: { x: beyond1 ? -d / (r * r - 1) : d + d / (r * r - 1) },
      feedback: `The distances are squared, so the ratio of distances is √${cr} = ${rr}, not ${cr}.` });
    blocks.push({ id: 'd-ok', step: 'solve', correct: true, after: ['root'], text: `${m2(d)} + u = ${rr}u, so u = ${m2(d)} / ${fmtR(r - 1)} = ${s3(u)} m beyond ${nm}: x = ${s3(x)} m.`, answer: { key: 'x', value: x } });
    blocks.push({ id: 'd-wrongside', step: 'solve', after: ['root'], text: `u = ${s3(u)} m beyond the larger charge: x = ${s3(beyond1 ? d + u : -u)} m.`, answer: { key: 'x', value: beyond1 ? d + u : -u }, effect: { x: beyond1 ? d + u : -u },
      feedback: 'Next to the larger charge its force is always the stronger one. The balance point is beyond the smaller charge, where the distance makes up for the smaller charge.' });
  }
  const p = { title: 'The balance point', ...common(statement, quantities), steps, blocks, truth: { x }, targets: [], third: { uC: q3 }, units: { x: 'm' }, labels: { x: 'Position x of q₃' } };
  p.charges = charges; p.offset = { x: sorted[0].x, y: sorted[0].y };
  return p;
}

function finish(sc, o, charges, p) {
  p.charges = charges; p.offset = { x: o.x, y: o.y };
  return p;
}

/* ---------- sharing: the scenario travels, the student page rebuilds the problem ---------- */
const b64url = str => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
export const FILE_TYPE = 'ipl-em-solve-scenario';
export function encodeScenario(sc) { return `e${b64url(JSON.stringify(cleanScenario(sc)))}`; }
/** → { problem, scenario } or { errors } */
export function decodeScenario(code) {
  try {
    if (!code || code[0] !== 'e') return { errors: ['This link is not an electrostatics Solve it problem.'] };
    return parseScenarioJson(unb64url(code.slice(1)));
  } catch { return { errors: ['This problem link is damaged or incomplete. Ask your instructor for a new link.'] }; }
}
export function scenarioFile(sc) { return JSON.stringify({ type: FILE_TYPE, version: 1, scenario: cleanScenario(sc) }, null, 2); }
export function parseScenarioJson(text) {
  let raw; try { raw = JSON.parse(text); } catch { return { errors: ['The file is not valid JSON.'] }; }
  const scRaw = raw?.type === FILE_TYPE ? raw.scenario : raw;
  if (!Array.isArray(scRaw?.charges)) return { errors: ['This file is not an electrostatics Solve it problem (no charges found).'] };
  return buildProblem(scRaw);
}
