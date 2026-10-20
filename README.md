# ATELIER

An architectural modeling workspace built with React, TypeScript, Three.js and the Manifold solid kernel. Natural conversation is the primary input: a real model proposes structured edits, the geometry engine validates them, and the workspace reports actual resulting measurements.

**Current verification:** direct modeling, geometry operations, persistence and the conversation UI contract have automated coverage. Earlier live verification reached OpenAI but returned **credit_balance_exhausted**. Billing was not rechecked in the latest interface update; successful live natural-language modeling and continuous microphone conversation remain unverified. No keyword fallback pretends to be AI.

## Run the application

**Existing application:** https://atelier-emxi.onrender.com. Future tested updates use this same service and address; do not create another Render service or API key just to update the app.

Use the **folder/project name** beside ATELIER to create and switch separate projects. Each retains its geometry, conversation, site and undo history in this browser; export JSON backups for safekeeping or another device. **Studio** offers Day/Night and display styles; the camera menu offers Perspective, Orthographic and Top view. The header **Map** button opens a visual location picker or toggles the saved site map. See the [studio guide](docs/STUDIO-UPDATE.md) for the updated controls.

**Latest spatial update:** choose **Map → Location → Map area** for coverage up to **5 km × 5 km**. Selecting geometry exposes **Push / pull, Scale, Stretch, Copy, Mirror and Array**; face handles show dimensions directly in 3D. Use **Camera → Place me in the model** to click a floor point and look direction. The AI integration also supports validated camera placement between named objects. Read the [accurate stepped-topography research](docs/TOPOGRAPHY-RESEARCH.md) for the proposed survey-backed terrain workflow; terrain is not yet implemented.

**Editable sample:** choose **Explore an editable sample house** on the opening screen or **Projects → Open sample house**. The raised glass pavilion is inspired by Farnsworth House, with 134 editable parts and six unlocked groups, including individual windows, steel sections, furniture, transparent tree silhouettes and a Modulor-inspired scale figure. Its provisional Illinois location is prefilled; measured topography awaits verified source data. Each opening creates a separate copy and preserves the current project. Preparing this sample uses no AI credits. See the [sample guide](docs/SAMPLE-PROJECT.md).

**Phone and AR update:** phones use focused bottom sheets and larger touch targets; desktop retains movable panels. AR reports real viewing width and offers a fixed-scale iPhone handoff. WebXR adds two-point width fitting and the shared AI conversation with live model updates. iPhone Quick Look requires returning to ATELIER to converse; actual camera/voice performance still needs device verification. See the [phone and AR guide](docs/INTERACTION-REFINEMENT.md#phone-camera--ar).

**Latest drawing update:** use **Draw** to place rectangles, circles and closed outlines directly in the viewport, with live measurements, snapping, optional exact sizes and immediate push/pull. Creation framing moves closer to the new geometry; a camera-sized fading grid and world-anchored formation labels keep the space legible. **R/C/L** draw, **P** pulls, **M** moves, **Q** rotates.

**Other interaction improvements:** move and rotate multi-selections together, select named groups, create 2D profiles and extrude them from the visible **Create** tool, drag the map beneath the model, and use one organized tool panel at a time. Sections have independent cut/plane switches and a draggable plane. **Moodboard** opens a separate 3D reference desk for images, notes, links and saved model snapshots, saved with each project. **Camera → View in your space · AR** prepares a real USDZ model or starts WebXR on supported phones. See the [interaction and phone-viewing guide](docs/INTERACTION-REFINEMENT.md) for controls and device-verification limits.

**For a new installation only:** follow [Activate AI and voice on Render](docs/HOSTING.md). The included blueprint hosts the app and private backend together over HTTPS; you only need a hosting account and an OpenAI API key. Export your current project before changing website addresses.

Use Node.js 24 and npm. All code, server integration, tests and setup scripts are in this repository.

```bash
npm ci
npm run dev
```

Open the address printed by the application server **on that same computer**. The dev server serves both the React app and its `/api` endpoints on port 5173. Without credentials, direct geometry creation/editing, selection, Booleans, undo and project import/export still work; text requests explain that AI is not configured and voice is disabled.

For real conversation, configure these **server-side** environment variables through your hosting provider's secure environment settings, or in a local ignored `.env` file (see `.env.example`):

| Variable                 | Purpose                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ATELIER_OPENAI_API_KEY` | Provider API credential with access to the Responses API and Realtime API. Never expose it to the browser or commit it.                             |
| `ATELIER_TEXT_MODEL`     | Optional; defaults to `gpt-4.1`. Must support strict structured outputs.                                                                            |
| `ATELIER_VOICE_MODEL`    | Optional; defaults to `gpt-realtime`. Must support WebRTC calls and function tools.                                                                 |
| `ATELIER_APP_PASSWORD`   | Workspace access password; required with a provider key in production. Enter this password, never the provider key, in the app's connection dialog. |
| `ATELIER_ORIGIN`         | Exact public HTTPS origin behind a reverse proxy. Render's default URL is detected automatically; set this for custom domains.                      |
| `PORT`                   | Optional; defaults to `5173`.                                                                                                                       |

Restart the server after changing its environment. The cloud network must allow `api.openai.com`. `ATELIER_OPENAI_API_KEY` is used instead of the platform-reserved `OPENAI_API_KEY` binding name. A proxy-backed cloud credential should be used through the configured HTTPS proxy; do not extract or replace it.

Production hosting requires a Node service with HTTPS:

```bash
npm ci
npm run build
npm start
```

The process serves `dist/` and the API from the same origin. Configure the variables above securely on that service. The server preserves inherited proxy and CA trust. Provider keys never enter Vite's client bundle; do not use a `VITE_` prefix for secrets. There is no external database requirement.

## Browser access and GitHub Pages

This Codex Cloud onboarding session does not provide a public web preview. A cloud terminal's loopback address cannot be opened through your desktop's localhost.

GitHub Pages can still host the **static modeling workspace**, including the bundled WASM geometry engine. The existing manual **Deploy ATELIER to Pages** workflow builds and tests the `/atelier/` path before publishing. Pages cannot run the credential-holding API server, so real AI and voice require the Node deployment described above. No secret should be placed in a Pages build. The app shows its disconnected state honestly when no backend is available.

To publish the static workspace: push/merge the desired version, set **Settings → Pages → Source → GitHub Actions**, then run **Actions → Deploy ATELIER to Pages**. Open GitHub's reported deployment URL after success. The workflow is manual; adding code does not itself publish a site. A Phase 2 **Pages** deployment has not been verified; the existing full application uses Render.

## Use the workspace

The studio update adds a minimal floating conversation dock, per-object colors, **Solid / Wireframe / Hidden line** views, scale people, and optional geographic map placement. Open **Studio** for appearance and location. See the [studio guide and supported modeling vocabulary](docs/STUDIO-UPDATE.md). The camera-aware north compass and slower footprint-to-volume creation motion and animated geometry updates keep the model readable. Motion respects reduced-motion preferences and never changes model measurements or undo history. Click or drag the model to settle a creation immediately.

**Import** accepts **FBX, OBJ, STL, self-contained GLB and ATELIER JSON**. Mesh files are added beside existing objects after units/up-axis review; JSON restores a project. Revit FBX exports can retain separate named elements, basic colors and assembly offsets in one group. Limits are 200 MB / 1,000,000 triangles, subject to object and browser-storage budgets. Closed meshes can participate in solid operations, while open meshes remain reference surfaces. See [formats and limits](docs/IMPORTS.md) and the [complete Phase 2 requirement audit](docs/PHASE2-AUDIT.md).

Start by describing what you want to design, in your own words. The AI chooses supported geometry internally and asks useful architectural questions when needed. You do not need to choose a primitive or follow the pavilion example as a template. Short answers and corrections continue the same conversation. The main screen has no shape picker or specialized building buttons; **Objects → Manual tools** and the contextual inspector preserve optional direct controls.

Enter sends a message; Shift+Enter adds a line. Conversation stays visible, and successful replies lead with the intended architectural result. Expand **Measurements & changes** for the engine's actual output. The planner receives those verified measurements on later turns. The saved conversation remains scrollable (up to 80 messages). Measurement questions return actual engine results without changing geometry or consuming undo history. Questions do not change the scene, and in-flight requests do not discard a draft typed while waiting.

- Describe what you want in the conversational input: for example, “Create two boxes,” “Move the second one to the right,” or “Make it taller.” These requests go to the real configured model; users do not need to learn a command syntax.
- Select objects in the viewport or scene list. Shift-click adds objects to a group. The selected object and conversation context are sent with each request.
- Left-drag to orbit, right-drag to pan, scroll to zoom. **F** frames the scene. **G** activates translation handles, **R** yaw handles, and **V** selection. The viewport fills the workspace. Open **Objects** when needed; click the selected dimensions or the inspector icon for exact measurements. Both panels stay collapsed by default. Camera framing animates smoothly; selection and transforms reuse unchanged meshes.
- Approximate moves use 10% of the object's largest dimension (minimum 0.25 m). Approximate enlargement normally adds 10%. The engine reports the actual distance or dimension. Camera-relative left/right differs from project north (−Z).
- Optional direct workflow: open **Objects → Manual tools** to create boxes, cylinders, spheres or rectangle/circle profiles. Extrude a profile into a solid. Select two solids in order to expose union, subtraction and intersection. For subtraction the first selection is the retained base and the second is the cutter.
- Destructive AI operations and Booleans are evaluated on a private copy first. Only a valid result reaches review; expand **Checked result · not applied yet** to see the measurements. Approval installs that checked result if the project and history are unchanged. Clarification questions do not change geometry. Empty/invalid Boolean results leave original objects intact. Operands remain in the result recipe and can be restored with undo.
- Use Ctrl/⌘ Z to undo, Ctrl/⌘ Shift Z to redo, Ctrl/⌘ D to duplicate and Delete to remove the selected object. Direct delete remains immediately undoable. Ctrl/⌘ K focuses the conversation.
- Version-1 projects migrate into a new version-2 session without overwriting the old local-storage key. Up to 50 modeling snapshots persist across reloads. Export JSON to back up the model and its recipes/history; import accepts old projects and new sessions. Local storage is per-browser/per-origin and is not a cloud account backup.

For continuous voice, configure the backend, open the application over HTTPS, unlock it if prompted, press the microphone and allow microphone permission. The application uses WebRTC and the Realtime API with semantic turn detection. Voice invokes the same planner and geometry engine as text. Stop the microphone to end the connection and release capture. Voice also stops after five minutes without speech. Overlapping spoken modeling turns are queued in order; stopping drops queued turns while an already submitted edit may finish. Reviews can be accepted with the **Apply change** button or an explicit conversational approval through the same planner. Spoken confirmation routing and microphone cleanup are covered by transport doubles; this does not establish successful live audio. Actual spoken behavior is unverified until tested with a configured account and a real microphone.

## Architectural modeling

Custom straight-sided footprints (including L/U/T outlines and triangles) can be created as flat shapes or genuine extruded solids. Up to 64 corners are supported, with self-crossings and degenerate outlines rejected. Dimension edits scale the saved footprint; courtyard holes use real subtraction. Existing rectangular, curved, Boolean and architectural geometry is preserved.

The assistant's structured tools also support rotating a composition around its shared center or a reference object, aligning roofs/bases/world-envelope sides, naming volumes, and querying material volume, surface area, profile area and shared solid volume. Group movement and duplication preserve layout. Approximate “spread them more” increases the existing projected spacing. These engine capabilities are verified with structured plans; live interpretation still requires funded API testing. Measurements explicitly distinguish envelope gaps from nearest-surface clearance and material volume from enclosed interior space.

Raised volumes, signed rectangular footprint offsets, exact stacking/centering, real cylinder intersections, and editable floors/curtain walls are implemented. The optional **Floors & glass** action inside the inspector works directly on a selected solid without an API call. Two floors create two occupied floor slabs plus a roof slab while retaining the original envelope height and elevation. Glazing and mullions are separate closed solids; curtain walls currently require a constant vertical footprint.

See [the architectural example and downloadable projects](docs/ARCHITECTURAL-EXAMPLE.md) for the 100 × 20 × 8 m raised pavilion, 45° rotation, radius-4 m cylinder and floor conversion. These projects include undo history and can be inspected without API credits. They are authored geometric examples, not evidence of live language understanding.

## Verification

```bash
npm test                     # geometry, plans, context, API/security/SDK contracts
npm run build                # TypeScript + optimized production assets/WASM
npx playwright install chromium
npm run test:e2e              # real Chromium rendering and UI interaction
ATELIER_TEST_PRODUCTION=1 npm run check
npm run test:pages            # static dist under /atelier/, including WASM
npm run test:live-ai          # actual provider; exits 2 if unavailable/clarification needed
npm run format:check
```

Playwright uses `/usr/bin/chromium` when available; otherwise install its Chromium build. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` overrides the executable. Headless tests use software WebGL. Conversation browser tests use **explicit model-response fixtures** to test the UI and actual CSG execution; they do not prove live language understanding. `test:live-ai` never substitutes fixtures and reports when live verification cannot run. Its controlled geometry test automatically accepts reviews; the interactive application does not.

The requested seven-statement sequence is covered at the structured-operation and browser-contract levels. Live ambiguity, reference resolution, model quality, audio recognition, turn-taking and real microphone behavior must be verified separately. Evidence and limitations are in [validation](docs/VALIDATION.md).

[Architecture and kernel choice](docs/ARCHITECTURE.md) · [Cloud operations](docs/CLOUD.md) · [Preserved roadmap](docs/ROADMAP.md)

Terrain imports, site modeling, calibrated PDF/image reference planes, advanced snapping, verified bilingual conversations, design alternatives and native CAD/BIM export remain on the roadmap. Image attachments for the multimodal planner and geometry-only OBJ export are now implemented. This milestone does not fabricate those capabilities. Solid modeling is tessellated Manifold geometry, not certified CAD or exact analytic BREP.

## Expressive studio

[Open the control guide](docs/EXPRESSIVE-STUDIO.md) for sweeps/lofts, hollowing, push/pull, sections, satellite maps, solar studies, walkthrough cameras, groups, photo references, volumetric trees and OBJ export. The existing server and API configuration continue to apply. Live model/voice quality still requires funded verification.

On iPhone, choose **Orbit**, **Pan**, or **Edit** on the left. One finger orbits or pans; two fingers pan and pinch-zoom. **Tools → Panoramas** imports a locally saved panoramic photo for drag, pinch and optional phone-motion viewing. See the [panorama and touch guide](docs/PANORAMAS.md).
