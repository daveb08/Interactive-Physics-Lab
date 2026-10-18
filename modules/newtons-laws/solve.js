import { SimulationClock } from '../../js/core/clock.js';
import { createRun, stepRun, sampleAt } from '../../js/core/physics.js';
import { CartView } from '../../js/components/cart.js';
import { CalcGraph } from '../../js/components/calc-graph.js';
import { PROBLEMS, PROBLEM_IDS } from './solve-problems.js';
import { checkSolution, studentModel, shuffled } from './solve-check.js';

const $ = id => document.getElementById(id);
const UNITS = { a: 'm/s²', v: 'm/s', x: 'm', t: 's' };
const STATUS_TEXT = { correct: '✓ Correct', misconception: '✗ ', order: '↕ ', duplicate: '⧉ ' };
const fmt = v => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(Math.abs(v) >= 100 ? 1 : Math.abs(v) >= 10 ? 2 : 3);

const state = { id: PROBLEM_IDS[0], bank: [], solution: [], attempts: 0, check: null };
let trueRun = null, ghostRun = null, trueFull = [], model = null;

const cart = new CartView($('cart-scene'));
const NS = 'http://www.w3.org/2000/svg';
const ghost = document.createElementNS(NS, 'g');
ghost.innerHTML = '<rect x="-24" y="158" width="48" height="32" rx="6" class="ghost-body"/><text y="150" class="ghost-label" text-anchor="middle" font-size="11" fill="#ba622e">your model</text>';
ghost.style.display = 'none';
$('cart-scene').append(ghost);
const graphs = {
  x: new CalcGraph($('g-x'), 'x', 'Position x', 'm', '#3c6cb2'),
  v: new CalcGraph($('g-v'), 'v', 'Velocity v', 'm/s', '#236d62'),
  a: new CalcGraph($('g-a'), 'a', 'Acceleration a', 'm/s²', '#b65b25'),
};
const problem = () => PROBLEMS[state.id];
const block = id => problem().blocks.find(b => b.id === id);

/* ---------- problem + lists ---------- */
for (const id of PROBLEM_IDS) { const o = document.createElement('option'); o.value = id; o.textContent = `${id} — ${PROBLEMS[id].title}`; $('problem-select').append(o); }

function loadProblem(id) {
  state.id = id; state.attempts = 0; state.check = null; state.solution = [];
  state.bank = shuffled(problem().blocks.map(b => b.id), Date.now());
  const p = problem();
  $('problem-title').textContent = `${id} — ${p.title}`;
  $('problem-statement').textContent = p.statement;
  const fill = (el, items) => el.replaceChildren(...items.map(t => Object.assign(document.createElement('li'), { textContent: t })));
  fill($('problem-given'), p.given); fill($('problem-find'), p.find);
  $('check-summary').hidden = true; $('compare').hidden = true;
  resetSim();
  renderLists();
}

function makeBlockButton(id, inSolution) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'block'; b.dataset.id = id; b.draggable = true;
  b.textContent = block(id).text;
  b.setAttribute('aria-label', `${block(id).text}. ${inSolution ? 'In your solution. Press Delete to remove.' : 'Add to solution.'}`);
  b.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; });
  return b;
}

function renderLists() {
  const bank = $('bank'), sol = $('solution');
  bank.replaceChildren(...state.bank.filter(id => !state.solution.includes(id)).map(id => {
    const li = document.createElement('li'), btn = makeBlockButton(id, false);
    btn.addEventListener('click', () => addBlock(id));
    li.append(btn); return li;
  }));
  const results = state.check ? Object.fromEntries(state.check.blocks.map((r, i) => [`${r.id}#${i}`, r])) : {};
  sol.replaceChildren(...state.solution.map((id, i) => {
    const li = document.createElement('li'), btn = makeBlockButton(id, true), tools = document.createElement('div');
    li.dataset.index = i;
    const r = results[`${id}#${i}`];
    if (r) {
      li.className = `st-${r.status}`;
      const s = document.createElement('span'); s.className = 'block-status';
      s.textContent = r.status === 'correct' ? STATUS_TEXT.correct : `${STATUS_TEXT[r.status]}${r.message}`;
      btn.append(s);
    }
    btn.addEventListener('keydown', e => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeBlock(i); } });
    btn.addEventListener('click', () => btn.focus());
    tools.className = 'block-tools';
    for (const [label, aria, fn, disabled] of [['↑', 'Move up', () => move(i, -1), i === 0], ['↓', 'Move down', () => move(i, 1), i === state.solution.length - 1], ['✕', 'Remove', () => removeBlock(i), false]]) {
      const t = document.createElement('button'); t.type = 'button'; t.textContent = label; t.disabled = disabled;
      t.setAttribute('aria-label', `${aria}: step ${i + 1}`); t.addEventListener('click', fn); tools.append(t);
    }
    li.append(btn, tools);
    li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('drop-before'); });
    li.addEventListener('dragleave', () => li.classList.remove('drop-before'));
    li.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); li.classList.remove('drop-before'); dropAt(e.dataTransfer.getData('text/plain'), i); });
    return li;
  }));
  $('solution-empty').hidden = state.solution.length > 0;
  $('bank-count').textContent = `${bank.children.length} left`;
  $('score').textContent = state.check ? `Score ${state.check.score}/${state.check.total} · Attempt ${state.attempts}` : `Attempt ${state.attempts}`;
  $('check').disabled = state.solution.length === 0;
}

function edited() { state.check = null; $('check-summary').hidden = true; renderLists(); }
function addBlock(id) { state.solution.push(id); edited(); focusSolution(state.solution.length - 1); }
function removeBlock(i) { state.solution.splice(i, 1); edited(); }
function move(i, d) {
  const j = i + d; if (j < 0 || j >= state.solution.length) return;
  [state.solution[i], state.solution[j]] = [state.solution[j], state.solution[i]];
  edited();
  $('solution').children[j]?.querySelectorAll('.block-tools button')[d < 0 ? 0 : 1]?.focus();
}
function dropAt(id, index) {
  if (!id || !block(id)) return;
  const from = state.solution.indexOf(id);
  if (from >= 0) { state.solution.splice(from, 1); if (from < index) index--; }
  state.solution.splice(index, 0, id);
  edited();
}
function focusSolution(i) { $('solution').children[i]?.querySelector('.block')?.focus(); }

for (const [el, toSolution] of [[$('solution'), true], [$('bank'), false]]) {
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drop-target'); });
  el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
  el.addEventListener('drop', e => {
    e.preventDefault(); el.classList.remove('drop-target');
    const id = e.dataTransfer.getData('text/plain');
    if (toSolution) dropAt(id, state.solution.length);
    else { const i = state.solution.indexOf(id); if (i >= 0) removeBlock(i); }
  });
}

/* ---------- check & run ---------- */
$('check').addEventListener('click', () => {
  const p = problem();
  state.attempts++;
  state.check = checkSolution(p, state.solution);
  renderLists();
  const c = state.check, summary = $('check-summary');
  summary.hidden = false;
  summary.classList.toggle('solved', c.solved); summary.classList.toggle('unsolved', !c.solved);
  if (c.solved) summary.textContent = `Solved! Score ${c.score}/${c.total} on attempt ${state.attempts}. Watch the simulation confirm your answers.`;
  else {
    const flagged = c.blocks.filter(b => b.status !== 'correct').length;
    summary.textContent = `${c.score} of ${c.total} steps correct.${flagged ? ` ${flagged} block${flagged > 1 ? 's' : ''} flagged: read the feedback on ${flagged > 1 ? 'them' : 'it'}.` : ''}${c.missing.length ? ` Missing: ${c.missing.join(', ')}.` : ''} Fix it and check again.`;
  }
  startRun();
});
$('clear').addEventListener('click', () => { state.solution = []; edited(); resetSim(); $('compare').hidden = true; });
$('reshuffle').addEventListener('click', () => { state.bank = shuffled(state.bank, Date.now()); renderLists(); });
$('problem-select').addEventListener('change', () => loadProblem($('problem-select').value));

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
  if (ghostRun) {
    const g = ghostRun.state;
    ghost.style.display = '';
    ghost.setAttribute('transform', `translate(${70 + (g.x + 50) / 100 * 640} 0)`);
  } else ghost.style.display = 'none';
  $('r-t').textContent = s.t.toFixed(2); $('r-x').textContent = fmt(s.x); $('r-v').textContent = fmt(s.v); $('r-a').textContent = fmt(trueRun.a);
  const checked = !!state.check;
  for (const k of ['x', 'v', 'a']) {
    graphs[k].render({
      samples: trueRun.samples,
      overlays: ghostRun ? [{ data: ghostRun.samples, color: '#ba622e', dash: '6 4', legend: 'your model' }] : [],
      points: checked ? answerPoints(k) : [],
    });
  }
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
