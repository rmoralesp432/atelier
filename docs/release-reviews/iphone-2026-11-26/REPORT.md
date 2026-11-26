# iPhone workspace release — deployed

**Live:** https://atelier-emxi.onrender.com/  
**Production commit:** `280bbc12a87d998fad3bbd87da0bada08c6196ba`  
**Render deploy:** `dep-dc4c22m1egvs73fuvcng`  
**PR:** [#26](https://github.com/rmoralesp432/atelier/pull/26), merged after all required checks passed.

- **424 unit tests, 153 browser tests, build and formatting passed** on the tested candidate. [Required CI](https://github.com/rmoralesp432/atelier/actions/runs/45909790043).
- **Actual production desktop and phone smoke tests passed** on the unchanged deployed application. The tests verified the expected bundle, healthy/configured agent, real editable manual solids, unrelated-object preservation, persistence, reload, Undo/Redo, phone dock/drafts/rotation and animated welcome orb. [Hosted production test](https://github.com/rmoralesp432/atelier/actions/runs/45912183564).
- **Zero paid API calls for this release.** These production smoke tests did not generate live AI responses.
- Physical iPhone Safari microphone, background/resume, keyboard and device AR remain unverified.
- Previous production `f925e4c` remains preserved for rollback. PR #25 and frozen `deb7303` are not deployed.

## Evidence

[Production measurements](production-smoke-summary.json) · [Render confirmation](production-after.json) · [Required CI and all check summaries](ci-passed-complete.json) · [Merge/tree proof](merge-tree-proof.json) · [Complete interface/test diff](release.diff) · [Evidence ZIP](ATELIER-iphone-release-evidence.zip)

The ZIP preserves earlier failed CI runs, local reproductions, screenshots, traces, test corrections, deployment records and production smoke results. Its `production-ci-passed.json` contains the hosted check's full result annotations. Hosted screenshots and raw artifacts are also available in the production test run above for its configured 14-day retention. Local calibration captures are labeled separately; they are not represented as production screenshots.

The standalone smoke harness improvements live only on this evaluation branch. The original automatic smoke failure remains visible and preserved. The successful hosted rerun uses the same runtime source and exact geometric assertions with a bounded 30-second readiness wait, plus clear failure reporting; no application source or deployed artifact was changed to obtain a pass.

The separate [fresh seeded design-decision diagnostic](https://github.com/rmoralesp432/atelier/blob/46bd050/docs/evaluations/design-decisions/seeded-live/REPORT.md) is a mixed continuity result on frozen `deb7303`, not part of this release.

---

# Release detail

The user separately authorized publication of the iPhone changes while the seeded design-decision diagnostic remained frozen. PR #26 targets the existing deployment branch, `feat/phase2-conversational-modeling`.

## Release scope

The phone interface gains a labeled thumb dock, coordinated sheets, reachable history controls, keyboard-aware layout, and more visibly animated, dimensional orb shading. The orb remains a lightweight SVG; real input/output audio levels drive its response. Existing reduced-motion behavior is preserved.

This release excludes PR #25 and the design-decision implementation. The geometry engine, verification, transactions and project-storage modules are byte-identical to production `f925e4c`. The only follow-up runtime corrections coordinate phone sheets and AR chat controls; no modeling feature was added.

## Failures preserved and resolved

The original full CI run 45905836700 on `509e157` passed 145 browser tests and failed eight. The failures exposed both real interface regressions and outdated navigation assumptions:

- Restored object panels and phone object-action sheets could be obscured by expanded chat. The same single-sheet behavior now applies on restore, viewport changes and object actions.
- Opening AR Chat did not restore the shared composer after entering through the dock. A dedicated presentation callback now opens it without leaving AR.
- AR setup, floor-preview and walk-placement controls could sit under the new dock. Their positions now respect the phone sheet clearance.
- Tests assuming chat stayed expanded after tools now use the explicit Chat control. Existing geometry, camera, preservation and viewport assertions remain intact.

The first corrected CI run 45907777511 passed 151 browser tests and found two additional outdated test assumptions: the studio and surface-refinement tests expected a composer after closing Appearance instead of reopening Chat. Two four-line test-only corrections add the user-facing dock action. They do not change application behavior. Both targeted regressions passed locally.

Local intermediate failures, screenshots and traces are preserved in the evidence archive; none were silently converted into passes. Six focused browser regressions passed on the corrected runtime, followed by the studio and surface-refinement regressions on the final test revisions. Final required CI and production smoke outcomes are linked above.

## Validation limitations

Browser tests run actual geometry and persistence code, but voice input/output and XR transports are synthetic. Chromium phone emulation and substituted visual-viewport metrics are not physical iPhone Safari verification. Real microphone permissions, audio routing, background/resume, keyboard, safe-area behavior and device AR need hands-on testing. The historical intermittent desktop clipping report is not claimed as reproduced or permanently solved.

The production smoke uses manual editable solids and blocks paid-generation requests. It establishes deployed bundle, configured agent endpoint, working UI, saves, reload and Undo/Redo, not a fresh production AI-reasoning trial. The separate seeded diagnostic uses fresh AI on frozen `deb7303` and is reported independently.

## Rollback

Previous production is preserved at tag `rollback/iphone-2026-11-26`, commit `f925e4cef7b4c6a27eb1532476879728aa5d7584`, Render deploy `dep-dbvig9l9fdbs73bbeo20`.

## Production-smoke preparation

The phone smoke harness was calibrated offline before release. Initial screenshots showed a close-up of the default solid mass because the small new cylinder shares its origin; this was not missing or clipped geometry. The final capture exits the resumed view and uses Frame all, verifies the increased camera distance and unchanged object data, and waits for construction to settle. Initial captures and calibration logs remain in the archive. No application or camera code was changed.

## Production verification and infrastructure evidence

Render confirmed `280bbc12a87d998fad3bbd87da0bada08c6196ba` live in deployment `dep-dc4c22m1egvs73fuvcng`. Its tree exactly matches tested PR head `93d936be54290e60922c15699a6877f97c0f5435`; see `merge-tree-proof.json`.

This Cloud instance cannot open the public Render hostname: its enforced destination allowlist excludes `atelier-emxi.onrender.com`. Local browser navigation failed with `ERR_TUNNEL_CONNECTION_FAILED`, and curl independently returned CONNECT 403. A normal network-permission grant did not alter that managed proxy policy. This is recorded as an environment block, not an ATELIER failure. The deployment-management API remains accessible.

The existing GitHub production smoke workflow ran independently on its normal hosted runner. Its first failure lacked actionable annotations. An isolated evaluation branch added explicit error/result reporting and the separately calibrated phone smoke, while asserting that runtime files match the production commit. No application code or production settings changed. The diagnostic run 45911974414 established a successful live phone workflow; its desktop check failed on the standalone script's default five-second expectation while the initial solids were still loading. Standalone scripts do not inherit the repository's Playwright readiness settings. A bounded 30-second expectation now waits for the same exact geometry assertions on that evaluation branch. All earlier failures remain preserved.

The evaluation harness does not generate AI responses: browser POSTs to `/api/` are blocked, and no provider key is configured for these tests. No user project is opened or changed; each production browser uses fresh storage.
