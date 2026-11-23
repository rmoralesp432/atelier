# Review package and proposed paired evaluation

23 November 2026. **Proposal only: no paid execution authorized or performed.** Application implementation remains `433d9baed8265cc4eb78a5b0bfb914911b734cf7`. The existing report, evidence, diff and held-out task document are preserved unchanged; this document clarifies their scope and proposes the comparison.

## What the saved R replay actually proved

My earlier use of “committed” for the standalone R replay was too broad. These are three distinct pieces of evidence:

1. **Exact saved repaired R candidate:** the frozen verifier accepts all ten requested positions and returns `canCommit=true`; the unsupported hexagonal-shape requirement still makes the overall status `unverified`. The displaced candidate returns `canCommit=false`. The unchanged external oracle passes all 36 checks on the repaired candidate. This establishes verification/commit eligibility, not a browser commit of that candidate.
2. **Saved creation-plan replay:** `scripts/validate-derived-completion.ts` re-executes the recorded creation operations through the real staged planner and kernel. It obtains `result.prepared.session`, checks its one history entry, serializes/reloads it, and exercises engine Undo/Redo. It does **not** invoke `App.tsx` transaction finalization, the final concurrent-edit guard or browser storage for R. It also does not replay a fresh autonomous repair loop: the calculation is manually authored, and the creation operations are saved responses.
3. **Separate sphere browser regression:** actual Chromium and the normal App path reject a wrong sphere placement, apply a scripted repair, commit, perform a contextual edit, reload, and Undo/Redo. Provider responses are scripted. This demonstrates the browser transaction integration on different geometry, not a live-AI R success.

The original paid R attempt remains a failed completion with no committed model. The pending comparison must establish fresh AI interpretation **and** actual browser commits rather than promoting a prepared session to an end-to-end success.

## Versions and conditions

Compare stable baseline **`f925e4cef7b4c6a27eb1532476879728aa5d7584`** against frozen implementation **`433d9baed8265cc4eb78a5b0bfb914911b734cf7`**. The baseline's application source is identical to the application source under the original Phase 3 evidence commit `a80d6ef`; this was checked locally. Use separate checkouts and fresh browser contexts, the same dependency lockfile, actual modeling kernel, normal browser workspace, original projects, prompt bytes, neutral observations and independent numerical oracles.

Use real `gpt-6.1-sol`, Responses API, standard/default service, executor high effort and reviewer low effort, with the respective frozen application's ordinary limits. Record returned model identifiers and all token usage. Do not inject the expected formulas into the user prompt, executor context or independent reader; the external oracle is outside the application. Neither version may see the other version's outputs. Any new workshop feature must be excluded from both arms.

### Small comparison: two tasks and one negative control per version

| Episode               | Same inputs for both versions                                                                                                        | What it tests                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-H1 creation         | The exact rising circular sequence prompt in `HELD-OUT.md`: six cylinders on a descending-angle arc with increasing base elevations. | Fresh reasoning about compound spatial relationships and units; independent target calculation; actual commit.                                    |
| D-H2 contextual edit  | The exact reflection-of-positions prompt in `HELD-OUT.md`, using the same validated three-piece starting model in each arm.          | Original-geometry source binding across a box, elliptical cylinder and triangular prism; identity, orientation and unrelated-object preservation. |
| D-N1 negative control | The D-H1 request plus the same deliberately incorrect provisional proposal: one cylinder displaced 0.04 m radially outward.          | A fresh independent reader must not certify the incorrect result, and the normal browser transaction must not commit it.                          |

Order: baseline D-H1, frozen D-H1; frozen D-H2, baseline D-H2; baseline D-N1, frozen D-N1. One attempt per cell. This is a focused paired diagnostic, not a statistically significant reliability estimate.

Instantiate D-H2 identically in both arms using a test-only group, “Display pieces”:

- Box: 0.82 m X width × 0.46 m Z depth × 0.31 m Y height; base placement (-1.7, 0.45, -0.4); world Y rotation 19°.
- Upright elliptical cylinder: 0.58 m width × 0.34 m depth × 0.76 m height; base placement (0.2, 1.15, 2.1); rotation -28°.
- Extruded triangular prism: local XZ vertices (-0.40,-0.25), (0.45,-0.25), (-0.10,0.42), height 0.53 m; base placement (2.4,0.8,-1.6); rotation 43°.
- Preserve the same two unrelated Phase 3 reference objects and their group. Give all objects fixed evaluator IDs, visible/unlocked, with no selection. Measure actual original world solid bounds; do not substitute the asymmetric prism's recipe origin for its bounding center.

This remains a **seeded contextual-edit diagnostic**, not an end-to-end creation success. Geometry recipes may differ in final results only where the user permits it; a position-only edit must preserve the original occupied shape, size and facing direction.

The negative proposal is intentionally scripted and independently validated as incorrect before evaluation. Its executor responses are not presented as real AI reasoning. Use a fresh real reviewer on the user's request, original scene and permitted candidate identities. Through the actual App path, deliver the fixed incorrect proposal and capture the verifier verdict, feedback and persistence state. If repair is requested, end this control without applying a repair; verify that the original project/history remains intact. Autonomous repair performance is **not** claimed by this negative control. A separate real repair experiment would require a separately defined protocol.

An externally wrong candidate that the host accepts for commit is a false acceptance even if it is labeled unverified. Stop the paid comparison on a material false acceptance or data-loss defect; preserve the failure. Do not let a scripted refusal or cancellation conceal a false `canCommit=true` verdict.

## Separate scoring at each boundary

For every episode/version, report these columns independently:

1. **AI relationship interpretation:** use observable tool choices, generated criteria and their cited sources—not private reasoning—to judge the requested frame, angle sign, interpolation, original-object binding and position-versus-orientation distinction. Record correct / incorrect / insufficient evidence. For D-N1, executor reasoning is N/A because its proposal is scripted; reviewer interpretation is still measured independently.
2. **Expected-value derivation:** record literal AI number / existing deterministic predicate / new calculation / unsupported. Compare expected numbers with the external request/pre-edit oracle before using candidate measurements. Retain citations, source values/IDs, units, frame, calculation and discrepancies. Correct literal numbers may count as correct, but must not be labeled deterministic host derivation. A baseline result is not failed merely for lacking the new field.
3. **Actual geometry:** measure occupied solids, counts, base centers, dimensions, distinct editable identities, movement of the intended components and exact preservation of unrelated objects. For D-H2, translate each edited solid back by the expected displacement and compare occupied geometry, not only its envelope.
4. **Verification verdict:** verified / incorrect / unverified, explicit coverage gaps, false acceptance/rejection, scope failures and repair attempts. A correct external result with honest host uncertainty is reported separately from full host verification.
5. **Application transaction:** actual App commit or block, one Undo entry per committed request, browser persistence, reload, Undo/Redo, conversation continuity and unchanged unrelated work. Only reading `prepared.session` is not sufficient. D-N1 must retain the prior project and history without a modeling commit.
6. **Cost/latency:** executor/reviewer calls, input/output/reasoning tokens, reviewer latency, total elapsed time, estimated cost, conservative accounting and unresolved reservations. Report any extra calls caused by the new format.

Use the already published D-H1/D-H2 mathematical expectations. Keep the 0.001 m position/dimension tolerance and existing shape-fit allowances. Record exact persisted IDs, metadata and histories; do not weaken preservation to approximate bounding boxes. Before paid execution, externally calibrate positive/negative/equivalent geometry controls and the browser fault path, then freeze the evaluator/fixture hashes. Calibration is not a live-AI result.

## Proposed spending ceiling and pricing basis

**Proposed ceiling: US$5 aggregate for this new paired comparison**, inclusive of all executor/reviewer calls, retry/diagnostic calls and unresolved-charge reservations. This is a proposal, not use of the earlier Phase 3 authorization. Keep all historical ledgers intact; start an explicitly unauthorized comparison ledger until the user separately approves it. No voice, image generation, search tools or external billable tools.

Pricing reference rechecked 23 November 2026: the LiteLLM secondary price table at `https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json` lists `gpt-6.1-sol` at **$2 per million input tokens and $10 per million output tokens** for standard context; above 272k input tokens it lists $4 input / $15 output. This is **not independently verified account pricing**. The official URL it cites, `https://developers.openai.com/api/docs/pricing`, is still unreachable from this environment (proxy CONNECT 403). Do not represent the secondary rates as an official quote or a confirmed invoice.

Preserve the existing reservation method: budget the full bounded request input, image allowance and maximum output at **$4/$15 per million plus 25%**, before sending; count reasoning tokens within billed output; assume no cache discount. Retain unresolved reservations and stop on uncertain usage, unexpected model/tier, or a call that cannot fit under the remaining ceiling. A $5 software limit based on estimates cannot guarantee the account's actual dollar charge if applicable prices differ.

Expected planning range: roughly 0.4–0.8 million input and 20–40k output tokens across the six cells, or **$1.00–$2.00 estimated** at the secondary standard rates before the 25% accounting margin. This is an estimate, not a spending target. Limit the campaign to 36 paid calls, at most eight per ordinary task/version and two reviewer calls per negative-control/version. These are evaluation-only guards and must not alter application completion rules. Stop rather than force completion at a guard limit; report cells not reached.

Separate approval must specify the $5 ceiling and whether it accepts estimated pricing with user billing supervision, or supplies verified account rates first. Do not silently carry the previous baseline's pricing waiver into this new campaign. No request for that authorization is being made until this protocol has been reviewed.

## Deliverables after an authorized run

Preserve both arms' raw responses, criteria, calculations, actual project snapshots, browser commit/history evidence, independent measurements, error/failure records, pricing snapshot and append-only ledger. Publish a six-row boundary-by-boundary scorecard, qualify the single-run evidence, and recommend whether the frozen verifier should move forward. Do not merge, deploy or tune the implementation in this comparison.
