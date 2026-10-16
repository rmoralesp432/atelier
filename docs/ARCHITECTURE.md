# Conversational modeling architecture

The Phase 1 React application, Three.js viewport, orbit and transform controls, exact-value inspector, scene list, project import/export and local modeling functions remain. The prominent command guide and syntax-oriented input were removed. Natural text is never sent to the legacy keyword parser.

## Flow

1. `src/intelligence/client.ts` sends natural text, recent conversation, selected IDs, object dimensions/positions, operation context and camera projections to the same-origin application backend.
2. `server/provider.ts` uses the OpenAI Responses API with a strict JSON schema. It receives flexible language; there is no expanded keyword table or fallback that pretends to be AI. Responses are not stored by the API (`store: false`). Model data is still sent to the configured provider; its applicable data policies govern processing.
3. `src/intelligence/plan.ts` validates the returned plan. Unknown operations, unsafe ranges and edits attached to clarification questions are rejected. IDs must resolve against the current scene. No model-generated code is executed.
4. `src/intelligence/engine.ts` executes the plan as an atomic transaction. On failure, the original session is retained. A changed scene invalidates an in-flight plan or pending review. Booleans, opening creation, architectural envelope conversion and AI deletion require an explicit review before application; a clarification does not edit anything.
5. `src/geometry/kernel.ts` evaluates geometry using Manifold WebAssembly. The viewport renders the resulting triangle meshes and measures their actual solid volume, rather than the bounding-box volume.

Model plans operate on stable IDs. Internal references `$selected`, `$focus`, `$created` and `$operands` allow follow-ups across turns and compound operations. They are implementation details, not a command language for users. The schema supports creation, movement, resizing, yaw rotation, arrays, spacing, base-center alignment, relative placement, extrusion, Booleans, openings, selection and undo/redo.

## Spatial conventions

Units are meters. X/Z is the ground plane; Y is up; project north is −Z. Camera right comes from the live Three.js camera, projected onto the ground plane. Forward is its perpendicular on that plane. View-relative directions do not silently turn into world X/Z. Visible object centers and normalized screen positions are included in model context so references such as “the building on the right” have evidence to use.

Approximate translation uses 10% of the largest object dimension, with a minimum 0.25 m. Approximate enlargement uses a 1.1 scale factor; shrinkage uses 0.9. Actual resulting measurements are reported by the engine. “Next to” uses bounding extents plus a stated gap; “overlap” uses half the combined extents. Alignment currently aligns base centers along a chosen world axis. The model must ask when axis, target, subtraction order or opening placement is unclear.

Openings cut through the wall's local Z direction. Their cutter and original wall remain in the recipe; width/height edits rebuild the solid. Arbitrary face picking, curved-wall openings and general BREP feature editing are outside this milestone.

## Geometry kernel evaluation

- **Manifold 3.5.4 (chosen):** robust manifold-solid Boolean operations, cross sections, extrusion and inspectable mesh/volume/status APIs; runs in the browser via bundled WASM. Tests establish closed edge topology and known numerical volumes. It is a tessellated solid kernel, not an exact analytic BREP kernel.
- **three-bvh-csg (considered):** a natural fit for interactive Three.js mesh Booleans, but manifold-solid output and robust repeated architectural cuts are the higher priority here. It was not installed or benchmarked.
- **OpenCascade/BREP (future):** appropriate for analytic surfaces and professional CAD exchange, with larger integration and deployment costs. Not claimed as supported.

Boxes have exact rectangular dimensions. Curved primitives are tessellated (64 segments for circles/cylinders, 48 for sphere construction). Real union/subtraction/intersection meshes replace the operands in the active scene. The first operand ID survives; both original operands are stored recursively. Empty intersections and non-intersecting cuts are rejected without removing the originals. Boolean results can be transformed or resized; doing so scales the evaluated result relative to its original bounds.

Current safeguards: at most 200 active objects, 20 copies per operation, 12 operations per AI plan, 10 nested recipe levels and 100 nodes per recipe. Modeling remains on the browser thread; large studies require future worker/caching work and performance profiling.

## Architectural envelopes and display

`create_at` names and positions solids by their base center; `$name:…` resolves only a unique current name, allowing compound plans to refer to objects created earlier in that same plan. Existing IDs remain preferred. `position` preserves unspecified coordinates. `center_on` accounts for both objects' heights when placing above/below or at their common 3D center. `offset_base` expands or insets a rectangular footprint symmetrically and retains focus on the upper volume; the model asks when the offset direction is unspecified.

A `building` recipe preserves the source envelope, identity, dimensions, rotation and elevation. Floor slabs are genuine intersections between that source and horizontal bands. `floors` counts occupied floor slabs plus an additional roof closing the original height. Glazing is an inset perimeter ring extruded and clipped to the envelope; mullions and rails are real solids. Glazing subtracts frame/slab solids so their appearance is not a substitute for Boolean geometry. Source sections at multiple elevations must match for a facade; sloping facades are explicitly rejected. Slabs alone can follow nonuniform envelopes. Limits include 30 floors and 800 vertical frames per envelope.

Editing floor or panel parameters regenerates the original envelope without recursively nesting building recipes. Overall dimension edits regenerate its envelope while retaining the stated slab thickness and facade parameters. Unsupported compressed floor clearances are rejected. Editable recipes and their original operands are saved in project history. These are conceptual architectural elements, not BIM families or structural certification.

The viewport draws separate solid/glass/frame meshes from the same kernel. Creased normals retain flat architectural faces and smooth curved surfaces. Environment lighting, real shadows, restrained edges and translucent glazing improve depth. An ID/geometry signature cache avoids rebuilding meshes for selection, translation, yaw or tool changes. Camera framing eases over 500 ms, respects reduced-motion preferences and stops when the user starts orbiting. Optional object/inspector panels float over the full-size canvas; conversation history is open by default and can be collapsed. Shape selection is confined to optional manual tools; floor conversion controls live in the inspector. The planner is instructed to infer supported geometry, ask design-oriented questions, interpret short answers in context, and avoid turning the example into a template.

## Data preservation

Phase 1's `atelier.project.v1` local-storage key is read and left unchanged. Phase 2 writes `atelier.session.v2`, containing project geometry, reversible snapshots and conversation reference context. Corrupt stored data is not overwritten automatically. Up to 50 undo snapshots are persisted. Conversation text uses `atelier.conversation.v2` (last 80 messages; last 20 sent to the planner). JSON export contains the complete current modeling session and operand recipes. Import accepts original version-1 projects, version-2 projects and version-2 sessions. Session import restores its past/future snapshots within the 50-step limit and inserts the receiving project as the immediate undo-import step. The complete receiving session is also backed up under `atelier.session.v2.before-import` before replacement; a failed backup aborts import. Export remains the recommended durable backup. Browser storage has a quota: export your project when the save indicator reports a failure.

The browser stores an optional conversational `summary` alongside the engine's authoritative message. A model's apply-summary is displayed only after successful execution; actual measurements remain accessible in a disclosure and are the content sent back to the planner. UI-only metadata is stripped from API history. Existing conversation records without summaries remain compatible. Multi-line input supports Enter to send and Shift+Enter for a line break, protects composition input, and preserves drafts submitted while a request is still in flight.

## Voice

The browser requests microphone permission only after the user presses the microphone button. It creates a WebRTC offer; the backend uses OpenAI Realtime Calls to exchange SDP using the server-side key. The browser receives SDP, never a provider key. Realtime uses semantic turn detection for continuous conversation and a `design` function. That function invokes the same text planner, context and validated geometry engine. The function returns executed measurements or a clarification/review state before the voice model is instructed to describe the outcome.

Stopping voice closes the peer connection and data channel and stops every microphone track. A pending destructive review can be accepted by button or explicit natural-language approval. The real planner receives the pending review description and returns a no-operation `confirm`/`cancel` intent. The client applies only the stored, unchanged reviewed plan; a missing or stale review cannot be approved. The voice model routes spoken approvals to the same planner. Actual microphone permission, media transport, spoken recognition, turn-taking and audible responses require live testing with a configured account. SDK-contract and UI tests are not proof those work.

## Server boundary

The Express API keeps the provider credential server-side. It enforces request schemas/body limits, same-origin requests, per-IP rate limits and a configurable workspace password with HttpOnly/SameSite cookies. Production startup with an AI key requires a workspace password. Deploy behind HTTPS; set `ATELIER_ORIGIN` to the exact external origin. Sessions and rate limits are in-memory for this single-user service; this is not a multi-tenant identity system.
