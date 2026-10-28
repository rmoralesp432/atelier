# Create, explore and model from references

The main controls are **Objects**, **Create**, **Explore** and **Tools**. Secondary tools live in one menu; opening a panel closes the previous panel. Phone panels leave the upper viewport visible. Day and Night use the same layout and controls.

## Direct 3D creation

Choose **Create → 3D shapes**, select Box, Cylinder or Sphere, set dimensions and create. You do not need to draw a profile first. **Draw 2D** retains free drawing and extrusion; **Edit selection** holds push/pull, scale, stretch, mirror and arrays. Conversation uses the same validated geometry engine.

## Reference images

1. Choose **Tools → Model from reference**, or **Reference** beside the conversation input. On desktop, dropping a JPEG, PNG or WebP onto the workspace also attaches it.
2. Optionally enter a known building width in meters.
3. Choose **Create similar massing**, or write your own instruction about what to keep or change.

The existing server-side AI receives the image and conversation. Without a known scale, it is instructed to ask a useful design question before making geometry. The result is an editable interpretation, not photogrammetry, an accurate reconstruction or a BIM conversion. Photos do not establish hidden dimensions. Two images can be attached per message, up to 10 MB each; images are resized before sending. The existing AI connection and available API credit are required. No new hosting setup is needed.

## Explore a design

- **Explore → Explore**: animate an exploded assembly, lift roofs, or open configured doors/panels. The amount slider scrubs the presentation. **Reassemble** returns to the unchanged modeling coordinates.
- **Components**: label selected objects as walls, doors, windows, furniture, rooms and other roles. Set a host, level, hinge or sliding behavior. A hosted handle follows its door. Hosted windows follow a host's translation, yaw and envelope resize while retaining their own dimensions. Explicit child edits take precedence.
- Procedural building assemblies can be converted into separately editable components. An imported OBJ does not automatically acquire architectural semantics or hinged doors.
- **Views**: save the current viewpoint, frame selected objects, or create room cutaways from explicitly identified room envelopes. Saved target views isolate their objects; room views clip surrounding geometry to the room and cut below the ceiling. **Return to model** restores normal viewing. Saved views persist with the project.
- **Alternatives**: save up to six named compositions, preview one without modifying the current project, then choose **Keep this** or return. Applying an alternative is undoable. Alternatives contain geometry and groups, not separate sites or complete project histories.
- For a rectangular room envelope, try a meeting, classroom or lounge layout. These are editable concept solids, with perimeter clearance and conservative overlap checks. They are not detailed furniture products, evacuation analysis or code-compliance checks.

The AI planner can combine these actions using the current scene, component roles and named views/alternatives. Text and voice share the same operation engine. It cannot infer every room or architectural relationship from arbitrary imported triangles.

## Touch navigation

In Orbit mode, drag with one finger to orbit. Two fingers can pan, pinch for distance and twist to rotate together. Pan mode changes the one-finger gesture to pan. Finger changes and cancellation reset the gesture so they do not jump or accidentally select a model part. Drawing/editing retains its own gestures.

## Verification limits

Automated browser tests exercise actual geometry, persistence, animation transforms, camera/room views, touch events and reference-image requests. AI responses in these tests are explicit fixtures; live vision quality, spoken conversation, physical iPhone Safari performance and Apple's native AR placement still require device/account testing. See [validation evidence](VALIDATION.md) and [large-model AR](AR-FLOORS.md).
