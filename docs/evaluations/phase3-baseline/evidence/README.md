# Phase 3 evidence index

See [RESULTS.md](../RESULTS.md) for outcomes, limitations, exact spending and the single recommended improvement. Production was not changed.

## Readable records

- [analysis.json](analysis.json): per-turn outcomes, host/external findings, timing, costs, operations, feedback and preservation.
- [ledger.json](ledger.json): all 53 paid API calls, token usage, returned model, reservations and conservative reconciliation. `chargedUsd` is an estimated accounting field, not a confirmed invoice.
- [summary.json](summary.json): raw runner summary, including the retained original zero-call R infrastructure failure and the unsuccessful paid R retry.
- [COVERAGE.md](COVERAGE.md): request-clause coverage, unsupported host checks and grounded visual assessment.
- [criterion-coverage.json](criterion-coverage.json): generated requirements/citations, scopes, measurements and all R verification cycles.
- [repair-numerical-audit.json](repair-numerical-audit.json): exact erroneous reviewer targets versus independently derived correct positions; injected/repaired outcomes and original-ID preservation.
- [C2-first-candidate-replay.json](C2-first-candidate-replay.json): offline evidence separating an overly strict precision repair from an externally incorrect model.
- [execution-freeze-v1.json](execution-freeze-v1.json), [execution-freeze-v2.json](execution-freeze-v2.json): evaluated file hashes, model, limits and authorization. V2 changes only the runner for evaluator loading/retry bookkeeping.
- [visual/manifest.json](visual/manifest.json): source snapshots, included/excluded IDs and all offline views. Full application screenshots are also archived.
- [projects/](projects/): six final geometry-only project files in ATELIER's ordinary project format, round-tripped with exact component/group data. Full conversation and modeling history remain in the archived sessions/browser states.

## Complete preserved archive

`phase3-baseline-evidence.tar.gz` contains:

- `live/`: exact paid request bodies (without authorization headers), raw OpenAI responses, all results, initial and final project snapshots, browser storage, reload/Undo/Redo states, screenshots and R stages/fault evidence. Original attempt-1 results/summary/ledger remain separately saved; the active ledger was never reset.
- Both execution freezes, all numerical calibration attempts and logs, offline browser/renderer checks, type/build/spending-guard logs, and main/retry logs.
- Offline analysis/render helper scripts and resulting numerical/visual evidence.

The private account-balance note, API keys, environment files, cookies for external services, dependency directories and runner locks are excluded. All tested projects are isolated synthetic evaluation projects. A credential scan of the selected evidence is recorded in `evidence-validation.json`.

Integrity hashes are in `SHA256SUMS`. Verify from this directory with `sha256sum -c SHA256SUMS`. To inspect the archive without modifying a checkout, extract into a fresh directory:

```sh
mkdir -p /tmp/atelier-phase3-evidence
tar -xzf phase3-baseline-evidence.tar.gz -C /tmp/atelier-phase3-evidence
```

The source runner and external measurements are committed on `eval/phase3-intelligence-baseline`. Original application commit: `f925e4cef7b4c6a27eb1532476879728aa5d7584`. Original frozen evaluator commit: `ca31c109ef54b0ecd28f7028db70cdcf1d426bd1`; repair-only revision: `4f1ef8b6bcf5674a9e0e5dffa22540bd0b4f29be`. The source and both failed/successful intermediate states are available for future offline regression work.

**Do not rerun paid commands merely to inspect this evidence.** A future experiment needs its own explicit authorization and fresh held-out tasks after the proposed improvement is frozen. The unused portion of this ceiling is not blanket authorization for another development milestone.
