/**
 * Lab Bench · Lab 1 (Stage 1, practice mode): find g with a steel ball, a measuring stick and a stopwatch.
 * The student places the equipment, sets the drop height, reads it off the stick, times the fall themselves
 * (their own reaction time is the error) and analyses the notebook. Physics: js/core/freefall-drag.js.
 */
import { fallAt, fallTime, BALLS } from '../../js/core/freefall-drag.js';
import { XYPlot } from '../../js/components/xy-plot.js';
import { downloadCsv } from '../../js/components/csv-export.js';
import { addTrial, deleteTrial, groupByHeight, analyse, progress, notebookCsv, active, MIN } from './notebook-model.js';

const $ = id => document.getElementById(id);
const G = 9.81, BALL = BALLS.steel, R = BALL.diameter / 2;
const S = 260, X0 = 0, Y0 = 590;                 // bench scale: px per metre, pad top
const H_MIN = 0.20, H_MAX = 2.00;
const STORE = 'ipl-lab1-practice';
const f2 = v => v.toFixed(2), f3 = v => v.toFixed(3);
const sig = (v, n = 3) => (Number.isFinite(v) ? (+v.toPrecision(n)).toString() : '–');
const minus = s => String(s).replace('-', '−');

const SHELF = [
  { id: 'ball', name: 'Steel ball', desc: '25.4 mm diameter, 67 g', icon: 'ball' },
  { id: 'stick', name: 'Measuring stick (2 m)', desc: 'Millimetre divisions', icon: 'stick' },
  { id: 'watch', name: 'Hand stopwatch', desc: 'Shows hundredths of a second; you start and stop it', icon: 'watch' },
  { id: 'pingpong', name: 'Ping-pong ball', desc: 'Not used in this practice lab', icon: 'ball2', locked: true },
  { id: 'gate', name: 'Electronic timer', desc: 'Not used in this practice lab', icon: 'gate', locked: true },
];

const state = {
  placed: { ball: false, stick: false, watch: false },
  // A hidden sub-millimetre offset, so clamp steps never land exactly on a millimetre mark.
  h: 1.0 + 0.0005 + Math.round(Math.random() * 40) * 0.0001,
  phase: 'ready',                       // ready | countdown | falling | landed
  release: 0, impact: 0,
  watch: { running: false, start: 0, value: 0 },
  book: load(), view: 't2',
};
function load() { try { const b = JSON.parse(localStorage.getItem(STORE) || '[]'); return Array.isArray(b) ? b.filter(r => r && Number.isFinite(r.h) && Number.isFinite(r.t)) : []; } catch { return []; } }
function save() { try { localStorage.setItem(STORE, JSON.stringify(state.book)); } catch {} }
const ready = () => state.placed.ball && state.placed.stick && state.placed.watch;

/* ---------- shelf ---------- */
const ICONS = {
  ball: '<circle cx="20" cy="20" r="11" fill="#8f9aa3" stroke="#59636b" stroke-width="2"/><circle cx="16" cy="16" r="3" fill="#d6dce0"/>',
  ball2: '<circle cx="20" cy="20" r="12" fill="#f4f1e8" stroke="#c9c2ad" stroke-width="2"/>',
  stick: '<rect x="16" y="3" width="8" height="34" fill="#e9d79a" stroke="#b39a4a"/><path d="M16 8h4M16 13h3M16 18h4M16 23h3M16 28h4M16 33h3" stroke="#6d5a1e"/>',
  watch: '<circle cx="20" cy="22" r="13" fill="#fff" stroke="#3c4a46" stroke-width="2.5"/><rect x="17" y="4" width="6" height="5" rx="1" fill="#3c4a46"/><path d="M20 22V13" stroke="#c24c2a" stroke-width="2.5" stroke-linecap="round"/>',
  gate: '<path d="M8 8h6v24H8zM26 8h6v24h-6z" fill="#cfd6d2"/><path d="M14 20h12" stroke="#c24c2a" stroke-dasharray="2 2"/>',
};
function renderShelf() {
  $('shelf').replaceChildren(...SHELF.map(it => {
    const li = document.createElement('li'); li.className = `lb-item${it.locked ? ' locked' : ''}${state.placed[it.id] ? ' placed' : ''}`;
    li.draggable = !it.locked && !state.placed[it.id]; li.dataset.id = it.id;
    li.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true">${ICONS[it.icon]}</svg><div><strong></strong><span></span></div>`;
    li.querySelector('strong').textContent = it.name; li.querySelector('span').textContent = it.desc;
    if (!it.locked) {
      const b = document.createElement('button'); b.type = 'button';
      b.textContent = state.placed[it.id] ? '✓ On bench · remove' : 'Place on bench';
      b.setAttribute('aria-label', `${state.placed[it.id] ? 'On bench · remove' : 'Place on bench'}: ${it.name}`);   // starts with the visible words (voice control)
      b.disabled = state.phase === 'countdown' || state.phase === 'falling';
      b.addEventListener('click', () => place(it.id, !state.placed[it.id]));
      li.append(b);
      li.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', `lb:${it.id}`); e.dataTransfer.effectAllowed = 'copy'; });
    }
    return li;
  }));
}
function place(id, on) {
  if (state.phase === 'countdown' || state.phase === 'falling') return;
  state.placed[id] = on;
  if (id === 'ball') state.phase = 'ready';
  if (id === 'watch' && !on) resetWatch();
  renderAll();
}
const zone = $('drop-zone');
zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drop-target'); });
zone.addEventListener('dragleave', () => zone.classList.remove('drop-target'));
zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drop-target'); const d = e.dataTransfer.getData('text/plain'); if (d.startsWith('lb:') && state.placed[d.slice(3)] === false) place(d.slice(3), true); });

/* ---------- bench drawing ---------- */
const py = h => Y0 - h * S;                       // height above the pad → svg y
const BALL_X = 236, BALL_PX = 8;                  // the ball is drawn larger than scale; the loupe shows true size
function ballBottom(now = performance.now()) {
  if (state.phase === 'falling') return Math.max(0, state.h - fallAt({ g: G }, (now - state.release) / 1000).y);
  if (state.phase === 'landed') return 0;
  return state.h;
}
function drawBench(now) {
  const top = py(state.h);
  let s = `<rect x="20" y="${Y0 + 8}" width="380" height="14" rx="3" class="lb-benchtop"/>`;
  s += `<rect x="208" y="${Y0}" width="56" height="8" rx="2" class="lb-impact"/><text x="236" y="${Y0 + 38}" class="lb-lab">impact pad</text>`;
  s += `<rect x="70" y="${Y0 + 2}" width="90" height="6" rx="2" class="lb-base"/><rect x="111" y="${py(2.12)}" width="8" height="${Y0 + 2 - py(2.12)}" class="lb-pole"/>`;
  // clamp (always present): arm, jaws, handle
  s += `<g id="clamp" class="lb-clamp" tabindex="0" role="button" aria-label="Release clamp. Use the arrow keys to raise or lower it (Page Up and Page Down for big steps).">`
    + `<rect x="105" y="${top - 2 * BALL_PX - 14}" width="20" height="14" rx="3" class="lb-clamp-block"/><rect x="125" y="${top - 2 * BALL_PX - 10}" width="${BALL_X - 125 - 4}" height="5" class="lb-arm"/>`
    + `<path d="M${BALL_X - 10} ${top - 2 * BALL_PX - 12}h20v6h-20z" class="lb-jaw"/><circle cx="96" cy="${top - 2 * BALL_PX - 7}" r="9" class="lb-handle"/><path d="M92 ${top - 2 * BALL_PX - 9}l4-4 4 4M92 ${top - 2 * BALL_PX - 5}l4 4 4-4" class="lb-handle-arrows"/></g>`;
  if (state.placed.stick) {
    s += `<rect x="270" y="${py(2.02)}" width="20" height="${Y0 - py(2.02)}" class="lb-stick"/>`;
    for (let cm = 0; cm <= 200; cm += 10) { const y = py(cm / 100); s += `<line x1="270" x2="${cm % 50 ? 278 : 284}" y1="${y}" y2="${y}" class="lb-tick"/>${cm % 50 ? '' : `<text x="296" y="${y + 4}" class="lb-stick-lab">${cm / 100} m</text>`}`; }
  }
  if (state.placed.ball) {
    const bb = ballBottom(now), cy = py(bb) - BALL_PX;
    s += `<circle cx="${BALL_X}" cy="${cy}" r="${BALL_PX}" class="lb-ball"/><circle cx="${BALL_X - 3}" cy="${cy - 3}" r="2.5" class="lb-shine"/>`;
    if (state.placed.stick && state.phase === 'ready') s += `<line x1="${BALL_X}" x2="270" y1="${py(bb)}" y2="${py(bb)}" class="lb-sight"/>`;
    if (state.phase === 'landed' && now - state.impact < 350) s += `<circle cx="${BALL_X}" cy="${Y0 - 2}" r="${12 + (now - state.impact) / 20}" class="lb-clack"/>`;
  }
  if (state.placed.watch) s += `<g transform="translate(330 ${Y0 - 30})"><circle r="16" class="lb-watch-icon"/><rect x="-4" y="-22" width="8" height="5" fill="#3c4a46"/><line x1="0" y1="0" x2="0" y2="-10" stroke="#c24c2a" stroke-width="2.5" stroke-linecap="round"/></g>`;
  $('bench').innerHTML = s;
  $('bench').setAttribute('aria-label', `Lab bench. ${state.placed.ball ? (state.phase === 'landed' ? 'The ball is on the impact pad.' : state.phase === 'falling' ? 'The ball is falling.' : 'The steel ball is in the release clamp.') : 'The release clamp is empty.'} ${state.placed.stick ? 'The measuring stick stands beside the drop.' : ''}`);
  bindClamp();
}
function drawLoupe() {
  const show = state.placed.ball && state.placed.stick && state.phase === 'ready';
  $('loupe-wrap').hidden = !show;
  if (!show) return;
  const k = 3250, mid = state.h, yOf = h => 130 - (h - mid) * k;     // 3.25 px per mm, ±4 cm window
  let s = `<rect x="104" y="0" width="56" height="260" class="lb-stick"/>`;
  for (let mm = Math.ceil((mid - 0.042) * 1000); mm <= (mid + 0.042) * 1000; mm++) {
    const y = yOf(mm / 1000), len = mm % 10 === 0 ? 22 : mm % 5 === 0 ? 15 : 9;
    s += `<line x1="104" x2="${104 + len}" y1="${y}" y2="${y}" class="lb-tick"/>`;
    if (mm % 10 === 0) s += `<text x="${132}" y="${y + 4}" class="lb-loupe-num">${mm / 10}</text>`;
  }
  s += `<rect x="140" y="244" width="20" height="16" fill="#efe0a8"/><text x="158" y="256" class="lb-loupe-unit">cm</text>`;
  const bottom = yOf(mid), rr = R * k;
  s += `<clipPath id="lc"><rect x="0" y="0" width="104" height="260"/></clipPath><g clip-path="url(#lc)"><circle cx="54" cy="${bottom - rr}" r="${rr}" class="lb-ball"/></g>`;
  s += `<line x1="20" x2="104" y1="${bottom}" y2="${bottom}" class="lb-sight lb-sight-strong"/>`;
  $('loupe').innerHTML = s;
  $('loupe').setAttribute('aria-label', `Magnified measuring stick. The bottom of the ball is at ${(Math.round(mid * 1000) / 1000).toFixed(3)} metres, to the nearest millimetre.`);
}

/* ---------- clamp height ---------- */
function setHeight(h) {
  if (state.phase === 'countdown' || state.phase === 'falling') return;
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
  c.addEventListener('pointerdown', e => { if (state.phase === 'countdown' || state.phase === 'falling') return; dragging = true; $('bench').setPointerCapture?.(e.pointerId); e.preventDefault(); });
}
$('bench').addEventListener('pointermove', e => {
  if (!dragging) return;
  const m = $('bench').getScreenCTM(); if (!m) return;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  setHeight((Y0 - (p.y + 2 * BALL_PX + 7)) / S);
});
for (const ev of ['pointerup', 'pointercancel']) $('bench').addEventListener(ev, () => { if (dragging) { dragging = false; $('clamp')?.focus(); } });

/* ---------- drop ---------- */
let anim = 0;
function loop(now) {
  if (state.phase === 'falling' && (now - state.release) / 1000 >= state.T) { state.phase = 'landed'; state.impact = state.release + state.T * 1000; }
  if (state.watch.running) $('watch-display').textContent = f2(Math.floor((now - state.watch.start) / 10) / 100);
  drawBench(now);
  if (state.phase === 'falling' || state.phase === 'countdown' || state.watch.running || now - state.impact < 400) anim = requestAnimationFrame(loop);
  else { anim = 0; renderControls(); }
}
const kick = () => { if (!anim) anim = requestAnimationFrame(loop); };
$('drop').addEventListener('click', () => {
  if (!ready() || state.phase !== 'ready') return;
  state.phase = 'countdown'; renderControls();
  const say = t => { $('countdown').textContent = t; $('countdown').classList.toggle('show', !!t); };
  // A steady beat, as lab partners count "3, 2, 1, drop": students can start the stopwatch on the beat,
  // so the start error is small and random. (A random delay would make every start ~0.2 s late.)
  say('3'); setTimeout(() => say('2'), 700); setTimeout(() => say('1'), 1400);
  setTimeout(() => {
    state.T = fallTime({ g: G }, state.h);
    state.release = performance.now(); state.phase = 'falling'; say('Drop!');
    setTimeout(() => say(''), 600);
    renderControls(); kick();
  }, 2100);
  kick();
});
$('reset-ball').addEventListener('click', () => { if (state.phase === 'landed') { state.phase = 'ready'; renderAll(); } });

/* ---------- stopwatch (the student is the timer) ---------- */
function toggleWatch(t = performance.now()) {
  if (!state.placed.watch) return;
  const w = state.watch;
  if (!w.running) { if (w.value > 0) return; w.running = true; w.start = t; kick(); }
  else { w.running = false; w.value = Math.floor((t - w.start) / 10) / 100; $('watch-display').textContent = f2(w.value); }
  renderControls();
}
function resetWatch() { Object.assign(state.watch, { running: false, value: 0 }); $('watch-display').textContent = '0.00'; }
$('watch-toggle').addEventListener('click', e => toggleWatch(performance.now()));
$('watch-reset').addEventListener('click', () => { resetWatch(); renderControls(); });
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' || e.repeat || e.target.closest('input,textarea,select,summary')) return;   // Space is the stopwatch, even on a focused button
  if (!state.placed.watch) return;
  e.preventDefault(); toggleWatch(performance.now());
});

/* ---------- record ---------- */
$('record').addEventListener('click', () => {
  const h = +$('h-read').value, t = state.watch.value;
  if (!(h >= 0.1 && h <= 2.5)) { $('record-msg').textContent = 'Type the height you read off the stick, in metres (for example 1.234).'; $('h-read').focus(); return; }
  if (!(t > 0)) { $('record-msg').textContent = 'Time a drop first: start and stop the stopwatch.'; return; }
  state.book = addTrial(state.book, { object: BALL.name, timer: 'Hand stopwatch', h: Math.round(h * 1000) / 1000, t });
  save();
  $('record-msg').textContent = `Trial ${state.book.at(-1).id} recorded: h = ${f3(h)} m, t = ${f2(t)} s.`;
  resetWatch();
  if (state.phase === 'landed') state.phase = 'ready';
  renderAll();
});
$('h-read').addEventListener('input', renderControls);

/* ---------- notebook ---------- */
function renderNotebook() {
  const rows = state.book;
  $('no-trials').hidden = rows.length > 0;
  $('trial-rows').replaceChildren(...[...rows].reverse().map(r => {
    const tr = document.createElement('tr'); if (r.deleted) tr.className = 'deleted';
    for (const v of [r.id, r.object, r.timer, f3(r.h), f2(r.t)]) { const td = document.createElement('td'); td.textContent = v; tr.append(td); }
    const td = document.createElement('td'), b = document.createElement('button'); b.type = 'button';
    b.textContent = r.deleted ? 'Undo' : '✕'; b.setAttribute('aria-label', `${r.deleted ? 'Restore' : 'Delete'} trial ${r.id}`);
    b.addEventListener('click', () => { state.book = deleteTrial(state.book, r.id, 'deleted by student'); save(); renderAll(); });
    td.append(b); tr.append(td); return tr;
  }));
  const groups = groupByHeight(rows);
  $('group-rows').replaceChildren(...groups.map(g => {
    const tr = document.createElement('tr');
    for (const v of [f3(g.h), g.n, f3(g.tMean), sig(g.tSD, 2), sig(g.tSE, 2), sig(g.gEach, 3)]) { const td = document.createElement('td'); td.textContent = v; tr.append(td); }
    if (g.n >= MIN.trialsPerHeight) tr.className = 'full';
    return tr;
  }));
  const p = progress(rows);
  $('progress').textContent = p.done ? `✓ ${p.fullHeights} heights with ${MIN.trialsPerHeight}+ trials` : `${p.fullHeights} of ${MIN.heights} heights done (${MIN.trialsPerHeight}+ trials each)`;
  const g2 = groups.find(g => g.n >= 2);
  $('explain-stats').hidden = !g2;
  if (g2) $('explain-stats-body').innerHTML = `<p>At h = ${f3(g2.h)} m you timed ${g2.n} drops. Their <b>mean</b> is ${f3(g2.tMean)} s: your best single estimate of the fall time.</p>`
    + `<p>The <b>standard deviation</b> (SD = ${sig(g2.tSD, 2)} s) is the typical scatter of one trial about the mean. With a hand stopwatch most of it is your reaction time.</p>`
    + `<p>The <b>standard error</b> (SE = SD/√n = ${sig(g2.tSD, 2)}/√${g2.n} = ${sig(g2.tSE, 2)} s) is how well you know the <i>mean</i>. It shrinks as you add trials: four times as many trials halves it.</p>`;
}
$('csv').addEventListener('click', () => downloadCsv(notebookCsv(state.book), 'lab1-find-g-notebook.csv'));
$('clear-nb').addEventListener('click', e => {
  const b = e.currentTarget;
  if (!state.book.length) return;
  if (b.dataset.armed) { state.book = []; save(); delete b.dataset.armed; b.textContent = 'Clear notebook'; renderAll(); return; }
  b.dataset.armed = '1'; b.textContent = 'Click again to clear all trials';
  setTimeout(() => { delete b.dataset.armed; b.textContent = 'Clear notebook'; }, 4000);
});

/* ---------- graph and fit ---------- */
const plot = new XYPlot($('graph'), { width: 460, height: 280, title: '', xLabel: 'drop height h (m)', yLabel: '' });
for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', () => {
  state.view = b.dataset.view;
  for (const x of document.querySelectorAll('[data-view]')) x.setAttribute('aria-pressed', String(x === b));
  renderAnalysis();
});
function renderAnalysis() {
  const a = analyse(state.book), groups = a.groups, t2 = state.view === 't2';
  const pts = active(state.book), hMax = Math.max(1, ...pts.map(r => r.h)) * 1.1;
  const yv = r => (t2 ? r.t * r.t : r.t), yMax = Math.max(t2 ? 0.25 : 0.5, ...pts.map(yv)) * 1.15;
  plot.title = t2 ? 'Fall time squared against height' : 'Fall time against height';
  plot.yLabel = t2 ? 't² (s²)' : 't (s)';
  const series = [];
  if (a.fit) {
    const line = []; for (let i = 0; i <= 60; i++) { const h = (hMax * i) / 60; const ts = a.fit.intercept + a.fit.slope * h; line.push([h, t2 ? ts : Math.sqrt(Math.max(0, ts))]); }
    series.push({ points: line, color: '#1f6b5e', width: 2.2, legend: t2 ? 'best-fit line' : 'from the fit' });
  }
  const markers = [
    ...pts.map(r => ({ x: r.h, y: yv(r), color: '#9aa7a2', r: 2.6 })),
    ...groups.map(g => ({ x: g.h, y: t2 ? g.tMean ** 2 : g.tMean, ey: Number.isFinite(g.tSE) ? (t2 ? 2 * g.tMean * g.tSE : g.tSE) : 0, color: '#c27b22', r: 4.5 })),
  ];
  plot.render({ x: [0, hMax], y: [0, yMax], series, markers, note: pts.length ? '' : 'record trials to see them here' });
  $('graph').setAttribute('aria-label', `${plot.title}. ${pts.length} trials at ${groups.length} heights.${a.fit ? ` Fit gives g = ${sig(a.g)} ± ${sig(a.gSE, 2)} metres per second squared.` : ''}`);
  $('graph-note').textContent = a.error || (t2 ? 'Grey dots: single trials. Orange: the mean at each height, with ± its standard error. Green: the least-squares line.' : 'Plotted against h, the times curve (t ∝ √h), so a straight line cannot be fitted directly. That is why the t² graph is used.');
  $('fit-table').hidden = !a.fit;
  $('explain-fit').hidden = !a.fit;
  if (a.fit) {
    $('f-slope').textContent = `${sig(a.fit.slope, 3)} ± ${sig(a.fit.slopeSE, 2)} s²/m`;
    $('f-int').textContent = `${minus(sig(a.fit.intercept, 2))} ± ${sig(a.fit.interceptSE, 2)} s²`;
    $('f-g').textContent = `${sig(a.g, 3)} ± ${sig(a.gSE, 2)} m/s²`;
    $('explain-fit-body').innerHTML = `<p>For a drop from rest, h = ½ g t², so <b>t² = (2/g) h</b>. Plotting t² against h gives a straight line through the origin with <b>slope 2/g</b>, so <b>g = 2 / slope</b>. Your slope ${sig(a.fit.slope, 3)} s²/m gives g = 2 / ${sig(a.fit.slope, 3)} = ${sig(a.g, 3)} m/s².</p>`
      + `<p>The ± on the slope comes from how far your points scatter about the line. It carries over to g: δg = 2 δslope / slope² = ${sig(a.gSE, 2)} m/s².</p>`
      + `<p><b>Why t² on the vertical axis?</b> A least-squares fit assumes the error is in the vertical quantity. Your stopwatch times are much less precise than your height readings, so time belongs on the vertical axis. (Fitting h against t² instead would pull g low.)</p>`
      + `<p>The intercept should be close to zero. ${Math.abs(a.fit.intercept) > 2 * a.fit.interceptSE ? `Yours (${minus(sig(a.fit.intercept, 2))} s²) is not: a ${a.fit.intercept > 0 ? 'positive' : 'negative'} intercept often means the stopwatch ran ${a.fit.intercept > 0 ? 'long (started early or stopped late)' : 'short (started late or stopped early)'} by about the same amount every time. A timing offset δ adds 2δt + δ² to every t², and because 2δt grows with height it also tilts the line a little, so it biases g as well as the intercept. That is a systematic error: more trials will not remove it, a better timer will.` : 'Yours is, within its uncertainty.'}</p>`;
  }
  // report explainer, using the student's own fit when there is one
  const ex = a.fit ? { g: a.g, d: a.gSE } : { g: 9.7234, d: 0.2871 };
  const d1 = +ex.d.toPrecision(1), dec = Math.max(0, -Math.floor(Math.log10(d1)));
  $('explain-report').innerHTML = `<p>Round the uncertainty to <b>1 or 2 significant figures</b>, then round the value to the <b>same decimal place</b>. ${a.fit ? 'Your fit gives' : 'For example,'} ${sig(ex.g, 5)} ± ${sig(ex.d, 4)} m/s² → <b>${ex.g.toFixed(dec)} ± ${d1.toFixed(dec)} m/s²</b>.</p>`
    + `<p>Then ask: <b>does my range include the expected value?</b> If it does, your measurement agrees with it.</p>`
    + `<p><b>Random error</b> scatters results both ways (your reaction time varies); more trials reduce its effect. <b>Systematic error</b> pushes every result the same way (for example, always stopping late, or measuring to the middle of the ball). More trials do not remove it; a better method does.</p>`;
}

/* ---------- result ---------- */
$('check').addEventListener('click', () => {
  const g = +$('r-g').value, d = +$('r-dg').value, box = $('result-msg');
  box.hidden = false; box.className = 'feedback';
  if (!(g > 0) || !(d > 0)) { box.textContent = 'Enter your value of g and its uncertainty (both positive).'; box.classList.add('lb-bad'); return; }
  const lo = g - d, hi = g + d, inside = lo <= G && G <= hi, pct = ((g - G) / G) * 100;
  const rel = (d / g) * 100;
  let msg = `Your range is ${lo.toFixed(2)} to ${hi.toFixed(2)} m/s². Earth’s g is ${G} m/s², ${inside ? 'inside your range: your measurement agrees with it. ✓' : `outside your range: your value is ${Math.abs(pct).toFixed(1)} % ${pct > 0 ? 'high' : 'low'}. Look for a systematic error, or check whether your uncertainty is too small.`}`;
  if (rel > 15) msg += ` Your uncertainty is large (${rel.toFixed(0)} % of g): more trials, or longer drops, would shrink it.`;
  box.textContent = msg; box.classList.toggle('lb-good', inside); box.classList.toggle('lb-bad', !inside);
});

/* ---------- controls and checklist ---------- */
function renderControls() {
  const busy = state.phase === 'countdown' || state.phase === 'falling';
  for (const li of document.querySelectorAll('#checklist li')) li.classList.toggle('done', state.placed[li.dataset.item]);
  $('drop').disabled = !ready() || state.phase !== 'ready';
  $('reset-ball').disabled = state.phase !== 'landed';
  for (const id of ['clamp-up', 'clamp-down']) $(id).disabled = busy;
  $('watch').setAttribute('aria-disabled', String(!state.placed.watch));
  $('watch-toggle').disabled = !state.placed.watch || (!state.watch.running && state.watch.value > 0);
  $('watch-toggle').textContent = state.watch.running ? 'Stop' : 'Start';
  $('watch-toggle').setAttribute('aria-pressed', String(state.watch.running));
  $('watch-reset').disabled = !state.placed.watch || state.watch.running;
  $('record').disabled = !(state.watch.value > 0) || state.watch.running || !$('h-read').value;
  $('bench-status').textContent = !ready() ? 'Set up the equipment' : state.phase === 'countdown' ? 'Get ready…' : state.phase === 'falling' ? 'Falling' : state.phase === 'landed' ? 'Landed' : 'Ready to drop';
  $('bench-msg').textContent = !ready() ? `Still needed: ${SHELF.filter(i => !i.locked && !state.placed[i.id]).map(i => i.name.toLowerCase()).join(', ')}.`
    : state.phase === 'ready' ? (state.watch.value > 0 ? 'Type the height you read and record the trial, or reset the stopwatch.' : 'Read the height from the magnified stick, then drop the ball and time it.')
    : state.phase === 'landed' ? (state.watch.value > 0 ? 'Record the trial (the ball returns to the clamp).' : 'Stop the stopwatch, then record the trial.') : '';
  renderShelf();
}
function renderAll() { drawBench(performance.now()); drawLoupe(); renderControls(); renderNotebook(); renderAnalysis(); }
renderAll();
