# A quieter, more expressive studio

The 3D model remains the focus. The floating conversation stays available, while **Studio** contains appearance and location options. Object lists and precision editing remain optional. Existing projects, imports, Boolean recipes and undo history are preserved.

Actual Chromium captures: [Day](atelier-day.png) · [Night and selection glow](atelier-night.png) · [Curved wireframe](atelier-curved-wireframe.png). These are rendered application views, not interface mockups.

## Separate projects

Click the folder/project name beside **ATELIER** to open **Your projects**. Rename the current project, create a named blank space, or click a saved project to return to it. Each project keeps its own geometry, conversation, selected objects, site location and undo/redo history. Existing workspace data becomes the first project automatically.

[Projects menu capture](atelier-projects.png)

Switching completes the current save before opening the next project. A failed save keeps the current workspace open. Finish an AI request, pending review, voice session or import before switching. Maps start hidden in each newly opened workspace; the location remains saved. Appearance preferences are shared across your projects.

Projects are stored in this browser's IndexedDB, with a synchronous checkpoint for the active workspace. They are **not synchronized between devices or browsers**. Export each important model as JSON for a separate geometry/history backup; conversation text remains in the browser. Clearing website data removes the local project library. Import opens into the current project, so create a blank project first if you want to keep an imported design separate.

## Day, night and direct manipulation

- **Studio → Appearance → Day / Night** switches the whole workspace and scene lighting. Day uses white surfaces and dark text; Night uses graphite. This preference saves in your browser independently of project geometry and object colors.
- Selecting a volume by clicking, the Objects list, or an AI `select` operation gives it a soft cyan silhouette and activates move arrows. Click **Rotate** (or press **R**) for the rotation ring; **G** returns to Move. Explicit tool choices stay active until the next selection.
- Drag an arrow to see the traveled distance and X/Y/Z displacement in meters, plus a line from the starting point. Drag the rotation ring to see the current angle, angle change and swept arc. Each completed drag remains a single undoable edit.
- The snap control offers **15°, 45° or 90°** rotation increments; translation snaps every **0.5 m**. Toggle Snap off for free movement. Exact conversational dimensions are not rounded to mouse snap increments.
- Open the inspector with the selected object's dimension chip or the header icon. Edit **Name**, then press Enter or click elsewhere. Escape cancels the name edit; an empty name restores the previous name. Names persist in project exports/history and remain available to the conversational engine.
- **X closes the Inspector without clearing selection**, even when nothing is selected. Clear selection is a separate action. Drag the Inspector or Studio heading to move it; you can also focus the heading and use arrow keys. Panels stay within the window after resizing. Desktop panels initially open beside each other; on narrow screens opening one closes the other.
- Sphere wireframes show sparse meridians/parallels; cylinders and circular extrusions show vertical generators as well as their rims. These lines describe the curved shape without exposing every tessellation triangle. They do not change the solid or its volume.
- The header **Map** button toggles the remembered map on/off (or opens Location on first use). Showing the map hides the competing ground/grid surface, preventing depth fighting; hiding the map restores them. The nine map tiles remain flat, below the geometry, with normal depth testing and shadow reception.

## Camera and conversational workspace controls

Choose **Perspective**, **Orthographic**, or **Top view** in the viewport's camera menu. Orthographic uses a real parallel-projection camera; Top view is orthographic from above. Switching views preserves geometry and selection.

The AI now has validated workspace operations as well as geometry operations. You can ask for map on/off/toggle, camera views, Day/Night, Solid/Wireframe/Hidden line, frame all, or opening/closing Inspector and Objects. These requests use the same planner for text and real-time voice. When no site exists, asking to show the map opens location selection instead of inventing coordinates. Workspace changes preserve modeling history and conversational object references; a failed geometric request does not partially apply accompanying workspace actions.

Automated tests use explicit model responses for these controls. This verifies the execution path, not recognition of every spoken phrasing or live voice latency. API billing and microphone permission still apply to conversational requests; all manual controls work without API credits.

## Try it

- Select an object and click the small color circle beside its name, or use the color swatches in the inspector. Colors save with the project, copy with objects and support undo.
- Open **Studio → Appearance** for Solid, Wireframe or Hidden line. Wireframe shows geometric edges through surfaces; Hidden line uses opaque depth-writing surfaces to hide rear edges. Choose line and surface colors there; selected edges retain a subtle cyan highlight. View preferences do not alter geometry or consume undo steps.
- Choose **Add a person**, or ask the assistant for a person for scale. The default is a stylized 3D figure exactly 1.75 m tall, placed beside the model, clear of the scene envelope. It is editable entourage, not an imported human scan.
- Newly created solids trace their footprint and rise over **3 seconds**. Reduced-motion preferences skip the choreography; pointer interaction settles the geometry immediately. The saved model always contains its final exact dimensions.
- Shadows now cover at least a 160 m span and expand/recenter after model edits, including moves well beyond the original scene. A finite shadow map can lose fine detail in very large, widely scattered scenes.

## Put the model on a map

1. Click **Map** in the header (or **Studio → Location**).
2. Select **Choose on a map**. Drag or click the map and use +/− to zoom until the center pin marks your site. **Use my location** is optional and asks the browser for location permission.
3. Alternatively, type latitude and longitude. Both options update the same coordinate fields; you can refine either one.
4. Set orientation if needed, then select **Show model on map**. Browsing alone does not change the saved project.
5. Use the header **Map** button to hide/show the remembered location without reentering it.

The picker loads only when opened, uses Leaflet and OSM tiles, and preserves OSM attribution. It supports keyboard pan/zoom as well as pointer input. If imagery or device location is unavailable, the coordinate option remains usable. There is no geocoding/address-search service or additional map API key.

The chosen point anchors the **workspace origin**, not the selected object's center. Project north starts at geographic north; orientation is clockwise from north. The 3D objects stay in meters and retain their local positions. Location saves in project export/history. Maps load only after an explicit action and remain off after reloading the app.

The current version offers **OpenStreetMap streets or Esri satellite imagery as a flat ground map beneath actual 3D geometry**. It is not Google 3D imagery, terrain, geodetic surveying or surrounding 3D buildings. A Google Maps link opens the location separately; it does not upload or display the model in Google Maps. No map API key is required for this bounded OSM view. The browser requests nine displayed tiles at zoom 17, using normal HTTP caching and visible attribution. Tile requests reveal the approximate site to OSM. There is no prefetch, bulk export or offline tile download. For a heavily used public deployment, configure a suitable hosted tile provider before exceeding community tile service capacity.

Live OSM imagery could not be verified from this cloud environment's restricted network. Browser tests use explicitly labeled image fixtures to verify geographic placement, loading, attribution, errors and preservation of project data. Loading failure is visible; it never substitutes invented imagery.

References reviewed: [OSM tile service policy](https://github.com/openstreetmap/owg-website/blob/master/policies/tiles.md). The official [Google WebGL overlay sample](https://github.com/googlemaps/js-samples/blob/main/samples/webgl-overlay-simple/index.ts) was also reviewed: it uses a Maps map ID and a separate WebGL overlay lifecycle. Google photorealistic/3D map integration is a separate provider integration with its own configuration, billing and terms.

## Conversational modeling vocabulary

These operations are available to the existing structured-output AI planner and shared text/voice engine. They are not a keyword parser. The automated tests exercise validated model-output fixtures; they do not establish arbitrary language understanding or a live voice latency guarantee.

| Intent                          | Supported behavior                                                                       | Important boundary                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Copy / duplicate                | New objects, preserved appearance and geometry; camera-relative or cardinal displacement | Copy count means **new** copies                                                                |
| Linear array                    | Repeated group copies at center-to-center spacing                                        | Existing duplicate operation                                                                   |
| Rectangular array               | Rows along project +Z, columns along +X                                                  | Counts include the original; up to 100 instances and 200 scene objects                         |
| Polar / radial array            | Equal yaw spacing about a specified center, optional copy rotation                       | Full circle avoids duplicate endpoint; partial arc includes both ends; up to 20 instances      |
| Scale                           | Uniform size and group-layout scaling about a chosen pivot or shared base center         | Positive factor; scene dimensional limits still apply                                          |
| Resize                          | Change an individual width, depth or height precisely or proportionally                  | Local object axes                                                                              |
| Stretch                         | Move one rectangular end face while holding its opposite face fixed                      | Boxes, rectangles, rectangular extrusions only; no crossing-window or arbitrary vertex stretch |
| Mirror                          | Reflect true asymmetric solid geometry across project X or Z planes                      | Closed 3D solids only; copy or replace; source recipe preserved; no arbitrary mirror plane     |
| Move / rotate                   | Camera-relative or cardinal translation; individual or shared-pivot yaw                  | No arbitrary pitch/roll                                                                        |
| Align / offset                  | Envelope edges/centers; rectangular inset/outset base                                    | No general curve-offset solver                                                                 |
| Union / subtract / intersect    | Manifold solids with preserved source operands                                           | Actual nonempty solid result required; destructive changes reviewed                            |
| Extrude / floors / curtain wall | Profiles to solids, floor slabs, panel-and-frame facades                                 | Existing architectural constraints remain                                                      |
| Color / person                  | Natural color requests and measurable scale entourage                                    | No material-texture library or animated people                                                 |

The planner is instructed to clarify missing mirror planes, array centers, copy intent and ambiguous targets. It explicitly identifies unsupported fillet, chamfer, path arrays, arbitrary vertex editing and unrestricted Autodesk command compatibility. See the [modeling intent review](MODELING-INTENT-REVIEW.md) for the official Autodesk developer sources actually inspected, the resulting model instructions, and the remaining compatibility and live-language testing limits.

## AI and voice configuration

The existing Render backend and API credentials are reused. No new OpenAI key or service is required. Colors, view modes, scale-person button, direct edits and maps work without AI credits. Conversational requests still need a funded API account; live AI/voice verification remains outstanding. No paid model calls were made for this iteration.

## Expressive studio extension

See [the latest guide](EXPRESSIVE-STUDIO.md) for bounded sweeps/lofts, section cuts, satellite/map rotation, sun studies, walkthroughs, groups, photo references, trees and OBJ export.
