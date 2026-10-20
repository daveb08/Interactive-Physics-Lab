/** Visual builder page for Unit 1 Solve it problems. The physics and the writing live in em-builder.js. */
import { MICRO } from '../../js/core/em-constants.js';
import { netForce } from '../../js/core/electrostatics.js';
import { ChargePlane, sub } from '../../js/components/field-view.js';
import { SAMPLES, sampleScenario, newScenario, cleanScenario, buildProblem, encodeScenario, scenarioFile, LIMITS, FILE_TYPE } from './em-builder.js';
import { s3, a1 } from './solve-problems.js';

const $ = id => document.getElementById(id);
const KEY = 'ipl-em-builder';
const qn = i => `q${sub(i + 1)}`;
const qText = uC => `${uC > 0 ? '+' : '−'}${Math.abs(uC).toFixed(1)} μC`;
const SPOTS = [{ x: 0.30, y: 0.30 }, { x: 0.60, y: 0.30 }, { x: 0.45, y: 0.50 }, { x: 0.45, y: 0.12 }];

let sc = load() || sampleScenario('S1');
let selected = 0, built = null;

function save() { try { localStorage.setItem(KEY, JSON.stringify(sc)); } catch {} }
function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s?.charges?.length ? cleanScenario(s) : null; } catch { return null; } }

/* ---------- plane ---------- */
const lineY = () => sc.charges[0].y;
const plane = new ChargePlane($('plane'), {
  onSelect: i => { if (i !== selected) { selected = i; render(); } },
  constrain: (i, x, y) => {
    if (sc.kind === 'balance') y = lineY();
    return sc.charges.every((c, j) => j === i || Math.hypot(c.x - x, c.y - y) >= LIMITS.minSep - 1e-9) ? { x, y } : null;
  },
  onChange: (i, x, y) => {
    if (sc.kind === 'balance' && i === 0) for (const c of sc.charges) c.y = y;
    Object.assign(sc.charges[i], { x, y });
    changed();
  },
});

function drawPlane(p) {
  const set = sc.charges.map(c => ({ q: c.uC * MICRO, x: c.x, y: c.y }));
  let forces = null, h = '';
  if (p && sc.kind === 'force') {
    const targets = p.targets;
    forces = set.map((_, i) => (targets.includes(i) ? netForce(set, i) : { fx: 0, fy: 0, magnitude: 0, parts: [] }));
    let ref = 0; for (const i of targets) for (const part of forces[i].parts) ref = Math.max(ref, part.magnitude);
    plane.render(set, forces, { selected, scale: ref ? 110 / ref : 100, showParts: true, showNet: true });
  } else plane.render(set, null, { selected });
  if (p && sc.kind === 'balance') {
    const [X, Y] = plane.px(p.offset.x + p.truth.x, p.offset.y);
    const inside = X > plane.margin && X < plane.W - plane.margin;
    h += inside ? `<circle cx="${X}" cy="${Y}" r="13" class="eb-q3"/><text x="${X}" y="${Y + 32}" class="eb-q3-label">q₃ balances here (x = ${s3(p.truth.x)} m)</text>`
      : `<text x="${plane.W / 2}" y="${Y - 40}" class="eb-q3-label">q₃ balances at x = ${s3(p.truth.x)} m, off the picture</text>`;
    const [a, ya] = plane.px(0, p.offset.y), [b] = plane.px(1, p.offset.y);
    h += `<line x1="${a}" y1="${ya}" x2="${b}" y2="${ya}" class="eb-axis"/>`;
  }
  if (sc.kind === 'force') {   // mark the origin charge
    const o = sc.charges[sc.origin], [X, Y] = plane.px(o.x, o.y);
    h += `<g class="eb-origin"><line x1="${X}" y1="${Y}" x2="${X + 40}" y2="${Y}"/><line x1="${X}" y1="${Y}" x2="${X}" y2="${Y - 40}"/><text x="${X + 44}" y="${Y + 4}">x</text><text x="${X - 3}" y="${Y - 44}">y</text></g>`;
  }
  plane.overlay(h);
}

/* ---------- controls ---------- */
function setKind(kind) {
  if (kind === sc.kind) return;
  if (kind === 'balance') {
    const [a, b] = sc.charges, y = a.y;
    sc = newScenario({ ...sc, kind, charges: [{ ...a }, { ...b, y, x: Math.abs(b.x - a.x) < LIMITS.minSep ? Math.min(0.95, a.x + 0.3) : b.x }] });
  } else sc = newScenario({ ...sc, kind });
  selected = 0; changed();
}
function setCount(n) {
  while (sc.charges.length < n) {
    const spot = SPOTS.find(s => sc.charges.every(c => Math.hypot(c.x - s.x, c.y - s.y) >= 0.1)) || { x: 0.15 + 0.2 * sc.charges.length, y: 0.15 };
    sc.charges.push({ uC: sc.charges.length % 2 ? -2 : 2, ...spot });
  }
  sc.charges.length = n;
  sc.target = Math.min(sc.target, n - 1); sc.origin = Math.min(sc.origin, n - 1); selected = Math.min(selected, n - 1);
  changed();
}
function options(sel, n, value) {
  sel.replaceChildren(...Array.from({ length: n }, (_, i) => { const o = document.createElement('option'); o.value = i; o.textContent = `${qn(i)} (${qText(sc.charges[i].uC)})`; return o; }));
  sel.value = value;
}
function renderControls() {
  const n = sc.charges.length, balance = sc.kind === 'balance', c = sc.charges[selected];
  for (const b of document.querySelectorAll('[data-kind]')) b.setAttribute('aria-pressed', String(b.dataset.kind === sc.kind));
  for (const b of document.querySelectorAll('[data-count]')) b.setAttribute('aria-pressed', String(+b.dataset.count === n));
  $('count-group').hidden = balance;
  const sb = $('select-buttons');
  if (sb.children.length !== n) sb.replaceChildren(...sc.charges.map((_, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = qn(i); b.addEventListener('click', () => { selected = i; render(); }); return b; }));
  [...sb.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === selected)));
  $('charge-name').textContent = qn(selected);
  $('charge').value = c.uC; $('charge-value').textContent = qText(c.uC);
  $('cx').value = c.x.toFixed(2); $('cy').value = c.y.toFixed(2); $('cy').disabled = balance && selected > 0;
  options($('target'), n, sc.target); options($('origin'), n, sc.origin);
  $('target-row').hidden = balance; $('origin-row').hidden = balance;
  $('third-law-row').hidden = balance || n !== 2; $('third-law').checked = sc.thirdLaw;
  $('third-row').hidden = !balance; $('third').value = sc.third.uC;
  $('legend').textContent = balance
    ? 'Both charges sit on one horizontal line (the x-axis of the problem, with q₁ on the left at x = 0). The dashed circle shows where q₃ balances.'
    : `Arrows: the forces on ${qn(sc.target)}${sc.thirdLaw && n === 2 ? ' and its partner' : ''}, as students will find them. The small axes mark the origin used in the problem text.`;
}

/* ---------- output ---------- */
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function renderOutput() {
  const res = buildProblem(sc);
  built = res.problem || null;
  const status = $('status');
  status.replaceChildren();
  status.className = 'eb-status';
  if (res.errors) { status.classList.add('bad'); for (const e of res.errors) status.append(el('p', '', `⚠ ${e}`)); }
  for (const id of ['preview', 'copy-link', 'download']) $(id).disabled = !built;
  if (!built) { $('answers').replaceChildren(); $('cards').replaceChildren(); $('steps').replaceChildren(); $('share-link').value = ''; return; }
  const p = built;
  if (document.activeElement !== $('title')) $('title').value = sc.title || p.title;
  if (sc.autoStatement && document.activeElement !== $('statement')) $('statement').value = p.statement;
  $('statement-note').textContent = sc.autoStatement ? 'Written from the diagram. Edit it freely; your wording is then kept.' : 'Your own wording is kept. Make sure its numbers match the diagram.';
  $('rewrite').hidden = sc.autoStatement;
  // answers
  $('answers').replaceChildren(...Object.entries(p.truth).map(([k, v]) => {
    const tr = el('tr'); tr.append(el('th', '', p.labels?.[k] || k), el('td', '', p.units[k] === '°' ? `${a1(v)}°` : `${s3(v)} ${p.units[k]}`)); return tr;
  }));
  // Step 1
  const groups = [['known', 'Knowns'], ['unknown', 'Unknowns'], ['none', 'Traps (belong in neither box)']];
  $('cards').replaceChildren(...groups.map(([role, label]) => {
    const box = el('div', `eb-card-group eb-${role}`); box.append(el('h5', '', label));
    const ul = el('ul');
    for (const q of p.quantities.filter(x => x.role === role)) {
      const li = el('li', '', q.text);
      if (q.feedback) { li.title = q.feedback; li.append(el('span', 'eb-why', q.feedback)); }
      ul.append(li);
    }
    box.append(ul); return box;
  }));
  // Step 2
  $('steps').replaceChildren(...Object.entries(p.steps).map(([step, name]) => {
    const li = el('li'); li.append(el('h5', '', name));
    const ok = p.blocks.find(b => b.step === step && b.correct); li.append(el('p', 'eb-ok', `✓ ${ok.text}`));
    for (const b of p.blocks.filter(x => x.step === step && !x.correct)) {
      const d = el('details', 'eb-bad'); d.append(el('summary', '', `✗ ${b.text}`), el('p', 'eb-fb', b.feedback)); li.append(d);
    }
    return li;
  }));
  $('out-count').textContent = `${Object.keys(p.steps).length} steps · ${p.blocks.filter(b => !b.correct).length} mistakes`;
  $('share-link').value = link();
}
const link = () => `${new URL('solve.html', location.href).href}#s=${encodeScenario({ ...sc, title: sc.title || built?.title || '' })}`;

function render() { renderControls(); drawPlane(built); }
function changed() { save(); renderOutput(); render(); }

/* ---------- events ---------- */
for (const [id, s] of Object.entries(SAMPLES)) { const o = document.createElement('option'); o.value = id; o.textContent = s.label; $('sample').append(o); }
$('sample').addEventListener('change', () => { if (!$('sample').value) return; sc = sampleScenario($('sample').value); selected = 0; $('sample').value = ''; changed(); });
for (const b of document.querySelectorAll('[data-kind]')) b.addEventListener('click', () => setKind(b.dataset.kind));
for (const b of document.querySelectorAll('[data-count]')) b.addEventListener('click', () => setCount(+b.dataset.count));
$('charge').addEventListener('input', () => {
  let v = +$('charge').value; if (v === 0) { v = sc.charges[selected].uC > 0 ? -0.5 : 0.5; $('charge').value = v; }
  sc.charges[selected].uC = v; changed();
});
for (const [id, k] of [['cx', 'x'], ['cy', 'y']]) $(id).addEventListener('change', () => {
  const c = sc.charges[selected], v = Math.round(+$(id).value * 100) / 100;
  if (!Number.isFinite(v)) return renderControls();
  const next = { ...c, [k]: v };
  const p = plane.constrain(selected, Math.min(0.98, Math.max(0.02, next.x)), Math.min(0.58, Math.max(0.02, next.y)));
  if (p) plane.onChange(selected, p.x, p.y); else { renderControls(); showOpen('That spot is closer than 4 cm to another charge.', true); }
});
$('target').addEventListener('change', () => { sc.target = +$('target').value; changed(); });
$('origin').addEventListener('change', () => { sc.origin = +$('origin').value; changed(); });
$('third-law').addEventListener('change', () => { sc.thirdLaw = $('third-law').checked; changed(); });
$('third').addEventListener('change', () => { const v = Math.round(+$('third').value * 2) / 2; sc.third.uC = Number.isFinite(v) && v ? Math.max(-10, Math.min(10, v)) : 1; changed(); });
$('title').addEventListener('input', () => { sc.title = $('title').value.trim(); save(); $('share-link').value = built ? link() : ''; });
$('statement').addEventListener('input', () => { sc.autoStatement = false; sc.statement = $('statement').value; save(); renderOutput(); });
$('rewrite').addEventListener('click', () => { sc.autoStatement = true; sc.statement = ''; changed(); });
$('preview').addEventListener('click', () => { if (built) window.open(link(), '_blank', 'noopener'); });
$('copy-link').addEventListener('click', async () => {
  if (!built) return;
  $('share-link').value = link(); $('share-link').select();
  try { await navigator.clipboard.writeText(link()); $('share-status').textContent = 'Link copied. Paste it into Canvas (as a link or in a page).'; }
  catch { $('share-status').textContent = 'Press Ctrl+C (⌘C on a Mac) to copy the selected link.'; }
});
$('download').addEventListener('click', () => {
  if (!built) return;
  const name = (sc.title || built.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'problem';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([scenarioFile({ ...sc, title: sc.title || built.title })], { type: 'application/json' }));
  a.download = `${name}.json`; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $('share-status').textContent = `Saved ${name}.json. Students can open it in Solve it with “Load problem file”.`;
});
function showOpen(text, bad) { const n = $('open-note'); n.hidden = !text; n.textContent = text; n.classList.toggle('bad', !!bad); }
$('open-file').addEventListener('change', async e => {
  const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
  if (file.size > 100000) return showOpen('That file is too large to be a Solve it problem.', true);
  let raw; try { raw = JSON.parse(await file.text()); } catch { return showOpen(`Could not open “${file.name}”: it is not valid JSON.`, true); }
  const scRaw = raw?.type === FILE_TYPE ? raw.scenario : raw;
  if (!Array.isArray(scRaw?.charges)) return showOpen(`Could not open “${file.name}”: it is not an electrostatics Solve it problem.`, true);
  sc = cleanScenario(scRaw); selected = 0;
  showOpen(`Opened “${file.name}”.`, false); changed();
});

changed();
