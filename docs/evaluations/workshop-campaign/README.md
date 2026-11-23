# ATELIER workshop campaign — running evidence

Evaluation only; no application behavior, production branch or deployment changed.

## Published batch: console creation and follow-up

**Both versions created and committed a coherent, grouped, four-piece console.** The original paid creation runs passed every independent geometric check, but their browser persistence checks hit evaluator issues. Those interrupted records remain unchanged. Using the actual saved AI-created consoles and conversation, fresh follow-ups then ran through the browser; creation restoration and the edited results both passed reload and exact geometry/context Undo/Redo checks.

| Boundary | Stable baseline | `f5ba626` |
|---|---|---|
| Creation | Correct four editable solids and preserved reference objects | Same |
| Starting-model inspection during follow-up | Used available scene context; no explicit inspection call | Independently called `inspect_scene` with `snapshot: before` and the top as relative reference |
| Follow-up intent | Widen by 42 cm while preserving overhangs and connected parts | Same |
| Independent feedback | Detected a stretcher connection issue; fresh agent attempted repair | Same |
| Final measurement | Committed; supports and stretcher shifted 0.5 mm toward +X relative to the ideal centered edit | Passed all frozen external checks |
| Identities / unrelated objects | Preserved | Preserved |
| Reload / single Undo / Redo / conversation / camera | Passed in resumed browser workflow | Passed in resumed browser workflow |

The baseline's 0.5 mm displacement fails the frozen occupied-solid comparison for the thin support slabs, although it is below the protocol's general 2 mm position allowance. Preserve the strict result and actual measured discrepancy; **do not describe this as materially wrong architecture or strong statistical evidence of superiority**. It is a small precision difference. Both are usable edited consoles, and one matched pair is insufficient to establish reliability. The second arm spent more calls inspecting the original state; its final placement was exact under these measurements.

One extra baseline fixture-based edit was run by the initial harness after its persistence assertion. Its geometry passed, but it is a separately seeded diagnostic, not an end-to-end success. A baseline W2 attempt started before the coordinator stopped for the harness correction; it remains interrupted and will be rerun with the corrected harness. All charges are retained.

This published segment includes **18 calls, estimated $0.622392**, with usage returned for all calls and no unknown-charge reservation. Includes initial failures, the diagnostic and the interrupted W2 call. Estimated rates are $2/M input and $10/M output from the secondary pricing snapshot; not a confirmed invoice. The ongoing campaign totals are in [spending.json](spending.json).

## Reviewable evidence

- [Frozen protocol and scoring](PROTOCOL.md)
- [Current evaluation hash manifest](FREEZE.json), [original manifest](FREEZE-v1.json)
- [Boundary-by-boundary console results](console-boundaries.json)
- [Initial interrupted results](workshop-1-results.json), [resumed follow-up results](console-resume-results.json)
- [Full console traces, API usage, editable scene snapshots, screenshots and browser persistence evidence](artifacts/console-evidence.tar.gz)
- [Evaluator corrections, retained failures and their limits](HARNESS-CORRECTIONS.md)
- [Offline geometric calibration](offline-geometry-v2.json), [browser calibration](offline-browser-v2.json), [camera numeric calibration](camera-calibration.json)

The remaining architecture, mechanical and sculptural workshop tasks are running. The `433d9ba` verifier comparison remains a separate batch. No recommendation to merge or deploy is implied by these interim results.
