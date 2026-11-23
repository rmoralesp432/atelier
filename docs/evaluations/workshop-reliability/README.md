# Workshop reference and verification reliability

Work on isolated `fix/workshop-verification-contract`. No merge or deployment. The previous `f5ba626` workshop and `433d9ba` verifier worktrees remain frozen. Integration commit `d687819` combines their runtime capabilities on top of the preserved campaign branch; subsequent reliability changes are separate and reviewable.

## Confirmed failures before this change

[Offline original replay](offline-before.json) reproduces both saved real-AI failures. A valid five-part hollow roller was rejected because a group ID was compared only with group names. A correct reflection and a copy displaced 40 mm were **both permitted** when a three-operand addition could not be compiled. The calculation error had been downgraded into optional unknown evidence.

## Focused correction

- Modeling, inspection and completion share exact object/group reference resolution: IDs, names and explicit `$name:` / `$group:` references. Ambiguous labels remain unresolved; before/compare inspections use original group membership as appropriate.
- Invalid expected-value calculations retain their required predicate and produce an independent criterion issue **before geometry judgment**. They do not use placeholder coordinates and do not request geometry repair.
- The existing single independent criterion retry can return a corrected expression. A host-side equivalence check permits associative regrouping and acyclic graph reordering while preserving source quantities, units, frame, citations, targets, comparisons and tolerances. An arbitrary arithmetic rewrite is refused. The compiler revalidates the corrected expression.
- Unresolved explicit spatial checks hold the transaction with an explanation. A completely unavailable requirement review cannot save a modeling result. Unsupported qualitative/material-certification goals still allow otherwise safe work with explicit uncertainty.
- Transaction finalization, object identities, history and persistence mechanisms are unchanged.

## Offline evidence

[Unrepaired checks after the fix](offline-after-unrepaired.json) hold both reflection candidates. [Bounded correction replay](offline-corrected.json) independently checks actual solids: correct geometry passes, displaced geometry fails. A separate rotated elliptical solid with mixed meter/centimeter/millimeter sources tests transfer; hostile corrections that alter source values, operations, tolerances or scope are rejected.

Browser results in `browser/` replay saved executor responses through the normal chat, engine, completion verifier, atomic commit and browser persistence. The criterion-correction response is **scripted**. These demonstrate application commits, reload and Undo/Redo, not fresh-AI correction ability. Live results will be published separately after the implementation freeze.

## Retained failures and changes to test expectations

`logs/` retains development failures. Earlier tests expected unavailable reviews/calculations to permit saving; those expectations were intentionally changed to match the requested placement safety rule. Duplicate group names now require an unambiguous ID instead of different subsystems silently choosing different groups. Qualitative unknowns retain a separate positive regression. The first negative browser replay waited for a Dismiss button while the open conversation correctly displayed its error inline; the assertion was corrected to inspect the conversation, with the failed trace preserved. The strict API schema regression also caught an optional correction field before any paid request; it is now required and nullable on the API wire.

## Limits

The independent reader still decides which requirements to cover and must identify unsupported required spatial goals. Passing predicates is not proof of complete natural-language interpretation. Expression-equivalence repair is deliberately bounded: it does not authorize new assumptions or infer alternative arithmetic from the candidate result. Unknown supported spatial requirements may therefore block valid work with an honest explanation. Live behavior and the cost of this stricter rule must be measured on unfamiliar cases.

## Freeze and validation checkpoint

Runtime frozen at **16361bba915d56f1eca224c953b53a30d59bc5c9**. All 457 unit tests passed; production build passed. Nine relevant browser regressions passed (eight in the production suite, the remaining unresolved-criterion reload in an isolated rerun). Correct group and reflection replays committed through the application and survived reload/Undo/Redo. The displaced reflection was rejected; unresolved calculation checks left the saved project unchanged after reload. No geometry-repair call was made for an unresolved calculation alone. Unrelated samples remained intact.

The last reload initially encountered a missing `dist/index.html` because the evaluation process rebuilt the served directory at that moment; its trace is retained under `logs/build-overlap`. A separate earlier rerun shared a test-server lifecycle and failed when its owner stopped the server. Both are recorded infrastructure failures, not application passes. The final isolated production rerun passed without changing application behavior.

Fresh tasks and spending safeguards are in [the live protocol](live/PROTOCOL.md). Their creation happened after the application freeze. No paid calls were made during implementation or offline calibration.
