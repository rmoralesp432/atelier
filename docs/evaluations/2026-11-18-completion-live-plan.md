# PR #22: proposed live reasoning evaluation

**Status: prepared, not authorized to spend. No paid generations or deployment.**

The target is PR #22 at `6b480a5002e1f6e332c76d06035a1c51ab67c6ce`. The application, executor prompt, completion-reader prompt, geometry tools and transaction limits remain unchanged. Evaluation code is on a separate branch. Source trees, test prompts, evaluator code and dependency lockfile are fingerprinted before a run, preventing silent changes after seeing model answers.

## Four live turns

All scenes are synthetic. Object IDs are randomized; two existing objects are deliberately present, including a cylinder whose name could tempt an overly broad edit. The complete natural-language prompts and independent numerical checks are in [cases.ts](../../scripts/completion-evaluation/cases.ts). None of the fixture construction code or external answers are supplied to the AI.

| Turn             | Natural task                                                                                                                                                                                                       | Independent evidence                                                                                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create           | A freestanding, two-shelf display stand: two 2.6 × 0.9 × 0.12 m shelves and four 14 cm round posts, with prescribed clearance and edge insets. Six independently editable parts in one assembly.                   | Actual solid bounds, material volumes, support elevations, six distinct IDs, grouping and unchanged neighbors.                                                                                                                                                                                          |
| Modify           | Increase the stand's clear shelf spacing by 36 cm, raising the upper shelf and extending the posts while retaining the lower shelf, diameters, footprint and identities.                                           | Compare every original part; unchanged exceptions, correct translations/extensions, real final solids, one Undo/Redo. If creation failed, this dependent turn is marked unrun rather than secretly substituting a fixture.                                                                              |
| Recover          | Seven upright pegs equally spaced around an offset circle. After the real AI first produces a geometrically correct result, remove one peg from the private candidate just before independent completion checking. | The real completion reader must still require seven. The host must reject the omission; the real executor must restore the missing part while retaining the six surviving IDs, without asking the user to manage a repair. The deliberate fault is reported separately from naturally occurring errors. |
| Cut and continue | A solid mounting plate with an off-center rectangular through-slot, leaving no cutter behind. This is a new instruction after the ring request, including its actual success/failure history.                      | Actual remaining solid volume, world bounds and zero material within the specified slot probe. A filled box with the correct envelope fails. Existing pegs/neighbors remain untouched. This also exercises unrelated continuation if the previous task failed safely.                                   |

The evaluator uses the existing provider, independent reader, host verifier and staged execution. The executor receives the same kind of browser-rendered geometry observations as the application. Both executor and reader responses are real model outputs during the authorized run; only the deliberate omission is injected.

## Test the verifier's interpretation, too

After an accepted result, reuse the **actual AI-generated criteria** for additional local checks requiring no API calls:

- Remove one requested part, change a height, or misplace a part.
- Move a protected neighbor or replace an identity that the request required retaining.
- Fill the plate's slot while preserving its outer envelope.
- Present the same valid solid geometry as baked meshes, and then with equivalent local axes and transforms. These must not fail merely because the internal representation differs.

Every altered scene is also checked by a separate test oracle based on actual solids. Correctness does not depend solely on the AI's chosen criteria or its success message. The oracle uses 5 mm positional/bounds tolerance and up to 1% material-volume tolerance for tessellated circular solids; preserved unrelated objects and required identities are compared exactly.

The external oracle **never supplies a repair plan or extra feedback to the AI**. The executor repairs using only PR #22's production completion feedback. This separates four possible failures: missed/misread requirements, deficient geometry predicates, execution/repair failure, and over-rejection of valid results.

## Budget proposed for approval

**US$3 maximum for this new evaluation; aim for roughly US$1–2.** The target range is a planning estimate, not an observed result or a promise that all turns fit. Work stops when the remaining budget cannot cover another conservatively reserved call. Unrun cases remain explicitly unrun.

- Fixed model: `gpt-6.1-sol`, Responses API, high reasoning effort, existing 6,000-output-token limit, standard service tier. No model switching or paid external tools.
- At most **24 actual API requests overall and 8 per turn**, counting internal inspection calls, completion-reader calls and repairs. The SDK's existing zero automatic retries remains in effect.
- Each call reserves a conservative maximum **before** sending. The bound uses request text bytes plus overhead, a generous allowance for the two 640 px observation images, the full permitted output, the higher standard long-context rates and a 25% margin. Requests entering the long-context tier are blocked.
- After known successful usage, costs are reconciled using reported input/output tokens with a 25% margin retained for budget accounting; cached-input discounts are ignored. Actual estimated cost and reserved/margin amounts are reported separately.
- Missing usage, connection interruption, an unexpected model/tier or provider failure retains the reservation and blocks further calls. The persistent ledger cannot be silently reset. An exclusive process lock prevents concurrent runs.
- Stop early on a demonstrated false completion or an accepted corrupted result. No prompt tuning, extra retries outside the limits, budget increase, merge or deployment is automatic.

**Pricing evidence:** a free `GET /v1/models/gpt-6.1-sol` check returned HTTP 200 on 18 November 2026. The current [public LiteLLM pricing table](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) lists standard input at **$2/million tokens** and output at **$10/million**; its higher standard long-context rates are $4/$15. Those higher rates are used for pre-call reservations. Official OpenAI pricing pages were blocked by this environment's network policy, so this is a clearly identified secondary pricing reference. The runner rechecks these rates before any generation and stops if they change. Costs are token-based estimates, not an OpenAI billing statement or an account-wide spending cap.

## Latency and cost measurements

Retain per-call model, role, reported tokens, estimated cost, reservation, status and full-response latency. Aggregate executor and independent-reviewer costs separately. Record total turn duration, browser-observation time, completion-reader duration, local checking duration, the first attempted completion, and subsequent repair calls.

Incremental API cost is the cost of calls after the first completion attempt: the added reader plus any repair/continuation calls. This avoids buying a second unverified run solely as a timing baseline. Report observed post-completion wall time alongside its separate components; it includes evaluation instrumentation, so it is not a controlled causal latency comparison. Report individual values, median and maximum rather than unsupported percentile claims from four turns. Post-run local counterfactual audits are excluded from the normal completion time.

## Decision rule

Recommend a **controlled production release** only if all planned turns finish with the requested geometry, protected objects/IDs and Undo intact; the injected omission is repaired; measurable negative controls are rejected; valid alternatives are accepted; and the measured extra latency/cost are practical. Any false completion, collateral change, valid-design rejection, necessary-but-missed requirement, unexplained confirmation or unresolved billing/transport blocker must be reported and investigated before a production recommendation. Budget exhaustion means insufficient evidence, not a pass.

This small evaluation cannot establish a general success rate. It does not evaluate microphone recognition, drawing reconstruction, arbitrary organic architecture, large imports, or physical AR. Those require separate evidence; none are implied by a pass here.

## Preparation and authorized execution

Offline preparation passed on 18 November 2026: the real geometry kernel and browser renderer handled all three creation fixtures; the follow-up edit fixture and deliberately wrong/equivalent variants behaved as expected under the external oracle. Four spending-guard tests, standalone TypeScript checking and formatting passed. The captured executor request required a conservative $0.445295 reservation, not an actual charge. The ledger remains unauthorized with zero calls. These results validate the evaluation apparatus, **not live AI performance**.

The [runner](../../scripts/evaluate-completion.ts) defaults to offline preparation. It checks good and deliberately bad geometric fixtures, renders actual geometry, captures a real SDK request payload without sending it, and writes an unauthorized, empty ledger under `.cloud/completion-live-evaluation/`. The [spending guard tests](../../scripts/completion-evaluation/budget.test.ts) use fake HTTP responses and never generate tokens.

```sh
# Safe now: no model generation.
node --import tsx --test scripts/completion-evaluation/budget.test.ts
node --use-env-proxy --import tsx scripts/evaluate-completion.ts --prepare

# Only after the user explicitly approves this evaluation's US$3 ceiling.
node --use-env-proxy --import tsx scripts/evaluate-completion.ts --live --approved-budget-usd=3
```

Live artifacts will include prompts, proposed operations, original/provisional/final sessions, actual independently generated criteria, measured failures, rendered observations, repairs, counterfactual results and the durable usage ledger. Credentials and authorization headers are never recorded. No live result or production-readiness claim is made at preparation time.
