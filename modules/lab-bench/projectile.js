/**
 * Lab Bench · Lab 2: find g from a projectile, by video analysis the student does by hand.
 * The student sets the launcher (angle, spring) and the camera (frame rate; with the parallax trap on, where the metre
 * stick stands), fires, then calibrates the video (stick ends, origin), marks the ball frame by frame, works out the
 * first three vy values, chooses a model for each graph and fits it. The page never shows g.
 * Physics and camera: js/core/projectile.js. Analysis: projectile-model.js. Grading: grading-projectile.js.
 */
import { flight, frames, inView, project, pxPerM, SPRING, FPS, MUZZLE, CAMERA, STICK_PLACES, STICK_LENGTH, BALL } from '../../js/core/projectile.js';
import { planetFor, normaliseId, PRACTICE_CODE, rng, hash32 } from '../../js/core/lab-noise.js';
import { AIR } from '../../js/core/freefall-drag.js';
import { XYPlot } from '../../js/components/xy-plot.js';
import { downloadCsv } from '../../js/components/csv-export.js';
import { points, allPoints, setExcluded, reasonOk, excludedCount, shown, velPoints, handStatus, fitGraph, summary, progress as progressOf, scaleOf, calibrated, HAND_VY, MIN_DEFAULT, MODELS } from './projectile-model.js';
import { parseProjectileAssignment, encodeProjectile, questionFor2, CORRECT2, idealG } from './grading-projectile.js';
import { assignmentPlanet } from './grading.js';

const $ = id => document.getElementById(id);
const EARTH = { g: 9.81, rho: AIR.earth, air: 'earth' };
const ASG = parseProjectileAssignment(location.search);
const CODE = ASG ? ASG.code : PRACTICE_CODE;
const MIN = ASG ? { launches: ASG.launches, points: ASG.points } : MIN_DEFAULT;
const sig = (v, n = 3) => (!Number.isFinite(v) ? '–' : Math.abs(v) < 5e-7 ? '0' : (+v.toPrecision(n)).toString());
const minus = s => String(s).replace(/-/g, '−');
const decFor = d => Math.min(6, Math.max(0, 1 - Math.floor(Math.log10(d))));
const pm = (v, d) => (d > 0 && Number.isFinite(d) ? `${minus(v.toFixed(decFor(d)))} ± ${d.toFixed(decFor(d))}` : `${minus(sig(v, 3))} ± –`);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ---------- state and storage ---------- */
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const state = { mode: 'earth', planet: null, launches: [], cur: -1, pendingOut: null, pendingFor: null, tool: 'scale', frame: 0, cursor: { u: 400, v: 280 }, firing: false, submitted: null, revealed: false };
const env = () => (state.mode === 'planet' && state.planet ? state.planet : EARTH);
const bookKey = () => (state.mode === 'planet' && state.planet ? `ipl-lab2-planet-${state.planet.id}-${state.planet.code}` : 'ipl-lab2-earth');
const launch = () => state.launches[state.cur] ?? null;
function loadBook() {
  try { const b = JSON.parse(store.get(bookKey()) || '[]'); return Array.isArray(b) ? b.filter(l => l && SPRING[l.spring - 1] && FPS.includes(l.fps)) : []; } catch { return []; }
}
const save = () => store.set(bookKey(), JSON.stringify(state.launches));
const flightOf = l => flight({ g: env().g, rho: env().rho }, { angle: l.angle, speed: SPRING[l.spring - 1] });
const cache = new Map();   // video frames per launch id
function video(l) {
  const k = `${bookKey()}|${l.id}|${l.angle}|${l.spring}|${l.fps}|${l.phase}`;   // ids can be reused after a delete
  if (!cache.has(k)) { const fl = flightOf(l); cache.set(k, { fl, frames: frames(fl, l.fps, l.phase) }); }
  return cache.get(k);
}

/* ---------- mode ---------- */
function setMode(mode, id = '') {
  if (state.firing) return;
  if (mode === 'planet') {
    const nid = normaliseId(id);
    state.mode = 'planet'; state.planet = nid ? (ASG ? assignmentPlanet(nid, ASG) : planetFor(nid, CODE)) : null;
    if (nid) store.set('ipl-lab2-id', nid);
  } else { state.mode = 'earth'; state.planet = null; }
  state.launches = loadBook(); state.cur = state.launches.length - 1; state.frame = 0; state.submitted = null; state.revealed = false;
  const lastCode = ASG && state.mode === 'planet' && state.planet ? store.get(`${bookKey()}-code`) : null;
  if (lastCode) state.submitted = { code: lastCode };
  $('result-msg').hidden = true; $('r-g').value = ''; $('r-dg').value = '';
  pickTool(defaultTool());
  renderAll();
}
for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode, b.dataset.mode === 'planet' ? store.get('ipl-lab2-id') || '' : ''));
$('planet-form').addEventListener('submit', e => { e.preventDefault(); const id = $('student-id').value; if (!normaliseId(id)) { $('student-id').focus(); return; } setMode('planet', id); });
function renderMode() {
  const p = state.planet, planet = state.mode === 'planet';
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
  $('planet-form').hidden = !planet || !!p;
  $('planet-status').hidden = !planet || !p;
  if (p) $('planet-status').innerHTML = `<b>${p.name}</b> for student ID <b>${p.id}</b>. Its gravity is hidden: measure it. <button type="button" id="change-id" class="lb-link-btn">Change ID</button>`;
  $('change-id')?.addEventListener('click', () => { state.planet = null; $('student-id').value = ''; renderAll(); $('student-id').focus(); });
  $('mode-tag').innerHTML = `<span aria-hidden="true">●</span> ${planet ? (p ? `Mystery planet · ${p.name}` : 'Mystery planet') : 'Practice · Earth'}`;
  $('check').textContent = planet ? 'Submit my result' : 'Compare with Earth’s g';
  $('reveal').hidden = !!ASG || !planet || !state.submitted || state.revealed;
  $('completion').hidden = !(ASG && planet && state.submitted?.code);
  if (ASG && planet && state.submitted?.code) $('completion-code').textContent = state.submitted.code;
  $('nb-where').textContent = planet ? (p ? `· ${p.name}` : '') : '· Earth';
  $('need-launches').textContent = MIN.launches; $('need-points').textContent = MIN.points;
  $('graded-banner').hidden = !ASG;
  if (ASG) $('graded-banner').innerHTML = `<b>Graded assignment “${ASG.code}”.</b> Choose <b>Mystery planet</b> and enter your student ID: your planet’s g stays hidden. Make at least <b>${MIN.launches} launches</b> with different settings, track <b>${MIN.points}+ frames</b> of each (in the fit), fit all four graphs, answer the question (your first answer counts), then submit to get a completion code for Canvas.`;
  $('stick-fields').hidden = !ASG?.parallax; $('stick-fixed').hidden = !!ASG?.parallax;
  $('footnote').textContent = planet && ASG
    ? `Graded assignment “${ASG.code}”. Your planet comes from your student ID and this assignment. Your notebook stays in this browser; only the completion code you paste into Canvas is graded. Use the same student ID you use in Canvas.`
    : planet ? 'Mystery planet: gravity between 3 and 20 m/s², chosen by your student ID. The flight is exact (air drag on this steel ball is tiny); the errors are in your clicks and your calibration. Nothing is sent anywhere; your notebook stays in this browser.'
    : 'Practice mode: Earth, g = 9.81 m/s². The flight is exact (air drag on this 40 mm steel ball changes g by under 0.1 %); the errors are in your clicks and your calibration. Nothing is sent anywhere; your notebook stays in this browser.';
}

/* ---------- 1. set up and fire ---------- */
const setup = () => ({ angle: +$('angle').value, spring: +$('spring').value, fps: +$('fps').value, stick: ASG?.parallax ? (document.querySelector('[name=stick]:checked')?.value || 'front') : 'plane' });
for (const id of ['angle', 'spring']) $(id).addEventListener('input', () => { $('angle-out').value = `${$('angle').value}°`; $('spring-out').value = $('spring').value; drawFrame(); });
$('fps').addEventListener('change', drawFrame);
for (const r of document.querySelectorAll('[name=stick]')) r.addEventListener('change', drawFrame);
$('fire').addEventListener('click', fire);
function fire() {
  if (state.firing) return;
  if (state.mode === 'planet' && !state.planet) { $('fire-msg').textContent = 'Enter your student ID to go to your planet first.'; $('student-id').focus(); return; }
  const s = setup(), fl = flight({ g: env().g, rho: env().rho }, { angle: s.angle, speed: SPRING[s.spring - 1] });
  state.firing = true; renderControls();
  const t0 = performance.now(), slow = 1, end = fl.T + 0.4;
  $('tool-status').textContent = '● Recording';
  const step = now => {
    const t = ((now - t0) / 1000) / slow - 0.15;
    drawLive(s, t < 0 ? null : fl.at(Math.min(t, fl.T)));
    if (t < end) requestAnimationFrame(step); else done();
  };
  const done = () => {
    state.firing = false;
    if (!inView(fl)) {
      $('fire-msg').textContent = 'The ball left the camera’s picture, so this video cannot be used. Use a softer spring or a different angle, and fire again.';
      $('fire-msg').className = 'help lb-bad-text'; renderAll(); return;
    }
    const prev = state.launches.at(-1), id = (prev?.id ?? 0) + 1;
    const l = { id, ...s, phase: Math.random() / s.fps, cal: null, origin: null, clicks: {}, hand: [], models: {}, note: '', myG: '' };
    // The camera and stick have not moved since the last launch with the same stick place: its calibration still holds.
    const same = [...state.launches].reverse().find(x => x.stick === s.stick && x.cal && x.origin);
    if (same) { l.cal = structuredClone(same.cal); l.origin = structuredClone(same.origin); }
    state.launches.push(l); state.cur = state.launches.length - 1; save();
    const v = video(l), nIn = v.frames.filter(f => f.inFlight).length;
    state.frame = Math.max(0, v.frames.findIndex(f => f.inFlight) - 1);
    $('fire-msg').className = 'help';
    $('fire-msg').textContent = `Launch ${id} filmed: ${v.frames.length} frames, ${nIn} with the ball in flight.${nIn < MIN.points ? ` That is fewer than the ${MIN.points} points you need: try a higher frame rate or a longer flight.` : ''}${same ? ` The camera and stick have not moved, so the calibration from launch ${same.id} carries over (check it).` : ''}`;
    pickTool(same ? 'track' : 'scale');
    renderAll();
  };
  requestAnimationFrame(step);
}

/* ---------- the video frame ---------- */
const ballR = pxPerM() * BALL.diameter / 2;
function sceneMarkup(s) {
  const floor = project(0, 0).v, wallTop = 0;
  let m = `<defs><linearGradient id="pj-wall" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e8ece4"/><stop offset="1" stop-color="#d9dfd5"/></linearGradient></defs>`;
  m += `<rect x="0" y="${wallTop}" width="${CAMERA.W}" height="${floor}" fill="url(#pj-wall)"/>`;
  for (let u = 40; u < CAMERA.W; u += 120) m += `<path d="M${u} 0V${floor}" stroke="#cfd6cc" stroke-width="1"/>`;
  m += `<rect x="0" y="${floor}" width="${CAMERA.W}" height="${CAMERA.H - floor}" fill="#b9ad97"/><path d="M0 ${floor}H${CAMERA.W}" stroke="#8e8370" stroke-width="2"/>`;
  // launcher: a stand and a barrel along the launch angle, its muzzle at MUZZLE
  const mz = project(MUZZLE.x, MUZZLE.y), th = (s.angle * Math.PI) / 180, len = 0.20 * pxPerM();
  const back = { u: mz.u - len * Math.cos(th), v: mz.v + len * Math.sin(th) };
  m += `<path d="M${back.u - 10} ${floor}L${back.u + 4} ${back.v + 6}L${back.u + 18} ${floor}Z" fill="#59636b"/>`;
  m += `<path d="M${back.u} ${back.v}L${mz.u} ${mz.v}" stroke="#2f3a3a" stroke-width="13" stroke-linecap="round"/><path d="M${back.u} ${back.v}L${mz.u} ${mz.v}" stroke="#4f5c5c" stroke-width="8" stroke-linecap="round"/>`;
  // metre stick, 10 bands of 10 cm, at its place (the front edge stands on a block on the bench edge)
  const sp = STICK_PLACES[s.stick], z = sp.z, bot = project(sp.x, sp.y, z), top = project(sp.x, sp.y + STICK_LENGTH, z), w = 0.03 * pxPerM(z);
  if (s.stick === 'front') { const b0 = project(sp.x, 0, z); m += `<rect x="${b0.u - 1.5 * w}" y="${bot.v}" width="${3 * w}" height="${CAMERA.H - bot.v}" fill="#8b6a3e"/>`; }
  for (let i = 0; i < 10; i++) { const a = project(sp.x, sp.y + i * 0.1, z), b = project(sp.x, sp.y + (i + 1) * 0.1, z); m += `<rect x="${a.u - w / 2}" y="${b.v}" width="${w}" height="${a.v - b.v}" fill="${i % 2 ? '#f2d24a' : '#2b2b2b'}"/>`; }
  m += `<rect x="${bot.u - w / 2}" y="${top.v}" width="${w}" height="${bot.v - top.v}" fill="none" stroke="#1f1f1f" stroke-width="0.8"/>`;
  return m;
}
const ballMarkup = (u, v) => `<circle cx="${u}" cy="${v}" r="${ballR}" class="pj-ball"/><circle cx="${u - ballR * 0.35}" cy="${v - ballR * 0.35}" r="${ballR * 0.35}" fill="#e8edf0"/>`;
function drawLive(s, p) {
  let m = sceneMarkup(s);
  if (p) { const { u, v } = project(p.x, p.y); m += ballMarkup(u, v); }
  else { const { u, v } = project(MUZZLE.x, MUZZLE.y); m += ballMarkup(u, v); }
  m += `<text x="14" y="26" class="pj-rec">● REC</text>`;
  $('frame').innerHTML = m; $('loupe').innerHTML = '';
}
function overlay(l) {
  let m = '';
  const s = scaleOf(l.cal);
  if (l.cal?.a) {
    const { a, b } = l.cal;
    m += `<circle cx="${a.u}" cy="${a.v}" r="5" class="pj-cal-end"/>`;
    if (b) m += `<path d="M${a.u} ${a.v}L${b.u} ${b.v}" class="pj-cal"/><circle cx="${b.u}" cy="${b.v}" r="5" class="pj-cal-end"/><text x="${Math.max(a.u, b.u) - 70}" y="${(a.v + b.v) / 2}" class="pj-cal-label">1.000 m</text>`;
  }
  if (l.origin) {
    const o = l.origin;
    m += `<path d="M${o.u} ${o.v}H${o.u + 70}M${o.u} ${o.v}V${o.v - 70}" class="pj-axes"/><path d="M${o.u + 70} ${o.v}l-8 -4v8zM${o.u} ${o.v - 70}l-4 8h8z" class="pj-axes-tip"/><text x="${o.u + 74}" y="${o.v + 4}" class="pj-axes-label">x</text><text x="${o.u - 4}" y="${o.v - 76}" class="pj-axes-label">y</text>`;
  }
  const f = video(l).frames[state.frame];
  for (const [n, c] of Object.entries(l.clicks)) {
    const here = +n === f?.n;
    m += `<path d="M${c.u - 4} ${c.v - 4}L${c.u + 4} ${c.v + 4}M${c.u - 4} ${c.v + 4}L${c.u + 4} ${c.v - 4}" class="pj-mark${here ? ' pj-mark-here' : ''}${l.excluded?.[n] != null ? ' pj-mark-out' : ''}"/>`;
  }
  if (!Number.isFinite(s) && l.cal?.a && !l.cal.b) m += '';
  return m;
}
function drawFrame() {
  const l = launch();
  if (state.firing) return;
  if (!l) { drawLive(setup(), null); $('frame').querySelector('.pj-rec')?.remove(); $('loupe').innerHTML = ''; return; }
  const v = video(l), f = v.frames[state.frame];
  let m = sceneMarkup(l);
  const { u, v: vv } = project(f.x, f.y); m += ballMarkup(u, vv);
  m += `<text x="${CAMERA.W - 14}" y="26" class="pj-stamp" text-anchor="end">frame ${f.n} · t = ${f.t.toFixed(4)} s</text>`;
  const base = m;
  m += overlay(l);
  const c = state.cursor;
  m += `<g class="pj-cross"><path d="M${c.u - 14} ${c.v}H${c.u - 3}M${c.u + 3} ${c.v}H${c.u + 14}M${c.u} ${c.v - 14}V${c.v - 3}M${c.u} ${c.v + 3}V${c.v + 14}"/></g>`;
  $('frame').innerHTML = m;
  $('loupe').innerHTML = `${base}${overlay(l)}<path d="M${c.u - 3} ${c.v}H${c.u + 3}M${c.u} ${c.v - 3}V${c.v + 3}" class="pj-loupe-cross"/>`;
  $('loupe').setAttribute('viewBox', `${c.u - 15} ${c.v - 15} 30 30`);
  $('frame-label').textContent = `Frame ${f.n} of ${v.frames.length - 1} · t = ${f.t.toFixed(4)} s${l.clicks[f.n] ? (l.excluded?.[f.n] != null ? ' · marked, left out of the fit' : ' · marked') : ''}`;
  $('frame').setAttribute('aria-label', `Launch ${l.id}, frame ${f.n}, t = ${f.t.toFixed(4)} seconds. Cross-hair at ${Math.round(c.u)}, ${Math.round(c.v)} pixels. ${TOOL_HELP[state.tool](l)}`);
}

/* ---------- tools: scale, origin, track ---------- */
const TOOL_HELP = {
  scale: l => (!l.cal?.a ? 'Set the scale: click the bottom end of the metre stick (the first black band starts there).' : !l.cal.b ? 'Now click the top end of the metre stick.' : `Scale set: the stick is ${Math.hypot(l.cal.b.u - l.cal.a.u, l.cal.b.v - l.cal.a.v).toFixed(1)} pixels long. Click again to redo it, or set the origin next.`),
  origin: l => (l.origin ? 'Origin set (x to the right, y up). Click again to move it, or start marking the ball.' : 'Set the origin: click where you want x = 0, y = 0. The launcher’s muzzle is a good choice. x points right and y points up.'),
  track: l => (!calibrated(l) ? 'Set the scale and the origin first: without them the marks cannot be turned into metres.' : 'Click the centre of the ball. The next frame comes up after each mark. Skip frames where the ball has not left the launcher yet or has landed.'),
};
const defaultTool = () => { const l = launch(); return !l ? 'scale' : !l.cal?.b ? 'scale' : !l.origin ? 'origin' : 'track'; };
function pickTool(t) { state.tool = t; for (const b of document.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === t)); }
for (const b of document.querySelectorAll('[data-tool]')) b.addEventListener('click', () => { pickTool(b.dataset.tool); renderVideo(); $('frame').focus({ preventScroll: true }); });
function applyTool(at) {
  const l = launch();
  if (!l || state.firing) return;
  const p = { u: +at.u.toFixed(1), v: +at.v.toFixed(1) };
  if (state.tool === 'scale') { l.cal = !l.cal?.a || l.cal.b ? { a: p, b: null } : { ...l.cal, b: p }; if (l.cal.b && !l.origin) pickTool('origin'); }
  else if (state.tool === 'origin') { l.origin = p; pickTool('track'); }
  else {
    if (!calibrated(l)) return renderVideo();
    const n = video(l).frames[state.frame].n;
    l.clicks[n] = p; setExcluded(l, n, null);   // a fresh mark goes back into the fit
    if ($('auto-next').checked) stepFrame(1, false);
  }
  save(); renderAll();
}
function svgPoint(e) {
  const svg = $('frame'), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const q = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { u: clamp(q.x, 0, CAMERA.W), v: clamp(q.y, 0, CAMERA.H) };
}
$('frame').addEventListener('pointermove', e => { if (!launch()) return; state.cursor = svgPoint(e); drawFrame(); });
$('frame').addEventListener('click', e => { if (!launch()) return; state.cursor = svgPoint(e); applyTool(state.cursor); });
$('frame').addEventListener('keydown', e => {
  if (!launch()) return;
  const big = e.shiftKey ? 10 : 1, moves = { ArrowLeft: [-big, 0], ArrowRight: [big, 0], ArrowUp: [0, -big], ArrowDown: [0, big] };
  if (moves[e.key]) { e.preventDefault(); state.cursor = { u: clamp(state.cursor.u + moves[e.key][0], 0, CAMERA.W), v: clamp(state.cursor.v + moves[e.key][1], 0, CAMERA.H) }; drawFrame(); }
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyTool(state.cursor); }
  else if (e.key === ',' || e.key === '<') { e.preventDefault(); stepFrame(-1); }
  else if (e.key === '.' || e.key === '>') { e.preventDefault(); stepFrame(1); }
});
function stepFrame(d, render = true) {
  const l = launch(); if (!l) return;
  state.frame = clamp(state.frame + d, 0, video(l).frames.length - 1);
  if (render) renderVideo();
}
/** Show a marked frame in the video, ready to mark it again. */
function goToFrame(n) {
  const l = launch(); if (!l) return;
  const i = video(l).frames.findIndex(f => f.n === n); if (i < 0) return;
  state.frame = i; if (calibrated(l)) pickTool('track');
  renderVideo();
  $('video-title').scrollIntoView({ block: 'start', behavior: 'smooth' });
  $('frame').focus({ preventScroll: true });
}
$('prev-frame').addEventListener('click', () => stepFrame(-1));
$('next-frame').addEventListener('click', () => stepFrame(1));
$('first-frame').addEventListener('click', () => { state.frame = 0; renderVideo(); });
$('unmark').addEventListener('click', () => { const l = launch(); if (!l) return; const n = video(l).frames[state.frame].n; delete l.clicks[n]; setExcluded(l, n, null); save(); renderAll(); });

function renderVideo() {
  const l = launch();
  $('video-which').textContent = l ? `· launch ${l.id} (${l.angle}°, spring ${l.spring}, ${l.fps} fps)` : '';
  $('tool-help').textContent = l ? TOOL_HELP[state.tool](l) : 'Fire a launch to get a video.';
  $('tool-status').textContent = !l ? 'No video yet' : !l.cal?.b ? 'Not calibrated' : !l.origin ? 'Scale set' : `${Object.keys(l.clicks).length} marks`;
  for (const id of ['prev-frame', 'next-frame', 'first-frame']) $(id).disabled = !l || state.firing;
  for (const b of document.querySelectorAll('[data-tool]')) b.disabled = !l || state.firing;
  $('unmark').disabled = !l || !l.clicks[video(l).frames[state.frame]?.n];
  drawFrame();
}

/* ---------- 3. data table and hand-worked vy ---------- */
function renderData() {
  const l = launch(), all = l ? allPoints(l) : [], pts = all.filter(p => !p.out), vs = velPoints(pts), hs = l ? handStatus(l) : { marks: [], done: false };
  const nOut = all.length - pts.length;
  $('data-count').textContent = `${pts.length} ${pts.length === 1 ? 'point' : 'points'}${nOut ? ` in the fit · ${nOut} left out` : ''}`;
  if (state.pendingFor !== l?.id) state.pendingOut = null;
  if (state.pendingOut != null && !all.some(p => p.n === state.pendingOut && !p.out)) state.pendingOut = null;
  // Two marks in the same place usually mean frames before launch: a ball sitting in the launcher bends the fit.
  const still = vs.filter(v => Math.abs(v.dx) < 0.002 && Math.abs(v.dy) < 0.002).map(v => `${v.from.n}→${v.to.n}`);
  $('data-help').innerHTML = !l ? 'Fire a launch, calibrate the video, then mark the ball: each mark adds a row.'
    : !calibrated(l) ? 'Set the scale and the origin to turn your marks into metres.'
    : pts.length < HAND_VY + 1 ? `Mark the ball on at least ${HAND_VY + 1} frames to work out the velocities.`
    : still.length ? `The ball did not move between frames ${still.join(', ')}: it had probably not left the launcher yet. Leave those marks out of the fit (untick <b>fit</b>) or remove them, so only the flight is fitted.`
    : hs.done ? 'Positions above; velocities for every interval below.' : `Now work out the first ${HAND_VY} velocities in the velocity table.`;
  $('data-help').classList.toggle('lb-bad-text', !!(l && still.length));
  $('data-rows').replaceChildren(...all.flatMap(p => {
    const s = shown(p), tr = document.createElement('tr'), rows = [tr];
    const go = Object.assign(document.createElement('button'), { type: 'button', className: 'pj-go', textContent: p.n });
    go.setAttribute('aria-label', `Go to frame ${p.n} in the video`);
    go.addEventListener('click', () => goToFrame(p.n));
    const tdn = document.createElement('td'); tdn.append(go); tr.append(tdn);
    for (const v of [s.t.toFixed(4), minus(s.x.toFixed(3)), minus(s.y.toFixed(3))]) { const td = document.createElement('td'); td.textContent = v; tr.append(td); }
    const box = Object.assign(document.createElement('input'), { type: 'checkbox', className: 'pj-use', checked: !p.out && state.pendingOut !== p.n });
    box.setAttribute('aria-label', `Use frame ${p.n} in the fits`);
    box.addEventListener('change', () => {
      if (box.checked) { if (p.out) { setExcluded(l, p.n, null); save(); } state.pendingOut = null; renderAll(); }
      else { state.pendingOut = p.n; state.pendingFor = l.id; renderData(); $('out-reason')?.focus(); }
    });
    const tdc = document.createElement('td'); tdc.append(box); tr.append(tdc);
    if (p.out) {
      tr.className = 'pj-out';
      const note = document.createElement('tr'), td = document.createElement('td');
      note.className = 'pj-out-note'; td.colSpan = 5; td.textContent = `Frame ${p.n} left out: ${p.reason}`; note.append(td); rows.push(note);
    } else if (state.pendingOut === p.n) {
      const ask = document.createElement('tr'), td = document.createElement('td');
      ask.className = 'pj-out-ask'; td.colSpan = 5;
      td.innerHTML = `<form id="out-form"><label for="out-reason">Why leave frame ${p.n} out of the fit?</label>
        <input id="out-reason" type="text" maxlength="120" autocomplete="off" placeholder="e.g. ball blurred, clicked the wrong spot">
        <span class="pj-out-btns"><button type="submit">Leave it out</button> <button type="button" id="out-cancel">Keep it</button></span>
        <span id="out-msg" class="help lb-bad-text" role="status"></span></form>`;
      ask.append(td); rows.push(ask);
    }
    return rows;
  }));
  $('out-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const r = $('out-reason').value;
    if (!reasonOk(r)) { $('out-msg').textContent = 'Write a short reason first: a lab notebook records why a reading was left out.'; $('out-reason').focus(); return; }
    setExcluded(l, state.pendingOut, r); state.pendingOut = null; save(); renderAll();
  });
  $('out-cancel')?.addEventListener('click', () => { state.pendingOut = null; renderData(); });
  const cell = (i, key, arrKey, value) => {
    const td = document.createElement('td');
    if (i < HAND_VY) {
      const inp = Object.assign(document.createElement('input'), { type: 'number', step: 'any', inputMode: 'decimal', className: 'pj-hand-in', value: l[arrKey]?.[i] ?? '' });
      inp.setAttribute('aria-label', `${key === 'vx' ? 'v_x' : 'v_y'} for frames ${vs[i].from.n} to ${vs[i].to.n}, in m/s`);
      inp.addEventListener('change', () => { l[arrKey] = [...(l[arrKey] || [])]; l[arrKey][i] = inp.value === '' ? '' : +inp.value; save(); $('hand-msg').textContent = ''; renderGraphs(); renderNotebook(); renderControls(); });
      td.append(inp);
      if (hs.done) td.append(' ✓');
    } else td.textContent = hs.done ? minus(value.toFixed(3)) : '…';
    return td;
  };
  $('vel-rows').replaceChildren(...vs.map((v, i) => {
    const tr = document.createElement('tr');
    for (const t of [`${v.from.n} → ${v.to.n}`, v.t.toFixed(4), v.dt.toFixed(4), minus(v.dx.toFixed(3)), minus(v.dy.toFixed(3))]) { const td = document.createElement('td'); td.textContent = t; tr.append(td); }
    tr.append(cell(i, 'vx', 'handX', v.vx), cell(i, 'vy', 'hand', v.vy));
    return tr;
  }));
  $('vel-wrap').hidden = !l || vs.length < 1;
  $('vel-empty').hidden = !!l && vs.length >= 1;
  $('hand-box').hidden = !l || vs.length < HAND_VY;
  $('check-hand').disabled = !l;
}
$('check-hand').addEventListener('click', () => {
  const l = launch(); if (!l) return;
  const hs = handStatus(l), wrong = hs.marks.filter(m => !m.ok);
  if (!wrong.length) { $('hand-msg').textContent = `✓ All ${2 * HAND_VY} are right. The rest of both columns has been filled in the same way, and the v_x–t and v_y–t graphs are ready.`; $('hand-msg').className = 'help lb-good-text'; }
  else {
    const m = wrong[0], i = hs.marks.indexOf(m), x = !m.okX, entered = x ? m.enteredX : m.enteredY, c = x ? 'x' : 'y';
    $('hand-msg').textContent = `Not yet: v_${c} for frames ${m.from.n} → ${m.to.n}${entered !== '' && entered != null && Number.isFinite(+entered) ? ` (${entered})` : ' is empty'}. Use the two positions: v_${c} = Δ${c} / Δt = (${c}₂ − ${c}₁) / (t₂ − t₁) = (${minus(m.to[c].toFixed(3))} − ${minus(m.from[c].toFixed(3))}) / (${m.to.t.toFixed(4)} − ${m.from.t.toFixed(4)}).${wrong.length > 1 ? ` (${wrong.length} intervals still need fixing.)` : ''}`;
    $('hand-msg').className = 'help lb-bad-text';
  }
  renderAll();
});
$('csv').addEventListener('click', () => {
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [['launch', 'angle_deg', 'spring', 'fps', 'frame', 't_s', 'x_m', 'y_m', 'in_fit', 'reason_left_out']];
  for (const l of state.launches) for (const p of allPoints(l).map(shown)) rows.push([l.id, l.angle, l.spring, l.fps, p.n, p.t, p.x, p.y, p.out ? 0 : 1, p.out ? q(p.reason) : '']);
  downloadCsv(rows.map(r => r.join(',')).join('\n') + '\n', `lab2-${state.mode === 'planet' && state.planet ? state.planet.name.replace(/\s+/g, '-') : 'earth'}.csv`);
});

/* ---------- 4. graphs and fits ---------- */
const plots = {
  vx: new XYPlot($('g-vx'), { title: 'vx against t', xLabel: 't (s)', yLabel: 'vx (m/s)' }),
  x: new XYPlot($('g-x'), { title: 'x against t', xLabel: 't (s)', yLabel: 'x (m)' }),
  y: new XYPlot($('g-y'), { title: 'y against t', xLabel: 't (s)', yLabel: 'y (m)' }),
  vy: new XYPlot($('g-vy'), { title: 'vy against t', xLabel: 't (s)', yLabel: 'vy (m/s)' }),
};
const UNITS = { x: ['m', 'm/s', 'm/s²'], y: ['m', 'm/s', 'm/s²'], vx: ['m/s', 'm/s²', 'm/s³'], vy: ['m/s', 'm/s²', 'm/s³'] };
const span = (vals, pad = 0.1) => { const lo = Math.min(...vals), hi = Math.max(...vals), d = (hi - lo) || 1; return [lo - d * pad, hi + d * pad]; };
function renderGraphs() {
  const l = launch(), all = l ? allPoints(l) : [], pts = all.filter(p => !p.out), outs = all.filter(p => p.out), hs = l ? handStatus(l) : { done: false };
  const vel = hs.done ? velPoints(pts) : [];
  const data = { x: pts.map(p => [p.t, p.x]), y: pts.map(p => [p.t, p.y]), vx: vel.map(v => [v.t, v.vx]), vy: vel.map(v => [v.t, v.vy]) };
  // Left-out marks stay on the position graphs as hollow circles, so the student can see what the fit ignores.
  const hollow = { x: outs.map(p => [p.t, p.x]), y: outs.map(p => [p.t, p.y]), vx: [], vy: [] };
  for (const key of ['x', 'y', 'vx', 'vy']) {
    const d = data[key], fit = l ? fitGraph(l, key) : null;
    const h = d.length ? hollow[key] : [], both = [...d, ...h];
    const xs = d.length ? span(both.map(p => p[0]), 0.05) : [0, 1], ys = d.length ? span([...both.map(p => p[1]), 0]) : [0, 1];
    const series = [];
    if (fit) { const line = []; for (let i = 0; i <= 60; i++) { const t = xs[0] + (xs[1] - xs[0]) * i / 60; line.push([t, fit.A + fit.B * t + (fit.C ?? 0) * t * t]); } series.push({ points: line, color: '#1f6b5e', width: 2.2, legend: MODELS[fit.model].toLowerCase() }); }
    plots[key].render({ x: xs, y: ys, series, markers: [...d.map(([a, b]) => ({ x: a, y: b, color: '#c27b22', r: 3.6 })), ...h.map(([a, b]) => ({ x: a, y: b, color: '#c27b22', r: 4.2, hollow: true }))], note: d.length ? '' : (key === 'vy' || key === 'vx') && pts.length ? 'check your v_x and v_y values first' : 'no points yet' });
    $(`g-${key}`).setAttribute('aria-label', `${plots[key].title}: ${d.length} points${h.length ? `, ${h.length} left out (hollow)` : ''}.${fit ? ` ${MODELS[fit.model]} fitted.` : ''}`);
    const sel = document.querySelector(`.pj-model[data-key="${key}"]`), btn = document.querySelector(`.pj-fit[data-key="${key}"]`);
    if (l && document.activeElement !== sel) sel.value = l.models?.[key] || '';   // the menu always shows the fitted model
    btn.disabled = !l || !d.length;
    const u = UNITS[key], out = $(`c-${key}`);
    if (!fit) { out.textContent = l?.models?.[key] && d.length ? `Not enough points for a ${MODELS[l.models[key]].toLowerCase()} yet.` : ''; continue; }
    const name = { x: 'x', y: 'y', vx: 'v_x', vy: 'v_y' }[key];
    out.innerHTML = `<b>${name} = A + B t${fit.model === 'parabola' ? ' + C t²' : ''}</b> (fitted ${fit.n}${h.length ? ` of ${fit.n + h.length}` : ''} points)<br>A = ${pm(fit.A, fit.ASE)} ${u[0]}<br>B = ${pm(fit.B, fit.BSE)} ${u[1]}${fit.model === 'parabola' ? `<br>C = ${pm(fit.C, fit.CSE)} ${u[2]}` : ''}`;
  }
}
// Changing the model refits straight away, so the menu, the curve and the coefficients always agree.
for (const sel of document.querySelectorAll('.pj-model')) sel.addEventListener('change', () => {
  const l = launch(), key = sel.dataset.key;
  if (!l || !sel.value) return;
  l.models = { ...l.models, [key]: sel.value }; save(); renderAll();
});
for (const btn of document.querySelectorAll('.pj-fit')) btn.addEventListener('click', () => {
  const l = launch(), key = btn.dataset.key, model = document.querySelector(`.pj-model[data-key="${key}"]`).value;
  if (!l) return;
  if (!model) { $(`c-${key}`).textContent = 'Choose a model first: which shape should this graph have?'; return; }
  l.models = { ...l.models, [key]: model }; save(); renderAll();
});

/* ---------- notebook: launches ---------- */
function renderNotebook() {
  const pr = progressOf(state.launches, MIN);
  $('progress').textContent = `${pr.good} of ${MIN.launches} launches analysed${pr.good >= 2 && pr.distinct < 2 ? ' (use different settings)' : ''}`;
  $('no-launches').hidden = state.launches.length > 0;
  $('launch-rows').replaceChildren(...pr.sums.map((s, i) => {
    const l = state.launches[i], tr = document.createElement('tr');
    if (i === state.cur) tr.className = 'pj-current';
    const fits = ['x', 'y', 'vx', 'vy'].map(k => `${{ vx: 'v_x', vy: 'v_y' }[k] || k}: ${l.models?.[k] ? MODELS[l.models[k]].toLowerCase() : '–'}`).join(' · ');
    for (const v of [s.id, `${s.angle}°`, s.spring, s.fps, s.excluded ? `${s.n} (${s.excluded} left out)` : s.n, s.calibrated ? '✓' : '–', fits]) { const td = document.createElement('td'); td.textContent = v; tr.append(td); }
    const tdg = document.createElement('td'), inp = Object.assign(document.createElement('input'), { type: 'number', step: 'any', inputMode: 'decimal', className: 'pj-my-g', value: l.myG ?? '' });
    inp.setAttribute('aria-label', `Your g from launch ${l.id}, m/s²`);
    inp.addEventListener('change', () => { l.myG = inp.value; save(); });
    tdg.append(inp); tr.append(tdg);
    const td = document.createElement('td'); td.className = 'lb-saved-actions';
    const open = Object.assign(document.createElement('button'), { type: 'button', textContent: i === state.cur ? 'Analysing' : 'Analyse' });
    open.disabled = i === state.cur; open.setAttribute('aria-label', `Analyse launch ${l.id}`);
    open.addEventListener('click', () => { state.cur = i; state.frame = Math.max(0, video(l).frames.findIndex(f => f.inFlight) - 1); pickTool(defaultTool()); renderAll(); $('video-title').scrollIntoView({ block: 'start', behavior: 'smooth' }); });
    const del = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Delete' });
    del.setAttribute('aria-label', `Delete launch ${l.id}`);
    del.addEventListener('click', () => {
      if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'Confirm delete'; setTimeout(() => { delete del.dataset.armed; del.textContent = 'Delete'; }, 5000); return; }
      state.launches.splice(i, 1); state.cur = Math.min(state.cur, state.launches.length - 1); save(); pickTool(defaultTool()); renderAll();
    });
    td.append(open, del); tr.append(td); return tr;
  }));
}

/* ---------- explain your result ---------- */
const QUESTIONS = {
  parallax: { text: 'Your metre stick and your ball must be the same distance from the camera. Why?', choices: [
    ['a', 'Things nearer the camera look bigger, so a stick nearer than the ball gives a scale that is wrong by the same factor for every length, and for g'],
    ['b', 'The camera’s frame rate depends on how far away things are'],
    ['c', 'A stick nearer the camera adds random scatter to the clicks, which more launches average away'],
    ['d', 'It does not matter, as long as the stick is upright']],
    feedback: { a: 'Yes. A stick 0.45 m nearer a camera 3 m away looks 3 / 2.55 ≈ 1.18 times as long, so every distance you measure in the flight plane, and g, comes out about 15 % too small. That is a systematic error: more launches do not fix it, putting the stick in the flight plane does.', b: 'The frame rate is a property of the camera; distance does not change the timing.', c: 'A misplaced stick shifts every length by the same factor. That is systematic, not random: averaging more launches does not remove it.', d: 'An upright stick at the wrong distance still gives the wrong scale: nearer things look bigger.' } },
  differencing: { text: 'Your g from the v_y–t line usually scatters more than your g from the y–t parabola. Why?', choices: [
    ['a', 'Each v_y is a difference of two nearby positions divided by a short time, so the small errors in your clicks are magnified'],
    ['b', 'v_y is not really a straight line against time'],
    ['c', 'The parabola uses a different value of the frame rate'],
    ['d', 'Air resistance affects v_y but not y']],
    feedback: { a: 'Yes. A 5 mm click error over 1/30 s is 0.15 m/s in v_y. Fitting the positions directly uses each click once, with no division by a small time, so it is less sensitive.', b: 'Without air v_y = v₀y − g t exactly: a straight line. The scatter comes from the clicks, not the shape.', c: 'Both use the same times, n / fps.', d: 'Air acts on the whole motion; for this steel ball it is tiny anyway. The extra scatter comes from taking differences.' } },
};
const qid = () => questionFor2(ASG || { parallax: false });
const answersKey = () => `${bookKey()}-answers`;
function firstAnswers() { try { return JSON.parse(store.get(answersKey()) || '{}') || {}; } catch { return {}; } }
function shuffled(choices, salt) {
  const r = rng(hash32(`${state.planet?.id || 'earth'}|${salt}`)), out = [...choices];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
let qShown = '';
function renderQuestion() {
  const any = progressOf(state.launches, MIN).sums.some(s => s.analysed);
  $('explain-q').hidden = !any;
  if (!any) return;
  const id = qid(), key = `${id}|${bookKey()}`;
  if (key === qShown) return;
  qShown = key;
  const q = QUESTIONS[id];
  $('q-text').textContent = `Explain your result: ${q.text}`;
  $('q-choices').replaceChildren(...shuffled(q.choices, id).map(([v, label]) => { const l = document.createElement('label'), i = document.createElement('input'); Object.assign(i, { type: 'radio', name: 'q', value: v }); l.append(i, document.createTextNode(` ${label}`)); return l; }));
  $('q-feedback').textContent = ''; $('q-feedback').className = 'lb-q-feedback';
  $('q-first').hidden = !ASG || state.mode !== 'planet';
  $('q-first').textContent = firstAnswers()[id] ? 'Your first answer has been recorded for grading. You can still try the others to read their feedback.' : 'Graded: your first answer is the one that counts.';
}
$('explain-q').addEventListener('submit', e => {
  e.preventDefault();
  const id = qid(), v = new FormData(e.currentTarget).get('q'), q = QUESTIONS[id];
  if (!v) { $('q-feedback').textContent = 'Choose an answer first.'; return; }
  const answers = firstAnswers();
  if (!answers[id]) { answers[id] = v; store.set(answersKey(), JSON.stringify(answers)); }
  if (ASG && state.mode === 'planet') $('q-first').textContent = 'Your first answer has been recorded for grading. You can still try the others to read their feedback.';
  $('q-feedback').textContent = `${v === CORRECT2[id] ? '✓ ' : ''}${q.feedback[v]}`;
  $('q-feedback').className = `lb-q-feedback ${v === CORRECT2[id] ? 'lb-good' : 'lb-bad'}`;
});

/* ---------- result ---------- */
function verdict({ g, d }, G, ideal) {
  const dec = Math.max(2, decFor(d)), lo = g - d, hi = g + d, has = v => lo <= v && v <= hi, near = v => Math.abs(g - v) <= 2 * d;
  const p = ((g - G) / G) * 100, how = `${Math.abs(p).toFixed(Math.abs(p) < 1 ? 2 : 1)} % ${p > 0 ? 'high' : 'low'}`;
  const name = state.mode === 'planet' ? 'Your planet’s g' : 'Earth’s g';
  let text = `Your range is ${lo.toFixed(dec)} to ${hi.toFixed(dec)} m/s². ${name} is ${G.toFixed(2)} m/s²`;
  if (has(G)) return { kind: 'good', text: `${text}, inside your range: your measurement agrees with it. ✓` };
  if (near(G) || near(ideal)) return { kind: 'good', text: `${text}, just outside your range (${how}) but within twice your uncertainty: your measurement agrees with it. ✓ About one careful measurement in three lands between one and two uncertainties away.` };
  const front = state.launches.some(l => l.stick === 'front');
  text += `, outside your range: your value is ${how}.`;
  if (front && p < 0) text += ' Every launch came out low by about the same amount: that points to a systematic error. Where was your metre stick?';
  else text += ' Check your calibration (stick ends and origin), whether you marked the ball’s centre, and whether your uncertainty is too small.';
  return { kind: 'bad', text };
}
$('check').addEventListener('click', () => {
  const g = +$('r-g').value, d = +$('r-dg').value, box = $('result-msg');
  box.hidden = false; box.className = 'feedback';
  const bad = msg => { box.textContent = msg; box.classList.add('lb-bad'); };
  if (!(g > 0) || !(d > 0)) return bad('Enter your value of g and its uncertainty (both positive).');
  const pr = progressOf(state.launches, MIN), short = `the assignment needs ${MIN.launches} analysed launches with different settings and ${MIN.points}+ points each (so far: ${pr.good})`;
  const analysed = pr.sums.filter(s => s.analysed), ideal = idealG(env(), analysed.map(s => ({ angle: s.angle, spring: s.spring, fps: s.fps })));
  if (state.mode === 'planet' && ASG) {
    if (!state.planet) return bad('Enter your student ID to go to your planet first.');
    if (!analysed.length) return bad('Analyse a launch first: calibrate, mark the ball, and fit all four graphs.');
    const answer = firstAnswers()[qid()];
    if (!answer) { $('explain-q').scrollIntoView({ block: 'center' }); return bad('Answer the “Explain your result” question first; your first answer is part of your grade.'); }
    const btn = $('check');
    if (!pr.done && !btn.dataset.armed) {
      btn.dataset.armed = '1'; btn.textContent = 'Submit anyway';
      setTimeout(() => { delete btn.dataset.armed; renderMode(); }, 6000);
      return bad(`Not finished: ${short}. You can submit anyway, but the method check will not pass. Press “Submit anyway” to do so.`);
    }
    delete btn.dataset.armed;
    const code = encodeProjectile({ code: ASG.code, id: state.planet.id, g, dg: d, answer, stick: analysed.some(s => s.stick === 'front') ? 'front' : 'plane',
      launches: pr.sums.map(s => ({ angle: s.angle, spring: s.spring, fps: s.fps, n: s.n, excluded: s.excluded, modelsOk: s.modelsOk, analysed: s.analysed })) });
    state.submitted = { g, d, code }; store.set(`${bookKey()}-code`, code);
    box.textContent = `Submitted: g = ${g} ± ${d} m/s² on ${state.planet.name}. Copy your completion code below into Canvas. Your planet’s g stays hidden; your instructor grades the result.`;
    renderMode(); $('completion-code').focus(); return;
  }
  if (state.mode === 'planet') {
    if (!state.planet) return bad('Enter your student ID to go to your planet first.');
    state.submitted = { g, d, ideal }; state.revealed = false;
    box.textContent = `Result recorded: g = ${g} ± ${d} m/s² on ${state.planet.name}.${pr.done ? '' : ` (Not finished: ${short}.)`} This is practice, so you can reveal your planet’s g to check it.`;
    renderMode(); return;
  }
  const v = verdict({ g, d }, EARTH.g, ideal);
  box.textContent = (pr.done ? '' : `Rough check only: ${short}. `) + v.text;
  box.classList.add(v.kind === 'good' ? 'lb-good' : 'lb-bad');
});
$('reveal').addEventListener('click', () => {
  if (!state.submitted || !state.planet) return;
  const v = verdict(state.submitted, state.planet.g, state.submitted.ideal ?? state.planet.g), box = $('result-msg');
  state.revealed = true; box.textContent = v.text; box.className = `feedback ${v.kind === 'good' ? 'lb-good' : 'lb-bad'}`;
  renderMode();
});
$('copy-code').addEventListener('click', async () => {
  const code = $('completion-code').textContent;
  try { await navigator.clipboard.writeText(code); $('copy-msg').textContent = 'Copied. Paste it into the Canvas assignment.'; }
  catch { getSelection().selectAllChildren($('completion-code')); $('copy-msg').textContent = 'Selected: press Ctrl+C (or ⌘C) to copy, then paste it into Canvas.'; }
});

/* ---------- checklist and controls ---------- */
function renderControls() {
  $('fire').disabled = state.firing;
  $('setup-fields').disabled = state.firing;
  const l = launch(), pr = progressOf(state.launches, MIN);
  const done = { fire: state.launches.length > 0, cal: !!l && calibrated(l), track: !!l && points(l).length >= MIN.points, vy: !!l && handStatus(l).done, fit: !!l && summary(l).analysed };
  for (const li of document.querySelectorAll('#checklist li')) li.classList.toggle('done', !!done[li.dataset.item]);
  void pr;
}
function renderAll() { renderMode(); renderControls(); renderVideo(); renderData(); renderGraphs(); renderNotebook(); renderQuestion(); }

/* ---------- start ---------- */
const savedMode = store.get('ipl-lab2-mode');
if (ASG || savedMode === 'planet') { const id = store.get('ipl-lab2-id') || ''; setMode('planet', id); $('student-id').value = id; }
else setMode('earth');
addEventListener('beforeunload', () => store.set('ipl-lab2-mode', state.mode));
