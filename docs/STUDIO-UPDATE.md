# A quieter, more expressive studio

The 3D model remains the focus. The floating conversation stays available, while **Studio** contains appearance and location options. Object lists and precision editing remain optional. Existing projects, imports, Boolean recipes and undo history are preserved.

## Try it

- Select an object and click the small color circle beside its name, or use the color swatches in the inspector. Colors save with the project, copy with objects and support undo.
- Open **Studio → Appearance** for Solid, Wireframe or Hidden line. Wireframe shows geometric edges through surfaces; Hidden line uses opaque depth-writing surfaces to hide rear edges. Choose line and surface colors there; selected edges retain a subtle cyan highlight. View preferences do not alter geometry or consume undo steps.
- Choose **Add a person**, or ask the assistant for a person for scale. The default is a stylized 3D figure exactly 1.75 m tall, placed beside the model, clear of the scene envelope. It is editable entourage, not an imported human scan.
- Newly created solids trace their footprint and rise over **3 seconds**. Reduced-motion preferences skip the choreography; pointer interaction settles the geometry immediately. The saved model always contains its final exact dimensions.
- Shadows now cover at least a 160 m span and expand/recenter after model edits, including moves well beyond the original scene. A finite shadow map can lose fine detail in very large, widely scattered scenes.

## Put the model on a map

1. Find the location in Google Maps. Right-click the place and copy its latitude and longitude.
2. Open **Studio → Location** and enter those two numbers.
3. Set orientation if needed, then select **Show model on map**.

The chosen point anchors the **workspace origin**, not the selected object's center. Project north starts at geographic north; orientation is clockwise from north. The 3D objects stay in meters and retain their local positions. Location saves in project export/history. Maps load only after an explicit action and remain off after reloading the app.

This is an **OpenStreetMap flat ground map beneath actual 3D geometry**, not Google imagery, terrain, satellite imagery, geodetic surveying or surrounding 3D buildings. A Google Maps link opens the location separately; it does not upload or display the model in Google Maps. No map API key is required for this bounded OSM view. The browser requests nine displayed tiles at zoom 17, using normal HTTP caching and visible attribution. Tile requests reveal the approximate site to OSM. There is no prefetch, bulk export or offline tile download. For a heavily used public deployment, configure a suitable hosted tile provider before exceeding community tile service capacity.

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

The planner is instructed to clarify missing mirror planes, array centers, copy intent and ambiguous targets. It explicitly identifies unsupported fillet, chamfer, sweep, loft, path arrays, arbitrary vertex editing and unrestricted Autodesk command compatibility. Autodesk's live help site was inaccessible under the environment network policy, so this is an implementation capability table—not a claim of exhaustive Autodesk documentation review.

## AI and voice configuration

The existing Render backend and API credentials are reused. No new OpenAI key or service is required. Colors, view modes, scale-person button, direct edits and maps work without AI credits. Conversational requests still need a funded API account; live AI/voice verification remains outstanding. No paid model calls were made for this iteration.
