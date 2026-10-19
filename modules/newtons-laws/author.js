import { PROBLEMS, PROBLEM_IDS } from './solve-problems.js';
import { validateProblem, lintProblem, cleanProblem, engineCheck, engineAt, encodeProblem, parseProblemJson, prepareProblem, frictionError, placeholderValues, resolveText, formatValue, PLACEHOLDERS, FIGURES, ANSWER_KEYS } from './problem-format.js';

const $ = id => document.getElementById(id);
const DRAFT_KEY = 'ipl-solve-author-draft';
const clone = o => JSON.parse(JSON.stringify(o));
const f3 = v => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3);

const BLANK = () => ({
  title: 'New problem', statement: '',
  setup: { mass: 2, force: 6, velocity: 0 }, targetTime: 3, runTime: 4,
  quantities: [
    { id: 'q1', text: 'm = 2.0 kg', role: 'known' }, { id: 'q2', text: 'a = ?', role: 'unknown' },
  ],
  steps: { s1: 'Newton’s second law' },
  blocks: [{ id: 'b1', step: 's1', correct: true, text: 'a = F_net / m = …' }],
});

let doc;
let saveTimer, shareTimer, ctxCache = null;
const previews = [];
const phContext = () => (ctxCache ??= placeholderValues(cleanProblem(doc)));

/* ---------- small DOM helpers (all text via textContent / value) ---------- */
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k.includes('-')) n.setAttribute(k, v);
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v !== undefined && v !== null && v !== false) n[k] = v;
  }
  n.append(...kids.filter(Boolean));
  return n;
}
/** A labelled input bound to get/set. kind: text | num | area | select | check */
function field(label, get, set, { kind = 'text', options = [], hint, wide, placeholder, step = 'any', min, max } = {}) {
  let input;
  if (kind === 'area') input = el('textarea', { rows: 2, value: get() ?? '', placeholder });
  else if (kind === 'select') { input = el('select'); for (const [v, t] of options) input.append(el('option', { value: v, text: t })); input.value = get() ?? ''; }
  else if (kind === 'check') input = el('input', { type: 'checkbox', checked: !!get() });
  else input = el('input', { type: kind === 'num' ? 'number' : 'text', step: kind === 'num' ? step : undefined, value: get() ?? '', placeholder, min, max });
  const preview = kind === 'text' || kind === 'area' ? el('small', { class: 'ph-preview' }) : null;
  const showPreview = () => { if (!preview) return; const t = input.value; preview.hidden = !t.includes('{'); if (!preview.hidden) preview.textContent = `Students see: ${resolveText(t, phContext())}`; };
  input.addEventListener(kind === 'select' || kind === 'check' ? 'change' : 'input', () => {
    const v = kind === 'check' ? input.checked : kind === 'num' ? (input.value === '' ? undefined : Number(input.value)) : input.value;
    set(v);
    showPreview();
    if (kind === 'check' || kind === 'select') render(); else refresh();
  });
  showPreview();
  if (preview) previews.push(showPreview);
  return el('label', { class: `af${wide ? ' wide' : ''}${kind === 'check' ? ' check' : ''}` }, kind === 'check' ? input : el('span', { text: label }), kind === 'check' ? el('span', { text: label }) : input, hint ? el('small', { text: hint }) : null, preview);
}
const nextId = (prefix, used) => { let i = 1; while (used.includes(`${prefix}${i}`)) i++; return `${prefix}${i}`; };

/* ---------- sections ---------- */
function renderProblem() {
  $('sec-problem').replaceChildren(
    field('Title', () => doc.title, v => (doc.title = v), { wide: true, placeholder: 'e.g. Braking bicycle (exercise science)' }),
    field('Problem statement (what students read)', () => doc.statement, v => (doc.statement = v), { kind: 'area', wide: true, placeholder: 'Describe the situation, the numbers, and what to find.' }),
  );
  $('sec-problem').querySelector('textarea').rows = 4;
}
function renderSim() {
  const s = doc.setup;
  $('sec-sim').replaceChildren(...[
    field('Mass (kg)', () => s.mass, v => (s.mass = v), { kind: 'num' }),
    field('Applied force (N, + is right)', () => s.force, v => (s.force = v), { kind: 'num' }),
    field('Initial velocity v₀ (m/s)', () => s.velocity, v => (s.velocity = v), { kind: 'num' }),
    field('Target time (s)', () => doc.targetTime, v => (doc.targetTime = v), { kind: 'num', hint: 'When the question asks for values' }),
    field('Simulation length (s)', () => doc.runTime, v => (doc.runTime = v), { kind: 'num' }),
    field('Friction', () => s.frictionEnabled, v => { s.frictionEnabled = v; if (v) { s.muS ??= 0.3; s.muK ??= 0.25; } }, { kind: 'check' }),
    s.frictionEnabled ? field('μs (static)', () => s.muS, v => (s.muS = v), { kind: 'num', step: 0.01, min: 0, max: 1, hint: '0 to 1, greater than μk' }) : null,
    s.frictionEnabled ? field('μk (kinetic)', () => s.muK, v => (s.muK = v), { kind: 'num', step: 0.01, min: 0, max: 1, hint: '0 to 1, less than μs' }) : null,
    s.frictionEnabled ? el('p', { id: 'mu-note', class: 'mu-note', role: 'alert' }) : null,
  ].filter(Boolean));
  $('sec-scene').replaceChildren(
    field('Figure', () => doc.figure || 'cart', v => { doc.figure = v === 'cart' ? undefined : v; }, { kind: 'select', options: FIGURES.map(f => [f, f]) }),
    field('Figure name in legend', () => doc.noun, v => (doc.noun = v || undefined), { placeholder: 'cart' }),
    field('Label on figure', () => doc.label, v => (doc.label = v || undefined), { placeholder: 'e.g. 70 kg' }),
    field('Track caption', () => doc.surface, v => (doc.surface = v || undefined), { placeholder: 'e.g. CONCRETE FLOOR' }),
    field('Zoom: view from (m)', () => doc.view?.min, v => setView('min', v), { kind: 'num', hint: 'Leave both blank for ±50 m' }),
    field('Zoom: view to (m)', () => doc.view?.max, v => setView('max', v), { kind: 'num' }),
    field('Reveal after (tries)', () => doc.revealAfter, v => (doc.revealAfter = Number.isInteger(v) ? v : undefined), { kind: 'num', step: 1, placeholder: '2' }),
  );
}
function setView(k, v) {
  const view = { ...(doc.view || {}) }; view[k] = v;
  doc.view = view.min === undefined && view.max === undefined ? undefined : view;
}

function renderCards() {
  $('sec-cards').replaceChildren(...doc.quantities.map((c, i) => el('div', { class: 'card-row' },
    field(`Card ${i + 1} text`, () => c.text, v => (c.text = v), { placeholder: 'e.g. v₀ = +2.0 m/s or a = ?' }),
    field('Belongs in', () => c.role, v => { c.role = v; if (v !== 'none') delete c.feedback; }, { kind: 'select', options: [['known', 'Knowns'], ['unknown', 'Unknowns'], ['none', 'Neither (trap)']] }),
    c.role === 'none' ? field('Why it belongs in neither box', () => c.feedback, v => (c.feedback = v), { kind: 'area' }) : el('span'),
    el('button', { type: 'button', class: 'icon-btn', text: '✕ Remove', 'aria-label': `Remove card ${i + 1}`, onclick: () => { doc.quantities.splice(i, 1); render(); } }),
  )));
}

function answerFields(b) {
  const a = b.answer || {};
  const set = (k, v) => {
    const n = { ...(b.answer || {}), [k]: v };
    if (!n.key) delete b.answer; else b.answer = n;
  };
  return [
    field('Plot answer', () => a.key || '', v => set('key', v || undefined), { kind: 'select', options: [['', 'none'], ...Object.entries(ANSWER_KEYS)] }),
    a.key ? field('at time (s)', () => a.t, v => set('t', v), { kind: 'num' }) : null,
    a.key ? field('value', () => a.value, v => set('value', v), { kind: 'num', placeholder: 'blank = simulation', hint: 'Leave blank to use the simulation’s value' }) : null,
  ];
}
function blockEditor(b, stepKey) {
  const wrong = !b.correct;
  const remove = wrong ? el('button', { type: 'button', class: 'icon-btn', text: '✕ Remove', onclick: () => { doc.blocks.splice(doc.blocks.indexOf(b), 1); render(); } }) : null;
  return el('div', { class: `blk${wrong ? ' wrong' : ''}` },
    el('div', { class: 'blk-title' }, el('span', { text: wrong ? '✗ Wrong block (misconception)' : '✓ Correct block' }), remove),
    field('Block text', () => b.text, v => (b.text = v), { kind: 'area', wide: true }),
    wrong ? field('Feedback when a student picks it', () => b.feedback, v => (b.feedback = v), { kind: 'area', wide: true }) : null,
    el('div', { class: 'author-grid' },
      ...answerFields(b),
      wrong ? field('Ghost acceleration (m/s²)', () => b.effect?.a, v => setEffect(b, 'a', v), { kind: 'num', hint: 'Optional: the a this mistake implies' }) : null,
      wrong ? field('Ghost v₀ (m/s)', () => b.effect?.v0, v => setEffect(b, 'v0', v), { kind: 'num', hint: 'Optional: e.g. 0 if it ignores v₀' }) : null,
    ),
  );
}
function setEffect(b, k, v) {
  const e = { ...(b.effect || {}) };
  if (v === undefined) delete e[k]; else e[k] = v;
  if (Object.keys(e).length) b.effect = e; else delete b.effect;
}

function renderSteps() {
  const keys = Object.keys(doc.steps);
  $('sec-steps').replaceChildren(...keys.map((k, i) => {
    const correct = doc.blocks.find(b => b.step === k && b.correct);
    const wrongs = doc.blocks.filter(b => b.step === k && !b.correct);
    const after = correct?.after || [];
    const deps = keys.filter(o => o !== k).map(o => {
      const cb = el('input', { type: 'checkbox', checked: after.includes(o) });
      cb.addEventListener('change', () => {
        const list = new Set(correct.after || []);
        cb.checked ? list.add(o) : list.delete(o);
        const arr = [...list];
        for (const b of doc.blocks.filter(b => b.step === k)) { if (arr.length) b.after = arr; else delete b.after; }
        refresh();
      });
      return el('label', {}, cb, document.createTextNode(doc.steps[o] || o));
    });
    return el('div', { class: 'step-box' },
      el('div', { class: 'step-head' },
        el('span', { class: 'step-num', text: `STEP ${i + 1}` }),
        field('Step name (shown in feedback)', () => doc.steps[k], v => (doc.steps[k] = v), { placeholder: 'e.g. Net force' }),
        el('button', { type: 'button', class: 'icon-btn', text: '✕ Remove step', onclick: () => removeStep(k) })),
      keys.length > 1 ? el('div', { class: 'deps' }, el('strong', { text: 'Must come after:' }), ...deps) : null,
      correct ? blockEditor(correct, k) : null,
      ...wrongs.map(b => blockEditor(b, k)),
      el('button', { type: 'button', class: 'icon-btn', text: '+ Add wrong block', onclick: () => addWrong(k) }),
    );
  }));
}
function addWrong(k) {
  const correct = doc.blocks.find(b => b.step === k && b.correct);
  doc.blocks.push({ id: nextId('b', doc.blocks.map(b => b.id)), step: k, text: '', feedback: '', ...(correct?.after?.length ? { after: [...correct.after] } : {}) });
  render();
}
function removeStep(k) {
  delete doc.steps[k];
  doc.blocks = doc.blocks.filter(b => b.step !== k);
  for (const b of doc.blocks) if (b.after) { b.after = b.after.filter(s => s !== k); if (!b.after.length) delete b.after; }
  render();
}

/* ---------- validation, engine check, sharing ---------- */
function refresh() {
  ctxCache = null;
  for (const f of previews) f();
  const raw = cleanProblem(doc);
  const prepared = prepareProblem(raw), p = prepared.problem, errors = prepared.errors || [];
  const mu = doc.setup.frictionEnabled ? frictionError(doc.setup.muS, doc.setup.muK) : null;
  const note = document.getElementById('mu-note');
  if (note) { note.textContent = mu || ''; note.hidden = !mu; }
  renderPlaceholderTable();
  const list = $('check-list');
  if (errors.length) list.replaceChildren(el('p', { class: 'author-errors-title', text: `Fix ${errors.length} thing${errors.length > 1 ? 's' : ''} before sharing:` }), el('ul', { class: 'author-errors' }, ...errors.map(e => el('li', { text: e }))));
  else {
    let warnings = [];
    try { warnings = lintProblem(p); } catch { warnings = []; }
    list.replaceChildren(...[
      el('p', { class: 'author-ok', text: warnings.length ? '✓ Ready to share, but please look at these warnings first:' : '✓ Ready to share. No warnings. Preview it to try it as a student.' }),
      warnings.length ? el('ul', { class: 'author-warnings' }, ...warnings.map(w => el('li', { text: w }))) : null,
      warnings.length ? el('p', { class: 'help', text: 'Warnings compare your text with the simulation settings and physics. They do not block sharing, because some wording cannot be checked automatically.' }) : null,
    ].filter(Boolean));
  }

  // Engine readout and answer check (only when the simulation settings themselves are usable).
  const simErrors = errors.filter(e => /Mass|force|velocity|[Ff]riction|coefficient|Simulation length|Target time/.test(e));
  if (simErrors.length) { $('engine-readout').textContent = 'Enter valid simulation settings to see what the simulation gives.'; $('engine-check').replaceChildren(); }
  else {
    let r; try { r = engineAt(p, p.targetTime); } catch { $('engine-readout').textContent = 'Enter valid simulation settings to see what the simulation gives.'; $('engine-check').replaceChildren(); return finishRefresh(errors, p); }
    $('engine-readout').textContent = `At the target time t = ${f3(r.t)} s the simulation gives a = ${f3(r.a)} m/s², v = ${f3(r.v)} m/s, x = ${f3(r.x)} m${p.setup.frictionEnabled ? `; friction ${f3(r.friction)} N, net force ${f3(r.netForce)} N` : ''}.${r.reason === 'boundary' ? ` Note: the object reaches the end of the ±50 m track at ${f3(r.endTime)} s.` : ''}`;
    let rows = [];
    try { rows = engineCheck({ ...p, blocks: p.blocks.filter(b => !b.answer || (Number.isFinite(b.answer.t) && Number.isFinite(b.answer.value))) }); } catch { rows = []; }
    $('engine-check').replaceChildren(rows.length ? el('table', { class: 'vf-table' },
      el('caption', { text: 'Your plotted answers vs the simulation' }),
      el('tbody', {}, ...rows.map(r => el('tr', {},
        el('td', { text: `${r.step}: ${r.key}(${r.t} s)` }), el('td', { text: `you wrote ${r.stated}` }),
        el('td', { text: `simulation ${f3(r.sim)}`, class: r.ok ? 'ans-ok' : 'ans-bad' }), el('td', { text: r.ok ? '✓' : '✗ check this', class: r.ok ? 'ans-ok' : 'ans-bad' }))))) : el('span'));
  }
  finishRefresh(errors, p);
}
function finishRefresh(errors, p) {
  for (const id of ['preview', 'copy-link']) $(id).disabled = errors.length > 0;
  $('download').disabled = false;   // a draft file can be saved at any time
  clearTimeout(shareTimer);
  if (errors.length) $('share-link').value = '';
  else shareTimer = setTimeout(async () => { $('share-link').value = await studentLink(p); }, 150);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(doc)); } catch {} }, 300);
}
async function studentLink(p) { return `${new URL('solve.html', location.href).href}#p=${await encodeProblem(p)}`; }

function render() { previews.length = 0; ctxCache = null; renderProblem(); renderSim(); renderCards(); renderSteps(); refresh(); }

/** Placeholder reference with current values. */
function renderPlaceholderTable() {
  const box = document.getElementById('ph-table'); if (!box) return;
  const ctx = phContext();
  box.replaceChildren(...PLACEHOLDERS.map(([name, desc]) => {
    const timed = name.includes('@'), token = `{${name}}`;
    const v = timed ? null : ctx.vals[name];
    const val = timed ? '' : v === null || v === undefined ? '—' : formatValue(v);
    return el('tr', {}, el('td', {}, el('code', { text: token })), el('td', { text: desc }), el('td', { text: val, class: 'ph-val' }));
  }));
}

/* ---------- toolbar ---------- */
for (const id of PROBLEM_IDS) $('template').append(el('option', { value: id, text: `Copy of ${id} — ${PROBLEMS[id].title}` }));
$('template').addEventListener('change', () => {
  const v = $('template').value; if (!v) return;
  doc = v === 'blank' ? BLANK() : { ...clone(PROBLEMS[v]), title: `${PROBLEMS[v].title} (my version)` };
  $('template').value = ''; $('draft-note').textContent = v === 'blank' ? 'Started a blank problem.' : `Started from a copy of ${v}. Edit anything.`;
  render();
});
$('open-file').addEventListener('change', async e => {
  const file = e.target.files?.[0]; if (!file) return;
  const text = await file.text(); e.target.value = '';
  let raw; try { raw = JSON.parse(text); } catch { $('draft-note').textContent = `“${file.name}” is not a problem file.`; return; }
  doc = cleanProblem(raw);
  const { errors } = parseProblemJson(text);
  $('draft-note').textContent = errors ? `Opened “${file.name}” with ${errors.length} thing(s) to fix (see section 5).` : `Opened “${file.name}”.`;
  render();
});
$('start-over').addEventListener('click', () => { doc = BLANK(); $('draft-note').textContent = 'Started a blank problem.'; render(); });
$('add-card').addEventListener('click', () => { doc.quantities.push({ id: nextId('q', doc.quantities.map(q => q.id)), text: '', role: 'known' }); render(); });
$('add-step').addEventListener('click', () => {
  const k = nextId('s', Object.keys(doc.steps));
  doc.steps[k] = '';
  doc.blocks.push({ id: nextId('b', doc.blocks.map(b => b.id)), step: k, correct: true, text: '' });
  render();
});
$('preview').addEventListener('click', async () => { window.open(await studentLink(prepareProblem(cleanProblem(doc)).problem), '_blank', 'noopener'); });
$('copy-link').addEventListener('click', async () => {
  const link = await studentLink(prepareProblem(cleanProblem(doc)).problem);
  $('share-link').value = link;
  try { await navigator.clipboard.writeText(link); $('share-status').textContent = `Copied (${link.length} characters). Paste it into a Canvas page or assignment.`; }
  catch { $('share-link').select(); $('share-status').textContent = 'Your browser blocked automatic copying. The link is selected: press Ctrl+C (⌘C on a Mac).'; }
});
$('download').addEventListener('click', () => {
  const p = cleanProblem(doc);
  const name = `${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'problem'}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }));
  const a = el('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('share-status').textContent = `Downloaded ${name}. Students open it with “Load problem file (.json format)” on the Solve it page.`;
});

/* ---------- start ---------- */
try { const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); if (saved?.steps && saved?.blocks) { doc = saved; $('draft-note').textContent = 'Restored your draft from this browser.'; } } catch {}
doc ??= BLANK();
render();
