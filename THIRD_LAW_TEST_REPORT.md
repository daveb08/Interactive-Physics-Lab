# Third Law implementation and verification

## Physics and automated results

`node --test`: **63 passed, 0 failed**, including all 55 prior tests and eight new spring tests. No changes to First/Second Law physics were needed for this addition. Only their navigation links were enabled for Third Law; the shared graph renderer accepts optional series names with its existing defaults unchanged.

The engine uses an exact harmonic time-step integrator for the compressed spring and exact coasting afterward. One shared force magnitude enforces F_A = −F_B at every sample. A single relative coordinate plus fixed center of mass preserves momentum and energy to floating-point tolerance. Separation occurs at the first zero compression, with continuous positions and velocities and zero subsequent force. The model never extends the spring into tension.

Tests cover force symmetry; equal-mass acceleration symmetry; unequal-mass force, acceleration, and velocity ratios; analytical release time and speed; continuity; momentum and total mechanical energy over 81 parameter combinations; non-overlap; exact separation samples across different step sizes; both outer-edge boundaries; guided prediction gating and fixed presets; free-setting isolation; invalid inputs and shorter observations.

Reference values:

| Setup | Expected outcome |
| --- | --- |
| T1: mA=mB=2 kg, k=2 N/m, δ₀=1 m | Initial forces −2/+2 N; accelerations −1/+1 m/s²; release t=π/(2√2)=1.110721 s; velocities −0.707107/+0.707107 m/s |
| T2: mA=2, mB=4 kg; same spring | Initial forces −2/+2 N; accelerations −1/+0.5 m/s²; release t=π/(2√1.5)=1.282550 s; velocities −0.816497/+0.408248 m/s |
| After separation | Both interaction forces and accelerations zero; both carts coast; total momentum stays zero |
| Boundaries | Stop observation when either 1 m cart’s outer edge reaches ±50 m; retain incident velocities; no collision |

## How to test in the browser

Use the existing local server, or run `node scripts/serve.js` from the project root. Open `http://127.0.0.1:5173/modules/newtons-laws/third-law.html`.

1. T1: confirm Start is disabled until a prediction is saved. Run, pause during contact, and compare the equal force and acceleration magnitudes. Resume through separation.
2. T2: repeat with unequal masses. Force magnitudes should still match while Cart A has twice Cart B’s acceleration magnitude.
3. T3: identify the forces on different carts. Inspect both diagrams and complete the reflection to reveal a model answer.
4. Free Exploration: change all four parameters; observe the linked forces. Reset retains parameters; Reset to Defaults restores 2/2 kg, 2 N/m, 1 m. Changing modes must not alter guided presets.
5. Boundary case: masses 1/10 kg, stiffness 20 N/m, compression 2 m. Cart A reaches the left edge before 6 s; the interface must explain why observation ends.
6. Follow navigation back to First and Second Law and verify existing controls remain available.

## Known limitations

- Ideal linear, massless spring and frictionless track; both carts start at rest. No damping, spring mass, attractive force, collisions, or repeated contact.
- A spring with appreciable mass would require a three-body momentum model. The UI explains the massless two-body approximation.
- Arrows share a scale during each run, normalized to its initial force. Vertical free-body arrows use a separate scale. Numeric labels provide absolute force values.
- Camera width changes to keep both carts visible. Physics uses fixed physical boundaries; plotted values are not affected by camera scaling.
- Six-second observations may end at a boundary. No wall impact or momentum change is simulated.
- Reflections and activity state are not persisted or automatically graded.
- Physical iPads, touch usability, Safari/Firefox, and screen-reader testing have not been performed. Desktop/tablet viewport checks are not device certification.
- Changes are local and have not been committed or pushed for this phase.

## Files added or changed for Third Law

- `js/core/spring-physics.js`: pure two-cart spring model and exact event propagation.
- `js/components/spring-view.js`: two-cart animation, force arrows, and separate free-body diagrams.
- `js/components/graph.js`: optional Cart A/Cart B series labels, preserving existing Run labels.
- `modules/newtons-laws/third-law.html`, `third-law.css`, `third-law.js`: responsive interface and controller using the existing clock and graphs.
- `modules/newtons-laws/third-law-activities.js`: T1–T3 content and testable guided/free session logic.
- `modules/newtons-laws/index.html`, `first-law.html`: enabled Third Law navigation.
- `tests/spring.test.js`: eight analytical, invariant, event, and workflow tests.
- `README.md`, `THIRD_LAW_TEST_REPORT.md`: instructions and verification.

## Browser verification performed

Tested with the existing local server in the in-app browser:

- Completed T1: equal/opposite velocities ±0.707 m/s, zero force after separation, guided explanation visible.
- Paused T2 during contact: forces −1.844/+1.844 N and accelerations −0.922/+0.461 m/s². Resumed through separation: velocities −0.816/+0.408 m/s with zero force and acceleration.
- Completed T3 with an incorrect prediction, inspected the explanation, and submitted a reflection to reveal the instructor-authored model answer.
- Free Exploration: changed all four parameters, verified the 1/10 kg high-energy boundary case at xA = −49.5 m (outer edge −50 m), confirmed Defaults, and verified guided presets remain unchanged while free settings are restored on return.
- Inspected 1366×900 laptop and 768×1024 tablet layouts. Tablet controls/diagrams stack for readability with no page-wide horizontal overflow.
- Followed navigation to First Law Free Exploration and Second Law quantitative controls and A–D/F1–F3 selector entries. All remained accessible.
- No browser console errors were captured. Verified 41 local source/HTML references; `git diff --check` found no whitespace errors.
- Preview: `artifacts/third-law-preview.png`. The user's existing server was reused and left running. No commit or push was made.
