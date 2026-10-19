# Spec: Module 06 — Electromagnetism (algebra core, calculus extensions)

**Audience:** algebra-based intro physics (AP Physics 2 / college physics) as the core, with an optional
calculus tier on each topic for engineering physics and physics majors.
**Purpose:** a new section of the lab covering electric charge through electromagnetic waves, built as
11 topic labs (E1–E11) behind one module hub.
**Status:** draft. This round adds the spec, the hub page and catalog card 06 only; each topic lab is
its own later branch and PR. Do not merge a topic to `main` until browser-verified: merges go live in Canvas.

## Ground rules (same as the existing lab)

- Plain HTML/CSS/JS ES modules. No dependencies, CDN, build step, accounts or tracking.
- Physics core in `js/core/` stays DOM-free and SI-unit. Reuse `SimulationClock`, `CalcGraph`,
  `integrators.js` and `csv-export.js`, and the shared CSS.
- Exact analytical results wherever they exist. Where a result needs numerics (field-line tracing,
  arbitrary circuits), the numerical answer is tested against a case with a known exact answer.
- Same learning loop as Newton's Laws: predict, run, explain. Guided activities are prediction-gated,
  give misconception-specific feedback, and end with an ungraded reflection and model answer.
- Algebra core first. The calculus tier is a toggle on the same lab ("Show the calculus"), never a
  separate page, so both audiences share one simulation.
- Links use explicit `index.html` paths (static hosts). Do not change existing modules. All existing
  tests must still pass.

## Constants (`js/core/em-constants.js`)

k = 8.988 × 10⁹ N·m²/C², ε₀ = 8.854 × 10⁻¹² C²/(N·m²), μ₀ = 4π × 10⁻⁷ T·m/A (state that the 2019 SI value
differs only in the 10th digit), e = 1.602 × 10⁻¹⁹ C, mₑ = 9.109 × 10⁻³¹ kg, c = 2.998 × 10⁸ m/s.

## Hub and navigation

```text
index.html                              Catalog card 06 "Electromagnetism" → modules/electromagnetism/index.html
modules/electromagnetism/index.html     Hub: 11 topic cards in 3 units, tier note
modules/electromagnetism/em-hub.css     Unit headings and topic-card tweaks on top of the catalog styles
modules/electromagnetism/<topic>.html   One page per topic as it is built (e.g. coulomb.html)
```

Units: **Electrostatics** (E1–E4), **Current and circuits** (E5–E7), **Magnetism and waves** (E8–E11).
Each topic card links once its lab ships; until then it shows "Coming soon". Each topic page carries a
`law-nav` style strip for the topics in its unit, like the Newton's Laws tabs.

## Shared engines (built with the first topic that needs them)

```text
js/core/electrostatics.js   Point charges: force, field, potential, superposition; field-line tracer (RK4 on E/|E|)
js/core/circuits.js         DC network solver (modified nodal analysis, Gaussian elimination), RC/RL transients
js/core/magnetism.js        B of wires/loops/solenoids, Lorentz force, charged-particle orbits
js/core/ac-circuits.js      Phasors and impedance for R, L, C; RLC response (time domain reuses oscillator-physics.js)
js/components/field-view.js SVG field grid, field lines, equipotentials, draggable charges
js/components/circuit-view.js SVG circuit board: drag components onto a grid, meters, current animation
```

## Topics

Each entry lists the algebra core, the calculus tier, the lab, two or more guided activities and the
misconceptions the feedback targets.

### E1 — Electric charge and Coulomb's law
- **Core:** charge is conserved and quantized (q = n e); charging by friction, conduction and induction;
  conductors vs insulators; F = k|q₁q₂|/r², like charges repel; superposition of forces.
- **Calculus:** force from a uniformly charged rod on a point charge, ∫ k λ dx / x², checked against the
  point-charge limit far away.
- **Lab:** drag 1–4 point charges (±1 to ±10 μC) on a 2D plane; force vectors on each charge with
  components; distance readout; "double r" and "double q" buttons. An electroscope scene for charging by
  induction.
- **Guided:** C1 doubling distance quarters the force; C2 Newton's third law pair for unequal charges
  (equal forces, opposite directions); C3 net force on a charge between two others (zero-force point).
- **Misconceptions:** the bigger charge pushes harder; force halves when distance doubles; charging
  creates charge.

### E2 — Electric field
- **Core:** E = F/q for a small test charge; E = k|q|/r² for a point charge; superposition; uniform field
  between parallel plates; a charged particle in a uniform field moves like a projectile (a = qE/m).
- **Calculus:** fields of a line, ring and disk by integration; on-axis limits; the infinite-plane limit
  σ/(2ε₀).
- **Lab:** the E1 plane with a vector grid and a draggable test charge; a parallel-plate deflection
  scene (electron between plates, adjustable E, v₀, plate length) with exact trajectory.
- **Guided:** F1 the field does not depend on the test charge; F2 field at the midpoint of a dipole;
  F3 electron deflection (predict where it hits the screen).
- **Misconceptions:** no test charge means no field; the field points toward positive charges; heavier
  particles deflect less only because of charge.

### E3 — Electric field lines
- **Core:** drawing rules: lines start on +, end on −, number ∝ |q|, density ∝ |E|, never cross,
  tangent gives the direction of E (not the path of a charge), perpendicular to a conductor's surface.
- **Calculus:** electric flux Φ = ∮ E · dA and Gauss's law; a draggable Gaussian surface shows
  Φ = q_enclosed / ε₀ whatever its shape or size.
- **Lab:** line tracer for the E1 charge set (RK4 on the unit field, seeded around each positive charge
  in proportion to q); a "student sketch" layer to compare a prediction with the traced lines.
- **Guided:** L1 sketch a dipole then reveal; L2 unequal charges (+2q, −q): where the extra lines go;
  L3 does a released charge follow a curved field line? (no: it follows F = ma).
- **Misconceptions:** field lines are real paths; lines can cross; no line through a point means no field.

### E4 — Electric potential and capacitance
- **Core:** ΔU = qΔV; V = kq/r and superposition (a scalar sum); equipotentials ⟂ field lines;
  E = −ΔV/Δd in a uniform field; the electron-volt; capacitors: C = Q/V, C = ε₀A/d (with dielectric κ),
  U = ½CV², series and parallel.
- **Calculus:** V = −∫ E · dl; E = −∇V read off the equipotential map; energy density ½ε₀E².
- **Lab:** equipotential map for the E1 charge set with a voltmeter probe; a parallel-plate capacitor
  bench (A, d, κ, battery connected or disconnected) with Q, V, E, C and U readouts.
- **Guided:** P1 the potential at the midpoint of a dipole is zero while the field is not; P2 pull the
  plates apart with the battery disconnected (Q fixed, V and U rise); P3 accelerate an electron through
  ΔV (speed from ½mv² = eΔV).
- **Misconceptions:** zero field means zero potential (and the reverse); potential and potential energy
  are the same thing; capacitors store charge (they store energy; net charge is zero).

### E5 — Electric current
- **Core:** I = ΔQ/Δt; conventional current vs electron flow; drift speed I = nqAv_d (mm/s, yet the
  signal is near-instant); a complete circuit is needed.
- **Calculus:** I = dQ/dt; Q = ∫ I dt as an area under a current graph; current density J.
- **Lab:** zoom into a wire: electrons drift (speed scaled, real value printed) while the field sets up
  along the wire; counter at a cross-section for ΔQ/Δt.
- **Guided:** I1 compute v_d for a copper wire (n = 8.5 × 10²⁸ m⁻³) and compare with the light-turn-on
  delay; I2 halve the wire's area at constant current (v_d doubles).
- **Misconceptions:** electrons race from the battery to the bulb; current is used up in a bulb.

### E6 — Resistance and Ohm's law
- **Core:** R = ρL/A; V = IR for ohmic materials; I–V graphs of a resistor, a filament bulb and a diode;
  temperature dependence R = R₀(1 + αΔT); power P = IV = I²R = V²/R; kilowatt-hours.
- **Calculus:** resistance of a tapered conductor, R = ∫ ρ dx / A(x); P as dU/dt.
- **Lab:** wire bench (material, length, area) and a variable supply; live I–V plot; switch the device
  to a bulb or diode and watch the plot stop being a line.
- **Guided:** R1 double the length and halve the area (R quadruples); R2 is the bulb ohmic? (no:
  R rises as it heats); R3 which bulb is brighter, 60 W or 100 W, in series on 120 V?
- **Misconceptions:** resistance depends on the voltage applied; a thicker wire has more resistance;
  higher power rating always means brighter.

### E7 — Circuits and DC instruments
- **Core:** series and parallel resistors; Kirchhoff's junction and loop rules; emf and internal
  resistance (terminal voltage V = ε − Ir); ideal and real ammeters and voltmeters and how they load a
  circuit; galvanometer with shunt or multiplier resistor; Wheatstone bridge; RC charging time constant τ = RC.
- **Calculus:** RC and RL circuits as first-order ODEs, q(t) = Cε(1 − e^(−t/RC)), reusing
  `integrators.js` and `CalcGraph` for exact vs numerical, as in Forces That Change.
- **Lab:** circuit board: drag batteries, resistors, bulbs, switches, capacitors and meters onto a grid;
  the MNA solver gives every node voltage and branch current; animated current; meters show real
  readings including their own resistance.
- **Guided:** K1 add a bulb in parallel: what happens to the first bulb? (unchanged with an ideal
  battery, dimmer with internal resistance); K2 voltmeter placed in series by mistake; K3 build a
  0–10 V voltmeter from a 1 mA, 50 Ω galvanometer; K4 RC flash: time to reach 63%.
- **Misconceptions:** the battery is a constant-current source; current is used up along a series
  circuit; adding resistors in parallel increases total resistance.

### E8 — Magnetism
- **Core:** magnets and poles; field of a long straight wire B = μ₀I/(2πr); solenoid B = μ₀nI; force on a
  moving charge F = qvB sin θ and on a current F = ILB sin θ; right-hand rules; circular orbit
  r = mv/(qB); velocity selector and mass spectrometer; torque on a current loop and the DC motor.
- **Calculus:** Biot–Savart for a loop's axis; Ampère's law with a draggable loop around wires.
- **Lab:** compass grid around wires and magnets; a particle chamber (choose charge, mass, v, B
  direction) with the exact helix/circle; a motor scene with commutator.
- **Guided:** M1 force between parallel currents (same direction attract); M2 predict the orbit of an
  electron vs a proton at the same speed; M3 velocity selector: which speed passes undeflected
  (v = E/B).
- **Misconceptions:** magnetic force does work on a moving charge; field lines start on north poles
  and end on south; a magnet attracts all metals.

### E9 — Electromagnetic induction
- **Core:** flux Φ = BA cos θ; Faraday's law ε = −N ΔΦ/Δt; Lenz's law; motional emf ε = BLv; generators;
  eddy currents and magnetic braking; self-inductance and transformers (introduced here, used in E10).
- **Calculus:** ε = −dΦ/dt with Φ(t) graphed; RL circuit current I(t) = (ε/R)(1 − e^(−Rt/L)); energy ½LI².
- **Lab:** magnet through a coil with a galvanometer (speed, turns, pole); sliding rod on rails with
  exact v(t) under magnetic braking (an exponential, like linear drag in Module 05); rotating coil
  generator with ε(t) graph.
- **Guided:** N1 push the magnet in faster (bigger emf, same total charge through the meter);
  N2 predict the current direction with Lenz's law; N3 the falling magnet in a copper tube.
- **Misconceptions:** a strong steady field induces current; induced current always opposes the field
  (it opposes the change in flux).

### E10 — AC circuits and electrical technologies
- **Core:** V(t) = V₀ sin ωt; rms values (V₀/√2); transformers V_s/V_p = N_s/N_p and power transmission
  losses I²R; reactance X_L = ωL and X_C = 1/(ωC); impedance and phase; RLC resonance f₀ = 1/(2π√(LC));
  household safety: grounding, fuses, breakers, GFCI.
- **Calculus:** RLC as m x″ + b x′ + kx = F(t) (L ↔ m, R ↔ b, 1/C ↔ k), reusing `oscillator-physics.js`
  for the natural response; phasor diagrams; average power ½V₀I₀ cos φ.
- **Lab:** function generator + R, L, C with an oscilloscope (V and I traces, phase shift); a frequency
  sweep with the resonance curve; a power-grid scene (step-up, line resistance, step-down).
- **Guided:** A1 why transmit at high voltage (loss falls as 1/V² for the same power); A2 find the
  resonant frequency and the current there; A3 what a GFCI detects.
- **Misconceptions:** AC averages to zero so it delivers no power; a transformer works on DC;
  a capacitor blocks all current.

### E11 — Electromagnetic waves
- **Core:** an accelerating charge radiates; E ⟂ B ⟂ direction of travel; c = fλ; E₀ = cB₀; the
  spectrum from radio to gamma; intensity and the inverse-square law; polarization and Malus's law
  I = I₀ cos² θ.
- **Calculus:** the wave equation from Maxwell's equations, c = 1/√(μ₀ε₀); Poynting vector
  S = E × B/μ₀; radiation pressure I/c.
- **Lab:** an animated plane wave (E and B traces, adjustable f, wavelength readout, spectrum band);
  an oscillating-dipole antenna scene; a polarizer stack.
- **Guided:** W1 three polarizers at 0°, 45°, 90° (light gets through only with the middle one);
  W2 find λ for a 2.4 GHz Wi-Fi signal; W3 compute c from μ₀ and ε₀.
- **Misconceptions:** radio waves are sound waves; higher-frequency waves travel faster in vacuum.

## Suggested build order

1. E1 + `electrostatics.js` + `field-view.js` (unlocks E2–E4 quickly).
2. E2, E3, E4 on the same engine.
3. E5, E6, then E7 with `circuits.js` and `circuit-view.js` (the largest single piece).
4. E8, E9, E10, E11.

## Tests (node --test), per topic

- Engines against closed forms: Coulomb force symmetry and 1/r²; superposition; field and potential of
  dipoles on the axis and the bisector; E = −∇V by finite differences; Gauss's law flux = q/ε₀ for
  several surfaces; traced field lines start on + and end on − within tolerance.
- Circuits: series/parallel against hand values, Kirchhoff residuals ≈ 0 on random networks, meter
  loading, RC exact vs RK4.
- Magnetism and induction: orbit radius and period, velocity selector, ε = BLv, rod braking v(t) against
  its exponential.
- AC: rms, resonance frequency, impedance magnitude and phase, RLC natural response matches
  `oscillator-physics.js` under the L/R/C ↔ m/b/k mapping.
- Each guided activity's model answer computed from the engine, not typed in.

## Browser verification before merging (each topic)

Chromium at 390, 768 and 1366 px: no console errors, no page-wide overflow, keyboard access to every
control and draggable (arrow keys move a selected charge or component), guided activity end to end.
Note anything not yet tested (Safari, Firefox, iPad, screen reader).
