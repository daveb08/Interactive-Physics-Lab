/**
 * Lab Bench · Lab 1: find g with a ball, a measuring stick and a timer, on Earth (practice) or a mystery planet.
 * Stage 1: bench, stick, steel ball, hand stopwatch (the student is the timer), notebook, t²–h fit, explainers.
 * Stage 2: electronic timer (1 ms), ping-pong ball with exact quadratic drag, a mystery planet seeded by the
 * student's ID, one fit per ball-and-timer combination, and an "explain your result" question chosen from the data.
 * Physics: js/core/freefall-drag.js. Seeding: js/core/lab-noise.js.
 */
import { fallAt, fallTime, BALLS, AIR } from '../../js/core/freefall-drag.js';
import { planetFor, normaliseId, PRACTICE_CODE } from '../../js/core/lab-noise.js';
import { XYPlot } from '../../js/components/xy-plot.js';
import { downloadCsv } from '../../js/components/csv-export.js';
import { addTrial, deleteTrial, groupByHeight, analyse, progress, notebookCsv, combos, comboKey, MIN, idealFitG } from './notebook-model.js';

const $ = id => document.getElementById(id);
const EARTH = { g: 9.81, rho: AIR.earth, air: 'earth' };
const S = 260, Y0 = 590;                         // bench scale: px per metre, pad top
const H_MIN = 0.20, H_MAX = 2.00;
const f2 = v => v.toFixed(2), f3 = v => v.toFixed(3);
const sig = (v, n = 3) => (!Number.isFinite(v) ? '–' : Math.abs(v) < 5e-7 ? '0' : (+v.toPrecision(n)).toString());   // rounding noise (e.g. 6e-17) shows as 0
const minus = s => String(s).replace('-', '−');
const decFor = d => Math.min(6, Math.max(0, 1 - Math.floor(Math.log10(d))));   // decimal places that show d to 2 significant figures
const pm = (v, d) => (d > 0 && Number.isFinite(d) ? `${v.toFixed(decFor(d))} ± ${d.toFixed(decFor(d))}` : `${sig(v, 3)} ± –`);
const params = new URLSearchParams(location.search);
const CODE = (params.get('a') || PRACTICE_CODE).toLowerCase().slice(0, 40);
const TIMER = { watch: 'Hand stopwatch', gate: 'Electronic timer' };
const BALL_INFO = { steel: { ...BALLS.steel, px: 8 }, pingpong: { ...BALLS.pingpong, px: 11 } };

const SHELF = [
  { id: 'steel', name: 'Steel ball', desc: '25.4 mm diameter, 67 g', icon: 'ball', kind: 'ball' },
  { id: 'pingpong', name: 'Ping-pong ball', desc: '40 mm diameter, 2.7 g', icon: 'ball2', kind: 'ball' },
  { id: 'stick', name: 'Measuring stick (2 m)', desc: 'Millimetre divisions', icon: 'stick' },
  { id: 'watch', name: 'Hand stopwatch', desc: 'Hundredths of a second; you start and stop it', icon: 'watch' },
  { id: 'gate', name: 'Electronic timer', desc: 'Release magnet and impact pad; reads to 1 ms', icon: 'gate' },
];

/* ---------- state ---------- */
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const state = {
  mode: 'earth', planet: null,
  ball: null, placed: { stick: false, watch: false, gate: false }, timer: 'watch',
  // A hidden sub-millimetre offset, so clamp steps never land exactly on a millimetre mark.
  h: 1.0 + 0.0005 + Math.round(Math.random() * 40) * 0.0001,
  phase: 'ready', release: 0, impact: 0, T: 0,
  watch: { running: false, start: 0, value: 0 }, gate: { value: 0 },
  book: [], combo: '', view: 't2', submitted: null, revealed: false,
};
const env = () => (state.mode === 'planet' && state.planet ? state.planet : EARTH);
const ball = () => BALL_INFO[state.ball] || BALL_INFO.steel;
const physics = () => ({ g: env().g, ball: ball(), rho: env().rho });
const bookKey = () => (state.mode === 'planet' && state.planet ? `ipl-lab1-planet-${state.planet.id}-${state.planet.code}` : 'ipl-lab1-earth');
function loadBook() {
  let raw = store.get(bookKey());
  if (raw === null && state.mode === 'earth') raw = store.get('ipl-lab1-practice');   // Stage 1 notebooks carry over
  try { const b = JSON.parse(raw || '[]'); return Array.isArray(b) ? b.filter(r => r && Number.isFinite(r.h) && Number.isFinite(r.t)) : []; } catch { return []; }
}
const save = () => store.set(bookKey(), JSON.stringify(state.book));
const hasTimer = () => state.placed.watch || state.placed.gate;
const ready = () => !!state.ball && state.placed.stick && hasTimer();
const busy = () => state.phase === 'countdown' || state.phase === 'falling';

/* ---------- mode: Earth or a mystery planet ---------- */
function setMode(mode, id = '') {
  if (busy()) return;
  if (mode === 'planet') {
    const nid = normaliseId(id);
    if (!nid) { state.mode = 'planet'; state.planet = null; }
    else { state.mode = 'planet'; state.planet = planetFor(nid, CODE); store.set('ipl-lab1-id', nid); }
  } else { state.mode = 'earth'; state.planet = null; }
  store.set('ipl-lab1-mode', state.mode);
  state.book = loadBook(); state.combo = ''; state.submitted = null; state.revealed = false;
  resetWatch(); state.gate.value = 0; state.phase = 'ready';
  $('result-msg').hidden = true; $('r-g').value = ''; $('r-dg').value = '';
  renderAll();
}
for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode, b.dataset.mode === 'planet' ? store.get('ipl-lab1-id') || '' : ''));
$('planet-form').addEventListener('submit', e => { e.preventDefault(); const id = $('student-id').value; if (!normaliseId(id)) { $('student-id').focus(); return; } setMode('planet', id); });
function renderMode() {
  const p = state.planet, planet = state.mode === 'planet';
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
  $('planet-form').hidden = !planet || !!p;
  $('planet-status').hidden = !planet || !p;
  if (p) $('planet-status').innerHTML = `<b>${p.name}</b> for student ID <b>${p.id}</b>. Its gravity and its air are hidden: measure them. <button type="button" id="change-id" class="lb-link-btn">Change ID</button>`;
  $('change-id')?.addEventListener('click', () => { state.planet = null; $('student-id').value = ''; renderAll(); $('student-id').focus(); });
  $('mode-tag').innerHTML = `<span aria-hidden="true">●</span> ${planet ? (p ? `Mystery planet · ${p.name}` : 'Mystery planet') : 'Practice · Earth'}`;
  $('check').textContent = planet ? 'Submit my result' : 'Compare with Earth’s g';
  $('reveal').hidden = !planet || !state.submitted || state.revealed;
  $('nb-where').textContent = planet ? (p ? `· ${p.name}` : '') : '· Earth';
  $('footnote').textContent = planet
    ? 'Mystery planet: gravity between 3 and 20 m/s², and either no air, thin air or Earth-like air, chosen by your student ID. The fall is exact, including air drag on the ping-pong ball; the errors are in your readings and your timer. Nothing is saved or sent; your notebook stays in this browser.'
    : 'Practice mode: Earth, g = 9.81 m/s², with Earth’s air (it slows the ping-pong ball noticeably, the steel ball by less than 0.1 % over 2 m). The fall is exact; the errors are in your readings and your timer. Nothing is saved or sent; your notebook stays in this browser.';
}

/* ---------- shelf ---------- */
const ICONS = {
  ball: '<circle cx="20" cy="20" r="11" fill="#8f9aa3" stroke="#59636b" stroke-width="2"/><circle cx="16" cy="16" r="3" fill="#d6dce0"/>',
  ball2: '<circle cx="20" cy="20" r="13" fill="#fbfaf4" stroke="#b9b29c" stroke-width="2"/><circle cx="15" cy="15" r="3" fill="#fff"/>',
  stick: '<rect x="16" y="3" width="8" height="34" fill="#e9d79a" stroke="#b39a4a"/><path d="M16 8h4M16 13h3M16 18h4M16 23h3M16 28h4M16 33h3" stroke="#6d5a1e"/>',
  watch: '<circle cx="20" cy="22" r="13" fill="#fff" stroke="#3c4a46" stroke-width="2.5"/><rect x="17" y="4" width="6" height="5" rx="1" fill="#3c4a46"/><path d="M20 22V13" stroke="#c24c2a" stroke-width="2.5" stroke-linecap="round"/>',
  gate: '<rect x="5" y="9" width="30" height="20" rx="3" fill="#1f2a28"/><text x="20" y="23" font-size="9" fill="#9ff0c4" text-anchor="middle" font-family="monospace">0.452</text><path d="M12 33h16" stroke="#3c4a46" stroke-width="3"/>',
};
const isPlaced = id => (id === 'steel' || id === 'pingpong' ? state.ball === id : state.placed[id]);
function renderShelf() {
  $('shelf').replaceChildren(...SHELF.map(it => {
    const on = isPlaced(it.id), li = document.createElement('li');
    li.className = `lb-item${on ? ' placed' : ''}`; li.draggable = !on; li.dataset.id = it.id;
    li.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true">${ICONS[it.icon]}</svg><div><strong></strong><span></span></div>`;
    li.querySelector('strong').textContent = it.name; li.querySelector('span').textContent = it.desc;
    const b = document.createElement('button'); b.type = 'button';
    const swap = it.kind === 'ball' && !on && state.ball;
    const words = on ? '✓ On bench · remove' : swap ? 'Swap into the clamp' : 'Place on bench';
    b.textContent = words; b.setAttribute('aria-label', `${words.replace('✓ ', '')}: ${it.name}`);   // starts with the visible words (voice control)
    b.disabled = busy();
    b.addEventListener('click', () => place(it.id, !on));
    li.append(b);
    li.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', `lb:${it.id}`); e.dataTransfer.effectAllowed = 'copy'; });
    return li;
  }));
}
function place(id, on) {
  if (busy()) return;
  if (id === 'steel' || id === 'pingpong') { state.ball = on ? id : null; state.phase = 'ready'; }
  else state.placed[id] = on;
  if (id === 'watch' && !on) resetWatch();
  if (id === 'gate' && !on) state.gate.value = 0;
  if (on && (id === 'watch' || id === 'gate')) state.timer = id;
  if (!state.placed[state.timer]) state.timer = state.placed.gate ? 'gate' : 'watch';
  renderAll();
}
const zone = $('drop-zone');
zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drop-target'); });
zone.addEventListener('dragleave', () => zone.classList.remove('drop-target'));
zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drop-target'); const d = e.dataTransfer.getData('text/plain'); if (d.startsWith('lb:') && SHELF.some(i => i.id === d.slice(3)) && !isPlaced(d.slice(3))) place(d.slice(3), true); });

/* ---------- bench drawing ---------- */
const py = h => Y0 - h * S;
const BALL_X = 236;
function ballBottom(now = performance.now()) {
  if (state.phase === 'falling') return Math.max(0, state.h - fallAt(physics(), (now - state.release) / 1000).y);
  if (state.phase === 'landed') return 0;
  return state.h;
}
function drawBench(now) {
  const bp = ball().px, top = py(state.h), gate = state.placed.gate;
  let s = `<rect x="20" y="${Y0 + 8}" width="380" height="14" rx="3" class="lb-benchtop"/>`;
  s += `<rect x="208" y="${Y0}" width="56" height="8" rx="2" class="${gate ? 'lb-impact lb-sensor' : 'lb-impact'}"/><text x="236" y="${Y0 + 40}" class="lb-lab">${gate ? 'impact sensor' : 'impact pad'}</text>`;
  s += `<rect x="70" y="${Y0 + 2}" width="90" height="6" rx="2" class="lb-base"/><rect x="111" y="${py(2.12)}" width="8" height="${Y0 + 2 - py(2.12)}" class="lb-pole"/>`;
  const jawY = top - 2 * bp - 12;
  s += `<g id="clamp" class="lb-clamp" tabindex="0" role="button" aria-label="Release clamp. Use the arrow keys to raise or lower it (Page Up and Page Down for big steps).">`
    + `<rect x="105" y="${jawY - 2}" width="20" height="14" rx="3" class="lb-clamp-block"/><rect x="125" y="${jawY + 2}" width="${BALL_X - 125 - 4}" height="5" class="lb-arm"/>`
    + `<path d="M${BALL_X - 11} ${jawY}h22v7h-22z" class="${gate ? 'lb-jaw lb-magnet' : 'lb-jaw'}"/><circle cx="96" cy="${jawY + 5}" r="10" class="lb-handle"/><path d="M92 ${jawY + 3}l4-4 4 4M92 ${jawY + 7}l4 4 4-4" class="lb-handle-arrows"/></g>`;
  if (gate) s += `<path d="M${BALL_X} ${jawY} V ${jawY - 12} H 396 V ${Y0 - 78}" class="lb-wire"/><path d="M264 ${Y0 + 4} H 350 V ${Y0 - 40}" class="lb-wire"/>`
    + `<g transform="translate(330 ${Y0 - 78})"><rect width="76" height="38" rx="5" class="lb-gate-box"/><text x="38" y="25" class="lb-gate-lcd">${state.phase === 'falling' ? f3(Math.min(state.T, (now - state.release) / 1000)) : f3(state.gate.value)}</text></g>`;
  if (state.placed.stick) {
    s += `<rect x="270" y="${py(2.02)}" width="20" height="${Y0 - py(2.02)}" class="lb-stick"/>`;
    for (let cm = 0; cm <= 200; cm += 10) { const y = py(cm / 100); s += `<line x1="270" x2="${cm % 50 ? 278 : 284}" y1="${y}" y2="${y}" class="lb-tick"/>${cm % 50 ? '' : `<text x="294" y="${y + 5}" class="lb-stick-lab">${cm / 100} m</text>`}`; }
  }
  if (state.ball) {
    const bb = ballBottom(now), cy = py(bb) - bp, cls = state.ball === 'pingpong' ? 'lb-ball lb-ball-pp' : 'lb-ball';
    s += `<circle cx="${BALL_X}" cy="${cy}" r="${bp}" class="${cls}"/><circle cx="${BALL_X - 3}" cy="${cy - 3}" r="2.5" class="lb-shine"/>`;
    if (state.placed.stick && state.phase === 'ready') s += `<line x1="${BALL_X}" x2="270" y1="${py(bb)}" y2="${py(bb)}" class="lb-sight"/>`;
    if (state.phase === 'landed' && now - state.impact < 350) s += `<circle cx="${BALL_X}" cy="${Y0 - 2}" r="${12 + (now - state.impact) / 20}" class="lb-clack"/>`;
  }
  if (state.placed.watch) s += `<g transform="translate(${gate ? 380 : 330} ${Y0 - 22})"><circle r="15" class="lb-watch-icon"/><rect x="-4" y="-21" width="8" height="5" fill="#3c4a46"/><line x1="0" y1="0" x2="0" y2="-9" stroke="#c24c2a" stroke-width="2.5" stroke-linecap="round"/></g>`;
  $('bench').innerHTML = s;
  const bn = state.ball ? BALL_INFO[state.ball].name.toLowerCase() : '';
  $('bench').setAttribute('aria-label', `Lab bench. ${state.ball ? (state.phase === 'landed' ? `The ${bn} is on the pad.` : state.phase === 'falling' ? `The ${bn} is falling.` : `The ${bn} is in the release clamp.`) : 'The release clamp is empty.'} ${state.placed.stick ? 'The measuring stick stands beside the drop.' : ''} ${gate ? 'The electronic timer is connected.' : ''}`);
  bindClamp();
}
function drawLoupe() {
  const show = !!state.ball && state.placed.stick && state.phase === 'ready';
  $('loupe-wrap').hidden = !show;
  if (!show) return;
  const k = 3250, mid = state.h, yOf = h => 130 - (h - mid) * k, R = ball().diameter / 2;
  let s = `<rect x="104" y="0" width="56" height="260" class="lb-stick"/>`;
  for (let mm = Math.ceil((mid - 0.042) * 1000); mm <= (mid + 0.042) * 1000; mm++) {
    const y = yOf(mm / 1000), len = mm % 10 === 0 ? 22 : mm % 5 === 0 ? 15 : 9;
    s += `<line x1="104" x2="${104 + len}" y1="${y}" y2="${y}" class="lb-tick"/>`;
    if (mm % 10 === 0) s += `<text x="${130}" y="${y + 6}" class="lb-loupe-num">${mm / 10}</text>`;
  }
  s += `<rect x="136" y="240" width="24" height="20" fill="#efe0a8"/><text x="158" y="256" class="lb-loupe-unit">cm</text>`;
  const bottom = yOf(mid), rr = R * k;
  s += `<clipPath id="lc"><rect x="0" y="0" width="104" height="260"/></clipPath><g clip-path="url(#lc)"><circle cx="52" cy="${bottom - rr}" r="${rr}" class="${state.ball === 'pingpong' ? 'lb-ball lb-ball-pp' : 'lb-ball'}"/></g>`;
  s += `<line x1="12" x2="104" y1="${bottom}" y2="${bottom}" class="lb-sight lb-sight-strong"/>`;
  $('loupe').innerHTML = s;
  $('loupe').setAttribute('aria-label', `Magnified measuring stick. The bottom of the ball is at ${(Math.round(mid * 1000) / 1000).toFixed(3)} metres, to the nearest millimetre.`);
}

/* ---------- clamp height ---------- */
function setHeight(h) {
  if (busy()) return;
  state.h = Math.min(H_MAX + 0.0049, Math.max(H_MIN, Math.round(h * 10000) / 10000));
  state.phase = 'ready';
  renderAll();
}
const step = () => ($('coarse').checked ? 0.05 : 0.005);
$('clamp-up').addEventListener('click', () => setHeight(state.h + step()));
$('clamp-down').addEventListener('click', () => setHeight(state.h - step()));
let dragging = false;
function bindClamp() {
  const c = $('clamp'); if (!c || c.dataset.bound) return; c.dataset.bound = '1';
  c.addEventListener('keydown', e => {
    const d = { ArrowUp: 0.005, ArrowDown: -0.005, PageUp: 0.05, PageDown: -0.05 }[e.key];
    if (d) { e.preventDefault(); setHeight(state.h + d); $('clamp')?.focus(); }
  });
  c.addEventListener('pointerdown', e => { if (busy()) return; dragging = true; $('bench').setPointerCapture?.(e.pointerId); e.preventDefault(); });
}
$('bench').addEventListener('pointermove', e => {
  if (!dragging) return;
  const m = $('bench').getScreenCTM(); if (!m) return;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  setHeight((Y0 - (p.y + 2 * ball().px + 7)) / S);
});
for (const ev of ['pointerup', 'pointercancel']) $('bench').addEventListener(ev, () => { if (dragging) { dragging = false; $('clamp')?.focus(); } });

/* ---------- drop ---------- */
let anim = 0;
function loop(now) {
  if (state.phase === 'falling' && (now - state.release) / 1000 >= state.T) {
    state.phase = 'landed'; state.impact = state.release + state.T * 1000;
    // The electronic timer: true fall time, ±0.5 ms of electronic jitter, shown to the millisecond.
    if (state.placed.gate) state.gate.value = Math.round((state.T + (Math.random() - 0.5) * 0.001) * 1000) / 1000;
    renderControls();
  }
  if (state.watch.running) $('watch-display').textContent = f2(Math.floor((now - state.watch.start) / 10) / 100);
  if (state.placed.gate) $('gate-display').textContent = state.phase === 'falling' ? f3(Math.min(state.T, (now - state.release) / 1000)) : f3(state.gate.value);
  drawBench(now);
  if (busy() || state.watch.running || now - state.impact < 400) anim = requestAnimationFrame(loop);
  else { anim = 0; renderControls(); }
}
const kick = () => { if (!anim) anim = requestAnimationFrame(loop); };
$('drop').addEventListener('click', () => {
  if (!ready() || state.phase !== 'ready') return;
  state.phase = 'countdown'; state.gate.value = 0; renderControls();
  const say = t => { $('countdown').textContent = t; $('countdown').classList.toggle('show', !!t); };
  // A steady beat, as lab partners count "3, 2, 1, drop": students can start the stopwatch on the beat,
  // so the start error is small and random. (A random delay would make every start ~0.2 s late.)
  say('3'); setTimeout(() => say('2'), 700); setTimeout(() => say('1'), 1400);
  setTimeout(() => {
    state.T = fallTime(physics(), state.h);
    state.release = performance.now(); state.phase = 'falling'; say('Drop!');
    setTimeout(() => say(''), 600);
    renderControls(); kick();
  }, 2100);
  kick();
});
$('reset-ball').addEventListener('click', () => { if (state.phase === 'landed') { state.phase = 'ready'; renderAll(); } });

/* ---------- timers ---------- */
function toggleWatch(t = performance.now()) {
  if (!state.placed.watch) return;
  const w = state.watch;
  if (!w.running) { if (w.value > 0) return; w.running = true; w.start = t; kick(); }
  else { w.running = false; w.value = Math.floor((t - w.start) / 10) / 100; $('watch-display').textContent = f2(w.value); }
  renderControls();
}
function resetWatch() { Object.assign(state.watch, { running: false, value: 0 }); $('watch-display').textContent = '0.00'; }
$('watch-toggle').addEventListener('click', () => toggleWatch(performance.now()));
$('watch-reset').addEventListener('click', () => { resetWatch(); renderControls(); });
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' || e.repeat || e.target.closest('input,textarea,select,summary')) return;   // Space is the stopwatch, even on a focused button
  if (!state.placed.watch) return;
  e.preventDefault(); toggleWatch(performance.now());
});
for (const r of document.querySelectorAll('input[name=timer]')) r.addEventListener('change', () => { state.timer = r.value; renderControls(); });
const timeFor = () => (state.timer === 'gate' ? state.gate.value : state.watch.value);

/* ---------- record ---------- */
$('record').addEventListener('click', () => {
  const h = +$('h-read').value, t = timeFor();
  if (!(h >= 0.1 && h <= 2.5)) { $('record-msg').textContent = 'Type the height you read off the stick, in metres (for example 1.234).'; $('h-read').focus(); return; }
  if (!(t > 0)) { $('record-msg').textContent = state.timer === 'gate' ? 'Drop the ball first: the electronic timer reads when it lands.' : 'Time a drop first: start and stop the stopwatch.'; return; }
  state.book = addTrial(state.book, { object: BALL_INFO[state.ball].name, timer: TIMER[state.timer], h: Math.round(h * 1000) / 1000, t });
  state.combo = comboKey(state.book.at(-1));
  save();
  $('record-msg').textContent = `Trial ${state.book.at(-1).id} recorded: h = ${f3(h)} m, t = ${state.timer === 'gate' ? f3(t) : f2(t)} s.`;
  resetWatch(); state.gate.value = 0; $('gate-display').textContent = '0.000';
  if (state.phase === 'landed') state.phase = 'ready';
  renderAll();
});
$('h-read').addEventListener('input', renderControls);

/* ---------- notebook ---------- */
function currentCombo() {
  const cs = combos(state.book);
  if (!cs.some(c => c.key === state.combo)) state.combo = cs[0]?.key || '';
  return { cs, key: state.combo };
}
$('combo').addEventListener('change', () => { state.combo = $('combo').value; renderNotebook(); renderAnalysis(); });
function renderNotebook() {
  const rows = state.book, { cs, key } = currentCombo();
  $('combo-row').hidden = cs.length < 2;
  $('combo').replaceChildren(...cs.map(c => { const o = document.createElement('option'); o.value = c.key; o.textContent = `${c.key} (${c.n} trials)`; return o; }));
  $('combo').value = key;
  $('no-trials').hidden = rows.length > 0;
  $('trial-rows').replaceChildren(...[...rows].reverse().map(r => {
    const tr = document.createElement('tr'); if (r.deleted) tr.className = 'deleted'; if (!r.deleted && comboKey(r) !== key) tr.classList.add('other');
    for (const v of [r.id, r.object, r.timer, f3(r.h), r.timer === TIMER.gate ? f3(r.t) : f2(r.t)]) { const td = document.createElement('td'); td.textContent = v; tr.append(td); }
    const td = document.createElement('td'), b = document.createElement('button'); b.type = 'button';
    b.textContent = r.deleted ? 'Undo' : '✕'; b.setAttribute('aria-label', `${r.deleted ? 'Restore' : 'Delete'} trial ${r.id}`);
    b.addEventListener('click', () => { state.book = deleteTrial(state.book, r.id, 'deleted by student'); save(); renderAll(); });
    td.append(b); tr.append(td); return tr;
  }));
  const groups = groupByHeight(rows, key);
  $('groups-caption').textContent = key ? `By height · ${key}` : 'By height';
  $('group-rows').replaceChildren(...groups.map(g => {
    const tr = document.createElement('tr');
    for (const v of [f3(g.h), g.n, f3(g.tMean), sig(g.tSD, 2), sig(g.tSE, 2), sig(g.gEach, 3)]) { const td = document.createElement('td'); td.textContent = v; tr.append(td); }
    if (g.n >= MIN.trialsPerHeight) tr.className = 'full';
    return tr;
  }));
  const p = progress(rows, key);
  $('progress').textContent = p.done ? `✓ ${p.fullHeights} heights with ${MIN.trialsPerHeight}+ trials` : `${p.fullHeights} of ${MIN.heights} heights done (${MIN.trialsPerHeight}+ trials each)`;
  const g2 = groups.find(g => g.n >= 2);
  $('explain-stats').hidden = !g2;
  if (g2) $('explain-stats-body').innerHTML = `<p>At h = ${f3(g2.h)} m you timed ${g2.n} drops. Their <b>mean</b> is ${f3(g2.tMean)} s: your best single estimate of the fall time.</p>`
    + `<p>The <b>standard deviation</b> (SD = ${sig(g2.tSD, 2)} s) is the typical scatter of one trial about the mean. ${key.includes(TIMER.watch) ? 'With a hand stopwatch most of it is your reaction time.' : 'With the electronic timer it is tiny: about a millisecond.'}</p>`
    + `<p>The <b>standard error</b> (SE = SD/√n = ${sig(g2.tSD, 2)}/√${g2.n} = ${sig(g2.tSE, 2)} s) is how well you know the <i>mean</i>. It shrinks as you add trials: four times as many trials halves it.</p>`;
}
$('csv').addEventListener('click', () => downloadCsv(notebookCsv(state.book), state.planet ? `lab1-${state.planet.name.replace(/\s+/g, '-').toLowerCase()}-notebook.csv` : 'lab1-find-g-notebook.csv'));
$('clear-nb').addEventListener('click', e => {
  const b = e.currentTarget;
  if (!state.book.length) return;
  if (b.dataset.armed) { state.book = []; save(); delete b.dataset.armed; b.textContent = 'Clear notebook'; renderAll(); return; }
  b.dataset.armed = '1'; b.textContent = 'Click again to clear all trials';
  setTimeout(() => { delete b.dataset.armed; b.textContent = 'Clear notebook'; }, 4000);
});

/* ---------- graph and fit ---------- */
const plot = new XYPlot($('graph'), { width: 460, height: 290, title: '', xLabel: 'drop height h (m)', yLabel: '' });
for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', () => {
  state.view = b.dataset.view;
  for (const x of document.querySelectorAll('[data-view]')) x.setAttribute('aria-pressed', String(x === b));
  renderAnalysis();
});
function renderAnalysis() {
  const { key } = currentCombo(), a = analyse(state.book, key), groups = a.groups, t2 = state.view === 't2';
  const pts = groups.flatMap(g => g.rows), hMax = Math.max(1, ...pts.map(r => r.h)) * 1.1;
  const yv = r => (t2 ? r.t * r.t : r.t), yMax = Math.max(t2 ? 0.25 : 0.5, ...pts.map(yv)) * 1.15;
  plot.title = t2 ? 'Fall time squared against height' : 'Fall time against height';
  plot.yLabel = t2 ? 't² (s²)' : 't (s)';
  const series = [];
  if (a.fit) {
    const line = []; for (let i = 0; i <= 60; i++) { const h = (hMax * i) / 60; const ts = a.fit.intercept + a.fit.slope * h; line.push([h, t2 ? ts : Math.sqrt(Math.max(0, ts))]); }
    series.push({ points: line, color: '#1f6b5e', width: 2.2, legend: t2 ? 'best-fit line' : 'from the fit' });
  }
  const markers = [
    ...pts.map(r => ({ x: r.h, y: yv(r), color: '#9aa7a2', r: 2.8 })),
    ...groups.map(g => ({ x: g.h, y: t2 ? g.tMean ** 2 : g.tMean, ey: Number.isFinite(g.tSE) ? (t2 ? 2 * g.tMean * g.tSE : g.tSE) : 0, color: '#c27b22', r: 4.8 })),
  ];
  plot.render({ x: [0, hMax], y: [0, yMax], series, markers, note: pts.length ? (key || '') : 'record trials to see them here' });
  $('graph').setAttribute('aria-label', `${plot.title}${key ? `, ${key}` : ''}. ${pts.length} trials at ${groups.length} heights.${a.fit ? ` Fit gives g = ${sig(a.g)} ± ${sig(a.gSE, 2)} metres per second squared.` : ''}`);
  $('graph-note').textContent = a.error || (t2 ? 'Grey dots: single trials. Orange: the mean at each height, with ± its standard error. Green: the least-squares line.' : 'Plotted against h, the times curve (t ∝ √h), so a straight line cannot be fitted directly. That is why the t² graph is used.');
  $('fit-table').hidden = !a.fit;
  $('explain-fit').hidden = !a.fit;
  if (a.fit) {
    $('f-slope').textContent = `${sig(a.fit.slope, 3)} ± ${sig((a.gSE * a.fit.slope ** 2) / 2, 2)} s²/m`;   // equals the fit's own ± unless the equipment floor applies
    const intSE = a.fit.interceptSE * (a.floored && a.gSEfit > 0 ? a.gSE / a.gSEfit : 1);   // the floor widens the intercept's ± in the same proportion
    $('f-int').textContent = `${minus(sig(a.fit.intercept, 2))} ± ${sig(intSE, 2)} s²`;
    $('f-g').textContent = `${minus(pm(a.g, a.gSE))} m/s²`;
    $('explain-fit-body').innerHTML = `<p>For a drop from rest, h = ½ g t², so <b>t² = (2/g) h</b>. Plotting t² against h gives a straight line through the origin with <b>slope 2/g</b>, so <b>g = 2 / slope</b>. Your slope ${sig(a.fit.slope, 3)} s²/m gives g = 2 / ${sig(a.fit.slope, 3)} = ${sig(a.g, 3)} m/s².</p>`
      + `<p>The ± on the slope comes from how far your points scatter about the line. It carries over to g: δg = 2 δslope / slope² = ${sig(a.gSEfit, 2)} m/s²${a.floored ? ' from the scatter alone' : ''}.</p>`
      + (a.floored ? `<p><b>Why is the ± on g larger than that?</b> Your points sit closer to the line than your equipment can resolve (the ruler reads to 1 mm, the ${key.includes(TIMER.gate) ? 'electronic timer to 1 ms' : 'stopwatch to 0.01 s'}). With few trials that happens by luck, and the scatter then understates the uncertainty. So the ± shown is the equipment limit, ${sig(a.gSEfloor, 2)} m/s², instead.</p>` : '')
      + `<p><b>Why t² on the vertical axis?</b> A least-squares fit assumes the error is in the vertical quantity. Times are the noisier measurement, especially by hand, so time belongs on the vertical axis. (Fitting h against t² instead would pull g low.)</p>`
      + `<p>The intercept should be close to zero. ${Math.abs(a.fit.intercept) > 2 * intSE ? `Yours (${minus(sig(a.fit.intercept, 2))} s²) is not: a ${a.fit.intercept > 0 ? 'positive' : 'negative'} intercept often means the timing ran ${a.fit.intercept > 0 ? 'long (started early or stopped late)' : 'short (started late or stopped early)'} by about the same amount every time. A timing offset δ adds 2δt + δ² to every t², and because 2δt grows with height it also tilts the line a little, so it biases g as well as the intercept. That is a systematic error: more trials will not remove it, a better timer will.` : 'Yours is, within its uncertainty.'}</p>`;
  }
  const ex = a.fit && a.gSE > 0 ? { g: a.g, d: a.gSE } : { g: 9.7234, d: 0.2871 };
  const pr = progress(state.book, key);
  $('fit-warn').hidden = !a.fit || pr.done;
  $('fit-warn').textContent = `Not enough data yet: the assignment needs ${MIN.heights} heights with ${MIN.trialsPerHeight} drops each (so far: ${pr.fullHeights} ${pr.fullHeights === 1 ? 'height' : 'heights'} with ${MIN.trialsPerHeight}). With fewer drops the ± cannot be trusted, and ${state.mode === 'planet' ? 'you cannot submit a result yet' : 'your comparison is only a rough check'}.`;   // a perfect fit (zero scatter) falls back to the example
  const d1 = +ex.d.toPrecision(1), dec = Math.min(6, Math.max(0, -Math.floor(Math.log10(d1))));
  $('explain-report').innerHTML = `<p>Round the uncertainty to <b>1 or 2 significant figures</b>, then round the value to the <b>same decimal place</b>. ${a.fit && a.gSE > 0 ? 'Your fit gives' : 'For example,'} ${sig(ex.g, 5)} ± ${sig(ex.d, 4)} m/s² → <b>${ex.g.toFixed(dec)} ± ${d1.toFixed(dec)} m/s²</b>.</p>`
    + `<p>Then ask: <b>does my range include the expected value?</b> If it does, your measurement agrees with it.</p>`
    + `<p><b>Random error</b> scatters results both ways (your reaction time varies); more trials reduce its effect. <b>Systematic error</b> pushes every result the same way (for example, always stopping late, measuring to the middle of the ball, or air drag on a light ball). More trials do not remove it; a better method does.</p>`;
  renderQuestion(key, a);
}

/* ---------- explain your result: one question, chosen from the data analysed ---------- */
const QUESTIONS = {
  watch: { text: 'What limits your hand-timed measurement most?', correct: 'a', choices: [
    ['a', 'My reaction time when starting and stopping the stopwatch'], ['b', 'Reading the height to the nearest millimetre'], ['c', 'Air resistance on the ball'], ['d', 'The mass of the ball']],
    feedback: { a: 'Yes. Each press is off by a few hundredths of a second, which is a large fraction of a 0.3–0.6 s fall. Long drops and many trials help; an electronic timer helps most.', b: 'A millimetre in a metre is 0.1 %. Your timing scatter is far larger: compare the SD of your times with the times themselves.', c: 'Air barely affects a steel ball over 2 m (under 0.1 %). Your timing scatter is much larger than that.', d: 'In free fall every mass falls the same way when air does not matter. Mass is not the limit here.' } },
  drag: { text: 'With the electronic timer, the ping-pong ball gives a value of g that is too low, and more so for long drops. Why?', correct: 'a', choices: [
    ['a', 'Air resistance slows the light ball, so each fall takes longer than in a vacuum'], ['b', 'Lighter objects fall more slowly, even in a vacuum'], ['c', 'The electronic timer starts late'], ['d', 'The ball bounces before the timer stops']],
    feedback: { a: 'Yes. Drag grows with speed, and a light ball feels it strongly, so long drops are slowed most. That is a systematic error: a heavy ball (or a vacuum) removes it.', b: 'In a vacuum a feather and a hammer fall together. The difference here is the air.', c: 'The timer starts as the magnet releases the ball. If it started late, every time would be short and g would come out high, not low.', d: 'The timer stops at the first touch of the pad, before any bounce.' } },
  height: { text: 'Your electronic timer is good to about a millisecond. What now limits your result most?', correct: 'a', choices: [
    ['a', 'How precisely I read the drop height, and from which point of the ball'], ['b', 'My reaction time'], ['c', 'Air resistance on the steel ball'], ['d', 'The timer only reads to 1 ms']],
    feedback: { a: 'Yes. With good timing, the height reading matters: measuring to the middle of a ball instead of its bottom is off by its radius, a few percent on a short drop. Long drops make that error smaller.', b: 'The electronic timer starts and stops itself, so your reaction time is not involved.', c: 'Over 2 m air changes a steel ball’s fall time by less than 0.1 %.', d: 'One millisecond in a 0.3–0.6 s fall is 0.2–0.3 %, smaller than a careless height reading.' } },
};
function questionFor(key) {
  if (key.includes(TIMER.watch)) return 'watch';
  if (key.startsWith(BALLS.pingpong.name) && env().rho >= 0.5) return 'drag';
  return 'height';
}
let qShown = '';
function renderQuestion(key, a) {
  const form = $('explain-q');
  form.hidden = !a.fit;
  if (!a.fit) return;
  const id = questionFor(key);
  if (id === qShown) return;
  qShown = id;
  const q = QUESTIONS[id];
  $('q-text').textContent = `Explain your result (${key}): ${q.text}`;
  $('q-choices').replaceChildren(...q.choices.map(([v, label]) => { const l = document.createElement('label'), i = document.createElement('input'); Object.assign(i, { type: 'radio', name: 'q', value: v }); l.append(i, document.createTextNode(` ${label}`)); return l; }));
  $('q-feedback').textContent = ''; $('q-feedback').className = 'lb-q-feedback';
}
$('explain-q').addEventListener('submit', e => {
  e.preventDefault();
  const v = new FormData(e.currentTarget).get('q'), q = QUESTIONS[qShown];
  if (!v) { $('q-feedback').textContent = 'Choose an answer first.'; return; }
  $('q-feedback').textContent = `${v === q.correct ? '✓ ' : ''}${q.feedback[v]}`;
  $('q-feedback').className = `lb-q-feedback ${v === q.correct ? 'lb-good' : 'lb-bad'}`;
});

/* ---------- result ---------- */
const BY_NAME = Object.fromEntries(Object.values(BALL_INFO).map(b => [b.name, b]));
/** What a perfect experiment gets with this combination's ball and heights in this air (drag included). */
function idealFor(key) {
  const a = analyse(state.book, key), b = BY_NAME[key.split(' · ')[0]] || BALL_INFO.steel, e = env();
  return idealFitG(a.groups.map(g => g.h), h => fallTime({ g: e.g, ball: b, rho: e.rho }, h));
}
function verdict({ g, d, ideal }, G) {
  const dec = Math.max(2, decFor(d)), lo = g - d, hi = g + d, has = v => lo <= v && v <= hi, near = v => Math.abs(g - v) <= 2 * d;
  const pct = v => ((g - v) / v) * 100, how = v => `${Math.abs(pct(v)).toFixed(Math.abs(pct(v)) < 1 ? 2 : 1)} % ${pct(v) > 0 ? 'high' : 'low'}`;
  const name = state.mode === 'planet' ? 'Your planet’s g' : 'Earth’s g';
  let text = `Your range is ${lo.toFixed(dec)} to ${hi.toFixed(dec)} m/s². ${name} is ${G.toFixed(2)} m/s²`, kind;
  const dragPct = Number.isFinite(ideal) ? ((G - ideal) / G) * 100 : 0, dragMatters = dragPct > 0.05;
  const twice = ' That is normal: about one careful measurement in three lands between one and two uncertainties away, so physicists count anything within 2 × your uncertainty as agreement.';
  if (has(G)) { kind = 'good'; text += ', inside your range: your measurement agrees with it. ✓'; }
  else if (near(G)) { kind = 'good'; text += `, just outside your range (${how(G)}) but within twice your uncertainty: your measurement agrees with it. ✓${twice}`; }
  else if (dragMatters && near(ideal)) {
    kind = 'good';
    text += `, outside your range (${how(G)}). But this air slows your ball: a perfect experiment with your ball and heights would measure ${ideal.toFixed(dec)} m/s², which is ${has(ideal) ? 'inside your range' : 'within twice your uncertainty'}. ✓ The ${dragPct.toFixed(dragPct < 1 ? 2 : 1)} % gap is air drag, a systematic error${dragPct > 2 ? ': a heavier ball would remove most of it' : ''}.`;
  } else {
    kind = 'bad';
    text += `, outside your range: your value is ${how(G)}.`;
    if (dragMatters) text += ` (With this air, a perfect experiment with your ball and heights would measure ${ideal.toFixed(dec)} m/s²; you are ${how(ideal)} from that.)`;
    text += ' Look for a systematic error, or check whether your uncertainty is too small.';
  }
  return { kind, text };
}
$('check').addEventListener('click', () => {
  const g = +$('r-g').value, d = +$('r-dg').value, box = $('result-msg'), { key } = currentCombo();
  box.hidden = false; box.className = 'feedback';
  const bad = msg => { box.textContent = msg; box.classList.add('lb-bad'); };
  if (!(g > 0) || !(d > 0)) return bad('Enter your value of g and its uncertainty (both positive).');
  const pr = key ? progress(state.book, key) : { done: false, fullHeights: 0 };
  const short = `the assignment needs ${MIN.heights} heights with ${MIN.trialsPerHeight} drops each, using one ball and one timer (${key || 'no trials yet'}: ${pr.fullHeights} so far)`;
  const rel = (d / g) * 100, big = rel > 15 ? ` Your uncertainty is large (${rel.toFixed(0)} % of g): more trials, longer drops or the electronic timer would shrink it.` : '';
  if (state.mode === 'planet') {
    if (!state.planet) return bad('Enter your student ID to go to your planet first.');
    if (!pr.done) return bad(`Not yet: ${short}. Finish the measurements, then submit.`);
    state.submitted = { g, d, key, ideal: idealFor(key) }; state.revealed = false;
    box.textContent = `Result recorded: g = ${g} ± ${d} m/s² on ${state.planet.name} (${key}).${big} This is practice, so you can reveal your planet’s g to check it. (In a graded assignment it stays hidden.)`;
    renderMode(); return;
  }
  const v = verdict({ g, d, ideal: key ? idealFor(key) : NaN }, EARTH.g);
  box.textContent = (pr.done ? '' : `Rough check only: ${short}. `) + v.text + big;
  box.classList.add(v.kind === 'good' ? 'lb-good' : 'lb-bad');
});
$('reveal').addEventListener('click', () => {
  if (!state.submitted || !state.planet) return;
  const v = verdict(state.submitted, state.planet.g), box = $('result-msg'), airWords = { none: 'no air', thin: 'thin air', earth: 'Earth-like air' }[state.planet.air];
  state.revealed = true;
  box.textContent = `${v.text} ${state.planet.name} has ${airWords}.`;
  box.className = `feedback ${v.kind === 'good' ? 'lb-good' : 'lb-bad'}`;
  renderMode();
});

/* ---------- controls and checklist ---------- */
function renderControls() {
  const done = { ball: !!state.ball, stick: state.placed.stick, timer: hasTimer() };
  for (const li of document.querySelectorAll('#checklist li')) li.classList.toggle('done', done[li.dataset.item]);
  const planetNeedsId = state.mode === 'planet' && !state.planet;
  $('drop').disabled = !ready() || state.phase !== 'ready' || planetNeedsId;
  $('reset-ball').disabled = state.phase !== 'landed';
  for (const id of ['clamp-up', 'clamp-down']) $(id).disabled = busy();
  const both = state.placed.watch && state.placed.gate;
  $('timer-pick').hidden = !both;
  for (const r of document.querySelectorAll('input[name=timer]')) r.checked = r.value === state.timer;
  $('watch').hidden = !state.placed.watch && state.placed.gate;
  $('watch').setAttribute('aria-disabled', String(!state.placed.watch));
  $('gate').hidden = !state.placed.gate;
  $('watch-toggle').disabled = !state.placed.watch || (!state.watch.running && state.watch.value > 0);
  $('watch-toggle').textContent = state.watch.running ? 'Stop' : 'Start';
  $('watch-toggle').setAttribute('aria-pressed', String(state.watch.running));
  $('watch-reset').disabled = !state.placed.watch || state.watch.running;
  $('record').disabled = !(timeFor() > 0) || state.watch.running || busy() || !$('h-read').value;
  $('bench-status').textContent = planetNeedsId ? 'Enter your student ID' : !ready() ? 'Set up the equipment' : state.phase === 'countdown' ? 'Get ready…' : state.phase === 'falling' ? 'Falling' : state.phase === 'landed' ? 'Landed' : 'Ready to drop';
  const missing = [!state.ball && 'a ball', !state.placed.stick && 'the measuring stick', !hasTimer() && 'a timer (hand stopwatch or electronic timer)'].filter(Boolean);
  const t = timeFor();
  $('bench-msg').textContent = planetNeedsId ? 'Type your student ID above to travel to your planet.'
    : missing.length ? `Still needed: ${missing.join(', ')}.`
    : state.phase === 'ready' ? (t > 0 ? 'Type the height you read and record the trial.' : `Read the height from the magnified stick, then drop the ball${state.timer === 'watch' ? ' and time it' : ''}.`)
    : state.phase === 'landed' ? (t > 0 ? 'Record the trial (the ball returns to the clamp).' : 'Stop the stopwatch, then record the trial.') : '';
  renderShelf();
}
function renderAll() { renderMode(); drawBench(performance.now()); drawLoupe(); renderControls(); renderNotebook(); renderAnalysis(); }

/* ---------- start ---------- */
const startMode = params.get('mode') === 'planet' || store.get('ipl-lab1-mode') === 'planet' ? 'planet' : 'earth';
if (startMode === 'planet') { const id = store.get('ipl-lab1-id') || ''; $('student-id').value = id; setMode('planet', id); }
else setMode('earth');
