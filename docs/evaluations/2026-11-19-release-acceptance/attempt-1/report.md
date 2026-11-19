# PR #22 — final acceptance evaluation, interrupted first attempt

**The live evaluation is incomplete. Do not merge or deploy based on this run.** Application candidate `e9e3aae86e559ed9131609e2a2f3eb3e75299fba` is unchanged. The initial evaluation harness was frozen at `c9cc625` before spending. All raw attempt evidence is retained; the harness correction does not retroactively change the recorded result.

## What happened

The first building instruction reached the real `gpt-6.1-sol` Responses API through the actual production ATELIER application and API handlers. The harness then made an incorrect assumption: it waited for **Stop and discard working preview** to become visible within 20 seconds. That control only exists after provisional geometry has been generated. During initial reasoning, the application correctly exposes **Stop design request** instead.

The harness timed out, took a [screenshot](attempt-1/building-failure.png), and closed the browser. That interrupted the outstanding API call after 19.821 seconds. No model response or usage record had arrived. This is an evaluation-harness error, not evidence that the application failed to model or commit a building. No AI-created geometry was available to assess.

The existing budget safeguard retained the request's full **US$0.613085 reservation** and blocked additional generations. A read-only usage lookup returned HTTP 403. The environment had no retained network diagnostic capture. Usage could not be recovered; actual cost remains **unknown**, not zero. The raw generated summary's `estimatedUsd: 0` means zero _reconciled_ charges and must not be interpreted as a free request.

## Results

| Planned task                                                              | Actual outcome                                                  |
| ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Create and commit a four-level editable building, reload and Undo/Redo    | Interrupted by harness before the first AI response; unassessed |
| Raise the lowest floor while preserving identities and unrelated geometry | Not run                                                         |
| Detect and autonomously repair an incorrect elliptical column             | Not run                                                         |
| Continue after failure, create a tray, persist and Undo/Redo              | Not run live                                                    |

No completion rate, false-acceptance rate, repair success rate or reviewer latency can be inferred. There were zero completed real-AI responses, one interrupted API generation request with unknown actual usage, and no additional paid calls after interruption.

## Harness correction and offline validation

The corrected harness tracks attachment of **Stop design request**, which exists throughout the active request, including initial reasoning and while chat is minimized. It no longer uses the existence or visibility of provisional geometry to infer whether AI work is running. Error cleanup targets the same real cancellation control.

The new `tests/evaluation-lifecycle.spec.ts` exercises this exact distinction in Chromium against the unchanged production build. It holds the initial offline response for more than 20 seconds with no provisional preview, verifies the request stays active, releases a real geometry operation, minimizes chat, verifies continued activity, completes the request and checks persistence, reload, one Undo and Redo. **Passed in 39.3 seconds**; [result](harness-regression.json). No paid calls were used in this regression.

Before the paid attempt, offline preparation verified the external measurements against correct and incorrect multilevel geometry, connected height changes, a rotated ellipse, an equivalent mesh, a wrong equal-span solid, movement of protected geometry, separate tray walls/base and a filled cavity. The actual browser also loaded the seeded project and safely discarded an injected blocked turn, including reload. The existing four spending-safeguard tests passed. These fixtures validate the evaluation machinery; they are not real-AI acceptance evidence. [Preparation record](offline-preparation/preparation.json).

## Preserved evidence

- [Assessment and authorization state](assessment.json)
- [Original frozen manifest](attempt-1/manifest.json), including prompts, tolerances, application trees and initial harness hash
- [Ledger](attempt-1/ledger.json), [pricing check](attempt-1/pricing-check.json) and [read-only usage attempt](attempt-1/usage-reconciliation-attempt.json)
- [Exact outgoing model request](attempt-1/request-1.json), without authorization headers or credentials
- [Application/provider trace](attempt-1/results.json), [original project](attempt-1/building-original.json) and [failure screenshot](attempt-1/building-failure.png)
- [Raw initial summary](attempt-1/summary.json); see the unknown-cost explanation above

## Continuation proposal — not yet authorized

The previous approval's agreed stop rule blocks further paid calls when usage is unknown. Do not clear the reservation, mark it usage-reconciled, reset the ledger or silently restart the evaluation.

Request approval to conservatively count **US$0.62** for the interrupted call and continue the same four tasks with **at most US$4.38 of additional spending**, preserving the original **US$5 aggregate ceiling**. The original trace and unresolved-usage label must remain intact. A continuation must explicitly carry this charge/reservation into its accounting, retain the overall 32-call cap and count the first request toward the building task's eight-call cap. Freeze the corrected harness and continuation accounting before sending any new generation.

The application requires no change to correct this harness failure. PR #22 remains a draft, unmerged and undeployed. Its prior offline application validation remains valid; final real-AI acceptance is still required. Physical iPhone/Safari voice recognition, microphone echo/interruptions and background behavior also remain unverified.
