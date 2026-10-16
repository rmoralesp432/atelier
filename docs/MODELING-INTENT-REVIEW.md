# Modeling intent review — October 16, 2026

ATELIER uses a real model to interpret a conversation into validated operations. A vocabulary list in its instructions is guidance for that model, not a keyword parser or a claim to implement AutoCAD. Text and voice execute the same plans. No paid model calls were made for this review; broad language understanding and live voice latency still need funded testing.

## Sources actually inspected

- [Autodesk Developer Network: MgdDbg, ModifyEntTests.cs](https://github.com/ADN-DevTech/MgdDbg/blob/master/ObjTests/ModifyEntTests.cs): `XformMove`, `XformRotate`, `XformScale`, `XformMirror`. These demonstrate base-point/displacement semantics, rotation around a base point and axis, positive uniform scale around a base point, and the separate choice to keep or replace originals when mirroring. ATELIER deliberately has a narrower scope: Y-axis rotation and X/Z reflection planes.
- [Autodesk Developer Network: AutoCAD .NET training](https://github.com/ADN-DevTech/AutoCADDotnetTrainingMaterial): the `ACAD2026_net_Training.zip` archive, especially **Lab 7 — EntityJig**, describes continuously sampling user input and updating preview geometry. ATELIER's move/rotation preview, live measurements and single undoable release follow that interaction principle. No Autodesk source code was copied into the app.
- Autodesk's command-reference help site is blocked by this cloud environment's network policy. This is a targeted review of accessible official developer materials and ATELIER's implementation, not an exhaustive review of current AutoCAD commands. Arrays and stretch below were audited against ATELIER's own tested engine; the downloaded training material does not establish full AutoCAD equivalence for them.

## Behavioral contract

| Architectural intent               | Interpretation and limit                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Move / MOVE                        | Displacement preserves shape and identity. Camera left differs from project west; base-point-to-destination means B minus A.                                                                |
| Copy / COPY                        | Independent new IDs; originals remain. “Four copies” means four new objects, “four total” includes the original.                                                                            |
| Linear / rectangular / polar ARRAY | Repeated solids with explicit count, spacing and center. Grid and radial counts include the original. Full-circle arrays avoid a duplicate endpoint. No associative editing or path arrays. |
| SCALE                              | Positive uniform factor around a specified pivot or shared base center, including group spacing. Reference-length scaling uses desired/current length.                                      |
| Stretch / STRETCH                  | One rectangular end face moves; its opposite face stays fixed, even when the box is rotated. No arbitrary vertices or crossing-window selection.                                            |
| Mirror / MIRROR                    | Reflect genuine geometry, choose keep-original vs replace, and preserve source recipes. Only project X/Z planes and closed solids.                                                          |
| Rotate / ROTATE                    | Individual yaw or one composition about a shared/named pivot. No unrestricted pitch/roll. Mouse rotation displays angle and supports 15°, 45°, 90° increments.                              |
| Align / ALIGN                      | Base centers or envelope edges on an explicit axis; not full three-point 3D alignment.                                                                                                      |
| Offset / OFFSET                    | Rectangular inset/outset lower envelope; not a general curve offset solver.                                                                                                                 |
| Extrude / EXTRUDE                  | Supported 2D profiles into real solids. No sweep or loft.                                                                                                                                   |
| Union / subtract / intersect       | Genuine Manifold solids, retained operand recipes, review and undo. Not simply overlapping or transparent meshes.                                                                           |
| Name / select / color / measure    | Stable object identity, contextual references, visible selection halo; real solid measurements where supported.                                                                             |

The model instructions now explicitly distinguish scale from stretch, total array count from new copy count, center spacing from clear gap, relative moves from absolute positions, UI snapping from exact conversational dimensions, and independent copies from associative arrays. They also instruct concise English/Spanish follow-ups and refuse to silently substitute unsupported trim, join, explode, fillet or path-array behavior.

## Workspace control vocabulary

Projection, map visibility, themes, render styles, framing and panel visibility have explicit validated operations. They use the same model and voice tool as geometry, with the current workspace state included in planning context. Orthographic projection is distinct from orthogonal movement constraints; camera rotation is distinct from turning a solid. A workspace-only request does not create a geometry undo entry or replace the last modeling focus.

## Verification boundary

The existing geometry tests verify rotated stretch anchoring, group scaling and solid volume, asymmetric reflection and reversal, grid/radial spacing and identities, copy/undo, CSG and architectural operations. Browser fixtures verify the model-response-to-workspace path. A fixture cannot establish that a live model will correctly interpret every synonym. Before making that claim, run the funded live-language sequence and a separate microphone conversation test with real audio, interruptions and corrections.
