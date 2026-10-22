/**
 * Seeded randomness for Lab Bench (DOM-free, deterministic). The same student ID and assignment code always give
 * the same planet, on any computer, so a result can be checked later (Stage 3) without storing anything.
 */
import { AIR } from './freefall-drag.js';

/** FNV-1a 32-bit hash of a string. */
export function hash32(str) {
  let h = 0x811c9dc5;
  for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
/** Mulberry32: a small, fast PRNG; returns a function giving numbers in [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Normalise a typed student ID: case, spaces and dashes do not matter ("AB 12-3" = "ab123"). */
export const normaliseId = id => String(id ?? '').toLowerCase().replace(/[\s\-_.]+/g, '').slice(0, 40);

export const PLANET = Object.freeze({ gMin: 3, gMax: 20, airs: ['none', 'thin', 'earth'] });
export const PRACTICE_CODE = 'practice';

/** The mystery planet for a student: g in 3–20 m/s² (to 0.01) and its air (none, thin or Earth-like). */
export function planetFor(studentId, code = PRACTICE_CODE) {
  const id = normaliseId(studentId);
  if (!id) throw new RangeError('A student ID is needed for a mystery planet');
  const r = rng(hash32(`${id}|${String(code).toLowerCase()}`));
  const g = Math.round((PLANET.gMin + r() * (PLANET.gMax - PLANET.gMin)) * 100) / 100;
  const air = PLANET.airs.at(Math.floor(r() * PLANET.airs.length));
  return { id, code: String(code).toLowerCase(), g, air, rho: AIR[air], name: `Planet ${hash32(id + code).toString(36).slice(0, 4).toUpperCase()}` };
}
