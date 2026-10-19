# Easier modeling and phone viewing

## Select, move, and organize

- Shift/Ctrl/Command-click objects, drag a selection box with the Select tool, or use **Objects → Select several** and tap objects. Tap an already-selected object again to remove it from the selection.
- The move arrows now move the entire editable selection together. The rotation ring rotates the selection around the active object's base, preserving spacing. One Undo reverses the whole gesture. Escape cancels a gesture.
- **Groups** (or **Create → Group this selection**) assigns objects to a named group/layer. **Select** on a group selects its members for moving together. Hidden and locked members are protected. Groups organize objects without fusing solids.
- Numerical inspector edits and face push/pull still edit the active object. **Create → Scale selection** and **Stretch a side precisely** operate on the selected editable objects.

## Find the tools

The **Draw** button on the left starts direct rectangle, circle, or outline drawing in the viewport. Finish a face, then use **Push / pull** to extrude it. The **Create (+)** button retains dimension-based profiles and transform tools. Choose a rectangle, circle, or regular polygon, enter its dimensions, and create it. The selected profile immediately offers **Extrude selected shape** with an editable height. **Push / pull** exposes face handles for direct stretching and extrusion. The existing inspector retains exact dimensions and geometry parameters.

Tool panels now share one dock: opening Sun, Camera, Groups, Studio, Section, Inspector, or Create replaces the previous tool panel. The Objects list stays on the left on desktop; on a phone it shares space with tools. Panel headers and close controls stay visible while scrolling. Desktop panels remain draggable. On phones, tools use a single bottom sheet with 44 px touch controls; the conversation yields space until you close the sheet. This avoids stacking controls over each other while leaving the model visible above. Escape closes the current panel without clearing the selection.

Sections now use near-black cut faces. The actual solid intersection generates the cap, including cavities; it is a reversible view and does not cut the saved project.

**Section on** and **Show section plane** are independent switches. With the Section panel open, drag the amber plane edge/handle to move it, or enter an exact position. Hide the plane while leaving the cut active for a clean view. Turn the cut off to see the complete model; the plane can stay visible for positioning. Closing/reopening the panel retains its position, direction, and switches. Escape cancels a plane drag. Close the panel to resume object manipulation while the reference plane remains visible. Text/voice workspace actions also support showing/hiding the plane independently through the same planner; those contracts are tested with model fixtures, not a live paid voice session.

## Align the site

1. Open **Location**, choose a place on the map or enter coordinates, then select **Show model on map**.
2. Choose **Drag map under model**. The camera switches to top view. Drag in the main workspace to move the map beneath the stationary model. Finish with **Finish moving map**.
3. For precise adjustments, use the four arrows with a 0.1 m, 1 m, or 10 m step.
4. Adjust **Map rotation** or the rotation slider. Model axes and orthographic views remain fixed; the true-north indicator and solar study use the map bearing.

Each completed drag/nudge is undoable. Escape cancels a map drag. Coordinates update to the new model origin. Street and satellite remain flat map references, not terrain or survey data. Map imagery depends on the provider/network.

## Phone camera / AR

Open **Camera → View in your space · AR** (under **Design tools** on a narrow screen). Choose 1:1 for life size, or a smaller scale such as 1:100 for a tabletop model, then **Prepare AR model**.

- **Safari on compatible iPhone/iPad:** **Open camera AR** opens Apple AR Quick Look using a real, locally generated USDZ file. Move the phone slowly to find a surface, then place the model. **Keep the chosen scale** is on by default so 1:1 remains life size. Turn it off before entering to permit native pinch resizing. Native placement/rotation controls remain available. **Apple’s viewer cannot host ATELIER’s conversation UI.** Voice pauses on entry. Close the viewer to converse, prepare the updated snapshot, and reopen AR. We do not claim continuous in-AR AI on iPhone Quick Look.
- **WebXR-capable browser/device with DOM overlay support:** **Open camera AR** requests actual surface hit testing and on-screen controls. Find the ring and tap to place. Walk around or physically into a life-size model where your real space permits. **Size & placement** offers ratios, fine scale and rotation. **Place again** resets placement. The same text, voice and review interface stays at the bottom; changes from the shared engine rebuild the real meshes while preserving the tracked anchor, viewing scale and initial project origin. Tracked camera orientation is converted back into project axes for “left/right” instructions. This is a real integration with hardware tracking fixtures in cloud tests, not a verified real-device voice session.
- **Unsupported browsers:** ATELIER explains the limitation and offers a USDZ download. WebXR without DOM overlay support fails rather than leaving essential controls unavailable. It does not substitute an untracked camera overlay or claim that it is AR.

After preparation, ATELIER reports the project's width and its **width in your space**. Enter a measured tabletop/room width and choose **Use this width**, then prepare again. This changes only presentation scale, bounded between 1:1000 and 1:1. In WebXR, **Fit width between two points** measures two tracked points on the same horizontal surface and fits the model’s current width between them, including rotation. Use a physical tape measurement to cross-check tracking. Points closer than 10 cm, different levels over 15 cm, nonfinite values and out-of-range scales are rejected. This is visual fitting, not survey calibration.

The snapshot contains visible 3D geometry with the current floor/glass representation. It preserves meter units, dimensions, relative positions, and elevations, centering the model horizontally for initial placement. Profiles need extrusion first. It does not include map imagery. Changing AR scale or placement never edits the project; an AI modeling request does, with normal validation/review/history. Hidden objects stay excluded. No model upload or additional AR API key is needed. Camera frames are not sent to OpenAI. Normal AI text/audio still uses the configured provider and billing. Camera access is requested only by starting AR; exit/close releases the session. The normal viewport pauses rendering during WebXR to avoid competing graphics work. If rebuilding an empty/invalid model fails, AR visibly reports that it retains the previous model.

**Verification limit:** genuine USDZ generation, UI/support detection, failure/cancellation handling, geometry updates, camera-axis conversion, measured-fit calculations and project preservation are tested in the cloud with explicit XR/provider fixtures. Camera tracking, native Quick Look rendering, microphone coexistence, walking into/around a life-size model, actual surface placement, and real-device accuracy require a compatible phone. AR placement is not surveyed georeferencing. There is no claim that ATELIER understands camera images or that native iPhone AR supports its chat overlay.

## Research references

Implementation follows the platform approaches used by:

- [Three.js WebXR surface-hit-test example](https://github.com/mrdoob/three.js/blob/dev/examples/webxr_ar_hittest.html): immersive AR sessions, surface hit testing, and placement reticles.
- [Google model-viewer's AR implementation](https://github.com/google/model-viewer/blob/master/packages/model-viewer/src/features/ar.ts): capability-dependent WebXR/Quick Look paths and local USDZ links using `rel="ar"`.
- [Three.js USDZExporter](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/exporters/USDZExporter.js): meter-based USDZ output and Quick Look compatibility. The implementation uses the repository's installed Three.js version.

## Pull up a 3D moodboard

Use **Moodboard** in the top bar (the image icon on smaller displays), or ask the connected assistant to “pull up my moodboard.” It opens a separate, orbitable 3D reference space. **Back to model** returns to the architectural workspace.

- **Add image** accepts PNG, JPEG or WebP, resized locally for storage. Images become movable cards in 3D.
- **Add reference** places a note with an optional HTTP(S) link. The link opens only when you choose it; ATELIER does not fetch or embed the linked site.
- **Model snapshot** adds the current visible 3D model or a saved project's model. These are actual colored meshes you can orbit around, not screenshots. The copy preserves the model's proportions, while normalizing its display size on the board. It does not modify or merge into the source project. Flat profiles need extrusion first.
- Drag a reference directly, or use its translation arrows. Change **Depth**, **Turn**, and **Size** to arrange a spatial collage. **Frame moodboard** brings the board back into view. The list selects references that are behind other items. The board has its own Undo/Redo for the last ten edits while open.
- Every project saves its own board in this browser's IndexedDB. Wait for **Saved with this project** before closing the browser. Project switching waits for pending saves. **Export project** includes the board alongside geometry/history; importing that backup restores it. Geometry Undo does not undo an imported moodboard. Boards are limited to 40 references and 4 MB to keep browser storage/rendering bounded.

Board images and notes stay in browser storage and exported backups; they are not automatically sent to OpenAI. To ask the assistant to interpret an image, attach it to the conversation using the existing image attachment control. Moodboards are not cloud-synced or shared between devices. This release does not insert a standalone OBJ directly into the board; import it into a project using the existing importer, then add that project's model snapshot.

## Feel the modeling process

New solids trace their footprint, then rise over approximately 3.6 seconds with a moving upper outline before settling. Changes to an existing solid draw its actual replacement edges and reveal its surfaces over 1.8 seconds, including dimension and geometry edits. The small formation indicator describes this visual reveal; the saved geometry and measurements are already exact. Clicking/dragging the model finishes the reveal immediately so animation never delays direct editing. Undo, redo, reload and project imports do not replay construction.

AI requests show an animated process indicator only while the real request/check is running, with stage messages from the actual request and validation path. It does not invent a completion percentage or imply that an unconfigured model is working. Moodboard references enter with a gentle fade/lift, and panels use quieter easing. Moodboards frame newly added items automatically, including on phones. Reduced-motion preferences disable construction, reference entrances and decorative motion.

## Direct drawing and spatial feedback — October 19

**Draw** in the left toolbar opens rectangle, circle and closed-outline drawing. Click a first point, move to preview, then click again; for outlines, click each corner and close at the first point or press Enter. A face is selected for **Push / pull** immediately after creation. Drag its luminous height handle to make a solid. Camera view → Perspective makes the height easier to see when you have been drawing in Top view.

- **R** rectangle, **C** circle, **L** closed outline, **P** push/pull, **M** (or G) move, **Q** rotate, **Space** (or V) select. R now follows the rectangle convention; rotate moved to Q.
- Drawing uses the horizontal project plane, at ground level by default. Expand **Measurements & drawing plane** for elevation and exact width/depth, radius, or next-edge length. Pick the start point before entering measurements; an exact rectangle follows the quadrant of your pointer preview.
- Existing snap controls apply a 0.5 m grid. Shift makes rectangles square, or constrains an outline segment/circle radius to the dominant project axis. Nearby endpoints of supported profiles/boxes snap within 10 screen pixels. Circle centers and bounding corners of arbitrary imported meshes are not misrepresented as real endpoints.
- Middle-drag orbits, right-drag pans, scroll zooms while drawing. Backspace or Ctrl/Cmd+Z removes a draft corner; Escape clears the unfinished draft, then exits drawing on a second press. Completed faces use the same project history, selection, extrusion and validated modeling engine as conversation.
- A closed outline is a single planar face with up to 64 corners, including concave shapes. Crossings, collapsed faces and out-of-range dimensions are rejected before project mutation. This does not add SketchUp-style arbitrary face subdivision, wall-face drawing, or imported-mesh face editing.
- The actual AI planner can activate drawing or manipulation through structured workspace actions. Those actions open tools; requests to create geometry still use geometry operations. Automated tests use clearly identified provider fixtures, not claims of paid live language or microphone verification.

The world-space grid now has adaptive spacing, antialiased lines and a soft distance fade, with coverage beyond the camera clipping range. It remains aligned with project coordinates as the camera moves. Map visibility still suppresses the ground/grid.

New geometry receives a closer camera frame of its own, without widening to include unrelated objects. Creation framing never increases the current camera distance; a very large new form may therefore require **Frame all (F)** to see its complete extent. Existing edit operations do not auto-reframe. Surrounding objects briefly soften during new-object formation, then regain their exact original opacity/depth settings; this is a presentation effect, not a geometry operation. Construction retains footprint tracing and visible extrusion, adds a measurement label anchored to the forming object, and uses restrained pearl/sage highlights. All construction effects remain visual only and respect reduced motion.

## Larger sites, visible modeling actions and viewpoint placement

- **Map → Location → Map area**: original coverage, 500 m, 1 km, 2 km or 5 km square. The boundary is centered on the project origin; imagery is cropped, not stretched. Larger coverage chooses a lower imagery zoom and loads no more than 25 displayed tiles. **See entire map** frames the coverage in top view; large maps extend the camera viewing range and keep imagery visible beyond the studio fog. Object dimensions and map bearing are unchanged. Coverage is saved with the project and participates in undo/redo. This remains a flat reference map with a local Web Mercator metric approximation, not a survey-grade geographic transform.
- Select an object: **Push / pull, Scale, Stretch, Copy, Mirror, Array** are visible beside its name. The modeling panel shows one requested parameter form at a time. Draw remains available for directly sketching profiles; a selected profile also exposes exact extrusion height. Copy offsets along project X; mirror creates a reflected copy about the stated project X/Z plane; array counts include the original, with center-to-center spacing in project axes.
- Push/pull adds an oriented corner frame, a face-handle ring and an anchored live dimension label. These indicate the modeling envelope for curved/cut forms; they are not arbitrary mesh-face editing. Escape cancels the preview without changing geometry/history.
- **Camera → Place me in the model**: a top overview lets you click a visible horizontal surface or ground point, then click a direction to look. A human-scale marker and direction line preview the placement. Eye height is added above the picked floor. Escape/Cancel exits without a geometry edit. Switching to another panel also ends placement. Existing WASD/arrow-key navigation, eye height, floor elevation and AR remain available. Walkthrough still has no collision detection or pathfinding.
- Natural requests such as **“Place me between Admin and Volume 2”** can produce a validated `walk_to` operation through the same model/voice route. It resolves two named objects or IDs, places the viewpoint midway between their centers at the lower base elevation, and changes no objects, selection or modeling history. Exact coordinates, object center and project-front viewpoints are also supported. Ambiguous/missing/hidden targets are rejected before any geometry transaction is installed. Live natural-language or microphone interpretation is not established by a structured-response fixture.
- Construction now advances on a bounded visible-frame clock, so a slow frame or background tab does not skip the entire creation sequence. Reduced motion and immediate interaction-to-finish remain supported. On slow hardware the presentation can take longer; saved geometry is final throughout.

Accurate stepped topography is researched separately in [TOPOGRAPHY-RESEARCH.md](TOPOGRAPHY-RESEARCH.md). No terrain source or survey accuracy is simulated.
