# Independent modeling completion

## Scope and baseline

This change starts from `9bb6ad42997979f3b55b8218a1c9dcfd22f61dff`, including the coordinated component edit from PR #21. It implements the next requested milestone: distinguish successful execution from satisfaction of the user's modeling request. It does not change the geometry kernel, add building templates, increase transaction budgets, or deploy anything.

References supplied by the user:

- **ATELIER_Independent_Technical_Review.md**, 18 November 2026: the independent reviewer reproduced a one-box false finish and recommended host-owned completion, provenance, scope preservation, and reuse of existing geometric predicates.
- **ATELIER_research_tests.pdf**, 18 November 2026: independently reproduced the same completion weakness; distinguished Aedifex's successful door operation from its false connectivity claim, and TextCAD's verified exported solid from a plausible picture. Its product comparisons are evidence, not instructions to copy features.

The reviews examined earlier PR #20 snapshots. Their deployment findings do not describe this newer baseline. Neither attachment is added to the repository.

## Root cause and correction

The agent could finish after any successful execution receipt. Its optional verification operations checked whatever it chose to check; they did not establish coverage of the user's request. A valid box could therefore be followed by an unsupported claim that a multi-part model was complete. The legacy requirement evaluator already provided useful solid checks, but requiring the executing model to declare and retain its own brief would restore the restrictions the agent architecture removed.

The new boundary has two independent responsibilities:

1. **Read the request independently.** On the first completion attempt, a separate, stateless response extracts measurable criteria, quoted request/history evidence or reference provenance, and the original objects this request permits changing. It sees the current instruction, conversation, original scene, references, and candidate identities/classifications. It does not see candidate dimensions/positions, execution receipts, operations, or the executing agent's completion claim. It cannot execute tools or decide that geometry passed. Criteria concern outcomes, not construction steps, and accept different valid construction strategies.
2. **Measure the actual candidate in the host.** The browser evaluates those criteria with the shared geometry engine and compares protected original components. Failures contain expected and observed values and affected IDs. They return to the existing agent loop, which can repair its private model and request completion again. Every attempt reads the current geometry; solid-volume measurements are cached only within that immutable attempt.

Criteria are cached only for the current user turn, so repairs cannot silently weaken them and do not purchase repeated interpretation calls. A later user correction gets new criteria and can change earlier dimensions. The agent's compact scene omits the legacy retained brief; no new brief is saved into the project and no new user approval step is introduced.

Completion must pass before either `finish_task` or a single-stage `execute_step` can commit. Missing verification, empty modeling criteria, unsupported measurable obligations, and exhausted repairs leave the committed project unchanged. The existing three-repair, twelve-stage, sixty-four-operation limits remain. All successful stages still commit as one Undo transaction; failures and cancellation discard the private proposal.

Quantitative modeling replies now come from host measurements instead of unchecked completion prose. Qualitative limitations are displayed separately and are not labeled as measured success. Existing protections for destructive changes remain.

## Measurements and their limits

The implementation reuses the existing evaluator's counts, local dimensions, material/role/level/host properties, semantic shapes, grid positions, actual solid volume, and intersection/containment predicates. It adds coordinate/range checks for alignment, preservation checks bound to original identities/properties, and signed offsets between actual solid world bounds. The old 200-position evaluation ceiling now matches the existing 4,096-object scene capacity. Duplicate grid positions and overlapping tolerance neighborhoods cannot pass as distinct positions.

Important distinctions:

- Local width/depth/height and base-center coordinates are modeling quantities. An envelope is not material volume.
- Solid-volume and Boolean relation checks use the actual kernel, including voids. Mesh volume may use explicitly bounded tessellation tolerance.
- A world-bounds offset does **not** prove surface contact, structural support, or nearest-surface clearance. The feedback states this. Unsupported measurable requirements block completion instead of receiving a fabricated pass.
- Request interpretation still uses a model and can omit or misinterpret a requirement. Quoted provenance prevents invented quotations, not every mistaken inference. This is an independent evidence gate, not proof that arbitrary language is understood perfectly.
- Aesthetic judgment and arbitrary reconstruction fidelity are not solved by numerical checks. No new BIM constraint solver, topology tracking system, image reconstruction pipeline, or kernel migration is included.

## Failure-state investigation

The existing staged planner already keeps provisional geometry, receipts, and operation budgets local to a call. No cross-turn execution-state leak was reproduced. However, failed attempts remained in conversation history as ordinary assistant text, without a durable indication that nothing committed. That could confuse a later model response about what existed or which work remained pending.

Failed replies now retain an `outcome: failed` marker through save/reload and project transfer. Both the executor and independent reader receive the explanation that the proposed changes were not committed, the failed turn is not pending work, and the latest instruction/current scene control the next task. Earlier user context remains available for an intentional retry.

Two distinct regressions cover this: verification repair exhaustion followed by an unrelated successful request, and a successful private step followed by repeated operation failure, reload, and a new instruction. Each asserts fresh receipts and budget, no discarded object in the saved scene, preserved original geometry, and functioning Undo.

## Offline evidence

All provider responses in this session are scripted. The geometry engine, transaction coordinator, HTTP boundary, browser, persistence, and Undo/Redo are real. No paid API calls were made, and these tests do not establish fresh natural-language success rates.

| Negative control / workflow                                     | Measured evidence                                                                                                                                                                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Valid but incomplete model followed by a false completion claim | One wrong-height box fails independent count, height, and layout checks; the agent fixture repairs that same ID and adds the two missing pieces. Final solids each measure 8 m³; the unrelated neighbor remains identical.                 |
| Correct envelope, missing opening                               | A 4 × 2 × 4 m filled solid measures 32 m³ and fails the required 24 m³. A real through-cut passes with identical outer dimensions.                                                                                                         |
| Alignment and relationships                                     | A 0.5 m lateral error fails alignment; a 0.25 m vertical error fails both the signed bound offset and actual solid non-overlap check. Mutating previously accepted geometry invalidates the earlier pass.                                  |
| Repetition                                                      | A 225-component grid passes; moving one item onto another leaves 224/225 distinct positions and fails despite the correct total count. Collapsed layout steps are rejected.                                                                |
| Preservation                                                    | Renaming cannot hide an original object from preservation checks; replacing its ID or changing protected dimensions fails. Unrelated original changes, including hiding them indirectly through a group, fail the scope check.             |
| Later user correction                                           | A verified 2 m-high object can become 3 m high in the next turn, retaining identity, footprint, position, and one-step Undo. The original 2 m requirement does not persist as an obligation.                                               |
| Failure recovery                                                | Both verification exhaustion and actual execution failure leave the committed project intact; a subsequent unrelated instruction succeeds, including after browser reload.                                                                 |
| Existing coordinated editing                                    | The 244-component storey regression retains individual dimension/position/identity comparisons, unrelated-neighbor preservation, failed-edit rollback, Undo/Redo and reload, with the independent completion endpoint in the browser flow. |
| Transport and integration                                       | Strict Responses and Chat Completions schemas, authenticated/origin-checked endpoint, rejected invented evidence, withheld candidate measurements, existing voice forwarding and camera/solar paths.                                       |

Local validation: **357 unit/integration tests across 74 files passed**, as did the production build and repository formatting check. Ten distinct targeted browser cases passed across the initial run and the corrected readiness rerun; this includes the two new completion/recovery cases. The pull request runs the existing complete browser suite as its required CI gate.

Validation commands:

```sh
npm test
npm run build
npm run format:check
ATELIER_TEST_PRODUCTION=1 npx playwright test tests/completion-verification.spec.ts tests/agent-execution.spec.ts tests/orb-conversation.spec.ts tests/storey-edit.spec.ts tests/design-brief.spec.ts
```

The existing storey browser test selected its hidden file input before the project library had finished loading, so the application's busy guard ignored the file event. The test now waits for the actual **Open project copy** control to become enabled. Product behavior and modeling assertions are unchanged.

## Runtime cost and next authorized evaluation

When enabled in a future release, an agent turn reaching completion adds one independent structured-output response using the configured agent model and text transport. The existing provider timeout, zero automatic retries, token limit, authentication, origin checks, and request limits apply. Repair rechecks are local; any additional executor turns still use the existing bounded recovery allowance. Latency and incremental cost have not been measured with live inference in this session.

Before deployment, authorize a small held-out live evaluation covering unfamiliar geometry, a contextual edit, a deliberately incomplete result, and failure recovery. Record criteria coverage as well as actual geometry, false success, collateral changes, unnecessary clarification, repair count, latency, and cost. Current offline results validate the mechanism; they cannot substitute for that language evaluation.
