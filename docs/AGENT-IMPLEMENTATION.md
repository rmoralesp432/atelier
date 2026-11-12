# Architectural agent implementation checkpoints

Status: development branch only; no production change or paid API evaluation authorized.

## Checkpoint 1 — executable geometry

- Removed duplicated nested Boolean expressions during frame partitioning; retained equivalent subtraction.
- Normalize component meshes using their actual Float32 coordinates. Filter numerical Boolean debris below the existing minimum solid-volume tolerance.
- Unified scene capacity at 4096 editable objects across persistence, scene transport, selection and execution; removed the conflicting 100-instance array rejection. Imported triangle limits remain unchanged. This is a bounded capacity increase, not proof of phone performance or geometry instancing.
- Reproduced a 12 × 12 array, follow-up edits, and ten-storey rectangular/cylindrical assemblies with real geometry. Checks include dimensions, component roles, independent editing, persistence, transport and Undo.
- Ten targeted checks pass. Existing bounding-box comparison now uses 1e-6 metre precision instead of exact floating-point equality.

## Next checkpoints

- Opt-in tool-using provider with scene inspection, actual operation receipts, bounded recovery and no mandatory model-authored brief.
- Preserve legacy path until comparative evaluation; expose model/transport settings without changing production or selecting a new paid model automatically.
- Offline transport/browser verification and reviewable PR. Real language, actual speech, rendered visual inspection, reference search/reconstruction and production phone performance remain unverified until separately evaluated.

## Checkpoint 2 — opt-in agent loop

Implemented function-call transport for Responses and Chat Completions: inspect the real provisional scene, execute a bounded operation batch, receive actual execution receipts, and finish only after successful execution. The application invokes this path through the same text/voice design route. No named-building or object-specific prompt recognizers were added.

Agent mode omits the mandatory immutable brief; legacy brief validation remains intact. Schema errors receive typed HTTP 422 feedback and bounded corrections. Auth/billing/network failures are not retried. Existing geometry review, cancellation, stale-scene detection and one-turn Undo remain. Building conversion leaves the full assembly in conversational focus rather than only its first slab.

Development settings (not enabled or deployed):

- `ATELIER_AGENT_MODE=true` opts into the agent path; omission preserves legacy behavior.
- `ATELIER_TEXT_MODEL` selects the approved model. The existing default is unchanged; no paid model has been selected or tested automatically.
- `ATELIER_TEXT_API=chat_completions` selects that endpoint; otherwise Responses is used.
- Agent reasoning models receive high reasoning effort; GPT-6 names no longer fall through the GPT-5-only check. Actual model/endpoint compatibility remains subject to a separately authorized live test.

The first implementation is bounded: up to 12 steps, three shared repair attempts, 64 applied operations and one optional scene inspection per provider invocation. Inspection can add a second model call, so a task can consume up to 30 generation calls at the current bounds; this is not a dollar-level spending cap. Do not enable it on the live site before a cost-bounded evaluation. Earlier successful steps remain private; completion commits once. Exhaustion or cancellation discards the proposal rather than silently installing a partial result.

### Evidence and limits

- Real local engine scenarios verify 144 cubes with exact grid placement and follow-up movement, plus rectangular and cylindrical building parts, persistence, transport and Undo.
- Offline SDK tests exercise both function-call transports, scene inspection outputs, invalid arguments, actual scene identity across stages, premature completion and non-retryable failures.
- Production-browser test exercises the agent-enabled route, an injected recoverable 422 error, 144-object execution, measurement and a follow-up movement. Legacy brief-browser checks remain green. Provider outputs in these browser checks are scripted; these are integration results, not evidence of general language intelligence.
- Visual screenshot: `test-results/agent-array-verified.png` (local test artifact).
- No paid generation, live speech, screenshot-based model observation, automatic reference lookup or reconstruction evaluation was run. No new model superiority is claimed. Full resource-aware geometry workers, shared-mesh instancing, durable building-level parameters and broader performance measurements remain next work.

Next acceptance gate: authorize a capped comparative live trial on unfamiliar one-shot requests and follow-up edits. Compare the same model on legacy and agent paths before attributing gains to a model upgrade. Keep all failed attempts, cost, clarification counts and actual geometric outcomes. Production deployment remains a separate decision.

Final checkpoint validation: production build and formatting pass; all 313 local unit/engine/provider checks pass across 69 files. Three production-browser checks passed (the new agent recovery/follow-up scenario and both existing brief scenarios). These numbers establish implementation regression coverage only; live generalization remains unevaluated.
