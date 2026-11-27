# Focused reliability improvement and fresh browser evidence

**Recommendation: hold merge and deployment.** The focused change resolves the recorded reference/calculation failures and passes its offline browser proofs. Fresh AI also demonstrates a useful connected edit on a 65-part curved assembly. However, the independent reader still creates semantically wrong or unprovably corrected calculations that block legitimate work. This is not yet a reliable general completion improvement across the tested requests.

Application code is frozen at **05277619f6fa337cdb1bfb0825654cbe5259ed2d**, on `fix/workshop-verification-recovery`. No source changes occurred during a scored batch. The first freeze (`16361bb`) and its failures remain preserved. Stable comparison is `f925e4c`; original `f5ba626` and `433d9ba` worktrees were not modified. Production, merge status and deployment were not changed.

## Review the change

- [Focused reliability diff](reliability.diff): changes after integrating the previously frozen inspection/calculation foundations.
- [Entire runtime diff against the stable release](integrated-runtime.diff): useful because this is an integrated branch comparison, not a single-change ablation.
- [Source](https://github.com/rmoralesp432/atelier/tree/05277619f6fa337cdb1bfb0825654cbe5259ed2d).
- [Offline browser evidence](browser/), [validation logs](logs/), [spending summary](campaign-summary.json).

Inspection, modeling selectors and completion checks now share exact object/group reference resolution. IDs, group IDs, names and explicit group references agree; ambiguous labels are unresolved instead of selecting different objects in different subsystems.

Generated calculations are checked for valid operators, arity, dependencies, units and output shape before judging geometry. Malformed checks retain their identity and requirement; they are not converted into geometry failures. The existing one-attempt independent correction path can repair an equivalent expression. The host retains source values/citations, coordinate frame, selectors, scope and tolerances, proves a limited equivalence, then validates and measures again. It never grants the modeling agent an override of failed checks.

Required unresolved placement prevents commit and produces a user-visible explanation that the proposed changes were not saved. Unsupported qualitative checks remain honestly unverified under the existing safe-commit policy. Geometry transactions, identity preservation, Undo/Redo and project storage were not replaced or relaxed.

A narrow second freeze corrects an actual live finding: dimensional zero written as zero times an existing finite scalar quantity can be equivalent to scalar zero. This normalization cannot erase arrays, measurements or undefined compound arithmetic. The earlier freeze and failed trial remain intact.

## What the offline proof establishes

459 unit tests in 83 files and the production build passed. Five focused production-browser replay tests passed:

1. Recorded group-reference case commits correctly.
2. Correct recorded reflection commits.
3. Reflection displaced by 40 mm remains blocked.
4. An unresolved required criterion leaves the saved project unchanged.
5. The recorded live dimensional-zero correction allows the correct 31-part model to commit.

Successful cases survive browser reload and Undo/Redo; unrelated objects remain exactly equal. These are **actual application commits using saved responses**, not fresh AI results. Reflection correction is scripted expression regrouping; the dimensional-zero replay uses both recorded executor and recorded independent-correction responses. A 25 mm shelf displacement remains incorrect in the host test. A separate rotated solid with different dimensions and mixed units checks generalization. Source/tolerance/scope changes, array erasure and undefined arithmetic are rejected.

## Fresh browser findings

All paid trials used fresh GPT-6.1-sol executor and independent-reader responses through the normal browser workspace and real modeling engine. Independent occupied-solid measurements do not rely on model labels or the app's success statement. Versions received the same natural prompts; follow-ups supplied changes, not original measurements or tool names.

| Batch | Evidence and outcome |
| --- | --- |
| [1 — first freeze](../live/BATCH-1.md) | 12 turns, 8 pass, 4 not committed. New reference handling accepted the 33-part canopy that the stable reviewer rejected as an empty group. Connected canopy lowering committed. A valid dimensional-zero correction exposed the first guard defect, fixed in the separate second freeze. |
| [2 — recovery freeze](live/BATCH-2.md) | 6 turns: 3 pass, 2 held, 1 original strict geometry-score failure. The shelf's dimensional format was corrected, but its original arithmetic still targeted centers 20 mm sideways. Correct geometry was rejected. The curved model's angular calculation stayed malformed and its save was held without geometry-repair instructions. |
| [3 — matched edit diagnostics](spatial-metrics/BATCH-3.md) | 10 turns, 8 pass, 2 held. Stable completes all six edits. Candidate completes both sculpture edits; correct shelf/conveyor proposals are held because valid corrected expressions exceed the guard's equivalence proof. Two dependent candidate turns are not attempted. These start from identical validated saved models, so they are **not** fresh creation-to-edit successes. |

All committed trials preserved unrelated work and passed reload, Undo/Redo and atomic-history checks. No materially wrong committed geometry or project corruption was confirmed. This is limited evidence, not a guarantee of arbitrary request correctness.

The original curved-model score remains `COMMITTED_INCORRECT` in its raw batch. Investigation found that untranslated volume difference effectively imposed a tighter position tolerance on thin cylinders than the protocol's stated 2 mm. A separate calibrated measurement contract tests placement and shape independently, without changing application code. It passes 39 controls, including a different thin cylinder, rotated panel, over-tolerance displacement, shape distortion, replaced IDs and collateral changes. [Reassessment](spatial-metrics/curved-reassessment.json) finds maximum position error **0.574 mm**, negligible dimension error, and valid shape. Original failures, code and scores were not rewritten. This measurement-method correction is explicitly separate from the original score.

## A working connected edit, and what was actually inspected

[Download the editable candidate result](live/models/reliability-edit-diagnostics-reliability-L4-diagnostic-edit2.atelier.json). It contains a 65-part sculpture plus two untouched samples. Each of two natural edits changes **64 original components**, retains all IDs and preserves the plinth and samples exactly:

- Lift the balls 20 cm and extend their existing stems.
- Enlarge each ball 6 cm without moving its center; shorten the stems to retain the connection.

The first edit uses the supplied starting-scene summary. The second explicitly calls `inspect_scene` on three starting objects, then applies the inferred change across the assembly. The independent reader derives expected dimensions and placements from original sphere width/base and stem height plus the requested deltas. The actual solids, centers and connected parts pass; the application commits, reloads and supports Undo/Redo. Stable also succeeds on this pair; the result does not prove exclusive capability of the candidate.

[View the saved model](live/views/reliability-edit-diagnostics-reliability-L4-diagnostic-edit2-framed.png) (read-only UI camera framing for review). [Detailed inspection evidence](live/boundaries.json) and [component-by-component changes](live/component-changes.json) distinguish tool observation, geometry correctness and commit.

The same inspection mechanism returns all 31 shelf members and 34 conveyor members with no missing group IDs. Independent offline replays confirm their proposed connected edits are geometrically correct and preserve unrelated work. Their commits are nevertheless blocked by correction equivalence. Passing those replays is **not** a browser commit.

## Remaining blocker

Two distinct limits remain at the verification boundary:

- A formula can be well typed yet encode the wrong relationship. In the fresh shelf trial the first center was calculated as `-2.005 m` rather than `-2.025 m`. The agent correctly identified the contradiction with the requested fitted shelves; the host still classified the measured mismatch as a geometry failure. This is outside the current malformed-expression detector and remains an unresolved false-rejection defect.
- Valid corrections involving zero/array expressions can be broader than the host can prove equivalent. They are safely held as unresolved rather than allowed to override requirements, but legitimate editing remains blocked.

The next valuable correction is at this same boundary: establish consistency of derived targets with the requested spatial relations, and provide a sound typed equivalence treatment of scalar/vector zero. Merely adding more examples or increasing retries would not resolve it. **No further application change was started.**

## Costs and stopping point

This focused task used **94 API calls, estimated $5.603006**, with **$7.0037575** conservative accounting. All provider token usage returned; no unresolved-charge reservations remain. These are approved pricing estimates, not a confirmed bill. The existing cumulative campaign ledger is preserved: estimated $15.025064, conservative $18.78133; the separate earlier Phase 3 baseline estimate of $2.055574 remains recorded separately. No recharge setting was changed or enabled; this environment cannot verify the account's current auto-reload setting.

Across this task the median executor call was 10.81 s; median independent-reader call was 15.23 s (maximum reader call 37.99 s). Per-turn elapsed times include modeling, observations and transaction checks and are retained in the raw reports. Corrective reviews add real latency.

Testing stopped after the planned paired diagnostics completed, with credits remaining: further similar trials would repeat identified verification failures. All positive, negative, failed and incomplete evidence is preserved for the next decision. Physical devices and voice were outside this focused change and are not newly validated.
