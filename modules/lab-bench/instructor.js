/** Lab Bench instructor page: make a graded assignment link (Lab 1 or Lab 2), then grade pasted completion codes (grading.js, grading-projectile.js). */
import { parseAssignment, assignmentQuery, normaliseCode, makeKey, keyCheck, gradeBatch, gradesCsv } from './grading.js';
import { downloadCsv } from '../../js/components/csv-export.js';
import { store, mergeAssignments, parseBackup, backupText, labForLink } from './saved-assignments.js';
import { parseProjectileAssignment, projectileQuery, gradeProjectileBatch, gradesCsv2, notesFor2 } from './grading-projectile.js';

const $ = id => document.getElementById(id);
const labUrl = (query, page = 'freefall.html') => new URL(`${page}?${query}`, location.href).href;
const chosenLab = () => document.querySelector('[name=m-lab]:checked')?.value || 'freefall';
for (const r of document.querySelectorAll('[name=m-lab]')) r.addEventListener('change', () => { $('lab1-fields').hidden = chosenLab() !== 'freefall'; $('lab2-fields').hidden = chosenLab() !== 'projectile'; });

/* ---------- 1. make a link ---------- */
$('make-form').addEventListener('submit', e => {
  e.preventDefault();
  const code = normaliseCode($('m-code').value);
  if (!code || code === 'practice') { $('m-code').setCustomValidity('Use letters, numbers and dashes (not "practice").'); $('m-code').reportValidity(); return; }
  $('m-code').setCustomValidity('');
  const key = makeKey();
  let a, link, settings;
  if (chosenLab() === 'projectile') {
    a = parseProjectileAssignment(`?${new URLSearchParams({ a: code, t: $('m2-t').value, u: $('m2-u').value, n: `${$('m2-l').value}x${$('m2-p').value}`, px: $('m2-px').checked ? '1' : '0', air: 'any', k: keyCheck(key) })}`);
    link = labUrl(projectileQuery(a), 'projectile.html');
    settings = `within ${a.tol} %; δg ≤ ${a.maxRel} %; ${a.launches} launches × ${a.points} points; parallax trap ${a.parallax ? 'on' : 'off'}`;
  } else {
    a = parseAssignment(`?${new URLSearchParams({ a: code, t: `${$('m-tg').value},${$('m-tw').value}`, u: $('m-u').value, n: `${$('m-h').value}x${$('m-n').value}`, air: $('m-air').value, k: keyCheck(key) })}`);
    link = labUrl(assignmentQuery(a));
    settings = `within ${a.tolGate} % (timer) / ${a.tolWatch} % (stopwatch); δg ≤ ${a.maxRel} %; ${a.heights} × ${a.trials} drops; ${a.air === 'none' ? 'no air' : 'mixed air'}`;
  }
  $('made-key').textContent = key; $('made-link').textContent = link; $('open-link').href = link;
  $('copy-link-msg').textContent = `${labForLink(link).name}, code “${a.code}”: ${settings}.`;
  $('made').hidden = false;
  // ready to grade later: fill part 2 as well
  $('g-link').value = link; $('g-key').value = key;
  const saved = saveAssignments(mergeAssignments(saved_, [{ code: a.code, lab: labForLink(link).id, link, key, settings, created: new Date().toISOString() }]));
  $('copy-link-msg').textContent += saved ? ' Saved in “Your saved assignments” below.' : ' This browser could not save it: write the grading key down.';
  renderSaved(); $('g-saved').value = `${labForLink(link).id}|${a.code}`;
});
$('m-code').addEventListener('input', () => $('m-code').setCustomValidity(''));
$('copy-link').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('made-link').textContent); $('copy-link-msg').textContent = 'Link copied. Post it in Canvas.'; }
  catch { getSelection().selectAllChildren($('made-link')); $('copy-link-msg').textContent = 'Selected: press Ctrl+C (or ⌘C) to copy.'; }
});

/* ---------- saved assignments ---------- */
let saved_ = store.load();
const canSave = store.available();
function saveAssignments(list) { saved_ = list; return store.save(list); }
const fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); };
function savedMsg(text) { $('saved-msg').textContent = text; }
function renderSaved() {
  $('saved-empty').hidden = saved_.length > 0;
  $('saved-table').hidden = !saved_.length;
  $('saved-download').disabled = !saved_.length;
  if (!canSave) $('saved-note').textContent = 'This browser is not letting the page save anything (a private window, or storage is blocked), so links are not remembered here. Write each grading key down, or load a backup each time.';
  $('saved-rows').replaceChildren(...saved_.map(r => {
    const tr = document.createElement('tr'), id = `${r.lab}|${r.code}`;
    for (const text of [r.code, labForLink(r.link).name, fmtDate(r.created), r.key || '—', r.settings]) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
    tr.firstChild.className = 'lb-saved-code';
    const td = document.createElement('td'); td.className = 'lb-saved-actions';
    const btn = (label, aria, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('aria-label', `${aria} ${r.code}`); b.addEventListener('click', fn); td.append(b); return b; };
    btn('Grade', 'Grade', () => { $('g-saved').value = id; fillFromSaved(); $('grade-title').scrollIntoView({ block: 'start', behavior: 'smooth' }); $('g-codes').focus({ preventScroll: true }); });
    btn('Copy link', 'Copy the student link for', async () => {
      try { await navigator.clipboard.writeText(r.link); savedMsg(`Student link for “${r.code}” copied.`); } catch { savedMsg(`Student link for “${r.code}”: ${r.link}`); }
    });
    const rm = btn('Remove', 'Remove', () => {
      if (!rm.dataset.armed) { rm.dataset.armed = '1'; rm.textContent = 'Confirm remove'; setTimeout(() => { delete rm.dataset.armed; rm.textContent = 'Remove'; }, 5000); return; }
      saveAssignments(saved_.filter(x => `${x.lab}|${x.code}` !== id)); renderSaved();
      savedMsg(`Removed “${r.code}” from this browser. (Students' links still work; you need its grading key to grade it.)`);
    });
    tr.append(td); return tr;
  }));
  const sel = $('g-saved'), keep = sel.value;
  sel.replaceChildren(new Option('Choose one, or paste the link and key below', ''), ...saved_.map(r => new Option(`${r.code} · ${labForLink(r.link).name}${r.created ? ` · ${fmtDate(r.created)}` : ''}`, `${r.lab}|${r.code}`)));
  sel.value = saved_.some(r => `${r.lab}|${r.code}` === keep) ? keep : '';
  sel.closest('label').hidden = !saved_.length;
}
function fillFromSaved() {
  const r = saved_.find(x => `${x.lab}|${x.code}` === $('g-saved').value);
  if (!r) return;
  $('g-link').value = r.link; $('g-key').value = r.key;
}
$('g-saved').addEventListener('change', fillFromSaved);
$('saved-download').addEventListener('click', () => {
  const blob = new Blob([backupText(saved_)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `lab-bench-assignments-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  savedMsg(`Backup downloaded (${saved_.length} ${saved_.length === 1 ? 'assignment' : 'assignments'}). It contains the grading keys, so keep it private.`);
});
$('saved-load').addEventListener('change', async e => {
  const file = e.target.files?.[0]; e.target.value = '';
  if (!file) return;
  try {
    const incoming = parseBackup(await file.text()), before = saved_.length;
    const ok = saveAssignments(mergeAssignments(saved_, incoming)); renderSaved();
    savedMsg(`Loaded ${incoming.length} ${incoming.length === 1 ? 'assignment' : 'assignments'} (${saved_.length - before} new).${ok ? '' : ' This browser could not keep them after you leave the page.'}`);
  } catch (err) { savedMsg(err.message); }
});
renderSaved();

/* ---------- 2. grade ---------- */
let lastRows = [], lastCode = '', lastLab = 'freefall';
const msg = (text, good) => { const m = $('g-msg'); m.hidden = false; m.textContent = text; m.className = `feedback ${good ? 'lb-good' : 'lb-bad'}`; };
$('grade-form').addEventListener('submit', e => {
  e.preventDefault();
  let a = null, lab = 'freefall';
  try { const u = new URL($('g-link').value.trim(), location.href); lab = labForLink(u.href).id; a = lab === 'projectile' ? parseProjectileAssignment(u.search) : parseAssignment(u.search); } catch { /* not a link */ }
  $('grades').hidden = true; $('g-csv').disabled = true; lastRows = [];
  if (!a) return msg('That is not an assignment link: paste the student link you posted in Canvas (it contains “?a=”).');
  if (a.keyCheck && keyCheck($('g-key').value) !== a.keyCheck) return msg('The grading key does not match this assignment link. Use the key shown when the link was made.');
  const rows = lab === 'projectile' ? gradeProjectileBatch($('g-codes').value, a) : gradeBatch($('g-codes').value, a);
  if (!rows.length) return msg('No completion codes found. Codes start with “LB-” (or “LB1-” for older codes).');
  lastRows = rows; lastCode = a.code; lastLab = lab;
  const graded = rows.filter(r => r.result && !r.replaced), bad = rows.filter(r => r.error).length;
  const mean = graded.length ? graded.reduce((s, r) => s + r.result.score, 0) / graded.length : 0;
  msg(`${graded.length} ${graded.length === 1 ? 'student' : 'students'} graded for “${a.code}”${graded.length ? `, average ${mean.toFixed(1)} / 4` : ''}.${bad ? ` ${bad} ${bad === 1 ? 'code was' : 'codes were'} refused (see the table).` : ''}${a.keyCheck ? '' : ' (This link has no grading key, so anyone with it could grade.)'}`, !bad);
  renderGrades(rows);
  $('g-csv').disabled = !graded.length;
});
function cell(tr, text, cls = '', title = '') {
  const td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls;
  if (title) { td.title = title; const s = document.createElement('span'); s.className = 'sr-only'; s.textContent = ` (${title})`; td.append(s); }
  tr.append(td); return td;
}
function renderGrades(rows) {
  $('grade-rows').replaceChildren(...rows.map(r => {
    const tr = document.createElement('tr');
    cell(tr, r.n);
    cell(tr, r.sub?.id ?? '–');
    if (r.error) {
      tr.className = 'lb-refused';
      const td = cell(tr, `Refused: ${r.error}`); td.colSpan = 8; return tr;
    }
    if (r.replaced) tr.className = 'lb-replaced';
    cell(tr, `${r.result.score} / ${r.result.max}`, 'lb-score');
    for (const c of r.result.checks) cell(tr, c.pass ? '✓' : '✗', c.pass ? 'lb-pass' : 'lb-fail', c.detail);
    cell(tr, `${r.sub.g} ± ${r.sub.dg}`);
    cell(tr, r.result.G.toFixed(2));
    cell(tr, [r.replaced ? 'replaced by a later code' : '', r.sub.launches ? notesFor2(r.sub) : `${r.sub.ball === 'pingpong' ? 'ping-pong' : 'steel'}, ${r.sub.timer === 'gate' ? 'electronic timer' : 'stopwatch'}`, ...r.flags].filter(Boolean).join('; '));
    return tr;
  }));
  $('grades').hidden = false;
}
$('g-csv').addEventListener('click', () => { if (lastRows.length) downloadCsv(lastLab === 'projectile' ? gradesCsv2(lastRows) : gradesCsv(lastRows), `${lastLab === 'projectile' ? 'lab2' : 'lab1'}-grades-${lastCode}.csv`); });
