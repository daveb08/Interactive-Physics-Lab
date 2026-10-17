# Interactive Physics Lab

A dependency-free HTML/CSS/JavaScript learning laboratory. The first working experiment explores Newton’s Second Law with a cart, signed forces and velocities, synchronized SVG graphs, and prediction activities. First and Third Law experiments and other modules are labeled **Coming soon**.

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

This phase includes only the Second Law module. There are no collisions, rolling resistance, air resistance, applied-force changes within a run, persistence, export, or assessment records. Free Exploration graphs rescale vertically; guided velocity overlays share axes within each comparison. Guided predictions use a fixed instructor-authored question bank. Reflections are not automatically graded or persisted. The development server is for local use, not production hosting.

Physical-tablet and classroom usability/accessibility checks remain necessary; viewport checks do not replace testing on the devices students will use.
