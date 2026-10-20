# Bring 3D elements into ATELIER

Click **Import**, or drop one file onto the workspace. FBX, OBJ, STL and GLB open a preview of the resulting size and geometry type. Check the dimensions, source units and vertical axis, then **Add to workspace**. Existing objects stay in place. Undo removes the whole import in one step. ATELIER JSON export includes the imported geometry and history so the source file is not needed to reopen it.

## Revit → ATELIER, without Blender

1. In Revit, open the **3D view** you want to export. Use a section box or hide unnecessary categories to keep the export manageable. Hide levels/grids/annotations if you do not want those exported as mesh elements.
2. Choose **File → Export → FBX**. Export the visible view as a static FBX file (7.x / 2011 or newer).
3. In ATELIER, click **Import** and select the `.fbx` file.
4. Leave **File units → From FBX file** selected initially. FBX unit metadata is converted to meters, including Revit exports whose internal coordinates are in feet. The loader converts Z-up to ATELIER's Y-up. Check a known dimension; override units or the vertical axis if the source metadata is wrong.
5. Leave **Keep elements separate and grouped** checked to retain individual mesh elements, their names, basic colors and relative positions. Click **Add to workspace**. The assembly is placed beside existing work and selected as a group.
6. Select an individual object to edit it; use **Layers and groups** to select/move the imported assembly together. Unchecking the import option combines the file into one element using the studio finish.

This is geometry transfer, not a live Revit connection. Exporting again creates another import; it does not update previously imported elements. Revit families, constraints, BIM properties and schedules are not retained, and changes do not sync back to Revit. Native RVT and IFC import are not implemented. FBX import needs no AI credits, API key or new server configuration.

## Formats

| File    | Supported content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.fbx`  | Binary and ASCII FBX 7.x static mesh nodes. Parent transforms and mirrored winding are baked; separate nodes become individually editable elements in one ATELIER group. Original node names are retained within the 70-character import limit, with unique suffixes when needed. The first material's diffuse color is retained per element; multi-material and vertex-color limitations are reported. No textures, rigs or morph targets. Animated files use their static exported pose and show a warning. Cameras/lights are ignored. |
| `.obj`  | Triangle/polygon mesh surfaces, triangulated by Three.js. No MTL or textures.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `.stl`  | ASCII or binary triangle surfaces. Defaults to Z up; verify source convention.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `.glb`  | Self-contained GLB 2 with embedded, static, uncompressed triangle geometry. Scene-node transforms and mirrored winding are retained.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `.json` | ATELIER project/session restoration, including older projects. This replaces the active project with an undoable import; it does not merge unrelated JSON data.                                                                                                                                                                                                                                                                                                                                                                           |

OBJ/STL/GLB pieces continue to form one selectable element. They default to meters; centimeters, millimeters and feet are supported. OBJ and GLB default to Y up. The preview reports **width × depth × height** after conversion. The assembled import is centered and grounded once, preserving internal offsets and elevations; georeferenced absolute coordinates are not retained. External resources are never requested during mesh import.

## Solid or reference?

A closed mesh accepted by the Manifold kernel is labeled **Closed solid**. It can be moved, rotated, scaled, measured and used in real Boolean operations. It retains triangle geometry rather than source CAD parameters. Floor/facade operations still need a suitable envelope and may reject unsupported shapes.

An open or non-manifold mesh is labeled **Reference surface**. It remains visible, selectable, movable, rotatable and scalable. ATELIER does not invent a solid volume or silently close holes. Boolean cuts require a valid closed solid. Flat references use a nominal 1 mm bounding-envelope thickness for transform controls; their triangles are not thickened.

## Large-model options

Import preparation runs in a dedicated worker on your device. The dialog opens before the file is decoded, reports progress, and **Cancel import** terminates the worker. Nothing is uploaded to an AI or conversion service. Adding the prepared geometry and saving still require browser memory and time.

- **Full detail** keeps every triangle. Identical position records are compacted to reduce memory without simplifying the mesh.
- **Balanced copy** targets 500,000 triangles; **Phone copy** targets 100,000. Both use meshoptimizer's geometric simplifier, lock open borders and retain original extents and FBX element placement. Fine details can change. Targets are best effort, not a guarantee; whole elements are never dropped just to reach a count. The dialog shows original and resulting triangle counts before adding. Your source file is unchanged.
- Reduced-detail processing accepts up to 20 million source triangles, provided the resulting copy is within the 5-million-triangle output limit. Parsing such a dense file may still exceed a phone's memory. Use a desktop browser for large Revit exports, then try a Phone copy for viewing.
- Reduced copies skip closed-solid checking by default. Enable the check explicitly if you need Boolean modeling. A reduction is a display/modeling copy, not a precision substitute for the original architectural source.

## Navigating large models

Studio → Appearance → **Viewing quality** defaults to **Automatic**. At
100,000 visible imported triangles, it uses Smooth navigation: a one-pixel
display ratio, simpler diffuse lighting, a selection frame instead of the multi-pass glow, cached
shadows, and no solid-view edge overlay or depth-of-field pass. Idle views
stop submitting GPU frames; orbit, edits, animations and newly loaded map
tiles wake them. Wireframe and hidden-line views still generate their actual
edges and can take longer on very dense files.

Large imports appear as completed objects, skipping the expensive transparent
formation fade. Smaller volume-creation animations remain enabled.

Dense parts retain shared vertices and use crisp face shading instead of
duplicating their vertices for smoothed creases. A render-only spatial index
accelerates exact surface picking. **No triangles are removed from the saved model: geometry, dimensions, history
and exports are unchanged.** These changes also
apply to projects imported before this update; reimporting is unnecessary.

Choose **Smooth navigation** explicitly on a slower device, or **Full visual
effects** to restore the higher-resolution glow/effects pipeline. This viewing
preference is separate from importing a **Phone copy**, which deliberately
reduces geometry. The source-size limits below are capacity limits, not a
promise of interactive frame rates on every phone.

## Current limits

- One file per import, **up to 512 MB and 5,000,000 triangles** (previously 200 MB / 1,000,000 triangles). Each assembly dimension must fit within 500 m, with at least 1 mm overall extent.
- At most **200 objects per workspace**, including existing objects; separate FBX nodes count toward this limit. The parser accepts up to 20,000 FBX source nodes; files with more than 200 default to a combined element. Start a new project, combine the import, or export a smaller Revit view when needed. Imports create one group when there are multiple elements; projects support 50 groups.
- Large geometry is stored once across undo snapshots in the new version-3 mesh library. Small exports remain version 2; ATELIER reads both. No history entries or triangles are discarded by this storage change. The import budget is **256 million serialized characters** for the compact modeling session, including history. Browser memory and storage remain practical limits; the caps do not guarantee every 512 MB model will work on an iPhone.
- Imports are saved to IndexedDB before being installed in the workspace. A failed save keeps the previous model. IndexedDB restores large projects even when the smaller localStorage checkpoint is full. Export ATELIER JSON backups before clearing browser/site data; browser projects are not cloud-synced.
- Models above 100,000 triangles default to **reference import**, skipping the expensive closed-solid test. All imported surfaces remain visible and support move/rotate/scale. Enable **Check closed-solid modeling eligibility** if Boolean modeling is needed; a successful Manifold check is required. Coordinates are welded/rounded to eight decimal places in normalized mesh space. Parsing and rendering still depend on device performance; a lighter Revit export remains preferable on phones.
- Textures/MTL, skinning, morph targets, compressed GLB and GPU-instanced GLB are not supported. Export a static uncompressed triangle mesh from the source tool. Standalone `.gltf` with external buffers is not accepted; export a self-contained `.glb`.
- Imported data is saved in this browser, not uploaded to a project database. The planner receives object names, bounds, colors and solid/reference status, not the full triangle payload. It does not visually recognize a building solely from its mesh.
- RVT, IFC, DWG, STEP, PDF, images and terrain are not supported by this geometry importer. See the [Phase 2 audit](PHASE2-AUDIT.md).

## Verification

Automated tests exercise a real **Revit FBX 7.7 binary** wall model from the licensed ufbx corpus: four closed wall meshes and two reference annotation meshes, feet-to-meter conversion, Z-up, original names and elevations. A second binary fixture covers FBX 7.4. An authored ASCII assembly covers parent rotation, translation, mirrored instances, colors, unit overrides, grouping, undo/reload and suppression of external texture requests. Fixture provenance and license are in [tests/fixtures/fbx](../tests/fixtures/fbx/README.md).

Revit itself is not installed in the cloud, and a large user building has not been tested. The fixtures verify the importer; they do not establish compatibility with every Revit version/export or every FBX feature.

## References and export

The conversation photo button separately accepts PNG/JPEG/WebP design references for the real multimodal model. It does not import them as geometry or calibrated reference planes. The export menu writes world-space OBJ geometry with meter/Y-up instructions. ATELIER JSON remains the modeling-history backup. See the [expressive studio guide](EXPRESSIVE-STUDIO.md).

### Interaction cost and navigation previews

Selection, color and transform edits now reuse immutable mesh data during comparisons, validation and autosave encoding. Dense sessions go straight to IndexedDB instead of repeatedly attempting an oversized synchronous localStorage write. A color change does not rebuild the mesh or its shadows.

Smooth viewing prepares a temporary navigation mesh in a background worker. While orbiting, transforming or framing, this lighter display copy targets roughly 150,000 faces across the scene, subject to boundary/error constraints. Full detail returns when motion settles. Picking still uses the original surface; project data, export and undo retain every original face. The small navigation label identifies this temporary preview. Simplification can be limited by fragmented or open imported geometry, and very large scenes still require sufficient browser/GPU memory.
