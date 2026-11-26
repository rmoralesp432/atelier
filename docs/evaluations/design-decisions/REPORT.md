# Design-decision continuity — offline implementation review

Prepared November 26, 2026. No paid API calls, merge or deployment. Implementation: `deb730317cafe2e0b251a788693934196660140c`, on a separate branch based on frozen `711a8cf`. The packaging revision and iPhone `509e157` are separate.

## What changed

The most consequential continuity gap was not loss of the saved geometry. It was loss of usable evidence of the user's intention: recent AI history has 20 messages, while older project notes could retain a paraphrase without a reliable original quotation. The independent reviewer could not cite that paraphrase as a user requirement.

The existing `design_note` operation can now record a continuing user decision and its reason using an exact quotation from the current instruction. The workspace, not the model, attaches the source turn and a stable decision identity. The agent and reviewer receive the same active quotation even after it leaves recent messages. The reviewer can cite it in existing geometric checks and calculations; the quotation does not itself prove that the geometry is correct.

An explicit revision addresses that identity and replaces its active wording. Geometry and decision changes share the existing atomic transaction. Project history, reload, Undo and Redo therefore restore the corresponding version of both. An assumption cannot silently overwrite a recorded user decision. Fabricated quotations, stale revision IDs, ambiguous citations and superseded wording are rejected.

This adds no second memory service, extra AI call, geometric template, automatic dependency graph or permanent constraint. The agent must still infer relevance and affected components, inspect the starting model, and preserve unrelated work. Existing tolerances, independent measurements, scope protection and commit guards are unchanged.

## What the offline browser actually demonstrated

Both executor and reviewer responses were **scripted**. The ordinary workspace, request transport, completion parser and citation validation, actual modeling engine, independent solid measurements, transactions, IndexedDB storage and history were real. A separate SDK transport test checked that both AI roles receive the same compact decision content. No claim of autonomous recall or fresh reasoning is made.

The browser session began empty and made a simple editable review station: a tabletop, four legs, a freestanding display panel with posts and feet, and a separate plinth. A later instruction added a cylindrical stool. The original user decision was a 30 cm cable-access gap behind the table, with the reason retained verbatim.

After other edits pushed that instruction outside the 20-message window, the project was reloaded and the table was deepened without a gap reminder. The scripted response moved the connected panel assembly, and the host verified the original 30 cm requirement from the saved decision. The user then explicitly changed the gap to 15 cm because access would come from the side. After ten more real side-object edits, another reload and a second deepening preserved the revised 15 cm gap, again with its instruction absent from recent history.

| Checkpoint                     | Actual result                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Turn 1: initial creation       | 11 separate editable solids; exact user wording stored with its source turn.                                                 |
| Turn 12: deepen table to 1.2 m | 12 solids; 0.30 m gap measured; original decision absent from recent history but present for both roles; saved successfully. |
| Turn 13: explicit revision     | Same decision ID, revision 2; 0.15 m gap measured; table and side objects unchanged; saved successfully.                     |
| Turn 24: deepen table to 1.4 m | 0.15 m gap measured; revised decision now also outside recent history; saved successfully.                                   |

All **24 turns committed**, adding one Undo entry each. Table edits coordinated the tabletop, supports and panel assembly; the revision moved only the panel assembly. All existing component IDs survived. Objects outside each permitted edit set were compared with their pre-edit data, including the unrelated plinth and stool. Numeric geometry checks used the existing 1 mm tolerance; the cylindrical stool used the existing 2% tessellation allowance for occupied volume.

Reload and Undo/reload/Redo passed at turns 12, 13 and 24. IndexedDB-only recovery was exercised by clearing the isolated local checkpoints. Four exported `.atelier.json` files round-tripped geometry, groups, design notes, history, context and conversation exactly and were reopened for viewport review. The final model retains 12 editable solids and 24 Undo entries.

Two dependent negative controls were **blocked by measured geometric failures**, not merely unresolved verification:

1. Extend the table while leaving the display assembly behind.
2. Record the new 15 cm decision but retain the obsolete 30 cm geometry.

Both left the original project, active decision and Undo history intact through reload. The second control specifically confirms that changing a note cannot certify an incorrect model. No browser errors were recorded.

## Transfer beyond the rehearsal

A separate offline test used a cylindrical spindle rotated 37 degrees, a service guard and an unrelated sphere. The retained user decision specified a 25 cm service gap. After history truncation, a calculation cited the exact decision, converted centimeters to meters and checked the actual solids. Moving the spindle and guard together passed; moving only the spindle was measured incorrect. Identities and the unrelated sphere were preserved. This uses the same decision mechanism and existing predicates, without furniture-specific or machinery-specific application code.

## Validation and preserved failures

- Full unit suite: **469 tests in 86 files passed**.
- TypeScript and production build: passed.
- Changed source, test and evaluation files: formatting and whitespace checks passed.
- Browser persistence, completion and lifecycle suite: **13 passed**, including a second complete 24-turn replay.
- Agent and transaction regression suite: **8 passed**, including both concurrent-selection and genuine-conflict cases on 244-component edits.
- Export/import and framed viewport review: four saved checkpoints passed exact round-trip checks.
- API spending: **US$0; zero paid calls**.

The first focused test run exposed an omission in the strict provider contract: the new optional capture field needed the same required/null treatment as other strict tool arguments. That was corrected before the successful suite. The same run also exposed a test-fixture error using a nonexistent XYZ move argument; the fixture was corrected to the existing direction/distance operation. The failed and successful logs are retained. An initial browser command also included a nonexistent `agent-workspace.spec.ts` filter; that filter contributed no tests. The actual `agent-execution.spec.ts` suite was run separately and is counted explicitly above.

The continuity branch inherits the pre-existing repository-wide formatting failure at `711a8cf`. The separate packaging PR resolves that gate without changing application behavior. Its full required CI is reported independently; do not attribute its CI result to this new implementation.

Packaging head `b014de916da6101bc60eeeae6daaa96bbb106f0c`, [draft PR #25](https://github.com/rmoralesp432/atelier/pull/25), now has a green [required CI run](https://github.com/rmoralesp432/atelier/actions/runs/45884234762): validation, all eight browser shards (162 tests in the suite), and aggregate `check`. Application/server/tests/dependencies/workflow are byte-identical to `711a8cf`; all 129 historical snapshot hashes match. The first attempt had a 60-second map-test timeout. That unchanged test passed locally in 36.8 seconds and the unchanged shard passed on rerun. No test was weakened; both attempts are preserved, and the precise transient cause remains unknown. GitHub's full log redirect was restricted in this environment; its check annotation supplies the retained timeout evidence.

The archive retains full requests and saved-model snapshots for the primary replay. The repeated browser replay is evidenced by its suite log; its transient test-results directory was cleared by the subsequent regression suite. This is not a second preserved fresh-AI trial.

## Limits and release considerations

Fresh AI has not yet demonstrated that it will choose to capture the right decision, select the right relationship later, infer connected edit scope, or cite the correct active wording. The offline run establishes that the infrastructure supports those actions and rejects the measured wrong variants; it does not establish their autonomous reliability.

Notes remain bounded to 40 topics. Existing unprovenanced notes remain readable context and are not retroactively certified as user quotations. The quote must fit within 1,500 characters. Provenance links a captured quote to the actual turn when created; it is not a cryptographic defense against someone deliberately modifying a project file. Semantic relevance still requires reasoning.

The new version reads existing projects. Older strict readers, including the current production build, cannot import the new enriched decision-note format. Review these exports with this branch; do not import them into production until compatibility and release decisions are made. No production data was changed.

The saved geometry and numerical checks were reviewed, but this is a schematic furniture study, not a structural, fabrication or ergonomic certification. Physical iPhone microphone testing remains separate on `509e157`.

## Review files

- [Runtime diff](runtime.diff): application and server changes only, relative to `711a8cf`.
- [Complete implementation diff](implementation.diff): implementation, tests and offline harness changes.
- [Compact results](SUMMARY.json): outcomes, measured evidence and integrity checks.
- [Offline evidence archive](offline-evidence.zip) and [SHA-256 hashes](SHA256SUMS.json): original replay, requests, results, screenshots, editable exports and validation logs.
- Saved model views: [initial](models/turn-1-framed.png), [first contextual edit](models/turn-12-framed.png), [explicit revision](models/turn-13-framed.png), [final contextual edit](models/turn-24-framed.png).
- [Fresh-AI protocol](FRESH-AI-PROTOCOL.md): proposed after implementation freeze; requires separate authorization.

To reproduce without API access: build this branch, run `node --import tsx scripts/design-decision-evaluation/browser.ts <new-output-directory>`, or run `ATELIER_TEST_PRODUCTION=1 npx playwright test tests/design-decisions.spec.ts`. The replay refuses to overwrite an existing result. Its providers are scripted and remote requests are blocked. The export helper reads `docs/evaluations/design-decisions/attempt-1/result.json`; that file is retained in the evidence archive.
