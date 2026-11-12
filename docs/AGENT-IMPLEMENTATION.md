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
