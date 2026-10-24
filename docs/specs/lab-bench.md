# Spec: Module 07 — Lab Bench (virtual measurement labs)

Decisions by Dave Bennett, 2026-10-22.
**Status:** Stages 1–3 built: Earth practice, mystery planets, and graded assignments with an instructor grading page. Each stage is its own branch and PR,
browser-verified before merging, because merges go live in Canvas.

## Purpose

Give students the experience of a real physics lab: a bench, a shelf of equipment, instruments with limited
precision, repeated trials, a lab notebook, a graph with a fit, and a result reported with an uncertainty. They
then explain why it differs from the expected value.

The lab is about **measurement and experimental method**. Kinematics (and later other topics) is the tool, not the
target. A simulator that hands students a perfect time and lets them compute g = 2h/t² teaches nothing. The
difficulty must sit where it sits in a real lab: imperfect readings, design choices, analysis and systematic error.

It complements the real PHY 2201 lab and does not replace it. Natural uses: a pre-lab before the real experiment,
makeup labs, online sections, and things a real lab cannot do (other planets, air vs no air, one error source at a time).

## Decisions

| Question | Decision |
|---|---|
| How much freedom | **Guided bench.** The assignment unlocks only the equipment it needs; students make real choices within it (object, heights, timer, number of trials). An open sandbox with any equipment is a later option, not v1. |
| Primary goal | Measurement and experimental method. A sensible value with a sensible uncertainty and a correct explanation of error counts as success, not "got 9.81". |
| Visual style | Plain 2D side view in the existing style. Effort goes into **process realism** (choices, readings, imperfections), not visual realism (no 3D room, no textures). |
| Where it lives | New top-level section **Lab Bench** (catalog card 07). Not inside Newton's Laws: every future lab reuses the same bench. |
| Grading | Simple built-in auto-grading so an instructor can assign a lab as graded work without marking by hand: a per-student mystery value, a completion code, and an instructor grading page (below). |
| Grading security | **Cheat-resistant, not cheat-proof.** Accepted for low-stakes lab grades. Everything runs in the browser; a student who reads the code could game it. |
| Student identity | Students type a name or student ID (ID preferred: names collide and get misspelled). Nothing is sent anywhere; it only seeds their mystery value and appears in their completion code. |
| Analysis | Graph and fit happen in the page. CSV export for students who also want Excel; Excel is never required. |

## Ground rules (same as the rest of the lab)

- Plain HTML/CSS/JS ES modules. No dependencies, CDN, build step, server, accounts or tracking.
- Physics in `js/core/` stays DOM-free and SI. Exact closed forms wherever they exist; numerics are tested against them.
- Learning loop as elsewhere: predict, run, explain, with misconception-specific feedback.
- Every control works by keyboard and touch; dragging is never the only way to do something.
- Links use explicit `index.html` paths. New routes go in `qa/manifest.js`. All existing tests must still pass.

## The bench (shared by every lab)

```text
index.html                         Catalog card 07 "Lab Bench" → modules/lab-bench/index.html
modules/lab-bench/index.html       Lab list (Lab 1 first), short "how a lab works" note
modules/lab-bench/freefall.html    Lab 1
modules/lab-bench/grade.html       Instructor grading page (stage 3)
js/core/lab-noise.js               Seeded random numbers (per student), instrument resolution, rounding
js/core/fit.js                     Least-squares line with slope/intercept uncertainty; mean and standard error
js/core/freefall-drag.js           Fall with and without quadratic air drag (closed form)
js/components/bench-view.js        SVG bench: shelf, stand, clamp, pad; drag-or-click to place equipment
js/components/notebook.js          Lab notebook table: add/delete rows, per-trial values, CSV export
```

**Layout:** equipment shelf (left) · bench scene (centre) · lab notebook (right on wide screens, below on phones) ·
analysis panel (graph + fit) · result and report panel.

**Placing equipment:** drag an item from the shelf onto the bench, or select it and press **Place** (keyboard and
touch). Items snap to their spot (a ball to the release clamp, a timer to the stand). Only items the assignment
unlocks appear on the shelf; others are shown greyed with "not needed for this lab".

## Lab 1 — Find g on the mystery planet

### Assignment (what students are told)
Determine the acceleration due to gravity, g, on this planet. Report g with an uncertainty and explain the
main source of error in your measurement.

### Shelf
| Item | Model |
|---|---|
| Steel ball | 25.4 mm diameter, 67 g (density 7.8 g/cm³). Air drag negligible. |
| Ping-pong ball | 40 mm diameter, 2.7 g. Air drag clearly matters on planets with air. |
| Measuring stick (2 m) | Read by the student from a magnified view at the bottom of the ball; 1 mm divisions, labelled in cm. (2 m, not a metre stick, because drops go to 2 m.) |
| Hand stopwatch | The **student clicks** Start at release and Stop at impact (button, or Space bar). Their own reaction time is the error; nothing is faked. Display to 0.01 s (truncated, like a real stopwatch). The release follows a steady "3, 2, 1, drop" beat, as a lab partner would count, so students can start on the beat. (A random delay was tried and rejected: it makes every start ~0.2 s late and gives g in the high teens.) |
| Electronic timer (release + impact pad) | Electromagnet release starts the clock, an impact pad stops it. 1 ms resolution, ±0.5 ms jitter. |

Five items only. More are added when a later lab needs them.

### Bench
A stand with an adjustable release clamp (drop heights 0.20–2.00 m). The drop distance is measured **from the
bottom of the ball to the pad**, read off the metre stick. A guided hint asks "height to which point of the ball?",
because the ball's size makes this a real question (measuring to the centre of the steel ball is off by 12.7 mm, about 6 % at a 0.20 m drop).

### Physics
- No air: y(t) = ½ g t², exact.
- With air (quadratic drag, F = ½ ρ C_d A v², C_d = 0.47): v(t) = v_t tanh(g t / v_t), y(t) = (v_t²/g) ln cosh(g t / v_t),
  v_t = √(2 m g / (ρ C_d A)). Exact closed form, so no integrator is needed.
- Air density per planet: none, thin (0.02 kg/m³) or Earth-like (1.2 kg/m³). An instructor can force air on or off.

### Mystery planet
g for each student comes from a seeded hash of (student ID + assignment code), uniform in 3–20 m/s², rounded to
0.01. The hidden value is never shown during the lab. Practice mode (no ID) uses Earth, g = 9.81 m/s².

### Measuring and the notebook
Release, time, record. Each trial adds a notebook row: object, height reading, timer, time. Students may delete
a bad trial (the deletion is noted, as in a real notebook). The notebook shows per-height mean, spread and
standard error once a height has two or more trials.

### Analysis
Plot **t² against h** (students may also view t against h, to see why linearising helps). A least-squares fit gives the
slope with its uncertainty; **g = 2 / slope, δg = 2 δslope / slope²**. Students can also compute g per height and average.

**Correction during Stage 1 (2026-10-22):** the earlier plan to plot h against t² was wrong for this lab. Least squares assumes
the error is in the vertical quantity, and here the noisy measurement is the time. With ±0.04 s stopwatch scatter, fitting
h against t² biases g low (about 8.9 m/s² on Earth on average, 6.8 with ±0.08 s); fitting t² against h is nearly unbiased
(about 2 % high) and its ±2σ range covers the true g about 94 % of the time (`tests/lab-bench.test.js`).
Students choose which result to report and type g ± δg.

### Lessons built in (discovered, not announced)
1. Stopwatch: large spread and a small positive bias from reaction time; more trials shrink the standard error. Expect
   hand-timed results within roughly ±15–20 % of g: falls last only 0.3–0.6 s. That is realistic, and it is the lesson
   the electronic timer (Stage 2) answers.
2. Electronic timer: tight spread; the systematic error that remains is the height reading.
3. Ping-pong ball with air: g comes out low, worst at large heights (curvature on the h vs t² graph).
4. Short drops: timing error is a larger fraction of t, so short drops give poorer g.

### Auto-graded rubric (4 checks, shown to the student with a message for each)
| Check | Pass condition |
|---|---|
| Value | Reported g within the tolerance of the student's true g: **±3 % with the electronic timer, ±15 % with the hand stopwatch** (decided 2026-10-22: a careful stopwatch run lands 5–20 % off, so one ±5 % tolerance would fail most honest stopwatch students). Both are set per assignment. |
| Uncertainty | The value a perfect experiment would measure (drag included, at the student's own heights) lies within 2 δg of the reported g, and δg/g < 15 % |
| Method | ≥ 3 heights with ≥ 5 trials at each, using one ball and one timer (both numbers set per assignment) |
| Explanation | The student's **first** answer to one multiple-choice question on the main systematic error, chosen to match the student's own data (e.g. drag if they used the ping-pong ball with air; reaction time if they used the stopwatch) |

Free-text discussion is optional and ungraded, as in the guided activities.

## Grading (stage 3)

1. **Assignment link.** The instructor sets an assignment code and options (planet range, air, tolerance, required
   heights and trials) on the grading page and copies a student link (carried in the URL, like Solve it share links).
2. **Completion code.** When a student submits, the page shows a short code containing: format version, assignment
   code, student ID, reported g and δg, rubric results, trial counts, and a checksum. The student pastes it into a
   Canvas assignment or quiz text box.
3. **Grading page.** The instructor pastes all codes, one per line or from a Canvas export. The page recomputes each
   student's true g from their ID, re-checks the rubric, flags tampered or mismatched codes (bad checksum, wrong
   assignment, an ID that does not match its value), and produces a score table and CSV for the Canvas gradebook.

The checksum uses a key embedded in the page, so it stops casual editing and copying, not a determined student
reading the source. This is the accepted trade-off.

## Build stages

| Stage | Contents | Can be used in class? |
|---|---|---|
| 1 ✅ | Lab Bench section and card; bench, stand, 2 m measuring stick, steel ball, hand stopwatch; notebook; t² against h graph and fit; practice mode (Earth) | Yes, ungraded |
| 2 ✅ | Electronic timer, ping-pong ball, air drag, mystery planet from student ID, systematic-error questions; larger text on the Lab Bench pages | Yes, ungraded |
| 3 ✅ | Rubric, completion code, assignment links, instructor grading page; a larger measuring-stick zoom so the mm marks are easy to read | Yes, graded |

## Stage 2 as built (2026-10-22)

- **Electronic timer.** Placing it starts the clock as the clamp's magnet releases the ball and stops it at the impact
  sensor: true fall time ± 0.5 ms, shown to 1 ms. It times every drop by itself, so the stopwatch is optional. With both on
  the bench, students choose which one each trial is recorded from.
- **Ping-pong ball.** The clamp holds one ball at a time (placing the other swaps them). Its fall uses the exact
  quadratic-drag solution; in Earth's air it measurably slows (g from a fit comes out several percent low).
- **Earth has air.** Practice mode now uses Earth's air density (1.2 kg/m³): negligible for the steel ball (< 0.1 % over 2 m),
  clear for the ping-pong ball.
- **Mystery planet.** The student types an ID; `js/core/lab-noise.js` hashes ID + assignment code (`practice` until Stage 3,
  or `?a=` in the URL) into g (3–20 m/s², to 0.01) and an air of none, thin (0.02 kg/m³) or Earth-like, one third each.
  The ID is normalised (case, spaces and dashes ignored). The planet's g is never shown until the student submits a result;
  being practice, they may then reveal it. Stage 3 keeps it hidden.
- **One notebook per place.** Earth and each planet (ID + code) keep separate notebooks in the browser. Stage 1 Earth
  notebooks carry over.
- **One fit per combination.** Trials record ball and timer; the notebook's per-height table, the graph, the fit and the
  progress count use one ball-and-timer combination at a time, chosen from a menu when there is more than one. Mixing
  them would mix different experiments.
- **Explain your result.** One multiple-choice question, chosen from the combination analysed: stopwatch data → what limits
  hand timing (reaction time); electronic timer with the ping-pong ball in Earth-like air → why g comes out low (drag);
  otherwise → what limits the result now (the height reading). Each wrong answer has its own feedback. Ungraded until Stage 3.
- **Result checks (added 2026-10-22 after the first instructor test run).** A planet run with one drop at each of four
  heights gave g = 6.0915 ± 0.00034 against a true 6.08: the four timer errors (−0.97 to +0.49 ms) happened to lie on a line,
  so the fit absorbed them and reported an impossibly small ±. Fixes:
  - *Equipment floor.* The fit's ± on g never goes below what the ruler (1 mm, read once per height) and timer (1 ms ± 0.5 ms
    jitter; stopwatch 0.01 s) can resolve, computed from the height means (`slopeFloor` in `notebook-model.js`). The page says
    when the floor applies. That run now reads 6.0915 ± 0.0080.
  - *Minimum design enforced.* Below 3 heights × 5 drops (for the combination analysed) the page warns that the ± cannot be
    trusted; a planet result cannot be submitted, and an Earth comparison is labelled a rough check.
  - *Drag-aware comparison.* The verdict also computes what a perfect experiment would measure with the student's ball and
    heights in that air (`idealFitG`). Steel in Earth-like air measures about 0.17 % low; in simulation, 3 × 5 timer runs
    cover that value within 2 SE about 95 % of the time but the bare g only about 30 %. A result that misses g but matches
    the drag-corrected value is marked as agreeing, with the drag gap named as a systematic error.
  - *Within 2 × δg counts as agreement*, with a sentence explaining why (about one careful result in three lands between 1σ
    and 2σ).
  - *Digits.* The fit's g is shown to the decimal place of its 2-significant-figure ±, and the range message uses the same
    places (no more "6.09 to 6.09").
- **Larger text** on the Lab Bench pages: body 15 px, help and captions 13.5 px, tables 14.5 px, stick and graph labels
  enlarged; nothing under 12.5 px.

## Stage 3 as built (2026-10-22)

- **Instructor page** (`modules/lab-bench/instructor.html`, linked from the Lab Bench hub under "For instructors").
  1. *Make an assignment link*: assignment code, value tolerances by timer, largest uncertainty, heights × drops, air
     (mixed or none). It shows the student link to post in Canvas and a **grading key** (e.g. `ember-vector-73`).
  2. *Grade completion codes*: paste the student link, the grading key and the codes (one per line or a whole Canvas
     export; anything else is ignored). Output: a table (score out of 4, ✓/✗ per check with the detail, reported and true g,
     notes) and a CSV for the gradebook.
- **Assignment link**: `freefall.html?a=<code>&t=<gate %>,<watch %>&u=<max %>&n=<heights>x<drops>&air=any|none&k=<key check>`.
  `k` is a hash of the grading key, so the link lets the page check a key without containing it. Without the key the
  grading page refuses to grade, so students cannot use it to test their answers.
- **Graded mode on the lab page** (any `?a=` other than `practice`): a banner explains the assignment; the student's
  planet comes from their ID and the assignment code (a different planet from practice); the planet's g is never
  shown and there is no reveal; the "explain your result" choices are shuffled per student and the **first answer is
  recorded**; submitting requires that answer; submitting below the minimum design asks for "Submit anyway" (the
  method check then fails). Submitting shows a **completion code** with a Copy button; it is kept in the browser and
  shown again on return. A student may submit again; the grading page uses the last code per student ID.
- **Students do not see their rubric results.** (Change from the original plan, which showed a message per check.)
  Showing them would let a student resubmit until the value check passed, which turns the lab into guessing g. The
  Earth practice and the practice planet still give full feedback, including a reveal.
- **Completion code** (short format, 2026-10): `LB-` + base64url of a compact binary record: format/lab byte,
  a 16-bit fingerprint of the assignment code, flags (timer, ball, first answer), g and δg to 0.001 (varints), the
  heights (mm, drops), the student ID, and a 24-bit checksum that also covers the assignment code. About 40–55
  characters (the first format was about 110). The checksum stops casual editing, not a determined student reading
  the source, as accepted. Refused codes: edited (checksum), damaged in copying, or made for another assignment.
  Identical data under two IDs is flagged. Older `LB1-` codes (text format) still decode and grade.
- **Saved assignments** (instructor page): every link made is remembered in that browser (assignment code, lab,
  student link, grading key, settings, date). Choosing one fills the grading form. A JSON backup of the list can be
  downloaded and loaded on another computer. Nothing is sent anywhere.
- **Rubric recomputed on the grading page** (`grading.js`, pure and unit-tested): the planet from ID + code, the
  drag-corrected ideal value from the student's own heights and ball, and the question from timer, ball and air.
- **Larger measuring-stick zoom**: 3 cm of stick at about 12 px per mm (was about 8 cm at 3 px per mm), centimetre
  numbers at 24 px, "numbers in cm" in the title and "each small mark is 1 mm" under it. The bench labels were enlarged
  to match.
- **Not done** (from the original plan): a planet-range option (fixed at 3–20 m/s²).

## Lab 2 — g from a projectile (as built, 2026-10-24)

Principle (Dave): students do as many steps as possible themselves, as with real video analysis (Tracker, Logger Pro).
The page never states g. Files: `projectile.html/.js/.css`, `projectile-model.js` (analysis), `grading-projectile.js`,
`js/core/projectile.js` (flight and camera), `quadraticFit` in `js/core/fit.js`.

- **Set up and fire.** Launcher angle 15–75° (5° steps), spring setting 1–6 (2–7 m/s, not shown), camera frame rate
  10/20/30/60 fps. A 40 mm, 263 g steel ball; quadratic air drag included (under 0.1 % on g on Earth). A shot that
  leaves the picture is refused. The video starts one frame before launch, at a random phase.
- **Camera.** Pinhole 3.0 m in front of the flight plane, square-on, 4.0 m × 2.8 m of the plane in an 800 × 560 frame
  (200 px/m). The ball is 8 px across: a magnifier follows the pointer; arrow keys move a cross-hair, Enter marks.
- **Calibrate.** The student clicks the metre stick's two ends (scale) and the origin (x right, y up). A later launch
  with the same stick place keeps the calibration (camera and stick not moved), and says so.
- **Track.** One click per frame, auto-advancing; frames before launch and after landing are for the student to skip.
- **Velocities by hand.** A separate velocity table has one row per interval between neighbouring positions
  (frames, t_mid, Δt, Δx, Δy, vx, vy), so it is clear a velocity belongs to an interval, plotted at its middle time.
  The student works out the first 3 vx and 3 vy (Δx/Δt, Δy/Δt); checked within 2 % or 0.02 m/s, with the working
  shown when wrong. Then the page fills the rest and the vx–t and vy–t graphs appear. Marks that do not move (frames
  before launch) are flagged so the student removes them.
- **Fit.** For x–t, y–t, vx–t and vy–t the student chooses line or parabola and presses Fit; coefficients with ± are shown.
  g comes from −2C (parabola) or −slope (vy line), worked out by the student. Optional "your g" per launch.
- **Parallax trap** (assignment option `px=1`, off by default): the stick can stand on the front edge of the bench,
  0.45 m nearer the camera, and starts there. Its scale makes lengths, and g, 2.55/3 ≈ 0.85 of the truth.
- **Assignment link:** `projectile.html?a=…&t=5&u=10&n=2x10&px=0|1&air=any&k=…` (value tolerance %, max δg/g %,
  launches × points per launch).
- **Rubric (4 checks):** value within tolerance of the true g; the ideal (noise-free clicks on the student's launches)
  within 2 δg and δg/g ≤ max; method: enough launches with enough points and the right models (x line, y parabola,
  vx line, vy line), from at least two settings; explanation: first answer right (parallax question with the trap, otherwise
  "why does vy scatter more").
- **Completion code:** the short format with lab number 2: flags (answer, stick place), g, δg, per launch (angle, spring,
  fps, points, models right, analysed), ID, checksum. The instructor page makes and grades Lab 1 and Lab 2 links.
- **Not yet:** touch-friendly aiming (marking an 8 px ball on a phone is fiddly; a tablet or computer is better); Lab 3
  (landing-point prediction, including the rolling-ball ramp).

## Tests

- **Physics:** free fall exact; the drag solution matches its terminal velocity and agrees with RK4 integration;
  drag → 0 reduces to free fall. *(Stage 1: done.)*
- **Fit:** least squares against hand-computed cases; slope uncertainty against the textbook formula; the fit
  recovers a known g from synthetic noisy data within its stated uncertainty in ~95 % of seeded runs.
- **Seeding:** the same ID and assignment always give the same g; different IDs spread across the range.
- **Codes:** round trip; any edited character fails the checksum; a code from another assignment or ID is flagged.
- **Rubric:** each check passes and fails at its boundaries.
- **Browser QA:** a scripted student completes Lab 1 by keyboard only, then with touch, on desktop, laptop and iPad
  profiles; the grading page scores a batch of codes, including tampered ones.

## Accessibility note

The hand stopwatch depends on reaction time by design. Students who cannot use it reliably (motor or vision
needs) must be able to complete the lab with the electronic timer alone. The rubric never requires the stopwatch.

## Not in v1

Open sandbox bench; 3D or a visual "room"; video-based measurement; LTI or other automatic grade return to
Canvas (needs a server); free-text auto-grading; equipment beyond the five items. Later labs reuse the bench:
pendulum (g again, a different method), incline (μ), spring (k), and later Coulomb's k.

## Open questions

1. ~~Default tolerance (±5 %) and uncertainty ceiling (15 %)?~~ **Decided 2026-10-22: tolerance by timer, ±3 % (electronic) and ±15 % (stopwatch); ceiling 15 %.** Revisit after the first graded class.
2. ~~Require both timers, or let students choose?~~ **Decided 2026-10-22: students choose.** One complete combination is enough; this also keeps the lab possible without the stopwatch (see Accessibility note).
3. ~~Is a short in-page explainer enough for uncertainty basics?~~ **Decided 2026-10-22: yes, for this version** (see
   "Uncertainty basics" below). Revisit after the first class uses it.

## Uncertainty basics (in-page, just in time)

No separate reading or activity. Three short explainers, each a collapsible "What does this mean?" panel attached to
the step where it is first needed, each under ~120 words with one worked mini-example using the student's own numbers:

| Where it appears | What it explains |
|---|---|
| Notebook, when a height has 2+ trials | Mean, spread (standard deviation) and standard error = SD/√n; why more trials help |
| Analysis, next to the fit | Why plot h against t² (a straight line through the origin, slope = g/2); reading the slope and its ± |
| Result panel, before submitting | Reporting g ± δg with sensible significant figures; "does my range include the expected value?"; random vs systematic error in one sentence each |

The explainers are written for students with no statistics background. The Explanation rubric question, not the
explainers, checks understanding.
