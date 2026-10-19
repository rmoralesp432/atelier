# Expressive studio

This update extends the existing ATELIER application and project format. The existing Render service, API credentials, saved projects, undo history and import pathways remain in use. It does not require another hosting setup. Live model understanding and live microphone conversations still require funded API verification; no paid model calls were made for this update.

## Find the controls

- **Conversation** remains the primary interface. Describe an outcome, answer a clarification, and review a destructive change before applying it. The assistant receives selection, stable object IDs, dimensions, names, colors, recent dialogue, operation history and camera directions.
- **Location**, beside **Map**, opens the map picker. Drag/zoom the map or enter coordinates. Choose **Street / Satellite**. **Map rotation** turns the imagery beneath the model; it does not rotate the model or its project axes. The compass distinguishes true north from project north. **Map** turns the layer on/off.
- **Section** opens a movable cutting panel: choose X/Y/Z, drag the cut, type an exact position or flip sides. The cut has real filled section faces, including cavities. It is a viewing tool; the underlying model and exports remain whole.
- **Sun** opens a solar study after choosing a site. Set date, time and the site's UTC offset, including daylight saving. Play animates the day's sun. The sun path, azimuth, altitude and directional shadows use SunCalc and site true north.
- **Camera** adjusts field of view. **Walk inside** puts the camera at an eye height and floor elevation. Click the canvas, use W/A/S/D or arrows to move, drag to look, and hold Shift to move faster. **Orbit** returns to the previous orbit position. **Lens focus** adds optional photographic depth blur in perspective view.
- **Groups** organizes a selection into named layers with hide/show and lock/unlock. Hidden objects remain saved; locked objects reject geometry edits. Groups organize independent objects rather than fusing them.
- On smaller screens, **Design tools** contains Section, Present, Groups, Sun and Camera. Location and Map stay directly accessible.
- **Present** removes editing panels and handles; the optional slow orbit presents the model. Escape returns to editing. Creation motion describes footprint-to-volume growth and respects reduced-motion preferences.

## Model directly or conversationally

**Push / pull (P)** reveals face handles on the selected object. Drag a handle: the opposite side stays fixed, the current size and movement are shown, and release creates one undoable edit. Escape cancels. A flat profile's top handle extrudes it. Exact numeric dimensions remain in the inspector. Curved and cut solids resize as a whole along the chosen axis; this is not unrestricted face/vertex editing.

Drag a selection rectangle in **Select** mode, or hold **Shift** while dragging in another modeling mode. Left-to-right selects fully enclosed projected object bounds; right-to-left selects intersecting bounds. Shift adds to the selection. These are screen-space envelope tests, not exact per-triangle visibility tests.

In the inspector, **Add volume to this** creates an independently sized volume above, below or beside the selected envelope. A lower floor can have a different footprint and an explicit offset. If there is not enough space below, ATELIER asks for permission to lift the existing volume; it does not silently move it. Related solids retain independent IDs and can subsequently be combined with real Booleans.

**Floors & glass** converts supported envelopes into floor/roof slabs and facade geometry. Toggle floors, glass and the original volumetric envelope without deleting the underlying architectural parameters. **Keep window width fixed** preserves the clear glazing module when narrowing a building: the window count changes and solid end infill absorbs the remainder. It is not a general dimensional-constraint solver.

**Trees around this** adds stylized, solid volumetric trees around the selected footprint. The conversational `trees` operation uses the same engine. Defaults are 4.5 m tall, 3 m crowns and 2 m clear from the building envelope, with a predictable count chosen from perimeter length. Automatic planting skips positions blocked by other object envelopes; an explicit count that cannot fit asks for an adjustment. Each tree can be named, moved, scaled, recolored, grouped or deleted. The entire placement is one undo step. Trees sit on the project ground; no terrain or botanical simulation is involved.

## Expanded modeling capabilities

The model can propose these structured operations through flexible language. The application validates them against real geometry; the list is not a command syntax the user must memorize.

| Capability                        | Actual implementation and boundary                                                                                                                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sweep / follow a path             | Closed polygon profile swept along an open polyline or smooth Catmull–Rom path, using transported frames. Bounded path/profile complexity; invalid crossing surfaces are rejected.                                                       |
| Loft                              | Solid between rising horizontal polygon sections with consistent topology and winding. Ruled/tessellated surfaces, not arbitrary NURBS sections.                                                                                         |
| Pitch / roll / rotate             | Euler X/Y/Z orientation of a solid, retaining source geometry and identity. Below-ground results are rejected. Ordinary yaw and group yaw remain available.                                                                              |
| Hollow                            | Real inner-volume subtraction for upright boxes, cylinders and supported extruded profiles; editable wall/floor thickness and open/closed top. Arbitrary imported/freeform shelling is rejected.                                         |
| Add related geometry              | Independently sized above/below/side additions in the source's local frame, optional reviewed lifting, and retained source objects.                                                                                                      |
| Scale / stretch / mirror / arrays | Existing validated uniform scale, anchored stretch, reflection, copies, grid and circular arrays remain; no associative array feature tree.                                                                                              |
| Review and repair                 | A proposed plan runs on an isolated session. A geometry failure is returned to the model for at most **one** correction. Another failure leaves the project unchanged. Provider/billing failures do not trigger this correction request. |
| Workspace instructions            | Shared text/voice actions control maps, imagery, projection, themes, section, presentation, camera/walkthrough, solar controls and panels as well as modeling.                                                                           |

Generated forms preserve their definition and normalized mesh in the project. Existing sources and Boolean operands are retained where supported. Architectural glass materials are not separately retained in the rendered appearance after arbitrary-axis orientation; the oriented solid remains geometric. This is tessellated Manifold modeling, not a certified CAD/BIM or exact BREP engine. There is no claim of arbitrary modeling mastery.

## Reference photos

Use the photo button beside the conversation input. Attach up to two PNG, JPEG or WebP images (10 MB each before processing). The browser downsamples to at most 1280 pixels and a bounded JPEG payload. References are sent to the actual multimodal Responses API with the user's message. The latest attached reference is also available on a follow-up. The assistant is instructed to ask about scale and design intent rather than invent exact dimensions from an image.

This is image-guided interpretation, not photogrammetry or guaranteed 3D reconstruction. The automated tests verify image processing, model-request payloads and follow-up persistence with explicit provider fixtures. Live image interpretation awaits funded API testing. PDF reference planes and image-to-world calibration are not implemented. Conversation images use browser project storage; the geometry JSON backup does not include the conversation/image library.

## Export

The arrow beside **Export project** opens **Export OBJ**. It exports actual triangles of visible objects, in their world positions and rotations, using the current floor/glass/volume representation. Import the resulting file at **1 unit = 1 meter**, Y up. Object names are retained in OBJ-safe form. Section cuts are view-only and are not baked into the export. Flat profiles must be extruded before they can export as solids. OBJ export is geometry-only: no MTL, textures, BIM metadata, native RVT or SKP.

**ATELIER backup / Export project** still writes JSON with geometry, recipes and modeling undo history. Keep that file to continue parametric work in ATELIER. OBJ is an interchange mesh, not a replacement for the project backup.

## Verification limits

- SunCalc's position is checked against equinox solar geometry and explicit UTC offsets. This is a concept sun/shadow study, not annual radiation, weather, terrain, daylight-factor or energy analysis.
- Walkthrough is a visual camera at human scale, without collision detection or automatic stairs/floor tracking. Depth blur is optional and can reduce performance.
- Street and Esri World Imagery satellite tiles are flat map references. They are not Google 3D buildings or terrain. Attribution remains visible. External imagery hosts are blocked in this cloud test environment; automated tests use explicit tile fixtures and verify loading failures rather than substituting imaginary data.
- Photo/text/voice routes use real provider integrations. Automated fixtures verify the application's contracts and geometry, not the live model's interpretation, speech recognition or latency.
- Broad desktop and narrow-screen Chromium checks run using software WebGL. Safari, physical touch devices and very large models require separate device testing.

See [validation evidence](VALIDATION.md), [Phase 2 audit](PHASE2-AUDIT.md) and [import formats](IMPORTS.md). Terrain development remains intentionally deferred.
