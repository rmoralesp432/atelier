# Offline seeded recall diagnostic and scanner replay

**Both offline paths are ready for review. No paid calls, application changes, merge or deployment.** `deb7303` remains frozen. The failed fresh run at `b4ce3ba` is preserved unchanged; this work does not convert it into a success.

## Review artifacts

- [Proposed fresh-AI seeded protocol and US$2 / 20-call ceiling](FRESH-AI-PROTOCOL.md) — separate approval required
- [Validated starting project](fixture/seeded-recall-start.atelier.json), [full history](fixture/full-history.json), [actual recent window](fixture/recent-window.json), and [original role bindings](fixture/role-bindings.json)
- [Seeded browser results](recall/summary.json), [context and reviewer citations](recall/context-and-citations.json), [recall geometry](recall/recall-measurements.json), and [revision geometry](recall/revision-measurements.json)
- [Saved raised model](recall/after-recall.atelier.json) and [saved revised model](recall/after-revision.atelier.json), both **scripted offline results**
- [Scanner replay](scanner/summary.json), [frame audit](scanner/frame-audit.json), [criterion provenance](scanner/criterion-provenance.json), [valid browser result](scanner/browser-valid-summary.json), and [obstruction rejection](scanner/browser-obstructed-summary.json)
- [Complete evidence ZIP](offline-evidence.zip), [frozen evaluation diff](diagnostic.diff), [freeze manifest](FREEZE.json), and [artifact SHA-256 checksums](SHA256SUMS.txt)
- [Recorded calibration failures and corrections](failures/INDEX.json)

The project files use the frozen experimental decision schema. Review them on `deb7303`; compatibility with the older production importer is not claimed.

## Path A: seeded recall and explicit revision

The seed reconstructs the valid scanner geometry from the rejected live proposal and retains its original source-linked user decision. Its provisional creation history was removed, so the fixture does not pretend the rejected request committed. Ten ordinary side-object edits were then executed through the normal browser with scripted responses. The resulting twelve-object project contains the rig, an evolved storage cube and a sample puck.

After those edits, the saved conversation contains **22 messages**; the application naturally sends only the last **20**. The original user wording remains in full history and the project note, but is absent from both roles' actual recent-message payloads after reload. None of those recent assistant messages repeats the clearance or its reason. No messages were deleted or shortened to manufacture the memory test.

The decision retains the original wording and reason:

> Leave exactly 32 cm clear between the turntable top and the underside of the light panel so bulky samples can be inserted. Keep that sample-loading space usable as we develop the rig.

It remains linked to the real original user turn, decision ID `70db6f56-f975-420f-b5e7-3b4781cfe63e`, revision 1. The full original quotation remains intact; later side-object edits are not replaced by obsolete dimensions mentioned in that quotation.

The rehearsal then submitted the natural follow-up without a clearance reminder and subsequently the explicit 18 cm revision. The provider answers and reviewer choices were **scripted**, while request handling, citation validation, actual geometry, transactions, persistence and browser history were the frozen application.

| Outcome                   | Raise turntable 11 cm                                               | Revise clearance to 18 cm                                       |
| ------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| Context after reload      | Stored decision available; original wording absent from recent chat | Active earlier decision and explicit new request available      |
| Reviewer citation         | Scripted `source=decision`, exact original clearance/reason excerpt | Scripted `source=request`, exact revision wording               |
| Expected top calculation  | Actual pre-edit top + user 11 cm; host calculation trace retained   | Preserve actual pre-edit top                                    |
| Actual turntable top      | 0.35 m                                                              | 0.35 m                                                          |
| Actual panel underside    | 0.67 m                                                              | 0.53 m                                                          |
| Actual clear gap          | 0.32 m                                                              | 0.18 m                                                          |
| Independent geometry      | 59/59 checks passed                                                 | 59/59 checks passed                                             |
| Browser save              | Committed                                                           | Committed                                                       |
| Identity / unrelated work | All 12 identities retained; cube and puck unchanged                 | All 12 identities retained; cube and puck unchanged             |
| History                   | Atomic Undo, reload while undone, Redo and reload passed            | Same; matching geometry and decision versions restored          |
| Decision state            | Original ID, revision 1                                             | Same ID, revision 2; exact new wording and new user-source link |
| Fresh-AI recall / choice  | **Not run**                                                         | **Not run**                                                     |

The raised edit changed eight components: pedestal, turntable, two posts, crossbeam, panel and two hangers. Both feet, the cube and puck were unchanged. The revision changed only the two posts, crossbeam, panel and two hangers; the pedestal, turntable, feet, cube and puck were unchanged. Actual-solid contact checks supported continuous panel-to-ground and pedestal-to-turntable geometry. This is geometric support continuity, not a structural certification.

The explicit revision superseded the old quotation. The host citation validator accepted the new active decision and rejected the obsolete quotation after revision. Undo restored the earlier decision and geometry; Redo restored the revision. This demonstrates the existing mechanism with controlled inputs, not autonomous recall.

### Negative controls

Both used the same captured offline criteria and unchanged tolerances in isolated browser projects:

- Raising the turntable/pedestal while leaving the light frame at its old height produced the wrong clearance. The host **measured the geometric failure and blocked saving**.
- Recording the new decision while retaining the old 32 cm geometry likewise produced a **measured rejection**. The unsaved note revision did not leak into the saved project.

Original geometry, component IDs, active notes, Undo/Redo history and reload state remained intact in both controls. These are not “blocked because verification was unavailable” results. They also are not negative controls from fresh-AI criteria: that remains part of a separately approved trial.

### What the proposed trial can establish

Run only the two follow-up turns from the validated seed, using fresh executor and reviewer responses. Score independently: context delivery, agent recall, reviewer citation/relationship, measured geometry, actual save and revision persistence. Existing geometry itself reveals the initial gap; a correct edit alone therefore cannot prove recall came from the note. Record source attribution as inconclusive unless observable behavior/explanation supports use of the stored decision. Any recent assistant reminder also makes attribution inconclusive.

**Fresh capture through a successful initial AI commit remains a separate milestone.** Nothing in this seeded setup completes it or removes the initial creation blocker.

## Path B: scanner clearance and request-start directions

### Clearance without inventing a path

The replay retained the explicit signed 32 cm gap, all other relevant checks, existing tolerances and the normal save guard. In a separately labelled evaluator-authored criterion set, it replaced the unavailable loading-volume check with the existing `region(empty)` predicate for a **0.70 × 0.32 × 0.70 m box**, centered at **(0, 0.40, 0)** in world coordinates, Y up.

The sizes and vertical target come from the user's 70 cm diameter, 24 cm top and 32 cm clearance: `centerY = 0.24 + 0.32/2`. X/Z = 0 is the declared datum of this saved fixture, not a location the user required. Independent solid measurements confirm the tested turntable is centered there. This box encloses that circular footprint and spans only the requested vertical gap. **No front corridor, approach route or insertion motion is included.** The earlier exploratory insertion-path probe was not reused as a requirement.

A fixed world box alone does not establish its relationship to an arbitrarily located new object. This is a bounded replay, not a general replacement acceptance policy: initial creation still needs a correctly anchored query. In the seeded edits, original X/Z coordinates are available before execution and preservation is checked separately, making that datum independently recoverable. Clearance dimensions must always remain user-derived; a measured coordinate frame must not be confused with a new required design location.

The same saved build operations were replayed through the normal browser. The diagnostic criteria also used the correct request-start directional frame, described below.

| Variant                                                                | Independent circular occupancy | Existing box-region result                    | Browser outcome                                                                    |
| ---------------------------------------------------------------------- | -----------------------------: | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| Valid saved proposal                                                   |             Approximately zero | Empty; passed                                 | **Committed**, persisted, reloaded; atomic Undo/Redo passed                        |
| 8 × 12 × 8 cm obstruction inside the loading volume                    |                    0.000768 m³ | Measured occupied volume; failed              | **Blocked by measured geometry failure**; original project/history survived reload |
| Small corner object outside the circle but inside its enclosing square |             Approximately zero | Failed the stronger square-envelope condition | Numerical limitation control only; **not evidence of circular obstruction**        |

The corner control matters: an empty enclosing box is sufficient evidence that the enclosed circle is clear, but the converse is false. The current region tool is useful here; it is not an exact general circular-clearance classifier. A future reviewer must not convert occupancy outside the requested footprint into proof that the requested circular space is obstructed. The genuine obstruction was independently located inside that footprint.

The nonblocking physical-stability caveat remained unverified and disclosed. The valid browser transaction saved under the existing uncertainty rules, not by pretending structural certification had passed. The saved original reviewer criteria remain unchanged in [original-criteria.json](scanner/original-criteria.json), and still block the original result. The evaluator-authored criterion set is isolated in [diagnostic-criteria.json](scanner/diagnostic-criteria.json); no runtime correction or fresh reviewer success is claimed.

An additional [exact final-proposal replay](scanner/saved-final-replay.json), using the previously reconstructed saved correction and untouched original reviewer criteria, reproduced **20 verified checks, zero measured failures, two unverified checks and `canCommit=false`**. Mandatory check 12 remains the blocker; physical-stability check 21 remains a nonblocking caveat. This preserves the original failure rather than silently replacing it with the successful diagnostic.

### “To the left”: same frame delivered, different interpretation

All four recorded provider inputs had exactly the same request-start camera frame. `compactScene` retains it, and `App.tsx` captures a single frame before both executor and reviewer requests. This was not a changed-camera or missing-context bug.

The executor correctly applied the application's view-relative movement convention:

`delta = −2 m × request_start.camera.right`

With right = `(0.8479983040, 0, −0.5299989400)`, the cube displacement is approximately `(−1.695997, 0, +1.059998) m`. The reviewer instead demanded world-X `−2 m`, despite receiving the same frame. The saved correction to `(−2, 0, 0)` then satisfied that reviewer but no longer represented exactly 2 m in request-start view-left.

Using the existing X and Z offset predicates with values deterministically derived from the captured basis accepts the original view-left placement and rejects the world-X variant under the same convention. Two additional synthetic, internally consistent camera frames at 31° and 123° confirmed the same vector calculation. These are offline engine checks, not fresh reasoning tests.

## Calibration failures preserved

1. `recall-1`: a scripted puck resize used overlapping rules in one edit set. ATELIER correctly rejected it atomically. The fixture now uses two existing operations in one request; the application was unchanged.
2. `recall-2`: the browser had saved the revision, but an evaluator assertion looked up a descriptive check ID after compact transport had renumbered IDs. The assertion now identifies the check by its spatial relationship. The run remains recorded as incomplete; its successfully exported pre-recall fixture was reused for `recall-3`, which completed both diagnostic turns and negative controls.
3. `scanner-1`: additional synthetic rotated bases initially retained an inconsistent optional camera pose. `scanner-2` made the poses consistent and reran the checks. The actual saved-trace frame audit and browser tests used consistent frames throughout.

The complete scripts, failed attempts, responses, measurements, exports and logs are preserved. Numerical calibration passed all twelve scripted edit turns before the successful browser continuation. The previous paid trial, including its spending ledger, remains unchanged.

## Freeze, scope and next decision

- Runtime, engine, verifier, server, tests, dependencies and workflows remain identical to `deb7303`.
- This branch adds only offline evaluation scripts, fixtures, protocol and evidence.
- PR #25 remains separate at `b014de9`; the iPhone branch remains `509e157`; the deployment branch remains `f925e4c`.
- **New API spending: US$0.** No model access/pricing call was made or needed for offline preparation. No merge or deployment occurred.

The focused next experiment is the proposed **two-turn seeded fresh-AI diagnostic, maximum US$2 and 20 paid calls**, subject to separate approval and pricing/access checks. Do not yet repeat the full creation-to-revision trial. These replays demonstrate available verification mechanisms, but do not establish that the frozen reviewer will independently choose them or consistently honor the shared directional convention.

To reproduce offline from this evaluation branch with dependencies installed and the frozen production frontend built, use new output directories: `node --import tsx scripts/seeded-decision-diagnostic/scanner.ts /tmp/scanner-replay` and `node --import tsx scripts/seeded-decision-diagnostic/seeded.ts /tmp/seeded-replay`. Neither runner contains a paid provider path, and each refuses to overwrite an existing result.
