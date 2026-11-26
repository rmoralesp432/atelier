# Organic studio update — November 5, 2026

## What changed, in order

1. **Welcome:** the glass orb is visible immediately, before authentication. AI settings/password and manual entry are in the corner. New project is above saved projects. No microphone session or paid model request starts automatically. The orb's idle animation is not a claim that AI is connected; real audio levels still drive active voice.
2. **Assembly diagrams:** construction separation, whole-level separation, and glass/frame system separation; adjustable spacing; whole model, selection or named-group scope; explicit local-axis direction/distance for selected parts; fixed parts and reset. Roofs lift, floors form a stack, façades exit along their outward normal. Hosted accessories follow their parent. Nearby floor datums prevent a distant building or terrace from reversing façade direction. Reassemble returns the untouched model. Guides trace straight displacement paths; local orthogonal axes naturally appear inclined in an axonometric projection.
3. **Manual architecture:** select a solid → **Slabs & windows**. Choose occupied floors and maximum window width, then review **Create editable slabs & windows**. Existing validated conversion produces independently editable slabs, roof, glass and frames. It supports vertical constant-footprint envelopes, not automatic façade fitting on every sculptural shell.
4. **Appearance:** dedicated Appearance panel; Location is a separate panel reached through map/location actions. Solid retains shaded materials. Glass retains its tint and transparency in Solid and Hidden line instead of becoming an opaque hidden-line surface.
5. **Organic modeling:** new validated tools below, shared by text and voice, with retained recipes, stable identities, project persistence and Undo. These are geometry-engine additions, not a larger keyword matcher.
6. **Corrections:** retained surface/cage/path controls, re-editable brush operations and blend parameters, and a reference-relative inward/outward layout correction for existing components. The AI receives current controls, source recipes, scale frames and component information. Instructions distinguish correcting existing objects from creating duplicates.

## Geometry now available

| Tool                 | Geometric result                                                                                          | What remains editable                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Rational NURBS shell | Sampled weighted tensor-product surface, normal-offset thickness, closed boundary                         | Weighted control net, degrees, thickness, sampling                           |
| Variable sweep       | Closed rectangular ribbon or elliptical tube along a smooth spatial path; changing section size and twist | Path and section stations                                                    |
| Smooth profile loft  | Perimeter-resampled sections of different corner counts, smoothly interpolated vertically                 | Each section outline/elevation, correspondence, smoothing                    |
| Subdivision cage     | Finite Catmull–Clark subdivision of a closed quad cage                                                    | Cage vertices, crease edges, iterations, pinned base                         |
| Organic fields       | Smoothly blended ellipsoids and tapering capsules; subtracted fields form cavities/tunnels                | Additive/subtractive elements, radii, blend, spacing                         |
| Local sculpt         | Radial-falloff pull, normal inflation or local twist on a refined closed mesh                             | Brush settings and retained source; revise last brush without compounding it |
| Smooth Boolean       | Actual sampled union/subtraction/intersection of two to four closed solids                                | Original operands, operation history, editable blend width and sampling      |
| Layout inset         | Moves existing members inward/outward in a reference object's local axes                                  | Existing IDs, dimensions, elevation and unrelated components remain intact   |

Geometry is validated before a transaction is installed. Important replacement/subtraction operations retain review. Self-crossing forms, empty solids, disconnected smooth unions, invalid control cages and excessive sampling are rejected with feedback instead of pretending success. Project imports were not given a smaller file or triangle limit.

## Boundaries to understand

- **This is not unrestricted CAD mastery.** NURBS control nets are real, but rendered/exported solids are tessellated. There is no trimmed multipatch NURBS kernel, automatic G2 stitching, arbitrary remeshing/topology surgery, or guaranteed recovery of an exact landmark from its name.
- Smooth lofts follow vertically ordered sections. Sweep paths are open. Continuous folds must not intersect themselves. Coordinate/control budgets bound each operation; complex designs should be built as several editable parts.
- Implicit geometry approximates the surface at the selected spacing. A 0.4 m sample spacing is not a claim of millimeter precision. Ordinary sharp Booleans are preferable for precise openings. Blends retain the lowest source floor datum with a real planar cut.
- Sculpt and sampled blending have **editing** budgets: 40,000 source triangles per solid; sculpt refinement up to 120,000 triangles; blend grids up to 150,000 cells; primitive field grids up to 250,000. These do not restrict importing or viewing larger projects. Imported open surfaces cannot be treated as watertight solids.
- A local sculpt retains its original source and brush. Adjusting the latest brush is direct; changing an earlier brush in a chain requires undo/reapplication. Full recipe replacements explicitly set the new bounding-envelope base-center.
- Transparent panes remain transparent in Hidden line. Consequently, geometry behind glass can be visible: this is intentional.
- Automatic explosion uses roles, orientation and floor relationships. Unclassified imported meshes may need component roles or explicit directions. It does not automatically solve collision-free mechanical disassembly.
- Live OpenAI language, image interpretation and real-time voice were **not** tested in this update, as requested. Offline provider fixtures validate the actual protocol/engine/browser path; they do not establish that the paid model will choose every operation correctly. No API configuration was changed.

## Validation

The automated coverage checks analytic volume, closed-solid status, preserved base coordinates, thin shells, retained controls, different-profile lofts, five connected branches, genuine cavities, all three smooth Boolean operations, transformed blend revision, rotated column inset, save/reload, Undo, request-schema compatibility and invalid-input rejection.

Production browser checks exercise the welcome screen on desktop/phone, new manual component conversion, material transparency, separate appearance/location panels, assembly controls, and a provider-fixture organic design followed by a control edit. Screenshots were visually inspected. Hardware iPhone AR and live model interpretation require device/API trials; this release makes no new claims about those.

### Browser captures

- [Welcome orb on desktop](organic-welcome.png) and [phone project chooser](organic-welcome-phone.png).
- [Editable curved roof and twisted ribbon](organic-roof-ribbon.png).
- [Assembly diagram controls](organic-assembly.png).
- [Transparent glass in Hidden line](organic-glass.png).

## Ten live trials

Use a new project per independent trial. These are test prompts, **not claims that live AI interpretation has passed**. Keep the initial version simple, then try a follow-up. If a request fails, send the exact text, response and a screenshot/project export.

1. **Recognizable building:** “Create a conceptual Barcelona Pavilion-inspired study, approximately 30 × 18 m. Use a raised platform, a flat roof, freestanding walls, slender columns and transparent glazing as separate editable parts. Ask about anything you cannot infer; do not claim an exact replica.” Check separateness, openings and stated assumptions.
2. **Ten floors:** “Create a ten-story building with a 24 × 16 m rounded irregular footprint and 4 m floor-to-floor height. Separate the slabs, roof, columns and broad glazing panels. Keep the model simple.” Follow-up: “Inset the columns 2 m without moving the slabs or glazing.” Check ten occupied levels, overall height, unchanged other parts and stable column count.
3. **Image-guided massing:** attach a building image: “Use this as design inspiration for a 30 m wide volumetric model. Keep its main curves and proportions; omit ornament. Explain the depth assumptions and keep the roof separate.” Check the interpretation against the image rather than accepting any valid solid.
4. **Sculptural metal-like roof:** “Create three separate flowing roof shells inspired by the folded surfaces of Walt Disney Concert Hall, across a 25 × 18 m site. Give them 20 cm thickness and distinct names. Make an approximation, not a replica.” Follow-up: “Raise the middle shell's inner control region without raising its outer edge.”
5. **Ribbon:** “Create a 12 m tall ribbon, 2 m wide and 20 cm thick, twisting 90 degrees from bottom to top.” Follow-up: “Make the middle 3 m wide while keeping both ends 2 m wide.” Check actual thickness, twist and retained station controls.
6. **Morphing footprint:** “Blend a 10 × 8 m irregular base into a 14 × 10 m elliptical middle section at 6 m and an asymmetrical curved top at 12 m. Keep it one smooth solid.” Follow-up: “Shift only the top profile 2 m east.” Check the base stays in place.
7. **Wave façade:** “Create a separate 20 m wide, 8 m tall façade shell with two broad waves and 15 cm thickness.” Follow-up: “Increase the central wave's depth, keeping the four perimeter edges fixed.” Check it changes a retained surface rather than making boxes or duplicates.
8. **Soft form and void:** “Create three overlapping rounded volumes across a 10 m area and smoothly blend them. Then carve a curved tunnel that widens into a central cavity. Use conceptual resolution and tell me its spacing.” Check a real opening and cavity, not overlapping translucent meshes. Try “reduce the blend width” and Undo.
9. **Branching support:** “Create one sculptural support with a 4 m trunk splitting into five curved tapering branches up to 8 m high. Blend the junctions smoothly.” Check connectivity and taper. Follow-up: “Pull the east branch outward without changing the trunk.”
10. **Sculpt correction:** “Create a 6 m cube. Pull its upper northeast region outward by 1 m with a smooth 5 m falloff, keeping the base fixed.” Follow-up: “That is too much; reduce that pull to 50 cm.” Check the second edit revises the brush instead of adding another 50 cm.

For a building with floors/glazing, also try **Explore → Separate parts**, switch diagram arrangement, choose a group, keep one datum fixed and reassemble. Confirm the saved dimensions/positions do not change.

## Investigation and implementation sources

- [FreeCAD ExplodedAssembly](https://github.com/JMG1/ExplodedAssembly): reviewed its documented group/subassembly, normal-direction and placement-animation concepts. ATELIER uses its own implementation; explicit directions and retained source placement are the relevant principles.
- [Three.js NURBSSurface](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/curves/NURBSSurface.js): rational surface evaluation. Installed implementation inspected; surfaced through a retained control-net recipe.
- [Manifold](https://github.com/elalish/manifold): inspected the installed API for level sets, refinement, half-space cuts and solid validation; used for actual solid construction.
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh): nearest-surface queries and ray parity for source-solid distance fields.

Subdivision uses explicit Catmull–Clark stencils; sweeps use transported frames; lofts preserve perimeter correspondence and triangulate end caps with shared boundary vertices. These choices address actual geometry rather than cosmetic overlap.
