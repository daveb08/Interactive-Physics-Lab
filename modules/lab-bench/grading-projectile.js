/**
 * Lab Bench · Lab 2 grading: assignment links, completion codes and the rubric. Pure (no DOM), unit-tested.
 *
 * Assignment link: projectile.html?a=<code>&t=<value tolerance %>&u=<max δg/g %>&n=<launches>x<points>&px=0|1&air=any|none&k=<key check>
 * px=1 turns on the parallax trap: the metre stick can stand on the front edge of the bench, nearer the camera.
 * The completion code uses the same short format as Lab 1 (grading.js), with its own lab number.
 */
import { normaliseId } from '../../js/core/lab-noise.js';
import { flight, frames, SPRING, FPS } from '../../js/core/projectile.js';
import { quadraticFit } from '../../js/core/fit.js';
import { normaliseCode, clampNum, assignmentPlanet, pct, PREFIX, FORMAT, LAB_PROJECTILE, LAB_FREEFALL, bytesToB64, b64ToBytes, fingerprint, binCheck, pushVarint, reader } from './grading.js';
import { PRACTICE_CODE } from '../../js/core/lab-noise.js';

export const DEFAULTS2 = Object.freeze({ tol: 5, maxRel: 10, launches: 2, points: 10, parallax: false, air: 'any' });

export function parseProjectileAssignment(search) {
  const p = new URLSearchParams(search);
  const code = normaliseCode(p.get('a'));
  if (!code || code === PRACTICE_CODE) return null;
  const [nl, np] = String(p.get('n') ?? '').split('x');
  return {
    lab: 'projectile', code,
    tol: clampNum(p.get('t'), 0.5, 50, DEFAULTS2.tol), maxRel: clampNum(p.get('u'), 1, 100, DEFAULTS2.maxRel),
    launches: Math.round(clampNum(nl, 1, 6, DEFAULTS2.launches)), points: Math.round(clampNum(np, 5, 60, DEFAULTS2.points)),
    parallax: p.get('px') === '1', air: p.get('air') === 'none' ? 'none' : 'any',
    keyCheck: String(p.get('k') ?? '').replace(/[^a-z0-9]/g, '').slice(0, 12),
  };
}
export function projectileQuery(a) {
  const q = new URLSearchParams({ a: a.code, t: String(a.tol), u: String(a.maxRel), n: `${a.launches}x${a.points}`, px: a.parallax ? '1' : '0', air: a.air });
  if (a.keyCheck) q.set('k', a.keyCheck);
  return q.toString();
}

/** Which "explain your result" question: the parallax one when the trap is on, otherwise the differencing one. */
export const questionFor2 = a => (a?.parallax ? 'parallax' : 'differencing');
export const CORRECT2 = Object.freeze({ parallax: 'a', differencing: 'a' });

/** What a perfect experiment measures for these launches: noise-free clicks, a parabola fitted to y–t (drag included). */
export function idealG(planet, launches) {
  const gs = launches.filter(l => SPRING[l.spring - 1] && FPS.includes(l.fps)).map(l => {
    const fl = flight({ g: planet.g, rho: planet.rho }, { angle: l.angle, speed: SPRING[l.spring - 1] });
    const pts = frames(fl, l.fps, 0).filter(f => f.inFlight).map(f => ({ x: f.t, y: f.y }));
    return pts.length >= 4 ? -2 * quadraticFit(pts).c : NaN;
  }).filter(Number.isFinite);
  return gs.length ? gs.reduce((s, v) => s + v, 0) / gs.length : planet.g;
}

/* ---------- completion codes ---------- */
const ANSWERS = ['', 'a', 'b', 'c', 'd'];
/**
 * sub = { code, id, g, dg, answer, stick: 'plane'|'front', launches: [{ angle, spring, fps, n, modelsOk, analysed }] }
 */
export function encodeProjectile(sub) {
  const out = [(FORMAT << 4) | LAB_PROJECTILE];
  const fp = fingerprint(sub.code); out.push(fp >> 8, fp & 0xff);
  out.push(Math.max(0, ANSWERS.indexOf(sub.answer || '')) | (sub.stick === 'front' ? 8 : 0));
  pushVarint(out, +sub.g * 1000); pushVarint(out, Math.max(1, +sub.dg * 1000));
  const ls = sub.launches.slice(0, 12); out.push(ls.length);
  for (const l of ls) {
    out.push(Math.max(0, Math.min(90, Math.round(l.angle))));
    out.push((Math.max(1, Math.min(8, l.spring)) - 1) | (Math.max(0, FPS.indexOf(l.fps)) << 3) | (l.modelsOk ? 32 : 0) | (l.analysed ? 64 : 0));
    out.push(Math.min(255, Math.round(l.n)));
  }
  const id = new TextEncoder().encode(normaliseId(sub.id)).slice(0, 255);
  out.push(id.length, ...id);
  const c = binCheck(sub.code, out); out.push(c >> 16, (c >> 8) & 0xff, c & 0xff);
  return PREFIX + bytesToB64(out);
}
export function decodeProjectile(text, expectCode) {
  const raw = String(text ?? '').replace(/\s+/g, '');
  if (raw.startsWith('LB1-')) return { ok: false, error: 'a Lab 1 code: grade it with the Lab 1 assignment link' };
  if (!raw.startsWith(PREFIX)) return { ok: false, error: 'not a Lab Bench completion code' };
  let bytes;
  try { bytes = b64ToBytes(raw.slice(PREFIX.length)); } catch { return { ok: false, error: 'the code is damaged (incomplete copy?)' }; }
  try {
    const r = reader(bytes), head = r.byte();
    if (head >> 4 !== FORMAT || (head & 15) !== LAB_PROJECTILE) return { ok: false, error: (head & 15) === LAB_FREEFALL ? 'a Lab 1 code: grade it with the Lab 1 assignment link' : 'not a Lab 2 completion code' };
    const fp = (r.byte() << 8) | r.byte(), flags = r.byte();
    const g = r.varint() / 1000, dg = r.varint() / 1000, nl = r.byte(), launches = [];
    for (let k = 0; k < nl; k++) {
      const angle = r.byte(), b = r.byte(), n = r.byte();
      launches.push({ angle, spring: (b & 7) + 1, fps: FPS[(b >> 3) & 3], modelsOk: !!(b & 32), analysed: !!(b & 64), n });
    }
    const len = r.byte(), idBytes = []; for (let k = 0; k < len; k++) idBytes.push(r.byte());
    const body = bytes.slice(0, r.offset), chk = (r.byte() << 16) | (r.byte() << 8) | r.byte();
    if (r.offset !== bytes.length) return { ok: false, error: 'the code is damaged (incomplete copy?)' };
    const sub = { code: expectCode ? normaliseCode(expectCode) : '', id: new TextDecoder().decode(new Uint8Array(idBytes)), g, dg,
      answer: ANSWERS[flags & 7] ?? '', stick: flags & 8 ? 'front' : 'plane', launches };
    if (expectCode != null && fp !== fingerprint(expectCode)) return { ok: false, error: `made for a different assignment, not “${normaliseCode(expectCode)}”`, sub };
    if (expectCode != null && binCheck(expectCode, body) !== chk) return { ok: false, error: 'checksum does not match: the code was edited', sub };
    if (!sub.id || !(g > 0) || !(dg > 0)) return { ok: false, error: 'the code is damaged', sub };
    return { ok: true, sub };
  } catch { return { ok: false, error: 'the code is damaged (incomplete copy?)' }; }
}

/* ---------- the rubric: four checks, one point each ---------- */
export function gradeProjectile(sub, a) {
  const planet = assignmentPlanet(sub.id, a), G = planet.g;
  const ideal = idealG(planet, sub.launches.filter(l => l.analysed));
  const off = (Math.abs(sub.g - G) / G) * 100, rel = (sub.dg / sub.g) * 100;
  const good = sub.launches.filter(l => l.analysed && l.n >= a.points && l.modelsOk);
  const distinct = new Set(good.map(l => `${l.angle}|${l.spring}`)).size, needDistinct = Math.min(2, a.launches);
  const wrongModels = sub.launches.filter(l => l.analysed && !l.modelsOk).length;
  const q = questionFor2(a), covers = Math.abs(sub.g - ideal) <= 2 * sub.dg;
  const checks = [
    { id: 'value', label: 'Value', pass: off <= a.tol, detail: `${pct(off)} from g (allowed ${pct(a.tol)})${sub.stick === 'front' ? '; the metre stick was on the front edge (parallax)' : ''}` },
    { id: 'uncertainty', label: 'Uncertainty', pass: covers && rel <= a.maxRel,
      detail: !covers ? `range ${sub.g} ± ${sub.dg} does not reach ${ideal.toFixed(3)} within 2 × δg` : rel > a.maxRel ? `δg is ${pct(rel)} of g (max ${pct(a.maxRel)})` : `covers ${ideal.toFixed(3)}; δg is ${pct(rel)} of g` },
    { id: 'method', label: 'Method', pass: good.length >= a.launches && distinct >= needDistinct,
      detail: `${good.length} of ${a.launches} launches analysed with ${a.points}+ points and the right models; ${distinct} different launch ${distinct === 1 ? 'setting' : 'settings'}${wrongModels ? `; ${wrongModels} with a wrong model` : ''}` },
    { id: 'explanation', label: 'Explanation', pass: sub.answer === CORRECT2[q], detail: `${q} question: ${!sub.answer ? 'not answered' : sub.answer === CORRECT2[q] ? 'first answer correct' : 'first answer wrong'}` },
  ];
  return { planet, G, ideal, checks, score: checks.filter(c => c.pass).length, max: checks.length };
}

export function gradeProjectileBatch(text, a) {
  const tokens = String(text ?? '').match(/LB1?-[A-Za-z0-9_-]+/g) ?? [];
  const rows = tokens.map((t, i) => {
    const d = decodeProjectile(t, a.code), row = { n: i + 1, text: t.slice(0, 24) + '…', flags: [] };
    if (!d.ok) return { ...row, sub: d.sub ?? null, error: d.error };
    return { ...row, sub: d.sub, result: gradeProjectile(d.sub, a) };
  });
  const last = new Map();
  for (const r of rows) if (r.result) last.set(r.sub.id, r);
  for (const r of rows) if (r.result && last.get(r.sub.id) !== r) r.replaced = true;
  const sig = r => `${r.sub.g}|${r.sub.dg}|${r.sub.launches.map(l => `${l.angle}:${l.spring}:${l.n}`).join(';')}`, seen = new Map();
  for (const r of rows) if (r.result && !r.replaced) {
    const s = sig(r), other = seen.get(s);
    if (other && other.sub.id !== r.sub.id) { r.flags.push(`same data as ${other.sub.id}`); other.flags.push(`same data as ${r.sub.id}`); }
    else seen.set(s, r);
  }
  return rows;
}
/** A short description of a submission for the grading table's notes column. */
export const notesFor2 = sub => `${sub.launches.length} ${sub.launches.length === 1 ? 'launch' : 'launches'} (${sub.launches.map(l => `${l.angle}°, spring ${l.spring}, ${l.n} pts`).join('; ')}); stick ${sub.stick === 'front' ? 'on the front edge' : 'in the flight plane'}`;
export function gradesCsv2(rows) {
  const head = 'student_id,score,out_of,value,uncertainty,method,explanation,reported_g,reported_dg,true_g,launches,stick,notes';
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = rows.filter(r => r.result && !r.replaced).map(r => {
    const c = Object.fromEntries(r.result.checks.map(x => [x.id, x.pass ? 1 : 0]));
    return [q(r.sub.id), r.result.score, r.result.max, c.value, c.uncertainty, c.method, c.explanation, r.sub.g, r.sub.dg, r.result.G, r.sub.launches.length, r.sub.stick, q(r.flags.join('; '))].join(',');
  });
  return [head, ...lines].join('\n') + '\n';
}
