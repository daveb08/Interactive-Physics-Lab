/** Pure checker for "Solve it" block solutions (unit-tested). */

export function requiredSteps(problem) {
  return problem.blocks.filter(b => b.correct).map(b => b.step);
}

/**
 * @param problem a PROBLEMS entry
 * @param sequence ordered array of block ids the student placed
 * @returns {{ score, total, solved, blocks: Array<{id, status, message}>, missing: string[], incorrect: number }}
 *   status: 'correct' | 'misconception' | 'order' | 'duplicate'
 */
export function checkSolution(problem, sequence) {
  const byId = Object.fromEntries(problem.blocks.map(b => [b.id, b]));
  const done = new Set();        // steps already filled by a correct block, in order
  const seenSteps = new Set();   // steps that have any block placed
  const results = [];
  let score = 0;
  for (const id of sequence) {
    const block = byId[id];
    if (!block) throw new RangeError(`Unknown block ${id}`);
    if (!block.correct) {
      results.push({ id, status: 'misconception', message: block.feedback });
      seenSteps.add(block.step);
      continue;
    }
    if (done.has(block.step)) { results.push({ id, status: 'duplicate', message: 'This step is already in your solution.' }); continue; }
    const needs = (block.after || []).filter(s => !done.has(s));
    const flawed = needs.filter(s => seenSteps.has(s));
    if (needs.length) {
      const message = flawed.length === needs.length
        ? `Correct step, but it builds on ${needs.map(s => `“${problem.steps[s]}”`).join(' and ')}, which has a mistake above.`
        : `Correct step, but it needs ${needs.map(s => `“${problem.steps[s]}”`).join(' and ')} first.`;
      results.push({ id, status: 'order', message });
    } else {
      results.push({ id, status: 'correct', message: '' });
      score++;
    }
    done.add(block.step);
    seenSteps.add(block.step);
  }
  const total = requiredSteps(problem).length;
  const placedCorrect = new Set(sequence.map(id => byId[id]).filter(b => b.correct).map(b => b.step));
  const missing = requiredSteps(problem).filter(s => !placedCorrect.has(s)).map(s => problem.steps[s]);
  const incorrect = results.filter(r => r.status !== 'correct').length;
  return { score, total, solved: score === total && incorrect === 0, blocks: results, missing };
}

/** The motion the student's solution implies: true values unless a placed block changes them. */
export function studentModel(problem, sequence, trueA) {
  const byId = Object.fromEntries(problem.blocks.map(b => [b.id, b]));
  let a = trueA, v0 = problem.setup.velocity, changed = false;
  for (const id of sequence) {
    const e = byId[id]?.effect;
    if (!e) continue;
    if (e.a !== undefined && a === trueA) { a = e.a; changed = true; }
    if (e.v0 !== undefined && v0 === problem.setup.velocity) { v0 = e.v0; changed = true; }
  }
  return { a, v0, changed };
}

/** Deterministic shuffle so a "New shuffle" is reproducible in tests. */
export function shuffled(items, seed = Date.now()) {
  const out = [...items];
  let s = (seed >>> 0) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Step 1: knowns and unknowns.
 * @param placement { [quantityId]: 'known' | 'unknown' } for the cards the student has placed
 * @returns {{ score, total, solved, items: Array<{id, zone, status, message}>, missing: string[] }}
 *   status: 'correct' | 'wrong-zone' | 'trap'
 */
export function checkQuantities(problem, placement) {
  const byId = Object.fromEntries(problem.quantities.map(q => [q.id, q]));
  const items = [];
  let score = 0;
  for (const [id, zone] of Object.entries(placement)) {
    const q = byId[id];
    if (!q) throw new RangeError(`Unknown quantity ${id}`);
    if (zone !== 'known' && zone !== 'unknown') throw new RangeError(`Unknown zone ${zone}`);
    if (q.role === 'none') items.push({ id, zone, status: 'trap', message: q.feedback });
    else if (q.role !== zone) items.push({ id, zone, status: 'wrong-zone', message: zone === 'known'
      ? 'The problem asks you to find this, so it is an unknown.'
      : 'This value is stated (or implied) in the problem, so it is a known.' });
    else { items.push({ id, zone, status: 'correct', message: '' }); score++; }
  }
  const needed = problem.quantities.filter(q => q.role !== 'none');
  const missing = needed.filter(q => placement[q.id] === undefined).map(q => q.text);
  const traps = items.filter(i => i.status === 'trap').length;
  return { score, total: needed.length, solved: score === needed.length && traps === 0, items, missing };
}
