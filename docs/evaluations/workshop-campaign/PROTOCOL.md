# Frozen live workshop campaign

Authorization: the user's broad evaluation authorization on 23 November 2026 replaces the previous cap and approval gate. Evaluation only. Application code stays frozen; no merge, deployment, or billing auto-recharge changes.

## Arms and execution

- Stable application: `f925e4cef7b4c6a27eb1532476879728aa5d7584`.
- Workshop inspection: `f5ba62621db0d9c0a02f90be5b0143c7e21b53f7`.
- Separate verifier comparison: stable versus `433d9baed8265cc4eb78a5b0bfb914911b734cf7`; it does not include the workshop change.

Each arm runs its own production bundle and server/provider code. Fresh GPT-6.1-sol Responses calls go through the real browser's conversation, staging, review, transaction finalization and persistence. Two isolated browser contexts/projects run in parallel, with a single accounting coordinator. No shared AI responses or conversation between arms. No tool instructions, expected coordinates or oracle data are added to live requests. Original creation requests remain in ordinary conversation history, as they would for a real user.

Model settings follow the frozen applications: high executor reasoning, low reviewer reasoning unless the application supplies user reference images, 6,000 maximum output tokens, default service tier. Original application limits remain intact. Evaluation watchdog: 32 calls per turn, 15-minute elapsed deadline; neither forces a commit. A failed/incomplete attempt is retained, never overwritten as a success.

## Matched workshop batch

Exact natural prompts are in `scripts/workshop-campaign/specs.ts`.

| Case | Object                                 | Follow-up relationship                                                                                        |
| ---- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| W1   | Four-piece console                     | Increase width while preserving the starting overhangs, sections, centered position and stretcher connections |
| W2   | Garden enclosure                       | Raise the floor, shorten seven connected upright parts, preserve roof and footprint                           |
| W3   | Bored roller, shaft, bearings and base | Lengthen roller while retaining bearing air gaps, shaft overhangs and base end setbacks                       |
| W4   | Elliptical halo, supports and plinth   | Raise curved halo, extend supports from fixed feet and preserve opening and support diameters                 |

Each project starts with two unrelated, independently editable reference solids in an existing group. The evaluator never feeds original measurements into the follow-up. If creation fails external acceptance, a separately labeled **diagnostic edit** may run on a validated fixture, in a new project; it is not an end-to-end success and cannot erase the failed creation. Selected primary episodes will repeat with new responses and projects to measure consistency. Different domains provide transfer evidence; repeat runs are not claimed as new held-out tasks.

Additional frozen transfer tasks: **W5**, a rotated workbench on four tapered legs, whose working surface must rise while its feet and top shape stay fixed; **W6**, three raised platforms linked by two solid wedge ramps, whose middle platform must rise while both end platforms stay fixed and the walking route remains continuous. The follow-ups do not enumerate which supports or ramps to modify. External measurements derive each expected changed solid from the starting geometry; original identities and unrelated objects are protected. These cases use fresh AI, separate projects and the same prompts in both arms.

## Independent measurements and scoring

Use actual occupied solids from the geometry kernel, closed-mesh volume, bounding coordinates, Boolean symmetric difference, through-hole geometry and contact distances. Component identification uses geometry rather than names. Compare edited occupied solids against independently transformed pre-edit solids. Preserve each ID, name, material designation/rendering category, group and unrelated object. Position tolerance is generally 2 mm (1 mm for the verifier arc/reflection); round creation equivalence allows 2% occupied-volume difference for tessellation; follow-up equivalence allows 0.1%. Retain detailed facts, not just a pass count. Unmeasurable properties are unverified.

Score separately:

1. **Interpretation:** evidence in fresh tool arguments, plans and responses of the intended relationship; unresolved or contradictory interpretation is reported. No claims about hidden reasoning.
2. **Inspection:** actual `inspect_scene` calls, requested before/current/compare state and relative reference; starting inventory delivered by the host is recorded separately. An explicit tool call is not mandatory for success when the needed geometry is already visible in context.
3. **Geometry:** external facts about counts, dimensions, positions, contact, occupied shape, bores, clearances and preservation.
4. **Verification:** independent reviewer requirements, literal versus calculated targets, source values/units/frame/calculation if emitted, host outcomes, invalid or unverified requirements. A correct final model is not automatically proof that the reviewer covered every requirement.
5. **Application:** actual saved commit, single Undo, reload of geometry/context/conversation/camera, and exact Undo/Redo. Preview geometry and a passing offline predicate are not commits.

End-to-end success requires creation and the natural edit to pass measurements and persist, with identities and unrelated work preserved. Incorrect geometry committed with a verified host verdict is recorded as false acceptance. Correct but withheld geometry needs separate provisional evidence before being labeled a false rejection; absence of a commit alone is insufficient.

## Separate verifier batch

Retain previously frozen fresh tasks D-H1 (six cylinders on an inclined arc) and D-H2 (position-only reflection of three differently shaped pieces). Both use live executor and reviewer through the browser. D-N1 deliberately displaces one arc sample radially by 4 cm: **scripted executor, fresh independent reviewer**, no scripted repair. Its purpose is a negative control, not autonomous modeling evidence. The real application must refuse the bad transaction. Preserve the criterion calculation, feedback and committed scene. No cross-arm changes to tolerances or criteria.

In a separately recorded repeat, append D-R1 in the same still-open project after D-N1 is safely blocked: a fresh natural request for a 30 cm sphere, followed by a request to align its base with the taller original reference sample. The agent receives no reference height. Independent measurements derive that height from the untouched original solids. Recovery uses real executor and reviewer calls, and must preserve both original objects and support reload/Undo/Redo. It is reported separately from unfamiliar-assembly success rates.

## Calibration, evidence and spending

Before paid calls: external positive/negative/equivalent-parameterization controls plus browser commit/reload/Undo/Redo/failure/recovery on all three bundles. Save source/bundle/prompt/oracle hashes and evaluator commit. The existing oracle and calibration are external to all application versions.

Every paid call gets a persisted pre-call conservative reservation. Record response usage, reasoning tokens, latency, returned model/tier, raw request/response and unknown-charge reservations. The user accepts estimated pricing: current LiteLLM secondary price table (retrieved 23 November) lists $2/M input and $10/M output; reserve at $4/M and $15/M plus 25%, assuming no cache discount. These are estimates, not account-specific invoices. Latest user-confirmed balance was $68.61; after the prior $2.055574 baseline estimate, working available-credit estimate is $66.554426, before unknown intervening account activity. This is a resource guard, not a newly imposed campaign dollar authorization. Stop on quota/access problems or irreconcilable usage. No automatic recharge is enabled or changed by this harness; account billing settings cannot be independently inspected with the model key.

Publish summaries after each batch, retain full local traces/solids/browser states and publish compressed evidence. Retain failed calibration attempts and document evaluator corrections. Continue with repeats or transfer questions while they add useful evidence and prepaid capacity remains. Do not spend merely to exhaust credits.


## Paired diagnostic extension (evaluation harness revision 5)

Two workshop roller creations were blocked by group-reference checks; two subsequent fixture edits exhausted reviewer output. Baseline roller edits instead started from its own native AI-created geometry. To distinguish implementation differences from starting-representation differences, run **both versions** on the exact existing, independently validated W3 fixture, using the same previously frozen natural follow-up and no creation prompt or measurement supplement. `ATELIER_EVAL_DIAGNOSTIC=true` reuses the existing diagnostic execution/measurement path, saves the starting fixture, and labels every row diagnostic. These are edit diagnostics, never end-to-end creation successes. All application code, model settings, limits, prompts and solid oracles remain unchanged.
