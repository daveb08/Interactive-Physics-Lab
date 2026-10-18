import { SimulationClock } from '../../js/core/clock.js';
import { createRun, stepRun, sampleAt } from '../../js/core/physics.js';
import { CartView } from '../../js/components/cart.js';
import { CalcGraph } from '../../js/components/calc-graph.js';
import { PROBLEMS, PROBLEM_IDS } from './solve-problems.js';
import { figureMarkup } from './solve-figures.js';
import { checkSolution, checkQuantities, studentModel, shuffled, correctOrder, correctPlacement, revealAfter } from './solve-check.js';

const $ = id => document.getElementById(id);
const UNITS = { a: 'm/s²', v: 'm/s', x: 'm', t: 's' };
const STATUS_TEXT = { correct: '✓ Correct', misconception: '✗ ', order: '↕ ', duplicate: '⧉ ' };
const Q_STATUS = { correct: '✓', 'wrong-zone': '⇄ ', trap: '✗ ' };
const fmt = v => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(Math.abs(v) >= 100 ? 1 : Math.abs(v) >= 10 ? 2 : 3);
const tries = n => `${n} ${n === 1 ? 'try' : 'tries'}`;

const state = {
  id: PROBLEM_IDS[0],
  qbank: [], placement: {}, qOrder: [], qAttempts: 0, qCheck: null, unlocked: false, qRevealed: false, revealed: false, revealedBefore: false,
  bank: [], solution: [], attempts: 0, check: null,
};
let trueRun = null, ghostRun = null, trueFull = [], model = null;

const cart = new CartView($('cart-scene'));
const NS = 'http://www.w3.org/2000/svg';
const ghost = document.createElementNS(NS, 'g');
ghost.innerHTML = '<rect x="-24" y="158" width="48" height="32" rx="6" class="ghost-body"/><text y="150" class="ghost-label" text-anchor="middle" font-size="11" fill="#ba622e">your model</text>';
ghost.style.display = 'none';
$('cart-scene').append(ghost);
const DEFAULT_GHOST = ghost.innerHTML;
// Problem-specific figure drawn inside the cart group so it moves with the track position.
const cartGroup = $('cart-scene').querySelector('#cart');
const figure = document.createElementNS(NS, 'g');
figure.setAttribute('class', 'solve-figure');
cartGroup.prepend(figure);
const figureLabel = document.createElementNS(NS, 'text');
Object.entries({ y: 138, 'text-anchor': 'middle', class: 'figure-label' }).forEach(([k, v]) => figureLabel.setAttribute(k, v));
cartGroup.append(figureLabel);
const CART_PARTS = '.cart-body, .cart-highlight, .wheel, #cart-mass';
let lastPhase = -1;
function applyFigure() {
  const p = problem(), custom = !!p.figure;
  cart.setView(p.view);
  const noun = p.noun || 'cart';
  $('key-true').textContent = `■ Simulation: the real ${noun} (true physics)`;
  $('key-ghost').textContent = `▢ Ghost ${noun} (dashed): the motion your blocks imply`;
  for (const el of cartGroup.querySelectorAll(CART_PARTS)) el.style.display = custom ? 'none' : '';
  figure.innerHTML = custom ? figureMarkup(p.figure) : '';
  figureLabel.textContent = custom ? p.label : '';
  const spot = p.figure === 'pallet' ? { x: 0, y: 182, 'text-anchor': 'middle', fill: '#fff' } : { x: -16, y: 172, 'text-anchor': 'end', fill: '#2b403b' };
  for (const [k, v] of Object.entries(spot)) figureLabel.setAttribute(k, v);
  ghost.innerHTML = custom
    ? `${figureMarkup(p.figure, { ghost: true })}<text y="226" text-anchor="middle" font-size="11" fill="#ba622e">your model</text>`
    : DEFAULT_GHOST;
  lastPhase = -1;
}
const graphs = {
  x: new CalcGraph($('g-x'), 'x', 'Position x', 'm', '#3c6cb2'),
  v: new CalcGraph($('g-v'), 'v', 'Velocity v', 'm/s', '#236d62'),
  a: new CalcGraph($('g-a'), 'a', 'Acceleration a', 'm/s²', '#b65b25'),
};
const problem = () => PROBLEMS[state.id];
const block = id => problem().blocks.find(b => b.id === id);
const quantity = id => problem().quantities.find(q => q.id === id);


/** In-page two-click confirmation (browser pop-ups can be blocked inside a Canvas embed). */
function confirmByClick(button, prompt) {
  if (Number(button.dataset.armedUntil || 0) > Date.now()) { disarm(button); return true; }
  button.dataset.label = button.dataset.label || button.textContent;
  button.dataset.armedUntil = String(Date.now() + 5000);
  button.textContent = prompt;
  button.classList.add('armed');
  clearTimeout(button._disarm);
  button._disarm = setTimeout(() => disarm(button), 5000);
  return false;
}
function disarm(button) {
  clearTimeout(button._disarm);
  delete button.dataset.armedUntil;
  if (button.dataset.label) { button.textContent = button.dataset.label; delete button.dataset.label; }
  button.classList.remove('armed');
}

/* ---------- problem ---------- */
for (const id of PROBLEM_IDS) { const o = document.createElement('option'); o.value = id; o.textContent = `${id} — ${PROBLEMS[id].title}`; $('problem-select').append(o); }

function loadProblem(id) {
  Object.assign(state, { id, placement: {}, qOrder: [], qAttempts: 0, qCheck: null, unlocked: false, qRevealed: false, revealed: false, revealedBefore: false, solution: [], attempts: 0, check: null });
  const p = problem();
  state.qbank = shuffled(p.quantities.map(q => q.id), Date.now());
  state.bank = shuffled(p.blocks.map(b => b.id), Date.now() + 1);
  $('problem-title').textContent = `${id} — ${p.title}`;
  $('problem-statement').textContent = p.statement;
  applyFigure();
  $('check-summary').hidden = true; $('q-summary').hidden = true; $('compare').hidden = true;
  resetSim();
  renderAll();
}

function renderAll() { renderQuantities(); renderLists(); renderScore(); renderReveal(); }

function renderScore() {
  const q = state.qRevealed ? `Step 1 revealed (after ${tries(state.qAttempts)})`
    : state.qCheck ? `Step 1 ${state.qCheck.score}/${state.qCheck.total} (${tries(state.qAttempts)})` : `Step 1 (${tries(state.qAttempts)})`;
  const s = !state.unlocked ? '' : state.revealed ? ` · Step 2 revealed (after ${tries(state.attempts)})`
    : state.check ? ` · Step 2 ${state.check.score}/${state.check.total} (${tries(state.attempts)})` : ` · Step 2 (${tries(state.attempts)})`;
  $('score').textContent = q + s + (state.revealedBefore && !state.revealed ? ' · solution was revealed earlier' : '');
}

function renderReveal() {
  const need = revealAfter(problem());
  const qDone = state.unlocked, sDone = state.revealed || !!state.check?.solved;
  $('reveal-q').hidden = qDone;
  $('reveal-q').disabled = state.qAttempts < need;
  $('reveal-q-note').textContent = qDone ? '' : state.qAttempts < need ? `Stuck? “Show correct sort” becomes available after ${tries(need)}.` : 'Still stuck? You can show the correct sort.';
  $('reveal').hidden = !state.unlocked || sDone;
  $('reveal').disabled = state.attempts < need;
  $('reveal-note').textContent = !state.unlocked || sDone ? '' : state.attempts < need ? `Stuck? “Reveal solution” becomes available after ${tries(need)}.` : 'Still stuck? You can reveal a correct solution.';
  $('reshuffle').textContent = state.revealed ? '↻ Try again' : 'New shuffle';
}

/* ---------- Step 1: quantity cards ---------- */
function chip(id, zone) {
  const q = quantity(id), li = document.createElement('li'), wrap = document.createElement('div');
  wrap.className = 'chip'; wrap.draggable = true; wrap.dataset.id = id;
  wrap.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', `q:${id}`); e.dataTransfer.effectAllowed = 'move'; });
  const label = document.createElement('span'); label.textContent = q.text; wrap.append(label);
  const btn = (text, aria, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.setAttribute('aria-label', `${aria}: ${q.text}`); b.addEventListener('click', fn); wrap.append(b); };
  if (!zone) {
    btn('+ Known', 'Add to knowns', () => place(id, 'known'));
    btn('+ Unknown', 'Add to unknowns', () => place(id, 'unknown'));
    if (state.qRevealed && q.role === 'none') {
      wrap.classList.add('st-trap');
      const st = document.createElement('span'); st.className = 'chip-status'; st.textContent = `Neither box: ${q.feedback}`;
      wrap.append(st);
    }
  } else {
    btn('⇄', `Move to ${zone === 'known' ? 'unknowns' : 'knowns'}`, () => place(id, zone === 'known' ? 'unknown' : 'known'));
    btn('✕', 'Return to bank', () => unplace(id));
    const r = state.qCheck?.items.find(i => i.id === id && i.zone === zone);
    if (r) {
      wrap.classList.add(`st-${r.status}`);
      const st = document.createElement('span'); st.className = 'chip-status';
      st.textContent = r.status === 'correct' ? '✓ Correct' : `${Q_STATUS[r.status]}${r.message}`;
      wrap.append(st);
    }
  }
  li.append(wrap); return li;
}
function renderQuantities() {
  $('qbank').replaceChildren(...state.qbank.filter(id => !(id in state.placement)).map(id => chip(id)));
  for (const zone of ['known', 'unknown']) $(`${zone}s`).replaceChildren(...state.qOrder.filter(id => state.placement[id] === zone).map(id => chip(id, zone)));
  const locked = state.unlocked;
  $('check-q').disabled = locked || Object.keys(state.placement).length === 0;
  for (const b of document.querySelectorAll('#knowns button, #unknowns button, #qbank button')) b.disabled = locked;
}
function qEdited() { state.qCheck = null; $('q-summary').hidden = true; renderQuantities(); renderScore(); }
function place(id, zone) {
  if (state.unlocked || !quantity(id)) return;
  state.placement[id] = zone;
  state.qOrder = [...state.qOrder.filter(x => x !== id), id];
  qEdited();
}
function unplace(id) { if (state.unlocked) return; delete state.placement[id]; state.qOrder = state.qOrder.filter(x => x !== id); qEdited(); }

for (const zone of ['known', 'unknown']) {
  const el = $(`zone-${zone}`);
  el.addEventListener('dragover', e => { if (!state.unlocked) { e.preventDefault(); el.classList.add('drop-target'); } });
  el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
  el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('drop-target'); const d = e.dataTransfer.getData('text/plain'); if (d.startsWith('q:')) place(d.slice(2), zone); });
}
$('qbank').addEventListener('dragover', e => e.preventDefault());
$('qbank').addEventListener('drop', e => { e.preventDefault(); const d = e.dataTransfer.getData('text/plain'); if (d.startsWith('q:')) unplace(d.slice(2)); });

$('check-q').addEventListener('click', () => {
  state.qAttempts++;
  state.qCheck = checkQuantities(problem(), state.placement);
  const c = state.qCheck, box = $('q-summary');
  box.hidden = false; box.className = 'feedback solve-summary'; box.classList.toggle('solved', c.solved); box.classList.toggle('unsolved', !c.solved);
  if (c.solved) {
    state.unlocked = true;
    box.textContent = `Step 1 complete: all ${c.total} knowns and unknowns sorted (${tries(state.qAttempts)}). The solution blocks are now unlocked.`;
  } else {
    const flagged = c.items.filter(i => i.status !== 'correct').length;
    box.textContent = `${c.score} of ${c.total} placed correctly.${flagged ? ` ${flagged} card${flagged > 1 ? 's' : ''} flagged: read the feedback.` : ''}${c.missing.length ? ` ${c.missing.length} quantit${c.missing.length > 1 ? 'ies are' : 'y is'} still in the bank and belong${c.missing.length > 1 ? '' : 's'} in a box.` : ''} Some cards belong in neither box. Fix it and check again.`;
  }
  renderAll();
  if (c.solved) $('bank').querySelector('.block')?.focus();
});

$('reveal-q').addEventListener('click', () => {
  if (state.unlocked || state.qAttempts < revealAfter(problem())) return;
  if (!confirmByClick($('reveal-q'), 'Click again to show it (Step 1 will be marked “revealed”)')) return;
  state.placement = correctPlacement(problem());
  state.qOrder = Object.keys(state.placement);
  state.qRevealed = true; state.unlocked = true;
  state.qCheck = checkQuantities(problem(), state.placement);
  const box = $('q-summary');
  box.hidden = false; box.className = 'feedback solve-summary revealed';
  box.textContent = 'Here is the correct sort. Read why each card belongs where it does, and why the remaining cards in the bank belong in neither box. The solution blocks are now unlocked.';
  renderAll();
});

/* ---------- Step 2: solution blocks ---------- */
function makeBlockButton(id, inSolution) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'block'; b.dataset.id = id; b.draggable = true;
  b.textContent = block(id).text;
  b.setAttribute('aria-label', `${block(id).text}. ${inSolution ? 'In your solution. Press Delete to remove.' : 'Add to solution.'}`);
  b.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', `b:${id}`); e.dataTransfer.effectAllowed = 'move'; });
  return b;
}

function renderLists() {
  const bank = $('bank'), sol = $('solution');
  $('bank-locked').hidden = state.unlocked; $('bank-help').hidden = !state.unlocked;
  bank.replaceChildren(...(state.unlocked ? state.bank.filter(id => !state.solution.includes(id)) : []).map(id => {
    const li = document.createElement('li'), btn = makeBlockButton(id, false);
    btn.addEventListener('click', () => addBlock(id));
    li.append(btn); return li;
  }));
  const results = state.check ? Object.fromEntries(state.check.blocks.map((r, i) => [`${r.id}#${i}`, r])) : {};
  sol.replaceChildren(...state.solution.map((id, i) => {
    const li = document.createElement('li'), btn = makeBlockButton(id, true), tools = document.createElement('div');
    const r = results[`${id}#${i}`];
    if (r) {
      li.className = `st-${r.status}`;
      const s = document.createElement('span'); s.className = 'block-status';
      s.textContent = r.status === 'correct' ? STATUS_TEXT.correct : `${STATUS_TEXT[r.status]}${r.message}`;
      btn.append(s);
    }
    btn.addEventListener('keydown', e => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeBlock(i); } });
    tools.className = 'block-tools';
    for (const [label, aria, fn, disabled] of [['↑', 'Move up', () => move(i, -1), i === 0], ['↓', 'Move down', () => move(i, 1), i === state.solution.length - 1], ['✕', 'Remove', () => removeBlock(i), false]]) {
      const t = document.createElement('button'); t.type = 'button'; t.textContent = label; t.disabled = disabled;
      t.setAttribute('aria-label', `${aria}: step ${i + 1}`); t.addEventListener('click', fn); tools.append(t);
    }
    li.append(btn, tools);
    li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('drop-before'); });
    li.addEventListener('dragleave', () => li.classList.remove('drop-before'));
    li.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); li.classList.remove('drop-before'); const d = e.dataTransfer.getData('text/plain'); if (d.startsWith('b:')) dropAt(d.slice(2), i); });
    return li;
  }));
  $('solution-empty').hidden = state.solution.length > 0;
  $('solution-empty').textContent = state.unlocked ? 'No blocks yet. Add blocks from the bank.' : 'Complete Step 1 first.';
  const left = state.qbank.filter(id => !(id in state.placement)).length + (state.unlocked ? bank.children.length : 0);
  $('bank-count').textContent = `${left} left`;
  $('check').disabled = !state.unlocked || state.solution.length === 0;
  $('reshuffle').disabled = false;
}

function edited() { state.check = null; $('check-summary').hidden = true; renderLists(); renderScore(); renderReveal(); }
function addBlock(id) { if (!state.unlocked) return; state.solution.push(id); edited(); $('solution').children[state.solution.length - 1]?.querySelector('.block')?.focus(); }
function removeBlock(i) { state.solution.splice(i, 1); edited(); }
function move(i, d) {
  const j = i + d; if (j < 0 || j >= state.solution.length) return;
  [state.solution[i], state.solution[j]] = [state.solution[j], state.solution[i]];
  edited();
  $('solution').children[j]?.querySelectorAll('.block-tools button')[d < 0 ? 0 : 1]?.focus();
}
function dropAt(id, index) {
  if (!state.unlocked || !id || !block(id)) return;
  const from = state.solution.indexOf(id);
  if (from >= 0) { state.solution.splice(from, 1); if (from < index) index--; }
  state.solution.splice(index, 0, id);
  edited();
}
for (const [el, toSolution] of [[$('solution'), true], [$('bank'), false]]) {
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drop-target'); });
  el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
  el.addEventListener('drop', e => {
    e.preventDefault(); el.classList.remove('drop-target');
    const d = e.dataTransfer.getData('text/plain'); if (!d.startsWith('b:')) return;
    const id = d.slice(2);
    if (toSolution) dropAt(id, state.solution.length);
    else { const i = state.solution.indexOf(id); if (i >= 0) removeBlock(i); }
  });
}

$('check').addEventListener('click', () => {
  const p = problem();
  state.attempts++;
  state.check = checkSolution(p, state.solution);
  renderLists(); renderScore(); renderReveal();
  const c = state.check, summary = $('check-summary');
  summary.hidden = false; summary.className = 'feedback solve-summary';
  summary.classList.toggle('solved', c.solved); summary.classList.toggle('unsolved', !c.solved);
  if (c.solved) summary.textContent = `Solved! Step 1 in ${tries(state.qAttempts)}, Step 2 ${c.score}/${c.total} in ${tries(state.attempts)}. Watch the simulation confirm your answers.`;
  else {
    const flagged = c.blocks.filter(b => b.status !== 'correct').length;
    summary.textContent = `${c.score} of ${c.total} steps correct.${flagged ? ` ${flagged} block${flagged > 1 ? 's' : ''} flagged: read the feedback on ${flagged > 1 ? 'them' : 'it'}.` : ''}${c.missing.length ? ` Missing: ${c.missing.join(', ')}.` : ''} Fix it and check again.`;
  }
  startRun();
});
$('reveal').addEventListener('click', () => {
  if (!state.unlocked || state.attempts < revealAfter(problem())) return;
  if (!confirmByClick($('reveal'), 'Click again to reveal (Step 2 will be marked “revealed”)')) return;
  state.solution = correctOrder(problem());
  state.revealed = true;
  state.check = checkSolution(problem(), state.solution);
  renderAll();
  const box = $('check-summary');
  box.hidden = false; box.className = 'feedback solve-summary revealed';
  box.textContent = 'Here is one correct solution. Steps that do not depend on each other (like the last two) can come in either order. Compare it with your attempt, then press “Try again” to rebuild it yourself.';
  startRun();
});
$('clear').addEventListener('click', () => {
  const fresh = state.qAttempts === 0 && state.attempts === 0;
  if (fresh || confirmByClick($('clear'), 'Click again to start over (clears tries)')) { disarm($('clear')); loadProblem(state.id); }
});
$('reshuffle').addEventListener('click', () => {
  if (state.revealed) {   // Try again: keep Step 1, clear Step 2 so the student rebuilds it.
    Object.assign(state, { solution: [], check: null, revealed: false, revealedBefore: true });
    $('check-summary').hidden = true; $('compare').hidden = true; resetSim();
  }
  state.bank = shuffled(state.bank, Date.now()); state.qbank = shuffled(state.qbank, Date.now() + 7); renderAll();
});
$('problem-select').addEventListener('change', () => loadProblem($('problem-select').value));

/* ---------- simulation ---------- */
const clock = new SimulationClock(() => {
  if (!trueRun.done) stepRun(trueRun);
  if (ghostRun && !ghostRun.done && ghostRun.state.t < trueRun.state.t + 1e-9) stepRun(ghostRun);
  if (trueRun.done && (!ghostRun || ghostRun.done || ghostRun.state.t >= trueRun.endTime - 1e-9)) { clock.pause(); $('run-status').textContent = 'Complete'; showCompare(); }
}, () => render());

function grid(run) {
  const out = [];
  for (let t = 0; t <= run.endTime + 1e-9; t += 0.02) out.push(sampleAt(run, Math.min(t, run.endTime)));
  return out;
}
function resetSim() {
  clock?.reset?.();
  const p = problem();
  trueRun = createRun(p.setup, { duration: p.runTime });
  trueFull = grid(trueRun);
  ghostRun = null; model = null;
  for (const k of ['x', 'v', 'a']) graphs[k].setRange(trueFull, p.runTime);
  $('run-status').textContent = 'Waiting for a check';
  render();
}
function startRun() {
  const p = problem();
  clock.reset();
  trueRun = createRun(p.setup, { duration: p.runTime });
  trueFull = grid(trueRun);
  const trueA = sampleAt(trueRun, Math.min(0.5, trueRun.endTime)).a;
  model = studentModel(p, state.solution, trueA);
  ghostRun = model.changed ? createRun({ mass: p.setup.mass, force: model.a * p.setup.mass, velocity: model.v0 }, { duration: p.runTime }) : null;
  const span = Math.max(...trueFull.map(s => Math.abs(s.x)), 1);
  // Keep axes readable: ghost curves beyond 3× the true range are clipped rather than rescaled.
  const ghostFull = ghostRun ? grid(ghostRun).filter(s => Math.abs(s.x) < 3 * span) : [];
  for (const k of ['x', 'v', 'a']) graphs[k].setRange([...trueFull, ...ghostFull], p.runTime);
  $('compare').hidden = true;
  $('run-status').textContent = 'Running';
  clock.start();
}
function answerPoints(key) {
  return state.solution.map(block).filter(b => b.answer && b.answer.key === key)
    .map(b => ({ t: b.answer.t, value: b.answer.value, label: `you: ${fmt(b.step === 'time' ? b.answer.t : b.answer.value)} ${b.step === 'time' ? 's' : UNITS[key]}`, color: b.correct ? '#2f7d4f' : '#ba622e' }));
}
function render() {
  const s = trueRun.state;
  cart.render(trueRun);
  const p = problem();
  if (p.figure) {
    $('cart-scene').querySelector('#surface-label').textContent = p.surface;
    if (p.figure === 'sprinter') {   // alternate stride every half metre
      const phase = Math.floor(s.x * 2) % 2;
      if (phase !== lastPhase) { figure.innerHTML = figureMarkup('sprinter', { phase }); lastPhase = phase; }
    }
  }
  if (ghostRun) {
    ghost.style.display = '';
    const gx = ghostRun.state.x, v = cart.view, off = gx > v.max ? 1 : gx < v.min ? -1 : 0;
    // Off the zoomed view: pin the ghost at the edge and say where the student's model went.
    const shown = off > 0 ? v.max : off < 0 ? v.min : gx;
    ghost.setAttribute('transform', `translate(${cart.toPx(shown)} 0)`);
    const lbl = ghost.querySelector('text');
    if (lbl) { lbl.textContent = off ? `your model ${off > 0 ? '→' : '←'} ${gx.toFixed(1)} m` : 'your model'; lbl.setAttribute('text-anchor', off > 0 ? 'end' : off < 0 ? 'start' : 'middle'); }
  }
  else ghost.style.display = 'none';
  $('r-t').textContent = s.t.toFixed(2); $('r-x').textContent = fmt(s.x); $('r-v').textContent = fmt(s.v); $('r-a').textContent = fmt(trueRun.a);
  const checked = !!state.check;
  for (const k of ['x', 'v', 'a']) graphs[k].render({
    samples: trueRun.samples,
    overlays: ghostRun ? [{ data: ghostRun.samples, color: '#ba622e', dash: '6 4', legend: 'your model' }] : [],
    points: checked ? answerPoints(k) : [],
  });
}
function showCompare() {
  const p = problem(), rows = [];
  for (const id of state.solution) {
    const b = block(id);
    if (!b.answer) continue;
    let yours, sim, unit;
    if (b.step === 'time') { yours = b.answer.t; sim = p.targetTime; unit = 's'; }
    else { yours = b.answer.value; sim = sampleAt(trueRun, Math.min(b.answer.t, trueRun.endTime))[b.answer.key]; unit = UNITS[b.answer.key]; }
    const ok = Math.abs(yours - sim) <= 0.01 * Math.abs(sim) + 0.01;
    rows.push([p.steps[b.step], `${fmt(yours)} ${unit}`, `${fmt(sim)} ${unit}`, ok]);
  }
  if (!rows.length) return;
  $('compare-body').replaceChildren(...rows.map(([q, y, s, ok]) => {
    const tr = document.createElement('tr');
    for (const [text, cls] of [[q], [`${ok ? '✓' : '✗'} ${y}`, ok ? 'ans-ok' : 'ans-bad'], [s]]) { const td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; tr.append(td); }
    return tr;
  }));
  $('compare').hidden = false;
}

document.addEventListener('visibilitychange', () => { if (document.hidden) clock.pause(); });
loadProblem(state.id);
