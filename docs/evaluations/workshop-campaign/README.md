# ATELIER workshop campaign — evidence archive

Evaluation only; no application behavior, production branch or deployment changed.

**Completed report: [comparison, limitations, costs and recommendation](REPORT.md).** 258 live API calls; estimated $9.422058. [Editable model copies](artifacts/editable-models.zip). The chronological records below preserve failures, interruptions and diagnostic distinctions.

## Published batch: console creation and follow-up

**Both versions created and committed a coherent, grouped, four-piece console.** The original paid creation runs passed every independent geometric check, but their browser persistence checks hit evaluator issues. Those interrupted records remain unchanged. Using the actual saved AI-created consoles and conversation, fresh follow-ups then ran through the browser; creation restoration and the edited results both passed reload and exact geometry/context Undo/Redo checks.

| Boundary | Stable baseline | `f5ba626` |
|---|---|---|
| Creation | Correct four editable solids and preserved reference objects | Same |
| Starting-model inspection during follow-up | Used available scene context; no explicit inspection call | Independently called `inspect_scene` with `snapshot: before` and the top as relative reference |
| Follow-up intent | Widen by 42 cm while preserving overhangs and connected parts | Same |
| Independent feedback | Detected a stretcher connection issue; fresh agent attempted repair | Same |
| Final measurement | Committed; supports and stretcher shifted 0.5 mm toward +X relative to the ideal centered edit | Passed all frozen external checks |
| Identities / unrelated objects | Preserved | Preserved |
| Reload / single Undo / Redo / conversation / camera | Passed in resumed browser workflow | Passed in resumed browser workflow |

The baseline's 0.5 mm displacement fails the frozen occupied-solid comparison for the thin support slabs, although it is below the protocol's general 2 mm position allowance. Preserve the strict result and actual measured discrepancy; **do not describe this as materially wrong architecture or strong statistical evidence of superiority**. It is a small precision difference. Both are usable edited consoles, and one matched pair is insufficient to establish reliability. The second arm spent more calls inspecting the original state; its final placement was exact under these measurements.

One extra baseline fixture-based edit was run by the initial harness after its persistence assertion. Its geometry passed, but it is a separately seeded diagnostic, not an end-to-end success. A baseline W2 attempt started before the coordinator stopped for the harness correction; it remains interrupted and will be rerun with the corrected harness. All charges are retained.

This published segment includes **18 calls, estimated $0.622392**, with usage returned for all calls and no unknown-charge reservation. Includes initial failures, the diagnostic and the interrupted W2 call. Estimated rates are $2/M input and $10/M output from the secondary pricing snapshot; not a confirmed invoice. The ongoing campaign totals are in [spending.json](spending.json).

## Reviewable evidence

- [Frozen protocol and scoring](PROTOCOL.md)
- [Current evaluation hash manifest](FREEZE.json), [original manifest](FREEZE-v1.json)
- [Boundary-by-boundary console results](console-boundaries.json)
- [Initial interrupted results](workshop-1-results.json), [resumed follow-up results](console-resume-results.json)
- [Full console traces, API usage, editable scene snapshots, screenshots and browser persistence evidence](artifacts/console-evidence.tar.gz)
- [Evaluator corrections, retained failures and their limits](HARNESS-CORRECTIONS.md)
- [Offline geometric calibration](offline-geometry-v2.json), [browser calibration](offline-browser-v2.json), [camera numeric calibration](camera-calibration.json)

## Second published batch: workshop arm across three domains

| Task on `f5ba626` | Creation | Follow-up | Evidence |
|---|---|---|---|
| Garden enclosure | Passed: nine editable components | Passed: floor +0.38 m, seven uprights shortened, roof and unrelated objects preserved | Reload, one Undo and Redo passed |
| Bored roller assembly | Did not commit: group ID was interpreted as a required group name | Separate fixture edit did not commit: reviewer exhausted its 6,000-token output allowance after 91 seconds | Failures retained; not counted as successes |
| Elliptical halo sculpture | Passed: actual rim/opening, two connected round supports, separate plinth | Passed: halo +0.28 m, supports extended from fixed feet, curved shape and opening preserved | Reload, one Undo and Redo passed |

The roller result is particularly revealing. An **offline replay of the saved AI operations** produces actual solids that pass the external geometry checks, including the bores. The unchanged reviewer still blocks that candidate because its `group.name` requirement contains the group's UUID. In an **analysis-only counterfactual**, replacing that ID with its actual name makes the candidate commit-eligible, with unsupported circular-void classification still disclosed as unverified. This establishes a criterion-reference mismatch; it does not establish a live commit, implement a fix, or count as a fresh-AI repair success.

The baseline garden-room rerun also produced a blocked creation: the reviewer interpreted footprint containment as a requirement to **fill the entire room volume**. The executor recognized that this would destroy the requested hollow room and refused to alter valid geometry to satisfy the mistaken check. Offline replay passes the same external solid oracle. Its separately seeded floor-height edit passed. This baseline result is not an end-to-end success. The completed baseline roller creation/edit and halo creation/edit both passed all solid and persistence checks.

The completed workshop-arm segment used **31 calls, estimated $1.262998**. [Full traces, measurements, saved models, interrupted baseline-start evidence, and labeled offline replay](artifacts/workshop2-evidence.tar.gz). The independent original conditions and all paid failures remain preserved.

Actual saved results, reopened in the normal workspace **without new AI calls**, with conversation minimized and occupied solids checked unchanged:

![Edited garden enclosure](views/workshop-2-workshop-W2-edit.png)

![Edited elliptical halo](views/workshop-2-workshop-W4-edit.png)

The comparisons below are separate from this initial workshop batch. No recommendation to merge or deploy is implied by interim results.


## Separate verifier comparison — first matched round

Both the stable baseline and `433d9ba` correctly created the sloped circular arrangement, reflected the three different existing solids, and blocked the deliberately displaced 40 mm negative control. The positive results actually committed and passed reload and Undo/Redo; the negative control left the project unchanged. The wrong candidate was scripted fault injection; its interpretation and review used fresh AI. The positive requests used fresh executor and reviewer responses.

`433d9ba` emitted one deterministic calculation for the arrangement and three calculations grounded in the pre-edit model for the reflection. The baseline used literal expected positions. This proves calculation provenance was used in a real workflow, **not a higher success rate**: both versions passed. Reviewer times were 13.4/23.1 seconds for the arrangement, 13.7/27.5 seconds for the reflection, and 15.0/17.8 seconds for the negative control (baseline/433). All ten calls cost an estimated **$0.299856**.

[Raw first-round results](verifier-1-results.json) · [Full reviewer calculations, geometry, browser state and calls](artifacts/verifier-evidence.tar.gz) · [Completed baseline workshop evidence](artifacts/baseline-fill-evidence.tar.gz)

## Transfer cases — rotated tapered supports and connected ramps

Both versions created and successfully edited the rotated workbench. The follow-up asked only to raise its working surface 23 cm while keeping the feet and top form fixed. Both independently extended all four tapered legs, preserved their identities and the unrelated reference samples, and saved the correct result with functional reload and Undo/Redo. `f5ba626` attempted a before-state group inspection, but its `$group:Workbench` shorthand matched zero members: the inspection tool expects object IDs. The response still included a group roster/bounds, and the application already supplied the original scene inventory/conversation. This is not evidence of successful member inspection; both edits nevertheless passed the independent solid checks. **Absence of an explicit inspection call is not evidence that it ignored available state.**

Both five-part ramp creations also had correct solids. An evaluator-only Float32 volume-consistency false flag was diagnosed and corrected in revision 4; original records remain intact. See [correction record](HARNESS-CORRECTIONS.md). The resulting fixture-edit diagnostics are kept separate: the baseline failed after trying a prohibited mid-transaction Undo; `f5ba626` used before/compare inspection and repaired an exact-metadata mismatch (`1.2` versus `1.2000000000000002`). This was useful recovery, though the trigger is itself an over-strict application verification issue.

Fresh edits were then performed on the **actual saved AI-created ramps**. Both produced the right solids, changing the middle platform and both connecting ramps while preserving the end platforms, identities and unrelated samples. Both passed reload and Undo/Redo. The baseline received a strict PASS. `f5ba626` retains a strict `COMMITTED_INCORRECT` row only because it sensibly renamed “platform 55 cm” to “platform 73 cm”; all geometric checks passed. [Label audit](ramp-name-audit.json). This is not evidence of incorrect geometry or a meaningful baseline advantage. Neither host claimed it could fully certify continuous walking surfaces; the separate occupied-solid oracle did establish the requested wedge connections.

The transfer batch used an estimated **$1.460112**, including the separately seeded diagnostics. Fresh resumed ramp edits added **$0.211714**. [Raw transfer results](transfer-1-results.json) · [Resumed ramp results](ramp-resume-results.json) · [Full transfer traces, saved editable models, numerical reassessments and browser checks](artifacts/transfer-evidence.tar.gz)

The later sections record the completed fresh matched repeats and same-project recovery after a blocked transaction. All applications remain frozen. Final estimated spending and reconciled usage are in [spending.json](spending.json) and [ledger.json](ledger.json).


## Editable results for direct review

The [model copies](models/) are exported from actual committed live results using ATELIER’s existing project exporter. Their solids, groups and Undo/Redo history were checked for exact equality after re-reading the exported copy. Download a `.atelier.json` file and use **Projects → Open project copy**. This creates a new imported project and does not overwrite existing work.

- [Raised rotated workbench — baseline](models/transfer-1-baseline-W5-edit.atelier.json) / [workshop](models/transfer-1-workshop-W5-edit.atelier.json)
- [Edited promenade — baseline](models/ramp-resume-baseline-W6-edit.atelier.json) / [workshop](models/ramp-resume-workshop-W6-edit.atelier.json)
- [Edited garden enclosure](models/workshop-2-workshop-W2-edit.atelier.json)
- [Lengthened bored roller assembly](models/baseline-fill-baseline-W3-edit.atelier.json)
- [Raised elliptical halo](models/workshop-2-workshop-W4-edit.atelier.json)

These exports and the screenshots are read-only reviews of saved live outputs, not additional AI runs. A model’s available copy does not erase any original strict-scoring flag; see the detailed case results.


## Repeat batch — completed W1–W4 pairs

Fresh console and garden-room creations plus their connected edits passed external solid checks, committed, and survived reload/Undo/Redo in both versions. Baseline garden creation exhausted its reviewer allowance; the application explicitly saved it as **incompletely verified**, not independently verified. The separate measurements established the solids were correct.

The second workshop roller creation reproduced the same group-ID/name criterion error. Its saved-operation replay again passes every external solid check and becomes commit-eligible only in a labeled analysis-only group-reference correction. No application fix was applied; the live result remains blocked. The separately seeded workshop roller edit also repeated the 6,000-token reviewer exhaustion. In contrast, both baseline roller creation/edit episodes passed so far. These are observed outcomes, not proof that the workshop inspection change caused the review failures: actual generated models and reviewer inputs differ. A matched edit on the identical validated roller fixture can isolate that representation confound if needed.


The complete W1–W4 repeat used **63 calls, estimated $2.483386**. Console, garden-room and halo creation/edit pairs passed in both arms. Baseline roller creation/edit passed; workshop roller creation and its separate fixture edit were blocked as described above. [Raw repeated results](workshop-repeat-results.json) · [Complete repeated traces and causal offline replay](artifacts/repeat-evidence.tar.gz).

The [offline project-copy browser check](project-import-audit.json) also passed: import the actual edited workbench through Projects → Open project copy, establish matching durable IndexedDB geometry, remove the temporary workspace/checkpoint cache, reload from the durable project, then Undo and Redo. This is an offline persistence check of saved real-AI output, not an additional live-AI success.


## Verifier repeat and post-failure recovery

The second round again produced correct committed arc and reflected arrangements in both versions, and both blocked the 40 mm displaced arc control. **Verification quality differed from geometry quality:** the `433d9ba` reflection reviewer emitted three-input additions, while its arithmetic tool accepts binary additions. All three position checks became unverified. The actual solids were independently correct and the application clearly disclosed incomplete verification; this is not a fully verified success. The first reflection round's calculations had been valid.

A saved-trace [offline arity audit](calculation-arity-audit.json) establishes the consequence: original malformed criteria classify both the correct reflection and an additionally displaced 40 mm result as unverified and commit-eligible. Analysis-only normalization of associative addition into binary nodes verifies the correct result and blocks the wrong one. **No wrong model was committed in this audit, and no application fix was implemented.** This is a verification-coverage risk, not a live false claim that measured wrong geometry was correct. It warrants attention before relying on this verifier as a complete correctness gate.

After each live negative control, a new fresh-AI request in the same still-open project successfully created a sphere. A subsequent natural request aligned its base with the taller existing reference sample, without supplying that sample's height. Both versions preserved the samples and sphere identity, committed, and passed reload and Undo/Redo. The negative executor was scripted fault injection with a fresh reviewer; the recovery creation/edit used fresh executor and reviewer responses.

This repeated verifier/recovery segment used **18 calls, estimated $0.463264**. [Raw repeated results](verifier-repeat-results.json) · [Full negative control, fresh recovery, API records and retained guard refusals](artifacts/verifier-repeat-evidence.tar.gz) · [Recorded successful calculation provenance](calculation-provenance.json).


## Completed transfer repeats and controlled roller diagnosis

Both versions again created and raised the rotated workbench correctly. In this repeat, `f5ba626` successfully retrieved all five original components through before-state inspection; the first round's group shorthand had returned zero members. Both retained the five identities and two unrelated samples, with exact persisted Undo/Redo.

Both fresh promenade creations passed. The workshop edit produced the correct middle platform and both ramps, preserving four other objects; its three raw metadata flags are sensible height-label updates, [audited separately](ramp-repeat-name-audit.json). The baseline edit did not commit because its reviewer exhausted 6,000 output tokens after about 92 seconds. Replaying its saved operations yields correct occupied solids and connections, also with sensible height-label updates; no live commit is claimed for that replay. This is a completion-verification failure rather than an inability to reshape the ramps.

The representation-controlled roller diagnosis then gave **both versions exactly the same validated starting fixture and the same follow-up request**. Both passed actual solids, all five original component IDs, the two unrelated samples, save/reload and Undo/Redo. Baseline inspected four current components; workshop inspected five before-state components. Both disclosed unsupported bore/qualitative verification rather than claiming complete coverage. This diagnoses editing independently of creation; it is not counted as a successful AI creation episode. Earlier fixture reviewer failures remain failures and demonstrate variability.

The transfer repeat cost an estimated **$1.459894** across 38 calls. The paired roller diagnostic added **$0.183514** across six calls. [Repeated transfer results](transfer-repeat-results.json) · [Paired fixture results](roller-fixture-results.json) · [Complete traces, raw models and offline ramp replay](artifacts/transfer-repeat-evidence.tar.gz) · [Component-by-component changes](component-changes.json).


The third reflected-layout repeat verified correctly in both arms. Thus the derived verifier successfully calculated two of three reflection runs; one remained unverified due to operand count. [Final repeat and saved-trace diagnostic evidence](artifacts/final-diagnostics-evidence.tar.gz).
