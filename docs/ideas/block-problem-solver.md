# Idea: Block-based problem solving ("Build the solution")

**Status:** idea, recorded 2026-10-18. Not scheduled. Proposed by Dave Bennett.

## The idea

Students solve a physics problem inside the simulator by dragging solution blocks into order, the way
block-coding tools (Scratch, Blockly) let students assemble a program. Some blocks are correct steps;
others are plausible but wrong. The student builds the solution, then runs it.

## Why it is worth doing

- **Proven format.** In computer-science education this is a *Parsons problem*: scrambled correct lines
  plus distractor lines. Research reports learning comparable to writing solutions from scratch, in less
  time and with lower cognitive load, especially for novices.
- **Distractors teach.** Each wrong block encodes a specific misconception (e.g. "a = F/m for all t" under
  drag, "use v = v₀ + a t" when a is not constant, "weight and normal force are a Third Law pair"). Choosing
  one triggers targeted feedback, reusing the lab's misconception-feedback pattern.
- **Unique twist: run the solution.** The assembled steps define a model (forces, equation, initial
  conditions). The simulator runs the student's model next to the true one, so a wrong block produces
  visibly wrong motion, not just a red X. Few physics tools do this.
- **Works across the three depths.** Conceptual: order reasoning steps in words. Algebra: choose and
  sequence equations and substitutions. Calculus: build the ODE, pick the solution method (exact, Euler,
  RK4), set initial conditions.
- **Commercial value.** Assembled solutions and the distractors chosen are rich, gradeable data, the kind
  of classroom layer instructors pay for (see the monetization strategy doc).

## Sketch of block types

| Block type | Example (cart with linear drag) |
|---|---|
| Identify forces | "Applied force F, to the right" · "Drag −b v" · distractor: "Normal force, to the right" |
| Newton's 2nd law | "m dv/dt = F − b v" · distractor: "m a = F" (ignores drag) |
| Method | "Separate variables and integrate" · "RK4 with h = 0.1 s" · distractor: "v = v₀ + a t" |
| Initial conditions | "v(0) = 0" · distractor: "v(0) = F/b" |
| Result | "v(t) = (F/b)(1 − e^(−b t/m))" · distractor: "v(t) = (F/m) t" |

## Design questions to settle later

1. Strict order vs. any valid order (some steps commute; the checker must accept equivalent orders).
2. Feedback timing: per block as placed, or only after "Run my solution".
3. Scaffolding fade: first problems give the block skeleton; later ones add more distractors and blank slots.
4. Accessibility: drag-and-drop must have a keyboard and screen-reader alternative (e.g. select a block,
   then "move up / move down / insert"). Must work by touch on phones and tablets.
5. Authoring: problems as data files (blocks, correct orders, distractor feedback) so new problems need no code.
6. Data: keep the current no-accounts design, or store results once a Canvas LTI / paid tier exists.

## Suggested first prototype

One problem in Forces That Change (V1 terminal velocity): about 6 correct blocks and 3–4 distractors,
keyboard-accessible ordering, a "Run my solution" button that overlays the student's v(t) on the exact
curve, and misconception feedback per distractor. Test it with students before generalising.
