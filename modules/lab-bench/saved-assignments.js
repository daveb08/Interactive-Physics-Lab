/**
 * Saved assignments for the instructor page. Each assignment link the instructor makes is remembered in this
 * browser, so it can be graded later without hunting for the link or the grading key. A JSON backup moves the
 * list to another computer. Nothing is sent anywhere.
 *
 * Record: { code, lab, link, key, settings, created } (created: ISO date string).
 */
const KEY = 'ipl-lab-bench-assignments';
const MAX = 200;

/** Which lab a student link is for, from its page name. */
export function labForLink(link) {
  const path = (() => { try { return new URL(link, 'https://x.invalid/').pathname; } catch { return String(link); } })();
  if (/projectile\.html$/.test(path)) return { id: 'projectile', name: 'Lab 2 · g from a projectile' };
  return { id: 'freefall', name: 'Lab 1 · g from a falling ball' };
}

const clean = r => r && typeof r === 'object' && typeof r.code === 'string' && r.code && typeof r.link === 'string' && r.link
  ? { code: r.code.slice(0, 40), lab: typeof r.lab === 'string' ? r.lab.slice(0, 20) : labForLink(r.link).id, link: r.link.slice(0, 2000),
      key: typeof r.key === 'string' ? r.key.slice(0, 60) : '', settings: typeof r.settings === 'string' ? r.settings.slice(0, 400) : '',
      created: typeof r.created === 'string' ? r.created.slice(0, 40) : '' }
  : null;

/** Same assignment = same lab and code. The newer record wins; the list is kept newest first. */
export function mergeAssignments(existing, incoming) {
  const byId = new Map();
  for (const r of [...existing, ...incoming].map(clean).filter(Boolean)) {
    const id = `${r.lab}|${r.code}`, old = byId.get(id);
    if (!old || (r.created || '') >= (old.created || '')) byId.set(id, r);
  }
  return [...byId.values()].sort((a, b) => (b.created || '').localeCompare(a.created || '')).slice(0, MAX);
}

/** Parse a backup file. Throws a readable error for anything that is not one. */
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('That file is not a saved-assignments backup (it is not JSON).'); }
  const list = Array.isArray(data) ? data : data?.assignments;
  if (!Array.isArray(list)) throw new Error('That file is not a saved-assignments backup.');
  const good = list.map(clean).filter(Boolean);
  if (!good.length) throw new Error('That backup has no assignments in it.');
  return good;
}
export const backupText = list => JSON.stringify({ kind: 'interactive-physics-lab/lab-bench-assignments', version: 1, saved: new Date().toISOString(), assignments: list }, null, 2) + '\n';

/** Browser storage, guarded: storage can be blocked (private windows, some embeds). */
export const store = {
  available() { try { const k = `${KEY}-probe`; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch { return false; } },
  load() { try { return mergeAssignments([], JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return []; } },
  save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; } },
};
