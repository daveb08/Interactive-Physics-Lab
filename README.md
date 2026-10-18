# Interactive Physics Lab

A dependency-free HTML/CSS/JavaScript learning laboratory. The first working experiment explores Newton’s Second Law with a cart, signed forces and velocities, synchronized SVG graphs, and prediction activities. First, Second, and Third Law activities are available; other catalog modules remain **Coming soon**.

## Run locally

Install Node.js 20 or later. No package installation or build is needed.

```sh
cd "C:\Dave\Interactive Physics Labs"
node scripts/serve.js
```

Open **http://127.0.0.1:5173/** in a modern browser. `npm run dev` is equivalent. On macOS, change into your downloaded project directory before running the same Node command. Stop the server with Ctrl+C. If the port is occupied, set the `PORT` environment variable (PowerShell: `$env:PORT=5174`) before starting.

Use HTTP rather than opening the HTML directly: ES modules require a server. The included development server binds to this computer’s loopback interface. For tablet access, serve these static files on an instructor-managed host reachable by the tablet. The application has no external API, fonts, CDN, tracking, login, or paid service dependencies.

## Experiment workflow

1. Select Newton’s Laws from the catalog.
2. Set mass (1–10 kg), force (−20 to +20 N), and initial velocity (−5 to +5 m/s).
3. Choose Conceptual or Quantitative mode. Switching modes resets the experiment and prediction.
4. Make and save a prediction, then select **Start experiment**.
5. Pause to inspect measurements; resume the same run. Reset to change settings or make a new prediction. Reset preserves the current slider settings.
6. Read the feedback after completion. Conceptual feedback is also available when paused; quantitative feedback appears once the target time has been observed.

In conceptual mode, predict the initial change in **signed velocity**, which differs from speed. In quantitative mode, predict acceleration (initial acceleration when friction is enabled) and velocity at 3 s, or the exact boundary time if it occurs earlier. A rounded target time is displayed. Answers within ±0.05 m/s² and ±0.10 m/s are accepted. Both modes use the same engine.

### Optional friction

In Free Exploration, check **Enable Friction** and adjust the static and kinetic coefficients. The controls enforce 0 ≤ μk ≤ μs ≤ 1. Changing settings resets the run and prediction. Normal force, maximum static friction, signed friction, net force, and motion state appear alongside applied/friction/net force vectors. Zero forces have no arrow. Static friction balances the applied force up to its limit; it is not always equal to that limit.

For the classroom activities, choose **Guided Experiments**, then **F1**, **F2**, or **F3** under Friction. F1 compares three applied forces; F2 observes stopping; F3 compares masses. Save a prediction, run each trial, and use **Prepare Run 2/3** between trials. All friction trials observe 3 seconds. Comparison tables distinguish initial sliding forces from forces after stopping; velocity curves share axes. F3 curves coincide. Submit a reflection to reveal a model explanation without automatic grading.

See [FRICTION_TEST_REPORT.md](FRICTION_TEST_REPORT.md) for verified outcomes, browser checks, limitations, and a 24-minute classroom sequence. A–D remain frictionless; returning to Free Exploration restores its prior friction settings as well as mass, force, velocity, and learning mode.

## Guided Experiments

The **Free Exploration / Guided Experiments** selector adds guided activities to the same simulator. Free Exploration retains the original conceptual and quantitative activities, numerical feedback, graphs, and independent sliders. Switching experiences starts a new run; returning to Free Exploration restores its prior mass, force, initial velocity, and learning mode. Guided predictions, results, and reflections are reset when changing experiments or pressing Reset.

Choose A–D, read the objective and locked conditions, choose an answer, and select **Save prediction** before starting. Changing an unsaved choice after saving disables Start until the new choice is saved. An incorrect prediction still unlocks the experiment.

| Experiment | Conditions | What to verify |
| --- | --- | --- |
| A — Does motion require a force? | 2 kg, 0 N, +3 m/s | At 6 s: a = 0, v = +3 m/s, x = 18 m. Correct option B. |
| B — Can force oppose motion? | 2 kg, +4 N, −4 m/s | a = +2 m/s²; stops at 2 s and x = −4 m, then reverses. At 6 s: v = +8 m/s, x = 12 m. Correct option B. |
| C — How does mass affect acceleration? | 2 then 4 kg; +6 N; initially at rest | At 3 s: a = 3 then 1.5 m/s²; v = 9 then 4.5 m/s; x = 13.5 then 6.75 m. Correct option B. |
| D — How does force affect acceleration? | +4 then +8 N; 2 kg; initially at rest | At 3 s: a = 2 then 4 m/s²; v = 6 then 12 m/s; x = 9 then 18 m. Correct option A. |

For C/D, run **Run 1**, select **Prepare Run 2**, then **Start Run 2**. Each run stops at exactly 3 s. The table progressively records observed measurements. Run 1’s velocity curve stays solid blue; Run 2 overlays a dashed orange curve using the same axes. Position and acceleration graphs show the current run. Full comparison feedback and reflection appear only after both runs finish.

Before starting, inquiry-oriented objectives and hidden acceleration readouts/graphs avoid revealing the answer. After completion, the full learning objective and **Observation**, **Physics explanation**, and **Key takeaway** appear, with misconception-specific feedback for an incorrect choice. Write a brief reflection and select **Submit explanation** to reveal the instructor-authored model answer. Free text is not graded, transmitted, or persisted.

### Guided implementation

- `modules/newtons-laws/guided-experiments.js`: instructor-authored activity content, prediction/run sequencing, and comparison of observed states.
- `modules/newtons-laws/guided-activity.js`: guided controls, progressive results, feedback, and reflections.
- `tests/guided.test.js`: initial conditions, correct choices, outcomes, reversal, sequence guards, common times, and boundary handling.
- The original experiment controller uses the same `CartView`, `MotionGraph`, and `SimulationClock` for both experiences. `createRun` accepts an optional observation duration; the six-second Free Exploration default and exact kinematics remain intact. The graph component accepts an optional recorded reference curve without changing its original single-curve interface.

## Architecture

```text
index.html                         Module catalog
css/styles.css                     Shared layout and responsive styles
js/core/physics.js                 Pure SI-unit kinematics and boundary events
js/core/clock.js                   Fixed-step simulation clock
js/components/cart.js             SVG track, cart, and applied-force vector
js/components/graph.js            Reusable SVG time-series graph
modules/newtons-laws/index.html   Second Law experiment interface
modules/newtons-laws/experiment.js Controls, modes, prediction feedback
tests/physics.test.js             Node built-in unit tests
scripts/serve.js                   Local static development server
```

The physics core does not depend on the DOM. The experiment controller owns a run and passes its state and sample history to the visualization components. New experiments can reuse the clock and graphs while adding their own physics model and controller. A separate HTML page per module avoids a router or framework.

### Model and numerical choices

- One-dimensional translation on a horizontal surface, starting at x = 0. Positive points right. Friction is off by default. When enabled, this is a sliding-contact Coulomb model (the cart wheels are illustrative), with g = 9.81 m/s² and N = mg.
- Exact constant-acceleration segments: `a = Fnet / m`, `x = x₀ + v₀Δt + ½aΔt²`, `v = v₀ + aΔt`. At rest, static friction balances applied force when |F| ≤ μsN. Otherwise kinetic friction has magnitude μkN opposite sliding. Exact zero-velocity events re-evaluate static friction, so a stopped cart sticks unless the applied force exceeds the static limit.
- The clock advances at 1/120 s. Each sample is evaluated analytically from the initial conditions to avoid accumulated integration drift. Animation, numerical readouts, and graphs consume the same state/sample data. The final step can be shorter to land exactly on the end time.
- Observation ends after 6 s or at the first outward crossing of x = −50 or +50 m. The engine solves the kinematic boundary equation, including reversal paths. A tangent touch followed by inward motion is allowed. No reflection, impulse, or arbitrary velocity reset occurs; the final velocity is the incident velocity at the observation limit.
- Pause/resume does not advance simulation time while paused. Backgrounding the page automatically pauses. Frame gaps are capped at 0.1 s, so a slow or stalled device may run slower than wall time, while the physics remains consistent with displayed simulation time.
- Graphs include zero, support negative values, scale vertically to observed samples, and use the planned observation end for the time axis. The force arrow points with the applied force and vanishes at zero force; force magnitude is also labeled numerically.
- Settings and predictions lock after starting. Applied force and coefficients stay constant within a run; friction and acceleration may change at a stop or reversal. Graphs show exact event times and acceleration jumps.

## Automated verification

```sh
node --test
```

Or `npm test`. Uses Node’s built-in test runner; no testing dependency is needed. Tests cover zero and signed forces, inverse mass and proportional force relationships, constant velocity, reversal, analytical solutions across 75 parameter combinations, exact positive and negative boundary exits, tangent contacts, final-state/sample consistency, time-step independence, prediction tolerances, and invalid inputs.

## Browser verification checklist

- Default: 2 kg, +6 N, zero initial velocity. Predict a = 3 m/s² and v(3 s) = 9 m/s. At 6 s, the run would be beyond the track, so it ends at x = 50 m, t ≈ 5.774 s, v ≈ 17.321 m/s.
- Zero force with v₀ = −5 m/s: at 6 s, x = −30 m, v = −5 m/s, a = 0.
- 2 kg, +4 N, v₀ = −4 m/s: v = 0 at 2 s, then reverses; x at 2 s is −4 m.
- 1 kg, −20 N, v₀ = 0: ends at x = −50 m, t ≈ 2.236 s; final v ≈ −44.721 m/s.
- Confirm pause/resume, locked settings, reset, changing learning mode, prediction validation, keyboard operation, and narrow layouts.

## Limitations and next steps

The models omit collisions, rolling resistance, air resistance, persistence, export, and assessment records. Second Law forces stay fixed; First Law supports timed pulses and Third Law supports spring release. Free Exploration graphs rescale vertically; guided velocity overlays share axes within each comparison. Guided predictions use a fixed instructor-authored question bank. Reflections are not automatically graded or persisted. The development server is for local use, not production hosting.

Physical-tablet and classroom usability/accessibility checks remain necessary; viewport checks do not replace testing on the devices students will use.

## Newton’s First Law — Inertia

Select **First Law · Inertia** from the Newton’s Laws navigation, or open
`/modules/newtons-laws/first-law.html`. I1–I3 use the existing guided prediction,
cart, graph, feedback, and ungraded reflection components. These fixed conceptual
activities require a saved prediction and lock their parameters. The original
Conceptual/Quantitative Free Exploration modes remain available on the Second Law page.

- **I1:** 2 kg, v₀ = 0, Fnet = 0, no friction. At 6 s: x = 0, v = 0, a = 0.
- **I2:** 2 kg, v₀ = +3 m/s, Fnet = 0, no friction. At 6 s: x = 18 m, v = +3 m/s, a = 0.
- **I3:** 2 kg, v₀ = 0, +4 N until exactly 2 s, then zero force. At removal:
  x = 4 m, v = +4 m/s; acceleration changes from +2 to 0 m/s². At 6 s:
  x = 20 m, v = +4 m/s, a = 0. All three graphs mark force removal.

The engine evaluates each constant-acceleration segment analytically and records
both acceleration values at the transition, preserving position and velocity.
The force arrow and applied-force readout update at the same simulation instant.
These observations stay inside the existing ±50 m track.

Run `node --test`: **47 tests pass**, including all 43 prior tests and four new
First Law tests covering presets, prediction gating, exact transition/continuity,
graph values at multiple step sizes, short runs, and boundaries.

For browser testing, save a prediction and run each I1–I3 experiment to completion;
inspect its results and graphs, then submit a reflection to reveal the model answer.
For I3, pause before/after 2 s to compare force, velocity, and acceleration. Reset
and switching activities must clear results and require a new prediction. Use the
Second Law navigation link to return to A–D, F1–F3, and Free Exploration.

First Law now also offers Free Exploration with a timed force pulse and optional
friction. Responses are not persisted or graded. Physical tablets and
cross-browser/screen-reader validation have not been performed for this addition.

Browser verification (17 October 2026): completed I1, I2, and I3 in the in-app
browser; confirmed the final values above, locked settings and prediction gating,
I3’s force readout and graph marker, misconception feedback for an incorrect I3
prediction, and reflection/model-answer submission. Navigated back to Second Law
and confirmed its quantitative control and A–D/F1–F3 selector entries remain
available. No browser console errors were captured. Preview:
`artifacts/first-law-preview.png`.

## First Law Free Exploration

From First Law, select **Free Exploration**. Defaults: 2 kg, +3 m/s, 0 N,
a 2-second pulse, friction disabled. Adjust mass (1–10 kg), initial velocity
(−5 to +5 m/s), applied force during pulse (−20 to +20 N), and duration
(0.5–5 s). Optional friction uses the same coefficient controls as Second Law.
The total observation interval is 6 seconds or the first outward track-boundary
crossing, whichever comes first.

A written prediction is optional and ungraded. Start directly or describe the
expected motion first; after running, compare the explanation with measured
velocity at removal and the observed final state. The app does not assign a
universal correct answer to arbitrary settings. Boundary termination before
removal is explicitly identified as having no observed post-pulse motion.

Force removal, frictional stops, and boundaries use the same analytical event
planner. Position and velocity remain continuous at removal. Acceleration and
force readouts update at that exact time; graphs mark the event. Friction
continues after the pulse, until rest if kinetic friction is nonzero. Without
friction, velocity after removal stays constant, including the zero-velocity case.
The selected pulse amplitude stays in the control; **Applied force now** shows
the instantaneous force. Switching to Guided Experiments keeps I1–I3 fixed;
returning to Free Exploration restores its parameter settings. Reset preserves
parameters but clears the optional explanation and results.

Verification: **55 tests passed, 0 failed**, including all 47 prior tests.
New `tests/pulse.test.js` covers zero-force motion, signed velocities and pulses,
varied masses/durations, exact timing, continuity, frictional stopping, static
balance, simultaneous stopping/removal, reversal, boundaries, and an 81-case
friction-pulse grid comparing small and large simulation steps.

Limits: one pulse per run; no force editing while running; no saved student
responses. Physical touch devices and cross-browser accessibility still require
classroom validation. No GitHub push was made for these local changes.

Free Exploration browser verification: checked default settings, optional-prediction
start, +4 N frictionless coasting, friction continuing to rest, selected versus
instantaneous force readouts, preserved I3 gating/conditions, restoration of free
settings, and early boundary feedback before pulse removal. Inspected 768×1024
and 1366×900 viewports; no page-wide overflow at tablet width. Physical devices
were not tested. Preview: `artifacts/first-law-free-preview.png`.

## Newton’s Third Law — Action & Reaction

Open `/modules/newtons-laws/third-law.html`, or select **Third Law · Action & reaction**
from either existing Newton’s Laws page. Guided T1 compares equal 2 kg masses;
T2 compares 2 kg and 4 kg; T3 asks students to identify the force pair in separate
free-body diagrams. Save a prediction, start, and pause during contact to compare
forces and accelerations. Complete the run to reveal observation, explanation,
and an optional ungraded reflection/model answer.

Free Exploration adjusts masses (1–10 kg each), stiffness (1–20 N/m), and initial
compression (0.2–2 m). Defaults: 2 kg each, 2 N/m, 1 m. Both carts always begin at
rest, and force magnitudes cannot be set independently. **Reset** retains settings;
**Reset to Defaults** restores the default experiment. Free settings survive a
switch to guided mode and back.

The spring is an ideal massless, compression-only coupling. With reduced mass
μ = mA mB/(mA+mB), compression is δ(t) = δ₀ cos(√(k/μ)t) until the first zero at
π/(2√(k/μ)). The engine uses this exact harmonic time propagator as its integrator,
then constant-velocity propagation after separation. This avoids numerical
stability restrictions and accumulated integration drift. Forces are −kδ and
+kδ, and accelerations follow F/m. Energy and momentum are conserved within
floating-point tolerance. There is no attractive force after separation.

Cart bodies are 1 m wide; the uncompressed spring length is 4 m. Initial spacing
keeps carts from overlapping for the entire supported range. The view expands as
the carts separate and labels its scale. Observation ends at 6 s or the first
cart outer-edge crossing of ±50 m, retaining the incident velocities without
simulating an impact. Separate diagrams show weight and normal force, which
balance vertically but are not each other’s Third Law partners. The horizontal
pair labels refer to the effective cart-to-cart interaction transmitted by the
massless spring; a massive spring would need separate momentum accounting.

Current suite: **63 passed, 0 failed** (`node --test`), including all 55 previous
tests. See [THIRD_LAW_TEST_REPORT.md](THIRD_LAW_TEST_REPORT.md) for reference cases,
browser verification, modified files, and limitations.

## Interactive Third Law free-body diagrams

Build the Free-Body Diagram is available in T1–T3 and Free Exploration.
One Cart A/B selector chooses the proposal to edit; both verified diagrams
appear directly below the animation (stacked on narrow screens). Select forces
and press **Check diagram**. Checking pauses the simulation and evaluates the
displayed time. Correct selections reveal the live diagram; incorrect selections
offer **Try again** or **Reveal diagram** with targeted feedback.

Weight and normal force balance on each cart. Spring force acts only during
contact; friction is absent and the reaction force belongs on the other cart.
Proposals are kept separately for each cart. Verified diagrams follow the live
simulation, while feedback retains the checked time. Once both diagrams are
revealed, expand the Third Law pair follow-up. Simulation Reset clears answers
and restores initial contact.

Essential force and acceleration comparisons stay visible. Expand **Explore
the data** for detailed measurements and synchronized graphs. Horizontal arrows
share a labeled scale; vertical arrows are schematic. Native controls support
keyboard input and touch without dragging.

Verification: **73 tests passed, 0 failed**. Tests cover force ownership,
vertical balance, symmetry, separation, paused physics, reset, per-cart drafts,
incorrect-answer disclosure, and the pair follow-up. Browser checks covered
checking/revealing, pause, separation, reset, graphs, and a 768px tablet layout
without horizontal overflow. No browser console errors were captured.

Manual check: choose Free Exploration, select Weight, Normal force, and Spring
interaction force for each cart, and check each diagram. Run to separation:
horizontal arrows disappear. Retry with Weight and Normal only. Try friction
or the other-cart reaction for feedback, then expand the pair question and
Explore the data. Repeat in T1–T3.

Limitations: responses are not persisted; physical iPads, Safari/Firefox, and
screen readers have not been tested. The ideal massless-spring physics is
unchanged. Updated preview: artifacts/fbd-simplified.jpg.

## Forces That Change (Module 05, calculus / engineering tier)

Open `/modules/variable-forces/index.html` or catalog card 05. The first calculus-tier module:
forces depend on velocity or position, so motion is the solution of an ODE. Spec:
[docs/specs/forces-that-change.md](docs/specs/forces-that-change.md).

**Scenarios**
- **Drag:** m v′ = F − b v (linear) or m v′ = F − c v² (quadratic), F ≥ 0 and v₀ ≥ 0 so velocity never
  reverses. Exact solutions (exponential; tanh/coth; coasting 1/(1 + c v₀ t/m)). Terminal speed and τ are
  marked on the v graph. Observation: 10 s or x = 50 m (bisection on the exact x(t)).
- **Spring and damper:** m x″ + b x′ + k x = 0. Exact solutions for undamped, underdamped, critical
  (|ζ − 1| < 1e-9) and overdamped motion; ω₀, ζ, regime and b for ζ = 1 are shown, with a
  **Set critical damping** button. Energy bar: kinetic, spring, and energy removed by the damper
  (E₀ − KE − PE, verified against ∫ b v² dt in tests). Observation: 20 s.

**Calculus tools**
- **Show the math:** the ODE and solution with current values; an inspect-time slider t*; tangent lines on
  x(t) and v(t) whose slopes equal v and a; shaded areas under v(t) and a(t) equal to Δx and Δv, measured by
  finite differences and the trapezoid rule and compared with the exact values.
- **Numerical methods:** Euler, semi-implicit Euler and RK4 (`js/core/integrators.js`, generic f(t, y))
  overlaid at h = 0.5 to 0.01 s; |x_num − x_exact| on a log scale; total energy per method for the spring.
- **CSV export:** exact samples every 0.01 s with forces and energies, plus selected methods at their own
  steps (blank between steps).

**Guided activities** (prediction-gated, misconception feedback, ungraded reflection and model answer):
V1 terminal velocity (v_T = F/b = 3 m/s); V2 doubling mass (same v_T, τ doubles); V3 critical damping
(b = 2√(km) = 8 kg/s, the chosen b is run and all three are overlaid); V4 Euler energy growth
(× 1 + (ωh)² = 1.16 per step). Answer-revealing readouts stay hidden until the run completes.

**Files:** `js/core/drag-physics.js`, `oscillator-physics.js`, `integrators.js`, `variable-run.js`;
`js/components/calc-graph.js`, `csv-export.js`; `modules/variable-forces/` (`index.html`, `app.js`,
`scenes.js`, `activities.js`, `variable-forces.css`). Existing modules are unchanged.

**Verification:** `node --test` → 99 passed, 0 failed (73 prior + 26 new: ODE residuals across parameter
grids, exact vs RK4 at h = 1e-4, limits as drag → 0, regime continuity, energy bookkeeping, convergence order
≈2× Euler / ≈16× RK4, Euler energy factor, boundary time, CSV, V1–V4 numbers). Browser checks (Chromium):
both scenarios, math panel values equal exact values, numerical overlays, CSV download, V1–V4 end to end,
no console errors, no page-wide overflow at 390, 768 and 1366 px. Not yet tested on physical iPads/iPhones,
Safari or Firefox, or with a screen reader. On phones the scene drawing is small; graphs and readouts carry
the detail.

## Solve it — block-based problem solving (Newton's Laws tab 04)

Open `/modules/newtons-laws/solve.html` or the **04 Solve it** tab on any Newton's Laws page. Students build a
solution from blocks: correct steps plus distractors that each encode a misconception (Parsons-problem format).
Spec: [docs/specs/solve-it.md](docs/specs/solve-it.md); original idea: [docs/ideas/block-problem-solver.md](docs/ideas/block-problem-solver.md).

- **Problems:** S1 Pushed cart (F = ma, v = v₀ + at, x = v₀t + ½at²) and S2 Sliding to a stop (N, friction,
  a, stopping time and distance). Problems are data in `modules/newtons-laws/solve-problems.js`.
- **Building:** tap or Enter adds a block; ↑ ↓ ✕ reorder or remove; mouse drag-and-drop on desktop. Works by touch.
- **Check & run:** each block is marked ✓ correct, ✗ misconception (targeted feedback), or ↕ out of order /
  builds on a flawed step. Missing steps are listed. Score = correct blocks in a valid position ÷ required steps,
  shown with the attempt count. Any order that respects step dependencies is accepted.
- **Run:** the true motion runs on the track; if the student's blocks imply a different model (wrong
  acceleration or ignored v₀), a dashed ghost cart and dashed graph curves show that model. ✕ marks plot the
  student's numerical answers; a table compares them with the simulation.
- Nothing is stored or sent. Checker: `solve-check.js`; tests: `tests/solve.test.js` (10 tests: data integrity,
  answers vs the physics engine, valid/commuting orders, out-of-order and flawed-prerequisite feedback,
  distractors, missing/duplicate steps, ghost model, shuffle).

Verification: `node --test` → 109 passed, 0 failed. Browser (Chromium): wrong then correct S1 attempts, keyboard
entry, reordering, S2 with distractors, no console errors, no page-wide overflow at 390 px; existing Newton's
Laws pages load with the new tab. Not yet tested on physical phones/tablets, Safari/Firefox or a screen reader.
