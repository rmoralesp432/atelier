# Easier modeling and phone viewing

## Select, move, and organize

- Shift/Ctrl/Command-click objects, drag a selection box with the Select tool, or use **Objects → Select several** and tap objects. Tap an already-selected object again to remove it from the selection.
- The move arrows now move the entire editable selection together. The rotation ring rotates the selection around the active object's base, preserving spacing. One Undo reverses the whole gesture. Escape cancels a gesture.
- **Groups** (or **Create → Group this selection**) assigns objects to a named group/layer. **Select** on a group selects its members for moving together. Hidden and locked members are protected. Groups organize objects without fusing solids.
- Numerical inspector edits and face push/pull still edit the active object. **Create → Scale selection** and **Stretch a side precisely** operate on the selected editable objects.

## Find the tools

The **Draw** button on the left starts direct rectangle, circle, or outline drawing in the viewport. Finish a face, then use **Push / pull** to extrude it. The **Create (+)** button retains dimension-based profiles and transform tools. Choose a rectangle, circle, or regular polygon, enter its dimensions, and create it. The selected profile immediately offers **Extrude selected shape** with an editable height. **Push / pull** exposes face handles for direct stretching and extrusion. The existing inspector retains exact dimensions and geometry parameters.

Tool panels now share one dock: opening Sun, Camera, Groups, Studio, Section, Inspector, or Create replaces the previous tool panel. The Objects list stays on the left on desktop; on a phone it shares space with tools. Panel headers and close controls stay visible while scrolling. Panels remain draggable. Escape closes the current panel without clearing the selection.

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

- **Safari on compatible iPhone/iPad:** **Open camera AR** opens Apple AR Quick Look using a real, locally generated USDZ file. Find a surface and place the model; native pinch controls adjust its size.
- **WebXR-capable Android browser/device:** **Open camera AR** requests an immersive AR session with real surface hit testing. Move the phone to find the placement ring, then tap to place. Use scale, fine scale, rotation, reposition, and exit controls when DOM overlays are supported. The browser/system also provides a session-exit control. If overlays are unavailable, set scale before entry and use system exit controls.
- **Unsupported browsers:** ATELIER explains the limitation and offers a USDZ download. It does not substitute an untracked camera overlay or claim that it is AR.

The snapshot contains visible 3D geometry with the current floor/glass representation. It preserves meter units, dimensions, relative positions, and elevations, centering the model horizontally for placement. Profiles need extrusion first. It does not include map imagery. Changing AR scale or placement never edits the project. No model upload or additional API key is needed. Camera access is requested only by starting AR; exit/close releases the session. The normal viewport pauses rendering during WebXR to avoid competing graphics work.

**Verification limit:** USDZ generation, UI/support detection, failure/cancellation handling, and project preservation are covered by cloud tests. Camera tracking, native Quick Look rendering, actual surface placement, and real-device accuracy cannot be verified without a compatible phone. AR placement is a visual design aid, not surveyed georeferencing.

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
