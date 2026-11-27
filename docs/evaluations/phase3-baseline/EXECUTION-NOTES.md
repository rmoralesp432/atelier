# Execution record — 23 November 2026

The stable application remains `f925e4cef7b4c6a27eb1532476879728aa5d7584`. Only evaluation code and evidence are changed on this branch.

## Repair-control infrastructure interruption

All twelve A–F turns finished under the original execution freeze. The first R1 attempt then failed **before any model request**, while preparing its neutral geometry observation:

`Failed to fetch dynamically imported module ... /node_modules/manifold-3d/manifold.wasm?url`

Vite rejected the library's resolved path because this isolated worktree links `node_modules` to the existing checkout. The production bundle used by A–F does not have this evaluation-server dependency-loading path. This is an evaluator failure, not evidence of a modeling or repair failure.

Correction: allow the worktree and the resolved dependency directory in the evaluation-only local Vite server. A new offline preflight exercised the exact repair renderer and real geometry kernel, and successfully rendered both observation views. Evaluator TypeScript checks passed.

The original `R1: REPAIR_NOT_COMPLETED`, error, zero-call cost, stage snapshot, log, full results, summary, ledger snapshot and v1 execution freeze are retained. No result is relabeled as a success. A separate `R1-attempt-2` runs only the repair control, using the same prompt, seed, oracle, fault displacement, actual model, reasoning settings, app code and spending ledger. Its calls share the original US$2 repair allocation within the US$15 aggregate ceiling and 60-call campaign limit.

The v2 execution freeze permits only the evaluator runner hash to differ from v1. Every other frozen file is checked unchanged. The first twelve paid turns are not repeated, and no geometry acceptance condition is weakened. The revised runner includes explicit retry/version bookkeeping so neither evidence nor accounting is overwritten.

The live retry completed its evaluation but **failed the end-to-end repair objective**. It detected and repaired the injected geometry error; two incorrect reviewer-generated coordinates then prevented commitment. The corrected private geometry passed the independent measurements and retained all other objects exactly. This application-level negative result is preserved without another paid reroll or an application fix. See RESULTS.md and the numerical audit.

## Read-only analysis correction

An offline replay analysis initially tried to read a raw session snapshot with the application's compact persistence decoder, which correctly rejected that file format. Reading the raw snapshot as JSON resolved it. This diagnostic made no paid requests and did not alter live results. The corrected replay of C2's first candidate passes the original frozen external oracle; its small position deviations came from coordinated-edit millimeter rounding, whereas the generated reviewer required 0.1 mm precision. Preserve that distinction when counting autonomous repairs.

The archive credential scanner initially blocked a long `sk-`-shaped substring inside an opaque API `reasoning.encrypted_content` response. Field-level inspection established that this was encoded response content, not a plaintext credential. Validation continued to scan every byte for configured secret values, and scanned all non-opaque fields for generic credential patterns. No credential was found and no raw response was edited. The initially empty archive was replaced only after validation; `evidence-validation.json` records this exception.

The first final checksum command ran from the repository root rather than the evidence directory required by its relative-path manifest. Re-running it from the documented directory validated all 42 files. The compressed archive was also checked byte-for-byte against all 270 selected source files. Neither issue affected model calls, measurements or scoring.

## Boundaries

No application behavior, production data, deployment configuration or API pricing assumption changes are authorized or made here. Physical microphone/iPhone behavior and reference-image reconstruction are outside this frozen baseline. Published future ideas remain reserved ideas, not held-out evidence.
