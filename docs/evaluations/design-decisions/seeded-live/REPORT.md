# Seeded recall-and-revision diagnostic — fresh AI

Completed November 26, 2026. **Both requested edits produced correct editable geometry and saved through the browser.** The independent reviewer recovered the original user quotation. Attribution of the modeling agent's recall remains inconclusive, and the run exposed premature replacement of an active decision's source quotation. This is a mixed continuity result, not proof that the full design-decision milestone is complete.

Application remains frozen at `deb730317cafe2e0b251a788693934196660140c`. The evaluator was committed at `cfac4b1` and frozen before paid execution; all frozen file hashes were checked again afterward. No application changes, merge, or deployment were made for this diagnostic. The separately authorized iPhone release is independent.

## Reviewable evidence

- [Machine-readable scores](SCORES.json), [full browser/provider results](results.json), [spending](spending.json), [ledger](ledger.json)
- [Complete evidence ZIP](ATELIER-seeded-recall-evidence.zip): exact API bodies/responses and usage, preflight, frozen hashes, offline calibration, browser states, geometry measurements, Undo snapshots, exports, screenshots and negative-control feedback
- [First saved model](turn-1.atelier.json), [revised saved model](turn-2.atelier.json)
- [Raised assembly](turn-1.png), [revised assembly](turn-2.png)
- [Negative controls](negative-controls.json)
- [Approved protocol](../seeded/FRESH-AI-PROTOCOL.md) and [validated seed](../seeded/fixture/seeded-recall-start.atelier.json)

The historical protocol's statement that execution was not yet authorized describes its preparation date. This run's subsequent authorization is preserved separately in [authorization.json](authorization.json). The previous failed live creation is retained unchanged in the separate `live` evidence; this run did not retry that creation or replace it with a pass.

## Conditions and context

Real `gpt-6.1-sol` Responses calls drove both executor and independent reviewer through the normal production-build browser application, actual geometry engine, verification and atomic save path. Executor reasoning was high; reviewer reasoning low; output ceiling 6,000 tokens; service tier default; automatic SDK retries zero. The controller enforced the approved US$2 aggregate conservative accounting ceiling and 20 paid-call maximum before each call.

The twelve-component starting project was seeded from the published validated fixture. Its saved user decision had revision 1 and its original source-message link. The browser saved it, reopened it from IndexedDB with the local session cache removed, and delivered the decision to both roles. Each role received the normal twenty-message recent window, which contained neither the original wording nor an assistant reminder of the clearance. The original message remained in full saved history. No reminder, criterion, expected value or tool choice was added to either fresh request.

This is a **seeded diagnostic**, not fresh capture through a successful initial AI creation commit. The fixture's intervening work and the offline rehearsal use scripted responses and are labeled accordingly. The two scored edits use fresh AI; the later intentionally wrong controls reuse captured criteria offline.

## Separate outcomes

| Question                       | Turn 1: raise by 11 cm                                                                                                                                                                          | Turn 2: explicitly revise to 18 cm clearance                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stored context delivered?      | Yes: exact original decision and source, absent from recent messages                                                                                                                            | Yes: the note version saved by turn 1                                                                                                                            |
| Agent behavior                 | Called `inspect_scene` on the original rig relative to the turntable; explicitly planned to retain the existing 32 cm loading clearance                                                         | Lowered the panel and extended its hangers; preserved posts/crossbeam rather than copying the scripted rehearsal's construction                                  |
| Source of recall               | **Inconclusive.** Behavior is consistent with the decision, but the initial geometry itself reveals the gap. Its ordinary explanation did not independently establish why that gap must persist | Explicit revision honored. This is not another no-reminder recall test: the request states both clearances, and the prior assistant response now repeats the gap |
| Reviewer source                | Independently cited `source=decision` and the exact original two-sentence clearance quotation, including the bulky-sample reason                                                                | Cited the current request's 18 cm instruction; did not enforce obsolete 32 cm                                                                                    |
| Independent solids             | Correct; eight original components changed, four preserved                                                                                                                                      | Correct; three components changed, nine preserved                                                                                                                |
| Browser save                   | Committed; reloaded; one atomic Undo; reload while undone; Redo                                                                                                                                 | Same, including matching note revisions                                                                                                                          |
| Remaining verifier uncertainty | Full practical loading usability and structural adequacy disclosed as unverified                                                                                                                | Same                                                                                                                                                             |

The reviewer's exact first-turn clearance citation was:

> Leave exactly 32 cm clear between the turntable top and the underside of the light panel so bulky samples can be inserted. Keep that sample-loading space usable as we develop the rig.

The reviewer calculated the new top from **pre-edit measured top 0.24 m + user quantity 11 cm = 0.35 m**, in world XYZ with Y up. The host records the source values, unit conversion and calculation. Expected clearance came from the user decision (0.32 m), then the explicit current request (0.18 m), not from the candidate geometry. The signed check correctly subtracts the turntable's maximum Y from the panel's minimum Y.

## Actual geometry and preservation

| Measurement                                 | Initial | After turn 1 | After turn 2 |
| ------------------------------------------- | ------: | -----------: | -----------: |
| Turntable top                               |  0.24 m |       0.35 m |       0.35 m |
| Light-panel underside                       |  0.56 m |       0.67 m |       0.53 m |
| Clear vertical gap                          |  0.32 m |       0.32 m |       0.18 m |
| Turntable diameter                          |  0.70 m |       0.70 m |       0.70 m |
| Editable components / retained original IDs | 12 / 12 |      12 / 12 |      12 / 12 |

Each turn passed 58 external solid, relationship, identity and preservation checks. Supplemental offline measurements of the captured saved solids found zero occupied volume within the defined circular loading envelope and contact between pedestal and turntable. Actual-solid contacts connect the light panel through its hangers and frame to grounded feet. These establish geometric clearance/contact, not structural strength or an invented sample insertion path. Linear tolerances stayed at 1 mm; round-solid tessellation allowance stayed at 2%.

Turn 1 extended the pedestal and two posts and raised the turntable, panel, crossbeam and two hangers. Turn 2 lowered only the panel by 14 cm and extended its two hangers downward, retaining the frame's height. This is a valid different construction from the offline rehearsal. No evaluator prescribed either tool selection or support strategy. The storage cube and sample puck retained their entire original object data throughout. The frame feet also stayed unchanged. Every component remained individually editable with its original UUID.

The host reported **unverified / canCommit=true**, not full verification, because the reviewer disclosed qualitative usability and structural limitations. All selected measurable checks passed. The browser displayed those limitations and saved through the existing uncertainty rules. External measurements provide additional evidence; they do not retroactively turn an application-level unverified property into a reviewer pass.

## Continuity defect preserved, not repaired

During turn 1, the agent used `design_note` to revise the same decision ID even though the user had changed the turntable elevation, not the continuing clearance. Its new paraphrase retained 32 cm, but the active source quotation became only “Raise the turntable surface by 11 cm. Keep its diameter and horizontal position unchanged.” The original bulky-sample wording was no longer the active decision quotation after this save.

The original quotation remains in full history and the prior Undo snapshot; there was no project-data loss. Nevertheless, a later reviewer cannot cite the active note's new quotation as original user evidence for the continuing 32 cm requirement. **Source-linked continuity is therefore not fully demonstrated.** This was not fixed or hidden during the trial.

On turn 2, the same decision ID correctly advanced to revision 3, quoted the explicit flatter-sample request, and recorded 18 cm. Reload and Undo/Redo restored the matching geometry and decision versions exactly. This verifies explicit revision behavior without erasing the preceding provenance limitation.

## Wrong-result controls

Both controls ran afterward, offline, through the normal browser, using the freshly captured checks without substitutions. No further AI calls were made. Geometry-repair feedback was captured and the scripted control stopped rather than repairing itself.

- Raising only the turntable/pedestal leaves **0.21 m**, not 0.32 m, under the panel. The original fresh offset check measured that error and prevented saving.
- Recording the new 18 cm decision without moving the panel leaves **0.32 m**, not 0.18 m. The fresh revision check measured that error and prevented saving.

Both are **measured geometry rejections**, not saves blocked merely by unresolved verification. Original geometry, notes and saved history remained intact, including an IndexedDB-only reload. Neither dependent control was skipped; both reached the intended checks. There were no fresh-response failures, infrastructure interruptions or hidden reruns in this diagnostic.

## Usage and timing

Model access was rechecked successfully immediately before the trial. The accepted secondary registry pricing estimate was unchanged: US$2/M input and US$10/M output at these context sizes. Reservations used US$4/M input and US$15/M maximum output plus 25%, with no cached-input discount. [Preflight record](preflight/documented-pricing.json). This is not an account-verified invoice rate, and no billing or auto-reload setting was changed.

- **Five paid calls:** three executor calls including one inspection continuation, two reviewer calls.
- **87,736 input tokens; 4,265 output tokens.** All five usage records reconciled; no unknown-charge reservations.
- **Estimated cost: US$0.218122. Conservative accounting: US$0.2726525**, below the US$2 ceiling. No additional paid tests were started.
- First turn: 63.7 seconds including browser persistence/history checks; executor provider work 23.6 s, reviewer 17.5 s.
- Revision: 54.5 seconds including persistence/history checks; executor 15.8 s, reviewer 17.0 s.

Offline calibration passed both browser edits before the harness freeze. Budget tests passed 3/3 and the frozen application build passed. Neither offline results nor post-trial controls are counted as fresh-AI successes.

## Recommendation

The run supports connected editing, explicit revision, independent source citation, correct saves and transaction/history integrity on this validated assembly. It does not establish causal executor recall or fresh decision capture through successful initial creation, and it identifies a specific active-source continuity problem. Keep `deb7303` frozen and separate from release until that provenance behavior is reviewed. No new implementation, paid run, merge or deployment is authorized by this diagnostic's success.
