# Offline validation record

No API credentials were used. Browser servers used the existing no-key test configuration; scripted SDK fetch adapters supplied modeling choices. No application behavior was changed to obtain a particular demonstration geometry.

- Full local unit suite: **81 files, 429 tests passed**. [Log](evidence/unit-tests.log).
- Following the final strict tool-schema compatibility adjustment, **21 affected provider/inspection tests passed** again. [Log](evidence/final-inspection-tests.log).
- Final TypeScript/Vite production build: passed. [Log](evidence/build.log). Existing large-bundle warning remains.
- Production-bundle Chromium integration run: **10 tests passed** in 3.8 minutes. [Browser log](evidence/browser-tests.log). Includes the new workspace demonstration, existing incomplete-result repair, safe unverified commitment, recovery after failure, 144-object array behavior, Stop/cancel, camera/solar commands, and 244-component transaction conflicts under harmless UI changes and genuine concurrent edits.
- The final browser negative control uses an explicit preservation-only request and original-state preservation criteria, rather than reusing the preceding edit's target values. The full new workflow passed again on the production bundle in **37.2 seconds**, including creation, contextual edit, reload, Undo/Redo and the rejected unrelated edit. [Final workflow log](evidence/final-workflow-tests.log). This was a stronger test-driver control; application code was unchanged.
- `git diff --check`: passed before freezing.
- All four `.atelier.json` exports were read through the application's actual `readProjectCopy` and session parser: 9/9 objects for the mobile before/after, 3/3 for the housing before/after, with the expected Undo histories. The frozen diff passed `git apply --reverse --check`; file hashes and review ZIP contents were verified.

Evidence from the final successful production-bundle walkthrough is in `evidence/`. The logs identify exact test names and outcomes. Unit-test transfer evidence deliberately states that it does not exercise `App.tsx`. The initial development run and the broader browser regression run remain separately recorded; their outcomes are not counted as fresh-AI trials.

Preparation failures and corrections, not hidden application successes:

1. The first browser driver used `create_at` for sub-0.1 m parts. The existing primitive schema rejected it. The driver now uses the already available generic `assembly` operation, which permits these dimensions. The intended geometry was retained; no application limit was changed.
2. An initial unit fixture supplied strings to the numeric `makeVolume` index parameter. TypeScript caught it; a test-only named-object helper corrected the fixture.
3. The hollow-housing fixture initially omitted the existing confirmation argument for its setup hollow operation, and attempted to construct a cap below the standalone factory's minimum depth. The fixture now uses confirmed setup and a 0.12 m cap with the same 0.28 m clearance. These are test setup choices, not relaxed assertions or runtime changes.
4. A browser run completed creation, editing, reload and Undo/Redo, then timed out because its negative-control driver tried to open an orb after reload even though conversation was already open. The driver now checks visibility first.
5. One rerun overlapped the previous test's server teardown, losing the server and temporary trace files. That attempt failed as infrastructure, without model evidence. Subsequent runs were sequential and used fresh servers. A passing development run took 43.2 seconds for the whole workflow; this includes local rendering/reload and is not an AI latency estimate.

The six runtime files are `src/App.tsx`, `src/intelligence/client.ts`, `src/intelligence/sceneReference.ts`, `server/agent.ts`, `server/provider.ts`, and `server/sceneInspection.ts`. The geometry engine, completion evaluator, completion interpreter, execution limits, transaction guard and persistence implementation are unmodified. New tests and evidence remain outside runtime code.
