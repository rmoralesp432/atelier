# Budgeted live modeling evaluation — 2026-11-05

This round called real GPT-4.1, then executed its structured plans through ATELIER's checked planner and Manifold solid engine. All projects were synthetic; no saved user project was modified. Paid calls have stopped. Estimated cost is **$2.926726**, deliberately ignoring cached-input discounts. This is a token-based estimate, not an invoice. The original $3 target was met; the user's optional $4 allowance was not needed for actual estimated consumption.

There were 58 recorded requests: one authentication rejection, one tiny generation probe, and 56 modeling requests, including staged continuations and corrections. They are not 58 independent successful tests. The sanitized [evaluation receipt](evaluations/2026-11-05-budgeted.json) preserves failures, blocked continuations, usage and estimates instead of reporting only successful attempts.

## Results and limits

| Scenario                        | Evidence after this round                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Precise raised volume           | Live pass: 10 × 6 × 4 m, base 2 m, 240 m³.                                                                                                                                                                                                                                                                                                   |
| Contextual correction           | Live pass after fixes: height 6 m, right 2 m, rotation 45°, stable ID, unchanged footprint/base.                                                                                                                                                                                                                                             |
| Circular array                  | Live pass: ten independent 2 × 4 × 3 m solids, radius 5 m, equal angular spacing.                                                                                                                                                                                                                                                            |
| Real subtraction                | Live pass after corrections: 4³ block minus 2 × 2 × 4 cutter = 48 m³.                                                                                                                                                                                                                                                                        |
| 2D → extrusion                  | Live pass after fixes: 6 × 8 footprint extruded 3 m = 144 m³.                                                                                                                                                                                                                                                                                |
| Editable gallery                | Original live response replayed offline after fixing exact-name resolution; two floors, roof, six circular columns and glass verified. A fresh gallery creation was not purchased.                                                                                                                                                           |
| Scoped column modification      | Live pass: six columns changed from 30 to 40 cm diameter, IDs/positions/heights and every unrelated member retained.                                                                                                                                                                                                                         |
| Map/view/theme/display commands | Original live response replayed offline; correct effects and unchanged model verified. This is not a microphone or map-service test.                                                                                                                                                                                                         |
| Undo then intersect             | Original live response replayed offline after fixing history-aware scope binding: restored operands yield 16 m³. No new paid retest.                                                                                                                                                                                                         |
| Circular opening + glazing      | Live attempts exposed a name-changing kernel defect and inconsistent model-authored requirements. A saved actual live response now passes an offline regression with the real hole, glass and annular frame. The latest fresh live attempt still failed its checklist, so this is not claimed as reliable end-to-end language understanding. |
| Five unequal stories            | Final live pass after base/center clarification: five independent slabs at bases 0, 8, 16, 20, 24 m and roof at 28 m, all 20 cm thick.                                                                                                                                                                                                       |
| Nine IPR columns                | Actual I-section construction and array were generated, but grouping, role assignment and a revised checklist prevented successful final acceptance. Group repair and targeting guidance improved afterwards; no passing final paid retest.                                                                                                  |
| Organic roof ribbon             | Retained NURBS solids were generated, but requested crest/rise and acceptance constraints were not reliably satisfied. Thickness checking and provisional-edit handling improved; precise freeform instruction following remains unverified.                                                                                                 |
| Bridge                          | A live plan was returned; continuation was budget-blocked. Base-versus-walking-level guidance was corrected. No verified final language result.                                                                                                                                                                                              |

Barcelona reference-image reconstruction was withdrawn from this round at the user's request because chat images were not available as transferable local files. No image-recognition, acoustic voice, physical AR, engineering correctness or arbitrary-building guarantee is claimed. Every test remains a sample of behavior, not a statistical reliability measurement.

## Changes driven by the failures

- Exact unprefixed object/group names resolve only when uniquely identified. Missing/stale names and cross-namespace ambiguity still fail safely.
- Boolean cuts preserve the user's object name as well as its ID. A multi-operation instruction can keep addressing the same wall after opening it.
- Per-axis preservation permits a height edit while protecting width/depth and a horizontal move while protecting elevation. Whole-property preservation remains strict.
- Extruded polygon/profile recipes satisfy an extrusion requirement without flattening or rebuilding their geometry.
- Curved NURBS shells can be checked for retained nominal thickness independently of bounding height. Uniform scale is accounted for; nonuniform scale is explicitly refused as a constant-thickness claim. This is not a surface-distance survey.
- Contradictory same-selection shape requirements are rejected before the checklist is bound. Once bound, outcome checks cannot be weakened to make a bad result pass.
- A later stage may list newly created provisional parts as editable without expanding permission over original objects. Existing preservation rules and acceptance criteria remain unchanged.
- Leading Undo/Redo is previewed for scope binding, so restored operands can be used in the same checked request. The original session remains untouched on failure.
- Adding members to a uniquely named existing group reuses it instead of creating duplicate ambiguous groups; locked and ambiguous groups are rejected.
- Shared planning instructions clarify exact Boolean versus smooth blending, consumed cutters, stable result IDs, explicit component roles, array selection, specialized circular-window tools, and shell controls versus evaluated geometry. Assembly/bridge schema descriptions distinguish base elevations from centers and walking surfaces.
- Provider transport has an explicit Chat Completions compatibility option with the same context, image attachments and strict plan schema. Default production Responses behavior is unchanged; there is no automatic retry/fallback that could double-charge.

## Local release checks

- 303 unit/engine/provider tests passed across 67 files.
- Production TypeScript/Vite build passed.
- Five browser regressions passed against the production build: checked multi-stage design and rejection, component-level buildings, editing/persistence/Undo, and organic controls. Earlier development-server runs hit cold-reload timing and overlapping test-server teardown problems; the clean production run passed without relaxing assertions.
- Changed files pass formatting and whitespace checks. These local browser cases use deterministic provider responses and consume no API credits.

## Reproducing safely

The configured secret is `ATELIER_OPENAI_API_KEY`, not the workspace unlock password. During this round `/v1/responses` rejected generation while `/v1/chat/completions` successfully generated responses using the protected environment secret. A public model-list response was not proof of authentication. This endpoint distinction is recorded without claiming to have diagnosed the proxy/provider cause.

List scenarios without spending:

```sh
node --use-env-proxy --import tsx scripts/evaluate-budgeted.ts
```

Live calls require explicit opt-in and named cases:

```sh
node --use-env-proxy --import tsx scripts/evaluate-budgeted.ts --live --case=dimensions
```

Replay a saved first response without network or payment:

```sh
node --import tsx scripts/evaluate-budgeted.ts --replay --case=gallery
```

The persistent ledger and synthetic sessions are in `/tmp/atelier-budgeted-evaluation`. Never delete/reset the ledger or run concurrent paid evaluators during an authorized round. Review pricing and authorization before a new round; the current ledger stops further calls. Run dimensions before correction, subtract before undo_intersect, and gallery before scoped_columns. Replay resolves only a saved first response and stops if additional corrections are necessary.

Pricing was cross-checked against the public LiteLLM table on 2026-11-05: GPT-4.1 input $2/M tokens, output $8/M. Before a call, the evaluator reserves 125% of an upper estimate based on serialized UTF-8 request bytes plus 4096 and the maximum output. Unknown/interrupted calls retain the full reservation. Once actual token usage arrives, confirmed input/output usage replaces that reservation; cached discounts remain ignored. Early attempts retained a redundant 25% margin even after usage arrived; this was corrected without resetting records. Explicit 401 failures release their reservation.

The final controls stop starting requests at $2.90 known estimated consumption, cap known costs plus a worst-case new reservation at $3.40 (within the optional $4 authorization), and allow at most 60 total calls/five per scenario invocation. The final request finished at $2.926726. Earlier attempts used a smaller $2.80 ceiling and were budget-blocked; some early entries show SDK-wrapped “Connection error” for that local guard. Those are not additional paid requests. The evaluator's final output cap is 6000 tokens; the application retains its 16000-token default. These controls are local to the evaluator, not account-wide billing limits; other user/app requests are outside its accounting.
