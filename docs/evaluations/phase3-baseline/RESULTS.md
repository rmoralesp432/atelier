# Phase 3 baseline — results and one recommendation

23 November 2026. **Baseline complete; application unchanged. No merge or deployment.**

The agent completed all twelve main turns successfully: eleven geometry requests committed, and the deliberately contradictory request produced a meaningful question without changing the project. Five contextual edits preserved the original components and unrelated geometry. However, the controlled repair test **did not complete**: the agent repaired the real error, but an independently generated coordinate check rejected the correct result.

This is positive evidence for the current modeling agent, and negative evidence for the numerical reliability of its completion criteria. It does not establish unrestricted modeling intelligence or justify calling the whole benchmark a pass.

## Conditions and evidence

- Actual application: `f925e4cef7b4c6a27eb1532476879728aa5d7584`, identical to the confirmed stable production source. Actual production bundle, provider, geometry kernel and browser App were used locally.
- Model returned by every paid call: `gpt-6.1-sol`. Executor high reasoning; reviewer low reasoning; existing output/operation limits; standard service requested, API returned `default`.
- Original evaluation freeze: runner commit `ca31c109ef54b0ecd28f7028db70cdcf1d426bd1`. Repair-only infrastructure revision: `4f1ef8b6bcf5674a9e0e5dffa22540bd0b4f29be`. Both manifests are preserved.
- Prompts, measurements, tolerances, starting scenes, application, pricing assumptions and fault policy were frozen before paid calls. Only an evaluator dependency-loading correction and attempt bookkeeping changed for the repair retry. Every other frozen file was checked unchanged.
- Offline preparation: 73 positive/negative/equivalence calibration cases; seven spending-guard tests; evaluator type checks; actual browser failure/commit/reload/Undo/Redo preflight. These are preparation evidence, not additional real-AI successes.
- Independent measurements evaluate actual occupied solids, mesh volume, section profiles, voids, transforms, object identity and preservation. They share the existing CAD kernel but do not use the application's completion result as the answer.
- A–F ran through real Chromium interaction. R ran through the live staged planner and actual engine with real rendered observations; it is not a second browser acceptance test.

See [the evidence index](evidence/README.md), [raw per-turn measurements](evidence/analysis.json), [coverage assessment](evidence/COVERAGE.md), and [execution issues](EXECUTION-NOTES.md). The full request/response traces, projects, browser storage, screenshots, calibration history and both attempts are archived there.

## Main outcomes

“Measured correct / limited” means the independent external checks passed and the application committed with disclosed verification limitations. It does **not** mean ATELIER independently proved every requested property.

| Turn | Request/result | External outcome | App completion status | Total time¹ | API estimate |
| --- | --- | --- | --- | ---: | ---: |
| A1 | Create an eight-part glazed entry canopy | Correct, committed | Limited | 70.6 s | $0.1103 |
| A2 | Raise clear headroom by 0.55 m; infer connected changes | Correct, same IDs | Verified | 44.5 s | $0.0773 |
| B1 | Create a seven-part oak workbench | Correct, committed | Limited | 63.1 s | $0.1093 |
| B2 | Lengthen it symmetrically by 0.40 m, retaining sections/setbacks/joins | Correct, same IDs | Limited | 41.8 s | $0.0708 |
| C1 | Create two hollow bushings and an oblique coaxial shaft | Correct, committed | Limited | 115.1 s | $0.2734 |
| C2 | Move one bushing outward, retaining clearance and equal end overhangs | Correct, same IDs | Verified | 59.1 s | $0.1416 |
| D1 | Create a hollow, sheared tapered lantern with a closed base | Correct, committed | Limited | 166.7 s | $0.3325 |
| D2 | Cut only its front wall, preserving the shell, back and base | Correct, same ID | Limited | 62.1 s | $0.1776 |
| E1 | Create ten hexagonal prisms in rotated, staggered rows | Correct, committed | Limited | 68.9 s | $0.1111 |
| E2 | Increase pitch while preserving center, stagger, shape and orientation | Correct, same IDs | Verified | 52.4 s | $0.0838 |
| F1 | Require one block to have two incompatible final heights | Safe, meaningful clarification | No modeling commit | 7.7 s | $0.0308 |
| F2 | Request a fresh sloping wedge in that same project/conversation | Correct, committed | Limited | 45.8 s | $0.1171 |

¹ Total measured turn time includes local rendering, verification and browser persistence/Undo checks. It is not just model response latency. There is one sample per task, not a population latency estimate.

All **11/11 committed main turns** survived real browser reload with the saved scene, conversation, agent context and camera retained. One Undo restored the preceding geometry/groups; Redo restored the resulting geometry. Each request produced one atomic modeling history entry. All five contextual modifications retained original identities; unrelated sample objects/groups were preserved. No unnecessary clarification was requested. F1's one clarification was appropriate: “A single final height cannot be both exactly 1.40 m and exactly 0.90 m. Which height should take precedence?”

The independent main-task checks passed 322/322 numerical/preservation assertions. This count is supporting evidence, not a substitute for the task outcomes above. Supplemental inspection confirmed explicit oak designations on all four workbench legs; physical wood composition or structural adequacy was not certified.

No creation failed, so no seeded edit diagnostics were needed or purchased. There are no substituted or handcrafted end-to-end successes.

## Controlled repair: real correction, failed completion

The first R attempt failed in the evaluation renderer before any paid call. After the isolated harness correction, the second attempt used a fresh real-AI creation of the frozen array task. An external oracle first established correct geometry. The harness then displaced one private provisional component 0.19 m perpendicular to the row direction.

1. The host detected an incorrect layout and prevented commitment.
2. The real agent restored the displaced component using ordinary application feedback.
3. The external oracle then passed all 36 checks. The affected ID survived; **all other objects and all groups remained exactly unchanged**.
4. The host nevertheless rejected the corrected scene three more times. Its cached expected-coordinate list contained two arithmetic errors.
5. The agent inspected the model, supplied the correct general row formula, and declined to move correct objects merely to satisfy the inconsistent check. The bounded planner ended without a committed transaction.

For two middle components, the correct Z coordinates derived from the prompt are `±0.367000389708486 m`. The reviewer instead supplied `±0.366 m`. Each difference is approximately **1.00039 mm**, just beyond its chosen **1 mm** tolerance. These are wrong expected values, not incorrect component positions or a floating-point comparison of identical values. The amount is small; the consequence is not: a correct repaired request is discarded.

| State | External geometry | Host result |
| --- | --- | --- |
| Before injected fault | Correct | Not yet evaluated |
| After 19 cm displacement | Incorrect | Incorrect; cannot commit |
| After autonomous repair | Correct; other objects exact | Incorrect; cannot commit |
| Following inspection/completion attempts | Still correct | Same cached failure; request rejected |

The successful geometric repair is **partial evidence**, not a completed task. R has no successful commit, reload or Undo/Redo result to claim. Its correct private candidate is retained in `live/R1-attempt-2-stage-8.json`. The [numerical audit](evidence/repair-numerical-audit.json) preserves the original, injected and repaired assessments. Paid R retry: nine calls, 99.9 seconds, $0.42006 estimated. No further paid reroll was attempted to obtain a favorable outcome.

## Confirmed causes and other observations

**The principal failure was independent-verification arithmetic and recovery, not the modeling agent's construction or edit scope.**

The reviewer emits an absolute point list for `positions` ([schema](../../../src/intelligence/completionSchema.ts)). The host faithfully checks those numbers. The consistency audit handles signed constraints and certain single-point datums, but does not establish that a multi-point list was correctly derived from its cited pitch, angle and stagger ([audit](../../../src/intelligence/criteriaAudit.ts)). The criterion was structurally valid, so it produced no `criterionIssues`. The bounded criteria-revision path therefore never opened ([completion verifier](../../../src/intelligence/completionVerifier.ts)); subsequent attempts reused the same wrong list. More agent inspections could not repair that contract.

Two other avoidable review costs appeared:

- C1: `POM (polyoxymethylene)` was rejected because the reviewer expected the exact label `POM`. The agent shortened the designation and completed the request. This is one confirmed transient semantic false rejection, not a geometry repair.
- C2: coordinated editing rounded positions to millimeters, while the reviewer requested 0.1 mm precision. The first candidate already passed the frozen external tolerance; a subsequent absolute-position operation restored extra precision. Record this as an over-tight precision contract, not a materially incorrect model. The [saved offline replay](evidence/C2-first-candidate-replay.json) establishes that distinction.

C1 also recovered from a genuine operation failure: its first orientation would cross the engine's ground constraint. It regenerated the private step above ground, oriented the parts and placed them correctly. No partial geometry was committed. These recoveries occurred within the unchanged application.

**Verification coverage remains limited:** only 3/11 committed main turns received an overall `verified` status; eight correctly used `unverified` with safe commitment and disclosure. Annular sections, hollow-wall thickness, local Boolean preservation, regular polygon sections and wedge slopes were among the properties the external measurements could establish but the built-in verifier could not. This is incomplete coverage, not eight false rejections. See the coverage matrix for distinctions between measurable gaps and legitimate qualitative limitations.

No externally incorrect geometry was falsely certified in this sample. One controlled-repair attempt was blocked after correct geometry had been restored; one main request had a transient equivalent-material rejection. This small sample cannot estimate rare-failure rates. In particular, there was only one deliberately injected geometric fault.

The initial hypothesis that connected-edit scope would be the main bottleneck was **not confirmed in these five small assemblies**. No scope broadening, exhaustive user object list or extra approval was needed. This does not settle the earlier large-building scope problem.

## One recommended improvement — derive checks from relationships, not guessed coordinates

Keep the present modeling agent and transaction system. The next focused improvement should make **expected geometric values traceable and deterministically calculated from the user's stated relationships**.

In plain language: the AI should identify what must line up, stay fixed, move together or keep a given spacing; the geometry system should do the numerical calculation. A reviewer should not have to hand-generate a long coordinate list and then treat its own arithmetic as unquestionable truth.

A small first implementation could add a bounded, typed mathematical/coordinate-expression layer to existing completion predicates. Support units, explicit reference frames, vector/affine calculations and references to original measurements. Keep the source values and calculation alongside each derived target. This is a general spatial capability, not a new array/building/furniture command or immutable design brief. It should reject unsupported expressions and retain operation/resource limits.

When independently reproducible evidence shows that the criterion contradicts its own source relationship, use the existing bounded revision mechanism to correct that criterion. The modeling agent must not simply override failures. The candidate's observed coordinates must never become the desired answer merely because the agent says they are right. Correct supported measurements must still gate commitment, and genuine uncertainty must remain explicit.

Validate this later against the preserved regression and **fresh held-out tasks defined after the improvement is frozen**. Require correct derived expectations, successful completion without gratuitous edits, rejection of actually wrong geometry, exact preservation of unrelated objects, and unchanged transaction/reload/Undo behavior. Do not widen tolerance, hardcode these coordinates, add building dependencies, replace the agent, or choose an easier test to obtain a pass.

This recommendation addresses the only demonstrated end-to-end modeling-completion failure in the baseline. Broader section-measurement coverage and material semantics are recorded gaps, not additional milestones started under this authorization. **No implementation of this recommendation has been made.**

## Cost and latency

- **53 paid calls:** 41 executor/tool-use calls and 12 reviewer calls. All returned `gpt-6.1-sol`; all usage records reconciled. No unresolved request-charge reservations remain.
- **Estimated API usage: $2.055574. Conservative accounting with the existing 25% margin: $2.5694675**, below the authorized **$15 aggregate ceiling**. The $15 was not treated as a spending target.
- Input tokens: 809,512 total; output tokens: 43,655, including 13,540 reported reasoning tokens. Largest single input: 29,067 tokens. No long-context pricing threshold was reached.
- Reviewer calls cost $0.266556 estimated in total. Their latency was 10.321–28.078 seconds, mean 18.697 seconds across 12 calls. Executor API time totaled 518.399 seconds; reviewer API time totaled 224.361 seconds. These are observed calls, not predicted production guarantees.
- Rates remain **secondary-source estimates**, under the user's explicit waiver of authoritative pricing verification and agreement to supervise actual billing. Pre-call reservations used the higher listed rates plus margin; reconciliation used observed usage without cache discounts. These figures are not a confirmed invoice. The ledger's historical field name `chargedUsd` means conservative accounted estimate here, not a verified charge.
- The first R harness failure cost $0. No paid seeded diagnostics, voice endpoints, external tools or additional benchmark reruns were used. Existing earlier-phase ledgers were not reset or included as new authorization.

## Limits and current state

The benchmark used precise outcome prompts, small assemblies of one to ten task components, one run per task and local Chromium with software graphics. It did not test hundreds of components, ambiguous creative briefs, unfamiliar reference drawings, physical iPhone voice/background behavior, large imported meshes or production concurrency. Neutral renders support basic visual coherence; visible faceting/shading on curved/Boolean surfaces does not establish smooth analytic CAD continuity. Material designations express intent, not physical certification.

The application remains at the confirmed stable production baseline. The evaluation branch contains only benchmark tooling, records and reports. **Nothing was merged or deployed, and the recommended improvement has not begun.**
