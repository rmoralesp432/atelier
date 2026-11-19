# PR #22 — correcting false rejections without weakening verification

Implemented against the saved November 18 live evaluation. **No additional API calls, merge or deployment.** This change repairs the completion mechanism, not the modeling agent or its geometry tools.

## What the evidence showed

The saved live run produced valid geometry but treated unsupported checks as failed geometry. The agent kept trying to repair a model that could never satisfy those checks. It also rejected equivalent meshes and local-axis representations by comparing storage conventions rather than physical geometry.

The three independent reviews took **47.813, 42.290 and 55.610 seconds**. They consumed 2,816, 3,355 and 6,000 output tokens respectively. The plate review exhausted its output allowance and returned no completed criteria. The old trace did not retain the raw incomplete response or the reasoning-token breakdown, so it cannot establish how much of that allowance was reasoning versus emitted JSON. High reasoning and verbose, repeated structured output were both unnecessary costs for extracting ordinary measurable requirements. Local host verification took roughly 12.6 ms combined for the two saved scenes with criteria; it was not the dominant delay.

The original evidence is preserved at [evaluation commit e9ec973](https://github.com/rmoralesp432/atelier/tree/e9ec973/docs/evaluations/2026-11-18-completion-live-2usd). The reduced regression fixture, `tests/fixtures/completion-live.json`, contains the original projects, actual saved provisional projects and actual independent criteria from that run. It does not contain newly generated AI answers.

## Three explicit outcomes

| Outcome    | Meaning                                                                                                              | Application behavior                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Verified   | All supplied measurable checks passed, with no remaining unsupported checks or qualitative caveats.                  | Commit the existing transaction and report measured evidence.                                                                                                |
| Incorrect  | At least one available measurement proves a requirement is unmet or unrelated geometry changed.                      | Send only those specific failures to the agent for bounded repair; remeasure the candidate.                                                                  |
| Unverified | A check is unsupported, cannot be evaluated, has an unresolved selector, or the independent reader could not finish. | Do not ask the modeler to repair geometry merely because evidence is unavailable. Apply safe work with an explicit incomplete-verification message and Undo. |

Unknown is never silently promoted to verified. If the independent reader cannot establish which original objects may change, the application preserves the original project instead of committing edits to those objects. Safe additions can still be applied as explicitly unverified. A known authorization scope with an unsupported shape or qualitative check does not veto otherwise safe work.

Known failures take precedence over unknown checks. After the agent repairs the measured failure, any remaining uncertainty is reported once; it does not restart a modeling loop. A failed turn's criteria remain local to that turn. Existing transaction isolation, component identities, destructive-operation protection and single-step Undo/Redo remain in place.

## General measurement capabilities

- **Spatial arrangements:** unordered one-to-one point-set matching, including nonplanar sets; grids and radial arrangements use the same matcher. Missing and misplaced objects are distinguishable. Names and creation order are irrelevant to spatial matching.
- **Physical dimensions and positions:** actual world solid bounds, rather than stored local width/depth or a geometry recipe label.
- **Equivalent representations:** compare occupied solids for box, cylinder and sphere shape checks. Equivalent baked meshes and swapped local axes pass. A generic representation that cannot be classified confidently remains unverified instead of being labeled incorrect.
- **Relationships:** solid intersection, containment, disjointness, contact and separation with each/all/any quantifiers. Contact is measured against actual surfaces; overlapping bounding boxes do not establish contact.
- **Voids and occupied regions:** empty/filled spatial-region checks against evaluated solids, independent of whether a Boolean cutter still exists. Overlapping pieces do not double-count occupied material.
- **Grouping and editability:** exact named-group membership and distinct unlocked scene objects. Preservation also detects unrelated group name, visibility and lock changes.

These are reusable predicates, not display-stand, peg, furniture or building generators. Production code contains no solution to the saved tasks. Existing measurement and preservation predicates remain available; errors from those predicates now become unknown evidence rather than false geometric failures.

## Less AI review, more measured evidence

The modeling agent retains its existing reasoning depth, tools and inspection/repair loop. The independent reader stays focused on request interpretation, with less reasoning and output overhead:

1. Read the user's request and original scene; candidate information remains limited to identities/classification, not measured dimensions or success claims.
2. Return compact predicates with shared selectors and citations. The host generates labels and IDs.
3. Cache that interpretation for the turn. All subsequent verification and repair rechecks use deterministic geometry measurements, without another reader call.

Text-only interpretation uses low reasoning effort. Image/reference interpretation keeps higher effort. The output allowance is **not increased**. Incomplete responses produce a typed unknown outcome once, with completion reason, latency, total output tokens and available reasoning-token counts logged for future diagnosis.

For the two saved criteria sets, the compact format is **29% and 31% smaller in serialized bytes**, preserving the same predicates and provenance. This is a representation-size measurement, not a measured token, latency or cost reduction. New real-AI timing and requirement coverage remain untested.

### Why retain an independent interpretation call?

A separate deep AI judgment of the completed scene is unnecessary for requirements that deterministic tools can measure; this patch does not add one. However, skipping independent interpretation for arbitrary natural language would let the executing agent define its own success criteria and omit requirements it overlooked—the original problem PR #22 addresses.

This patch therefore retains **one lightweight independent interpretation call for agent-driven natural-language completion**, including simple requests, rather than introducing an unreliable keyword router or a second self-grading workflow. Manual modeling still needs no such call. If future live evidence shows interpretation remains expensive, that is a reason to test a smaller reader model or earlier parallel extraction, not to bypass coverage without evidence.

## Regression evidence

Offline tests use the real geometry kernel and saved real-AI geometry. Provider responses and browser agent continuations are explicitly mocked; they are not new live-reasoning evidence.

| Check                     | Evidence                                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Saved ring and stand      | Original unsupported criteria yield unverified, with no false incorrect checks. Test-authored contracts using the new general predicates verify the recorded solids.                                               |
| Representation invariance | Both saved scenes retain their results after baking geometry into meshes and swapping local axes with an equivalent rotation.                                                                                      |
| Unfamiliar arrangement    | Eleven spherical solids at a different radius, center and phase; wrong position and a missing object are detected. A nonplanar point set and a duplicated position are also checked.                               |
| Relationships and voids   | Different-size solids test real contact, separation and a Boolean opening. A solid sitting within a cavity does not falsely satisfy contact just because bounds overlap.                                           |
| Grouping/editability      | Different sphere/cylinder assemblies test group membership, locked groups and unrelated group metadata preservation.                                                                                               |
| Uncertainty boundaries    | A differently oriented internal mesh frame, qualitative caveat, unresolved original selector and interrupted reader remain unverified. Unknown scope cannot authorize edits to existing objects.                   |
| Repair                    | A missing-part measurement is repaired while an unrelated unsupported aesthetic check is left alone. Existing identities are retained; one transaction is committed with honest uncertainty and working Undo/Redo. |
| Browser continuity        | Independent repair, failed-request/reload/new-request recovery, and an unverified creation followed by a separately verified edit exercise the application state, persistence and Undo/Redo.                       |

Validation: **369 unit tests passed**; the **9 targeted production-browser tests passed**, including the 244-component floor-height edit, private provisional modeling, Stop/rollback, camera/solar controls, minimized-orb voice flow, independent correction and failure recovery. Production build and TypeScript checks passed. Provider and browser transports are offline mocks; these totals are software/geometry regression evidence, not a new live-AI success rate.

## Limits and recommendation

- The new AI schema and lower reasoning effort still need a held-out live evaluation. The saved replay proves the geometry checker can support these requirements; it does **not** prove the AI will always choose the correct new predicates or interpret every request fully.
- Shape equivalence currently proves canonical box/cylinder/sphere fits, with a 2% tessellation allowance for curved reference solids and a tighter box tolerance. Arbitrarily oriented internal meshes that do not fit remain unknown. This is not universal shape recognition.
- Dimensions are world-axis bounds. Editability means distinct unlocked scene objects, not guaranteed internal face/parametric editing. No new visual similarity or drawing-reconstruction claims are made.
- Pair and scene-size bounds prevent unbounded local work. A check exceeding available capacity becomes unknown, not a request to distort the model.
- Correct interpretation is still necessary: a wrong numeric requirement can produce a wrong verification decision. Structured citations and independent extraction reduce that risk but do not eliminate it.

**Keep PR #22 undeployed.** The confirmed false-rejection mechanism is fixed and covered offline. The next production decision should follow an explicitly authorized real-AI evaluation of unfamiliar creation, modification, omission repair, equivalent geometry and uncertain requirements, measuring actual accepted results, preservation, Undo, latency and cost. No additional credit authorization is assumed from the user's available balance or its expiry date.
