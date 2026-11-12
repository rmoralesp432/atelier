# Architectural agent implementation checkpoints

Status: publication authorized by the user on 2026-11-12. Release preparation is in progress; deployment remains gated on validation. Earlier checkpoint statements below describe their authorization state at that time.

## Current candidate — working model, correction and voice integration

The current candidate completes live conversations that create a curved chair and an independently editable four-storey building, then modify the intended components while preserving the rest. A simple unfamiliar plan/section also produced the correctly dimensioned editable mass. [Downloadable projects, actual render observations, failures, timings, cost and reproducible offline checks](evaluations/2026-11-12-agent/README.md) are retained in the repository. Earlier checkpoint limitations below describe their state at the time, not the final candidate.

Changes driven by those trials:

- Show the provisional model as it develops, with Stop restoring the saved design. Only completed geometry is persisted; the whole request remains one Undo. Selection/transforms are disabled during a working preview, while navigation stays available.
- Frame small objects at their actual scale instead of keeping a ten-metre minimum scene extent; the retained live-generated chair exposed this presentation problem during normal project import.
- Allow reversible agent edits that preserve original identities without redundant review. Removing original objects still requires review; legacy review behavior remains unchanged.
- Keep natural responses in conversation and spoken replies; retain detailed engine receipts in the expandable change record. Subsequent turns receive the concise reply and real scene rather than repeated execution logs.
- Route complete spoken requests to the design agent before deciding whether clarification is needed. Low-eagerness semantic turn detection gives longer descriptions more room for pauses. This configuration is checked offline; real speech recognition still needs hardware testing.
- Freeze transient references such as `$created` when each workspace operation is encountered, before later creations can change their meaning.
- Expose a general camera operation with bearing, elevation, projection, distance and look-at target. Add sun playback/pause and include actual playback state in subsequent context. This fills missing tool capabilities without recognizing specific phrases or buildings.
- Fit requested views to portrait screens and preserve the chosen camera direction when the interface resizes. A browser check changes from desktop to phone width while the sun study is running.
- Reduce duplicated group/role/level ID lists in the model's initial context while preserving every object and exposing full construction through inspection.
- Support an explicit `ATELIER_AGENT_MODEL`. The agent uses it, then `ATELIER_TEXT_MODEL` if configured, otherwise the successfully tested `gpt-6.1-sol`. Legacy mode retains its existing default. Model switching alone is not credited for all gains; contracts and orchestration changed too.

To run this candidate deliberately in a development deployment, set `ATELIER_AGENT_MODE=true`, `ATELIER_AGENT_MODEL=gpt-6.1-sol`, and `ATELIER_TEXT_API=responses`, alongside the existing server-side API secret and workspace authentication. The public config reports `agentConfigured: true`; this is not proof of billing/model availability. The same text and voice routes use the agent. Omit/disable the agent flag to retain legacy mode. No production settings were changed.

Live tests used Responses with high reasoning effort; no Astra generation or controlled A/B trial was performed. Estimated cumulative paid evaluation is $2.80945, including conservative carried-forward spend after the runtime interruption. This is not verified billing. No additional paid calls are needed to inspect the retained studies.

Local browser checks verify real 144-object geometry, malformed-response recovery, working preview/cancellation, follow-up identity, camera bearing/elevation, running/paused sun animation, and phone-layout voice modeling with the chat minimized. Provider and audio transport are scripted in these browser checks; live speech and real iPhone hardware remain unverified. Complex multi-drawing reconstruction, internet reference lookup and heavy imported-mesh performance are not solved by this candidate.

Current local validation: 329 unit/engine/provider tests pass across 71 files. The production build and formatting pass. Nine focused browser scenarios pass against the production server/build, including the legacy Boolean-edit sequence and backend configuration contract. All three retained AI projects also passed solid validation and normal project-copy import checks. Older CI failures included outdated Boolean-name/config assertions and cold-render readiness races; these assertions now check the actual recipe and current contract, and allow fifteen seconds for readiness without weakening the expected results. CI runs the wider 129-test browser suite on the review branch; its result is tracked on PR #20 rather than inferred from these targeted checks. Superseded CI runs were cancelled to avoid duplicating that long suite. The full run then found a real measurement-summary regression and two stale history/error assertions. Measured query replies now use execution receipts; all three failing scenarios pass in a production-build rerun. CI retains every browser test and divides them among four isolated runners with an aggregate gate requiring all four to pass.

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

## Checkpoint 3 — observation and live feedback

- The agent receives two neutral rendered views of the actual provisional geometry (oblique and plan), distinctly labeled from user references. Views refresh after geometry changes and are reused during unchanged retries. Dense geometry or rendering failure produces explicit unavailable feedback. These views do not show the live camera, site, solar lighting or section display.
- Initial context is a compact inventory retaining every object's identity, placement, dimensions, role and bounds. `inspect_scene` retrieves the full construction data when needed.
- Added the execution contract for references, sequential operations, base coordinates, placement versus relative movement, array anchors and measurement semantics. These are general tool mechanics, not task recognizers or named-building recipes.
- Unknown-target errors now explain valid references instead of only asking the user to identify an object.
- Completion distinguishes `completed` from `blocked`. An explicitly blocked result discards provisional changes rather than committing a known partial result. This does not independently prove that an AI's completion judgment is correct.

### Live evaluation observed before the runtime interruption

The opt-in `scripts/evaluate-agent.ts` uses the actual provider, geometry engine and browser-rendered observations on synthetic projects. No production data was changed.

- GPT-4.1 initially invented IDs and repeated the error. After reference-contract improvements, it created 63 objects but collapsed their positions through absolute placement. It detected the overlap but did not repair it. This was a failure, not a successful model.
- GPT-6.1-Sol created a centered 7-by-9 grid with 5 m spacing and then doubled only the northernmost row's heights. Acceptance checked all 63 positions, stable IDs, heights and ground bases. It recovered from a per-object versus group measurement error. This establishes API compatibility and one successful conversation, not general model superiority; the tool contract changed between early trials.
- The mixed-height four-storey study reached separate structure and glazing construction. Negative elevation and aggregate-measurement assumptions required repairs. The evaluation's eight-call per-turn cap stopped the run before final verification; the trial is incomplete and not a pass. No column-correction follow-up was completed.
- No live chair, unfamiliar drawing reconstruction, voice-audio, camera/solar or Astra generation evaluation was completed in this checkpoint. Broader capability claims remain unverified.

### Recovery record — 2026-11-12

The command transport disconnected and the environment became unavailable. It subsequently returned; repository edits survived, but `/tmp` evaluation logs and image artifacts did not. The underlying infrastructure cause is unknown. The results above are retained from observed tool output in the conversation; raw paid-response artifacts are no longer available for independent replay.

The last observed ledger total was approximately $1.22909 across 24 API calls, using indicative token rates and ignoring cache discounts, not verified account billing. Recovery conservatively carries forward $1.25. Future evaluation artifacts live under ignored `.cloud/agent-evaluation/` in the workspace. The harness refuses paid execution when its ledger is missing; restore prior spend before resuming, never initialize a lost ledger to zero. Local files still require backups. No additional paid calls were made during recovery.

The agent remains opt-in, default model unchanged, and nothing in this checkpoint is deployed. Next: retain fresh artifacts, complete bounded building/follow-up and unfamiliar-shape trials, correct general execution failures, and separately validate camera, references and voice. Do not label execution-only chair or environment trials as full architectural acceptance without inspecting their actual results.

Recovery validation: production build and formatting passed; all 317 unit/engine/provider tests passed across 69 files. Both legacy brief browser checks passed. The agent browser check initially exceeded its five-second follow-up poll while rendering observations; with a 30-second poll it passed (22.8 seconds overall), including image refresh/cache assertions, private provisional geometry, error recovery and follow-up editing. These are offline integration checks, not additional paid AI trials.
