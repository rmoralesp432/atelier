# Design reasoning and geometric acceptance

This pass builds on the [volumetric modeling tools](VOLUMETRIC-INTELLIGENCE.md). Its focus is the gap between executing valid operations and completing the requested architectural model. Text and the Realtime voice design tool share this planner; there is no new keyword parser or collection of scripted building answers.

## What changes

1. **Read the project.** The model receives a compact factual inventory of groups, explicit component roles, level elevations, shape counts, focused objects and nearby envelope gaps. Imported meshes remain unclassified unless they have component metadata; proximity is not presented as exact solid clearance.
2. **Declare the intended result.** Complex modeling starts with a retained design brief: objective, existing objects allowed to change, properties to preserve, measurable requirements and the source of important decisions. User measurements, drawing observations and assumptions are distinct.
3. **Construct editable geometry.** The existing profile, assembly, opening/glazing, sweep, loft, revolve, Boolean and transformation tools run against a private project. Later stages receive actual object identities, execution receipts and the current provisional scene.
4. **Check the result independently of the operations.** The geometry engine evaluates the declared requirements. Valid operations alone cannot make an incomplete proposal pass. A correct count with a misplaced column fails a layout check; an opaque disk fails a glazing-material check.
5. **Correct or leave the project unchanged.** Failed final requirements return measured observations to the model. Successful provisional stages are retained for correction, but not installed in the user's project. Completion, including an explicit `finish`, cannot bypass unmet requirements. A successful request is saved once and has one Undo step. Clarification, cancellation or exhausted corrections leave the original project unchanged.

Simple selection, workspace changes and single-object transforms need not create a brief. The strict provider schema requires `brief` or `null`; compound edits, arrays, component construction and topology operations require a brief. Older local/manual plans may omit this field for compatibility. This is an application reliability mechanism, not an authorization boundary for an untrusted client.

## Acceptance checks

| Check               | What is evaluated                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Measurements        | Count, local dimensions, base/top elevations, world envelope or actual Manifold solid volume; each member or an aggregate    |
| Layout              | One-to-one occupancy of a translated/rotated rectangular, linear or vertical lattice, with explicit center spacing           |
| Shape               | Retained primitive or construction profile/method, including I-section and revolved geometry                                 |
| Properties          | Actual material, color, explicit role, level, visibility including groups, or host link                                      |
| Solid relationships | Shared solid volume for disjointness, intersection or containment of two distinct solids                                     |
| Preservation        | Existing objects outside the declared edit scope remain unchanged; specified properties of editable objects remain unchanged |

Selection pronouns bind to the initial scene. Future unique object/group names may be checked after construction. An unresolved target is an unmet requirement, never an instruction to broaden selection. A flat footprint has zero height and volume for these checks. Count/dimension precision uses small absolute tolerances; curved solid-volume checks can explicitly allow up to 2% relative error for tessellation. Such tolerance is not allowed to relax dimensional precision.

The brief cannot be weakened halfway through construction. It persists as conversational history, but is not a permanent constraint on future user requests. Current scene facts take precedence after Undo. An invalid optional saved brief is discarded without losing otherwise valid geometry/history.

## Architectural reasoning guidance

The shared instructions call for decomposition into only the requested systems: envelope, occupied levels, supports, enclosure, openings, connections and voids. They cover scoped substitutions, generic profile/path/meridian/loft constructions, independent editable components and consistent plan/section datums.

The planner should clarify ambiguities that materially change the result: two tall stories versus one two-story void, grid lines versus bays, unspecified support spacing, unreadable drawing scale, or preserving an outer section versus steel area/capacity. Small reversible decisions should be stated as assumptions. An IPR geometry substitution does not certify structural equivalence. An unfamiliar expressive shape should use an appropriate geometric decomposition or explain a specific limitation, not silently become a box.

## Verified offline

The unit/integration corpus executes actual geometry with varied dimensions and orientations. It covers:

- Missing elements, wrong-object edits, protected window sizes, stable pronouns, immutable briefs, cancellation/clarification and saved-project compatibility.
- Six variations of column grids and same-ID I-section replacement, with analytic solid-volume expectations and deliberately misplaced members.
- Varied level schedules and incorrect cumulative elevations.
- Wall-system replacement while preserving floors and neighboring geometry.
- Real bridge landing intersections and displaced-bridge rejection.
- Hollow radial shells with independent solid probes checking their oculi.
- Glazing material/host checks, true solid relationships, curved-volume tolerances and rejection of flat profiles as 3D masses.

Production browser tests use explicitly labeled provider fixtures and the real browser modeling engine. They verify that an incomplete proposal remains private while correction is pending, cannot falsely finish, preserves successful IDs, saves/reloads the brief and commits with one Undo. Existing staged construction, cancellation, six-reference transport, circular glazing and profile/shell browser scenarios are also exercised.

Local validation for this pass: **267 tests across 60 unit/integration files passed**, plus **8 production browser scenarios** covering the new checks and the existing staged, volumetric and architectural-review workflows. TypeScript, Vite build and repository formatting checks passed. The new coverage adds 26 unit/integration cases and two browser scenarios. Render and full GitHub workflow status are release checks, separate from these local results.

These are execution, verification and integration tests. **No live language, image-understanding or voice-audio calls were made, at the user's request.** The model still interprets the user's intent into the brief. The engine checks the model against that brief; it cannot prove that the brief captures every part of the user's prose or correctly reads an image. These checks do not establish unrestricted CAD intelligence or the ability to model anything.

The existing opt-in live evaluator remains available for later assessment with a funded API account: `npm run test:live-architecture` only prepares reference drawings; adding `-- --live` explicitly enables paid model calls. No API or hosting configuration changes are required for this update.

## Budgets and scope

Brief-backed designs allow at most two total corrections and five successful stages, within the existing 64-operation and 200-object limits. Simple/legacy plans retain one correction. Authentication, network and billing failures are not automatically retried. A difficult request may therefore take more model calls than a simple edit; retries remain bounded. No import limits, terrain behavior or AR configuration were changed by this pass.
