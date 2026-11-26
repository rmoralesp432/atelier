# Separate release review: frozen 711a8cf

Reviewed November 26, 2026. **Application code remains frozen. No API calls, merge or deployment were performed for this review.** This review is separate from the proposed design-intent milestone.

## Baseline and candidate

- Current Render production: **`f925e4cef7b4c6a27eb1532476879728aa5d7584`** at https://atelier-emxi.onrender.com/.
- Render reports deployment `dep-dbvig9l9fdbs73bbeo20` as `live`; its commit matches the GitHub deployment branch, `feat/phase2-conversational-modeling`. Automatic deployment is disabled. Agent mode is enabled and the configured agent model is `gpt-6.1-sol`.
- Frozen candidate: **`711a8cff9eb54a4c5254e5c20187b7b2614020da`**.
- Read-only evidence: [production state](production.json), [candidate CI lookup](ci-status.json), [source and unit-test diff](application.diff), [complete change list](full-change-list.txt).

Production state was checked through the Render API and GitHub. This was not a new production modeling smoke test. The existing production deployment is the rollback baseline and remains untouched.

## What would actually change from production

This is a cumulative release, not only the final `preserve_offsets` check. The runtime source delta spans 19 files, plus eight colocated unit-test files. That combined diff has 2,702 insertions and 84 deletions. The broader branch also contains evaluation utilities, browser fixtures and historical evidence.

1. **Inspect the starting geometry.** Requests carry an immutable snapshot of the scene at the beginning of the current instruction. The inspector can return original/current geometry and comparisons so the agent need not guess earlier dimensions from a changed model.
2. **Calculate independent expectations.** Typed, bounded calculations can derive expected measurements from quoted user dimensions or pre-edit geometry, with source values, units and coordinate frame. Candidate geometry cannot establish its own target.
3. **Resolve references and invalid criteria consistently.** Inspection and verification share object/group resolution. Invalid calculations are identified before geometry is judged. The existing bounded correction path allows demonstrably equivalent repairs to a malformed criterion; an invalid check is not a geometry-repair instruction. Unresolved required spatial checks keep proposed edits out of the saved project.
4. **Preserve spatial relationships between original identities.** `preserve_offsets` pairs original objects and anchors, then checks the same identity pairs in the proposal. Nearest-anchor ties, missing originals, unsupported/oversized sets and other indeterminate situations do not silently pass. This measures declared world-axis bounds relationships; it does not prove arbitrary surface contact or physical connectivity.

The candidate does not replace the geometry kernel, introduce a project schema migration, change dependencies or change production model defaults. Existing transactions, Undo/Redo and editable IDs remain in use. No design-intent persistence improvement has been added.

## Evidence and limitations

| Validation                               | Result                                                                    | Scope                                                                                                                                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full unit suite                          | **465 tests across 85 files passed**                                      | Candidate application source; [log](validation/unit.log).                                                                                                                                                                                                      |
| Production build                         | **Passed**                                                                | TypeScript and Vite; existing bundle-size warning remains; [log](validation/build.log).                                                                                                                                                                        |
| Relevant browser regression suite        | **19 passed**                                                             | Actual browser/geometry/transactions with offline providers or saved responses: agent execution, completion, direct spatial shelf/conveyor/sculpture replays, reference/calculation recovery; [log](validation/browser.log). Not the entire CI browser matrix. |
| Exact frozen checkout formatting gate    | **Failed: 136 files**                                                     | 125 historical evidence/document files and 11 evaluation scripts/fixtures; no runtime source formatting warnings. [Exact log](validation/format-exact.log).                                                                                                    |
| Required CI on exact `711a8cf`           | **Not established**                                                       | GitHub returned zero check runs. Do not interpret this as green CI.                                                                                                                                                                                            |
| Previously completed fresh-AI comparison | **4/4 correct proposals saved; 4/4 wrong controls measured and blocked**  | Matched `0527761` versus `711a8cf`, two unfamiliar contextual edits, reload and Undo/Redo. Both versions succeeded. This is not a fresh production-versus-candidate experiment. [Report](../../evaluations/direct-spatial-live/REPORT.md).                     |
| Design-intent rehearsal                  | **8/8 scripted turns committed; 2/2 wrong variants measured and blocked** | Separate exploratory offline session, not additional fresh-AI evidence for release. [Findings](../../evaluations/design-intent/FINDINGS.md).                                                                                                                   |

The existing browser regressions write some historical artifact paths. This review copied newly generated outputs into [validation/browser-generated](validation/browser-generated) and restored the historical files byte-for-byte. No prior scored result was overwritten. An initial formatting command accidentally checked the older default checkout; it was excluded and rerun against an isolated exact `711a8cf` checkout. Only the exact-checkout result above is used.

## Release recommendation

**Prepared for separate review; not ready to claim a green release gate or deploy as-is.** No new critical geometry failure was reproduced in the relevant suite. The concrete blocker to required CI is packaging/formatting of accumulated evaluation material, and the full required browser matrix has not been run for this exact commit.

Keep `711a8cf` immutable. A separately authorized packaging-only revision should format authored evaluation utilities and adopt a narrow, explicit policy for immutable captured evidence, preserving its original hashes. It must not reformat historical results silently or exempt application source from checks. Then run the repository's complete CI workflow on the proposed release head and review any actual failures. This review makes no such revision and creates no release PR.

Remaining material limits:

- The previous fresh-AI comparison supports the last verification increment, not every cumulative change against current production. It showed both versions succeeding; no accuracy gain is claimed from that small sample.
- Stronger handling of unresolved required spatial checks may safely block requests where the independent reviewer cannot establish the requirement. Unsupported qualitative judgments remain distinct from measured geometric failures.
- Duplicate names can be ambiguous; the shared resolver deliberately requires an unambiguous reference instead of guessing. Original pairings are evidence for a specific request, not permanent constraints or permission for future edits.
- Actual iPhone microphone/background behavior and the intermittent desktop viewport issue remain incompletely validated. Neither is declared fixed by this review.
- Long-term user intent is a separate next-milestone question. Current notes and recent conversation do not provide verified decision provenance across an arbitrarily long project.

Any future deployment requires separate approval, green required checks, and a smoke test of the actual deployed release. Keep `f925e4c` available as the rollback point.
