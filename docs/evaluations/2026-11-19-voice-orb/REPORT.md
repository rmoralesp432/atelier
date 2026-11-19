# Voice-orb follow-up

After PR #23 was deployed and its release checks passed, the user requested much more visible orb motion during both microphone input and assistant speech. PR [#24](https://github.com/rmoralesp432/atelier/pull/24), source `8929d6c124c4644b0db451165dd6f91bb7142bcc`, limits the application change to the orb component and stylesheet.

The existing audio measurements now drive a stronger bounded swell and surface deformation, with a time-based attack/release envelope. Microphone gain and capture behavior are unchanged. Silence settles back to idle motion; reduced-motion settings are respected.

The build, audio-meter unit test and two focused browser tests passed. Real Web Audio signals with an offline WebRTC transport independently exercised microphone input and reply playback on a phone-sized Chromium viewport. The browser checks assert visible scale change, surface deformation, silence, mute, reduced motion, continued modeling while chat is minimized, and microphone shutdown. This is not a physical iPhone microphone test or a new live-AI evaluation. No paid API calls were made.

The full CI attempt passed 149 browser tests; one panorama test timed out while setting up its browser context, before its test body or application navigation. Its exact failure and all first-attempt annotations are retained. The same panorama case passed locally on unchanged code. The failed CI job then passed all 21 of its tests on unchanged code. All 150 unique browser tests, the 424-test unit suite, build, formatting and the aggregate check are green in [CI run 44564370719](https://github.com/rmoralesp432/atelier/actions/runs/44564370719). No application changes or acceptance reductions were made in response to the infrastructure failure.

## Deployment

Both requested updates are now live at https://atelier-emxi.onrender.com/.

- Production commit: `f925e4cef7b4c6a27eb1532476879728aa5d7584`
- Source tree matches tested PR #24 head `8929d6c124c4644b0db451165dd6f91bb7142bcc` exactly: `2efda5e47ddf0d66aa36b5fd8646591a8d808b5d`.
- Render deployment: `dep-dbvig9l9fdbs73bbeo20`, confirmed live for that commit.
- Rollback: stable PR #23 hotfix `aa9dd6126f3372774c1cee03558ef4dcb87afd27`, Render deployment `dep-dbvho3h5efls73drdt90`, remote tag `release/pre-pr24-2026-11-19`.

The first [production smoke attempt](https://github.com/rmoralesp432/atelier/actions/runs/44569973643/attempts/1) failed around deployment completion. Its job/step records and failure annotation are retained. Detailed logs were inaccessible: the artifact-storage redirect was forbidden by the Cloud environment's network policy. The precise initial cause remains unconfirmed; it is not represented as a diagnosed application defect or a proven infrastructure failure.

An [unchanged-code smoke retry](https://github.com/rmoralesp432/atelier/actions/runs/44569973643/attempts/2) passed after Render was fully live. It verified the exact public application bundle, health, configured agent, real editable geometry, preservation of the existing objects, persistence, reload and Undo/Redo. No rollback was needed. These are production browser checks with generation routes blocked, not a new paid AI/voice session.

The automatic duplicate post-merge regression workflows were still running when this report was recorded; their status is preserved in `automatic-postmerge-ci.json`. Release validation uses the green full suite on the byte-identical source and the passing production smoke test. No additional feature development was started.

The earlier verification hotfix's mathematical/unsupported-criterion correction and rejection of truly incorrect geometry remain covered by the full unchanged modeling regression suite and its preserved real-AI evaluation. [PR #23 deployment evidence](../../releases/2026-11-19-pr23-hotfix/REPORT.md) records that release separately.

## Remaining limits

Physical iPhone microphone/audio testing remains outstanding. The stronger orb motion honors Reduce Motion preferences. Material metadata expresses design intent, not physical certification. The precise first production smoke failure remains unknown because its detailed log could not be retrieved, although its full retry passed unchanged. No new OpenAI API spending occurred during either deployment or the orb update.
