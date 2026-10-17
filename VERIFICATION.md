# Verification — October 15, 2026

## Guided enhancement verification

Implemented in two phases as requested:

- **Phase 1:** A/B prediction, simulation, structured feedback, reflection. `node --test`: **21 passed, 0 failed**. Browser verified both complete runs, misconception-specific A feedback, B reversal explanation, and reflection submission/model-answer disclosure.
- **Phase 2:** C/D controlled comparisons and velocity overlays. `node --test`: **28 passed, 0 failed**, including all 16 original physics tests and 12 guided tests.

New tests cover all four presets and correct choices, expected accelerations and analytical outcomes, B reversal at 2 s, prediction and sequencing guards, identical comparison endpoints, overlay sample histories, default/custom observation duration, and exact positive/negative boundary handling. Comparison logic rejects runs that ended before the common observation time rather than extrapolating beyond the boundary.

Browser verified:

- Guided settings lock before starting; Start requires a saved prediction. Acceleration and motion graphs are hidden before running.
- A: 18 m, +3 m/s, zero acceleration at 6 s. Incorrect slowdown prediction receives a friction/force explanation. Model answer appears after submitting reflection.
- B: 12 m, +8 m/s, +2 m/s² at 6 s; feedback explains the 2 s stop and reversal.
- C: sequential runs retain Run 1 results, with feedback withheld until Run 2. At 3 s, table shows a = 3 / 1.5, v = 9 / 4.5, x = 13.5 / 6.75 in SI units. Velocity overlay accessible description reports both runs and their common time.
- D: table shows a = 2 / 4, v = 6 / 12, x = 9 / 18 at 3 s. Incorrect unchanged-acceleration prediction receives a force/mass explanation. Reflection model answer submission works.
- Switching back restores Free Exploration settings (tested with 3 kg), unlocks sliders, and hides guided results. Original quantitative inputs remain available.
- Original quantitative feedback accepted a = 2 m/s² and v(3 s) = 6 m/s for a 3 kg cart under +6 N. No browser console errors were reported.
- Changing a saved guided prediction requires saving again before Start is enabled.
- At a 390 × 844 viewport, content width is within the viewport and reflection controls remain readable.
- The completed comparison table fits the 390 px viewport; desktop velocity overlays and legend were visually checked at 1280 × 900. Preview saved as `artifacts/guided-comparison.png`.

Files changed: `modules/newtons-laws/index.html`, `modules/newtons-laws/experiment.js`, `js/core/physics.js`, `js/components/graph.js`, `css/styles.css`, `README.md`, and `VERIFICATION.md`. Files added: `modules/newtons-laws/guided-experiments.js`, `modules/newtons-laws/guided-activity.js`, `tests/guided.test.js`, and the preview image.

The original baseline verification below is retained for context. Physical-device and cross-browser limitations still apply.

## Automated

`node --test`: **16 passed, 0 failed**. Includes all requested physics assertions and analytical verification of every sampled state for 75 mass/force/initial-velocity combinations. No dependencies were installed.

## Browser checks completed

Verified in the Codex in-app Chromium browser against the local Node development server:

- Catalog renders and links to the Newton’s Laws module.
- Start is disabled until a prediction is saved.
- Conceptual prediction → save → start → boundary completion → explanatory feedback.
- Default run ends at x = 50.00 m, t = 5.77 s, v = 17.32 m/s, a = 3.00 m/s². Graph accessible descriptions match the displayed state.
- Quantitative prediction of a = 3 m/s² and v(3 s) = 9 m/s receives “within tolerance” feedback for both answers.
- Reset and mode switching clear the run and prediction while retaining settings.
- Keyboard range controls set mass = 1 kg, force = −20 N, initial velocity = −5 m/s. Negative position, velocity, acceleration, and the force arrow render correctly.
- Pause freezes the measurement at 0.29 s across subsequent inspection; Resume continues the same experiment.
- Settings and predictions lock during an experiment.
- Desktop layout and 390 × 844 viewport inspected visually; controls, cart, graphs, and activity stack on narrow screens.
- At 390 px viewport width, document content remained within the viewport. No browser console errors were reported during the checks.

The initial sandbox server was unreachable from the browser. Restarting the same development server outside the sandbox enabled browser verification at http://127.0.0.1:5173/.

## Not verified

Physical tablet touch behavior, Safari/macOS, Firefox, real mobile hardware, screen-reader user testing, and classroom learning outcomes were not tested. Responsive browser emulation is not a substitute for those device and accessibility checks. No hosted deployment was requested or performed.
