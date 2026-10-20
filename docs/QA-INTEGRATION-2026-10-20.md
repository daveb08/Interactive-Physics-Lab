# Automatic QA and E1 integration — 2026-10-20

PR #16 now includes the user-approved merges of the existing builder feature (`9b4d94f`, merge `0669325`) and E1 feature (`55fe4b2`, merge `b641436`). Their application files exactly match those feature commits; no physics or student-facing implementation was edited to satisfy QA.

## Implemented

- Fast and desktop browser QA on direct pushes to main, PRs targeting main, and manual dispatch.
- Comprehensive Windows QA every Monday at 07:17 UTC and manual dispatch. Scheduled execution activates on the default branch after merge.
- Builder round-trip coverage now targets the integrated feature, retaining every original assertion.
- E1 inventory, 47 independent physics/reference tests, 48 browser cases across three viewports, initial-route accessibility/content/layout checks, and 15 new E1 state images. The feature's existing unit and link tests are also discovered.
- Separately named hub references reflect the approved E1 “Available” card. All 117 original images remain intact; screenshot tolerances are unchanged. See `qa/baselines/README.md`.

## Local verification

Windows, Node 24, locked Playwright 1.64.1 and Chromium. `npm run qa` ran all fast, browser and visual stages:

| Scope | Passed | Failed |
| --- | ---: | ---: |
| Fast tests | 301 | 1 |
| Browser tests, all three viewports | 279 | 45 |
| Visual cases after reviewed hub-reference comparisons | 44 | 1 |
| **Unique test/project results** | **624** | **47** |

No tests were skipped. The original full run was **621 passed / 50 failed**. Three hub screenshot mismatches were expected differences from the approved E1 feature, confirmed by inspecting all three viewports. New reference filenames preserve the prior planned-hub images; the subsequent ordinary comparisons all passed. Baseline generation itself is not counted as validation.

All 48 E1 functional cases, all E1 independent calculations, and all three builder round-trip cases pass. Remaining failures:

- One circular graph endpoint discrepancy.
- Thirty-six accessibility failures: twelve routes across three viewports, including E1 contrast.
- Six instructional-content failures: quadratic-drag equation and undefined oscillator constants in three viewports.
- Three critical-damping scenario exceptions.
- One desktop detailed-editor screenshot stability failure: height changes between 3154 and 3173 px within the 5-second screenshot assertion. This previously passed in isolation but recurred in the full run; it remains a failure rather than being hidden with retries or tolerance changes.

The consolidated report, original JSON, screenshots and traces remain in ignored `qa-results/`. Prior evidence was copied to a timestamped temporary directory before the full integrated run. The original run summary in `QA-RUN-2026-10-20.md` is preserved.

## Manual rollout and separate fixes

1. Review PR #16, which now includes both feature branches as well as QA, and decide when to merge it into main. Main is deliberately untouched. Required green checks may necessitate separately reviewed defect fixes first.
2. If pre-merge enforcement is wanted, configure a repository ruleset requiring pull requests and checks named `fast` and `browser`. The inspected current main rules protect only deletion and non-fast-forward updates; they do not require these checks. No protection policy was changed.
3. Approve separate fixes for the known physics/content/accessibility defects and investigate the editor screenshot instability. This QA work neither suppresses nor fixes application failures.

After merging the workflows, ordinary direct pushes to main automatically run fast and desktop QA. Weekly execution covers all viewports and visual comparisons. Successful GitHub Pages deployment remains separate from QA success. Physical devices, Safari/Firefox, screen-reader usability and the first scheduled/main-push executions are not verified by this local run.
