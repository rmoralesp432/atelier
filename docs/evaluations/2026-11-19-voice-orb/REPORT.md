# Voice-orb follow-up

After PR #23 was deployed and its release checks passed, the user requested much more visible orb motion during both microphone input and assistant speech. PR [#24](https://github.com/rmoralesp432/atelier/pull/24), source `8929d6c124c4644b0db451165dd6f91bb7142bcc`, limits the application change to the orb component and stylesheet.

The existing audio measurements now drive a stronger bounded swell and surface deformation, with a time-based attack/release envelope. Microphone gain and capture behavior are unchanged. Silence settles back to idle motion; reduced-motion settings are respected.

The build, audio-meter unit test and two focused browser tests passed. Real Web Audio signals with an offline WebRTC transport independently exercised microphone input and reply playback on a phone-sized Chromium viewport. The browser checks assert visible scale change, surface deformation, silence, mute, reduced motion, continued modeling while chat is minimized, and microphone shutdown. This is not a physical iPhone microphone test or a new live-AI evaluation. No paid API calls were made.

The full CI attempt passed 149 browser tests; one panorama test timed out while setting up its browser context, before its test body or application navigation. Its exact failure and all first-attempt annotations are retained. The same panorama case passed locally on unchanged code. Only the failed CI job is being retried; no application changes or acceptance reductions were made in response to that infrastructure failure.

Publication is pending the targeted CI retry. The stable PR #23 hotfix remains live at `aa9dd6126f3372774c1cee03558ef4dcb87afd27`, preserved by remote rollback tag `release/pre-pr24-2026-11-19`.
