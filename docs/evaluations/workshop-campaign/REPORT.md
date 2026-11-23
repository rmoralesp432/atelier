# Frozen ATELIER workshop comparison — 23 November 2026

**Both versions can build and edit the tested unfamiliar assemblies. `f5ba626` provides useful access to the original scene, but this campaign does not establish a consistent overall completion-rate improvement. The main recurring obstacle is completion verification: the modeler often has correct geometry that the reviewer cannot reliably certify.**

Applications remained frozen: stable baseline `f925e4cef7b4c6a27eb1532476879728aa5d7584`, workshop `f5ba62621db0d9c0a02f90be5b0143c7e21b53f7`, and the separate verifier `433d9baed8265cc4eb78a5b0bfb914911b734cf7`. No application behavior changed, and nothing was merged or deployed. [Final integrity check](final-integrity.json).

## What ran

Fresh GPT-6.1-sol executor/reviewer responses through each version's actual production bundle and server, in isolated Chromium projects. The same natural requests went to each arm, with no tool instructions or expected measurements injected into follow-ups. The existing scene inventory and ordinary conversation were available, as in the application. Two browser lanes ran in parallel.

Six unfamiliar object families covered furniture, architecture, mechanical assemblies and sculpture. Selected cases repeated with fresh responses; the rotated workbench and connected promenade tested transfer. Independent checks used actual closed solids, occupied-volume comparisons, bores, positions, connections, identities and unchanged unrelated objects—not object labels alone.

There are **72 recorded request attempts**: 52 strict passes, seven uncommitted requests, four correctly blocked negative controls, five strict saved-result flags and four initial evaluator interruptions. These are **not 72 independent end-to-end successes**. Diagnostics, resumed requests and repeats are distinguished in the raw records. The five flags comprise one 0.5 mm placement discrepancy, two evaluator Float32-volume false flags and two sensible height-label updates. Their original scores are retained. A single headline success percentage would obscure these differences.

## Core workshop results

| Model and natural follow-up | Stable baseline | `f5ba626` |
|---|---|---|
| Console: widen while preserving overhangs and connected supports/stretcher | First resumed edit had a 0.5 mm placement discrepancy; fresh repeat passed | Resumed and fresh repeated edits passed; original-state inspection helped repair a connection |
| Garden enclosure: raise floor, shorten connected uprights, keep roof fixed | First creation blocked by an invalid filled-volume criterion; fresh creation/edit repeat passed | Both creation/edit episodes passed |
| Bored roller assembly: lengthen while preserving bearing gaps, shaft overhangs and base setbacks | Both AI-created assembly/edit episodes passed | Both creations blocked by group-ID/name mismatch; separate fixture edits twice hit reviewer output exhaustion |
| Elliptical halo: raise it and extend its two supports from fixed feet | Both creation/edit episodes passed | Both creation/edit episodes passed |
| Rotated workbench on tapered legs: raise working surface, keep feet and top form fixed | Both creation/edit episodes passed | Both creation/edit episodes passed |
| Promenade: raise only middle platform and reshape connecting ramps | Saved-model follow-up passed; fresh repeat edit blocked by reviewer exhaustion | Both follow-ups had correct solids; strict flags were height-label updates only |

The first console/ramp creation records contain evaluator interruptions or measurement false flags. Their resumed edits are identified as resumed; the fresh repeat episodes are separate evidence. See [corrections and retained failures](HARNESS-CORRECTIONS.md).

On a further **identical validated roller fixture**, both versions successfully performed the same connected edit. This isolates editing from differences in AI-created starting representations. It does not erase earlier failures or count as AI creation. [Paired diagnostic](roller-fixture-results.json).

### Did the agent actually consult the starting geometry?

We inspected tool responses, not just tool-call counts. `f5ba626` successfully retrieved original/compare-state components in the console, garden, halo, repeated workbench, promenade and controlled roller edits. In the first ramp-fixture diagnosis, that access let it restore an original scalar after an over-strict preservation check; the baseline tried a prohibited mid-transaction Undo instead.

Two workshop inspection calls returned no matching members because the agent used `$group:...` shorthand where the inspection tool expects object IDs. These are not counted as successful member inspections. Other tools accept group references, so the inconsistency matters. The repeated workbench query successfully retrieved all five original members.

The baseline sometimes inspected the current scene and sometimes used the inventory/conversation already supplied. A correct result without an explicit inspection call cannot tell us whether it relied on scene data or remembered wording. [Recorded calls and returned members](campaign-boundaries.json).

### Actual geometry and persistence

Successful edits retained component IDs and unrelated samples. For example, the promenade changes exactly its middle platform and two ramps while preserving both end platforms and both samples. Workbench edits change the top and four tapered legs while retaining their original identities, plan positions and fixed feet. [Per-component differences](component-changes.json).

**57 completed committed-result checks passed reload, conversation/context preservation, camera equivalence and exact geometry/group Undo/Redo with one atomic history entry.** Three initial committed attempts had incomplete evaluator persistence checks; they remain identified rather than being silently counted as passes. All seven uncommitted requests and all four negative controls preserved the original committed scene.

A separate offline browser test imported an actual edited workbench copy through Projects, verified durable IndexedDB storage, removed temporary workspace/checkpoint caches, reloaded and exercised Undo/Redo successfully. [Import/database audit](project-import-audit.json).

## Separate `433d9ba` verifier comparison

The stable and derived-verifier arms both produced correct arc layouts twice and correct reflected arrangements three times. All four live wrong-arc controls—two per version—were blocked with the project unchanged. The negative candidate was scripted fault injection; the reviewer was fresh AI. Following a blocked control, both versions successfully handled a fresh sphere request and a subsequent alignment to an existing sample's measured top, in the same still-open project, with persistence and Undo/Redo.

The derived verifier used source-traceable calculations for the arc and reflections. Two of three reflection runs calculated and verified their expected positions correctly. One generated three-input additions, while the arithmetic tool accepts binary additions. Those checks became **unverified**; the actual correct model saved with an explicit incomplete-verification notice. This is a verification failure despite correct geometry and a successful commit.

An [offline causal replay](calculation-arity-audit.json) of that recorded reviewer response found:

| Candidate / criteria | External geometry | Host outcome | Commit eligible |
|---|---|---|---|
| Actual result / recorded malformed calculation | Correct | Unverified | Yes |
| Deliberately displaced result / same malformed calculation | Incorrect | Unverified | Yes |
| Actual result / analysis-only binary normalization | Correct | Verified | Yes |
| Displaced result / analysis-only binary normalization | Incorrect | Incorrect | No |

No wrong model was committed in this replay, and no application fix was implemented. The system did not falsely label the malformed case verified, but it could save wrong placement under uncertainty. This limits reliance on it as a correctness gate. [Source values, units, coordinate frame and successful calculations](calculation-provenance.json).

## Confirmed limitations and next priority

1. **Scene references disagree across tools and verification.** Group IDs are treated as names in two blocked roller creations; group shorthand can return no inspection members. Offline replays establish correct solids and the precise reference mismatch.
2. **Some checks express the wrong property.** A room footprint became a demand to fill the interior; a preservation check rejected `1.2` versus `1.2000000000000002` as changed geometry.
3. **Reviewer output is unreliable.** Four calls exhausted 6,000 output tokens in roughly 91–92 seconds. One creation saved with disclosed uncertainty; three edits could not commit. Later identical-fixture edits passed, demonstrating variability.
4. **Calculation grammar can defeat valid mathematical intent.** The reflection arity mismatch leaves important positional requirements unverified.

**Recommend one next improvement: a shared, validated scene-and-measurement contract for inspection and completion verification.** Resolve references consistently, validate generated expectation calculations against their supported grammar, and distinguish invalid criteria from incorrect geometry before asking the agent to repair anything. Preserve independent checks and transaction protection. This targets the observed bottleneck across different geometry types; it is not a request for model-specific recipes. No such application change has been made under this evaluation authorization.

The workshop evidence is limited to small assemblies (four to nine modeled components, plus unrelated samples); the separate verifier/recovery probes also include smaller sets. It does not establish arbitrary architectural correctness, large-model performance, drawing reconstruction, physical-device voice reliability or production Render behavior. The applications ran locally in real Chromium production builds with live OpenAI responses. Some geometric/qualitative properties remain honestly unverified by the host even when the external oracle establishes them.

## Cost and latency

**258 API calls; 3,672,419 input tokens and 207,722 output tokens. Estimated cost: $9.422058.** All calls have returned usage; no unresolved-charge reservations remain in this campaign. Conservative accounted cost is $11.777572. Approximately 90.5% of estimated spending went to workshop cases/diagnostics; the remainder went to the separate verifier comparison and recovery.

Pricing basis: the authorized secondary pricing snapshot lists $2/M input and $10/M output. No prompt-cache discount is assumed. Pre-call reservations used $4/M and $15/M plus 25%; reconciliation retains a 25% margin. These are estimates, **not a verified account invoice**. Earlier Phase 3 accounting remains separate; its $2.055574 estimate was deducted from the available-credit guard rather than reset. No billing auto-recharge setting was enabled or changed, and its pre-existing account setting could not be independently inspected.

Median reviewer-call durations were about 15 seconds for baseline and 19 seconds for workshop; the derived-verifier arm was about 18 seconds. Recorded completed-turn medians were about 62–68 seconds for baseline/workshop, including browser validation overhead. These are descriptive aggregates with differing task mixes, not a controlled latency win for either version. Exact per-case times, calls and usage are preserved in [summary](SUMMARY.json), [ledger](ledger.json), and [boundary records](campaign-boundaries.json).

## Evidence and editable deliverables

- [Download editable project copies](artifacts/editable-models.zip), including matched workbench and promenade results. Open using **Projects → Open project copy**.
- [Detailed batch narrative and archive links](README.md).
- [Frozen prompts, protocol and scoring](PROTOCOL.md); [hash manifest](FREEZE.json).
- [First verifier round](verifier-1-results.json), [second round and recovery](verifier-repeat-results.json) and [third reflection repeat](reflection-repeat-results.json).
- [All scripts and read-only diagnostic replays](../../../scripts/).

The campaign stopped this batch after repeated cases and controlled diagnoses established actionable failure mechanisms. Remaining credits were not spent merely to repeat those same frozen failures. Applications stay frozen for review; merge, deployment and application corrections remain separate decisions.
