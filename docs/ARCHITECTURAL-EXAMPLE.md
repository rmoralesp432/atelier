# Raised pavilion: a real geometric example

Open [ATELIER](https://atelier-emxi.onrender.com). Your existing project remains in that browser; use **Export project** before importing a different study.

## Try the geometry without spending API credits

Download [the raised pavilion project](https://atelier-emxi.onrender.com/examples/raised-pavilion.json), save it as JSON, then click **Import** in ATELIER and choose that file. The project contains:

- A 100 × 20 m envelope, 8 m high, with its base 4 m above ground.
- A lower 106 × 26 × 4 m volume: the example explicitly chooses a 3 m **outward** offset on each side. An inward offset would be 94 × 14 m instead.
- A 45° rotation of the upper volume; the lower volume retains its original orientation.
- Two occupied floor slabs and a roof, 0.25 m thick, with real glazing and frames. Overall height remains 8 m and base elevation remains 4 m.

Orbit by dragging the scene, pan with the right mouse button, and zoom with the wheel. Open the selected dimensions to edit precise values, floor count, slab thickness or panel spacing. Use **Undo** to step back through the actual modeling operations. Import preserves a backup of the receiving session and adds an undo-import step.

The separate [cylinder-intersection project](https://atelier-emxi.onrender.com/examples/cylinder-intersection.json) includes the intermediate true Boolean intersection with a centered cylinder of radius 4 m and height 12 m, followed by floor/curtain-wall conversion. An intersection retains **only the common material**, so the upper result becomes an 8 m diameter, 8 m high cylindrical envelope. If you want a cylindrical opening in the long pavilion instead, request subtraction. The original operands remain in history.

These are authored examples generated through the same geometry engine using `node --import tsx scripts/create-example-projects.ts`. They do not call an AI service and are never substituted for an AI response.

## Try natural conversation after API billing is funded

You can use your own wording; there is no command grammar to learn. The intended conversational sequence is:

1. “Create a volume 100 meters long, 20 meters deep and 8 meters tall, raised 4 meters off the ground. Under it, create a 4-meter-high base extending outward 3 meters on each side.”
2. “Rotate the upper volume 45 degrees.”
3. “Intersect it with a cylinder 12 meters high and radius 4 meters, centered on the upper volume. Keep only their shared solid.” Review the identified objects, then approve by button or conversation.
4. “Turn the result into two floors with curtain walls, keeping its height and elevation.” Review and approve. ATELIER explains that two occupied floor slabs plus a roof preserve the envelope height.

Ambiguous inward/outward offsets or intersection/opening requests should prompt clarification. Floor/curtain-wall conversions preserve the original envelope for later edits and undo. Facades currently support constant vertical footprints, including the tested cylinder and rectangular envelope; sloping facades are rejected explicitly.

The geometry, UI, persistence and review flow have automated coverage using explicit model fixtures. Live interpretation of these sentences remains unverified because the configured OpenAI account returned `credit_balance_exhausted`. Realtime voice uses the same planner; microphone capture, audible responses and continuous live turn-taking still require testing after billing is resolved. See [validation evidence](VALIDATION.md).
