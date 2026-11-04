# Volumetric intelligence update

This extends the existing real model integration and checked execution engine. It does not add a keyword parser, scripted building responses, or a separate voice modeling path. Text and the Realtime voice design tool use the same schema, contextual scene and transaction checks.

## New executable capabilities

| Capability                      | Geometry and editing behavior                                                                                                                                                                                                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile solids and replacements | Extrude rectangular, elliptical, I-section or arbitrary polygon profiles along local X/Y/Z. Replace multiple members while preserving their identities, positions, yaw, names, groups and roles. Preserve each member's envelope with `dimensions:null`. Explicit web/flange thicknesses are required for I-sections. |
| Circular/elliptical openings    | Rebuild the latest retained wall cutter as a rectangle or ellipse. Earlier cuts remain. Width/height edits operate on this actual subtraction, including after outer transformations.                                                                                                                                 |
| Fitted glazing                  | Create independent thin panes and genuine annular frame solids fitted to the latest opening. Shape/size edits regenerate these linked pieces without changing IDs. Older opening systems in the same wall remain untouched. Geometry is checked against the actual wall, including rotated/nonuniformly scaled walls. |
| Revolved forms                  | Revolve a closed radial-height section through 1–360°. This supports radial shells, rings, dome meridians and oculi. The result is a Manifold solid, with its editable profile retained. Curves use bounded tessellation.                                                                                             |
| Explicit level schedules        | Split a mass with actual horizontal solid intersections, retaining voids. Each level has its own height, offset, yaw and footprint scale. Heights must total the existing height. Resulting level masses are independently editable; they are not automatically detailed floors.                                      |
| Progressive arrays              | Repeat a solid with cumulative dimensional factors, yaw and world translation. Count includes the source. A normalized local anchor can preserve a corner or face reference.                                                                                                                                          |
| Constrained resizing            | Change a dimension around a fixed local anchor, optionally preserving actual solid volume by compensating the other two axes. This deliberately scales internal geometry; it does not claim to preserve wall thickness or window sizes simultaneously.                                                                |
| Connections                     | Create a straight bridge between center-facing envelope boundaries at a specified elevation. Both landings must intersect actual solids. It is not a structural calculation or an automatic live relationship.                                                                                                        |
| Relationship verification       | Check actual shared solid volume for disjointness, intersection or first-object containment. Failed assertions roll back the entire proposal. Boundary contact and metric clearance are different concepts.                                                                                                           |

Construction context now includes retained cutter/source dimensions, transforms and profile definitions, bounded to avoid sending large imported triangle arrays. Opening-system metadata persists in project exports and history. Existing `assembly`, scoped component queries, sweeps, lofts, Booleans, extrusion, host relationships, numeric verification and named alternatives remain available.

## Interpreting design intent

The shared model instructions now explicitly distinguish:

- Floor-to-floor versus clear height; two tall stories versus one double-height space.
- Grid lines versus bays and center spacing versus clear spacing.
- Radius versus diameter; local member axes versus world/camera axes.
- Envelope preservation versus equal steel area or structural capacity.
- A window component versus the hole in its host wall.
- Shape replacement versus a resize that must retain existing cuts.
- Documented dimensions from plans/sections versus assumptions and invisible details.

These instructions improve the available reasoning contract, but are not evidence that every phrasing will be understood. No live model, image-interpretation or voice-audio calls were made for this update, at the user's request.

## Coverage of the attached requirements

| Requirements                                                       | Available approach and practical boundary                                                                                                                                                    |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1, 5–8: Booleans, atria, passages, voids                           | Existing true pairwise CSG can be composed in checked stages. New level splits retain voids. A cut must intersect and leave a valid solid.                                                   |
| 2–4, 11, 14: levels, cantilevers, tapering, progressive repetition | Explicit slices, offsets, anchored resizing and cumulative arrays. Level masses and component slabs are distinct.                                                                            |
| 9–10, 12: changing profiles, bending, undulation                   | Existing lofts/sweeps plus radial profiles. Loft rings need matching vertices/winding. This does not provide arbitrary face/vertex deformation of an existing building.                      |
| 13, 15–16, 19: radial systems, branching, interlocking and bridges | Existing polar/group arrays, oriented solids and Booleans plus checked bridges and generic profile members.                                                                                  |
| 17–18, 27: constraints and alignment                               | Explicit anchored transformations, evaluated-volume preservation, existing alignment, numeric assertions and locked groups. This is not a general constraint solver.                         |
| 20: organic smoothing                                              | Loft/sweep/revolve alternatives are available. Arbitrary smooth blending while simultaneously preserving all voids, volume and bounds is not implemented.                                    |
| 21, 24, 26, 28: conversation and multistep refinement              | Real model integration, selected/focused IDs, camera directions, design notes and privately executed stages. Live understanding remains unverified in this update.                           |
| 22–23: transfer and dependent updates                              | Explicit profile definitions can be reused; host movement and opening systems have bounded relationships. Arbitrary curvature extraction and a general dependency graph are not implemented. |
| 25, 30: history and alternatives                                   | Atomic request-level undo/redo, retained source operands and named design alternatives. General selective undo that preserves arbitrary later operations is not implemented.                 |
| 29: collision validation                                           | Real solid-volume assertions and bridge landing checks. No general collision-free motion planner or exact clearance solver.                                                                  |

Arbitrary face/edge/vertex selections, unrestricted NURBS, BIM recognition in imported triangle soups, engineering certification and unlimited scene size remain outside the supported engine. The scene still has a 200-object limit; staged requests have a five-stage/64-operation budget. No import limits were lowered in this update.

## Verification

`src/intelligence/volumetric.test.ts` checks analytic section volumes on all three axes, same-ID member replacement, hexagonal sections, invalid-section rollback, radial shells/oculi, transformed openings, fitted glazing, earlier-window preservation, unequal floor schedules with atria, locked/hosted constraints, constant-volume shell resizing, anchored progressive arrays, genuine bridge contacts and transactional collision checks.

`tests/volumetric-intelligence.spec.ts` runs the actual built browser app and geometry engine with explicitly labeled provider fixtures. It checks staged construction, rendering, save/reload and Undo. Existing staged-planning/reference-attachment and architectural-review browser tests are also run. These tests verify execution and integration, not unrestricted AI comprehension or a physical microphone.

Local results: **241 tests across 58 unit/integration files passed**, including 19 new volumetric tests. **Seven distinct browser scenarios passed** across the new volumetric, staged-intelligence, architectural-review and solar suites (nine executions, including a final production-build rerun). TypeScript and the Vite production build passed. Screenshot inspection also caught noisy floating-point dimension labels; display labels now use the existing millimeter rounding without changing stored geometry.

The optional real-language evaluation remains separate from automated tests. `npm run test:live-architecture` prepares reference images without model calls; `-- --live` explicitly opts into paid live evaluation. It must not be presented as having passed until actually run with a working API account.

## Release

The user explicitly authorized publishing this update and the earlier architectural-intelligence sprint on 2026-11-04. Keep the existing Render service and browser origin. Its deployed branch is `feat/phase2-conversational-modeling`; merge the reviewed sprint there and trigger a manual deploy of the exact tested commit. No secrets, hosting tier or billing settings need changing.
