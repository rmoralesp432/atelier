# Deterministically derived completion measurements

23 November 2026. Offline implementation and validation only. **No new API calls, merge or deployment.** Development branch: `fix/derived-completion-measurements`, based on the preserved Phase 3 evidence at `a80d6ef91a1db50692856e826af487439b885c2c`. Production remains unchanged.

## Confirmed failure and focused correction

The real Phase 3 repair succeeded geometrically but could not commit. The independent reviewer had supplied an explicit coordinate list with two incorrect expected Z coordinates: `±0.366 m` instead of `±0.367000389708486 m`. Their 1.00039 mm difference exceeded the existing 1 mm tolerance. The host faithfully checked the wrong targets. The original failed live result has not been rescored or replaced.

An independent requirement can now include a small, bounded calculation describing how its numeric target follows from the request and original geometry. The host evaluates that calculation, then runs the **existing** geometric predicate. This avoids asking the reviewer to perform trigonometry or round a list of coordinates itself.

The calculation supports cited request/user-history quantities, unitless mathematical constants, pre-edit object measurements, arithmetic, sine/cosine, a finite arithmetic sequence and concatenation. Scalars can broadcast across arrays. Output is either a scalar measurement or a set of world base-center points. This is data, not executable code; there is no `eval`, arbitrary script, modeling template or shape-specific implementation.

Each successful derivation records in the completion report:

- The original source value/unit and verbatim request citation, or exact original object ID and measured property.
- Normalized values in meters/radians (or cubic meters for volume).
- The explicit `world_xyz_y_up` coordinate frame.
- The full calculation and computed expected value/points.

The original-scene measurement path has **no candidate-scene parameter**. Dimensions and anchors come from real world-space solid bounds; volume comes from occupied solid geometry. Stored Y rotation is available as a transform value, not as a recovered arbitrary mesh orientation. A new candidate cannot serve as the source of its own desired dimensions.

Changes are confined to seven runtime files: calculation schema/evaluator, criterion/report schema, criterion wire transport, independent-reader instructions/provenance validation, completion integration and formula immutability during criterion correction. Geometry construction, modeling-agent tools, transaction finalization, persistence, edit-scope inference and Undo/Redo implementations are unchanged.

## Protections retained

- Existing selectors, comparison direction, tolerance, relative tolerance, preservation checks and commit decision remain unchanged. Only expected numeric targets are substituted.
- Existing scalar/layout/radial criteria still work without a calculation.
- Sources cannot cite invented text or assistant claims as user quantities. Original-object measurements are resolved from the pre-edit model.
- Cycles/forward references, invalid unit combinations, division by zero, unavailable original objects, mismatched arrays, nonfinite values and resource exhaustion produce **unverified**, never a guessed target or a fabricated pass. Existing safe-commit and explicit-uncertainty behavior still applies.
- A separate supported measurement failure or unauthorized change still blocks commitment, even if another calculation is unverified.
- A stray calculation on a nonnumeric predicate cannot suppress that predicate: shape, property and preservation checks continue to run unchanged.
- Independent criterion correction cannot rewrite source quantities or arithmetic. The modeling agent cannot override the calculation or the check.
- Limits: 64 nodes/calculation, 4,096 entries/array, 32,768 calculated cells/check, 131,072 cells/pass; finite values limited to magnitude 1e12, followed by the existing predicate's tighter numeric limits.

## Results

| Evidence                                                                | Result                                                                                                                                                                                   |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saved real-AI repaired scene + original literal criteria                | Still blocked: the original failure is reproducible.                                                                                                                                     |
| Same saved scene + derived positions                                    | All 10 positions pass at the unchanged 1 mm tolerance; safe commit permitted.                                                                                                            |
| Saved scene with the 19 cm displaced prism + derived positions          | Incorrect position detected; commit blocked.                                                                                                                                             |
| Frozen external Phase 3 oracle                                          | All 36 checks pass on the repaired scene; displaced scene fails. This oracle was not modified.                                                                                           |
| Saved creation operations replayed through actual staged planner/kernel | 12 total objects, one committed modeling history entry; original objects unchanged; exact persisted reload, Undo and Redo.                                                               |
| Spherical handle relative to a tilted plate                             | Derives position from original world bounds, signed angular displacement and mm/cm quantities; correct geometry passes; 12 mm displacement and collateral plate movement remain blocked. |
| Signed offset checks on differently rotated box/cylinder components     | Positive and negative changes pass in both comparison directions; 10 mm errors fail at the existing 0.1 mm tolerance.                                                                    |
| Actual Chromium App, scripted offline providers                         | Wrong sphere placement blocked, feedback repair commits once, contextual size/position edit preserves identity and neighbors, reload and two Undo/Redo steps reproduce exact projects.   |
| Existing Chromium regressions                                           | Failure recovery after reload, honest unverified commits, criterion correction, and 244-component edits under selection changes/concurrent edits pass.                                   |

The saved hexagonal geometry's existing unsupported shape classifier remains **unverified**, with explicit disclosure. This change does not claim to have added a hexagonal-shape classifier. Its positions are verified, the external shape oracle passes, and the host's existing safe-commit rule permits the result.

**Validation:** **446/446** offline unit/kernel tests across 81 files, successful production build, and **8/8** focused browser regressions. Independent solid measurements of the browser's sphere give zero base-center position error at both stages, radial vertex error below 0.000001 m, and approximately 1.001% tessellation volume error within the existing 2% allowance. Exact logs and measurements are in `evidence/`. Both strict provider transports (`responses` and `chat_completions`) are tested using an offline SDK mock, including schema validity and source provenance.

Reproduction:

```sh
npm test
npm run build
npx playwright test tests/derived-completion.spec.ts tests/criteria-contracts.spec.ts tests/completion-verification.spec.ts tests/transaction-commit.spec.ts
node --import tsx scripts/validate-derived-completion.ts
```

Evidence:

- [Saved repair, original criteria, source hashes, calculation traces and external measurements](evidence/saved-repair.json).
- [Replayed editable project](evidence/replayed.atelier.json).
- [Browser transactions and rejected-candidate feedback](evidence/browser.json).
- [Independent measurements of the browser's created and edited solids](evidence/browser-measurements.json).
- [Unit tests](evidence/unit.log), [build](evidence/build.log), [browser tests](evidence/browser.log), [replay](evidence/replay.log).

## Development failures retained

The first new-test run had three test/fixture failures: exact equality incorrectly included a 1.1e-16 m residual on the intentionally repaired object; a tilted plate fixture would penetrate the ground; a criterion-revision rejection was asserted as a return rather than an exception. The assertions now require exact identity/metadata and exact unaffected objects, floating-point agreement only for the repaired object's position, an initially elevated plate, and the expected rejection. Application geometric tolerances were not changed. A test-table TypeScript inference error was corrected with an explicit callback type.

The first standalone transaction replay used Node deep equality on absent versus `undefined` optional fields (`component`). The evidence script now compares the exact JSON-persisted values, with no numeric rounding or geometry-field removal. This matches serialization semantics; it did not require an application change. Both the failed attempts and corrections are described here rather than relabeled as successful initial runs.

## Limits and freeze

These are **offline** results on real solids and the actual application. The new independent calculations were authored explicitly for regression validation. The saved geometry/operations originated in real AI evaluation, but no fresh AI interpretation was purchased or claimed. We still need a separately authorized live evaluation to establish whether the reviewer reliably chooses the new format and interprets unfamiliar relationships correctly.

The host proves the arithmetic, units and measurements, not the semantic truth of every interpretation. Wrong source selection or an incorrectly expressed relationship remains possible. This does not solve edit-scope inference, reference reconstruction, every shape classifier, arbitrary curved-surface measurement or natural-language ambiguity. Unsupported calculations remain unverified. Calculation traces accompany task-local completion reports; no new permanent in-app audit-log interface was added.

The implementation is frozen in the commit recorded by `FREEZE.json` before any fresh held-out tasks are defined. Future tasks and their independent expectations must be kept separate from application code. No further implementation or paid evaluation is part of this checkpoint.
