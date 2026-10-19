# Spec: Module 02 — Circular Motion (algebra core, calculus extensions)

**Audience:** algebra-based General Physics (PHY 2201), with exercise science / health science and construction
management students in mind (see the project notes on Biomechanics and GEN 2011 Applied Statics). An optional
"Show the calculus" panel on each lab serves calculus-ready students.
**Status:** hub and C1 built; C2–C9 planned. Each later lab is its own branch and PR, browser-verified before
merging (merges go live in Canvas).

## Ground rules (same as the rest of the lab)
- Plain HTML/CSS/JS ES modules, no dependencies or build step, no accounts or tracking.
- Physics in `js/core/` is DOM-free, SI units, exact closed forms where they exist, unit-tested.
- Learning loop: predict → run → explain. Guided activities are prediction-gated, give misconception-specific
  feedback, and end with an ungraded reflection and a model answer. Numbers that would give the answer away are
  hidden until a prediction is saved.

## Sections

| Unit | Lab | Core idea | Contexts |
|---|---|---|---|
| 1 Circular motion | **C1 Uniform circular motion (built)** | v = 2πr/T, a = v²/r toward the centre, F = m v²/r; cut the string → tangent | puck on a string, hammer throw, merry-go-round |
| | C2 What provides the force? | identify tension, friction, gravity or normal force as the centripetal force; no centrifugal force on the object | car on a curve, satellite, rider on a ride |
| 2 Applied cases | C3 Flat curves | static friction supplies m v²/r; v_max = √(μs g r) | cars, cyclists, runners (lane 1 vs lane 8) |
| | C4 Banked curves | the normal force's horizontal component helps; design speed tan θ = v²/(r g) | highway ramps, velodromes, banked indoor tracks |
| | C5 Vertical circles | apparent weight N = m g ± m v²/r at bottom/top; minimum speed √(g r) at the top | loops, swings, bucket of water |
| 3 Rotational motion | C6 Angular kinematics | θ, ω, α; v = ω r, a_t = α r | wheels, limbs (gait), power tools |
| | C7 Torque and equilibrium | τ = r F sin φ; ΣF = 0 and Στ = 0 | forearm/biceps lever (biomechanics); planks, beams, ladders (statics) |
| | C8 Rotational dynamics | τ = I α; moment of inertia depends on mass distribution | doors, flywheels, swinging a limb |
| | C9 Rolling and angular momentum | rolling race down a ramp; L = I ω conserved | divers, skaters, hoops vs discs |

C7 is the bridge to GEN 2011 (support reactions, moments) and to Biomechanics (levers in the body).

## C1 Uniform circular motion (built)

Files: `js/core/circular-physics.js`, `modules/circular-motion/uniform.html/js`, `activities.js`, `circular.css`.

- **Model:** top view of a puck on a frictionless table tied to a centre pin. r(t) = r(cos ωt, sin ωt).
  Cutting the string removes the only horizontal force, so the puck continues along the tangent at constant
  velocity until it leaves the 3.2 m table. Samples on both sides of the cut are exact.
- **Free exploration:** mass 0.1–5 kg, radius 0.5–2 m, speed 0.5–6 m/s; show/hide v, a, F and the trail;
  ✂ Cut the string (button or the C key) at any moment.
- **Readouts:** time, speed, period, centripetal acceleration, tension, ω. Graphs: x and y, vₓ and v_y, tension.
- **Key ideas panel:** T = 2πr/v, ω = v/r, a = v²/r, F = m v²/r with live values.
- **Show the calculus:** r(t), v = dr/dt, a = dv/dt = −ω² r with live vectors; r · v = 0.
- **Guided activities:**
  - U1 The string breaks (path after the cut: tangent, not outward or spiral)
  - U2 Hammer throw: double the speed (F × 4)
  - U3 A wider circle at the same speed (F ÷ 2)
  - U4 Merry-go-round: same period, wider circle (F × 2), contrasted with U3

  Correct answers are checked against the physics in `tests/circular.test.js`.
