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

## Validation so far

- 213 unit/integration tests passed after the intelligence milestone.
- Five production-browser cases passed: staged construction and one-step undo, stopping a staged request, six-image transmission across stages/follow-up, natural conversation and correction, and existing destructive-edit review/undo.
- Production TypeScript/Vite build passed.
- Browser language outputs are explicit provider fixtures; the actual geometry engine runs. These tests do not establish live language or image understanding.
- A live model-access check returned `401 invalid_api_key`. No successful live language/vision evaluation is claimed. No billing or production settings were changed.

## Remaining limits

200 active editable objects, bounded tessellated curves/solids, no unrestricted NURBS or BIM/structural certification. Planning checks finite geometry and explicit assertions; it cannot prove that every unstated architectural intention is satisfied. Image interpretation remains uncertain, especially unreadable dimensions and unseen geometry. Native iPhone AR fidelity and aggressive AR simplification remain separate pending work; this sprint does not claim to fix them.
