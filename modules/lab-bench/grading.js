/**
 * Lab Bench grading (Stage 3). Pure (no DOM), unit-tested, shared by the lab page and the instructor page.
 *
 * An assignment lives in the lab link's query string: ?a=<code>&t=<gate %>,<watch %>&u=<max δg/g %>&n=<heights>x<trials>&air=any|none&k=<key check>.
 * A student's planet comes from their ID and the assignment code, so nothing is stored anywhere: the instructor page
 * recomputes every planet from the completion codes students paste into Canvas.
 *
 * The completion code carries a checksum made with a key that is in this file. That stops casual editing, not a
 * determined student reading the source: the accepted trade-off (see docs/specs/lab-bench.md).
 */
import { planetFor, normaliseId, hash32, PRACTICE_CODE } from '../../js/core/lab-noise.js';
import { fallTime, BALLS } from '../../js/core/freefall-drag.js';
import { idealFitG } from './notebook-model.js';

export const DEFAULTS = Object.freeze({ tolGate: 3, tolWatch: 15, maxRel: 15, heights: 3, trials: 5, air: 'any' });
const SECRET = 'ipl-lab-bench-1·g';

const clampNum = (v, lo, hi, d) => (Number.isFinite(+v) && v !== '' && v !== null ? Math.min(hi, Math.max(lo, +v)) : d);
export const normaliseCode = c => String(c ?? '').trim().toLowerCase().replace(/[^a-z0-9\-_.]/g, '').slice(0, 40);

/** The assignment in a lab link, or null for practice (no code, or the practice code). */
export function parseAssignment(search) {
  const p = new URLSearchParams(search);
  const code = normaliseCode(p.get('a'));
  if (!code || code === PRACTICE_CODE) return null;
  const [tg, tw] = String(p.get('t') ?? '').split(',');
  const [nh, nt] = String(p.get('n') ?? '').split('x');
  return {
    code,
    tolGate: clampNum(tg, 0.5, 50, DEFAULTS.tolGate), tolWatch: clampNum(tw, 0.5, 50, DEFAULTS.tolWatch),
    maxRel: clampNum(p.get('u'), 1, 100, DEFAULTS.maxRel),
    heights: Math.round(clampNum(nh, 2, 8, DEFAULTS.heights)), trials: Math.round(clampNum(nt, 2, 20, DEFAULTS.trials)),
    air: p.get('air') === 'none' ? 'none' : 'any',
    keyCheck: String(p.get('k') ?? '').replace(/[^a-z0-9]/g, '').slice(0, 12),
  };
}
/** The query string for an assignment (inverse of parseAssignment). */
export function assignmentQuery(a) {
  const q = new URLSearchParams({ a: a.code, t: `${a.tolGate},${a.tolWatch}`, u: String(a.maxRel), n: `${a.heights}x${a.trials}`, air: a.air });
  if (a.keyCheck) q.set('k', a.keyCheck);
  return q.toString();
}

/** A grading key the instructor keeps; the student link carries only its check value, so a student cannot grade. */
const WORDS = ['amber', 'basalt', 'cobalt', 'delta', 'ember', 'fjord', 'garnet', 'harbor', 'indigo', 'juniper', 'kestrel', 'lumen', 'meteor', 'nimbus', 'orbit', 'prism', 'quartz', 'raven', 'sierra', 'tundra', 'umber', 'vector', 'willow', 'zephyr'];
export function makeKey(rand = Math.random) {
  const w = () => WORDS[Math.floor(rand() * WORDS.length)];
  return `${w()}-${w()}-${String(Math.floor(rand() * 90) + 10)}`;
}
export const keyCheck = key => hash32(`ipl-grading-key|${String(key ?? '').trim().toLowerCase()}`).toString(36);

/** The student's planet in this assignment (an air of "none" makes every planet airless). */
export function assignmentPlanet(studentId, a) {
  const p = planetFor(studentId, a.code);
  return a.air === 'none' ? { ...p, air: 'none', rho: 0 } : p;
}

/** Which "explain your result" question fits the data: one per combination of timer, ball and air. */
export function questionFor({ timer, ball, rho }) {
  if (timer === 'watch') return 'watch';
  if (ball === 'pingpong' && rho >= 0.5) return 'drag';
  return 'height';
}
export const CORRECT = Object.freeze({ watch: 'a', drag: 'a', height: 'a' });

/* ---------- completion codes ----------
 * Current format "LB-…": a compact binary record, base64url. About 40 characters for a typical submission.
 * Bytes: [version|lab] [assignment fingerprint ×2] [flags] g·1000 (varint) δg·1000 (varint) [n heights]
 *        (mm varint, drops)… [id length] id (UTF-8) [checksum ×3]. The checksum covers the assignment code too,
 * so a code cannot be moved to another assignment. Older "LB1-" codes (text, longer) still decode and grade.
 */
const OLD_PREFIX = 'LB1-', PREFIX = 'LB-', FORMAT = 2, LAB_FREEFALL = 1;
const unb64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
const bytesToB64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64ToBytes = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const check = payload => hash32(`${SECRET}|${payload}`).toString(36).padStart(7, '0');
const fingerprint = code => hash32(`ipl-assignment|${normaliseCode(code)}`) & 0xffff;
const binCheck = (code, bytes) => hash32(`${SECRET}|${normaliseCode(code)}|${Array.from(bytes).join(',')}`) & 0xffffff;
const ANSWERS = ['', 'a', 'b', 'c', 'd'], BALL_IDS = ['steel', 'pingpong'];

function pushVarint(out, n) {
  n = Math.max(0, Math.round(n));
  while (n >= 0x80) { out.push((n & 0x7f) | 0x80); n = Math.floor(n / 128); }
  out.push(n);
}
function reader(bytes) {
  let i = 0;
  const byte = () => { if (i >= bytes.length) throw new RangeError('short'); return bytes[i++]; };
  return {
    byte,
    varint() { let n = 0, mul = 1, b; do { b = byte(); n += (b & 0x7f) * mul; mul *= 128; } while (b & 0x80 && mul < 2 ** 35); return n; },
    get offset() { return i; },
  };
}

/**
 * sub = { code, id, g, dg, timer: 'gate'|'watch', ball: 'steel'|'pingpong', heights: [[mm, n], …], answer: 'a'–'d' or '' }
 * g and δg are kept to 0.001 m/s² (a positive δg is never rounded to zero).
 */
export function encodeSubmission(sub) {
  const out = [(FORMAT << 4) | LAB_FREEFALL];
  const fp = fingerprint(sub.code); out.push(fp >> 8, fp & 0xff);
  out.push((sub.timer === 'watch' ? 1 : 0) | (Math.max(0, BALL_IDS.indexOf(sub.ball)) << 1) | (Math.max(0, ANSWERS.indexOf(sub.answer || '')) << 3));
  pushVarint(out, +sub.g * 1000); pushVarint(out, Math.max(1, +sub.dg * 1000));
  out.push(Math.min(255, sub.heights.length));
  for (const [mm, n] of sub.heights.slice(0, 255)) { pushVarint(out, mm); out.push(Math.min(255, Math.round(n))); }
  const id = new TextEncoder().encode(normaliseId(sub.id)).slice(0, 255);
  out.push(id.length, ...id);
  const c = binCheck(sub.code, out); out.push(c >> 16, (c >> 8) & 0xff, c & 0xff);
  return PREFIX + bytesToB64(out);
}

function decodeOld(raw) {
  let body;
  try { body = unb64(raw.slice(OLD_PREFIX.length)); } catch { return { ok: false, error: 'the code is damaged (incomplete copy?)' }; }
  const parts = body.split('|');
  if (parts.length !== 10 || parts[0] !== '1') return { ok: false, error: 'the code is damaged (incomplete copy?)' };
  const chk = parts.pop(), payload = parts.join('|');
  const [, code, id, g, dg, timer, ball, hs, answer] = parts;
  const heights = hs ? hs.split(';').map(x => x.split(':').map(Number)) : [];
  const sub = { code, id, g: +g, dg: +dg, timer, ball, heights, answer: answer === '-' ? '' : answer };
  if (check(payload) !== chk) return { ok: false, error: 'checksum does not match: the code was edited', sub };
  return { ok: true, sub };
}
/**
 * Decode a completion code. The short format names only a fingerprint of its assignment, so pass the assignment
 * code you are grading (`expectCode`): a code for another assignment is reported as such.
 */
export function decodeSubmission(text, expectCode) {
  const raw = String(text ?? '').replace(/\s+/g, '');
  let d;
  if (raw.startsWith(OLD_PREFIX)) d = decodeOld(raw);
  else if (raw.startsWith(PREFIX)) {
    let bytes;
    try { bytes = b64ToBytes(raw.slice(PREFIX.length)); } catch { return { ok: false, error: 'the code is damaged (incomplete copy?)' }; }
    try {
      const r = reader(bytes), head = r.byte();
      if (head >> 4 !== FORMAT || (head & 15) !== LAB_FREEFALL) return { ok: false, error: 'not a Lab 1 completion code' };
      const fp = (r.byte() << 8) | r.byte(), flags = r.byte();
      const g = r.varint() / 1000, dg = r.varint() / 1000, nh = r.byte(), heights = [];
      for (let k = 0; k < nh; k++) heights.push([r.varint(), r.byte()]);
      const len = r.byte(), idBytes = []; for (let k = 0; k < len; k++) idBytes.push(r.byte());
      const body = bytes.slice(0, r.offset), chk = (r.byte() << 16) | (r.byte() << 8) | r.byte();
      if (r.offset !== bytes.length) return { ok: false, error: 'the code is damaged (incomplete copy?)' };
      const sub = { code: expectCode ? normaliseCode(expectCode) : '', id: new TextDecoder().decode(new Uint8Array(idBytes)), g, dg,
        timer: flags & 1 ? 'watch' : 'gate', ball: BALL_IDS[(flags >> 1) & 3] ?? '', heights, answer: ANSWERS[(flags >> 3) & 7] ?? '' };
      if (expectCode != null && fp !== fingerprint(expectCode)) return { ok: false, error: `made for a different assignment, not “${normaliseCode(expectCode)}”`, sub, wrongAssignment: true };
      if (expectCode != null && binCheck(expectCode, body) !== chk) return { ok: false, error: 'checksum does not match: the code was edited', sub };
      d = { ok: true, sub };
    } catch { return { ok: false, error: 'the code is damaged (incomplete copy?)' }; }
  } else return { ok: false, error: 'not a Lab Bench completion code' };
  if (!d.ok) return d;
  const { sub } = d;
  if (!sub.id || !(sub.g > 0) || !(sub.dg > 0) || !['gate', 'watch'].includes(sub.timer) || !BALLS[sub.ball] || sub.heights.some(h => h.length !== 2 || !(h[0] > 0) || !(h[1] > 0)))
    return { ok: false, error: 'the code is damaged', sub };
  return d;
}

/* ---------- the rubric ---------- */
const pct = v => `${(Math.round(v * 10) / 10).toString()} %`;
/** Grade one decoded submission against the assignment. Four checks, one point each. */
export function grade(sub, a) {
  const planet = assignmentPlanet(sub.id, a), G = planet.g, ball = BALLS[sub.ball];
  const hm = sub.heights.map(([mm]) => mm / 1000);
  const ideal = idealFitG(hm, h => fallTime({ g: G, ball, rho: planet.rho }, h));
  const tol = sub.timer === 'gate' ? a.tolGate : a.tolWatch, off = (Math.abs(sub.g - G) / G) * 100, rel = (sub.dg / sub.g) * 100;
  const full = sub.heights.filter(([, n]) => n >= a.trials).length;
  const q = questionFor({ timer: sub.timer, ball: sub.ball, rho: planet.rho });
  const covers = Number.isFinite(ideal) && Math.abs(sub.g - ideal) <= 2 * sub.dg;
  const checks = [
    { id: 'value', label: 'Value', pass: off <= tol, detail: `${pct(off)} from g (allowed ${pct(tol)} with the ${sub.timer === 'gate' ? 'electronic timer' : 'stopwatch'})` },
    { id: 'uncertainty', label: 'Uncertainty', pass: covers && rel <= a.maxRel,
      detail: !covers ? `range ${sub.g} ± ${sub.dg} does not reach ${Number.isFinite(ideal) ? ideal.toFixed(3) : '–'} within 2 × δg` : rel > a.maxRel ? `δg is ${pct(rel)} of g (max ${pct(a.maxRel)})` : `covers ${ideal.toFixed(3)}; δg is ${pct(rel)} of g` },
    { id: 'method', label: 'Method', pass: full >= a.heights, detail: `${full} of ${a.heights} heights with ${a.trials}+ drops` },
    { id: 'explanation', label: 'Explanation', pass: sub.answer === CORRECT[q], detail: `${{ watch: 'reaction-time', drag: 'air-drag', height: 'height-reading' }[q]} question: ${!sub.answer ? 'not answered' : sub.answer === CORRECT[q] ? 'first answer correct' : 'first answer wrong'}` },
  ];
  return { planet, G, ideal, checks, score: checks.filter(c => c.pass).length, max: checks.length };
}

/**
 * Grade everything pasted (one code per line, or a Canvas export: any text containing codes).
 * A later code from the same student replaces an earlier one; identical data under two IDs is flagged.
 */
export function gradeBatch(text, a) {
  const tokens = String(text ?? '').match(/LB1?-[A-Za-z0-9_-]+/g) ?? [];
  const rows = tokens.map((t, i) => {
    const d = decodeSubmission(t, a.code), row = { n: i + 1, text: t.replace(/\s+/g, '').slice(0, 24) + '…', flags: [] };
    if (!d.ok) return { ...row, sub: d.sub ?? null, error: d.error };
    row.sub = d.sub;
    if (d.sub.code !== a.code) return { ...row, error: `made for assignment “${d.sub.code}”, not “${a.code}”` };
    return { ...row, result: grade(d.sub, a) };
  });
  const last = new Map();
  for (const r of rows) if (r.result) last.set(r.sub.id, r);
  for (const r of rows) if (r.result && last.get(r.sub.id) !== r) r.replaced = true;
  const sig = r => `${r.sub.g}|${r.sub.dg}|${r.sub.heights.map(h => h.join(':')).join(';')}`, seen = new Map();
  for (const r of rows) if (r.result && !r.replaced) {
    const s = sig(r), other = seen.get(s);
    if (other && other.sub.id !== r.sub.id) { r.flags.push(`same data as ${other.sub.id}`); other.flags.push(`same data as ${r.sub.id}`); }
    else seen.set(s, r);
  }
  return rows;
}

export function gradesCsv(rows) {
  const head = 'student_id,score,out_of,value,uncertainty,method,explanation,reported_g,reported_dg,true_g,timer,ball,notes';
  const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = rows.filter(r => r.result && !r.replaced).map(r => {
    const c = Object.fromEntries(r.result.checks.map(x => [x.id, x.pass ? 1 : 0]));
    return [q(r.sub.id), r.result.score, r.result.max, c.value, c.uncertainty, c.method, c.explanation, r.sub.g, r.sub.dg, r.result.G, r.sub.timer, r.sub.ball, q(r.flags.join('; '))].join(',');
  });
  return [head, ...lines].join('\n') + '\n';
}
