/**
 * Faculty-authored Solve it problems: validation, cleaning, engine check, and sharing (file / link).
 * Pure module (no DOM) so it is unit-tested. Problem text is only ever rendered with textContent.
 */
import { createRun, sampleAt, GRAVITY } from '../../js/core/physics.js';
import { correctOrder } from './solve-check.js';

export const FIGURES = ['cart', 'sprinter', 'pallet', 'crate'];
export const ANSWER_KEYS = { a: 'acceleration (m/s²)', v: 'velocity (m/s)', x: 'position (m)' };
const LIMITS = { title: 120, statement: 2000, text: 300, feedback: 600, step: 60, noun: 20, label: 20, surface: 80, steps: 10, blocks: 40, quantities: 30 };

const isStr = (v, max, min = 1) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const isNum = v => typeof v === 'number' && Number.isFinite(v);

/** Friction rule for authored problems: 0 ≤ μk < μs ≤ 1 (static strictly greater than kinetic). Null when fine. */
export function frictionError(muS, muK) {
  if (!isNum(muS) || !isNum(muK)) return 'Enter both friction coefficients (numbers from 0 to 1).';
  if (muS > 1 || muK > 1) return 'Friction coefficients must be at most 1.';
  if (muS < 0 || muK < 0) return 'Friction coefficients cannot be negative.';
  if (muS <= muK) return `The static coefficient μs (${muS}) must be greater than the kinetic coefficient μk (${muK}).`;
  return null;
}

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
      const fe = frictionError(s.muS, s.muK);
      if (fe) err(fe);
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
      if (!a || !(a.key in ANSWER_KEYS) || !isNum(a.t) || a.t < 0 || !isNum(a.value)) err(`${n}: the plotted answer needs a quantity (a, v or x), a time ≥ 0, and a value (leave the value blank to use the simulation’s).`);
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
    const res = parseProblemJson(new TextDecoder().decode(bytes));
    return res.errors ? { errors: res.errors } : res;
  } catch { return { errors: ['This problem link is damaged or incomplete. Ask your instructor for a new link.'] }; }
}

export function parseProblemJson(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return { errors: ['The file is not valid JSON.'] }; }
  const res = prepareProblem(cleanProblem(raw));
  return res.errors ? { errors: res.errors } : res;
}

/** Clean → fill placeholders → validate. Used by the editor, links and files alike. */
export function prepareProblem(raw) {
  const { problem, errors: phErrors } = resolveProblem(raw);
  const errors = [...phErrors, ...validateProblem(problem)];
  return errors.length ? { errors, problem } : { problem };
}

/* ---------- Placeholders: {v0}, {a}, {v@2} … filled from the settings and the simulation ---------- */
export const PLACEHOLDERS = [
  ['m', 'mass (kg)'], ['F', 'applied force (N)'], ['v0', 'initial velocity (m/s)'], ['muS', 'μs'], ['muK', 'μk'],
  ['g', 'g = 9.81 m/s²'], ['t', 'target time (s)'],
  ['a', 'acceleration at the target time'], ['v', 'velocity at the target time'], ['x', 'position at the target time'],
  ['N', 'normal force'], ['W', 'weight'], ['f', 'friction force (signed)'], ['Fnet', 'net force (signed)'], ['fmax', 'max static friction μs N'],
  ['tstop', 'time the object stops (if it does)'],
  ['v@T', 'velocity at time T, e.g. {v@2}'], ['x@T', 'position at time T'], ['a@T', 'acceleration at time T'],
];
const TOKEN = /\{([A-Za-z]+[0-9]?)(?:@(\d+(?:\.\d+)?))?\}/g;
export function formatValue(x) {
  if (!Number.isFinite(x)) return '?';
  const r = Math.abs(x) < 5e-4 ? 0 : Number(x.toPrecision(4));
  return String(r).replace('-', '−');
}

/** Numbers for every placeholder, or null for those the simulation cannot provide yet. */
export function placeholderValues(p) {
  const s = p.setup || {}, vals = { m: s.mass, F: s.force, v0: s.velocity, muS: s.muS, muK: s.muK, g: GRAVITY, t: p.targetTime };
  let run = null;
  try { run = createRun(s, { duration: p.runTime }); } catch { return { vals, at: () => null }; }
  const at = t => { if (!isNum(t) || t < 0) return null; const q = sampleAt(run, Math.min(t, run.endTime)); return { ...q, friction: q.friction ?? 0, netForce: q.netForce ?? s.force }; };
  const q = at(p.targetTime);
  if (q) Object.assign(vals, { a: q.a, v: q.v, x: q.x, f: q.friction, Fnet: q.netForce });
  Object.assign(vals, { N: s.mass * GRAVITY, W: s.mass * GRAVITY, fmax: s.frictionEnabled ? s.muS * s.mass * GRAVITY : 0 });
  const stop = (run.events || []).find(e => /Stop/.test(e.label));
  vals.tstop = stop ? stop.t : null;
  return { vals, at };
}

/** Replace placeholders in one string. Unknown or unavailable ones are reported. */
export function resolveText(text, ctx, problems = []) {
  if (typeof text !== 'string' || !text.includes('{')) return text;
  return text.replace(TOKEN, (all, name, time) => {
    if (time !== undefined) {
      if (!['a', 'v', 'x'].includes(name)) { problems.push(`Unknown placeholder ${all}: only {a@T}, {v@T} and {x@T} take a time.`); return all; }
      const q = ctx.at(Number(time));
      if (!q) { problems.push(`Placeholder ${all} needs valid simulation settings.`); return all; }
      return formatValue(q[name]);
    }
    if (!(name in ctx.vals)) { problems.push(`Unknown placeholder ${all}. See the placeholder list in section 2.`); return all; }
    const v = ctx.vals[name];
    if (v === null || v === undefined) { problems.push(name === 'tstop' ? `${all} is used, but the object never stops in this simulation.` : `Placeholder ${all} has no value yet (check the simulation settings${/mu/.test(name) ? ' and turn on friction' : ''}).`); return all; }
    return formatValue(v);
  });
}

/** A copy of the problem with every placeholder filled and blank plotted answers taken from the simulation. */
export function resolveProblem(raw) {
  const p = JSON.parse(JSON.stringify(raw)), ctx = placeholderValues(p), problems = [];
  const r = t => resolveText(t, ctx, problems);
  p.title = r(p.title); p.statement = r(p.statement);
  for (const c of p.quantities || []) { c.text = r(c.text); if (c.feedback) c.feedback = r(c.feedback); }
  for (const k of Object.keys(p.steps || {})) p.steps[k] = r(p.steps[k]);
  for (const b of p.blocks || []) {
    b.text = r(b.text); if (b.feedback) b.feedback = r(b.feedback);
    if (b.answer && b.answer.key in ANSWER_KEYS && isNum(b.answer.t) && !isNum(b.answer.value)) {
      const q = ctx.at(b.answer.t);
      if (q) b.answer.value = Number(q[b.answer.key].toPrecision(6));
    }
  }
  if (p.label) p.label = r(p.label);
  if (p.surface) p.surface = r(p.surface);
  return { problem: p, errors: [...new Set(problems)] };
}

/* ---------- Warnings: consistency checks that do not block sharing ---------- */

const NUM = String.raw`([+\-−]?\d+(?:\.\d+)?)`;
// Longest units first so "m/s²" is never read as "m/s" or "m".
const UNITS = [
  ['a', String.raw`m\s*/\s*s(?:²|\^2|2)`], ['v', String.raw`m\s*/\s*s(?![²^2])`], ['mass', 'kg'], ['force', 'N'],
  ['angle', '°|deg(?:rees)?'], ['x', 'm(?![/a-zA-Z])'], ['t', 's(?![a-zA-Z])'],
];
const num = s => Number(s.replace('−', '-'));
const close = (a, b) => Math.abs(a - b) <= 0.01 * Math.abs(b) + 0.01;

/** Every "number unit" in a text, e.g. "4.0 kg" → { value: 4, unit: 'mass' }. */
export function quantitiesIn(text) {
  const out = [];
  for (const [unit, pattern] of UNITS) {
    const re = new RegExp(`${NUM}\\s*(?:${pattern})`, 'g');
    for (const m of String(text).matchAll(re)) out.push({ value: num(m[1]), unit, at: m.index });
  }
  // A number counted under a longer unit (m/s²) must not also count under a shorter one (m/s, m).
  return out.filter((q, i) => !out.some((o, j) => j < i && o.at === q.at));
}
const bareNumbers = text => [...String(text).matchAll(/(?<![\w.])([+\-−]?\d*\.?\d+)(?!\w|\.\d)/g)].map(m => num(m[1]));

/**
 * Settings the statement should mention, as [label, statement unit, value, skip-if].
 * For ramps, add e.g. ['ramp angle', 'angle', setup.angle].
 */
function statementSettings(p) {
  const s = p.setup;
  return [
    ['mass', 'mass', s.mass],
    ['applied force', 'force', s.force, s.force === 0],
    ['initial velocity', 'v', s.velocity, s.velocity === 0],
    ['target time', 't', p.targetTime],
    ...(s.angle !== undefined ? [['ramp angle', 'angle', s.angle]] : []),
  ];
}

/**
 * The forces in the problem at time t, by name. On a level track N = mg. A future ramp model adds the angle here:
 * N = mg cos θ and a gravity component mg sin θ along the ramp.
 */
export function forcesAt(p, t) {
  const run = createRun(p.setup, { duration: p.runTime });
  const s = sampleAt(run, Math.min(t, run.endTime));
  const m = p.setup.mass, out = { applied: p.setup.force, weight: m * GRAVITY, normal: m * GRAVITY };
  if (p.setup.frictionEnabled) Object.assign(out, { friction: s.friction, net: s.netForce, maxStatic: p.setup.muS * m * GRAVITY });
  else out.net = p.setup.force;
  return out;
}

/** Event times the simulation knows about (stop, force removal, boundary), plus the target time. */
function keyTimes(p) {
  const run = createRun(p.setup, { duration: p.runTime });
  return [p.targetTime, run.endTime, ...(run.events || []).map(e => e.t)];
}

/** Returns a list of warnings (sharing is still allowed). Call only on a problem that validates. */
export function lintProblem(p) {
  const warnings = [], warn = m => warnings.push(m);
  // 1. Statement numbers vs simulation settings.
  const found = quantitiesIn(p.statement);
  for (const [label, unit, value, skip] of statementSettings(p)) {
    if (skip) continue;
    const said = found.filter(q => q.unit === unit).map(q => q.value);
    if (said.length && !said.some(v => close(Math.abs(v), Math.abs(value)))) warn(`The statement mentions ${said.map(v => `${v} ${unitLabel(unit)}`).join(', ')}, but the ${label} is set to ${value} ${unitLabel(unit)}.`);
  }
  if (p.setup.frictionEnabled) {
    const nums = bareNumbers(p.statement);
    if (!nums.some(v => close(v, p.setup.muK))) warn(`Friction is on with μk = ${p.setup.muK}, but the statement never mentions ${p.setup.muK}.`);
  }

  // 2. Arithmetic at the end of correct blocks vs the simulation.
  for (const b of p.blocks.filter(b => b.correct)) {
    const qs = quantitiesIn(b.text);
    const last = qs.sort((a, c) => a.at - c.at).at(-1);
    const t = b.answer?.t ?? p.targetTime;
    const short = `“${b.text.length > 50 ? `${b.text.slice(0, 50)}…` : b.text}”`;
    if (b.answer && last && last.unit === b.answer.key && !close(last.value, b.answer.value)) warn(`${short} ends in ${last.value} ${unitLabel(last.unit)}, but its plotted answer is ${b.answer.value}.`);
    const verdict = last ? checkAgainstSimulation(p, last, t) : null;
    if (verdict && !verdict.ok) warn(`${short} ends in ${last.value} ${unitLabel(last.unit)}, but the simulation gives ${verdict.expected}.`);
    // 3. Coverage.
    if (!b.answer && !verdict) warn(`The correct block ${short} has no plotted answer and no number the editor can check, so it is not checked against the simulation.`);
  }
  for (const b of p.blocks.filter(b => !b.correct)) {
    if (!b.effect && !b.answer) warn(`The wrong block “${b.text.slice(0, 50)}” has no ghost setting and no plotted answer, so students who pick it see feedback but no difference in the simulation.`);
  }
  return warnings;
}

function checkAgainstSimulation(p, q, t) {
  const f3 = v => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3);
  if (q.unit === 'a' || q.unit === 'v' || q.unit === 'x') {
    const s = engineAt(p, t), sim = s[q.unit];
    if (q.unit === 'a' && Math.abs(q.value) === GRAVITY) return null;   // "g = 9.81 m/s²" is a given, not a result
    return { ok: close(q.value, sim) || close(Math.abs(q.value), Math.abs(sim)), expected: `${q.unit} = ${f3(sim)} ${unitLabel(q.unit)} at t = ${f3(Math.min(t, s.endTime))} s` };
  }
  if (q.unit === 'force') {
    const forces = forcesAt(p, t), names = Object.entries(forces);
    const ok = names.some(([, v]) => close(Math.abs(q.value), Math.abs(v)));
    return { ok, expected: `these forces: ${names.map(([n, v]) => `${n.replace('maxStatic', 'max static')} ${f3(v)} N`).join(', ')}` };
  }
  if (q.unit === 't') {
    const times = keyTimes(p);
    return { ok: times.some(v => close(q.value, v)), expected: `key times ${[...new Set(times.map(f3))].join(', ')} s` };
  }
  return null;
}
const unitLabel = u => ({ a: 'm/s²', v: 'm/s', x: 'm', t: 's', mass: 'kg', force: 'N', angle: '°' }[u] || '');
