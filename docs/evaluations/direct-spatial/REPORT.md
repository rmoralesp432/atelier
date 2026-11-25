# Direct checks for preserved spatial relationships — offline iteration

Date: November 25, 2026. Branch: `fix/direct-spatial-verification`.

Implementation frozen at **711a8cff9eb54a4c5254e5c20187b7b2614020da**. [Application diff](implementation.diff); [complete source/test patch](review.patch); [proposed fresh-AI comparison](FRESH-AI-PROTOCOL.md).

`05277619f6fa337cdb1bfb0825654cbe5259ed2d` remains unchanged. This branch starts from evidence commit `b8358ed`; its starting application source is identical to `0527761`. No paid calls, merge or deployment occurred. Production was not changed.

## Finding and focused change

Both saved edits made correct geometry. Their independently generated coordinate calculations failed unit validation: shelf `check-7` (board positions) and conveyor `check-9` (leg positions) combine incompatible units. The saved correction attempts do not satisfy the existing host proof of equivalence. The old criteria still hold these transactions unsaved; they are not silently relabeled successful.

The requested relationships can be expressed more directly:

| Requested fact                                                               | Independent expected source                                        | Check retained or added                                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Shelving 90 cm wider, symmetrically; equal bays                              | Original upright bounds plus the cited 90 cm change                | Existing calculated upright `positions` and board `measure`                       |
| Shelves stay fitted to their original bays                                   | Each original board edge and its original neighboring upright face | New `preserve_offsets`, once per X edge                                           |
| Upright dimensions, shelf depth/height/elevations unchanged                  | Original component fields                                          | Existing `preserve`, plus box shape                                               |
| Conveyor 30 cm wider with unchanged centerline, roller diameter/pitch/height | Original roller dimensions plus cited 30 cm; original placements   | Existing dimension calculation, diameter and preservation checks                  |
| Roller ends retain their relationship with rails                             | Original roller Z ends and matching rail inner faces               | New `preserve_offsets`, once per Z end; existing actual-solid `touching` retained |
| Legs follow their original rails                                             | Original leg and rail Z centers                                    | New `preserve_offsets`; existing actual-solid `touching` retained                 |
| Component identities and unrelated work retained                             | Original IDs, groups and properties                                | Existing identity and transaction/scope protection                                |

`preserve_offsets` is one reusable predicate, not a shelf or conveyor workflow. Each original first object is paired to the unique nearest distinct original second object by the distance between selected world-bounds anchor points. The other two coordinates use bounding centers. The same IDs are measured after editing. Expected signed offsets are **original second anchor minus original first anchor**. Candidate geometry never supplies the expected value or changes the pairing.

Ambiguous or missing original matches remain **unverified and unsaved**. Removal/replacement of an established partner is **incorrect**. The predicate checks a world-axis bounds relationship, not physical contact; existing solid-contact checks remain separate. Existing tolerances, arithmetic validation, bounded criterion correction, edit scope, transaction protection and Undo behavior are unchanged.

The report records metres, world XYZ/Y-up frame, chosen anchors, original source values, subtraction, paired IDs, actual offsets, pair count and maximum error. Response samples are bounded to 16 pairs (failures first); every bound pair is evaluated. Matching is bounded to 4,096 original pair comparisons, consistent with the existing relationship limit.

The independent reviewer's general capability instructions now describe when to select direct relationship/preservation predicates instead of constructing long point arrays. No automatic conversion of failed position checks or override by the modeling agent was added.

## What the browser replay proves

These are **offline saved-response replays**, not new AI reasoning. Shelf and conveyor use their saved executor responses with **scripted initial reviewer criterion selection** in `tests/fixtures/direct-spatial/directCriteria.ts`. All other original criteria, citations, authorized IDs and tolerances are retained. The sculpture uses both the original executor and original reviewer responses unchanged, across two conversational turns in one project.

All requests go through the ordinary visible conversation, provisional modeling, independent host verification and application commit. There is no injection of a finished candidate into storage. Only the starting saved project is loaded. Provider routes are intercepted; remote and unmocked API traffic is blocked. Successful results are measured again from the actual saved browser session using the existing separate solid oracle.

| Browser case                                                                       | Outcome                                                   | Saved components and measurements                                                                                                    |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [Shelf correct edit](browser-run-1/shelf/result.json)                              | Committed; reload, Undo, reload while undone, Redo passed | 31 editable assembly parts + 2 unrelated; 30 changed, central upright + unrelated pair preserved; 102 external facts passed          |
| [Shelf shifted 20 mm](browser-run-1/shelf-displaced/result.json)                   | Blocked by both bay-offset checks                         | Original geometry/history/groups survived reload; tolerance remained 1 mm                                                            |
| [Shelf original criteria](browser-run-1/shelf-original-criteria/result.json)       | Still blocked as unverified, as expected                  | Incompatible units; one saved reviewer correction attempt; no geometry-repair instruction; original project preserved                |
| [Conveyor correct edit](browser-run-1/conveyor/result.json)                        | Committed; reload, Undo, reload while undone, Redo passed | 34 editable assembly parts changed; 2 unrelated preserved; 110 external facts passed                                                 |
| [Conveyor leg shifted 20 mm](browser-run-1/conveyor-displaced/result.json)         | Blocked by leg-to-original-rail offset                    | The leg still passes solid contact, demonstrating why contact alone is insufficient; same 1 mm tolerance; original project preserved |
| [Conveyor original criteria](browser-run-1/conveyor-original-criteria/result.json) | Still blocked as unverified, as expected                  | Incompatible units; one saved reviewer correction attempt; no geometry-repair instruction; original project preserved                |
| [Sculpture, two turns](browser-run-1/sculpture/result.json)                        | Both committed; reload and Undo/Redo passed after each    | 65 assembly parts + 2 unrelated; 64 changed per turn, plinth + unrelated pair preserved; 204 external facts per turn passed          |

For each successful turn the browser confirmed that storage still contained the original project while completion review was pending, followed by exactly one new Undo entry. ID rosters and groups remained unchanged. Rejected results produced no new Undo entry. Negative variants append one deliberate 20 mm translation to the saved operations after their own checks; independent verification catches it. No scripted repair is supplied to conceal a rejection.

New relations measure 48 original board/upright pairs and 56 roller/rail/leg pairs. The positive discrepancies are numerical roundoff, far below the retained 1 mm tolerance. Independent external scoring checks closed occupied solids, placements, sizes, editability, IDs, grouping and preserved work. Its existing 2 mm positional scoring bound and occupied-volume comparison are unchanged; the application's acceptance tolerance remains 1 mm.

Screenshots inspected: [shelf](browser-run-1/shelf/1.png), [conveyor](browser-run-1/conveyor/1.png), [sculpture final](browser-run-1/sculpture/2.png). These show the actual browser models; numerical and identity evidence comes from the saved solids, not labels or screenshots alone.

## Transfer and regression validation

- New tests use luminaire lenses and housings with positive and negative offsets, round solids and a rotated rectangular solid. Correct coordinated translations pass. A 1 mm deviation passes, 1.1 mm fails, with the same tolerance. Moved or replaced partners cannot be substituted with a convenient candidate neighbor. Ambiguous original matches remain unverified. Unrelated object edits remain blocked.
- Saved shelf/conveyor unit replays preserve the old invalid-calculation failures, then verify the direct checks and independently reject the displaced solids. The conveyor's displaced leg still passes the preexisting contact check.
- Full unit suite: **465/465 tests in 85 files passed**. Production TypeScript/Vite build passed. Existing bundle-size, Manifold browser-external and dynamic-import warnings remain; no build errors.
- Focused normal-browser replays: **7/7 passed**, including the two-turn sculpture regression. Logs and machine-readable results are retained with the fixtures' source SHA-256 values.
- Existing completion browser regressions: **3/3 passed** — incomplete geometry repair with one Undo, a new request after a failed request/reload, and safe handling of unsupported qualitative requirements with explicit uncertainty.

Reviewable models exported from the actual saved browser sessions: [shelf](models/shelf.atelier.json), [conveyor](models/conveyor.atelier.json), [sculpture](models/sculpture.atelier.json). Standard project import parsing was checked to preserve the exported solids and Undo history. These are model backups; the replay conversations remain in the linked result JSON files. [Validation summary](validation/summary.json), [full unit log](validation/unit.log), [completion browser log](validation/completion-browser.log).

## Limits and interpretation

This demonstrates that the host can check these relationships and safely commit the saved correct edits. **It does not establish that fresh AI chooses the right predicates**, covers every requirement, or infers the intended partners. The new predicate's nearest-original-anchor rule must fit the requested relationship. Equal-distance choices require narrower selections; large pair searches and unavailable original geometry remain unverified rather than guessed.

This change does not relax arithmetic equivalence, automatically rescue the old malformed criteria, repair the earlier shelf-creation interpretation error, or establish general comprehension of arbitrary spatial language. Explicit new positions still need valid checks. The original blocked cases are retained alongside the successful direct-criterion replays.

Next step is a small approved fresh-AI comparison after implementation freeze, with identical unfamiliar starting models and natural requests in `0527761` and this revision. Score interpretation, independent expectation derivation, actual solids and application commit separately. No paid execution is authorized by this offline iteration.
