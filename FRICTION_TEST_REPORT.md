# Friction classroom pilot — verification report

Date: 17 October 2026. Target lesson: 19 October 2026.

## Implementation

Optional static/kinetic Coulomb friction extends the existing engine, cart, graphs, prediction controls, and guided workflow. Friction is disabled by default; A–D remain frictionless. Free Exploration retains independent mass, applied-force, and initial-velocity controls. Guided settings are locked and predictions must be saved before running. Results and misconception feedback appear after observation. Reflections reveal instructor-authored answers without automatic grading.

Normal force is mg with g = 9.81 m/s². At rest, static friction balances applied force up to and including μsN. While sliding, kinetic friction opposes velocity. Exact constant-acceleration segments end at zero velocity or a track boundary. At zero velocity the model re-evaluates static friction, avoiding overshoot and artificial reversal. Graphs include both sides of acceleration jumps at the exact event time.

## Automated verification

Command: `node --test`. **43 tests passed; 0 failed.** This includes all 28 existing physics/guided tests and 15 new friction tests in `tests/friction.test.js`.

Coverage includes signed static balance and threshold equality; positive/negative breakaway; friction opposing both velocity directions; exact stopping and sticking at multiple step sizes; superthreshold reversal; mass comparisons; event samples and acceleration jumps; unchanged frictionless samples and predictions; exact boundaries before/after reversal; zero coefficients; tiny velocities; stopping exactly at observation end; invalid coefficients; initial-acceleration prediction feedback; all F1–F3 presets, answers, and sequential trial guards. A 225-case friction parameter grid supplements the existing 75-case frictionless grid. Graph tests check the underlying shared sample data; SVG appearance was checked manually.

### Analytical reference cases

| Case | Reference result |
| --- | --- |
| F1, m = 2 kg, μs = .4, μk = .3 | N = 19.62 N; maximum static friction = 7.848 N |
| F1, applied +3 / +5 N | Friction −3 / −5 N; net force, acceleration, velocity, position all zero |
| F1, applied +10 N | Kinetic friction −5.886 N; net +4.114 N; a = 2.057 m/s²; at 3 s, v = 6.171 m/s, x = 9.2565 m |
| F2, v₀ = +4 m/s, applied 0 | a = −2.943 m/s² while sliding; stop at 4/2.943 ≈ 1.359157 s and x = 16/(2×2.943) ≈ 2.718315 m; then v, a, friction all zero |
| F3, masses 2 / 4 kg | Initial friction −5.886 / −11.772 N; both a = −2.943 m/s²; identical stopping time and distance |
| Reversal, m = 2, F = +10, v₀ = −4 | Initial a = +7.943 m/s²; stops at 4/7.943 s, then slides right with a = +2.057 m/s² |

Comparison tables use the same 3-second observation time and show initial sliding forces separately from final forces. F3 uses μs = .40 for both carts; with zero applied force, this choice does not affect their sliding deceleration or final rest.

## Browser checks performed

Tested in the Codex in-app browser against the local server:

- F1: saved prediction required, guided controls locked, all three trials executed in order, correct static/kinetic values and common-time results, reflection submission reveals model answer.
- F2: incorrect prediction receives misconception-specific feedback; pause/resume works; sliding friction points left; exact stop event appears at 1.359 s; final friction and acceleration are zero and cart stays at rest.
- F3: both runs completed; doubled initial friction, equal deceleration and final position; coincident velocity curves and explanatory legend.
- Free Exploration: moving μs below μk adjusts μk; moving μk above μs adjusts μs. Verified endpoints 0/0 and 1/1. Changing settings resets the activity. Quantitative friction case m2/F6/v0 accepts a0/v(3)0.
- Frictionless quantitative regression: m2/F6/v0 accepts a3 and v(3)9 with the original feedback. No browser console errors were captured during these checks.
- Laptop viewport 1366×900 and tablet viewport 768×1024 inspected. A tablet-width law-navigation overflow was corrected by containing its horizontal scroll. No whole-page horizontal overflow remained at 768 px.

## Launch and classroom access

From PowerShell:

```powershell
cd 'C:\Dave\Interactive Physics Labs'
node scripts/serve.js
```

Open `http://127.0.0.1:5173/modules/newtons-laws/`. Select **Guided Experiments**, choose **F1**, **F2**, or **F3** in the Friction group, save a prediction, then start. For comparisons, select **Prepare Run 2/3**, then start that run. Scroll below the graphs for results, feedback, and reflection. Select **Free Exploration** to adjust settings independently. Stop the server with Ctrl+C.

The included server binds to this computer only. Each laptop may run its own copy; tablets require these static files on an instructor-managed host reachable by their browsers. No hosting deployment or network-access change was made. Arrange and check device access before the lesson.

## Suggested 24-minute active-learning sequence

| Minutes | Activity |
| --- | --- |
| 0–2 | Establish right-positive signs, applied versus net force, and prediction-before-observation routine. |
| 2–9 | F1: students predict individually, discuss in pairs, then run +3, +5, +10 N. Ask why static friction changes between the first two trials. Submit a brief reflection. |
| 9–15 | F2: predict friction/acceleration directions, run and inspect velocity and acceleration near stopping. Ask why friction becomes zero at rest. Reflect before revealing the model answer. |
| 15–21 | F3: predict force and deceleration separately, run both masses, compare initial friction and common-time results. Explain why mass cancels from μkmg/m. |
| 21–24 | Exit explanation: distinguish actual static friction from its maximum, and explain why a stopped cart does not accelerate backward. If time permits, explore negative initial velocity in Free Exploration. |

## Limitations and untested behavior

- Physical tablets, touch ergonomics, Safari/Firefox, screen-reader behavior, classroom network access, and a live student pilot have not been tested. Viewport checks are not physical-device certification.
- This is idealized sliding friction; wheels are illustrative. No rolling resistance, air drag, collisions, slope, or force/coefficient changes within a run are modeled.
- Runs end at their observation time or the first outward ±50 m boundary crossing. The boundary retains incident velocity and is not a collision.
- Readouts round values; calculations retain precision. Graph axes rescale to observed values, and overlapping F3 velocity curves are intentional.
- Predictions, reflections, and results are in memory only and reset when leaving an activity or reloading. No assessment records or automatic free-text grading are provided.

## Files changed

- `js/core/physics.js`: friction balance, exact event segments, shared sampling and prediction calculations.
- `js/components/cart.js`, `js/components/graph.js`: force vectors, multi-run overlays, event markers.
- `modules/newtons-laws/index.html`, `experiment.js`: friction controls, diagnostics, preserved free/guided integration.
- `modules/newtons-laws/friction-experiments.js`: F1–F3 content and presets.
- `modules/newtons-laws/guided-experiments.js`, `guided-activity.js`: shared three-trial sequencing and force comparison rows.
- `css/styles.css`: friction panels and contained tablet navigation.
- `tests/friction.test.js`: analytical and regression coverage.
- `README.md`, `FRICTION_TEST_REPORT.md`: launch, model, verification, and classroom instructions.
