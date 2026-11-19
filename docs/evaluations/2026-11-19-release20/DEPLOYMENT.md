# Demonstration release deployment

ATELIER is deployed at **https://atelier-emxi.onrender.com/**.

- PR: [#22](https://github.com/rmoralesp432/atelier/pull/22), merged into `feat/phase2-conversational-modeling`.
- Production commit: `acf5ed9ccdb298d2853d139ce5cdf0fc35e24c36`.
- Render deployment: `dep-dbvfejd9el5s73bnu1m0`, reported `live`, completed 2026-11-19 at 13:20:58 UTC.
- Rollback: `release/pre-pr22-2026-11-19`, commit `9bb6ad42997979f3b55b8218a1c9dcfd22f61dff`, previous Render deployment `dep-dbv0t20m7kps739tcp5g`.

## Acceptance evidence

The [focused real-AI evaluation](RELEASE-EVALUATION.md) created 237 independently editable components, committed them, and increased the ground-floor height by 1.1 m while preserving all component identities and an unrelated object. External independent measurements passed 22 creation checks and 499 modification checks. Both transactions survived reload and retained working Undo/Redo and conversation context.

The first modification attempt stopped because the evaluation harness incorrectly required a preview badge for a single batch that remained private until verification. The corrected harness resumed with the exact already-paid executor and reviewer responses in the same restored project. It did not invent a response or make another paid call. The original failed attempt remains archived.

Built-in independent verification remained explicitly incomplete for these two requests: one reviewer exhausted its output allowance, and another emitted an unresolved preservation selector. The external measurements support these particular results; this release does **not** claim the built-in verifier certified them completely or that every future request can be fully verified.

[Required CI run 44527192732](https://github.com/rmoralesp432/atelier/actions/runs/44527192732) passed on the exact PR head, including validation and all eight browser shards. The merged application, server, dependencies and browser tests are identical to that tested head. Local validation passed 407 unit tests and 14 evaluation-harness tests.

The two failures from run 44465753546 were browser-test timing problems: unnecessary screenshot element-stability waiting under software rendering, and a 30-second overall allowance for a four-turn language/reload sequence. Screenshot pixel/coverage checks and per-assertion language checks remain intact. The corrected shard passed all 18 tests. A separate general-purpose agent correction recognizes truncated provider output, executes none of its partial operations, and requests a smaller valid continuation without increasing operation limits or weakening verification.

## Production smoke

[Production smoke run 44533227199](https://github.com/rmoralesp432/atelier/actions/runs/44533227199) passed the actual public-browser smoke step. It confirmed the expected JavaScript/CSS build, HTTP health, configured agent mode, creation of editable geometry through the interface, preservation of existing objects, persistence, reload, Undo and Redo, with no browser exceptions. The smoke used fresh browser storage and blocked generation requests: **zero paid API calls**. Production AI configuration was checked; the real-AI generation evidence comes from the acceptance sequence on identical application code.

The first two smoke attempts in run 44532155338 failed without a useful diagnostic. The successful run added diagnostic reporting to the smoke harness only; no deployed application code or acceptance criterion changed. Their precise cause remains undetermined. Those failed run records are retained rather than relabeled as passes. The successful run's screenshot/result artifact is linked from GitHub Actions.

The Cloud workspace cannot access the public Render origin or GitHub's artifact/log storage domains directly. The smoke therefore ran in the repository's normal GitHub Actions runner. Render deployment records and GitHub job/check records are preserved in the accompanying release evidence.

## Cost and remaining limits

Aggregate reconciled API usage is **US$2.937918 estimated**. Two older calls have unknown actual charges, retaining the original **US$0.62** allowance and **US$0.22113** reservation. Conservative aggregate accounting, including the safety margin, is **US$4.5135275 of the authorized US$20**. These allowances are not confirmed charges. The focused sequence used six new calls estimated at US$0.832966; the harness resume and production smoke spent nothing further.

Physical iPhone microphone and continuous-voice behavior still require a real-device test. The intermittent desktop black viewport band remains unreproduced; automated viewport coverage passed. Incomplete built-in verification must remain visible to users. These limitations are disclosed for the demonstration; no known false geometry certification, project corruption or loss of Undo/Redo was observed in this release sequence.

The demonstration checkpoint is complete. No new modeling milestone was started.
