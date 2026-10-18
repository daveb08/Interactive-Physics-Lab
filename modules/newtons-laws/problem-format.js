/**
 * Faculty-authored Solve it problems: validation, cleaning, engine check, and sharing (file / link).
 * Pure module (no DOM) so it is unit-tested. Problem text is only ever rendered with textContent.
 */
import { createRun, sampleAt } from '../../js/core/physics.js';
import { correctOrder } from './solve-check.js';

export const FIGURES = ['cart', 'sprinter', 'pallet'];
export const ANSWER_KEYS = { a: 'acceleration (m/s²)', v: 'velocity (m/s)', x: 'position (m)' };
const LIMITS = { title: 120, statement: 2000, text: 300, feedback: 600, step: 60, noun: 20, label: 20, surface: 80, steps: 10, blocks: 40, quantities: 30 };

const isStr = (v, max, min = 1) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const isNum = v => typeof v === 'number' && Number.isFinite(v);

/** Returns a list of human-readable problems with the problem (empty = valid). */
export function validateProblem(p) {
  const errors = [];
  const err = m => errors.push(m);
  if (!p || typeof p !== 'object') return ['The problem is empty or not an object.'];
  if (!isStr(p.title, LIMITS.title)) err(`Title is required (up to ${LIMITS.title} characters).`);
  if (!isStr(p.statement, LIMITS.statement, 10)) err(`Problem statement is required (10–${LIMITS.statement} characters).`);

  const s = p.setup;
  if (!s || typeof s !== 'object') err('Simulation settings are missing.');
  else {
    if (!isNum(s.mass) || s.mass <= 0 || s.mass > 10000) err('Mass must be a positive number up to 10 000 kg.');
    if (!isNum(s.force) || Math.abs(s.force) > 100000) err('Applied force must be a number (newtons).');
    if (!isNum(s.velocity) || Math.abs(s.velocity) > 1000) err('Initial velocity must be a number (m/s).');
    if (s.frictionEnabled) {
      if (!isNum(s.muK) || !isNum(s.muS) || s.muK < 0 || s.muS < s.muK || s.muS > 1) err('Friction coefficients must satisfy 0 ≤ μk ≤ μs ≤ 1.');
    }
  }
  if (!isNum(p.runTime) || p.runTime <= 0 || p.runTime > 30) err('Simulation length must be between 0 and 30 s.');
  if (!isNum(p.targetTime) || p.targetTime <= 0 || (isNum(p.runTime) && p.targetTime > p.runTime)) err('Target time must be positive and no longer than the simulation length.');
  if (p.figure !== undefined && !FIGURES.includes(p.figure)) err(`Scene figure must be one of: ${FIGURES.join(', ')}.`);
  for (const k of ['noun', 'label', 'surface']) if (p[k] !== undefined && !isStr(p[k], LIMITS[k], 0)) err(`Scene ${k} is too long (max ${LIMITS[k]}).`);
  if (p.view !== undefined && (!isNum(p.view?.min) || !isNum(p.view?.max) || p.view.max - p.view.min < 1)) err('Track view needs min < max, at least 1 m apart.');
  if (p.revealAfter !== undefined && (!Number.isInteger(p.revealAfter) || p.revealAfter < 0 || p.revealAfter > 10)) err('“Reveal after” must be a whole number from 0 to 10.');

  // Step 1 cards
  const q = Array.isArray(p.quantities) ? p.quantities : [];
  if (!q.length) err('Add at least one Step 1 card.');
  if (q.length > LIMITS.quantities) err(`At most ${LIMITS.quantities} Step 1 cards.`);
  const qIds = new Set();
  q.forEach((c, i) => {
    const n = `Step 1 card ${i + 1}`;
    if (!isStr(c?.id, 40) || qIds.has(c.id)) err(`${n} needs a unique id.`); else qIds.add(c.id);
    if (!isStr(c?.text, LIMITS.text)) err(`${n} needs text.`);
    if (!['known', 'unknown', 'none'].includes(c?.role)) err(`${n} must be Known, Unknown or Neither.`);
    if (c?.role === 'none' && !isStr(c.feedback, LIMITS.feedback)) err(`${n} (“${c.text || ''}”) belongs in neither box, so it needs feedback explaining why.`);
  });
  if (q.length && !q.some(c => c.role === 'known')) err('Step 1 needs at least one Known card.');
  if (q.length && !q.some(c => c.role === 'unknown')) err('Step 1 needs at least one Unknown card.');

  // Step 2 steps and blocks
  const steps = p.steps && typeof p.steps === 'object' ? p.steps : {};
  const stepKeys = Object.keys(steps);
  if (!stepKeys.length) err('Add at least one solution step.');
  if (stepKeys.length > LIMITS.steps) err(`At most ${LIMITS.steps} solution steps.`);
  for (const k of stepKeys) if (!isStr(steps[k], LIMITS.step)) err(`Every solution step needs a short name (step “${k}”).`);
  const blocks = Array.isArray(p.blocks) ? p.blocks : [];
  if (blocks.length > LIMITS.blocks) err(`At most ${LIMITS.blocks} blocks.`);
  const bIds = new Set();
  blocks.forEach((b, i) => {
    const n = `Block ${i + 1}${b?.text ? ` (“${String(b.text).slice(0, 40)}”)` : ''}`;
    if (!isStr(b?.id, 40) || bIds.has(b.id)) err(`${n} needs a unique id.`); else bIds.add(b.id);
    if (!isStr(b?.text, LIMITS.text)) err(`${n} needs text.`);
    if (!stepKeys.includes(b?.step)) err(`${n} belongs to a step that does not exist.`);
    for (const a of b?.after || []) if (!stepKeys.includes(a)) err(`${n} depends on a step that does not exist.`);
    if (b?.after && !Array.isArray(b.after)) err(`${n}: “depends on” must be a list.`);
    if (!b?.correct && !isStr(b?.feedback, LIMITS.feedback)) err(`${n} is a wrong block, so it needs misconception feedback.`);
    if (b?.effect !== undefined) {
      if (typeof b.effect !== 'object' || (b.effect.a !== undefined && !isNum(b.effect.a)) || (b.effect.v0 !== undefined && !isNum(b.effect.v0))) err(`${n}: the ghost settings must be numbers.`);
    }
    if (b?.answer !== undefined) {
      const a = b.answer;
      if (!a || !(a.key in ANSWER_KEYS) || !isNum(a.t) || a.t < 0 || !isNum(a.value)) err(`${n}: the plotted answer needs a quantity (a, v or x), a time ≥ 0 and a value.`);
    }
  });
  for (const k of stepKeys) {
    const n = blocks.filter(b => b?.step === k && b.correct).length;
    if (n !== 1) err(`Step “${steps[k] || k}” needs exactly one correct block (it has ${n}).`);
  }
  if (!errors.length) { try { correctOrder(p); } catch { err('The “depends on” choices form a loop: some step must come first.'); } }
  return errors;
}

/** Copy only known fields (so a shared file cannot smuggle in anything else). */
export function cleanProblem(p) {
  const num = v => (isNum(v) ? v : undefined);
  const out = {
    title: String(p.title || '').trim(), statement: String(p.statement || '').trim(),
    setup: { mass: num(p.setup?.mass), force: num(p.setup?.force), velocity: num(p.setup?.velocity) },
    targetTime: num(p.targetTime), runTime: num(p.runTime),
    quantities: (p.quantities || []).map(c => ({ id: String(c.id), text: String(c.text), role: c.role, ...(c.role === 'none' ? { feedback: String(c.feedback || '') } : {}) })),
    steps: Object.fromEntries(Object.entries(p.steps || {}).map(([k, v]) => [String(k), String(v)])),
    blocks: (p.blocks || []).map(b => {
      const o = { id: String(b.id), step: String(b.step), text: String(b.text) };
      if (b.correct) o.correct = true; else o.feedback = String(b.feedback || '');
      if (b.after?.length) o.after = b.after.map(String);
      if (b.effect && (isNum(b.effect.a) || isNum(b.effect.v0))) o.effect = { ...(isNum(b.effect.a) ? { a: b.effect.a } : {}), ...(isNum(b.effect.v0) ? { v0: b.effect.v0 } : {}) };
      if (b.answer && b.answer.key in ANSWER_KEYS) o.answer = { key: b.answer.key, t: num(b.answer.t), value: num(b.answer.value) };
      return o;
    }),
  };
  if (p.setup?.frictionEnabled) Object.assign(out.setup, { frictionEnabled: true, muS: num(p.setup.muS), muK: num(p.setup.muK) });
  if (FIGURES.includes(p.figure) && p.figure !== 'cart') out.figure = p.figure;
  for (const k of ['noun', 'label', 'surface']) if (typeof p[k] === 'string' && p[k].trim()) out[k] = p[k].trim();
  if (isNum(p.view?.min) && isNum(p.view?.max)) out.view = { min: p.view.min, max: p.view.max };
  if (Number.isInteger(p.revealAfter)) out.revealAfter = p.revealAfter;
  return out;
}

/** Compare every plotted answer of a correct block with the physics engine. */
export function engineCheck(p) {
  const run = createRun(p.setup, { duration: p.runTime });
  return p.blocks.filter(b => b.correct && b.answer).map(b => {
    const t = Math.min(b.answer.t, run.endTime);
    const sim = sampleAt(run, t)[b.answer.key];
    return { id: b.id, step: p.steps[b.step], key: b.answer.key, t: b.answer.t, stated: b.answer.value, sim, ok: Math.abs(sim - b.answer.value) <= 0.01 * Math.abs(sim) + 0.01 };
  });
}

/** Simulation values at a time, for the editor's live readout. */
export function engineAt(p, t) {
  const run = createRun(p.setup, { duration: p.runTime });
  const s = sampleAt(run, Math.min(t, run.endTime));
  return { t: s.t, a: s.a, v: s.v, x: s.x, endTime: run.endTime, reason: run.reason, friction: s.friction, netForce: s.netForce };
}

/* ---------- sharing: base64url, deflate-compressed when the platform supports it ---------- */
const b64url = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };
async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }

export async function encodeProblem(p) {
  const bytes = new TextEncoder().encode(JSON.stringify(cleanProblem(p)));
  if (typeof CompressionStream === 'function') return `z${b64url(await pipe(bytes, new CompressionStream('deflate-raw')))}`;
  return `j${b64url(bytes)}`;
}

/** Decode, clean and validate. Returns { problem } or { errors }. */
export async function decodeProblem(code) {
  try {
    let bytes = unb64url(code.slice(1));
    if (code[0] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    else if (code[0] !== 'j') return { errors: ['This link is not a Solve it problem.'] };
    return parseProblemJson(new TextDecoder().decode(bytes));
  } catch { return { errors: ['This problem link is damaged or incomplete. Ask your instructor for a new link.'] }; }
}

export function parseProblemJson(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return { errors: ['The file is not valid JSON.'] }; }
  const problem = cleanProblem(raw);
  const errors = validateProblem(problem);
  return errors.length ? { errors } : { problem };
}
