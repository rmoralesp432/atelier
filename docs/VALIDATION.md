# Phase 2 validation evidence

Validated in the Codex Cloud Linux environment using Node.js 24.19.0, Chromium 154 and software WebGL. This file distinguishes geometric execution, UI/provider contracts and live AI/audio behavior.

## Detailed house, editable components and silhouettes — October 19, 2026

**141 unit/integration tests in 35 files pass.** The sample's 133 objects all evaluate to valid positive-volume solids. Tests cover fresh identities, six editable groups, independent window edits, terrace end-face stretching, undo, session round trips and provisional site settings. Building-component tests verify actual material volume and world bounds after separating a raised, rotated building; isolated window edits; group preservation; locked-object rejection; and undo back to the procedural envelope. Native tree geometry is sparse, closed and tagged for transparency, including wrapped rotations and AR materials. The Modulor-inspired cutout's actual bounds match its stated dimensions.

**Nine targeted production-browser scenarios pass across the runs:** detailed sample opening/editing/undo/reload/project preservation; phone component search and thin-window dimensions; reviewed building separation, window resizing and persisted undo; object color/person creation/wireframe/hidden-line occlusion; map placement/failure handling; expanded shadows/mobile controls; native USDZ handoff; and shared WebXR conversation/model refresh in both themes. The final three-case component/sample run passed together. The new browser selector was corrected to use the existing accessible “Show objects” name, and slow-render animation assertions wait for completion without removing geometry assertions.

TypeScript/Vite production build, formatting and whitespace checks pass. The static `/atelier/` compatibility smoke also passes with actual JS/CSS/WASM loading, real solid rendering, direct edits/reload and lazy 3D moodboard/model assets. Desktop and phone screenshots were visually inspected. AR transport/native capability scenarios remain explicit fixtures, not physical-device tracking or microphone verification. No paid model requests were made.

**Site limitation:** the prefilled map center is provisional, not surveyed. Measured topography has not been added: official house/USGS destinations returned outbound-policy denials. The saved environment network draft requires user review/save and publication before data can be obtained and verified. No invented terrain is labeled as real.

![Detailed editable house with translucent tree silhouettes](atelier-sample-house.png)

![Phone editing an individual 25 mm glazing panel](atelier-sample-phone.png)

## Spatial tools, phone AR and editable sample — October 19, 2026

This update preserves the existing app/service and project formats. **138 unit/integration tests in 34 files pass**, including exact bounded map coverage/UV crops, atomic camera placement, meter-based AR fitting and invalid-input rejection, tracked-camera conversion into project axes, WebXR lifecycle/model-update fixtures, and genuine solids for all 24 objects in the new sample house. Existing provider SDK tests now carry AR workspace context. No paid requests were made.

Production Chromium checks in this turn include a passing **10-case spatial/AR regression**, followed by a passing **16-case phone/interface regression**. They exercise real geometry and interaction: 5 km map overview without scaling buildings; selection shortcuts and direct pull labels; two-click walk placement; camera placement between named objects; preservation of old extrusion and opening controls; phone tool sheets with unobscured buttons; import, drawing, inspector, projects and moodboard; formation and replacement animations; and unsupported/denied AR paths. A final **9-case production follow-up passed** for sample creation/editing/undo/reload/project preservation, both day/night AR conversation layouts, native handoff, phone modeling controls, project-save failures and the existing extrusion/opening workflows. The sample flow passed once more after the final header cleanup. These are targeted production-browser runs, not a claim that the entire GitHub Actions suite is green.

The final TypeScript/Vite build, formatting and whitespace checks pass. The static **`/atelier/` smoke test passes** with actual JS/CSS/WASM loading, solid rendering, direct editing/reload persistence and lazy moodboard/model assets. The same artifact is used by the production Node server; static Pages alone still has no AI backend.

The AR browser scenarios explicitly mock native capability detection or the WebXR transport. The actual shared conversation, request validation, geometry engine, USDZ export and AR-model rebuilding run in the browser. A separate session test uses real Three.js scene objects with fixture hit poses and a renderer double to check placement, two-point scale/rotation, updates, control-tap isolation, rejection of wall placement and cleanup. This does **not** establish real camera tracking, surface precision, microphone/camera coexistence or iPhone native rendering. iPhone Quick Look does not host ATELIER chat; it pauses voice and requires returning to the app. WebXR integration keeps the shared conversation overlay and passes AR-relative camera context, while protecting physical viewing scale from ordinary modeling dimensions.

The phone interface uses a labeled Tools menu and one bottom sheet, with larger targets and conversation hidden only while that sheet needs the space. Desktop retains movable panels. Fixes also prevent automatic Move-tool activation from cancelling construction, preserve animation stages across slow/background frames, and keep new selection styles separate from existing inspector controls.

The [sample house](SAMPLE-PROJECT.md) is a locally generated conceptual study inspired by Farnsworth House, not a measured replica or a model-provider response. The first screen offers it and Projects can create another editable copy without overwriting the current project. The [topography research](TOPOGRAPHY-RESEARCH.md) reviews official GDAL/PDAL/GeoTIFF and LiDAR catalogue sources; no terrain has been imported and no site accuracy is claimed.

![Phone AR preparation with explicit real-world viewing width](atelier-phone-ar-scale.png)

![Phone modeling sheet with an unobscured Stretch action](atelier-tools-phone.png)

![World-anchored pull measurements in the spatial-tool check](atelier-spatial-pull.png)

Render status is checked through its API. The public app hostname and map providers are outside this cloud environment's network allowlist, so browser checks use the actual production Node server locally and explicit map tiles. No Render service or API key is recreated.

## Interaction, spatial references and motion — October 19, 2026

See [the interaction and phone-viewing guide](INTERACTION-REFINEMENT.md). **124 unit/integration tests in 28 files pass**. Added numerical checks cover rigid multi-selection transforms with a common ground clamp, locked-member protection, map displacement under a rotated bearing, meter-based USDZ geometry/scaling, AR cancellation and unavailable-device handling, and validated moodboard snapshots/limits. The actual provider SDK contract also carries current section state.

Browser coverage includes whole-selection movement/rotation and Escape cancellation; group selection and phone additive selection; visible 2D profiles/extrusion/scale/stretch; one tool dock with sticky close controls; map dragging/nudging without moving the buildings; dark section caps and independent cut/plane switches with a real draggable plane; genuine USDZ downloads and explicit unsupported/permission-denied AR paths.

The 3D moodboard checks mix a local image, an actual model snapshot and a linked note, drag references, change depth/rotation, undo/redo, inspect exported backup contents, reload and switch projects. Borrowing a model from a saved project does not insert it into the receiving project's geometry. Save failures remain visible and unsaved board data stays exportable. Mobile layout and the shared moodboard workspace action are tested. Images/notes are not silently sent to the provider.

Motion checks exercise footprint/rise/settle, updated-geometry reveals, a genuinely pending provider request (explicit transport fixture), exact measurements during/after animation, and reduced-motion behavior. Undo/reload do not replay construction. Rendering uses actual Three.js meshes and Manifold geometry; fixtures do not establish live AI language or voice quality.

The complete **47-case production regression passed** before the section-plane/moodboard/motion follow-ups. A **19-case focused production run also passed**, covering those additions and the affected import, motion, selection, map and AR paths. Together these cover **55 distinct Chromium scenarios**. The final moodboard build then passed all four moodboard scenarios again, including animation settlement and undo history. The static `/atelier/` smoke test passed with JS/CSS/WASM and lazy map/moodboard/model assets, direct solid editing and reload persistence. TypeScript/Vite, formatting and whitespace checks pass. The suite uses software WebGL; it is functional verification rather than a hardware performance benchmark.

No paid AI calls were made. AR hardware camera tracking, Quick Look display and actual surface placement remain unverified without a compatible phone. Render deployment status is checked through its API; the public application hostname and map providers are outside the cloud network allowlist. Browser verification uses the production Node server in the cloud with explicit map fixtures. Terrain and native RVT/SKP remain outside this update.

![A real 3D moodboard with an image, model and linked note](atelier-moodboard.png)

![Independent section-plane controls and a black cut face](atelier-section-plane.png)

![Feedback during an explicitly held test-provider request](atelier-processing.png)

## Expressive studio — October 19, 2026

This earlier milestone is described in [the expressive studio guide](EXPRESSIVE-STUDIO.md). **112 unit/integration tests in 23 files pass**, along with TypeScript, the production Vite build, formatting and whitespace checks.

New numerical checks cover analytic loft volume and winding, closed straight/curved sweeps, rejection of a folded crossing sweep, arbitrary-axis solid rotation with stable center/identity, exact hollow-box material volume, real section-cap area with cavities, opposite-face push/pull anchoring, independently sized lower floors with reviewed lifting, fixed clear glazing widths after narrowing, locked-group protection, tree placement around a rotated envelope and avoidance of neighboring object envelopes, world-space OBJ dimensions and hidden-layer exclusion. Solar tests check equinox noon altitude/azimuth, true-north bearing rotation and explicit UTC-offset conversion. Provider tests verify real multimodal SDK payloads, strict schema, one bounded geometry-repair attempt and no automatic repeat of a billing rejection.

The 41-case production Chromium regression initially passed 37 cases. Focused reruns passed all four affected cases after fixing the late-loading map coordinate overwrite, inspector/addition overlap, presentation exit visibility and project-dialog cancellation during list refresh. The added delayed-map-loading regression brings the browser suite to 42 scenarios, all covered by passing production regression/focused runs. Final map interaction, solar/camera, image-reference and tree/group/OBJ workflows were rerun successfully. The static `/atelier/` smoke test also passes with JS/CSS/WASM and lazy map assets, real solid rendering, exact editing and reload persistence. Tests use explicit provider/map fixtures where indicated; the application has no fake AI fallback.

The browser checks exercise capped section cuts, satellite/provider switching and map-only rotation, direct face dragging, floor/glass/envelope toggles, corrected sweep/loft transactions, true solar lighting, eye-level keyboard movement, camera lens settings, marquee selection, persistent hidden/locked groups, solid trees, actual OBJ download contents, and downsampled reference photos through follow-up and reload. Existing projects, original Boolean success sequence, imports, direct transforms, mobile layout and voice transport contracts remain covered.

No paid text, image or voice requests were made. Live language/image interpretation, audible voice quality and satellite imagery availability are not claimed verified. The public Render hostname is outside this cloud environment's network allowlist; deployment status is checked through the authorized Render API, while actual browser tests run against the production Node server in the cloud.

![Actual expressive solids in night mode](atelier-expressive-night.png)

![The same workspace in day mode](atelier-expressive-day.png)

![Volumetric trees around the model](atelier-trees.png)

![Solar study controls in the real viewport](atelier-solar.png)

## Earlier validation milestones

- **89 unit/integration tests** across model compatibility, structured plan validation, camera-relative directions, engine execution, Manifold geometry, history persistence, mesh imports, motion timing, API access protection and actual SDK request/response contracts. Hosting checks verify trusted HTTPS origin configuration behind a proxy, secure login cookies, foreign-origin rejection and authenticated voice-session routing using an explicit provider double. Provider error tests verify actionable billing/key/configuration messages without exposing upstream errors.
- **33 Chromium scenarios against the production Node server**, covered by the regression suite and focused reruns: rendering/orbit/top view, collapsible inspector, legacy-data preservation, exact editing, profiles/extrusion, raycast selection, conversational UI execution using explicit model-response fixtures, destructive review/stale-plan protection, export/import, translation handles, missing-credential behavior, editable wall openings through reload and undo, session-import timeline preservation, OBJ/STL/GLB imports, reference surfaces, creation motion, reduced-motion and storage-budget protection. The suite also requests the real `/healthz`, `/api/config` and `/api/plan` routes to verify the combined server and honest missing-key behavior.
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

## Studio and mesh import milestone — October 16, 2026

OBJ cube import measures 24 m³ and a genuine subtraction leaves 12 m³. ASCII/binary STL tests cover units and Z-up conversion. Embedded GLB tests bake mirrored transforms while preserving closed topology. External buffers, invalid geometry and unsupported GPU instancing are rejected; external texture URLs are stripped without a network request. Open OBJ triangles render as references, remain transformable and persist through undo; their solid volume is explicitly unavailable. Planner context includes reference status while excluding vertex/index arrays, and passes the actual server request schema.

The browser tests use real file inputs and a file-drop event. They verify existing objects are unchanged, dimensions/solid volume survive reload, import is undoable, file-unit choices work, bad imports are atomic, references remain editable, and the import dialog fits a 390-pixel viewport. A history-bearing session above the conservative import save budget rejects an additional mesh without changing the saved session. That fixture stays within the supported 50-snapshot history limit.

Construction tests observe footprint/extrusion/completion phases and verify that final dimensions and undo counts never contain intermediate animation values. Restore and reduced-motion checks show final geometry without replaying creation. A pixel-level browser check verifies that Outline actually darkens surface interiors while leaving the model unchanged. Visual inspection found that toggling Three.js transparency needed a shader refresh; this was fixed and the pixel check passed. Screenshots were inspected from the actual application, not generated mockups.

The local full browser regression passed 20 of 21 cases initially. Its export/import test used Playwright's extensionless temporary download path, which the new format-aware importer correctly rejected. The fixture now uses the real exported `.json` filename. The corrected JSON case and the five initial import/motion cases passed on the final application build; the additional storage-budget case then passed separately. Together these cover all 22 current scenarios. No paid provider request was made.

![Studio workspace](atelier-studio.png)

![Actual outline rendering](atelier-outline.png)

![Geometry import with explicit units](atelier-import.png)

See the [requirement audit](PHASE2-AUDIT.md) for the complete original Phase 2 checklist and remaining roadmap work.

## Refined studio, appearance and modeling vocabulary

The full production-browser suite passed all 25 scenarios in 6.2 minutes locally. The unit/integration suite passed all 85 tests.

New numerical checks cover object-color persistence and undo, exact 1.75 m person geometry, uniform group scaling (including slab/frame material volume), rotated rectangular end-face stretching, asymmetric solid reflection and reversal, mirrored glass/frame render parts, grid/polar arrays, scene limits, geographic coordinate scale and preservation of map anchors through manual creation.

New Chromium checks exercise real color controls, scale-person creation, persistent display preferences, the 600 m move that previously outgrew shadow coverage, narrow-screen controls, and location persistence. Pixel comparisons verify that hidden-line rendering occludes rear edges and that chosen surface colors change the actual canvas. OpenStreetMap tile success/failure tests use explicit image fixtures, bounded to nine requests, with visible attribution and unchanged model geometry. They are not a live imagery availability test.

The first focused browser run found that a decorative diamond polluted the accessible names of view-style buttons. Marking that decoration aria-hidden fixed the controls; both affected cases then passed, including the actual hidden-line pixel assertions. A separate layout inspection caught and fixed a doubled header offset. Screenshots below are from a real demonstration project rendered by the application, created through structured geometric operations; they are not evidence of a live AI request.

![Refined studio and scale figure](atelier-refined.png)

![Hidden-line geometry with occluded rear edges](atelier-hidden-line.png)

![Narrow-screen workspace](atelier-refined-mobile.png)

See [the studio guide](STUDIO-UPDATE.md) for supported operation meanings, map setup and remaining limits.

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

Vite builds successfully with its size advisory (approximately 1.16 MB application JavaScript before compression, 320 kB compressed, plus approximately 541 kB WASM). Manifold's conditional Node-only module is externalized in the browser build; the production browser tests exercised the browser path successfully. Large-model performance, Safari/mobile behavior, multi-user hosting and exact analytic CAD/BIM exports are not certified. Terrain/site workflows remain on the roadmap.

Local test results alone do not establish a public deployment, GitHub Actions execution, new cloud snapshot or live AI/voice session. The existing Phase 1 `main` branch is preserved while Phase 2 is prepared on its feature branch.

The Render blueprint and [browser-only activation guide](HOSTING.md) are in the repository. During initial setup Render account access and an OpenAI key were absent. Subsequent authorized Render API access confirmed deployment of commit `28f8541` as `live` at https://atelier-emxi.onrender.com. This establishes deployment, not successful AI/audio behavior. The reusable Codex startup instructions were saved as a draft; that save does not publish the application.

## Live API diagnosis — October 16, 2026

The user's sphere-on-prism request was reproduced against OpenAI with the deployed service's credential, used only in memory without printing or persisting it. The API rejected the generated schema with HTTP 400, `invalid_json_schema`: `oneOf` is not permitted at `operations.items`. Zod's discriminated union emitted that unsupported keyword; fixture responses had not enforced this provider restriction.

The wire schema now uses `anyOf` for the operation union. Unique literal `type` values keep its branches mutually exclusive, and the original strict Zod validator and geometry constraints are unchanged. The SDK contract test checks the actual serialized request for the supported union, distinct types and strict required fields.

After this correction, live requests for “Create two boxes” and the original sphere-on-prism instruction returned HTTP 429, `credit_balance_exhausted`, stating that API credits must be added. No model plan or new geometry was produced. Billing must be resolved before live modeling or voice can be verified. The backend now reports recognized billing, authentication and schema errors using fixed safe messages instead of exposing raw upstream errors or hiding every cause behind the generic plan failure.

## Projects and direct interaction — October 16, 2026

The unit suite passed **89 tests across 15 files**. The complete browser run passed 32 of 33 scenarios; the remaining map test read storage before asynchronous project startup finished. It now waits for the rendered workspace. That map test and both project tests passed against the final production build, including the final modal keyboard safeguards. All 33 distinct browser scenarios are covered by the regression and focused reruns. TypeScript/build, formatting, Git whitespace checks and the final static `/atelier/` smoke test passed.

- Projects migrate the existing workspace, create independent blank spaces, rename, switch, and restore the active space after reload. Browser checks compare complete saved sessions and conversations, including independent site locations, undo and redo. A forced IndexedDB write failure leaves the current workspace and identity intact. Keyboard undo/Escape in the project dialog cannot edit the underlying model. Desktop and 390-pixel project menus were inspected.
- Day/Night changes actual scene and interface colors without changing project data. Screenshot pixel checks verify the rendered difference. Selection outlines are visible, and actual clicks/model-response selection activate move handles.
- Real pointer drags exercise translation distance, displacement and 45°/90° yaw snapping. Rotation uses pointer intersection with the horizontal plane, including a true orthographic overhead camera. Completed drags preserve undo semantics.
- Inspector close/clear-selection are separate; panels move with pointer/keyboard and remain inside resized windows. Object names persist; blank edits restore the previous name. Sphere meridians/parallels and cylinder generators are numerically checked against their surfaces and visually inspected.
- Map display hides the competing ground/grid and restores them when hidden. Two settled rendered frames remain stable within a bounded pixel-difference tolerance. Header toggling, geographic anchoring, attribution, tile failure messages, pan/zoom/click selection, coordinate entry and explicit geolocation fixtures passed. Picker browsing does not commit location until applied.
- Explicit model-response fixtures switch real perspective/orthographic camera classes, overhead view, Day/Night and map controls. Workspace-only plans preserve geometry, undo/redo and modeling references; invalid combined geometry requests do not partially apply view changes. Provider-bound workspace context is schema-validated.
- The static Pages smoke test also loads the lazy Leaflet JavaScript/CSS under `/atelier/`, renders geometry and restores edits; it honestly reports the absent AI backend.

Screenshots in the [studio guide](STUDIO-UPDATE.md) come from the running application. OSM image tiles and device location use explicit test fixtures: live imagery and physical GPS were not verified through this cloud network. No paid model or live voice calls were made. The public Render application hostname is outside this environment's network allowlist, so browser verification uses the production Node app locally; Render deployment status must be checked separately through its API. Existing service credentials and hosting configuration are unchanged.

The first GitHub PR run on `d974a86` passed 31/33 scenarios. Its two failures were test time budgets: the seven-edit CSG sequence exceeded the default 30-second total, and a separate case exceeded the five-second initial workspace wait. The sequence now allows 90 seconds, checked-review testing 60 seconds, and initial IndexedDB/WASM/WebGL startup 20 seconds. All exact geometry/history assertions remain. Both affected scenarios passed again against the same production application (24.7 s and 14.9 s locally). This follow-up changes tests/documentation only; it does not alter the deployed application.

The parallel push run also reached all color/hidden-line assertions before its final screenshot exceeded that scenario’s 60-second total; that multi-style/reload scenario now allows 120 seconds. Its CSG sequence likewise reached the final screenshot before timing out, confirming the numerical assertions had completed. These are explicit software-rendering test budgets, not relaxed geometric tolerances or skipped checks.

### Direct 2D drawing and spatial presentation (October 19 follow-up)

- Added geometry tests for reversed rectangle corners/elevation, shared-engine extrusion and undo, concave profile placement/volume, circle radius, invalid/crossing face rejection, and adaptive grid coverage. 128 tests across 29 files passed before browser verification.
- Production browser scenarios exercise actual canvas clicks → snapped face → handle extrusion → undo; exact circle entry; closed concave outline; rejected crossing outline; cancellation without history changes; creation-only camera framing and its no-zoom-out bound; grid coverage at wide zoom; and phone touch drawing activated by an explicitly mocked structured AI workspace action.
- No live OpenAI or microphone session is represented by those provider fixtures. Manual drawing and geometric validation do not require an API key. Paid language/voice requests continue to use the configured backend.

The preceding GitHub full-suite run (`39301264668`) completed with 54/55 browser tests passing. Its sole failure was an obsolete exact-text locator for the processing label after that label gained a subtitle. The dialogue test now asserts the actual stage container, while retaining the held provider response and checks that a second draft is preserved. It is included in follow-up browser verification.

Follow-up checks passed: a 23-scenario production regression; eight focused scenarios after drawing/grid/mobile refinements (including the repaired dialogue test); three targeted rendering scenarios after the wide-view floor fade; and four formation/reduced-motion scenarios after adding reversible context softening. These runs cover 24 distinct browser scenarios. The final floor/grid ordering was checked again against both formation scenarios. The production `/atelier/` static smoke test also passed. Browser screenshots are stored as `docs/atelier-direct-drawing.png`, `docs/atelier-drawing-phone.png`, and `docs/atelier-spatial-creation.png`. Public Render checks use deployment API status because the public app hostname is outside the cloud network allowlist.
