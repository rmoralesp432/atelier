# PR #22 — final live acceptance checkpoint: hold deployment

**PR #22 was not merged or deployed. The conditional release requirements were not met.** The existing Render deployment remains at `9bb6ad42997979f3b55b8218a1c9dcfd22f61dff`, on `feat/phase2-conversational-modeling`. The candidate evaluated was `e9e3aae86e559ed9131609e2a2f3eb3e75299fba`. No `src`, `server`, or package-lock changes were made during this evaluation.

The real model created correct provisional building geometry, repaired an injected geometric fault, and completed a correct tray after an interrupted request. However, the building did not reach `finish_task` and commit before the next request exceeded the remaining conservative reservation. Consequently, the live connected floor-height modification could not run. This is not evidence that the scene-change guard rejected completed geometry: the run did not reach that finalization point.

## Four planned tasks

| Task                                             | Actual result                                                                                                                                                                                                                                                                                                                                    | Unresolved limit                                                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create four-level assembly                       | Real GPT-6.1-sol created 431 independent building components plus the retained marker. Offline replay of the exact saved operations passed all 22 external geometric checks, including 19 × 13 m plates and the 4.2/3.3/3.7/3.3 m level intervals.                                                                                               | Only provisional geometry. No real-AI finish, independent host review, browser commit, reload or Undo acceptance for this building.                                     |
| Increase the lowest storey by 1.1 m              | Not run. No handmade substitute was used.                                                                                                                                                                                                                                                                                                        | Contextual editing of this building remains unverified.                                                                                                                 |
| Detect and repair an incorrect elliptical column | Correct initial output was deliberately changed to a circular section. The real verifier blocked it; the real agent repaired the same object. External occupied-solid difference from the expected rotated ellipse was about 7.94e-9 m³. Identity, original project, serialization/reload, Undo and Redo were retained.                          | Built-in review honestly remained `unverified` for the intrinsic ellipse profile/axes. This is not a fully verified host result.                                        |
| Recover after a failed request and create a tray | The actual App discarded an offline injected failure after provisional work, reloaded, and then used real AI to create the tray. External measurements verified the 1.7 × 0.95 × 0.24 m solid, open cavity, and 0.04 m walls/base. Solid difference was about 9.99e-16 m³. Commit, reload, context/conversation, one Undo and exact Redo passed. | Built-in review honestly remained `unverified` for uniform thickness and cavity topology. Preservation covered the marker; there was no committed building in this run. |

The frozen harness reports **zero full `PASS` outcomes**: two results are `GEOMETRY_OR_COMPLETION_UNVERIFIED`, one is `NOT_COMPLETED`, and one is `NOT_RUN`. Those statuses have not been rewritten to obtain a release. External measurements establish the two completed shapes, but do not replace missing live finalization/editing evidence.

### False-success and preservation controls

The injected circular solid was independently measured as wrong and blocked by the host. The agent repaired it autonomously without changing its identity. A correct equivalent mesh was permitted with an honest `unverified` status; it was not falsely rejected or represented as fully verified. A wrong solid with the same intrinsic spans was blocked, as was movement of the protected marker. The wrong-solid control does **not** establish same-world-AABB discrimination: rotation gives the box different world bounds. No false acceptance, false rejection or project corruption was observed in the executed controls. This small sample cannot establish a general failure rate.

The tray's application message explicitly says: “Changes applied with incomplete verification. I cannot yet confirm every requirement.” Unsupported checks did not cause an unnecessary repair loop or a claim of fully verified success.

## Infrastructure problems and corrections

1. **Original interrupted request:** the harness waited for a preview-only Stop control during initial reasoning. It was corrected to track the request-wide control. The original response/usage was never received; its ledger remains byte-identical and unknown. The earlier 39.3-second production-browser regression verifies the corrected lifecycle wait, subsequent commit, reload and Undo/Redo. See [original report](attempt-1/report.md).
2. **Large scene incorrectly treated as excessive token count:** the next run reached 432 provisional objects, but the spending guard compared serialized UTF-8 bytes with a 250,000-token short-context threshold. The guard was corrected to reserve the existing higher long-context rates, enforce the documented model capacity, and reconcile higher rates if actual token usage crosses the threshold. No dollar, output or request limit was raised.
3. **Transport escaping counted as model input:** the first resume still over-reserved JSON escapes. The bound now removes only transport escaping from decoded message-text fields. UTF-8 byte bounds, image allowances, full schema overhead, worst-case input/output rates, and the 25% safety margin remain. It covered all 17 usage records available before the final resume. No model tokenizer or optimistic tokens-per-character estimate was assumed.
4. **Evidence filename collision:** the initially blocked outgoing request used the next billable call number, which was later reused by another task. Its exact provider input survived in the saved trace and was reconstructed offline. New attempts use unique filenames. Logging now distinguishes an attempted request blocked before network from a reconciled generation.

Each resume replayed exact already-paid real-AI responses through the actual production App, asserted scene equivalence before continuing, and made new live calls only at the previously unsent point. Generated IDs were rebound after verifying identical objects and groups. The first replay verified 432 provisional objects after two responses; the second verified the same scene after four responses. All previous calls and charges remained in the combined limits. Separate immutable ledgers and manifests preserve every attempt.

The final attempt again stopped before network because the next worst-case reservation did not fit. The real agent had spent three successive steps on measurement, camera framing and presentation after the two construction steps. This is useful evidence of completion inefficiency; it is not proof of a geometry failure. We did not force a finish response, remove checks, alter the application, or expand the budget to produce a pass.

## Cost and timing

All 18 completed new generations used `gpt-6.1-sol`, standard service tier, and reconciled response token usage. These estimates assume no cache discount and are not an account invoice.

| Accounting                                                                 |          US$ |
| -------------------------------------------------------------------------- | -----------: |
| Initial continuation: 15 reconciled calls                                  |     0.595276 |
| First inspection resume: 2 reconciled calls                                |     0.753262 |
| Final inspection resume: 1 reconciled call                                 |     0.372674 |
| **Known token-based estimated spending**                                   | **1.721212** |
| Original interrupted request: conservative allowance, actual usage unknown | **0.620000** |
| Known estimate plus unknown-call allowance                                 |     2.341212 |
| **Budget accounting including retained 25% safety margins**                | **2.771515** |
| Remaining conservative headroom under US$5                                 |     2.228485 |
| Reservation required for the next request                                  |     2.485965 |

The next reservation would have brought accounting to **US$5.257480**, so it was blocked before network. The budget is not described as US$5 already spent. There are 19 started generations including the original interrupted call, all counted toward the 32-request cap. The building used five reconciled calls plus the original interrupted one; ellipse repair used seven; tray recovery used six; the connected edit used zero. No new unknown charges occurred. The US$0.62 is an allowance, **not a confirmed charge**.

| Task                      | Executor API time | Independent reader API time | Estimated known cost |
| ------------------------- | ----------------: | --------------------------: | -------------------: |
| Building, across attempts |         187.455 s |                 Not reached |          US$1.341084 |
| Connected edit            |           Not run |                     Not run |                 US$0 |
| Ellipse repair            |          32.199 s |                    15.482 s |          US$0.205886 |
| Recovery tray             |          34.025 s |                     9.773 s |          US$0.174242 |

Ellipse evaluation wall time was 86.672 s, including observations, measurements and injected-fault controls. Tray browser completion was 47.454 s; persistence checks followed. Reader latency was not 42–56 seconds in these two calls. Building inspection requests still consumed roughly 180k–188k input tokens each; repeated full-scene reasoning is a material cost/efficiency limitation. Do not interpret these samples as p95 or broad reliability statistics.

## Validation and production status

- Candidate application CI remains green: [run 44451346340](https://github.com/rmoralesp432/atelier/actions/runs/44451346340), including 402 unit/engine tests, all 147 production-browser tests, build/format validation and the aggregate check. No application changes invalidate that evidence.
- Eleven offline harness tests pass, covering authorization, cumulative spending, unknown-usage stops, all prior request counts, large inputs, decoded transport bytes, immutable old ledgers, and replay rejection of changed geometry/groups.
- Real Chromium exercised the tray's commit/reload/Undo/Redo, safe failure recovery and the building's provisional execution. Offline Chromium replay preserved the original project when discarding the 432-object preview. The final building commit with harmless UI activity was **not reached live**; prior offline transaction/conflict regressions remain the evidence for that behavior.
- Render's read-only API reports the existing deployment `dep-dbv0t20m7kps739tcp5g` live at `9bb6ad42997979f3b55b8218a1c9dcfd22f61dff`. Automatic deployment remains disabled. No merge, deployment or service configuration mutation was made. Direct public-origin HTTP probes failed from this workspace; they do not establish an application outage or a successful public smoke test.
- Physical iPhone/Safari microphone, acoustic feedback, real speech recognition, device interruptions and background behavior still require a physical-device test. The original desktop black viewport band remains unreproduced; prior resize/DPR/layout tests do not eliminate hardware-specific uncertainty.

## Recommendation and preserved evidence

**Hold PR #22. It is not ready for the promised stable demonstration checkpoint on this evidence.** The missing gate is a real completed building transaction followed by a measured connected edit, with reload and Undo/Redo. Keep the current working release. The saved traces support diagnosing repeated inspection and large-scene input cost without spending more now. No additional development milestone or paid run was started after the spending guard stopped this evaluation.

- [Machine-readable assessment](final-assessment.json)
- [Attempt 1: original unknown-usage ledger](attempt-1/ledger.json) and [interruption report](attempt-1/report.md)
- [Attempt 2 ledger](attempt-2/ledger.json), [summary](attempt-2/summary.json), [complete raw archive](attempt-2/raw-evidence.tar.gz)
- [Attempt 3 ledger](attempt-3/ledger.json), [summary](attempt-3/summary.json), [complete raw archive](attempt-3/raw-evidence.tar.gz)
- [Attempt 4 ledger](attempt-4/ledger.json), [summary](attempt-4/summary.json), [complete raw archive](attempt-4/raw-evidence.tar.gz)
- [Offline provisional building measurements](attempt-4/offline-provisional-measurements.json), explicitly not a real finish or browser commit
- [Production deployment readback](pr22-production-readiness.json) and [public-origin probe results](pr22-production-smoke.json)

Archives include outgoing JSON bodies without authorization headers, exact model responses and usage, execution/verification traces, original/provisional/final projects where captured, observations, browser screenshots, and reload/Undo/Redo snapshots. Each archive has a neighboring SHA-256 file. Earlier attempts and frozen statuses remain intact.
