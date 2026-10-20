/**
 * "Solve it" for Unit 1, Electrostatics. Same two-step flow and checker as Newton's Laws › Solve it
 * (knowns/unknowns, then ordered solution blocks); "Run it" draws the true Coulomb forces on the charge
 * plane next to the force the student's blocks imply.
 */
import { MICRO } from '../../js/core/em-constants.js';
import { netForce } from '../../js/core/electrostatics.js';
import { ChargePlane, sub } from '../../js/components/field-view.js';
import { PROBLEMS, PROBLEM_IDS, UNITS, studentModel, s3, a1 } from './solve-problems.js';
import { checkSolution, checkQuantities, shuffled, correctOrder, correctPlacement, revealAfter } from '../newtons-laws/solve-check.js';

const $ = id => document.getElementById(id);
const STATUS_TEXT = { correct: '✓ Correct', misconception: '✗ ', order: '↕ ', duplicate: '⧉ ' };
const Q_STATUS = { correct: '✓', 'wrong-zone': '⇄ ', trap: '✗ ' };
const LABELS = { F21: 'F₂₁ (size)', F12: 'F₁₂ (size)', F23: 'F₂₃ (size)', F31: 'F₃₁ (size)', F32: 'F₃₂ (size)', Fnet: 'Net force', ang21: 'Direction of F₂₁', angle: 'Angle θ of F_net', x: 'Position x of q₃' };
const tries = n => `${n} ${n === 1 ? 'try' : 'tries'}`;
const show = (key, v) => (UNITS[key] === '°' ? `${a1(v)}°` : `${s3(v)} ${UNITS[key]}`);

const state = {
  id: PROBLEM_IDS[0],
  qbank: [], placement: {}, qOrder: [], qAttempts: 0, qCheck: null, unlocked: false, qRevealed: false, revealed: false, revealedBefore: false,
  bank: [], solution: [], attempts: 0, check: null, ran: false,
};
const problem = () => PROBLEMS[state.id];
const block = id => problem().blocks.find(b => b.id === id);
const quantity = id => problem().quantities.find(q => q.id === id);

const plane = new ChargePlane($('plane'), { canMove: () => false });

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
  Object.assign(state, { id, placement: {}, qOrder: [], qAttempts: 0, qCheck: null, unlocked: false, qRevealed: false, revealed: false, revealedBefore: false, solution: [], attempts: 0, check: null, ran: false });
  const p = problem();
  state.qbank = shuffled(p.quantities.map(q => q.id), Date.now());
  state.bank = shuffled(p.blocks.map(b => b.id), Date.now() + 1);
  $('problem-select').value = id;
  $('problem-title').textContent = `${id} — ${p.title}`;
  $('problem-statement').textContent = p.statement;
  $('check-summary').hidden = true; $('q-summary').hidden = true;
  renderAll(); drawRun();
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
  $('check-q').disabled = state.unlocked || Object.keys(state.placement).length === 0;
  for (const b of document.querySelectorAll('#knowns button, #unknowns button, #qbank button')) b.disabled = state.unlocked;
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
  if (c.solved) summary.textContent = `Solved! Step 1 in ${tries(state.qAttempts)}, Step 2 ${c.score}/${c.total} in ${tries(state.attempts)}. The forces below confirm your answers.`;
  else {
    const flagged = c.blocks.filter(b => b.status !== 'correct').length;
    summary.textContent = `${c.score} of ${c.total} steps correct.${flagged ? ` ${flagged} block${flagged > 1 ? 's' : ''} flagged: read the feedback on ${flagged > 1 ? 'them' : 'it'}.` : ''}${c.missing.length ? ` Missing: ${c.missing.join(', ')}.` : ''} Fix it and check again.`;
  }
  run();
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
  box.textContent = 'Here is one correct solution. Steps that do not depend on each other can come in either order. Compare it with your attempt, then press “Try again” to rebuild it yourself.';
  run();
});
$('clear').addEventListener('click', () => {
  const fresh = state.qAttempts === 0 && state.attempts === 0;
  if (fresh || confirmByClick($('clear'), 'Click again to start over (clears tries)')) { disarm($('clear')); loadProblem(state.id); }
});
$('reshuffle').addEventListener('click', () => {
  if (state.revealed) {   // Try again: keep Step 1, clear Step 2 so the student rebuilds it.
    Object.assign(state, { solution: [], check: null, revealed: false, revealedBefore: true, ran: false });
    $('check-summary').hidden = true; drawRun();
  }
  state.bank = shuffled(state.bank, Date.now()); state.qbank = shuffled(state.qbank, Date.now() + 7); renderAll();
});
$('problem-select').addEventListener('change', () => loadProblem($('problem-select').value));

/* ---------- Run it: true forces vs the student's ---------- */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let anim = 0;
function run() {
  state.ran = true;
  cancelAnimationFrame(anim);
  if (reduced) { drawRun(1); return; }
  const t0 = performance.now();
  const frame = now => { const u = Math.min(1, (now - t0) / 600); drawRun(1 - (1 - u) ** 3); if (u < 1) anim = requestAnimationFrame(frame); };
  anim = requestAnimationFrame(frame);
}

function drawRun(grow = 1) {
  const p = problem(), o = p.offset, shift = c => ({ q: c.uC * MICRO, x: c.x + o.x, y: c.y + o.y });
  const set = p.charges.map(shift);
  const model = state.ran ? studentModel(p, state.solution) : { forces: {}, x: null, changed: false };
  let targets = p.targets, ghostQ = null;
  if (p.third && state.ran) {                                  // balance problem: q₃ at the true point
    set.push(shift({ uC: p.third.uC, x: p.truth.x, y: 0 }));
    targets = [set.length - 1];
    if (model.x !== null) ghostQ = shift({ uC: p.third.uC, x: model.x, y: 0 });
  }
  const forces = set.map((_, i) => (state.ran && targets.includes(i) ? netForce(set, i) : { fx: 0, fy: 0, magnitude: 0, parts: [] }));
  let ref = 0;
  for (const i of targets) for (const part of forces[i].parts) ref = Math.max(ref, part.magnitude);
  const scale = ref > 0 ? (p.third ? 80 : 120) / ref : 100;
  plane.render(set, state.ran ? forces : null, { selected: -1, scale: scale * grow, showParts: true, showNet: true });
  // ghost: the force the student's blocks imply
  let h = '';
  if (state.ran) {
    for (const [on, [fx, fy]] of Object.entries(model.forces)) {
      const c = set[on]; h += plane.arrow(c.x, c.y, fx, fy, scale * grow, 'ghost', 'your F', 1);
    }
    if (ghostQ) {
      // The student's placement on its own track below the real one, with dashed copies of q₁ and q₂.
      const f = netForce([...set.slice(0, -1), ghostQ], set.length - 1), dy = -0.2;
      const [L, YL] = plane.px(set[0].x - 0.05, set[0].y + dy);
      h += `<text x="${L}" y="${YL - 22}" class="es-ghost-label es-ghost-track">your solution</text>`;
      for (const c of set.slice(0, -1)) { const [X, Y] = plane.px(c.x, c.y + dy); h += `<circle cx="${X}" cy="${Y}" r="11" class="es-ghost-q es-ghost-fixed"/><text x="${X}" y="${Y + 4}" class="es-ghost-sign">+</text>`; }
      const [a, Ya] = plane.px(set[0].x, set[0].y + dy), [b] = plane.px(set[1].x, set[1].y + dy);
      h += `<line x1="${a}" y1="${Ya}" x2="${b}" y2="${Ya}" class="es-ghost-line"/>`;
      const [X, Y] = plane.px(ghostQ.x, ghostQ.y + dy);
      h += `<circle cx="${X}" cy="${Y}" r="14" class="es-ghost-q"/><text x="${X}" y="${Y + 34}" class="es-ghost-label">your q${sub(3)} at x = ${s3(model.x)} m: F = ${s3(Math.abs(f.fx))} N</text>`;
      h += plane.arrow(ghostQ.x, ghostQ.y + dy, f.fx, f.fy, scale * grow, 'ghost', '', 0);
    }
  }
  plane.overlay(h);
  // status, legend, comparison
  const ghostOn = state.ran && model.changed;
  $('key-ghost').hidden = !ghostOn;
  $('run-status').textContent = state.ran ? 'Checked' : 'Waiting for a check';
  $('run-note').textContent = !state.ran ? 'Forces appear here after you check your solution.'
    : p.third ? (ghostOn ? `At x = ${s3(model.x)} m (your solution, dashed, lower track) the pushes do not balance, so q₃ would be shoved toward the balance point. At x = ${s3(p.truth.x)} m (top) F₃₁ and F₃₂ are equal and opposite.` : `At x = ${s3(p.truth.x)} m the two pushes on q₃ are equal and opposite: the net force is zero.`)
    : ghostOn ? 'Dashed orange: the force your blocks imply. Solid: the force Coulomb’s law gives. Where they differ, look for the flagged block.'
    : 'Your blocks match Coulomb’s law: no different force is implied.';
  if (grow === 1) showCompare();
}
function showCompare() {
  const p = problem(), rows = [];
  if (state.ran) for (const id of state.solution) {
    const b = block(id); if (!b.answer) continue;
    const yours = b.answer.value, truth = p.truth[b.answer.key];
    const ok = Math.abs(yours - truth) <= 0.005 * Math.abs(truth) + 1e-9;
    rows.push([LABELS[b.answer.key] || b.answer.key, `${ok ? '✓' : '✗'} ${show(b.answer.key, yours)}`, show(b.answer.key, truth), ok]);
  }
  $('compare').hidden = !rows.length; $('compare-empty').hidden = !!rows.length;
  $('compare-empty').textContent = state.ran ? 'None of your blocks states a number to compare yet.' : 'Check your solution to compare its numbers with the physics.';
  $('compare-body').replaceChildren(...rows.map(([q, y, s, ok]) => {
    const tr = document.createElement('tr');
    for (const [text, cls] of [[q], [y, ok ? 'ans-ok' : 'ans-bad'], [s]]) { const td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; tr.append(td); }
    return tr;
  }));
}

const asked = new URLSearchParams(location.search).get('problem');
loadProblem(PROBLEMS[asked] ? asked : state.id);
