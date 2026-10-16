# Phase 2 validation evidence

Validated in the Codex Cloud Linux environment using Node.js 24.19.0, Chromium 154 and software WebGL. This file distinguishes geometric execution, UI/provider contracts and live AI/audio behavior.

## Passed

- **68 unit/integration tests** across model compatibility, structured plan validation, camera-relative directions, engine execution, Manifold geometry, history persistence, API access protection and actual SDK request/response contracts. Hosting checks verify trusted HTTPS origin configuration behind a proxy, secure login cookies, foreign-origin rejection and authenticated voice-session routing using an explicit provider double. Provider error tests verify actionable billing/key/configuration messages without exposing upstream errors.
- **16 Chromium tests against the production Node server:** rendering/orbit/top view, collapsible inspector, legacy-data preservation, exact editing, profiles/extrusion, raycast selection, conversational UI execution using explicit model-response fixtures, destructive review/stale-plan protection, export/import, translation handles, missing-credential behavior, editable wall openings through reload and undo, and session-import timeline preservation with a receiving-session backup. The suite also requests the real `/healthz`, `/api/config` and `/api/plan` routes to verify the combined server and honest missing-key behavior.
- **TypeScript check and production build**, including the packaged Manifold WASM asset.
- **Static Pages smoke test** at `/atelier/`: JS/CSS/WASM paths, actual mesh rendering, direct exact editing, reload persistence and honest disconnected AI/disabled voice state. The expected unavailable `/api/config` endpoint on a static site is explicitly distinguished from failed asset requests.
- **Application-server startup:** both development and production services returned ATELIER HTML and `/api/config`. Without a credential, `/api/config` reported `configured:false` and `voiceConfigured:false`; `/api/plan` returned HTTP 503 with a configuration explanation.
- Formatting and Git whitespace checks passed.

## Numerically verified geometric operations

- Boxes, tessellated spheres/cylinders, rectangle/circle profiles and extrusion.
- Union, subtraction and intersection with known volumes; closed mesh edge incidence; Manifold `NoError` status.
- Empty intersections/non-intersecting cuts rejected without losing operands.
- Stable first-operand identity and preserved recursive operand recipes.
- World and camera-relative transforms, approximate resizing, duplication/arrays, clear-gap spacing, base-center alignment and overlap placement.
- Real openings through walls, editable cutter width/height (including rotated and nonuniformly scaled results), and measured solid-volume changes.
- Undo/redo through serialization and restoration, including Boolean operand identity.

The requested sequence—create two boxes, move the second right, make it taller, overlap, subtract, undo and intersect, then widen the result—passed at the **structured-operation and UI-contract levels**. The UI test supplies known model-response fixtures; the production app itself has no such fixture fallback. Manifold produces the real resulting geometry. The final intersection volume changes from 288 m³ to 316.8 m³ after widening by 10%.

## Raised-pavilion milestone — October 16, 2026

The complete new sequence passed numerical tests: 100 × 20 × 8 m upper envelope with y=4; a 106 × 26 × 4 m outward-offset base; 45° upper rotation; centered cylinder of radius 4 m/height 12 m; genuine shared-solid intersection; two occupied floor slabs plus a roof with closed glass/frame solids. The cylinder intersection is approximately 401.48 m³ before the architectural conversion. The final envelope still spans y=4 through y=12, and the original upper ID survives.

Additional checks cover a full rectangular facade, editable floor count without nesting recipes, exact sphere-on-base placement for different heights, ambiguous names, unsupported sloping facades, invalid below-ground bases, positive component volumes, Manifold status and serialization/undo. Both sample projects are generated through this same engine.

The expanded browser suite checks the full-size canvas, hidden-by-default panels, mesh reuse on selection, direct shape creation, narrow-screen panel/import/export access, actual facade rendering, reload and floor-edit history. Another explicit model-fixture test executes cylinder intersection, conversational cancellation/approval, architectural conversion, rejection of approval without a pending review, and undo restoring the raised rotated envelope. These fixtures test application execution, not the provider's interpretation of the user's sentences.

Voice lifecycle tests use explicit media/transport doubles: repeated turns and spoken confirmation route through the same callback, duplicate tool events do not duplicate edits, cancellation before microphone permission is granted does not open a provider session, and rejection/stopping release microphone tracks. They do not certify audio quality or live turn-taking.

The configured Render key was checked again during this milestone; OpenAI returned HTTP 429 `credit_balance_exhausted`. No successful live plan or spoken session is claimed. The existing service/key are preserved; no terrain work was started.

## Conversation-first interaction

A separate browser test uses explicit model responses to ask about a floating gallery, accept a short answer using prior dimensions, create it, and apply a subsequent depth correction through conversational focus. No primitive selector or manual selection is used. It verifies that clarification leaves the project unchanged, Enter/Shift+Enter behave correctly, an in-flight request preserves the user's next draft, actual measurements remain available, and dialogue survives reload. Default UI checks verify that primitive and architectural action buttons are absent from the main scene while optional manual tools remain functional. These are dialogue/execution contract checks, not proof of live model quality.

## Grounded assistant milestone — October 16, 2026

No paid model or voice requests were made for this milestone. The checks below exercise actual geometry and explicitly supplied model/voice transport responses; they do not certify live language understanding.

- Custom concave footprints: a 50 m² L outline extrudes into 250 m³ of solid, has closed mesh edge incidence and retains its asymmetric orientation. Flat profiles measure area before extrusion. Resize doubles material volume, stable identity survives persistence/undo, and real courtyard cuts and floor slabs operate on the custom outline.
- Boundary checks reject crossing, repeated, degenerate or incorrectly normalized imported polygons atomically. Resizing an offset opening cannot breach the wall's outer edge.
- Read-only queries return known material volume, surface area, elevations, center distance and shared solid volume without altering geometry, selection, focus or undo/redo. Bounding-envelope gaps are explicitly labeled, never claimed as exact nearest-surface distances.
- Group yaw preserves layout/elevations around a common center or reference. Mixed-size approximate moves and arrays use a common offset. Roof alignment accounts for different object heights; below-ground results are rejected. Oblique-view spacing uses the oriented projection. “Spread more” increases the existing gap; duplicate names stay distinct.
- Browser checks create a flat L footprint through an explicit plan fixture, extrude it, ask a measured question, reject an oversized cut before review, inspect a validated floor conversion, approve it conversationally, undo, measure again and reload. An intentionally invented numerical summary is suppressed in favor of the measured engine result. The exact proposed operations/outcome and undo counts reach the next planner request. Existing review/cancellation/stale-scene, original success sequence and precision-tool checks remain in the regression suite.
- Voice transport doubles verify queued follow-ups run in order, stopping discards queued requests, five idle minutes release capture, and active state is separate from disconnect/idle messages. This does not verify audible quality or live barge-in.

The browser regression run passed 15 cases; its former stale-review fixture requested a non-intersecting cut, now correctly rejected before review. After changing that fixture to overlapping solids, the affected stale-review, custom-footprint and wall-opening cases all passed on the final build. All 16 distinct browser cases are covered.

The full saved conversation (up to 80 messages) is scrollable; the last 20 bounded messages are sent as model history. Newly generated/resized solids are checked before an atomic commit. Destructive reviews store a checked candidate result and require an unchanged session before installation.

## Not verified live

During initial setup, `npm run test:live-ai` exited **2**, explicitly reporting that `ATELIER_OPENAI_API_KEY` was absent. These tests do **not** establish arbitrary language understanding, live pronoun/spatial disambiguation quality, or bilingual quality. See the subsequent live API diagnosis below.

Realtime SDP/tool configuration was tested through the real SDK using a test transport. This does **not** verify a live provider call, real microphone capture, audible response, continuous turn-taking, interruptions or browser media connectivity. Those checks require a configured provider account, HTTPS and a real microphone/browser session.

Required next action for the existing installation: fund the OpenAI API account/project associated with the stored key, then run the live text check and perform the spoken success sequence in an HTTPS browser. A new key or Render service is not required just to update the application. The live script stops for clarification rather than treating ambiguity as a pass. No secret should be provided in chat or placed in frontend code.

## Inspected screenshots

Custom-footprint slabs, produced by the real solid engine from an explicit test plan:

![Custom-footprint architectural solids](atelier-grounded-assistant.png)

Conversation without primitive selection:

![Conversation-first design](atelier-conversation-first.png)

The immersive production workspace:

![Immersive workspace](atelier-immersive.png)

The raised, rotated pavilion with real floor/glass/frame solids:

![Architectural curtain wall](atelier-curtain-wall.png)

Narrow-screen layout checked in Chromium (this does not certify Safari or real touch hardware):

![Narrow-screen workspace](atelier-mobile-layout.png)

A genuine Manifold wall cut with editable opening dimensions:

![Real opening](atelier-real-opening.png)

## Practical limits

Vite builds successfully with its size advisory (approximately 1 MB application JavaScript before compression, plus approximately 541 kB WASM). Manifold's conditional Node-only module is externalized in the browser build; the production browser tests exercised the browser path successfully. Large-model performance, Safari/mobile behavior, multi-user hosting and exact analytic CAD/BIM exports are not certified. Terrain/site workflows remain on the roadmap.

Local test results alone do not establish a public deployment, GitHub Actions execution, new cloud snapshot or live AI/voice session. The existing Phase 1 `main` branch is preserved while Phase 2 is prepared on its feature branch.

The Render blueprint and [browser-only activation guide](HOSTING.md) are in the repository. During initial setup Render account access and an OpenAI key were absent. Subsequent authorized Render API access confirmed deployment of commit `28f8541` as `live` at https://atelier-emxi.onrender.com. This establishes deployment, not successful AI/audio behavior. The reusable Codex startup instructions were saved as a draft; that save does not publish the application.

## Live API diagnosis — October 16, 2026

The user's sphere-on-prism request was reproduced against OpenAI with the deployed service's credential, used only in memory without printing or persisting it. The API rejected the generated schema with HTTP 400, `invalid_json_schema`: `oneOf` is not permitted at `operations.items`. Zod's discriminated union emitted that unsupported keyword; fixture responses had not enforced this provider restriction.

The wire schema now uses `anyOf` for the operation union. Unique literal `type` values keep its branches mutually exclusive, and the original strict Zod validator and geometry constraints are unchanged. The SDK contract test checks the actual serialized request for the supported union, distinct types and strict required fields.

After this correction, live requests for “Create two boxes” and the original sphere-on-prism instruction returned HTTP 429, `credit_balance_exhausted`, stating that API credits must be added. No model plan or new geometry was produced. Billing must be resolved before live modeling or voice can be verified. The backend now reports recognized billing, authentication and schema errors using fixed safe messages instead of exposing raw upstream errors or hiding every cause behind the generic plan failure.
