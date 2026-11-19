# Focused demonstration release acceptance

**Recommendation: merge and deploy the tested application, with the verification limitations below disclosed.** Production deployment and smoke results are recorded separately after release. This report does not claim that every possible modeling request is verified.

Application changes are frozen at `582708bccb3cead96a3337b9be635d408e344e91`. PR head `00510f4d68b232409c2e95a1364716e93ef56c92` has identical application, server, dependency and browser-test source; its additional changes preserve evidence and add production smoke infrastructure. [Required CI run 44527192732](https://github.com/rmoralesp432/atelier/actions/runs/44527192732) is fully green: validation, all eight browser shards, and aggregate `check`. Local validation passed 407 unit tests, build and formatting. The previously failing shard passed all 18 tests.

## One real-AI sequence, resumed after a harness error

The original architectural prompts and dimensions were reused. Real GPT-6.1-sol generated the tool calls and independent review responses; the actual production App, geometry engine and browser persistence executed them. No handcrafted building, modified AI response or relaxed application protection substituted for the result.

| Step                            | Measured result                                                                                                                                                                                                                                                         | Transaction result                                                                                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create four-level study         | 237 editable components: 4 occupied slabs, 1 roof, 48 columns, 80 panes and 104 facade-frame components. All 22 external geometry checks passed; 19 × 13 m footprint and storey heights 4.2, 3.3, 3.7, 3.3 m.                                                           | Committed despite selection, resize and conversation changes while finalization was held. Reload, retained context/conversation, one Undo and exact Redo passed. |
| Increase lowest storey by 1.1 m | 499 external checks passed after explicit measurement of base attachments. Height became 5.3 m; upper storey heights and footprint stayed fixed. All 237 identities, material/shape preservation under the intended transforms, and the unrelated marker were retained. | The exact paid responses committed successfully in the restored original browser project. Reload, retained context/conversation, one Undo and exact Redo passed. |

Creation took about 173 seconds including live reasoning, independent review and the evaluation's UI hold. The edit used about 29.9 seconds of executor time and 27.0 seconds of reviewer time. The completed browser replay of that already-generated edit took about 10.7 seconds and made **zero additional paid calls**.

### Harness failure and correction

The first height-edit attempt is permanently recorded as `FAILED`. Its harness demanded an unsaved-preview badge during independent review. The App intentionally keeps a single final batch private until verification, so there was no intermediate preview to label. The harness aborted before commit. It now requires the badge when intermediate geometry is displayed; otherwise it verifies that the original scene remains rendered. In both cases the original project/history must remain unchanged until the commit, and harmless UI changes are still exercised.

The saved executor and reviewer responses were replayed only after comparing the actual original scene, groups and units with the original requests, and comparing reviewer candidate identities exactly. The same saved project, component IDs, conversation and Undo history were restored. No new inference was presented as having occurred, and no paid call was repeated. The original failure, raw responses and costs remain in `attempt-2`; the successful resume is in `attempt-3`.

The external edit oracle initially marked two bottom rails unverified because its anchor classification used a thickness-based cutoff. Actual solid measurements establish that these horizontal members touch the fixed base slab. A general base-contact classification now resolves those attachments without using names, IDs or building-specific dimensions. The unchanged bounds and occupied-solid comparisons require their original geometry and placement to remain intact. Controls with deliberately shifted or stretched bottom rails are rejected. Separate tests reject floating, detached and vertical members. This adds evidence for previously unknown anchors; it does not remove geometric requirements or turn an unknown into a pass without measurement.

Two local preparation errors were corrected and retained in logs: a raw session artifact was initially passed to the versioned-session parser, and a test-only primitive fixture was below the ordinary primitive minimum thickness. Neither error executed a paid call or changed application geometry behavior.

## Built-in verification remains partially unverified

Both accepted steps retain `PASS_WITH_DISCLOSED_LIMITS`, not a fully verified host result:

- The creation reviewer exhausted its 6,000-output-token allowance after about 45.8 seconds. ATELIER explicitly reported incomplete verification, kept the existing marker protected, and did not claim an independent geometric pass. External measurements established this particular building's correctness.
- The edit reviewer completed in about 26.9 seconds. Its other checks and permitted edit scope passed, but one preservation selector used a bare group ID that the selector resolver could not resolve. This remained explicitly unverified. The external 499 checks established the requested edit and complete identity/geometry preservation.

These are documented verification-coverage limitations, not evidence that arbitrary future outputs are correct. No geometry predicate, transaction check or production operation limit was weakened. No observed false certification, lost identity, corrupted project or broken Undo/Redo occurred in this focused sequence. Earlier independent repair/recovery evidence remains preserved and was not rerun as an unrelated benchmark.

## Spending

- Six additional live calls in this focused sequence: **US$0.832966 estimated** from returned token usage, without cache discounts.
- Aggregate reconciled usage estimate across the release evaluation: **US$2.937918**, across 29 reconciled calls.
- Two earlier calls still have **unknown actual usage**: the original separately authorized **US$0.62 allowance**, and the interrupted reviewer's full **US$0.22113 reservation**.
- Conservative aggregate accounting, including the 25% margin on reconciled usage and both unknown allowances: **US$4.5135275**, below the authorized US$20 ceiling.
- 31 started paid calls in total. The interrupted calls remain in the counters. The browser resume and production smoke preparation made no paid calls.

Original ledgers are not reset. `chargedUsd` in historical harness records is a conservative accounting amount, not a confirmed billing charge. Unknown usage is never reported as a confirmed charge.

## Release limitations

Physical iPhone microphone/continuous-voice behavior still needs a device test. The intermittent hardware-specific black viewport band remains unreproduced; automated viewport coverage is green. Built-in verification may disclose incomplete coverage, as above. Public production smoke will verify the deployed bundle, liveness, configured agent, manual editable geometry, reload and Undo/Redo in fresh browser storage; it does not perform an additional paid production AI generation.

The current production commit `9bb6ad42997979f3b55b8218a1c9dcfd22f61dff` and Render deployment `dep-dbv0t20m7kps739tcp5g` are the rollback reference. Do not start the next modeling milestone during this release.
