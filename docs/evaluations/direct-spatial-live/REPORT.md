# Fresh-AI comparison: 0527761 vs 711a8cf

Completed November 26, 2026. **All four primary edits saved correct geometry, and all four deliberately wrong proposals were blocked by measured geometry failures. Both versions passed.** No application changes, merge or deployment were made. The frozen implementations and evaluation checksums were rechecked after scoring.

This is the approved four-run comparison, not a new development milestone. The unfamiliar fixtures, natural requests, independent measurements and spending rules were fixed before paid execution. See the [protocol](../direct-spatial/FRESH-AI-PROTOCOL.md), [preparation record](PREPARATION.md), [frozen checksums](LIVE-FREEZE.json), and [machine-readable scorecard](scorecard.json).

## All four primary runs

| Run | Agent inspected the starting geometry | Reviewer independently selected an adequate spatial check | Actual editable geometry | Browser save and history | Dependent negative control |
| --- | --- | --- | --- | --- | --- |
| A · `0527761` | Yes, original assembly relative to canopy | Yes: canopy displacement, preserved lower ends, actual solid contact at both ends | Correct; 101/101 external checks | Committed once; reload, Undo, reload while undone, Redo passed | **Measured rejection** of shortened suspension; original project/history intact |
| A · `711a8cf` | Yes, original assembly and unrelated samples | Yes: canopy displacement, original endpoint offsets, actual solid contact | Correct; 101/101 external checks | Committed once; reload, Undo, reload while undone, Redo passed | **Measured rejection** of changed endpoint offset and missing contact; original project/history intact |
| B · `0527761` | Yes, original scene relative to first yoke | Yes: original X positions plus/minus half the requested opening, preserving other properties | Correct; 54/54 external checks | Committed once; reload, Undo, reload while undone, Redo passed | **Measured rejection** of displaced knob; original project/history intact |
| B · `711a8cf` | Yes, original jig and unrelated samples | Yes: symmetric yoke displacement plus original XYZ offsets for each attached part | Correct; 54/54 external checks | Committed once; reload, Undo, reload while undone, Redo passed | **Measured rejection** of changed knob-to-yoke offset; original project/history intact |

There were **no incomplete primary runs, unstarted runs, not-reached controls, unresolved-only control blocks, false acceptances or false rejections** in this sample. No geometry repairs or criterion retries were needed in the primary runs. Every executor independently called `inspect_scene` with `snapshot: before` before executing its edit. No run requested clarification.

### A — suspended kinetic assembly

Both versions received: “Raise the canopy by 28 cm, keeping the pendants where they are. Adjust their existing suspensions so the connections are maintained. Keep the same pieces and leave the two objects beside it alone.”

The existing 19-object scene contained a canopy, eight suspension members, eight ellipsoidal pendants and two unrelated samples. Both versions changed the same nine objects: the canopy moved from base Y = 2.75 m to 3.03 m, and each suspension extended upward by 0.28 m with its lower end fixed. All eight pendants and both samples remained unchanged. All 19 original identities and groups survived; the parts remained independently editable.

Both independent reviewers expressed the canopy expectation as **original Y + 28 cm**, which the host evaluated in world XYZ, Y-up, in meters. The baseline checked preserved lower endpoints plus physical touching. The treatment additionally selected `preserve_offsets` for each suspension's lower endpoint to its original pendant and upper endpoint to the canopy. Expected offsets came from the pre-edit solids. Actual touching remained a separate check; a bounds offset was not treated as proof of contact.

The negative shortened Suspension 3 by **15 mm**, retaining its lower end. Both exact fresh criterion sets measured a missing upper connection and blocked saving. The treatment also measured the changed upper endpoint offset. The unchanged original project and Undo/Redo history survived rejection and reload.

### B — adjustable mechanical jig

Both versions received: “Open the gap between the yokes by 46 cm, equally on both sides. Take their shields and adjustment knobs with them, keeping the existing offsets. Keep the base and the two sample objects where they are.”

The 13-object scene contained two yokes, two curved mesh shields, six ellipsoidal knobs, a base and two unrelated samples. Both versions moved the correct five-part sets by −0.23/+0.23 m along X. The clear opening increased from **1.26 m to 1.72 m**. The base and samples were unchanged, all 13 original identities remained, and all original attached-part XYZ offsets, shapes and orientations were preserved.

The baseline reviewer correctly calculated **each moving object's original world X ± (46 cm / 2)** and preserved its other properties. This is a valid equivalent way to establish the requested offsets for this translation. The treatment calculated only the two yoke target positions, then selected three reusable `preserve_offsets` checks for world X, Y and Z. The host paired the eight attached parts with their original yokes and calculated **original anchor(second) − original anchor(first)**. These expectations were independent of the candidate geometry, including the curved shields' actual bounds centers.

The negative moved Adjustment knob 2 outward by **20 mm**. The baseline measured X = −1.09 m against expected −1.07 m. The treatment measured the knob/yoke X offset as **0.14 m against the original 0.12 m**. Both blocked saving under the same **0.001 m** tolerance, and retained the original project/history through reload. The actual browser's feedback classified both as `incorrect`; this was not merely an offline report or an unresolved-verification block.

## What the difference establishes

Fresh reviewers used the new relationship mechanism without being told which predicate to choose. It transferred to both endpoint relationships and a mechanical assembly with curved editable meshes. The baseline also succeeded, using existing contact checks or individual original-position calculations. **This comparison therefore demonstrates successful fresh selection and safe use of the new capability, not an accuracy improvement over the baseline.**

For the jig, the treatment required six reviewer criteria instead of eleven; reviewer output was 1,789 tokens instead of 2,893. Its observed reviewer call took 28.23 s versus 45.39 s. This is useful evidence of a more compact expression of the relationship, but one run per version cannot establish a repeatable speed or cost advantage.

## Calls, time and accounting

| Run | Paid calls (executor / reviewer) | Reviewer time | Reviewer output tokens | Estimated usage cost | Conservative accounted cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| A · `0527761` | 2 / 1 | 18.76 s | 1,148 | $0.139620 | $0.174525 |
| A · `711a8cf` | 2 / 1 | 15.21 s | 906 | $0.140226 | $0.175283 |
| B · `0527761` | 2 / 1 | 45.39 s | 2,893 | $0.137904 | $0.172380 |
| B · `711a8cf` | 2 / 1 | 28.23 s | 1,789 | $0.128124 | $0.160155 |
| **Total** | **8 / 4 = 12 of 20 allowed** | **107.58 s** | **6,736** | **$0.545874** | **$0.6823425 of $3 allowed** |

Returned usage: **224,752 input tokens and 9,637 output tokens**, including billed reasoning tokens where reported. Every call returned `gpt-6.1-sol`, default service tier, completed status and reconcilable usage. **Unknown charges/reservations: none.** Maximum simultaneous conservative exposure immediately before a call was **$1.3590725**, below $3. No automatic recharge action was taken.

The free access check succeeded and the secondary pricing snapshot still matched the approved estimates: $2/M input and $10/M output; pre-call reservations used $4/M input and $15/M maximum output plus 25%. Reconciled accounting retained the 25% margin and assumed no cache discount. These are **usage-derived estimates, not a confirmed invoice or account balance**. See [preflight](preflight.json), [spending](spending.json), and [complete ledger](live-1/ledger.json).

Reviewer times above measure API round trips. Whole trial times were 72.33 s / 67.40 s for A baseline/treatment and 91.96 s / 74.85 s for B baseline/treatment; these include local browser setup, external measurements, persistence checks and negative-control replay, so they are not pure user-response latency.

## Evidence and limits

- [All primary/control records](live-1/results.json), [raw provider requests/responses](live-1/calls), [external measurements and host reports](live-1/measurements), [portable editable projects](live-1/projects), and [artifact hashes](evidence-manifest.json) are preserved. Large JSON files are downloadable through GitHub's **Raw** link.
- Treatment screenshots: [A before](live-1/A-treatment-before.png), [A after](live-1/A-treatment-after.png), [B before](live-1/B-treatment-before.png), [B after](live-1/B-treatment-after.png). The standard conversation UI partially overlays the model in after-images; numerical solid checks and saved project files supply the detailed geometry evidence.
- Positive runs used fresh AI through unmodified local builds of the real browser application and server provider. Identical fixture sessions and neutral history were seeded before requests; only the welcome screen was skipped using the existing user preference. Real application commits and browser persistence were checked, separately from the harness's proposal replay. The portable project exports were also parsed back and compared exactly with the captured sessions.
- Negative controls deliberately reused saved successful executor operations and the exact fresh reviewer criteria, with the agreed perturbation. They made **no paid calls** and did not script successful repairs. They demonstrate measured rejection and transaction preservation, **not fresh autonomous correction**.
- Offline rehearsals used scripted plans and checks solely to calibrate the harness. Their shared artifact labels do not make them fresh-AI evidence. No live harness/provider/browser failures occurred, and no scored attempt was retried or overwritten.
- External expectations were derived from the request and original solids, independently of reviewer-produced checks. They use the existing geometry kernel, not a second independent CAD implementation. Position/offset tolerance remained 1 mm and the existing round-solid tessellation allowance remained 2%.
- This is two contextual edits, once per version, in desktop Chromium. It does not establish reliability across large assemblies, arbitrary geometry, repeated trials, physical phones, voice, production hosting or fresh model creation. Complete coverage of every possible incorrect variant is not claimed.

**Recommendation:** `711a8cf` passed this focused evaluation and is ready for a separate merge/release review. The evidence supports retaining the reusable relationship check; it does not justify claiming that the overall modeling agent is now more accurate. Keep both implementations frozen until that decision. No additional milestone or paid trials were started.
