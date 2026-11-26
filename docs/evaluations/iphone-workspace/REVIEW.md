# iPhone workspace and glass orb — separate interface change

Prepared November 26, 2026 on `feat/iphone-workspace`, starting from production `f925e4cef7b4c6a27eb1532476879728aa5d7584`. This branch does not contain or modify frozen `711a8cf`, and does not implement the proposed design-intent milestone. No paid API calls, merge or deployment.

## What changed

- A labeled bottom dock puts Objects, Create, Chat and Tools within thumb reach, with the existing live voice orb in the center. Tapping the orb still starts/stops voice; double-tapping still opens chat. Chat also has a direct, discoverable button.
- A quieter top bar contains the project, Undo/Redo and Explore. Appearance keeps its own sheet; the duplicate floating theme toggle is removed on phones.
- Conversation, object tools and settings share consistent rounded sheets, readable type and at least 44 px primary touch targets. Chat has one surface with scrolling history and a persistent composer. Opening another dock action preserves an unsent draft.
- Safe-area spacing accommodates the home indicator and notch. Visual-viewport changes lift the composer above a Safari-style keyboard without remounting the workspace or changing model/camera state. While typing a voice clarification, mute and end-voice remain reachable. Pinch zoom does not trigger the keyboard lift.
- The entrance and project list have simpler grouped surfaces. Project switching keeps the existing storage and confirmation behavior.
- The monochrome orb has more visible deformation, stronger volume shading and moving highlights clipped to the same surface. Measured microphone and reply audio drive the increased response. The idle cycle is 10 seconds rather than 14; thinking remains a distinct visual state. Reduced motion pauses SVG contour animation and removes CSS/audio-driven movement.

The orb is an SVG rendering with a three-dimensional appearance, not another WebGL context. Audio capture, transcription, provider routing, geometry, verification and transaction code are unchanged. The phone viewport helper updates CSS variables only; it does not resize the saved model or navigate projects.

## Validation record

The full unit suite passed **424 tests across 80 files**. The selected production-build browser suite passed **22/22 tests** in 7.7 minutes. Build and repository formatting checks passed. No paid API credits were used. This is local validation, not a claim that the complete remote CI matrix has run on this separate interface branch.

Commands and raw output:

- `npm test`: [unit log](validation/unit.log).
- `npm run build`: [build log](validation/build.log).
- `npm run format:check`: [format log](validation/format.log).
- `ATELIER_TEST_PRODUCTION=1 npx playwright test tests/phone-workspace.spec.ts tests/project-start.spec.ts tests/orb-conversation.spec.ts tests/voice-permission.spec.ts tests/workspace-lifecycle.spec.ts tests/viewport-coverage.spec.ts tests/interface-refinement.spec.ts tests/projects.spec.ts`: [22-test browser log](validation/browser.log).

Final results are recorded in [validation](validation). The selected browser suite covers phone dock actions and actual shape creation, identities/unrelated geometry, draft retention, portrait/landscape/small-screen layouts, reload, Undo/Redo, project transfers, startup/password entry, continuous voice, microphone denial, interrupted modeling, language continuity, and canvas coverage through DPR/zoom/layout changes.

The browser's voice tests use synthetic input/output audio and an offline transport, not a real microphone or paid AI. They verify that **each audio direction** drives visible scale/deformation, mute silences the input response, reduced motion stays still, consecutive modeling commands retain the minimized conversation, and stop releases recording tracks. The keyboard test substitutes visual-viewport metrics; it is not a claim of physical iPhone keyboard validation.

The first run is retained in [validation/attempt-1](validation/attempt-1). It found:

1. Two incorrect accessible-name/role assumptions in newly adapted tests (`Close studio` and `Scene objects` as a region). Tests now use the actual close-button name and objects heading.
2. A test read the SVG reduced-motion state before the media-query change event arrived. It now waits for the observable paused state; the requirement was not weakened.
3. A real interaction regression: hiding the footer while chat was open also hid Undo/Redo. The final layout keeps Undo/Redo directly available in the top bar. The existing interrupted-modeling test remains unchanged and checks this path.

Late styling adjustments to the dock's landscape width and project sheet were included before the final build and browser pass. The first run was not rewritten as successful. Initial video capture also found Playwright's optional bundled FFmpeg absent; a temporary evaluation-only link used the installed system FFmpeg. No dependency or application setting was changed for capture.

The [second run](validation/attempt-2/browser.log) exposed a follow-on header stacking issue: relocated Undo/Redo were in the footer's lower stacking context and could be covered by the header. A first adjustment remained below the header's actual layer 50; [attempt 3](validation/attempt-3/browser.log) was stopped when a direct browser hit test confirmed that the header still intercepted the buttons. The final footer layer is 60, while its noninteractive area remains transparent to pointer events. These interrupted tests are not counted as passes. The final run retains the original touch deletion/Undo and active-modeling regression tests.

The final screenshot review found a small volume-count label overlapping an open action sheet. One CSS rule now hides that label while phone sheets are open, leaving the top-bar history controls accessible. This presentation-only adjustment was made after the 22-test build. After rebuilding, all **six phone/interface browser tests passed again** in 1.6 minutes; see [the polish log](validation/browser-polish.log). These are repeats of existing checks, not six additional independent capabilities.

## Visual review

- [Welcome screen](preview/welcome.png) and [project list](preview/projects.png)
- [Workspace](preview/workspace.png), [conversation](preview/conversation.png), [Appearance](preview/appearance.png), [Tools](preview/tools.png)
- [Eight-second animated orb preview](preview/orb-idle.mp4): actual idle rendering, no simulated speech in the clip
- [Speaking orb](validation/atelier-orb-speaking-phone.png), [keyboard metrics](validation/iphone-keyboard-metrics.png) and [phone model creation](validation/iphone-dock.png) from the automated browser checks
- Previous [workspace](preview/before-workspace.png) and [project list](preview/before-projects.png) for comparison

These captures use a 390 × 844 touch browser. The sample model is the existing editable pavilion; no model recipe was added for the interface change.

## Remaining limitations and review boundary

This is a browser interface designed for phone use, not a native iOS application or an offline installation system. Physical iPhone Safari microphone permissions, audio routing, background/resume and on-screen keyboard/safe-area behavior still need hands-on validation. Chromium touch emulation and synthetic viewport changes do not establish all WebKit behavior. The intermittent previously reported desktop clipping issue is not claimed to be independently reproduced or permanently solved here.

Review this interface branch separately from the frozen verification release. The separate [711a8cf review](https://github.com/rmoralesp432/atelier/blob/1fab92b/docs/release-reviews/711a8cf/REVIEW.md) documents that candidate's packaging/CI gate. No source in this branch resolves that gate or changes the modeling agent. Merge and deployment remain pending explicit authorization.

The application and test diff is included as [interface.diff](interface.diff). It is based on the production commit above and includes the new phone layout files. Captured evidence is kept separately from application implementation.
