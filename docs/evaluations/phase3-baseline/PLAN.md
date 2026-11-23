# Phase 3: autonomous modeling intelligence baseline

Status: proposal for approval; no paid evaluation is authorized or running.
Prepared 23 November 2026. Application changes, merge and deployment are out of scope.

## Purpose

Measure whether the current agent can understand an unfamiliar outcome, construct real editable geometry, inspect it, and make contextual changes without the user listing every affected component. This is a diagnostic baseline, not another release test or a competition to produce passing examples. Recommend one subsequent improvement only after observing the failures.

## Confirmed starting point

- GitHub deployment branch and Render's current live deployment both point to `f925e4cef7b4c6a27eb1532476879728aa5d7584`, tree `2efda5e47ddf0d66aa36b5fd8646591a8d808b5d`.
- Render deployment is `dep-dbvig9l9fdbs73bbeo20`. The production URL is https://atelier-emxi.onrender.com/. This session checked Render's control plane, not a new interactive production smoke.
- Both post-merge regression runs, `44569973705` and `44569986346`, and production smoke `44569973643` now report success. The earlier orb report left the two regression runs pending; this check resolves that uncertainty.
- Existing rollback tags remain: `release/pre-pr24-2026-11-19` -> `aa9dd6126f3372774c1cee03558ef4dcb87afd27`, and `release/pre-pr23-2026-11-19` -> `acf5ed9ccdb298d2853d139ce5cdf0fc35e24c36`. Leave them unchanged and pin the current stable SHA as this experiment's baseline.
- Work is isolated on `eval/phase3-intelligence-baseline`. No `src`, `server`, application configuration, or deployment files are being changed.
- A free authenticated model lookup returned `gpt-6.1-sol`. That establishes model access, not successful generation, current account balance, or billing accuracy.
- The user reports about US$70 expiring 24 November 2026 and an expected future budget of about US$400/month. The balance/expiry is user-reported, not API-verified, and does not itself authorize paid calls.

## Current architectural hypothesis

`server/completion.ts` asks the independent interpreter to identify permitted original IDs/groups from the current request, history and original scene. `completion.ts` resolves those selectors and expands through explicit `component.hostId` links. It does not generally infer permission from physical proximity or contact. `checkedPlanner.ts` immediately stops when verification cannot establish the scope of an edit. The one bounded criteria-correction pass in `completionVerifier.ts` corrects demonstrably invalid predicates; it does not renegotiate authorization scope.

This is consistent with the reported successful edit after explicitly authorizing all affected building parts. It is not yet proof of which component failed: the executor may misunderstand the relationships, the scene may omit useful evidence, or the reviewer may understand the design but underspecify scope. The benchmark records each boundary separately. Do not broaden permissions, alter prompts in the application, or introduce a relationship system before measuring this.

## Proposed experiment

Six unfamiliar episodes, two user turns each, plus one controlled correction run: **13 primary turns**, not 13 API calls. Each agent turn can contain several calls. Exact prompts and numerical requirements are in `cases.json`; external measurement rules are in `MEASUREMENTS.md`.

| Episode                       | User experience                                                           | What it reveals                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A: entry canopy               | Create an open architectural assembly, then increase headroom             | Whether it infers that roof, supports and side glazing must change together while the platform stays fixed |
| B: workbench                  | Create a small editable frame, then make it longer                        | Whether contextual edits transfer to furniture and preserve leg sections, setbacks and connected rails     |
| C: shaft and bushings         | Create aligned hollow mechanical parts, then move one bushing outward     | Intrinsic dimensions, coaxiality, clearance and coordinated resizing outside architecture                  |
| D: offset tapered shell       | Create a hollow loft with an offset top, then cut a side opening          | Curved geometry, genuine voids, Boolean operations and preservation of the opposite wall                   |
| E: staggered polygon array    | Create an oblique array, then increase spacing while retaining its center | Counts, spatial reasoning, equivalent coordinate representations and many-object edits                     |
| F: contradiction and recovery | Give incompatible dimensions, then request a new wedge                    | Meaningful clarification, safe refusal, no partial commit, and a genuinely fresh next request              |
| R: controlled correction      | Displace one array component in a disposable provisional run              | Whether independent checking detects an actual error and real AI repairs it without damaging other pieces  |

The construction strategy is the model's choice. Prompts specify desired outcomes, not modeling operations, object IDs, edit sets, verification schemas, or exhaustive lists of affected components. Quantitative dimensions permit external testing; free choices remain free. Do not add unstated requirements such as stairs, loads, joinery certification or photorealism.

### Running order and dependencies

Run A1/A2, B1/B2, C1/C2, D1/D2, E1/E2, F1/F2. Run R in its reserved allowance. Preserve each episode in its own browser project with two unrelated marker objects, including one plausible-looking nearby distractor. Preserve names, geometry, materials, visibility, locks and groups of the markers. Log the seeded IDs; do not give them to the AI as a special answer list.

Follow-up turns use the actual successfully committed first-turn model, its real conversation and unchanged identities. Reload between creation and follow-up. If creation fails or the external oracle cannot establish its correctness, mark the dependent live edit **not reached**; do not substitute a handcrafted success. A separately labeled seed-based diagnostic is allowed only in the diagnostic allowance and cannot count as the missed end-to-end pass.

For every committed turn, check one-step Undo, Redo and reload in the real App. Retain full before/provisional/after/reloaded project snapshots, conversation and camera. For F1, compare saved scene and history to the original; a clear clarification with no model changes is the correct outcome. F2 must work in that same project and conversation. Existing free transaction-conflict/lifecycle regressions complement this experiment; they are not new live-AI successes.

### Independent correction control

Reuse the existing `evaluate-release.ts` staged-planner/verification callback technique on a disposable copy of E's creation task. Preserve the unmodified raw model response, then perturb one already-created prism by 0.19 m perpendicular to the array's row axis immediately before completion measurement. Record the injected ID, old/new coordinates and exact injection boundary. Do not inject fake AI answers, alter requirements, rewrite receipts, or change application source.

The independent reader and host must find the wrong arrangement. The real executor receives only the application's ordinary discrepancy feedback and scene observations, not the evaluator's answer or repair instructions. Keep the bad candidate from committing. Confirm the same prism ID is repaired, no extra objects appear, and all other parts and protected objects remain unchanged. If the normal unperturbed creation is not correct, do not inject or claim a controlled-repair result; record the unmet precondition.

This control is an explicitly injected fault, not a naturally occurring model failure. Its live staged-planner evidence and any exact-plan replay through the browser commit path must be labeled separately. A browser replay is transaction evidence, not an additional fresh AI success. Natural corrections observed during A–F are reported separately from R.

## Evidence and scoring

Keep three separate assessments per turn:

1. **Actual result:** do independent measurements establish the requested solids, counts, arrangement and preservation? Does it actually commit and persist?
2. **Application verification:** verified, incorrect, or unverified; record each check, scope decision, correction and disclosed limitation.
3. **Interaction:** completion time, clarification burden, inspections, execution steps, corrective steps, token usage and cost.

An externally correct result can still expose a false rejection. An application claim of success can expose false acceptance if a material requirement fails independently. A genuinely unmeasurable property stays unknown. Never turn an unknown oracle result into a pass, treat a missing coverage check as proof of failure, or count a correct preview that never commits as completed.

For each explicit clause in a prompt, record its independent expected value or allowed interpretation and map it to the actual reviewer's checks. A quoted requirement or plausible component name does not demonstrate coverage. Assess visual coherence from actual neutral scene renders and section views where useful; retain the image and the observation. Do not substitute AI-rendered illustrations. Human visual judgments remain qualitative, with reviewer identity/method recorded.

Report first-attempt and eventual completion separately, and always include denominators: attempted turns, not-reached dependent turns, budget-stopped turns, incorrect results, unverified results, false acceptances/rejections, autonomous repairs and unnecessary clarifications. Report all individual latencies; a small sample does not establish population percentiles. Separate executor, reviewer, criterion-revision, local geometry, rendering and commit time.

### Failure attribution

| Classification            | Evidence needed                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Reasoning                 | Sufficient tools and scene facts were available, but the chosen actions or interpretation were wrong            |
| Tool capability           | The necessary construction/edit cannot be expressed or reliably executed with available operations              |
| Inspection/context        | Needed geometry, relationships, IDs or observations were absent, truncated or misleading                        |
| Independent verification  | Criteria, scope inference or host measurement incorrectly accepted/rejected the evidence, or failed to cover it |
| Transaction/application   | Correct provisional work failed to commit, lost identities, corrupted persistence or broke Undo/Redo            |
| Evaluation infrastructure | Fixture, browser orchestration, timeout, serialization or oracle error, with evidence rather than assumption    |

Allow multiple causes and an undetermined category. Diagnose the earliest demonstrated failure, not just the final error string.

## Reuse and remaining preparation

Reuse the actual provider, local API server, production App, staged planner and kernel; do not write a second modeling engine. The preserved hotfix harness is useful but its one fixed prompt is not a general benchmark runner.

| Existing asset                                                                           | Reuse                                                                                           | Gap to fill in evaluation-only code                                                                                   |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `scripts/evaluate-release.ts`                                                            | Browser orchestration, neutral observations, staged verification, commit and reload/Undo checks | Select new manifests rather than the old four building/ellipse/tray cases; separate primary outcomes from diagnostics |
| `scripts/completion-evaluation/budget.ts` and tests                                      | Durable pre-call reservation, real usage, no automatic retries, bounded requests                | Pin this Phase 3 authorization/price manifest; do not invoke the old US$20 aggregate authorization                    |
| `scripts/release-evaluation/browser-state.ts`                                            | Modeling start, active request, cancellation                                                    | Carry its lifecycle rules into each new episode                                                                       |
| `scripts/release-evaluation/cases.ts`                                                    | Low-level solid extraction, occupied-volume checks, protected-object comparisons                | New external oracles must not call the application's verifier as their sole correctness test                          |
| `tests/storey-edit.spec.ts`, `transaction-*.spec.ts`, `workspace-lifecycle.spec.ts`      | Free browser coverage of IDs, atomicity, conflicts and reload                                   | These use scripted responses; do not count them as natural-language performance                                       |
| `completionGeneral.test.ts`, `criteriaAudit.test.ts`, `tests/criteria-contracts.spec.ts` | False-acceptance/rejection and signed-offset/material regressions                               | Add evaluation-oracle controls for the new geometries without modifying application predicates                        |
| Prior real-AI archives and James's independent findings                                  | Baselines, failure taxonomy, comparable metrics                                                 | Fresh cross-domain outcomes and implicit edit scope; James did not directly inspect the actual viewport               |

This proposal prepares exact prompts, numerical acceptance contracts and evidence schemas. It does **not** claim that the new thirteen-turn runner or every new oracle is already implemented/calibrated. After approval, complete and test only that evaluation code offline, then freeze its hashes before the first paid call. No application development is needed for that step.

## Freeze and generalization rules

- Pin application commit, dependency lockfile, built bundle, provider settings, prompt bytes, fixture seeds, oracle source/tolerances, run order, fault policy, prices and spending limits in a manifest. Hash it before paid execution; record model IDs actually returned.
- Model: `gpt-6.1-sol`; existing Responses transport; standard service tier; executor high reasoning, text reviewer low reasoning; existing 6,000-output-token ceiling and zero SDK retries. Existing application step, repair, geometry and operation limits remain unchanged.
- Run locally on the exact stable application source, not against production projects. Use a fresh browser context per episode and actual render observations. Text input exercises the same modeling turn path; this is not physical microphone/Safari validation.
- Keep prompts, numerical answers and faults in evaluation files only. Neither execution agent nor reviewer receives the oracle, reference fixture or withheld-answer values beyond the user's prompt.
- Before paid runs, prove each oracle accepts appropriate baked/rotated meshes and alternative valid subdivisions, and rejects measured counterexamples. Missing surface evidence is unknown, not a guessed pass.
- Do not change application code during the baseline. Preserve failures and continue to unrelated episodes unless a serious false-success, data-loss/security defect or budget stop requires halting. Routine harness fixes get a new version/attempt; old outcomes remain visible.
- Reserve the different task families in `held-out.json` for evaluation of a later approved improvement. They are excluded from this initial US$15 experiment and must not be used to select or tune an implementation.

## Proposed API authorization

**Request: up to US$15 total for this Phase 3 baseline, including all of its calls, retries and unknown-charge reservations.** No spending has been approved for this new experiment. Previous release/hotfix ledgers and their unknown charges remain immutable historical records; they are not cleared, relabeled, or reused as new authorization.

Plan allocations: up to US$10 for A–F, US$2 for R, and US$3 for diagnostic/transport contingency. These are ceilings, not spending targets. Do not spend the reserve on repeating successful buildings. At most two diagnostic turns: choose only a failure whose attribution is genuinely uncertain and record the question before sending. Primary results never change because a diagnostic later succeeds. If unused money would need reallocating, record the change before the next call while keeping the total and reserved repair allowance intact.

Maximum 60 started generation calls, at most 16 per user turn, subordinate to the dollar ceiling and unchanged application limits. Execute serially; preflight for all possible role calls, including criterion correction. Before every request, durably reserve its conservative full input/output cost. No paid external tools, voice endpoints, streaming or automatic retries. Unknown usage retains its full reservation and stops new calls until reconciled; never count it as zero. Output allowance includes reasoning tokens. No result is promised if the cap prevents finishing all episodes.

The existing secondary pricing source, rechecked today, lists standard rates of US$2/M input tokens and US$10/M output, and long-context US$4/M and US$15/M. These are **estimates from a third-party price catalogue**, not an account invoice or independently authenticated OpenAI quote. Current reservation policy uses the higher rates plus 25%, no cache discount, decoded-text byte upper bounds and image allowances. Recheck the published price record before execution; reconcile observed usage against conservative reservations and stop on unexpected model/tier/usage. If authoritative pricing differs materially, revise the proposal before paid execution.

Example reservation: a conservative 100,000-token input bound and full 6,000-token output allowance reserve US$0.6125 at those higher rates plus margin. Actual usage is normally lower; never extrapolate this example into a promise that thirteen turns fit. Track estimated token cost, conservative amount committed/reserved, and unknown actual charges separately.

## Decision after testing

Deliver a per-turn scorecard, inspectable project files, images, traces, preservation diffs and cost ledger. Rank failure mechanisms by blocked tasks, affected domains, severity and evidence strength. Recommend **one** general-purpose improvement with a minimal change surface and withheld acceptance cases. Connected-edit scope is a leading hypothesis, not the predetermined answer. Do not implement that improvement, merge, deploy, or start another feature as part of this baseline authorization.
