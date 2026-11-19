# PR #22 — final checkpoint evaluation (authorized US$5)

The user authorized **up to US$5 of additional OpenAI API spending** for this evaluation on November 18, 2026 (Mexico City). Application target: `a2fd752693c4b98bc322cbeae8f7ec0ebc15c866`. No production code changes, merge or deployment are authorized by this run.

The prompts, independent numeric oracles, source trees and harness are frozen before paid execution. The harness is separate from application code. It uses the production GPT-6.1-sol provider, staged agent, geometry engine, completion reader, verifier, rendered observations, serialization and Undo/Redo. The executing AI never receives the external oracle, fixtures or a prescribed repair plan.

## Six sequential turns

1. **Create:** a four-piece open channel with a rectangular base, two end walls and a ball resting on the base. Offset location, asymmetric dimensions, editable components, new group and unrelated existing objects. This differs from the earlier two-shelf stand.
2. **Modify:** widen the channel equally at both ends, extend its base and reposition the walls while preserving height, wall thickness, the ball, component identities and unrelated objects.
3. **Repair:** create five cubes in a rising, nonplanar zigzag. Once the external oracle confirms the provisional geometry, displace the middle component by 31 cm in Z. This leaves count and overall bounds unchanged. The actual independent AI criteria must detect the local error and the actual modeling agent must repair it from production feedback. All five IDs must survive. The injection is explicitly distinguished from a naturally occurring AI error.
4. **Safe failed edit:** the real agent attempts to raise the channel walls. At completion, simulate a lost independent-review response using the application's existing unavailable-review fallback. No reviewer AI answer is fabricated or billed for this deliberate fault. Unknown edit scope must prevent a commit; original project, context and history must survive serialization. This is a controlled transport failure, not a claim that the live API failed.
5. **Continue:** after reloading that failed turn, request an unrelated open-top cylindrical vessel with measured wall/bottom thickness and an actual empty cavity. Verify geometry, preservation, persistence and one-step Undo/Redo.
6. **Genuine uncertainty:** an ellipsoidal token has exact dimensions/placement but a subjective request for a tranquil, welcoming character. Measurable requirements must pass while the subjective quality stays explicitly unverified. The AI must not repeatedly remodel it or claim that all requirements were proven.

All exact prompts and dimensions are in `scripts/completion-evaluation/cases.ts`. No live output is used to change them. If a prerequisite fails, dependent turns are reported unrun rather than substituting a handmade successful project.

## Independent checks and controls

The external oracle measures actual solids: 5 mm bounds tolerance and 1.5% symmetric-difference volume tolerance for tessellation, component count, membership, retained identities, permitted changes and unrelated preservation. The vessel's cavity is independently probed for remaining material. Geometry recipes and object naming are not substitutes for physical measurements.

After each accepted result, use the **actual AI-produced criteria** to check local variants without new API calls: remove a part, move a part, change its size, alter a protected neighbor, replace a retained identity, and fill the cavity where applicable. Convert correct new geometry to equivalent meshes and equivalent local-axis frames. Compare each verdict with the independent oracle. An explicitly unverified but safely accepted equivalent representation is recorded separately from verified acceptance; it is not mislabeled as a rejection.

Stop paid execution on serious disagreement: acceptance of objectively incorrect geometry, rejection of objectively correct geometry, loss of transaction integrity, unsafe acceptance under unknown edit scope, or a failed negative/equivalence control. Inconclusive or budget-blocked turns are not passes. Subjective uncertainty is expected in the last turn, not a model defect.

## Budget and telemetry

- Fixed `gpt-6.1-sol`, Responses API, standard tier, production 6,000-output-token ceiling. Executor retains high effort; the PR's text reader uses low effort. No alternate models, automatic SDK retries or billable external tools.
- Maximum 48 actual requests overall and 8 per turn. Every request reserves its conservative maximum before sending, using byte-bounded text, image allowance, higher published standard long-context rates and a 25% margin. The global US$5 ceiling overrides call allowances.
- Existing public secondary pricing reference: standard input $2/million and output $10/million; reservation rates $4/$15. Rates are rechecked before generation. Report token-based estimated charges separately from reservations and budget margin; this is not an account-wide billing statement.
- The ledger is atomic and cannot be reset after authorization or spending. An exclusive process lock prevents concurrent runs. Unknown usage, unexpected model/tier or interrupted charges retain the reservation and block further generation. No automatic budget extension.
- Preserve prompts, original/provisional/final scenes, full safe provider responses, derived criteria, measured observations, repair feedback, transaction checks, per-call usage, response status, incomplete reasons, reasoning tokens where reported, reviewer latency and total latency. Credentials and request authorization headers are never logged.
- New reviewer latency is compared descriptively with the earlier 42–56 s observations. Different tasks and no randomized A/B baseline mean no causal percentage speedup can be asserted.

## Recommendation rule

Recommend merging and deploying a **bounded demonstration checkpoint** only if the requested measurable results are correct, modification/repair preserves identities, valid representations are not rejected, negative controls detect defects, the intentionally interrupted edit preserves the project, subsequent modeling/Undo succeeds, and genuine uncertainty is represented honestly. Runtime and cost must be reported as observed. A small run does not establish general reliability for drawings, arbitrary organic designs, large imports or physical AR.

Execution is authorized only for this evaluation. Merge/deployment still require the user's explicit approval.

```sh
node --import tsx --test scripts/completion-evaluation/budget.test.ts
node --use-env-proxy --import tsx scripts/evaluate-completion.ts --prepare
node --use-env-proxy --import tsx scripts/evaluate-completion.ts --live --approved-budget-usd=5
```
