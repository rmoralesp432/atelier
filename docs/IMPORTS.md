# Bring 3D elements into ATELIER

Click **Import**, or drop one file onto the workspace. OBJ, STL and GLB open a preview of the resulting size and geometry type. Choose the source units and vertical axis, then **Add to workspace**. The imported element is placed beside the existing model, selected, and available to the conversation. Existing objects stay in place. Undo removes the import; JSON export includes the imported geometry and history so the source file is not needed to reopen it.

| File    | Supported content                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.obj`  | Triangle/polygon mesh surfaces, triangulated by Three.js. No MTL or textures.                                                                                   |
| `.stl`  | ASCII or binary triangle surfaces. Defaults to Z up; verify the source convention.                                                                              |
| `.glb`  | Self-contained GLB 2 with embedded, static, uncompressed triangle geometry. Scene-node transforms and mirrored winding are retained.                            |
| `.json` | ATELIER project/session restoration, including older projects. This replaces the active project with an undoable import; it does not merge unrelated JSON data. |

Meshes use meters by default. Centimeters, millimeters and feet are supported. OBJ defaults to Y up; GLB uses Y up. The preview reports **width × depth × height** after conversion. All source mesh pieces are combined into one selectable element with its base centered. Source materials use ATELIER's studio finish. External resources are never requested during mesh import.

## Solid or reference?

A closed mesh accepted by the Manifold kernel is labeled **Closed solid**. It can be moved, rotated, scaled, measured and used in real Boolean operations. It retains triangle geometry rather than source CAD parameters. Floor/facade operations still need a suitable envelope and may reject unsupported shapes.

An open or non-manifold mesh is labeled **Reference surface**. It remains visible, selectable, movable, rotatable and scalable. ATELIER does not invent a solid volume or silently close holes. Boolean cuts require a valid closed solid. Flat references use a nominal 1 mm bounding-envelope thickness for transform controls; their triangles are not thickened.

## Current limits

- One file per import, at most 10 MB and 20,000 triangles; each dimension must fit within 500 m, with at least 1 mm overall extent.
- Geometry only: no textures, MTL, animation, skinning, morph targets, compressed GLB or GPU-instanced GLB. Export a static uncompressed triangle mesh from the source tool.
- Standalone `.gltf` with external buffers is not accepted; export a self-contained `.glb`.
- Dense assets can exceed browser save capacity once history is included. The import checks a conservative two-million-character session budget before changing the workspace. A rejected import leaves the current project intact. Subsequent edits can still grow history; heed a storage warning and export a backup.
- Imported data is stored on this browser/origin, not uploaded to a project database. The planner gets object names, bounds and reference/solid status, not the entire triangle payload. It does not visually recognize an imported chair or building solely from its mesh.
- RVT, IFC, DWG, STEP, PDF, images and terrain are not supported by this importer. See the [Phase 2 audit](PHASE2-AUDIT.md) for remaining roadmap requirements.

## References and export

The conversation photo button separately accepts PNG/JPEG/WebP design references for the real multimodal model. It does not import them as geometry or calibrated reference planes. The export menu now writes world-space OBJ geometry with meter/Y-up instructions. ATELIER JSON remains the modeling-history backup. See [the expressive studio guide](EXPRESSIVE-STUDIO.md).
