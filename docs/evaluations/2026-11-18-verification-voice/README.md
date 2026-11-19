# PR #22 — geometric verification, workspace continuity and voice

This checkpoint addresses the confirmed false acceptance and the requested mobile, voice and language issues. No paid API requests, merge, production configuration change or deployment were performed. The original live-evaluation traces remain unchanged. The modeling agent, geometry operations, private candidate/repair workflow, object IDs and atomic Undo/Redo were retained.

## Verification: what changed and why

The saved real-AI criteria asked for a sphere but only measured its width. The old shape check fitted independent axis scales, so it accepted an ellipsoid as a sphere. It also conflated construction recipes with proof of shape, and bounding dimensions with shell thickness.

Shape evidence now evaluates the actual occupied solid. A sphere must have one radius, and a cylinder must have a circular cross-section. Explicit ellipsoid and elliptic-cylinder predicates are available for affine variants. Physical mesh frames allow equivalent baked XYZ rotations. An unsuccessful bounded frame search for an unfamiliar mesh is **unverified**, rather than a fabricated rejection or acceptance. Unsupported shape/thickness claims also remain unverified.

The intrinsic-diameter check establishes roundness before measuring diameter; a world-axis width alone does not establish it. Flat-profile dimensions use actual vertices rather than the rotated enclosing rectangle. Legacy pair relationships now use the same physical contact/intersection/containment semantics as set relationships. Tolerances have consistent units. Counts, explicit set quantifiers, distinct editable objects, grouping and preservation remain independently checked.

See [the semantic contracts](../../VERIFICATION-CONTRACTS.md) for exact meanings, tolerances and limits. The independent reader is instructed to cover dimensional implications and mark unsupported material requirements explicitly. This does not prove that it will interpret every unfamiliar natural-language request correctly; that still needs a new authorized real-AI evaluation. No additional reviewer call was introduced.

### Replay of real-AI evidence (no new model calls)

[Replay program](replay.ts) loads the **exact** saved reader criteria, original project and live-generated candidate/negative probes. [Raw measurements](saved-trace-replay.json):

| Saved geometry                      | Before               | After                     | Local elapsed time              |
| ----------------------------------- | -------------------- | ------------------------- | ------------------------------- |
| Correct four-part editable assembly | Verified             | Verified; commit allowed  | 161.1 ms (includes cold kernel) |
| Ball stretched vertically           | Incorrectly verified | Incorrect; commit blocked | 43.9 ms                         |
| Ball stretched in depth             | Incorrectly verified | Incorrect; commit blocked | 25.8 ms                         |

These are three local observations, not an AI latency benchmark. General regressions also exercise unfamiliar diameters (0.73, 1.26 and 2.9 m), unequal cylinder radii, arbitrary baked mesh rotations, explicit ellipsoids, tilted intrinsic diameters, gaps/contact/overlap and rotated flat profiles. Existing independent-repair, unknown-scope, protected-object, serialization and Undo/Redo regressions remain in the suite.

James's `ATELIER_Independent_Technical_Review.md` and `ATELIER_research_tests.pdf` informed the focus on individual measurements, actual contact, persistent identities and honest completion claims. Their example designs were not added as modeling templates.

## Mobile continuity and desktop rendering

Two behaviors were reproduced against the prior build `a2fd752` in Chromium: resizing changed the camera, and reloading an open workspace returned to the welcome screen. The same script against the candidate retained the camera and reopened the workspace. [Comparison code](compare-browser.mjs) and [recorded before/after results](browser-comparison.json). A separate real-browser probe changed the mobile camera with a wheel gesture and reloaded: position, orbit target and projection were retained exactly ([probe](recovery-camera.mjs), [measurements](camera-recovery.json)).

The resize path now retains the view, ignores zero-size layouts, and synchronizes renderer, compositor and viewport buffers. Camera state is saved per project. Reload recovery resumes the active tab's project and conversation. A running transaction blocks accidental home navigation. A genuine page interruption aborts the private candidate, restores committed geometry/history, records an interrupted message, and permits the next instruction. Committed geometry remains the persistence source of truth.

Graphics context loss is handled in place; rendering resumes after context restoration, and destroyed workspaces release their old WebGL context. The previously reported intermittent black area was **not directly reproduced**. Buffer-size, hidden/visible layout and forced WebGL-loss regressions passed in targeted testing; this is hardening of plausible causes, not proof that every device-specific GPU issue is fixed. Likewise, browser memory pressure and physical iPhone OS tab eviction were not reproduced.

## Continuous voice and language

Voice stays connected across turns, silence and long modeling operations. Tool-result speech waits for an active Realtime response to finish; response overlap no longer tears down the session or repeats the modeling operation. Follow-up modeling calls stay serialized. Existing semantic voice activity detection determines when to submit speech. The orb and open conversation both offer mute, and the microphone/orb control ends the session and releases tracks. Late permission grants after cancellation are also released.

Backgrounding pauses capture. A temporary network disconnect gets a short recovery grace period; genuine device loss or a terminated service session ends capture and explains how to reconnect. No automatic new paid session is opened. Active microphone echo cancellation permits interruptions; otherwise capture pauses while audio plays and resumes afterwards. The fallback checks the track's actual settings, including an absent setting, rather than assuming a supported constraint is active.

English is the persistent default. Explicit conversation-language requests or the language selector change the preference; foreign names, borrowed terms and recognition fragments do not. Agent, ordinary discussion and voice share the preference. Host-generated completion claims are localized without another AI request and preserve the distinction between verified and incomplete verification. Internal numerical receipts and some interface/error strings remain English.

### What browser interaction establishes

Real Chromium browser tests run the actual editor, geometry kernel, storage, camera, Undo/Redo and microphone-track controls. Model/reviewer responses and WebRTC provider events are **offline fixtures**. The orb test uses independent real browser-generated capture and playback tracks, but not a physical microphone or a paid voice connection. During validation its old fixture incorrectly reused the capture track for playback; the echo-cancellation fix correctly muted that track and exposed the fixture error. The fixture now mirrors separate WebRTC tracks and additionally asserts that capture is paused while output still animates the orb.

- Mobile-size landscape/portrait and keyboard-like resizing during an outstanding request preserve the canvas instance, view, original project and eventual single Undoable commit.
- Minimize/reopen conversation does not remount or interrupt the workspace.
- Reload during a request preserves committed geometry, conversation and history; a fresh request then succeeds.
- Desktop wide/zero-size transitions keep consistent drawing buffers; forced WebGL context loss/restoration retains geometry.
- Three voice turns (clarification, modeling, follow-up) use one microphone session; mute/unmute changes the real track state and closing ends it.
- English survives mixed terminology; explicit Spanish persists, English can be restored, and Spanish modeling completion retains numerical evidence.

Deterministic lifecycle tests additionally cover a seven-minute modeling operation, idle silence, duplicate tool events, overlapping requests, cancellation, background/foreground, device loss and echo-cancellation fallback.

## Validation and release recommendation

Current application/test commit: `7b84cb16ffbc2065851c1cd3b255b6696a567181`. The saved-trace replay records `5032790`; subsequent commits only refine voice capture behavior and the browser transport fixture.

- **390 unit tests across 78 files passed**, including geometry, recovery, agent, voice and language regressions ([log](unit-tests.log)).
- Production build/type-check and repository formatting passed ([build](build.log), [format](format.log)). The pre-existing large-bundle warning remains.
- The focused production-browser run passed 11 of 12 tests; the remaining failure was the shared-track fixture error described above ([initial log](browser-initial.log)). After correcting that fixture, the same orb scenario passed without relaxing its audio/microphone assertions ([rerun](browser-orb.log)).
- Complete production-browser CI is still being checked; its final result will be recorded below.

Browser captures: [voice question with conversation minimized](voice-question-phone.png), [recovered desktop graphics](desktop-graphics-recovered.png), [mobile workspace after interruption and a new modeling request](mobile-workspace-recovered.png).

The intended next gate is a small authorized real-AI evaluation of unfamiliar geometry and mixed conversation, plus physical iPhone Safari voice and lifecycle checks. Passing offline geometry and browser tests does not establish speech recognition accuracy, spoken-language compliance, acoustic feedback quality, live turn-detection timing or complete natural-language requirement coverage. HTTPS, microphone permission and browser audio policy are required; browser/device interruption or provider session expiry can still require an explicit reconnect.

PR #22 remains draft and undeployed. These changes remove the demonstrated verification defect without adding design templates or changing modeling tools. Production readiness should be decided after the remaining live and device evidence, with explicit merge/deployment authorization.
