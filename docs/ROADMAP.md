# ATELIER roadmap

The priority is architecture through natural conversation, grounded in real geometry. The numbered milestones are verification gates, not permission to claim untested capabilities.

1. **Natural-language interpretation:** real Responses API adapter and validated plans implemented; live language evaluation awaits replenished API credits (the configured service currently receives `credit_balance_exhausted`). No keyword fallback is presented as AI.
2. **Conversational/spatial context:** selection groups, stable IDs, recent operands, relative camera directions and project north implemented and tested at the operation and UI-contract levels. Live reference-resolution quality still needs evaluation.
3. **Solid modeling:** Manifold primitives, rectangle/circle and custom polygon profiles, extrusion, Booleans, openings, editable cutter sizes, raised/offset volumes, exact placement, floor slabs, constant-footprint curtain walls and operation history implemented and numerically tested. Group rotations, roof/edge alignment, name-based references and read-only measurements are also implemented; local preflight validates destructive changes before approval.
4. **Adaptive UI:** full-size viewport, floating natural conversation, optional object/inspector panels, smooth framing, mesh reuse, retained precise editing and direct manipulation implemented and browser-tested.
5. **Realtime voice:** actual WebRTC/Realtime API plumbing implemented with shared modeling execution. Live audio/turn-taking is unverified until API credits and a real microphone/browser session are available.
6. **Architectural workflows and terrain:** the raised-pavilion/floor/curtain-wall workflow is implemented and tested with real geometry. Terrain remains explicitly deferred by the user; it has not been started. Future work must import real terrain and respect georeferencing/units; no synthetic terrain is substituted for a real import.

Preserved long-term requirements:

- Real terrain imports and site modeling.
- PDF/image references and reference scaling.
- Advanced snapping and constraint-aware edits.
- Verified bilingual conversations (the model prompt currently requests English/Spanish handling; live quality is unverified).
- Design alternatives and persistent branching history.
- Site analysis with explicit input data and assumptions.
- Export pathways to professional architectural software.

Current JSON export preserves application geometry and operation history; it is not a professional CAD/BIM interchange format. Parametric BREP and geospatial pipelines will be evaluated before claiming those exports or site workflows.
