# Fresh design-decision trial on `deb7303`

**Result: incomplete. The first creation did not commit. Recall and explicit revision were not reached.** This is one fresh-AI browser trial, conducted November 26, 2026, with the frozen application. It is not a successful end-to-end decision-continuity demonstration.

The agent produced an 11-part scanning rig and storage cube, captured the user's original wording with host-attached provenance, inspected the supplied scene facts and rendered observations, and corrected the cube's position after reviewer feedback. A mandatory unsupported loading-volume criterion then prevented the entire transaction from saving. The browser retained the original empty project and the failed conversation after reload.

## Readable evidence and downloads

- [Machine-readable outcome and separate scores](SCORE.json)
- [Full fresh trace, including every executor/reviewer input and response](live-1/results.json)
- [Captured browser state](live-1/turn-1-browser.json) and [actual saved project export](live-1/turn-1-export.json)
- [Browser screenshot after rejection and reload](live-1/turn-1.png)
- [Offline forensic findings](live-1/offline-forensics/summary.json), [solid measurements](live-1/offline-forensics/independent-measurements.json), and [actual solid inventory](live-1/offline-forensics/solid-inventory.json)
- [Captured oblique observation](live-1/offline-forensics/captured-live-observation-1.jpg) and [top observation](live-1/offline-forensics/captured-live-observation-2.jpg), supplied to the fresh agent before its cube correction
- [Unmodified criteria evaluated against the reconstructed final proposal](live-1/offline-forensics/final-host-report.json)
- [Rejected proposal reconstructed offline](live-1/offline-forensics/corrected-proposal.session.json): **not a browser-committed project**. This includes the recorded operations' provisional history, not evidence of successful application finalization. Do not import it into the older production release, whose note schema differs.
- [Complete evidence ZIP](design-decision-live-evidence.zip), including raw API request/response bodies, usage, preflight, failed and successful offline calibrations, logs, exports and screenshots
- [SHA-256 manifest](SHA256SUMS.txt)

The original [protocol](../FRESH-AI-PROTOCOL.md) remains unchanged, including its historical “not authorized” heading. The later user authorization and billing-supervision clarification are recorded in [authorization.json](authorization.json) and [ledger.json](ledger.json); the trial retained **US$5 / 60 calls**.

## What fresh AI did, and what actually saved

| Question                                                                | Finding                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Capture original decision?                                              | **Provisionally yes; durably no.** The agent emitted `design_note` with the complete original user quotation, including the 32 cm gap and bulky-sample reason. The host attached the real source turn and decision ID, revision 1. It was rolled back with the rejected transaction. |
| Recall after reload without a recent reminder?                          | **Not reached.** Turns 2–14 did not run. No conclusion about recall from project notes versus recent assistant text is possible.                                                                                                                                                     |
| Honor the explicit 18 cm revision?                                      | **Not reached.** Updating the note's paraphrase during the same creation request is not a later user revision; the decision remained revision 1.                                                                                                                                     |
| Consult starting geometry?                                              | Initial scene was empty. Subsequent calls received actual provisional object facts and two rendered views. There were **no explicit inspection-tool calls**; do not count payload availability alone as independent tool consultation.                                               |
| Interpret the measurable gap?                                           | Reviewer quoted the original request and chose `panel minimum Y − turntable maximum Y = 0.32 m`, at 1 mm tolerance. Expected value came directly from the user, not candidate geometry.                                                                                              |
| Produce editable solids?                                                | Replaying the fresh saved operations reproduced the captured inspector data exactly. The corrected proposal has **11 separate, positive-volume, unlocked solids**. All **38 independent frozen-oracle facts** passed offline. This is geometric evidence, not a live-save success.   |
| Preserve identities and unaffected work during the recorded correction? | All 11 provisional IDs survived. Only the storage cube's position changed; all ten rig components were unchanged. The test started empty, so preservation of substantial pre-existing unrelated work in later edits remains untested.                                                |
| Save the result?                                                        | **No.** Actual export contains zero objects, zero design notes and no new Undo entry. The original project/context/history and failed conversation survived an IndexedDB-backed reload.                                                                                              |
| Undo/Redo of fresh geometry?                                            | **Not reached.** There was no committed geometry to undo.                                                                                                                                                                                                                            |
| Deliberately wrong follow-up controls?                                  | Both **not reached**, because no correct committed starting model existed. They are not reported as geometry rejections or passes.                                                                                                                                                   |

The first user turn took **74.450 seconds**, including local orchestration/evidence capture. The sole reviewer API response took **24.985 seconds**. All four API responses completed; no timeout, transport fault or billing/quota error occurred.

## Why the application refused the proposal

The independent reviewer returned 21 checks, all citing the current request. It did not cite saved decisions, since the original project was empty.

1. **Supported gap check was correct and passed.** The actual turntable top was 0.24000000000000002 m, panel underside 0.56 m, gap 0.32000000000000006 m. Circular diameter was 0.70 m; horizontal panel alignment was exact.
2. **Check 12 was `unavailable`, `required: true`.** It cited “Keep that sample-loading space usable as we develop the rig.” The reviewer said an unobstructed relative circular clearance volume and insertion path could not be expressed with the available fixed-world-box region predicate. This check caused the final save block.
3. **Check 21 was `unavailable`, `required: false`.** It disclosed that freestanding stability and physical support cannot be certified from contact alone. This was a nonblocking physical limitation, although the user-facing failure message listed it beside the mandatory blocker.
4. **There was also a coordinate-convention disagreement.** The executor followed the application's camera-relative “left” contract: an exact 2 m displacement along original-view left, with X approximately −1.696 m and Z +1.060 m. The reviewer independently assumed world-X left and demanded X = −2 m. The executor then positioned the same cube at (−2, 0, 0), satisfying that criterion. The first placement was not a distance error; the two roles used different directional conventions.

The unchanged host criteria after that correction produced **19 verified reviewer checks plus the host scope-preservation check**, zero measured geometry failures, and two unverified results. `canCommit` remained false because check 12 was mandatory. The host did not manufacture a pass, save unresolved work, or repeatedly deform correct geometry to address the unavailable check.

### Independent geometry review

| Property                     | Required                                | Measured from actual solids                                  |
| ---------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| Turntable diameter           | 0.70 m                                  | 0.70 m on X and Z; occupied circular solid comparison passed |
| Turntable top                | 0.24 m                                  | 0.24000000000000002 m                                        |
| Light underside              | 0.24 + 0.32 = 0.56 m                    | 0.56 m                                                       |
| Vertical gap                 | 0.32 m                                  | 0.32000000000000006 m                                        |
| Light centered horizontally  | Same X/Z center                         | 0 m offset on both axes                                      |
| Storage dimensions           | 0.40 m on each axis                     | 0.40 m within numerical precision                            |
| Corrected storage separation | 2 m                                     | 2 m                                                          |
| Support continuity           | Panel connected through frame to ground | Actual-solid contact graph reached both feet, within 1 mm    |
| Independent editability      | Separate selectable parts               | 11/11 unlocked positive-volume objects                       |

Forensic reconstruction replayed the exact stored operations in the frozen engine. Randomly allocated replay UUIDs were rebound to recorded identities; full object, group, design and conversation records were asserted equal to the live inspector before applying the recorded correction. No model response, operation, check or tolerance was changed. These assertions and measurements are reproducible with [the offline analysis script](../../../../scripts/design-decision-analysis/replay.ts).

Additional **post-trial diagnostic** solid intersections found no occupied volume inside either a requested circular loading volume or one front rectangular insertion envelope. The probe dimensions came from the original 70 cm diameter, 24 cm top and 32 cm clearance, with a 1 mm boundary inset. The front approach was an evaluator-selected diagnostic, not a new user requirement. These findings support geometric usability for that envelope; they do not certify every sample shape, insertion motion, connection strength or structural stability. The reviewer never received these probes, and they did not change the trial's failed save.

Visual review of the two captured views shows a coherent two-post rig with a centered panel and a separate cube. The panel obscures some underlying geometry in the top view; dimensions and contacts were checked against solids rather than inferred from the image.

## Offline calibration versus fresh evidence

Before paid calls:

- Production frontend build passed. The isolated budget tests passed **3/3**.
- Fourteen scripted geometry-calibration turns passed; a displaced panel was measured incorrect.
- First scripted browser attempt failed because its evidence quotation exceeded the schema's 400-character limit. The failed attempt is preserved as [offline-1](offline-1/results.json); only the scripted quotation was shortened before freezing the harness.
- Corrected [offline-2](offline-2/results.json) passed all 14 turns, with browser commits, persistence, reload/Undo/reload-while-undone/Redo at turns 1, 12, 13 and 14, and matching geometry/decision versions.
- Both scripted negative controls were **measured rejections**, with original state and reload intact. See [offline controls](offline-2/negative-controls.json).

These establish harness and persistence behavior with scripted responses. **They do not establish fresh-AI recall or revision.** Other preflight-only issues were test-file discovery and a thin-part calibration operation using a primitive below its supported size; the fixes and failures are preserved in [calibration-failures.json](preflight/calibration-failures.json) and the ZIP logs.

During post-trial analysis, the frozen oracle's automatic role-binding heuristic was found to match both “Turntable pedestal” and “Circular turntable.” The live run stopped before invoking that binding, so it did not cause this result. Forensic analysis explicitly bound recorded identities and independently measured their solids. A future authorized trial should make that evaluator ambiguity explicit before its next freeze; this run was not rescored or restarted.

## Access, accounting and freeze integrity

- `GET /v1/models/gpt-6.1-sol` returned 200 before the trial. All four paid responses returned **`gpt-6.1-sol`**, default tier; executor high reasoning, reviewer low, 6,000 output-token cap.
- Billing/credit endpoints returned **403**. The user then explicitly took responsibility for supervising billing. Current balance and automatic recharge state remain **unverified and unchanged**; no old expiring balance was assumed available.
- The documented secondary pricing registry was refreshed and unchanged: **US$2/M input and US$10/M output** for the observed context sizes. Reservations used **US$4/M input, US$15/M maximum output, plus 25%**. No cache discount was taken. The official pricing page was unreachable, so these are estimates rather than confirmed account invoice prices.
- Usage: **59,339 input tokens, 4,055 output tokens**, including provider-reported reasoning tokens. **4/60 paid calls**.
- Estimated cost: **US$0.159228**. Conservative accounted amount: **US$0.199035 / US$5**. **Zero unresolved calls or retained unknown-usage reservations.** Actual dollar charges remain subject to billing reconciliation; known token usage is not an invoice.

| Call | Role                     | API latency | Input tokens | Output tokens | Estimated USD | Accounted USD |
| ---- | ------------------------ | ----------: | -----------: | ------------: | ------------: | ------------: |
| 1    | Create and capture       |    29.340 s |       13,290 |         1,827 |      0.044850 |     0.0560625 |
| 2    | Request completion       |     4.391 s |       19,294 |           171 |      0.040298 |     0.0503725 |
| 3    | Independent requirements |    24.985 s |        4,905 |         1,560 |      0.025410 |     0.0317625 |
| 4    | Position correction      |     9.183 s |       21,850 |           497 |      0.048670 |     0.0608375 |

See [ledger](ledger.json), [model preflight](preflight/model.json), [pricing snapshot](preflight/documented-pricing.json), [freeze](FREEZE.json), and [post-trial integrity check](freeze-verification.json). All **284 frozen file hashes** matched. Runtime, server, tests, dependencies and workflows are unchanged from `deb730317cafe2e0b251a788693934196660140c`. The evaluation harness was frozen at `4c3e6f2f47940bfe07657e4c8efe9ed8dcd39d8e`; later additions are evidence and offline forensic analysis only.

PR #25 remains open at `b014de9`; the decision implementation remains frozen at `deb7303` with its documentation branch at `e870c53`; the iPhone branch remains `509e157`; the deployment branch remains `f925e4c`. No merge, deployment, application change, second fresh trial or automatic recharge was performed.

## Recommendation

**The fresh-AI decision-continuity milestone remains unvalidated.** This single attempt demonstrated provisional capture and correct measurable geometry, but cannot support a release recommendation for recall or explicit revision.

The immediate obstacle is verification tool selection and representation of a user-stated purpose: the reviewer correctly understood the numeric gap, but added a mandatory clearance-volume check it considered unsupported. Investigate whether existing region/relationship predicates can establish a sufficient conservative clearance envelope, and how both roles share the directional convention, before requesting another fresh trial. Do not simply relabel an explicit spatial requirement as optional or bypass the save guard. Any proposed correction is a separate decision; none was implemented here.
