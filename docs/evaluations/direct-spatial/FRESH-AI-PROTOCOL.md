# Proposed fresh-AI comparison — approval required

Defined after implementation freeze **711a8cff9eb54a4c5254e5c20187b7b2614020da** on November 25, 2026. No paid calls have been made for this proposal. Application code remains frozen. These tasks were not used to implement or calibrate the predicate.

## Question and controls

Does a fresh independent reviewer choose adequate checks for unfamiliar contextual edits, and does the ordinary browser workflow save the right geometry?

Compare **05277619f6fa337cdb1bfb0825654cbe5259ed2d** with **711a8cff9eb54a4c5254e5c20187b7b2614020da**. This isolates the new direct-relation capability from older architectural changes. Use real `gpt-6.1-sol` executor and reviewer responses, unchanged production model settings, and the same validated starting project/user request in each version. Separate browser contexts, storage and projects. Do not feed either agent old dimensions, object IDs, suggested predicates, target coordinates, test oracles or hints about the other run. The starting scene remains inspectable through normal tools.

Four primary browser requests: two tasks × two versions. These evaluate contextual editing and verification selection, not fresh creation. Use a short neutral project history describing the assembly, with no hidden instructions or original dimensions. Archive it identically in both versions. Existing safeguards and bounded repairs stay enabled. No application modifications while scoring. Report both success if both succeed.

## Fresh task A: suspended kinetic assembly

Starting fixture: one canopy, eight cylindrical suspension members of differing lengths, and eight ellipsoidal pendants at varying elevations; two unrelated solids nearby. Distinct editable IDs, one assembly group. Every suspension member meets its own pendant and the canopy underside in the original solids. Use asymmetric plan positions to avoid nearest-part ties. No preset or task-specific implementation is added to ATELIER.

User request:

> Raise the canopy by 28 cm, keeping the pendants where they are. Adjust their existing suspensions so the connections are maintained. Keep the same pieces and leave the two objects beside it alone.

Independent scoring, derived from the starting solids and the request:

- Canopy translates +0.28 m on world Y, with size and orientation unchanged.
- Each suspension base stays at its original pendant connection, its top rises 0.28 m, and its transverse dimensions and plan placement stay unchanged.
- Pendant solids, component identities, groups and unrelated objects remain unchanged.
- Contact/endpoint measurements are made against the actual occupied solids, not names or reported counts.

Negative control: in a copy of the correct proposal, shorten one suspension by 15 mm with its base fixed. Re-evaluate using the **same fresh criteria and tolerances**. The missing upper connection must not be certified correct or committed. This negative uses no new AI response and is scored separately from autonomous repair.

## Fresh task B: adjustable mechanical jig

Starting fixture: two opposing movable yokes on a fixed base, one protective shield and three adjustment knobs attached to each yoke; two unrelated sample solids. Eleven assembly components plus two unrelated objects. Use nonzero original shield/knob offsets and asymmetric Z/Y placement so existing relationships must be read, not assumed to be zero. The moving components may share one group; do not provide ready-made left/right edit groups. Distinct editable IDs. Use different dimensions and geometry from the saved shelf, conveyor and luminaire tests.

User request:

> Open the gap between the yokes by 46 cm, equally on both sides. Take their shields and adjustment knobs with them, keeping the existing offsets. Keep the base and the two sample objects where they are.

Independent scoring:

- Gap increases exactly 0.46 m; opposing yokes translate −0.23/+0.23 m along the established world-X opening direction.
- Each shield and knob follows its original yoke with its signed original XYZ offsets, size and orientation preserved. Derive each pairing from the validated starting fixture, never the candidate.
- Fixed base and unrelated solids remain byte-for-byte unchanged; all original IDs and groups persist.

Negative control: move one knob 20 mm farther from its original yoke after a correct proposal. The **same fresh checks** must block saving. Do not replace a missing check with a scripted one to obtain a pass.

Before any paid execution, materialize and validate both fixture/oracle pairs offline, freeze their exact numerical values, hashes and user-facing context, and calibrate correct/wrong controls. If a fixture is ambiguous or invalid, correct it before scoring and record the change. Do not change the frozen implementation. These now-published tasks are reserved for this comparison; later implementation changes require newly defined held-out tasks.

## Separate measurements

For every trial, preserve all provider requests/responses, selection/inspection calls, provisional and committed solids, criterion calculations, host feedback, times, usage and costs. Report these independently:

1. **Interpretation:** Did the executor and reviewer identify the intended direction, original partners and fixed work? Record evidence from tool calls and selected requirements, not hidden reasoning claims.
2. **Independent expectation:** Did the reviewer express the requested dimension or original relationship? Did the host derive the value from the request/pre-edit solids, with the right units, frame and sign? Did it incorrectly use candidate values, omit an obligation, or remain unverified?
3. **Geometry:** Measure occupied solids, placements, offsets, contacts, IDs and unrelated work using external fixture-based oracles. A tolerance up to 1 mm applies to positional/offset scoring; retain the existing round-solid tessellation allowances. Larger reviewer tolerances are reported as inadequate coverage, never used to relax the oracle.
4. **Commit:** Did the normal browser finish and save exactly once? Reload, Undo, reload while undone and Redo must preserve correct project states. An unverified required placement must remain unsaved with explicit uncertainty.
5. **Negative controls:** Does the exact fresh criterion set reject the deliberately displaced/shortened proposal? A materially wrong accepted result fails the trial, even if the ordinary positive case passed.
6. **Efficiency:** Executor/reviewer call counts, review and total latency, repair/revision counts, token usage, estimated cost and unresolved reservations. Separate model failure, reviewer omission, tool/measurement limitation, harness failure and application failure. Preserve incomplete attempts.

No scripted criterion replacement in fresh trials. If a proposal is incorrect, let the existing bounded repair mechanism operate and record it. A negative control that is merely held as unverified does not prove measured error detection; report that distinction. The initial comparison is too small to establish reliability rates; consistency repeats would be a separately proposed use of any remaining budget, not automatic extra trials.

## Spending proposal

**US$3 maximum aggregate for this comparison**, including executor, reviewer, criterion correction, diagnostics and unknown-charge reservations; **20 paid calls maximum** across the four primary requests. Stop before a new reservation would exceed either limit. No automatic credit reload or cap increase. Do not reuse the old uncapped campaign authorization.

Pricing basis is the preserved November 23 secondary model-price snapshot: [saved pricing](../workshop-reliability/recovery/live/pricing.json), sourced from [LiteLLM's model-price data](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json). It lists `gpt-6.1-sol` at **US$2/million input tokens and US$10/million output tokens**, with higher long-context rates of **US$4/US$15**. These are estimates, **not verified account-specific prices or an invoice**. Confirm current model availability and pricing before execution; if the basis changes materially, revise the proposal before spending.

Use the existing UTF-8 input upper bound plus image allowances and maximum-output reservation, at the higher US$4/US$15 rates with the existing 25% margin. Do not assume prompt-cache discounts. Log returned model, tier and visible usage; reconcile reservations only when usage is known. An interrupted request keeps its full reservation and unknown-charge label. If the remaining cap cannot safely reserve another request, stop and report the completed/unfinished trials.

US$3 is a proposed ceiling, not a prediction that it will all be spent or a guarantee that all trials fit. The November 24 expiring balance is no longer assumed available. Paid execution, merge and deployment each remain subject to separate approval.
