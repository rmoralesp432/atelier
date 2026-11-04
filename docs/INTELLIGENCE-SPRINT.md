# Architectural intelligence sprint

Development branch: `feat/architectural-intelligence-sprint`. This work is for review; it does not change the running Render service.

## Audit and decisions

The previous system already had a real Responses/Realtime integration, Manifold booleans, polygon footprints, sweeps, lofts, material rendering, and an undoable geometry engine. The important gaps were in the connection between reasoning and execution:

- A single 12-operation answer could not inspect its results before proposing the rest of an unfamiliar building.
- Validation ran geometry again during installation, generating different identities for newly created objects.
- Editable architectural assemblies required many calls; ordinary creation could not represent thin glazing.
- A named group could not be used as a target. Component copies retained original host links.
- Form recipes were available only for the primary selected object. Important design decisions depended on a short chat history.
- Only two downsampled reference images could reach the model together.

## Implemented foundation

The planner can now work through up to five checked stages and one repair, within a 64-operation transaction. It receives the actual provisional scene and operation receipts after each stage. No provisional geometry is saved. Completion installs that exact geometry once; cancellation, clarification or failure discards it. A completed multistage edit is one Undo step. Auth/billing/transport failures do not trigger retries.

A generic assembly operation creates independently editable primitives in local coordinates, with semantic roles, levels, materials, named groups, host links and grid repetitions. It is not a building template. Existing footprints, sweeps, lofts and real CSG remain available for nonrectangular members. Component queries scope edits by group, role, level, material, name and visibility. Numeric verification checks actual element counts, dimensions, elevations and evaluated solid volume. Thin assembly members permit glazing down to 5 mm.

Duplication, rectangular/polar arrays and mirrored copies remap hosts inside each instance; a copied child without its host is detached. Boolean results retain the base identity and remove dangling cutter-host links. Destructive edits to existing geometry still require a review; booleans used entirely within newly created geometry no longer produce redundant review prompts.

Project design notes persist user requirements, drawing observations and assumptions separately. Full form recipes are available beyond selection, subject to a bounded context payload. Group membership and world bounds are explicit. Inferred legacy component roles are distinguished from explicit roles.

Up to six JPEG/PNG/WebP references can be attached together. Images are processed at up to 2048 pixels, sent as actual high-detail vision inputs, retained across stages, and available in the next conversational turn. The planning instructions reconcile plans/sections/elevations, record evidence versus assumptions, and construct an editable interpretation in stages. This is a reconstruction foundation, not certified drawing recognition or a general reverse-engineering service.

## Solar studies

The existing SunCalc-based lighting now has daily and four seasonal trajectories, local-date solstice/equinox presets, civil sunrise/noon/sunset, polar-day/night handling, and ground-shadow measurements. Paths split at the horizon instead of drawing a false line across night. Date/time settings are shared between the panel and the text/voice modeling tool. Geographic coordinates, project bearing, date and explicit site UTC offset determine the calculation; the computer's timezone does not substitute for the site's timezone. Set the correct seasonal/DST offset yourself.

The engine can report potentially sun-facing local sides and a top point's shadow on level ground. This is a directional concept study, not a numerical evaluation of neighboring obstructions, terrain, daylight, thermal comfort or energy use. Existing viewport shadow rendering remains in use. Seasonal event calculations determine calendar presets, not precision ephemerides.

## Reliability

Stopping a request now cancels the upstream provider request as well as discarding provisional geometry. Failed operations identify their step and type. Camera/presentation targets are resolved while their stage context exists and rechecked against the final project before installation. Later selection changes cannot silently redirect earlier staged targets. The existing building decomposition also now labels framing as framing, the top slab as a roof, and occupied slabs as floors; this prevents semantic queries from treating mullions as columns.

## Validation

- 222 unit/integration tests passed after the intelligence, solar and reliability changes.
- 115 distinct production-browser scenarios passed across a broad regression run and corrected reruns. The final-build rerun passed all 15 cases: all nine previously failing UI expectations, the new editable-assembly/scoped-column-edit test, staged construction/undo, cancellation, six-reference transmission, solar controls, and hidden-line rendering. Earlier tests were updated for the Day default, compact phone menus, conversation minimization and non-destructive alternatives.
- Production TypeScript/Vite build passed.
- Static-hosting smoke test passed at `/atelier/`: real rendering, editing/reload, lazy assets, FBX/panorama imports and worker-prepared USDZ. Static GitHub Pages still has no AI backend; conversational features need the application server.
- Browser language outputs are explicit provider fixtures; the actual geometry engine runs. These tests do not establish live language or image understanding.
- A live model-access check returned `401 invalid_api_key`; the user subsequently requested completion without live API testing. No successful live language, vision or voice evaluation is claimed. No billing or production settings were changed.

## Running and evaluating the review branch

Use Node 24+, `npm ci`, `npm run dev`, then the URL printed by the server. For the production application use `npm run build` and `npm start`. API credentials stay server-side in `ATELIER_OPENAI_API_KEY`; do not put them in a Vite variable or the browser. This PR leaves the configured production model unchanged (fallback `gpt-4.1`). If a compatible GPT-5 model is explicitly selected with `ATELIER_TEXT_MODEL`, the provider requests medium reasoning; that configuration has not been live-validated here. Realtime voice continues to use the same checked modeling callback as text. It is not a new voice implementation.

`npm run test:live-architecture` only generates offline plan/section evaluation images in `/tmp/atelier-architecture-evaluation`. It does **not** call a model. A future explicitly authorized run with `-- --live --seed=23` uses the actual provider, variable dimensions and geometric assertions, with a maximum of 16 model calls. It can incur API charges. Its checks cover editable construction, scoped column edits, unrelated-object preservation, drawing dimensions, solid validity and undo. This script was prepared for later evaluation; live results are not available.

## Suggested 10-minute presentation

Rehearse these on the review build before presenting. They are general evaluation scenarios, not certified live-language results or scripted building templates. Choose dimensions, levels and forms yourself; inspect the actual elements rather than accepting the conversation's wording as evidence.

1. **Editable architecture (3 minutes).** Describe a small unfamiliar gallery or pavilion with two occupied levels, a separate roof, circular columns and glazed sides. Supply overall dimensions and level elevations. Ask for separate editable members and verification of the floor count and column diameter. Minimize the conversation to inspect the model; check names, roles, dimensions and glass rendering.
2. **Scoped editing (2 minutes).** Ask to widen only the columns in that named group while leaving the glazing and a neighboring object untouched. Inspect the changes, then Undo and Redo. Ask for a central opening and review its operands before accepting it.
3. **References (3 minutes).** Attach a readable plan and section together, with a shared scale. Ask for an editable interpretation and a list of documented versus assumed dimensions. Inspect floor elevations, wall thickness and roof height. If a dimension is unclear, the assistant should ask rather than claim precision.
4. **Sun and navigation (2 minutes).** Set the site's location and correct UTC offset. Compare June and December paths, move the time slider, inspect the actual shadow, and ask for a top view or a walk position. Explain that the numerical report is directional analysis, not a building-performance certification.

Until live AI access has been rehearsed, use the manual geometry and solar tools for a dependable offline demonstration. Do not present provider-fixture tests as a live AI demo.

## Remaining limits

200 active editable objects, bounded tessellated curves/solids, no unrestricted NURBS or BIM/structural certification. Planning checks finite geometry and explicit assertions; it cannot prove that every unstated architectural intention is satisfied. Image interpretation remains uncertain, especially unreadable dimensions and unseen geometry. Native iPhone AR fidelity and aggressive AR simplification remain separate pending work; this sprint does not claim to fix them.

Next priorities: run holdout live language/vision evaluations and assess actual success rates; add reference-to-render comparison for reconstruction; then address AR appearance/detail preservation with a representative imported model and a physical iPhone. PDF/vector-drawing interpretation and physical-device voice/AR validation are not part of this delivery.
