# Coordinated architectural editing

## Failure and cause

A synthetic three-storey building contains 244 editable parts: 3 slabs, a roof, and 80 columns/glazing/frame members per storey. A separate neighboring component deliberately shares architectural labels. This reproducer is comparable to the reported project; the user's original project and exact model transcript were not supplied.

Before the change, individual moves in 32-operation stages hit the reported 64-operation transaction error on the third request. The original session remained intact. The failure was in orchestration, not an inability to render 244 parts. Common bulk move/resize already existed, but there was no compact, coordinated way to apply different transforms to related sets. Each individual update also repeatedly scanned the scene. Budget exhaustion bypassed geometry-repair feedback, and the agent did not receive the remaining operation allowance.

Role/level/host metadata is useful but is not a building-level constraint solver. Host following was decided from a child's unchanged position: a child explicitly resized at its existing base could still receive an unwanted proportional displacement from its resized host.

## Smallest scoped correction

- Add `edit_components`: at most 32 disjoint sets of existing components, selected within explicit scope by role, level, material, dimensions or elevation. Shared anchored resize and world translation are applied against one starting scene. No per-building recipe or language recognizer is added.
- Preserve component IDs, metadata and geometry recipes. Reuse individual-edit rules for procedural building/hollow geometry. Explicit child transforms take precedence; other hosted descendants follow once. Existing dimensions, positive-solid, locked-group and workspace validation still apply.
- Use indexed lookups and a single application pass instead of patching the whole scene for every affected object. Validate actual resulting solids before committing.
- Expose remaining operations. An overflow discards the whole private proposal and lets the agent replan from the unchanged original. It shares the existing three-repair allowance; executed steps still consume the existing 12-step allowance. The 64-operation transaction and 4,096-component workspace limits are unchanged.
- Clear the discarded browser preview on restart. Commit a completed conversation as one Undo step. Failed or stopped work never replaces the saved project.

No entrance, stair, circulation, UI redesign, or other unrelated feature is included.

## Regression evidence

The 3.5 → 4.5 m ground-floor change uses two edit sets within one operation: 48 ground-floor vertical members grow by 1 m, and 179 upper or top-aligned members rise by 1 m. The ground slab, 16 sill members, and unrelated neighbor remain unchanged. All 244 building identities survive. Upper-storey heights, slab thicknesses, glass thicknesses, frame cross sections, roles, hosts, and levels are checked individually.

Engine tests also cover a rotated building with a raised base, a height reduction, invalid late edits, missing references, overlapping/empty selectors, locked targets and descendants, bounded repeated budget failure, serialization, Undo/Redo, and the existing 4,096-object capacity. The reproduced verbose proposal is intentionally sent through the budget limit and then recovered using the original scene.

`tests/storey-edit.spec.ts` exercises the real browser UI, project import, rendered agent observations, private preview, saved-state commit, every component's resulting coordinates and dimensions, a later failed multistage edit, Undo/Redo and reload. Its provider is scripted; this proves the execution/transaction path, not natural-language understanding.

Local engine timings (Node 24, this development host, including validation; not an iPhone benchmark):

| Components     | First run | Subsequent runs | Operations |
| -------------- | --------- | --------------- | ---------- |
| 244 + neighbor | 97.79 ms  | 16.51–31.25 ms  | 1          |
| 4,096          | 299.47 ms | 93.45–250.04 ms | 1          |

## Live-agent check

A real `gpt-6.1-sol` evaluation passed using the requested natural-language floor-height change, randomized object IDs, the actual browser scene and rendered observations. The AI chose five scoped edit sets inside **one geometry edit**, followed by verification. It used 40 operations overall, below the unchanged 64-operation limit, and completed without asking a question. Independent comparison found **zero geometry/identity mismatches across all 245 components**, with one Undo entry.

Three paid responses cost an estimated **$0.664036** in total (the prior evaluation ledger plus this check is approximately **$3.473486**, below the previously authorized $4 ceiling). A conservative reservation guard initially stopped before the final response. The two already-paid proposals were replayed unchanged and only the completion response was purchased; no model answer was replaced with a handwritten edit. See `live-result.json` for the actual AI-chosen edit and completion. This is one live case, not proof that every architectural modification will work.

Local validation: all 343 logic tests passed, as did the production build, formatting and browser storey-edit regression. The PR's full required CI gate covers the final source before publication. One existing construction-animation check exposed a timing race on a slow CI renderer; it now samples the same rendered phases with the existing animation-clock helper. Assertions and application animation behavior are unchanged, and the targeted browser check passed.

## Limits

This fixes coordinated edits and recovery, not full BIM constraints. The agent must still identify which members stretch, translate or remain fixed from the actual scene. Arbitrarily remeshing a complex stair, changing an opening system's topology, or rerouting a structural system may need other geometry tools. No reconstruction or replacement of existing parts is used for this regression.
