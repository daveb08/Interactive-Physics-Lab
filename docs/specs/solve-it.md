# Spec: "Solve it" — block-based problem solving (prototype)

Source idea: [docs/ideas/block-problem-solver.md](../ideas/block-problem-solver.md). Decisions by Dave Bennett, 2026-10-18.

## Decisions

| Question | Decision |
|---|---|
| First problem | Algebra tier, Newton's Second Law (General Physics I level). A second friction problem exercises the same engine. |
| Location | New fourth tab **Solve it** in the Newton's Laws module (`modules/newtons-laws/solve.html`). Existing pages are untouched except for the extra nav link. |
| Feedback timing | Only on **Check & run**. Students assemble freely, then check. |
| Scoring | Show **score and attempt count** (e.g. "Score 3/4 · Attempt 2"), so students can report it. Nothing is stored or transmitted. |
| Valid orders | Each correct block lists the steps it depends on; any order that respects those dependencies is accepted (e.g. finding v and x commute). |
| Accessibility | Every block is a button. Tap or Enter adds a block; ↑ ↓ ✕ buttons reorder or remove it. Mouse drag-and-drop is an extra on desktop, never required. Works by touch on phones and tablets. |
| Authoring | Problems are data (`solve-problems.js`): statement, blocks, dependencies, distractor feedback, and each block's effect on the student's model. No code changes to add a problem. |

## Step 1: knowns and unknowns (added 2026-10-18)

Before choosing solution blocks, students sort **quantity cards** from the bank into **Knowns** and **Unknowns**
(drag, or **+ Known** / **+ Unknown** buttons; ⇄ moves a card between boxes, ✕ returns it). Some cards are traps
that belong in neither box (e.g. "v₀ = 0 (starts from rest)" for a moving cart; "μs = 0.20" for a sliding block),
each with feedback. **Check knowns & unknowns** marks each card ✓ / ⇄ wrong box / ✗ trap. When all needed cards are
correct and no traps are placed, Step 1 locks and the solution blocks unlock (Step 2). The problem card no longer
lists Given/Find, so Step 1 is not given away. Score display: "Step 1 8/8 (2 tries) · Step 2 3/4 (1 try)".

## Behaviour (Step 2)

1. Student picks a problem; the statement lists givens and what to find.
2. The block bank holds the correct steps plus distractors, shuffled. Each distractor encodes one misconception.
3. The student builds an ordered solution. One block per step is expected.
4. **Check & run**: attempts += 1. Each placed block is marked ✓ correct, ✗ misconception (with targeted feedback) or ↕ out of order (names the step it needs first). Missing steps are listed. Score = correct blocks in a valid position / required steps.
5. The simulation then runs the true motion and, if the student's blocks imply a different model (wrong acceleration or ignored v₀), a **ghost cart** running the student's model. Graphs overlay the student's model and mark the student's numerical answers at the target time.
6. When everything is correct: a success message with the score and attempt count. **Reset** clears the solution; **New shuffle** reorders the bank.

## Problems in the prototype

- **S1 — Pushed cart:** 4 kg cart, v₀ = +2 m/s, constant net force +10 N, frictionless. Find a, v and x at t = 3 s. (a = 2.5 m/s², v = 9.5 m/s, x = 17.25 m.)
- **S2 — Sliding to a stop:** 3 kg block, v₀ = +6 m/s, μk = 0.2, no applied force. Find N, friction, a, stopping time and distance. (N = 29.43 N, f = −5.886 N, a = −1.962 m/s², t = 3.058 s, d = 9.174 m.)

## Tests

Checker: correct orders (including commuting steps), out-of-order detection, distractor flagging, missing steps, duplicate steps, score; problem data integrity (every dependency exists, each step has exactly one correct block, stated answers match the physics engine).
