# Automated QA

## Inventory and plan (2026-10-19)

Initial audit target: `feature/builder-load-file`, `9b4d94f`, including all of `origin/main`. The permanent QA branch, `qa/automated-testing`, starts from latest fetched `main` (`80a94b2`, verified 2026-10-20). The newer feature commit is not merged into main: its JSON-load round-trip test remains present and fails on main because the control is absent. This is a branch coverage mismatch, not a newly introduced simulator defect. Builder reference screenshots from that feature branch are preserved and may also differ. No feature code was transplanted.

The repository is a static HTML/CSS/ES-module application with no build or backend. `index.html` is the catalog; `scripts/serve.js` serves it on loopback port 5173 with a PORT override. Relative links support static hosting. No deployment pipeline or live deployment URL is configured. No repository AGENTS.md was found.

| Page | Implemented experiences | Existing Node tests |
| --- | --- | --- |
| Newton's First Law | I1–I3; free pulse, optional friction and written prediction | inertia, pulse |
| Newton's Second Law | A–D, F1–F3; free conceptual/quantitative, friction, comparison trials | physics, guided, friction |
| Newton's Third Law | T1–T3; free spring release; FBD building, reveal/retry and reaction pairs | spring, fbd |
| Forces That Change | Linear/quadratic drag, spring/damper; V1–V4; math, numerical overlays, scrub and CSV | drag, oscillator, integrators, activities |
| Circular Motion C1 | Free circle, cut string, vector toggles and calculus; U1–U4 | circular |
| Solve it | S1 cart, S2 stopping, S3 sprinter, S4 pallet; sorting, blocks, feedback, ghost, reveal | solve |
| Picture builder / detailed editor | Sample creation, written import, JSON load/save, placeholders, validation, sharing | builder, problem-format |
| Catalog / topic hubs | Circular C2–C9, Electromagnetism E1–E11, Momentum, Work/Energy are planned | links |

There are 21 guided activities and four Solve it problems. There are seven free simulation scenarios counting the two drag laws separately. Eleven HTML entry points are inventoried in `qa/manifest.js`. The original 16 test files exercise pure logic; historical PNGs and reports are manual evidence. Browser interaction, responsive, accessibility, systematic visual regression and consolidated reporting were missing. Some existing tests use production calculations for expected answers.

Implementation sequence: preserve existing tests; add independent reference physics; add actual-UI Playwright flows across desktop/laptop/touch tablet; collect rendered content and layout candidates; add axe and visual comparisons; aggregate evidence and document gaps. No application fixes are part of this audit.

The [2026-10-20 execution record](QA-RUN-2026-10-20.md) records local results, unresolved failures and isolated rechecks for the permanent QA branch.

## Commands

Use Node.js 24 for QA (axe requires at least Node 22.12). First installation: `npm ci`, then `npx playwright install chromium`.

- `npm run qa`: all fast, browser, accessibility and visual tests; always writes `qa-results/report.md` and returns nonzero on failure.
- `npm run qa:fast`: existing Node tests plus independent reference cases.
- `npm run qa:browser`: functional browser tests, content/geometry evidence and axe scans.
- `npm run qa:visual`: screenshot comparisons only.
- `npm run qa:baseline`: explicitly create/update screenshot baselines. Review images before accepting them; baseline creation is not a visual-quality pass.
- `npm run qa:browser -- --project=desktop`: the smaller browser scope used on pull requests. Playwright filters can also follow `--`.

## GitHub Actions

`Automated QA` runs independent fast and desktop Chromium jobs on pull requests targeting `main`. Both jobs retain nonzero exit status for failures and upload `qa-results/` even when tests fail. The browser job includes functional, content, runtime-error and axe checks; it does not perform screenshot comparisons.

`Comprehensive and visual QA` is a separate manually dispatched Windows workflow running all three viewports and screenshot comparisons with `npm run qa`. Windows matches the platform of the committed references, but hosted-runner font/rendering differences still require review. Baselines are never updated automatically. Workflow execution on GitHub has not been verified by local testing.

Download the corresponding Actions artifact and open `report.md` or the Playwright HTML report. Artifacts expire after 14 days; reviewed findings and numerical reference cases remain version controlled. Local commands replace generated results for their selected stage; copy `qa-results/` elsewhere first if a historical run must be retained.

Generated logs, reports, traces and screenshots are in ignored `qa-results/`. Reviewed baselines in `qa/baselines/` should be versioned. Chromium/Playwright is locked by package-lock.json. Baselines are OS-specific; create reviewed baselines on each supported runner OS. Missing baselines fail normal runs and are never silently accepted.

## Coverage and interpretation

Browser projects: desktop 1440×1000, laptop 1366×768, iPad-sized portrait 768×1024 with touch emulation (Chromium, not Safari). Tests use accessible roles/labels plus existing semantic IDs for measurements and graph elements. No production hooks are injected. Playwright's clock drives real animation callbacks deterministically. Runtime errors and HTTP failures are recorded for every browser test. Full-page screenshots and rendered text are evidence, not proof that all text is correct.

Severity: Critical = incorrect physics/unusable core; High = broken activity/misleading instruction; Medium = accessibility, confusing controls, missing units; Low = cosmetic consistency. Automated failures remain failures, including existing defects. Geometry/content heuristics are candidates requiring review, not automatically confirmed defects. Axe violations are automated accessibility findings; incomplete axe results require manual review.

Physical devices, Safari/Firefox, assistive-technology use, arbitrary authored problems, every possible parameter combination, pedagogical wording and all potential clipping/overlap need additional review. See the generated report for the exact execution results and explicit remaining gaps. Passing axe does not establish usability.

The local static application is the target; a published GitHub Pages/Canvas deployment is not exercised. Solve it starts through Check & run and has no pause/resume control; hubs and instructor editors have no simulation transport. Those controls are not applicable to those routes. First Law's written free prediction is optional and ungraded. Planned modules are checked as catalog content, not as implemented simulations.

Slider endpoint checks use keyboard input, including in the touch-emulated project; a dedicated navigation test uses actual touch taps. Physical touch gestures, screen-reader navigation, and linguistic review of every possible dynamically authored sentence remain outside the automated claim.

The full suite deliberately stays red while confirmed pre-existing defects remain. Do not remove assertions or refresh baselines to hide a defect. Approve and make application fixes in a separate task, then rerun QA. New HTML routes fail the inventory test until they are explicitly added to the manifest and coverage plan.
