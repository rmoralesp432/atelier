# Phone AR: large models and choosing a floor

Open **Tools → Camera → View in your space · AR**.

## Walk on an upper floor

1. Turn on **Use a floor cut for AR**.
2. Enter the **project elevation** of the floor you want to stand on, for example **4 m**. Use a positive elevation for an upper floor, not a negative offset. Alternatively, select a floor slab in the workspace and choose **Use selected floor’s top**. Select the slab itself, not the entire building or a roof.
3. Choose **Inspect floor cut**. The compact slider adjusts a live section in the normal workspace. **Show whole model** temporarily compares with the complete model. **Back to AR setup** returns to preparation.
4. Choose **Prepare life-size AR → Open real AR**. The AR copy contains only surfaces at or above the chosen level, rebased so that level is zero. Apple therefore receives an actual cut model, rather than an offset of a building whose lower floors are still present.
5. To change floors again, close Apple's viewer, choose another level and prepare again. Turning the floor cut off restores the complete AR copy.

For Farnsworth House, select the raised floor slab and use its top as the AR base. Supports, platforms and terrain below that level disappear only from the AR copy. The original project, elevations, hidden-object settings, grouping, dimensions and undo history remain intact. The normal section view is restored when the AR panel closes.

Previewing the cut requires no export. Opening native iPhone AR still requires an internally generated USDZ; ATELIER prepares and opens it automatically. There is no manual download/reimport step, but the website cannot alter a running Apple Quick Look session. The separate **camera preview** remains explicitly untracked.

This is a viewing section of actual triangles, including open OBJ/FBX reference surfaces. Cut walls have open ends; this is not a capped watertight solid/BIM export. If the chosen level passes through empty space, the interface warns that Apple may place the lowest remaining surface on the ground. Choose a real floor/surface level. Native ground detection and real-world alignment still need an iPhone check.

## Large imports

The source import limit remains **512 MB / 5 million output triangles**; it has not been reduced. Full-detail OBJ files are read in 1 MiB slices into indexed geometry, avoiding a whole-file string and expanded normals/UV buffers. The full-detail project is retained. Phone AR prepares a **separate copy of at most 100,000 triangles**, showing the actual resulting count. Fine geometry can be simplified. Source dimensions and the selected viewing ratio are retained; a floor cut deliberately removes the geometry below that level.

- Imported mesh coordinates are read in chunks of at most 100,000 source triangles, without first allocating another full-size mesh. Only newly allocated typed buffers are transferred; original project arrays are never detached.
- Simplification and USDZ serialization run in a cancellable worker. The first pass protects borders and extrema. If disconnected imported surfaces prevent enough reduction, an adaptive meshoptimizer pass reduces the disposable AR copy while retaining its envelope. Fine details and small disconnected features inside an imported object can disappear. The final output limit is mandatory; there is no random-face sampling or replacement of the saved source model.
- Existing scene GPU geometry is released during preparation and restored on subsequent drawing from unchanged CPU geometry. The original viewport pauses while preparation runs.
- **Cancel preparation** stops the worker. Worker errors/timeouts return to the project and offer retry. There is no fallback to an unbounded main-thread export.
- If the copy remains too complex, use **Only selected objects**, hide fine details in the project, or make an optional lighter import copy. Very dense derived Boolean/oriented objects are stopped before allocating their evaluated geometry. A model's byte size alone cannot predict the memory needed for AR.

The submitted recording shows a restart during “Preparing your model…”, before Apple's viewer opens. That is consistent with memory pressure; the recording does not contain an iOS memory termination report. The changes remove a whole-project JSON signature, full-size imported AR mesh allocation, and unbounded USDZ export. A synthetic 300 MB OBJ containing 1,065,800 real triangles plus comment padding checks the large-file path, real preparation, a bounded USDZ, a responsive page, no reload, and all original faces retained in saved storage. This does not guarantee that every 300 MB architectural model fits every iPhone. The user's actual OBJ and physical device have not been tested in the cloud.
