# Fresh tasks defined after the implementation freeze

Defined after implementation commit `433d9baed8265cc4eb78a5b0bfb914911b734cf7` and its `FREEZE.json` record. **Not executed, not a claimed pass, no paid evaluation authorized by this document.** These tasks were not used to develop the calculator or its regression fixtures. The published Phase 3 sign-frame, shelving and duct ideas remain reserved ideas; none is reused here.

A later evaluation must first instantiate and independently calibrate the starting projects/oracles, freeze those artifacts and spending safeguards, and obtain paid-execution authorization. Do not modify application behavior against these tasks. If implementation changes, retire their held-out status and define new tasks after the new freeze.

## D-H1 — rising circular sequence

User prompt:

> Create six separate upright cylindrical samples, each 14 cm in diameter and 48 cm tall. In plan, their centers follow a 120-degree circular arc of radius 1.7 m around X = -0.9 m, Z = 1.3 m. The first center is at 37 degrees from +X toward +Z; proceed toward decreasing angles, including both ends of the arc, with equal angular spacing. The first base is at 0.6 m and each successive base is 11 cm higher. Keep every sample independently editable and preserve the existing reference objects.

Starting project: the already-validated independent reference objects from the Phase 3 seed, with no samples present. This is a creation test.

External expected measurements, in world XYZ with Y up:

- For indices `i = 0…5`, `θᵢ = (37 − 120i/5)π/180`.
- Base centers: `xᵢ = −0.9 + 1.7 cos θᵢ`, `yᵢ = 0.6 + 0.11i`, `zᵢ = 1.3 + 1.7 sin θᵢ`.
- Six distinct valid solids, circular diameter 0.14 m, height 0.48 m; no overlap or lost references; independent editable IDs.
- Position/dimension tolerance 0.001 m, existing round-shape tessellation allowances retained. Exact preservation of unrelated objects/groups and exact persisted Undo/Redo.

This tests angular interpolation, signed rotation, unit conversion and a changing vertical datum in one relationship. Accept equivalent geometry recipes and any object ordering; do not require the new calculation format if an existing deterministic predicate genuinely establishes the same requirements. Record whether the independent reviewer supplies calculations, literal coordinates, another sufficient predicate, or an honest unsupported result.

Optional controlled repair diagnostic, reported separately from the ordinary creation outcome: only after the external oracle proves the private candidate correct, move one sample 0.04 m radially outward before completion measurement. The host must block it; the agent must restore a correct arrangement without changing unrelated objects or identities. Never inject a fault into an already incorrect candidate or silently replace an ordinary failure with this diagnostic.

## D-H2 — reflect an arrangement without reflecting its pieces

Validated starting model to prepare after approval: three independently editable pieces in one named group, plus protected reference objects. Use a non-square box, an upright elliptical cylinder, and a triangular prism, with differing sizes, Y levels and rotations. The fixture must have distinct non-collinear actual world base centers, all above ground. Record actual kernel bounds before execution, rather than assuming an asymmetric prism's recipe origin is its bounding center.

User prompt:

> Move the three pieces in “Display pieces” into the mirror image of their current plan arrangement across the line passing through X = 1.1 m, Z = -0.8 m at 34 degrees from +X toward +Z. Reflect their positions only: keep each piece’s height above ground, size, shape and facing direction unchanged. Move the existing pieces rather than duplicating them, and leave the reference objects untouched.

Independent expectations use **pre-edit actual bounds**, never the candidate:

- Let `c = (1.1, −0.8)`, `t = (cos 34°, sin 34°)`, and each original world bounding-center in plan be `p`.
- Expected center: `p′ = c + 2t[t·(p−c)] − (p−c)`; original base Y is unchanged.
- Every original piece ID survives. No additions/removals. Within 0.001 m, each actual final center matches its own reflected target.
- After translating each final solid back by its expected displacement, occupied geometry must match its original; all sizes, orientations, properties, grouping and unrelated objects remain unchanged. This must not be replaced by an envelope-only shape comparison.
- Commit once, reload, Undo and Redo must preserve exact persisted project states.

This is explicitly a **seeded contextual-edit diagnostic**, not an end-to-end creation success. It tests relational interpretation, pre-edit source binding, orientation-versus-position distinctions and preservation across different shapes. Distinguish an edit-scope failure, modeling-tool failure, arithmetic failure, unsupported verifier capability and transaction failure in the results.

## Scoring both tasks

Keep actual scene geometry and external measurements separate from the application's claims. Record verified/incorrect/unverified outcomes, false rejection/acceptance, any repair attempts, original identities, unintended edits, commit/reload/history results, reviewer response size/latency and spending. A correct external outcome with an honestly unverified host requirement is not a fully verified host success. A measured incorrect result must never be counted as successful merely because tools ran or a transaction committed.
