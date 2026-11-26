# Proposed fresh-AI decision-continuity trial

**Not authorized or executed.** Defined after freezing application, tests and offline harness at `deb730317cafe2e0b251a788693934196660140c` on November 26, 2026. This protocol adds no application behavior. `711a8cf` packaging and `509e157` physical iPhone validation remain separate.

## Question and scope

Can fresh AI record a relevant user decision, recover it after it leaves recent conversation, apply it to a connected edit after reload without a reminder, and then honor an explicit revision?

Run one 14-turn session from an empty project through the normal browser, using fresh executor and reviewer responses throughout. The model is a small scanning rig, different from the offline table/panel and spindle/guard cases. Let the agent choose construction, tools, inspection and affected objects. Supply no note IDs, tool names, check types, original measurements or acceptance criteria in follow-up prompts. The implementation stays frozen throughout scoring.

This is a focused diagnostic, not a reliability percentage across tasks or a baseline superiority claim. Do not silently replace a failed creation with a prepared model. Dependent outcomes are marked not reached. Any later baseline comparison or repeated session needs a separately agreed scope if it cannot fit this protocol and budget.

## Frozen user sequence

1. “Create a small editable tabletop scanning rig. Use a circular turntable 70 cm across with its top 24 cm above the floor, and an overhead rectangular light panel centered over it, supported by a freestanding frame with two posts and a crossbeam. Leave exactly 32 cm clear between the turntable top and the underside of the light panel so bulky samples can be inserted. Keep that sample-loading space usable as we develop the rig. Add a separate 40 cm storage cube two meters to the left. Keep the parts separate and choose sensible dimensions for the frame.”
2. “Make the storage cube 50 cm tall, keeping its base on the floor.”
3. “Make that storage cube 55 cm wide.”
4. “Make the storage cube 45 cm deep.”
5. “Move the storage cube 20 cm farther left.”
6. “Add a separate round sample puck, 12 cm in diameter and 3 cm thick, beside the storage cube.”
7. “Make that sample puck 5 cm thick, with its base still on the floor.”
8. “Make the sample puck 16 cm in diameter.”
9. “Move the sample puck 15 cm forward.”
10. “Make the storage cube 60 cm tall, leaving its footprint and position unchanged.”
11. “Make the sample puck 4 cm thick, keeping its base on the floor.”
12. **After reload:** “Raise the turntable surface by 11 cm. Keep its diameter and horizontal position unchanged.”
13. “We will only scan flatter samples now. Change the sample-loading clearance to exactly 18 cm instead of 32 cm. Keep the turntable where it is and leave the storage cube and sample puck alone.”
14. **After reload:** “Raise the turntable surface by another 7 cm, keeping its diameter and horizontal position unchanged.”

Between turns 11 and 12, export and reload the actual project. Confirm that the original instruction is absent from the actual recent-message payload, without editing or truncating history artificially. Check for semantic reminders too: if a recent assistant reply repeated the decision, report that the run did not isolate recovery from project notes. Do not delete that reply to manufacture a memory test. If the source instruction remains present because of unexpected transport behavior, mark the recall test inconclusive rather than pretending memory was necessary. The turn-14 test checks adoption of the revision; it does not test aging the revision out of history a second time. Record consequential clarification questions without coaching the agent about the remembered clearance.

## Independent scoring

Record each of these separately, without combining an API success with a saved-model success:

| Dimension                 | Evidence required                                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capture                   | Agent independently writes an active user decision containing the exact clearance wording and reason, with the host's source turn. Assumptions remain separate.                                                                 |
| Recall                    | Original wording is absent from recent history but available in the saved notes sent to both roles after reload. The fresh response applies it without a reminder. Simply having it in a payload is not a reasoning success.    |
| Starting-model inspection | Actual tool calls and arguments show whether the agent consulted original geometry, and whether the facts used match that geometry. Distinguish explicit tool inspection from facts already present in the scene payload.       |
| Connected scope           | Light panel and affected frame parts move or resize coherently with the raised turntable; valid alternative support constructions are accepted. Existing part identities survive and unrelated cube/puck data remain unchanged. |
| Reviewer choice           | Reviewer independently chooses an appropriate signed vertical gap/alignment or equivalent supported relationship and correct anchors. Report unavailable/malformed checks separately.                                           |
| Expected value            | Trace whether the value comes from the original user quote, current revision, or a legitimate pre-edit measurement. Candidate geometry cannot supply its own expected answer.                                                   |
| Geometry                  | Inspect actual kernel solids, occupied dimensions, top/underside elevations, horizontal alignment, support continuity, editability and identities independently of names or provider claims.                                    |
| Commit                    | Confirm saved project contents, one-request Undo, Redo and reload through the normal UI and persistent store. A correct provisional model that never saves is not a successful edit.                                            |
| Revision                  | Same active decision identity adopts the new wording, with the old value not reinstated. Undo/reload/Redo restores matching geometry and decision versions.                                                                     |

Expected values are frozen from user dimensions and valid pre-edit facts:

- Initial turntable top: 0.24 m; circular diameter: 0.70 m. Initial light underside: 0.56 m, calculated as 0.24 + 0.32.
- After turn 12: turntable top 0.35 m, light underside 0.67 m; vertical gap 0.32 m. Preserve original horizontal center and diameter.
- After turn 13: turntable top 0.35 m, light underside 0.53 m; gap 0.18 m.
- After turn 14: turntable top 0.42 m, light underside 0.60 m; gap 0.18 m.
- Scope and identity comparisons use the saved project immediately before each request, including the evolved cube and puck. Do not use their creation-time state as the preservation target.

Use the existing 1 mm linear tolerance and 2% round-solid tessellation allowance. Those apply to measurements, not a license to overlook omitted parts. Do not demand a specific number of construction pieces when a different independently editable, coherent construction meets the brief. If an independent property cannot be measured, report that honestly; never infer a pass from a convincing label.

After a correct proposal is available, fork it into an isolated **offline** negative control: leave the light/frame at the pre-edit elevations while raising only the turntable, then replay the captured reviewer criteria through the real browser host. Another control may retain the obsolete 32 cm gap after the 18 cm revision. Use the same tolerances and original project. No fresh paid response is needed for these deliberate perturbations. Report measured rejection separately from an unresolved-verification block; verify that the original saved project and history remain intact. If the fresh run never supplies a correct proposal and usable criteria, mark dependent controls not reached.

## Conditions, cost and stopping rules

Proposed authorization: **US$5 aggregate accounting ceiling and at most 60 paid calls** for this single session, including executor, reviewer, retries, diagnostics and unresolved-charge reservations. No spending is authorized by this document. No automatic additional trials, credits or recharge.

Intended conditions: `gpt-6.1-sol`, Responses API, standard/default service tier, executor high reasoning, reviewer low reasoning, existing 6,000-output-token limit and observation handling. Keep the application's operation, transaction and bounded criterion-retry protections unchanged. Record the actual served model identifier and settings. Do not silently substitute a model.

Pricing basis is the repository's **documented estimate**, not verified account-specific billing: US$2 per million input tokens and US$10 per million output tokens, with pre-call reservations at US$4/US$15 plus a 25% margin. Source recorded November 18: the [LiteLLM pricing registry](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json), as retained in `scripts/completion-evaluation/budget.ts`. No cached-input discount is assumed. Token usage is provider-reported where available; dollar figures remain estimates unless reconciled with actual billing.

Before paid execution, confirm model access, current pricing and credit availability. The old November 24 expiring balance is not a current balance on November 26. If the pricing basis changes materially or the existing reservation mechanism cannot establish a safe upper bound, stop before sending a call and report the mismatch. Keep auto-reload off. Use an isolated ledger for this authorization; do not reuse the older uncapped campaign balance or its authorization text.

Persist a reservation before every call, reconcile it only with usable usage evidence, retain unknown charges as reservations, and count interrupted requests toward the call limit. Stop before either ceiling would be exceeded. Preserve incomplete runs, failures and infrastructure corrections. A budget stop is incomplete evidence, not an application failure or a pass.

Stop for project loss, materially wrong geometry accepted as verified, an unresolved transaction/security defect, or a need to change the frozen application. Fixing an evaluation-only transport fault must not change prompts, criteria, tolerances or already-scored outcomes. Do not implement improvements, merge or deploy under a trial authorization.

## Deliverable

Publish the full user turns, fresh requests/responses, inspector calls, independently measured solids, per-turn saved exports, before/after identities, active decision versions, negative-control outcomes, reload/Undo/Redo evidence, screenshots, wall time, reviewer time, token usage, estimated costs and unresolved reservations. Conclude separately on capture, recall, revision, geometric correctness and actual save. If the trial succeeds, recommend a next decision; do not begin another milestone automatically.
