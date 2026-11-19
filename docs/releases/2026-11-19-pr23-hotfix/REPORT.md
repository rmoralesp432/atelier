# PR #23 — production hotfix release

The user approved merging and deploying PR #23 after the focused hotfix evaluation. No additional product features or paid AI evaluations were introduced during release.

## Source and deployment

- Application: https://atelier-emxi.onrender.com/
- PR: https://github.com/rmoralesp432/atelier/pull/23
- Tested head: `793e943dd6f754d01fdb0971621367c6de84e508`
- Production merge commit: `aa9dd6126f3372774c1cee03558ef4dcb87afd27`
- Both commits have the identical source tree: `7b4114e9b049db88280f7ddb1de64f6a5c7ce0fa`.
- Existing deployment branch: `feat/phase2-conversational-modeling`
- Render service: `srv-db7vilu89jmc73dh9d40`
- Render deployment: `dep-dbvho3h5efls73drdt90`
- Render reported `live` for the intended commit; deployment finished at `2026-11-19T15:57:47.972496Z`.

The premerge check confirmed the PR still pointed to the tested head, its base remained the previous production commit, every required check was successful, and no conflicting source change had appeared. The merge was pinned to the expected head. No application code was changed during deployment.

## Rollback

The previous production release remains recorded and tagged:

- Commit: `acf5ed9ccdb298d2853d139ce5cdf0fc35e24c36`
- Render deployment: `dep-dbvfejd9el5s73bnu1m0`
- Remote annotated Git tag: `release/pre-pr23-2026-11-19`

If rollback becomes necessary, the existing Render service can redeploy that exact commit. No rollback was required by the completed production smoke test.

## Validation

The final premerge [CI run](https://github.com/rmoralesp432/atelier/actions/runs/44555128482) passed the complete unit suite (424 tests), build, formatting, all 150 browser tests, and the required aggregate check. Mathematical contradictions, material capability mismatches, bounded independent criterion correction, supported geometry failures, preservation, uncertainty, persistence and Undo/Redo are covered by these tests.

The [production smoke run](https://github.com/rmoralesp432/atelier/actions/runs/44560286488) passed against the actual public Render URL and the merge commit. It:

1. Waited for the public HTML to reference the exact freshly built asset hashes.
2. Confirmed HTTP health and that the server reports AI and agent mode configured.
3. Opened a fresh Chromium session and created a real editable 4 × 4 × 12 m cylinder.
4. Checked its dimensions and that both original components remained unchanged.
5. Verified committed local persistence, reload with identical geometry, Undo to the original scene, and Redo to the committed scene.
6. Found no browser page errors. All paid-generation routes were blocked in the smoke browser.

Production browser checks ran on the existing GitHub runner. The Cloud environment's domain policy blocks direct access to the application, even after the turn-level network grant; no alternate proxy or policy bypass was used. The successful job, all step outcomes and its Checks API notice are preserved. Artifact download was blocked by network policy, so the production screenshot and raw result remain attached to the GitHub run rather than copied into this release archive.

Automatic [post-merge full CI](https://github.com/rmoralesp432/atelier/actions/runs/44560286313) also **passed**, including every browser shard and the aggregate check, on the deployed merge commit. The production release checkpoint is complete.

## Completion verification evidence

The hotfix source was already tested with real GPT-6.1-sol, the actual modeling engine and independent measurements. The unfamiliar assembly committed, preserved original objects and survived reload and Undo/Redo. Controlled reversed-offset and unsupported-material checks were corrected independently without moving correct geometry. A deliberately displaced component remained incorrect and commit was disallowed. A separate scripted browser regression confirmed that an unresolved unsupported criterion retained explicit uncertainty while safe additions committed. These are not claims of a new paid reasoning test in production.

The deployed bundle matches that tested source exactly. The production smoke establishes served-version integrity, basic modeling, commit persistence and history; the prior real-AI evaluation and the criterion regression tests establish the independent verifier's behavior. See the [preserved evaluation report](https://github.com/rmoralesp432/atelier/blob/01d0962a2c9f1484d48e2ba1a6df5fb02b057b07/docs/evaluations/2026-11-19-criteria-hotfix/REPORT.md) for the distinction between original live reasoning, controlled criterion fault injection and saved-response replay on the final source.

## Spending and limitations

- Additional OpenAI calls during deployment: **0**, additional spending: **US$0**.
- Earlier hotfix evaluation remains US$0.094304 estimated usage, US$0.11788 conservative accounting against its US$2 ceiling, with no unknown new charges.
- Material designations express stored design intent; they do not physically certify composition or engineering performance.
- The mathematical audit establishes contradictions in its supported measurement contracts; it is not a universal proof of natural-language interpretation.
- Physical iPhone microphone testing and the previously intermittent desktop viewport issue remain outside this focused hotfix's validation.
- No next development milestone was started.
