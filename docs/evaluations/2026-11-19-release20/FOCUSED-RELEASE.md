# Final focused release sequence

The latest user request limits this checkpoint to resolving the two CI timeouts, then one live sequence: create the existing four-level study, commit, increase its lowest storey, measure connected geometry and identity preservation, and verify reload/Undo/Redo. No unrelated live benchmarks or new product features. The original prompts, geometric oracles and tolerances in `scripts/release-evaluation/cases.ts` remain unchanged.

## Preserved failures and accounting

The interrupted first US$20 attempt is retained in `.cloud/pr22-release20-final-1`. Its building calls returned four incomplete responses at the 6,000-output-token ceiling and no geometry committed. The ellipse reviewer connection was interrupted. Its US$0.22113 reservation is retained as unknown actual usage. This is separate from the original US$0.62 unknown-charge allowance. Before this sequence: 25 started calls, US$2.104952 in reconciled usage estimates; US$3.47232 in conservative aggregate accounting, including the 25% margin on known usage and both unknown allowances. No original ledger is rewritten.

The new attempt carries immutable hashes of all prior ledgers. Both unknown calls count toward limits, and the newer interruption retains its full pre-call reservation. Unknown charges in the active attempt still stop further calls. Aggregate limits remain US$20 and 60 started calls. The evaluation-only per-task counter allows 24 calls including previous attempts (rather than 16) to accommodate the remaining connected sequence without resetting historical counters. Application stage, transaction and geometry limits are unchanged.

## Focused corrections

CI run 44465753546 failed while waiting for viewport screenshot animation-frame stability and at the 30-second total timeout of a four-turn language/reload test. Both unchanged tests passed locally after starting the local server explicitly (an initial local attempt had no listening server and is separately retained). The viewport test now captures the same composited rectangle directly after its exact layout/buffer/projection checks, avoiding a redundant interaction/actionability wait. The language test has a 90-second whole-sequence allowance, retains per-assertion bounds, and additionally verifies every turn actually reaches the provider. No viewport, camera or language application behavior was changed for these CI failures.

The single application correction addresses oversized agent responses generally: both OpenAI transports detect output truncation and feed back that no operations from that response executed, that earlier successful provisional work is retained, and that the next response must use a smaller complete batch. A concise dynamic response-budget instruction supports batching before truncation. It does not truncate or execute partial JSON, force completion, reduce geometric requirements, or increase output/transaction limits. Both transports have real-engine regression coverage for safe recovery, unchanged original geometry, independent verification and Undo after serialization.

The initial new budget regression assertion used strict binary floating-point equality and failed by 2e-16. The assertion now uses a 1e-12 numerical tolerance; accounting code and spending limits were not altered to satisfy it.

## Release gates

Run the required CI checks to green before the live sequence. Freeze the application commit, harness and production bundle before generation. Real GPT-6.1-sol must create and commit the geometry; a handcrafted model cannot substitute. The same browser project must then accept the connected edit. Preserve raw responses, measurements, screenshots, independent verification status, latency, charges, reload and Undo/Redo evidence. Incorrect geometry cannot pass; genuinely unsupported host checks must remain explicitly unverified, with the external geometric acceptance measured separately.

Only a passing focused sequence and green required CI authorize merge/deployment under the user's latest instructions. Keep production commit `9bb6ad42997979f3b55b8218a1c9dcfd22f61dff` as the rollback reference. Otherwise report the precise remaining blocker, without starting another milestone.
