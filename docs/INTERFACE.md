# A quieter workspace

ATELIER keeps modeling in the center, with one active tool panel and a shared menu. New visitors start in Day mode; existing saved Day/Night preferences are retained.

- **Moon / sun** above the viewport changes appearance immediately. The same switch is available in Tools.
- **Minus** beside Conversation minimizes the complete conversation to one floating button. Tap that button to return. Your draft, messages and active voice connection remain intact. Geometry reviews and reported errors reopen the conversation when attention is needed.
- **Create** contains 3D shapes, Draw 2D and editing tools. The phone removes duplicate Create/Draw controls from the navigation rail.
- **Tools** groups Inspiration, View & environment, and Project & settings. Changing tools opens one panel at a time.

## iPhone gestures

Use one finger to orbit, two fingers to pan/pinch/twist, or choose Pan for one-finger panning. In Orbit/Pan mode:

- Tap an object to select it.
- Hold a stationary finger for about half a second to open its actions.
- Double-tap an object to frame it. Double-tap empty space to frame the model.
- Use the selected object's **…** button for the same actions without a gesture.

The action sheet provides Move, Modify, Duplicate, Hide, Select several and Delete. Delete applies to the current selection and Undo restores it. Holding never deletes. Dragging, pinching and cancellation suppress the hold/double-tap actions. Edit mode retains transform-handle gestures; use **…** there.

## Explore assemblies

**Explore → Separate parts** creates a role-aware exploded assembly: floors remain aligned, roofs lift, facades move outward, and hosted parts travel together. Trees and people remain in place. This changes the presentation, not saved modeling coordinates.

Use **Axonometric view** for an orthographic view, **Assembly guides** to toggle dashed displacement guides, and the amount slider to move between assembled and separated positions. Scope can be the whole model or the current selection (including hosted descendants).

**Doors & movable parts** lists elements with configured hinges/slides. Open or close each separately. In Open components mode, tapping a configured movable part in the viewport also toggles it. **Reassemble** and **Return to model** restore the assembly. Arbitrary imported meshes still need separately editable components and movement metadata; they do not automatically become doors or furniture mechanisms.

## Verification boundary

Cloud Chromium checks exercise real selection, camera changes, Delete/Undo, touch events, source preservation, assembly transforms, diagrams and responsive layouts. Native AR and XR transport tests use explicit capability fixtures. Physical iPhone Safari and native AR still require device testing. No paid AI requests are needed for these interface changes.
