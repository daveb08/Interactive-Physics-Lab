import { QUANTITIES, SAMPLES, FIGURE_INFO, sampleScenario, buildProblem, physics, applicable, readProblemText, updateStatementNumbers, editValue, scenarioForFile, scenarioFromProblem } from './problem-builder.js';
import { encodeProblem, lintProblem, cleanProblem, validateProblem, formatValue as n } from './problem-format.js';
import { figureMarkup } from './solve-figures.js';

const $ = id => document.getElementById(id);
const KEY = 'ipl-solve-builder', AUTHOR_DRAFT = 'ipl-solve-author-draft';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = { F: '#c24c2a', f: '#7851a9', N: '#3d6fa8', W: '#3c4a46', Fnet: '#236d62', v0: '#2d7fb8', v: '#2d7fb8', a: '#b07d12', x: '#667674', dstop: '#667674' };
// How much the ▲▼ arrows (and the keyboard arrow keys) change each value. Any value can still be typed.
const STEPS = { muS: 0.01, muK: 0.01, m: 0.1, t: 0.1, v0: 0.1, a: 0.1, v: 0.1, x: 0.1, tstop: 0.1, dstop: 0.1, F: 1, W: 1, N: 1, f: 1, Fnet: 1 };
const stepFor = (k, v) => (k === 'muS' || k === 'muK' ? 0.01 : Math.max(STEPS[k] ?? 0.1, Math.abs(v) >= 1 ? 10 ** (Math.floor(Math.log10(Math.abs(v))) - 2) : 0));
const FORCE_SUB = { F: 'A', f: 'f', N: 'N', W: 'W', Fnet: 'net' };
const symHtml = k => (FORCE_SUB[k] ? `F<sub>${FORCE_SUB[k]}</sub>` : esc(QUANTITIES[k].sym));
const ROLE_TEXT = { given: 'Given in the problem', find: 'Students find', hidden: 'Leave out' };
const HOW = {
  W: 'Typing a weight changes the mass to match (m = F_W / g).', N: 'Typing a normal force changes the mass to match (F_N = m g on a level surface).',
  f: 'Type the size of the friction force (always positive). Its direction is opposite the motion, as the arrow shows. Typing a size changes μk to match (or the push, if the object stays at rest).',
  Fnet: 'Typing a net force changes the applied force to match.', a: 'Typing an acceleration changes the applied force to match (F_net = m a).',
  v: 'Typing a velocity at time t changes the applied force to match.', x: 'Typing a displacement at time t changes the applied force to match.',
  tstop: 'Typing a stopping time changes the applied force to match.', dstop: 'Typing a stopping distance changes the applied force to match.',
};

let sc, selected = null, lastNote = '', built = null, linkTimer;

/* ---------- state ---------- */
function save() { try { localStorage.setItem(KEY, JSON.stringify(sc)); } catch {} }
function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s?.roles && s.mass) return s; } catch {} return null; }
// Friction is shown and typed as a size; the arrow in the free-body diagram gives its direction.
const valueOf = (V, k) => (k === 'dstop' || k === 'f' ? Math.abs(V[k]) : V[k]);
const fmtVal = (V, k) => { const q = QUANTITIES[k], v = valueOf(V, k); return `${n(v)}${q.unit ? ` ${q.unit}` : ''}`; };

/* ---------- diagram ---------- */
function tag(k, x, y, V, roles, app, { anchor = 'middle', prefix } = {}) {
  if (!app[k]) return '';
  const q = QUANTITIES[k], role = roles[k] || 'hidden';
  const sub = !prefix && FORCE_SUB[k];
  const sym = prefix || (sub ? 'F' : q.sym.replace('_stop', 'stop'));
  const rest = role === 'find' ? ' = ?' : role === 'given' ? ` = ${fmtVal(V, k)}` : ` ${fmtVal(V, k)}`;
  const label = sym + rest;
  const w = (label.length + (sub ? sub.length * 0.75 : 0)) * 7 + 18, h = 22;
  // Forces read F with a subscript naming the force: F_A, F_f, F_N, F_W, F_net.
  const body = sub ? `F<tspan class="sub" dy="4">${sub}</tspan><tspan dy="-4">${esc(rest)}</tspan>` : esc(label);
  let x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  x0 = Math.max(4, Math.min(756 - w, x0));
  return `<g class="tag role-${role}${selected === k ? ' sel' : ''}" data-k="${k}" tabindex="0" role="button" aria-pressed="${selected === k}" aria-label="${esc(`${q.label}: ${role === 'find' ? 'students find it' : role === 'given' ? 'given' : 'left out'}, value ${fmtVal(V, k)}. Activate to edit.`)}">
    <rect x="${x0}" y="${y - h / 2}" width="${w}" height="${h}" rx="6"/><text x="${x0 + w / 2}" y="${y + 4.5}" text-anchor="middle">${body}</text></g>`;
}
function arrow(x1, y1, x2, y2, color, faded) {
  if (Math.hypot(x2 - x1, y2 - y1) < 2) return '';
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="3.5" marker-end="url(#tip-${color.slice(1)})" opacity="${faded ? 0.35 : 1}"/>`;
}
const cartMarkup = ghost => (ghost
  ? '<rect x="-24" y="158" width="48" height="32" rx="6" fill="none" stroke="#7d8b88" stroke-width="2" stroke-dasharray="5 3"/><circle cx="-14" cy="195" r="7" fill="none" stroke="#7d8b88" stroke-dasharray="3 2"/><circle cx="14" cy="195" r="7" fill="none" stroke="#7d8b88" stroke-dasharray="3 2"/>'
  : '<rect x="-24" y="158" width="48" height="32" rx="6" fill="#337a68"/><path d="M-16 166H16" stroke="#9cc9b9" stroke-width="3" stroke-linecap="round"/><circle cx="-14" cy="195" r="7" fill="#243d3b"/><circle cx="14" cy="195" r="7" fill="#243d3b"/>');
const figure = (kind, ghost) => (kind === 'cart' ? cartMarkup(ghost) : figureMarkup(kind, { ghost }).replaceAll('#ba622e', '#7d8b88'));

function drawDiagram(V, roles, app) {
  const fade = k => roles[k] === 'hidden';
  const markers = Object.values(COLORS).filter((c, i, a) => a.indexOf(c) === i)
    .map(c => `<marker id="tip-${c.slice(1)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`).join('');
  const G = 238, dir = (V.x < 0 || (V.x === 0 && V.v0 < 0)) ? -1 : 1;
  const sx = dir > 0 ? 130 : 330, ex = dir > 0 ? 330 : 130;
  const stopMode = app.tstop && (roles.tstop !== 'hidden' || roles.dstop !== 'hidden' || !V.timeValid);
  const moves = Math.abs(stopMode ? V.dstop : V.x) > 1e-9;
  const place = (x, ghost) => `<g transform="translate(${x} ${G}) scale(1.45) translate(0 -203)">${figure(sc.figure, ghost)}</g>`;
  const side = len => ({ anchor: len < 0 ? 'end' : 'start' });
  let s = `<defs>${markers}</defs>`;

  // Scene: the object at t = 0 and (dashed) later
  s += `<text x="230" y="22" class="d-title">Motion</text>`;
  s += `<path d="M20 ${G}H442" class="d-ground"/>${V.friction ? `<path d="M20 ${G + 2}H442" class="d-rough"/>` : ''}`;
  if (moves) s += `<g opacity="0.85">${place(ex, true)}</g><text x="${ex}" y="${G + 15}" class="d-note" text-anchor="middle">${stopMode ? 'where it stops' : `at t = ${n(V.t)} s`}</text>`;
  s += place(sx, false) + `<text x="${sx}" y="${G + 15}" class="d-note" text-anchor="middle">at t = 0</text>`;
  s += tag('m', sx, G + 36, V, roles, app);
  if (!stopMode || roles.t !== 'hidden') s += tag('t', 24, 46, V, roles, app, { anchor: 'start', prefix: '⏱ t' });
  // velocity at t = 0 and the acceleration, drawn above the object
  const vScale = 70 / Math.max(1, Math.abs(V.v0), Math.abs(V.v));
  const v0len = V.v0 ? Math.sign(V.v0) * Math.max(22, Math.abs(V.v0) * vScale) : 0, alen = Math.sign(V.a) * Math.min(70, 16 + Math.abs(V.a) * 12);
  s += arrow(sx, 132, sx + v0len, 132, COLORS.v0, fade('v0')) + tag('v0', sx + v0len + (v0len < 0 ? -8 : 8), 132, V, roles, app, side(v0len));
  s += (V.a ? arrow(sx, 92, sx + alen, 92, COLORS.a, fade('a')) : '') + tag('a', sx + alen + (alen < 0 ? -8 : 8), 92, V, roles, app, side(alen));
  // later state: velocity at t, or where it stops
  const bracket = `<path d="M${sx} ${G + 58}V${G + 70}M${ex} ${G + 58}V${G + 70}M${sx} ${G + 64}H${ex}" class="d-bracket"/>`;
  if (stopMode) {
    s += tag('tstop', ex, 92, V, roles, app, { prefix: 'stops at t' });
    if (moves) s += bracket + tag('dstop', (sx + ex) / 2, G + 64, V, roles, app, { prefix: 'd' });
  } else {
    const vlen = V.v * vScale;
    if (moves || V.v) s += arrow(ex, 132, ex + vlen, 132, COLORS.v, fade('v')) + tag('v', ex + vlen + (vlen < 0 ? -8 : 8), 132, V, roles, app, { ...side(vlen), prefix: `v(${n(V.t)} s)` });
    if (moves) s += bracket + tag('x', (sx + ex) / 2, G + 64, V, roles, app, { prefix: `x(${n(V.t)} s)` });
  }
  // surface
  if (V.friction) { s += tag('muS', 170, G + 96, V, roles, app); s += tag('muK', 290, G + 96, V, roles, app); }
  else s += `<text x="230" y="${G + 100}" class="d-note" text-anchor="middle">${FIGURE_INFO[sc.figure]?.pushesOff ? 'Modeled as one object: the push is the only horizontal force' : 'Frictionless surface (tick Friction above to add it)'}</text>`;

  // Free-body diagram
  const cx = 610, cy = 160;
  s += `<path d="M462 14V344" class="d-divider"/><text x="${cx}" y="22" class="d-title">Free-body diagram</text>`;
  // Vertical and horizontal forces are each drawn to their own scale so small pushes stay visible.
  const hMax = Math.max(Math.abs(V.F), Math.abs(V.f), Math.abs(V.Fnet)) || 1;
  const scale = L => (L === 0 ? 0 : Math.max(16, 105 * L / hMax));
  const Lv = 85, LF = Math.sign(V.F) * scale(Math.abs(V.F)), Lf = Math.sign(V.f) * scale(Math.abs(V.f));
  s += arrow(cx, cy, cx, cy - Lv, COLORS.N, fade('N')) + tag('N', cx, cy - Lv - 16, V, roles, app);
  s += arrow(cx, cy, cx, cy + Lv, COLORS.W, fade('W')) + tag('W', cx, cy + Lv + 16, V, roles, app);
  s += arrow(cx, cy - 6, cx + LF, cy - 6, COLORS.F, fade('F')) + tag('F', V.F ? cx + LF + Math.sign(LF) * 6 : cx + 46, cy - 26, V, roles, app, { anchor: V.F < 0 ? 'end' : V.F > 0 ? 'start' : 'middle' });
  if (V.friction) s += arrow(cx, cy + 8, cx + Lf, cy + 8, COLORS.f, fade('f')) + tag('f', V.f ? cx + Lf + Math.sign(Lf) * 6 : cx - 46, cy + 30, V, roles, app, { anchor: V.f < 0 ? 'end' : V.f > 0 ? 'start' : 'middle' });
  s += `<circle cx="${cx}" cy="${cy}" r="6" fill="#243d3b"/>`;
  const LN = Math.sign(V.Fnet) * scale(Math.abs(V.Fnet));
  s += `<text x="${cx}" y="342" class="d-note" text-anchor="middle">Arrow lengths: horizontal forces to scale with each other</text>`;
  s += `<text x="${cx}" y="292" class="d-note" text-anchor="middle">net force</text>` + arrow(cx, 310, cx + LN, 310, COLORS.Fnet, fade('Fnet')) + tag('Fnet', V.Fnet ? cx + LN + Math.sign(LN) * 6 : cx, 310, V, roles, app, { anchor: V.Fnet < 0 ? 'end' : V.Fnet > 0 ? 'start' : 'middle' });
  $('diagram').innerHTML = s;
}

/* ---------- editor for the selected quantity ---------- */
function drawEditor(V, roles, app) {
  const box = $('editor');
  if (!selected || !app[selected]) {
    box.innerHTML = '<p class="help">Click a label in the picture (the mass, a force, a velocity, the time…) to type its value and choose whether the problem gives it or students must find it.</p>';
    return;
  }
  const q = QUANTITIES[selected], role = roles[selected];
  const canFind = selected !== 'muS';
  const val = Number(valueOf(V, selected).toPrecision(6));
  box.innerHTML = `<div class="ed-head"><strong>${esc(q.label)}</strong> <span class="ed-sym">${symHtml(selected)}</span></div>
    <div class="ed-row"><label>Value <input id="ed-value" type="number" step="${stepFor(selected, val)}" value="${val}" ${selected === 'muS' || selected === 'muK' ? 'min="0" max="1"' : ['f', 'm', 'W', 'N', 't', 'tstop', 'dstop'].includes(selected) ? 'min="0"' : ''}> ${esc(q.unit)}</label>
    <div class="ed-roles" role="radiogroup" aria-label="In the problem">${['given', 'find', 'hidden'].map(r => `<button type="button" role="radio" aria-checked="${role === r}" data-role="${r}" class="ed-role r-${r}" ${r === 'find' && !canFind ? 'disabled title="Students cannot find μs from the motion"' : ''}>${ROLE_TEXT[r]}</button>`).join('')}</div></div>
    <p class="help">${esc(q.input ? 'This is one of the simulation’s settings.' : HOW[selected] || '')}</p>
    <p id="ed-note" class="ed-note">${esc(lastNote)}</p>`;
  const input = $('ed-value');
  const apply = () => {
    const r = editValue(sc, selected, Number(input.value));
    if (input.value === '' || r.error) { lastNote = r.error || 'Enter a number.'; $('ed-note').textContent = lastNote; $('ed-note').classList.add('bad'); return; }
    if (sc.autoStatement === false && sc.statement) {
      const updated = updateStatementNumbers(sc.statement, sc, r.sc);
      if (updated !== sc.statement) { r.sc.statement = updated; r.note = `${r.note ? `${r.note} ` : ''}Updated the number in your problem statement.`; }
    }
    sc = r.sc; lastNote = r.note || ''; render(true);
  };
  input.addEventListener('change', apply);
  // ▲▼ arrows and arrow keys step the value (no inputType); typed digits wait for Enter or leaving the box.
  input.addEventListener('input', e => { if (!e.inputType && input.value !== '') apply(); });
  box.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => { sc.roles[selected] = b.dataset.role; lastNote = ''; render(); }));
}

function drawTable(V, roles, app) {
  $('all-rows').innerHTML = Object.keys(QUANTITIES).filter(k => app[k]).map(k => `<tr><td><button type="button" class="linkish" data-sel="${k}">${esc(QUANTITIES[k].label)} (${symHtml(k)})</button></td><td>${esc(fmtVal(V, k))}</td>
    <td><select data-rolefor="${k}" class="vf-select">${['given', 'find', 'hidden'].filter(r => !(k === 'muS' && r === 'find')).map(r => `<option value="${r}" ${roles[k] === r ? 'selected' : ''}>${ROLE_TEXT[r]}</option>`).join('')}</select></td></tr>`).join('');
}

/* ---------- output ---------- */
function drawOutput() {
  const r = built, p = r.problem || r.draft;
  const st = $('status');
  if (r.issues.length) st.innerHTML = `<p class="author-errors-title">Before sharing:</p><ul class="author-errors">${r.issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
  else {
    let warnings = [];
    if (sc.autoStatement === false) { try { warnings = lintProblem(cleanProblem(p)).filter(w => /statement/.test(w)); } catch {} }
    st.innerHTML = `<p class="author-ok">✓ Ready to share. Try it as a student first.</p>${warnings.length ? `<ul class="author-warnings">${warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`;
  }
  if (document.activeElement !== $('title')) $('title').value = sc.title || '';
  $('title').placeholder = FIGURE_INFO[sc.figure]?.title || 'Title';
  if (document.activeElement !== $('statement')) $('statement').value = sc.autoStatement !== false ? r.statement || '' : sc.statement || '';
  $('statement-note').textContent = sc.autoStatement !== false ? 'Written from the diagram. Edit it freely: once you type here, your wording is kept.' : 'Your own wording. The numbers in it are not changed when you change the diagram.';
  $('rewrite').hidden = sc.autoStatement !== false;

  if (!p) { $('cards').innerHTML = ''; $('steps').innerHTML = '<li class="help">Fix the items above to see the solution.</li>'; }
  else {
    const group = (role, title) => { const cs = p.quantities.filter(c => c.role === role); return cs.length ? `<div class="cg cg-${role}"><span class="cg-title">${title}</span>${cs.map(c => `<span class="cchip" ${c.feedback ? `title="${esc(c.feedback)}"` : ''}>${esc(c.text)}</span>`).join('')}</div>` : ''; };
    $('cards').innerHTML = group('known', 'Knowns') + group('unknown', 'Unknowns') + group('none', 'Traps (belong in neither)');
    $('steps').innerHTML = Object.entries(p.steps).map(([k, name]) => {
      const bs = p.blocks.filter(b => b.step === k), ok = bs.find(b => b.correct);
      return `<li><span class="st-name">${esc(name)}</span><div class="blk-ok">✓ ${esc(ok.text)}</div>${bs.filter(b => !b.correct).map(b => `<details class="blk-no"><summary>✗ ${esc(b.text)}</summary><p>${esc(b.feedback)}</p></details>`).join('')}</li>`;
    }).join('');
  }
  const ready = !!r.problem;
  for (const id of ['preview', 'copy-link', 'download', 'to-editor']) $(id).disabled = !ready && id !== 'to-editor';
  $('to-editor').disabled = !p;
  clearTimeout(linkTimer);
  $('share-link').value = '';
  if (ready) linkTimer = setTimeout(async () => { $('share-link').value = await studentLink(r.problem); }, 150);
}
async function studentLink(p) { return `${new URL('solve.html', location.href).href}#p=${await encodeProblem(p)}`; }

function render(keepFocus) {
  const V = physics(sc), app = applicable(sc, V);
  built = buildProblem(sc);
  const roles = Object.fromEntries(Object.keys(QUANTITIES).map(k => [k, app[k] ? sc.roles[k] || 'hidden' : 'hidden']));
  drawDiagram(V, roles, app);
  if (!keepFocus || !$('editor').contains(document.activeElement)) drawEditor(V, roles, app);
  else { // keep the value box the user is typing in; refresh the rest
    const note = $('ed-note'); if (note) { note.textContent = lastNote; note.classList.remove('bad'); }
    const input = $('ed-value'); if (input && document.activeElement !== input) input.value = Number(valueOf(V, selected).toPrecision(6));
  }
  drawTable(V, roles, app);
  $('figure').value = sc.figure; $('friction').checked = !!sc.friction;
  drawOutput();
  save();
}

/* ---------- events ---------- */
function select(k) { selected = selected === k ? null : k; lastNote = ''; render(); if (selected) $('ed-value')?.focus(); }
$('diagram').addEventListener('click', e => { const g = e.target.closest('[data-k]'); if (g) select(g.dataset.k); });
$('diagram').addEventListener('keydown', e => { const g = e.target.closest('[data-k]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(g.dataset.k); } });
$('all-rows').addEventListener('click', e => { const b = e.target.closest('[data-sel]'); if (b) { selected = b.dataset.sel; lastNote = ''; render(); $('ed-value')?.focus(); } });
$('all-rows').addEventListener('change', e => { const s = e.target.closest('[data-rolefor]'); if (s) { sc.roles[s.dataset.rolefor] = s.value; render(); } });

for (const [id, s] of Object.entries(SAMPLES)) $('sample').insertAdjacentHTML('beforeend', `<option value="${id}">${esc(s.label)}</option>`);
$('sample').addEventListener('change', () => { const v = $('sample').value; if (!v) return; sc = sampleScenario(v); selected = null; $('sample').value = ''; render(); });
$('figure').addEventListener('change', () => { sc.figure = $('figure').value; render(); });
$('friction').addEventListener('change', () => {
  sc.friction = $('friction').checked;
  if (sc.friction) { if (!(sc.muK >= 0 && sc.muS > sc.muK && sc.muS <= 1)) { sc.muS = 0.3; sc.muK = 0.2; } if (sc.roles.muK === 'hidden') sc.roles.muK = 'given'; }
  render();
});
$('paste-toggle').addEventListener('click', () => { const box = $('paste-box'); box.hidden = !box.hidden; $('paste-toggle').setAttribute('aria-expanded', String(!box.hidden)); if (!box.hidden) $('paste-text').focus(); });
$('paste-read').addEventListener('click', () => {
  const text = $('paste-text').value.trim();
  if (text.length < 10) { $('paste-result').textContent = 'Type or paste the problem first.'; return; }
  const r = readProblemText(text, sc);
  sc = r.sc; selected = null;
  $('paste-result').textContent = `Read: ${r.found.join(', ') || 'no numbers with units'}. Asks for: ${r.asked.join(', ') || 'nothing recognised (click a label and choose “Students find”)'}. Check the diagram and fix anything misread.`;
  render();
});
$('title').addEventListener('input', () => { sc.title = $('title').value; built = buildProblem(sc); drawOutput(); save(); });
$('statement').addEventListener('input', () => { sc.autoStatement = false; sc.statement = $('statement').value; built = buildProblem(sc); drawOutput(); save(); });
$('rewrite').addEventListener('click', () => { sc.autoStatement = true; sc.statement = ''; render(); });

$('preview').addEventListener('click', async () => { if (built.problem) window.open(await studentLink(built.problem), '_blank', 'noopener'); });
$('copy-link').addEventListener('click', async () => {
  if (!built.problem) return;
  const link = await studentLink(built.problem);
  $('share-link').value = link;
  try { await navigator.clipboard.writeText(link); $('share-status').textContent = `Copied (${link.length} characters). Paste it into a Canvas page or assignment.`; }
  catch { $('share-link').select(); $('share-status').textContent = 'Your browser blocked automatic copying. The link is selected: press Ctrl+C (⌘C on a Mac).'; }
});
$('open-file').addEventListener('change', async e => {
  const file = e.target.files?.[0]; if (!file) return;
  const text = await file.text(); e.target.value = '';
  const note = $('open-note'); note.hidden = false; note.classList.remove('bad');
  let raw;
  try { raw = JSON.parse(text); } catch { raw = null; }
  const p = raw && typeof raw === 'object' ? cleanProblem(raw) : null;
  if (!p || !(p.setup?.mass > 0) || !Number.isFinite(p.setup?.force) || !Number.isFinite(p.setup?.velocity)) {
    note.classList.add('bad'); note.textContent = `“${file.name}” is not a Solve it problem file. Choose a .json file saved with ⬇ Download .json.`; return;
  }
  const r = scenarioFromProblem(p);
  sc = r.sc; selected = null; lastNote = '';
  note.textContent = r.exact
    ? `Opened “${file.name}” exactly as it was saved from the builder.`
    : `Opened “${file.name}”. The picture, title and wording come from the file${r.unread.length ? ` (cards not placed: ${r.unread.join('; ')})` : ''}. The knowns/unknowns cards and solution blocks are rewritten by the builder${validateProblem(p).length ? '' : '; to keep the file’s own hand-written blocks, open it in the detailed editor instead'}.`;
  render();
});
$('download').addEventListener('click', () => {
  const p = built.problem; if (!p) return;
  const name = `${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'problem'}.json`;
  // The file also carries the picture setup, so it reopens in the builder exactly as it is now.
  const url = URL.createObjectURL(new Blob([JSON.stringify({ ...p, builder: scenarioForFile(sc) }, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('share-status').textContent = `Downloaded ${name}. Students open it with “Load problem file (.json format)” on the Solve it page.`;
});
$('to-editor').addEventListener('click', () => {
  const p = built.problem || built.draft; if (!p) return;
  try { localStorage.setItem(AUTHOR_DRAFT, JSON.stringify(p)); } catch {}
  location.href = 'author.html';
});

sc = load() || sampleScenario('pallet');
render();
