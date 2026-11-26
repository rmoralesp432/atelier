# Proposed seeded recall-and-revision diagnostic

**Prepared offline; paid execution is not authorized.** Application: frozen `deb730317cafe2e0b251a788693934196660140c`. Keep PR #25, the iPhone branch and the preserved failed creation trial separate.

This diagnostic asks whether fresh AI can use an already stored user decision during connected edits. It deliberately excludes fresh capture through a successful initial creation commit. A successful seeded result must never be reported as completing that separate milestone.

## Fixed starting project

Use [seeded-recall-start.atelier.json](fixture/seeded-recall-start.atelier.json), with its full conversation, geometry, notes, component identities and saved history. It contains twelve editable solids: the ten-part scanning rig, an evolved storage cube and a separate sample puck. The rig is reconstructed from the preserved rejected proposal; its provisional creation history was removed. The initial decision was not freshly committed by an AI in this preparation.

The user-source link is genuine: decision `70db6f56-f975-420f-b5e7-3b4781cfe63e`, revision 1, cites source message `3f41ec6f-0223-4542-af00-86e23f48a41a`. Its exact quotation includes:

> Leave exactly 32 cm clear between the turntable top and the underside of the light panel so bulky samples can be inserted. Keep that sample-loading space usable as we develop the rig.

The complete original quote and note are retained, rather than sanitized to simplify the test. Initial dimensions and placement mentioned in an old note must not become permanent constraints against later explicit instructions.

Ten real browser turns with **scripted** side-object edits produced the fixture's intervening history. The full saved conversation has 22 messages; the application's natural recent-message window contains the final 20. The original source message remains in full history but is absent from both roles' recent payloads. No recent assistant message repeats the loading-space decision or reason. No history was manually trimmed to achieve this.

Open the fixture in an isolated browser project running `deb7303`, let it save, then reload using persisted project state. Check the fixture hashes, decision quotation/source, component IDs, original wording's absence from actual outgoing recent history, and note availability to both roles. Preserve all historical messages. Do not insert a preparatory question asking the agent to summarize or remember the decision.

## Two fresh user turns

1. **After reload:** “Raise the turntable surface by 11 cm. Keep its diameter and horizontal position unchanged.”
2. **After the first edit commits:** “We will only scan flatter samples now. Change the sample-loading clearance to exactly 18 cm instead of 32 cm. Keep the turntable where it is and leave the storage cube and sample puck alone.”

Supply no tool names, note IDs, existing dimensions, criteria, affected-part list, evaluator calculations or clearance reminder in turn 1. Let the agent choose inspection, construction and connected scope. Let the independent reviewer choose its own checks. **Do not inject the scripted criteria from the offline rehearsal.** The scanner-envelope findings remain separate diagnostic evidence, not a replacement reviewer response.

Use the normal browser request → provisional geometry → independent checks → final commit flow. Capture actual provider inputs, outputs, explicit inspection calls, starting-scene facts, reviewer citations, measured results, final exports, screenshots and saved history. Do not request hidden chain-of-thought; use observable actions, supplied context and the agent's ordinary explanation.

If turn 1 fails, preserve the attempt and mark the dependent revision not reached. A correct but uncommitted proposal is not a successful edit. No hidden fixture replacement, criterion correction by the evaluator, reminder, extra fresh retry or second trial is allowed by this proposed protocol.

## Separate scores

| Dimension              | Evidence / classification                                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context delivery       | Exact active decision and source available to executor and reviewer after reload; original absent from their actual recent histories. Report this separately from reasoning.                                                                                                                                                                                           |
| Agent recall           | Did the agent apply the earlier continuing clearance without a reminder? Record explicit reference to the reason/decision, any inspection tool used, and whether it merely received scene facts. Geometry alone also reveals the initial gap, so a correct result without attributable note use is **behavior consistent with intent; source of recall inconclusive**. |
| Reminder contamination | If a recent assistant message semantically repeats the original decision, source-of-recall score is inconclusive. Do not delete the message or retry until it disappears.                                                                                                                                                                                              |
| Reviewer citation      | Did it independently cite an active `source=decision` quotation for turn 1, choose the appropriate spatial relationship and use the correct anchors/sign? On revision, does it use the current request rather than enforce the obsolete 32 cm value? Separate citation correctness from geometric verdict.                                                             |
| Expected values        | Values derive from the original request/decision or pre-edit geometry, never the candidate. Preserve calculation traces, units and frame. Report malformed or unsupported checks separately.                                                                                                                                                                           |
| Actual geometry        | Independently inspect occupied solids, gap, elevations, horizontal alignment, support continuity, identity and editability. A correct label or valid tool response is not geometric proof.                                                                                                                                                                             |
| Browser save           | Check persisted geometry/notes/context, actual reload, one-request Undo, reload while undone and Redo. Unverified save block, measured rejection, transaction conflict and successful save are different outcomes.                                                                                                                                                     |
| Explicit revision      | Correct 18 cm geometry; same active decision ID adopts the new source wording/revision; the old decision does not remain a parallel constraint. Undo/Redo restores matching decision and geometry versions.                                                                                                                                                            |
| Preservation           | All original component identities remain; cube and puck retain their entire pre-edit data. Record every changed and preserved component; avoid demanding the rehearsal's exact operation list.                                                                                                                                                                         |

Use the [fixture role bindings](fixture/role-bindings.json) to associate original identities with physical roles. Names only help establish that initial mapping; they do not prove geometry. A harmless rename must not invalidate physical measurements or identity preservation. If role correspondence becomes ambiguous, record unverified rather than inventing a match. Alternative coherent editable support constructions are acceptable.

## Independent measurements

World frame: metres, Y up. Existing linear tolerance: **1 mm**. Round-solid comparison retains the existing **2% tessellation volume allowance**. Do not relax tolerances to obtain a save.

| Stage          |        Turntable top |      Panel underside |               Clear vertical gap |
| -------------- | -------------------: | -------------------: | -------------------------------: |
| Validated seed |               0.24 m |               0.56 m |                           0.32 m |
| Raised         | 0.24 + 0.11 = 0.35 m | 0.35 + 0.32 = 0.67 m | 0.32 m from stored user decision |
| Revised        |     unchanged 0.35 m | 0.35 + 0.18 = 0.53 m |      0.18 m from current request |

Diameter remains 0.70 m; original X/Z centers remain unchanged. Evaluate connected supports with actual-solid contacts and grounded continuity. No structural strength or real load certification is claimed. Record the clearance envelope definition explicitly; **do not invent an insertion path**. A conservative square region passing can prove the enclosed circular space empty, but square-corner occupancy alone cannot establish circular obstruction.

After a correct fresh proposal commits, use its captured criteria unchanged for an offline wrong-result control: leave the frame at its prior height while raising the turntable, or retain the obsolete 32 cm gap while updating the decision to 18 cm. Measure the wrong solids independently, and distinguish a measured geometry rejection from a save prevented only by unresolved verification. If no usable correct proposal/criteria exist, mark that control not reached. Do not use scripted successful edits as fresh successes.

## Proposed authorization and cost controls

Request a separate **US$2 aggregate conservative accounting ceiling and maximum 20 paid calls** for this one two-turn seeded trial, including executor, reviewer, inspection continuations, repairs, diagnostics and unknown-usage reservations. No second trial or automatic extra credits/recharge. No paid calls have been made under this proposal.

Intended model/settings: `gpt-6.1-sol`, Responses API, standard/default tier, executor high reasoning, reviewer low, 6,000 maximum output tokens. Confirm model access and pricing before execution. Reuse the existing pre-call reservation ledger and zero SDK automatic retries. Stop before either cap would be exceeded; preserve unknown-usage calls as reservations.

Pricing basis is the documented November 26 secondary registry estimate already preserved in the [previous preflight](../live/preflight/documented-pricing.json): US$2/M input and US$10/M output at the observed context lengths; conservative reservation US$4/M input and US$15/M maximum output, plus 25%, without cached-input discounts. It is not an account-verified invoice rate. Recheck for material changes before any paid call. Current balance and auto-recharge status are not inferred from the old November 24 credits; no billing settings will be changed. Stop if reliable reservations cannot be maintained.

Track all token usage, model IDs, API latency, reviewer time and actual dollar charges if available. Actual charges and estimated accounting remain separate. Preserve partial outcomes and failures. Do not alter application behavior, merge, deploy or turn the independent guard off for this evaluation.

## Result format

Publish distinct columns for **context delivered, agent recall, reviewer citation/relationship, measured geometry, browser commit, revision persistence and negative controls**, with costs and limitations. Name the result **seeded recall diagnostic**. Fresh capture through an initially successful AI commit remains untested regardless of its outcome.
