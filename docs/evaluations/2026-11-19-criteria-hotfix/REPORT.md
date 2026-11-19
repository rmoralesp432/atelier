# Verification-criteria hotfix — review checkpoint

**Deployment remains on hold for user approval.** PR [#23](https://github.com/rmoralesp432/atelier/pull/23) contains the focused correction. Final application source: `793e943dd6f754d01fdb0971621367c6de84e508`. A read-only Render check confirmed production remains on `acf5ed9ccdb298d2853d139ce5cdf0fc35e24c36`; production has not been modified.

## Confirmed root cause

The deployed evaluator treated a mathematically contradictory check as a failed geometry measurement. It computes **second anchor minus first anchor**, but the independent reader was not given that explicit sign convention. A lower-minus-upper comparison requiring a positive interval can therefore contradict otherwise correct absolute elevations.

The second defect crossed two different data meanings: `material` was only a rendering category (`solid`, `glass`, `frame`), yet its verifier accepted a physical substance such as `concrete` as an expected value. No supported operation could satisfy that comparison. Object names and gray colors were never sufficient physical evidence.

Using the user's exact prompt and screenshot dimensions, a minimal causal fixture reproduces both failures against deployed commit `acf5ed9ccdb298d2853d139ce5cdf0fc35e24c36`: 12 × 10 m, 250 mm slabs at 0/3.5/7 m and roof at 10.5 m. The old verifier returns `incorrect`, prevents commit and identifies the reversed offset and material comparison as failures. The hotfix identifies both as invalid/unsupported criteria and returns `unverified`, preserving the correctly measured absolute elevations. This is a reconstruction of the offending checks; the original production provider JSON and complete provisional building were not available. It is not represented as recovered raw production evidence.

## Correction

1. A bounded mathematical audit checks expected world-anchor intervals, dimensions and relative equations before invalid criteria can trigger modeling repair. Desired numbers come from independently interpreted requirements, never from fitting the candidate geometry. Signed offsets, min/center/max datums and world axes have explicit contracts. A contradictory relative comparison cannot cancel valid absolute measurements.
2. A single additional independent reader call may propose small patches to proven-invalid checks. The host retains the original citations, other checks, scope and tolerances. Unsupported changes, requirement removal and edits to valid failed checks are rejected. The executing model cannot override the verifier.
3. Explicit `materialSpec` designations are stored separately from appearance and can be assigned through the existing material operation. They persist, remain editable and participate in Undo/Redo and preservation. A designation establishes **design metadata, not physical composition, performance or certification**; names and colors do not assign it. Old projects remain compatible, and a rendering-only change preserves existing material metadata.
4. Invalid or unresolved criteria remain explicitly unverified. Supported measured failures still block. Uncertain authorization still protects existing objects. A final defense also prevents a malformed saved/custom reviewer ID from masking a host-owned preservation check.

No building template, architectural special case, geometry-operation limit increase or transaction-protection bypass was introduced.

## Real-AI evidence

One unfamiliar offset-gauge assembly was generated using real **GPT-6.1-sol** and the actual browser/application/geometry engine. It requested three separate POM blocks, explicit dimensions and three staggered base centers, positive and negative offsets, grouping and preservation of two unrelated objects.

- All three objects were independently editable and carried explicitly assigned `POM` metadata.
- Independent solid measurements confirmed each object's width/depth/height, base-center placement and occupied volume; grouping and preservation also passed.
- All **12 normal host checks passed**. The model finished and committed once; reload and Undo/Redo passed.
- A separate, explicitly labeled **criterion fault injection** reused that same correct scene: one reversed offset and one invalid rendering-material comparison. Real independent reasoning corrected `+0.6` to `−0.6` for the retained comparison direction and changed the material predicate to the explicit designation field. Both corrected checks passed without moving geometry. This is controlled fault injection, not a claim that the normal live request spontaneously generated those errors.
- Moving the East component 0.2 m in a negative control still returned `incorrect`, with commit disallowed. It did not trigger another criterion-correction call.

The live sequence ran on `bb85ddc6f8b3ed99962a5df414491e28ec872bbf`. The final source adds only isolation of host-owned check IDs. The unchanged paid plans and criteria were replayed in the actual browser on that final source after scene-equivalence checks; commit, persistence, reload and Undo/Redo passed again with **zero new paid calls**. Final-source remeasurement also retained both positive results and rejection of the displaced control. Original live responses and failures were not overwritten.

| Measurement                              | Result                            |
| ---------------------------------------- | --------------------------------- |
| Normal executor calls                    | 2                                 |
| Normal independent review                | 1 call, 6.990 s                   |
| Injected-criterion correction            | 1 call, 2.713 s, 93 output tokens |
| Whole live/browser sequence              | 40.887 s                          |
| New API usage estimate                   | **US$0.094304**                   |
| Conservative accounting including margin | **US$0.11788 of US$2**            |
| Unknown new charges                      | **None**                          |

This small text-only task is not a latency guarantee for large architectural or drawing-based requests. Existing pre-call reservations, higher-rate bounds, request limits and unknown-usage stops remained active. Earlier release ledgers are untouched. The retained ledger’s `chargedUsd` field is the conservative accounting amount with a 25% margin, not a confirmed invoice charge.

## Regression validation

**Final CI passed on `793e943dd6f754d01fdb0971621367c6de84e508`: [run 44555128482](https://github.com/rmoralesp432/atelier/actions/runs/44555128482).** Validation ran the complete unit suite (424 tests), build and formatting; all eight browser shards and the required aggregate check passed. The Checks API confirms **150 browser tests passed**, with no skipped or failed browser tests. Final-source replay and independent remeasurement also passed.

Five focused browser tests passed: independent repair of missing geometry, recovery after failure, honest uncertain completion, invalid-criterion correction plus metadata repair, and bounded unresolved-criterion behavior. They check actual commit, unrelated-object preservation, persistence/reload and Undo/Redo. Thirteen evaluation-infrastructure regression tests passed. Build and formatting passed.

Held-out geometry covers signed X/Y/Z offsets, unequal positive/negative coordinates, rotations, different bound anchors, relative cycles, contradictory absolute datums, material metadata, unsupported values, and valid-but-unmet geometry. Attempts to drop requirements, inflate tolerances, widen scope or fit desired values to observed wrong geometry are rejected.

Two development-fixture issues were fixed before live spending: an initial test incorrectly used a single-operation helper for multiple operations, and the optional material field needed a required nullable form in the strict provider schema. The suite caught both; their failed logs remain in the archive. The initial CI run was superseded after adding the host-ID defense, not reported as a passing run. The live evaluation itself completed without a paid retry or provider failure.

## Limits and recommendation

The consistency audit proves contradictions in supported interval/difference contracts; it is not a universal natural-language or nonlinear-constraint proof system. A semantically wrong but internally consistent interpretation can still require stronger evidence. Material metadata does not simulate or certify physical properties. Original raw production criteria were unavailable, so the incident's minimal reproduction is distinguished from the saved real-AI test traces.

With final CI green and the focused real-AI acceptance completed, this hotfix is ready for user review and deployment approval. It is **not merged or deployed**. No additional product milestone or paid benchmark is needed for this checkpoint.

`evidence.tar.gz` preserves requests, responses, token usage, original/candidate projects, independent reports, the displaced control, browser replay, screenshot, regression logs and pricing evidence. `SHA256SUMS` identifies the archive. Compact result and ledger files are also available beside this report.
