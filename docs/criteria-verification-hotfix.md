# Completion-criteria production hotfix

Status: implementation and evaluation in progress; **not authorized for deployment**.

## Incident and confirmed cause

The supplied screenshot reports a correctly stacked 12 × 10 m office model, slab bases 0, 3.5 and 7 m, roof base 10.5 m, 250 mm slabs and 400 mm circular columns. The executing agent said it could not satisfy two independent checks without contradicting the intended model. No transaction committed.

The deployed verifier evaluates offset as **second anchor minus first anchor**, in world coordinates. Its reviewer guidance did not explicitly state the subtraction direction. It accepted contradictory numeric checks without a consistency audit, then sent them to the modeling agent as geometric failures. Separately, `material` stores only `solid`, `glass` or `frame`, but its verification predicate accepted arbitrary strings such as `concrete`. Comparing those incompatible representations always failed. Naming or coloring an object did not assign a physical material.

The causal failure is reproduced against deployed commit `acf5ed9ccdb298d2853d139ce5cdf0fc35e24c36`. The fixture uses the supplied prompt/screenshot, not a recovered raw production provider trace. It isolates the offending slab and material checks rather than pretending to recover every generated component.

## Focused correction

- Signed offset contracts now specify the world axis, both bound anchors and subtraction direction. An independent mathematical audit checks expected-coordinate intervals, dimensions and relative equations for contradictions **before** treating their failures as evidence of wrong geometry. Candidate measurements never supply desired values. Absolute checks are not invalidated merely because a relative check is wrong.
- Invalid criteria remain explicitly **unverified**, distinct from supported measured failures. Other valid failures continue to block the transaction. Unknown edit authorization still prevents changes to existing objects.
- At most one additional independent reader call may patch proven-invalid checks. It receives the original request, retained criteria, mathematical diagnostics and measured observations. The host preserves citations, unaffected checks and edit scope. It rejects dropped requirements, tolerance inflation, unauthorized targets and unsupported offset corrections. The modeling agent cannot override failed checks.
- `materialSpec` stores an explicit material designation separately from rendering appearance. The existing material operation can assign it. It persists and participates in Undo/Redo and preservation checks. Its verification establishes declared design metadata, **not physical composition, engineering performance or certification**. Names and colors never establish this property.
- Existing transaction finalization, geometry operations, object identities, editability and Undo/Redo remain in place. No architectural template or new modeling workflow was introduced.

## Validation plan

The regression set covers the reported incident, positive/negative offsets on three axes, reversed directions, rotated solids and distinct min/center/max datums, contradictory equation cycles and absolute datums, material metadata versus unsupported representations, actual incorrect geometry, bounded review failures, attempts to weaken valid checks, and browser commit/reload/Undo/Redo. Existing recovery and unrelated-object preservation tests remain required.

The complete regression suite and CI browser shards will run before this branch is recommended for review. A single unfamiliar POM offset-gauge assembly will exercise real GPT-6.1-sol, the actual browser/engine, independent solid measurements and persistence. A separate read-only, explicitly labeled fault injection on that same scene will test whether real independent reasoning repairs malformed direction/material checks. It will not alter the original AI responses or generated geometry.

New paid evaluation is capped at **US$2**, at most eight calls, using the existing pre-call reservations, higher-rate bounds and usage margins. Unknown usage stops further calls. Earlier release ledgers are untouched. No merge, deployment or additional milestone is authorized by this hotfix task.

## Scope of the consistency audit

The audit proves contradictions expressible as intervals/differences between resolved world-bound anchors, and checks representable property types. It does not claim to prove every natural-language statement equivalent to a predicate, solve arbitrary nonlinear constraints, or infer physical material properties. An unresolved criterion is disclosed as such; a consistent but genuinely failed geometric requirement is never pardoned.
