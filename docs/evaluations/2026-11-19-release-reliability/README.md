# PR #22 — final focused reliability pass

Application candidate: **`e9e3aae86e559ed9131609e2a2f3eb3e75299fba`**. Baseline: `cac373ac63a96222568123ed0a8ee1812648ec07`.

No paid OpenAI requests, merge, Render configuration change or deployment was performed. PR #22 remains a draft. This report separates reproducible browser/engine evidence from real-AI and physical-device evidence that is still pending.

## Reproduced defects and corrections

### Completed modeling rejected by the session guard

Reproduced the exact “The scene changed while I was considering this request. Please send it again.” message on the baseline in a real browser. A multi-stage edit had successfully computed the new geometry for 244 building components. While its next stage was held, selecting an unrelated neighboring object in Objects changed `selectedId`/`selectedIds` and `context.focusIds`. The full `serializeSession(snapshot())` comparison then rejected the result. Saved geometry and history remained unchanged. This establishes a real false-conflict path; it does not prove which UI event triggered the user's particular four-story session without its trace.

The old request snapshot also shared mutable context/history containers with the live workspace. Selection could change an outstanding request's `$focus` binding, while Undo could mutate a captured history array. The request now captures its own context, selection list and history containers while sharing immutable geometry buffers.

The new transaction check compares persistent model data and both history stacks. It ignores selection/focus for conflict detection, then preserves the user's newer valid selection on commit. It installs the verified candidate once, retaining component IDs and the existing one-request Undo boundary. Destructive review descriptions use the frozen request targets, and the existing review-confirmation check remains strict.

| State change during execution                                                                       | Treatment                                                                                           |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Selection, conversational focus                                                                     | Does not invalidate geometry; request targets remain frozen and newer UI selection survives         |
| Camera, viewport, panels, chat, provisional preview                                                 | Outside the persistent model comparison                                                             |
| Autosave, message persistence, save status                                                          | Do not mutate the model/history being guarded; regression exercises autosave while awaiting a stage |
| Actual geometry, identities, materials, visibility, grouping, locks, site or persistent design data | Conflict; never silently overwrite a concurrent edit                                                |
| Undo/Redo stack contents                                                                            | Protected because replacing them would lose user history even if current geometry looked similar    |

On a real conflict, the current project and its history remain authoritative. The completed candidate is retained separately and can be downloaded with its IDs and Undo history using **Save completed result**. It is not merged into concurrent edits or re-executed using fresh IDs. This recovery copy is in memory, limited to the latest conflict; save it before leaving/reloading or another conflict. It is not an automatically persisted second project. Working geometry is explicitly labeled **Working preview · not saved yet**.

### AI context lost on reload above 200 referenced components

Strengthening three existing real-geometry component-generation tests exposed a separate persistence mismatch: the saved geometry reloaded, but `focusIds`, `lastCreatedIds`, `lastOperands` and `lastOperation` were discarded when any reference array exceeded 200 items. One reproduced fixture had 611 components. Session parsing now uses the existing 4,096-object scene capacity, matching the provider/context contract, with bounded ID strings. No geometry capacity, operation budget, stage limit or repair allowance was raised.

### Viewport resizing

Reproduced stale rendering-buffer resolution when device pixel ratio changed from 1 to 1.5 without a CSS layout resize. ResizeObserver/visual-viewport events did not cover that transition in Chromium. A scalar comparison in the existing frame loop now updates buffers only when their actual pixel ratio differs from the requested one; it respects the responsive-quality cap. Resizing also refreshes the existing phone-panel projection offset so its old dimensions cannot override the new aspect ratio. Camera position, navigation behavior and modeling geometry were not redesigned.

The user's original large lower black band was **not reproduced**. Testing covers DPR-only transitions, 80/125/200% desktop-zoom-equivalent viewport/DPR combinations, visual-viewport zoom, wide/tall layouts, panels, phone portrait/landscape/keyboard sizes and graphics-context recovery. Canvas/host bounds, drawing-buffer dimensions, projection aspect and lower-image pixels are checked. CDP emulates the rendering consequences of desktop zoom; it does not operate a physical browser zoom menu or move a window between real monitors. Hardware/GPU/driver-specific uncertainty remains.

### Failure messages and recovery

An agent `finish_task` with `outcome: blocked` already raised `TaskBlockedError`, but that class was private to the provider. The HTTP handler recognized only schema errors, so an infeasible or contradictory modeling request became a generic 502 provider failure. The type is now shared and returned as a distinct `modeling_blocked` response, preserving the agent's explanation. It does not enter invalid-tool-argument repair retries.

Provider and transport errors remain distinct. Network failures explain that the connection was interrupted. Exhausted invalid-plan repair attempts no longer expose schema paths in the user response; the agent still receives full diagnostics during correction. Step prefixes are translated at the presentation boundary. Browser regression exercises a blocked request after provisional geometry, invalid arguments, a dropped connection and a provider failure, then completes an unrelated cylinder with the original project intact and one new Undo entry.

## Validation

- Local unit/engine suite: **402 tests passed in 79 files**. TypeScript, production build, formatting and diff checks passed. The existing build warnings about bundle size and WASM externalization remain. The existing evaluation spending-safeguard tests also pass (4/4), without network calls.
- Focused production-browser run: **22 tests passed in 7.1 minutes** against the production build. See [individual results](production-browser-results.json) and the browser captures below.
- Full PR CI for this exact application commit: [run 44451346340](https://github.com/rmoralesp432/atelier/actions/runs/44451346340), **passed: all 147 production-browser tests, validation and the aggregate check**. See [recorded CI results](validation.json). No skipped or flaky browser results were reported.

New browser regressions cover a 244-component connected edit with concurrent harmless selection, the same edit with a genuine visibility conflict and downloadable completed result, 221 new components across multiple stages with retained preview IDs, whole-request Undo/Redo and reload, frozen destructive-review targets, failure recovery, viewport coverage and real Chromium microphone denial. Existing agent, completion-verification, mobile lifecycle and continuous-voice regressions are included in the focused production run.

No application logic contains the regression objects, dimensions, building fixture or planned live-test prompts. Offline provider fixtures exercise actual geometry and the complete application commit path; they are **not evidence of real model reasoning**.

### Browser captures

- [Desktop coverage after viewport, DPR and panel changes](desktop-viewport-coverage.png)
- [Phone panel layout after orientation/keyboard-sized changes](phone-panel-coverage.png)
- [Recovered mobile workspace](mobile-workspace-recovered.png)
- [Voice follow-up with the chat minimized](atelier-orb-question-phone.png)
- [Committed multistage creation with 223 total objects](transaction-created-components.png)

These are Chromium screenshots from the offline acceptance run, not physical iPhone or real-AI results.

## Mobile and voice evidence limits

Existing mobile browser tests exercise touch/mobile viewport configuration, orientation and keyboard-sized layout changes during pending work, blocked home navigation during modeling, project/camera/conversation/history restoration after interruption and an unrelated new request after reload. Existing voice browser tests use real generated audio tracks and an offline WebRTC transport to exercise consecutive turns, modeling/follow-up edits, microphone rearming, mute/unmute, explicit stop and track release while the orb stays visible. The new denial test uses Chromium's real permission system with a synthetic device; it makes no voice API call. English/default and explicit Spanish persistence tests pass locally.

Unit protocol tests cover seven-minute modeling turns, prolonged silence, queued corrections, temporary disconnects, device loss, hidden-page capture pausing, output sequencing and interruption when echo cancellation is enabled. These are simulated timing/transport events, not a physical speech-recognition or acoustic-echo assessment. The working voice implementation was not rewritten.

Still requires a physical iPhone/Safari and real microphone: permission prompts, speech endpoint detection, actual recognition/language quality, speaker feedback and interruptions, background/lock-screen behavior, device changes, long live-model latency and resource pressure. Safari can suspend capture/WebRTC in the background; browser recovery is not a guarantee that iOS will keep a voice call alive. A killed/incomplete modeling request is discarded safely rather than automatically repeated at additional API cost.

## Release recommendation and next authorization

The reproducible transaction blocker is fixed in offline real-engine/browser testing. Keep PR #22 **unmerged and undeployed** until the final real-AI acceptance evaluation succeeds. This pass does not establish live AI completion accuracy or physical iPhone voice reliability.

Propose **up to US$5**, for the four focused paid tasks and offline controls in [the live evaluation plan](live-evaluation-plan.md). Creation, coordinated modification and post-failure recovery must exercise the actual App finalization/persistence path. Reuse the metered provider, independent measurements and fault-injection infrastructure, with a new ledger and preserved artifacts. Stop on a serious regression, unknown charge or exhausted budget. The previous evaluation's authorization and ledger must not be reused. Await the user's explicit approval before any new paid call.
