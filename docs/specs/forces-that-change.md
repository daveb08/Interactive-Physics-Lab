# Spec: Module 05 — Forces That Change (calculus / engineering tier)

**Audience:** calculus-based intro physics (engineering physics, physics majors).
**Purpose:** first module of the calculus/engineering tier. Forces depend on velocity or position, motion is the solution of an ODE, and students see derivatives, integrals and numerical methods live.
**Status:** draft for implementation with Claude Code. Do not merge to `main` until browser-verified: merges go live in Canvas.

## Ground rules (same as the existing lab)

- Plain HTML/CSS/JS ES modules. No dependencies, CDN, build step, accounts or tracking.
- Physics core in `js/core/` stays DOM-free and SI-unit. Reuse `SimulationClock`, `MotionGraph` and the shared CSS.
- Exact analytical solutions wherever they exist; every sample is evaluated from initial conditions (no accumulated drift), as in `physics.js`.
- Do not change existing Newton's Laws behaviour. All 73 existing tests must still pass.
- Work on a branch; open a PR.

## Files

```text
js/core/drag-physics.js          Linear and quadratic drag, exact solutions
js/core/oscillator-physics.js    Mass-spring-damper, exact solutions
js/core/integrators.js           Euler, semi-implicit Euler, RK4 (generic ODE stepper)
js/components/math-panel.js      Show-the-math panel (tangent, shaded areas, equations)
js/components/csv-export.js      Build and download CSV from samples
modules/variable-forces/index.html, drag.js, oscillator.js, activities.js
tests/drag.test.js, tests/oscillator.test.js, tests/integrators.test.js
index.html                       Add catalog card 05 "Forces That Change" (calculus tier badge)
```

## Scenario A: drag on a cart (horizontal track, ±50 m as now)

Controls: mass m (1–10 kg), constant applied force F (0–20 N), initial velocity v0 (0–10 m/s), drag model (linear / quadratic), coefficient b (0.1–5 kg/s) or c (0.05–2 kg/m).

Restrict to F ≥ 0 and v0 ≥ 0 so velocity never changes sign (keeps quadratic drag exact). State this in the UI.

- Linear, m dv/dt = F − b v:
  v(t) = F/b + (v0 − F/b) e^(−t/τ), τ = m/b; x(t) = (F/b) t + τ (v0 − F/b)(1 − e^(−t/τ)).
- Quadratic, m dv/dt = F − c v²:
  - F = 0 (coasting): v = v0 / (1 + c v0 t / m), x = (m/c) ln(1 + c v0 t / m).
  - F > 0: terminal speed vT = √(F/c), τq = m / (c vT); solve with the exact tanh/coth form for v0 below/above vT (v0 = vT stays constant). Derive x(t) by exact integration (ln cosh / ln sinh forms).
- Limit check: as b → 0 or c → 0 the result must approach the constant-acceleration engine.
- Observation ends at 10 s or the first track-boundary crossing (solve numerically to 1e-9 s with bisection on the exact x(t)).

## Scenario B: mass-spring-damper (cart attached to a wall)

Controls: m (0.5–10 kg), k (1–50 N/m), b (0–20 kg/s), initial displacement x0 (−1 to 1 m), v0 (−3 to 3 m/s). Display ω0 = √(k/m), ζ = b / (2√(km)), and the regime (undamped, underdamped, critical, overdamped). Include a "Set critical damping" button.

- m x'' + b x' + k x = 0, exact solutions for all three regimes. Treat |ζ − 1| < 1e-9 as critical.
- Energy readouts: KE, spring PE, total, and energy dissipated = ∫ b v² dt (exact or by high-resolution quadrature; must match the drop in total energy within 1e-6 relative).
- Observation: 20 s.

## Show-the-math panel (both scenarios)

- The governing ODE and its solution, with current values substituted (plain text/HTML, no TeX library).
- Linked graphs x(t), v(t), a(t). A scrubber or the running time draws:
  - the tangent line on x(t) whose slope equals v at that instant (value printed);
  - the tangent on v(t) whose slope equals a;
  - the shaded area under v(t) from 0 to t, labelled "= Δx", and under a(t) labelled "= Δv", with the values printed and checked against x(t) − x0 and v(t) − v0.
- Scenario A: horizontal dashed line at terminal velocity and a marker at t = τ (63% of the approach).

## Numerical methods comparison

- Toggle: overlay Euler, semi-implicit Euler and RK4 on x(t) and v(t), with step h selectable (0.5, 0.2, 0.1, 0.05, 0.01 s).
- Error plot: |x_numeric − x_exact| vs time, log scale.
- Scenario B: total energy vs time for each method (Euler grows, semi-implicit stays bounded, RK4 drifts slowly).
- `integrators.js` takes a generic `f(t, y)` so later modules can reuse it.

## Data export

- "Download CSV": `t, x, v, a, F_applied, F_drag_or_spring, F_damping, KE, PE, E_total` plus numerical-method columns when shown. Header row with units. Exact samples at 0.01 s.
- Short note: "Open in MATLAB with readtable, or in Python with pandas.read_csv."

## Guided activities (prediction first, same flow as A–D)

| ID | Question | Locked settings | Correct idea |
|---|---|---|---|
| V1 | What speed does the cart approach? | linear drag, m 2 kg, F 6 N, b 2 kg/s, v0 0 | vT = F/b = 3 m/s |
| V2 | Double the mass: what happens to vT and to the time to approach it? | as V1, then m 4 kg | vT unchanged; τ = m/b doubles |
| V3 | Which b makes the cart return fastest without overshoot? | m 1 kg, k 16 N/m, x0 0.5 m | critical damping, b = 2√(km) = 8 kg/s |
| V4 | With h = 0.1 s, does Euler's spring energy grow, shrink or stay constant? | undamped, m 1 kg, k 16 N/m | grows each step (energy not conserved) |

Each activity: saved prediction gates Start; feedback names the misconception; an ungraded reflection reveals a model answer.

## Tests (node --test)

- Exact solutions satisfy the ODE: finite-difference residual < 1e-6 across a parameter grid.
- Exact vs RK4 at h = 1e-4: agreement < 1e-8.
- Limits: b, c → 0 matches `physics.js`; ζ just above/below 1 is continuous with critical.
- V1–V4 expected numbers.
- Convergence order: halving h cuts Euler error about 2× and RK4 error about 16×.
- Energy bookkeeping: KE + PE + dissipated = initial energy within 1e-6 relative.
- CSV: header, units, row count, values equal to samples.
- Boundary crossing time for Scenario A.

## Browser verification before merging

- Run V1–V4 to completion; check readouts against the table.
- Show-the-math tangent slope equals the v readout; shaded areas equal Δx and Δv.
- Numerical overlay and error plot at each h.
- CSV opens with correct columns.
- Layouts at 390 px (phone), 768×1024 and 1366×900; no page-wide overflow; keyboard-operable controls.
- Existing Newton's Laws pages unchanged.
- Update README with a "Forces That Change" section and the test count.
