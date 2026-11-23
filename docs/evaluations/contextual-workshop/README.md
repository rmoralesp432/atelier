# Contextual editing: inspect the model before changing it

23 November 2026. Offline development only. No new API spending, merge or deployment.

Frozen implementation: [`f5ba626`](https://github.com/rmoralesp432/atelier/commit/f5ba62621db0d9c0a02f90be5b0143c7e21b53f7). [Review the diff](implementation.patch), [validation](VALIDATION.md), or [download the complete review bundle](ATELIER-contextual-workshop-f5ba626.zip). `SHA256SUMS` covers the bundled documents and evidence.

The working change gives the modeling agent a reliable way to look back at the model as it was at the start of the current request, while it coordinates a multi-stage edit. The normal workspace passes that reference into the existing agent. The existing `inspect_scene` tool can return the original geometry description, the provisional description, or their differences by object identity. It can also calculate signed world-envelope offsets and gaps relative to another object, with the source bounds and coordinate contract alongside the values.

This is separate from frozen verifier `433d9ba`. This branch starts at `a80d6ef91a1db50692856e826af487439b885c2c`, whose application is identical to stable `f925e4cef7b4c6a27eb1532476879728aa5d7584`. It contains none of the frozen verifier implementation. `FREEZE.json` identifies this implementation and its exact diff.

## Why this intervention

The existing Phase 3 baseline demonstrated five successful contextual edits and identified verifier arithmetic as the confirmed repair blocker. That verifier improvement is already frozen for separate evaluation. I am not relabeling those successes as failures or claiming that the old large-building edit-scope problem has now been diagnosed.

Outside that separate work, the most consequential concrete gap I could establish in the request-to-save path was the agent's inability to directly inspect the original model once provisional execution had changed it. `App.tsx` already retained an immutable transaction-start snapshot, and the independent reviewer used it. The modeling agent received current objects and execution receipts; `inspect_scene` only repeated the current construction data. For instructions such as keeping a clearance or setback, it had to retain the original values in reasoning or infer them from its partially modified scene.

The small intervention exposes the reference that already exists. It adds no object recipe, architectural template, persistent dependency graph, special editing command, or new approval flow. It does not prove that this gap was the cause of a previously observed AI failure. The next fresh-AI comparison must establish whether the new access improves decisions.

## Request to saved model

1. The workspace captures the current committed model using its existing transaction snapshot.
2. On every agent stage, the client supplies the original roster and only the original object descriptions that differ from the current scene. Unchanged objects are not duplicated. This is request-local data, not a new project/history entry.
3. The model sees a compact change summary. When needed it calls the existing inspection tool with `snapshot: before` or `compare`, optionally identifying a reference object. Old tool responses without these fields retain current-only behavior.
4. The host returns original/current descriptions, added/removed/changed identities, group information, and signed envelope comparisons. Missing original data is explicitly unavailable. Deleted originals remain inspectable. A new user request starts a new reference from its own committed starting model.
5. The agent still chooses ordinary geometry operations. The independent verifier, allowed edit scope, tolerances, transaction guard, atomic commit, persistence and Undo/Redo are unchanged.

The optional inspection uses the existing bounded tool loop; no extra AI call is forced for every request. Before/after and relative queries return at most 200 rows with explicit omission counts; exact IDs can target later rows. Existing current-only full-scene inspection remains available. The transport roster supports the application's scene limit. A 431-object offline case verified bounded output and full identity addressability; it was not a fresh-AI large-model performance test.

## Normal-workspace demonstration

**All language choices, construction choices and acceptance criteria in this demonstration are scripted test inputs.** The real client, request schema, provider adapter, inspection tool, staged planner, geometry kernel, independent completion predicates, `App.tsx` commit guard and browser persistence ran. Playwright intercepted provider transport; there were no OpenAI calls. This proves integration and geometric behavior, not fresh-AI interpretation, scope inference or autonomous reasoning.

The first instruction asks for an asymmetric freestanding display mobile: an oval base, slender mast, crossbar and two suspended weights of different shapes. It specifies independently editable parts and preservation of two existing marker objects. The test supplies ordinary construction assumptions using the existing general assembly tool. It does not load a saved response from a previous paid benchmark.

The follow-up asks to raise the crossbar by **0.29 m**, extend the mast from its fixed foot, and let the pendants follow while retaining their drop and shape. The first provisional stage moves the crossbar. The second reads the before/after tool response, retrieves the original signed clearances and uses them to position the remaining components. During this stage, the browser's saved project still contains the unedited assembly. Only the independently checked result commits.

| Component                            | Before         | After             | Identity and other properties             |
| ------------------------------------ | -------------- | ----------------- | ----------------------------------------- |
| Crossbar base                        | 1.52 m         | 1.81 m            | Same ID, section and horizontal placement |
| Mast height                          | 1.44 m         | 1.73 m            | Same ID, base at 0.08 m, same diameter    |
| Left suspension base                 | 1.02 m         | 1.31 m            | Same ID and 0.50 m length                 |
| Right suspension base                | 0.80 m         | 1.09 m            | Same ID and 0.72 m length                 |
| Spherical weight base                | 0.80 m         | 1.09 m            | Same ID and dimensions                    |
| Elliptical weight base               | 0.56 m         | 0.85 m            | Same ID and dimensions                    |
| Oval foot and both unrelated markers | Original state | Exactly unchanged | Same complete object data                 |

There are seven individually editable assembly parts and two protected objects. Six objects change; three remain byte-for-byte equivalent as model data. Group membership and all nine IDs survive. Creation and editing each produce one atomic modeling history entry. Browser reload retains the edited model; one Undo returns to the original assembly; Redo restores the edit. The viewport screenshots were visually inspected: the two suspension rods connect to their weights and crossbar, the mast reaches the raised crossbar, and the two unrelated markers remain visible. They are neutral workspace screenshots, not generated renders. Camera framing differs between the screenshots; numerical comparisons establish the displacement.

- [Before screenshot](evidence/mobile-before.png)
- [After screenshot](evidence/mobile-after.png)
- [Editable original project](evidence/mobile-created.atelier.json)
- [Editable edited project, with Undo history](evidence/mobile-edited.atelier.json)
- [Exact inspection responses, independent solid measurements, changed/preserved IDs and conversation](evidence/evidence.json)
- [Blocked unrelated-object edit and unchanged project/history](evidence/negative-control.json)

Open a project file through **Projects → Open project copy**. It imports a separate copy and can be inspected with the existing application. This does not install or deploy the new inspection capability.

Independent checks measured actual world solid bounds, positions, counts, grouping and editability. External assertions additionally checked all three dimensions, analytic solid volumes within tessellation allowance, exact IDs, group data and protected objects. These external measurements share the existing CAD kernel; they do not accept the application's success message as evidence. The demonstration does not certify physical balance, strength, joints or material properties.

## Transfer and negative controls

The same reference and comparison code also handled a **horizontal, closed-back hollow cylindrical housing with a separate cap**, using world Z rather than vertical Y. The cylinder had been hollowed and rotated using existing tools. After its length changed from **1.20 to 1.66 m**, inspection still returned the original **0.28 m cap clearance**. The cap moved from Z=0.94 to Z=1.17 m, retaining its shape and transverse position. The unrelated sphere and all identities remained unchanged. Solid volume scaled from 0.2427097432 to 0.3357484781 m³, consistently with the length change; the geometry remained hollow.

The host accepted the correct candidate. A cap displaced by another 0.12 m produced a measured **0.40 m** clearance and was classified incorrect, with `canCommit=false`. Serialization and engine Undo/Redo restored the exact expected projects. This is a scripted staged-planner/kernel test, **not a second App/browser commit demonstration**.

- [Housing before](evidence/sleeve-before.atelier.json)
- [Housing after](evidence/sleeve-after.atelier.json)
- [Before/after solid measurements, inspection and both completion verdicts](evidence/sleeve-evidence.json)

The browser negative control separately attempted to move a nearby unrelated marker. The existing independent scope check blocked it after the bounded repair attempts. Nothing changed in committed geometry or Undo history. New inspection access cannot authorize the edit or bypass this protection.

Additional unit cases cover multiple provisional stages, new and removed identities, a new-turn reference reset, missing/corrupt original data, reversed signed relationships, rotated box/sphere geometry and large inventories. These are development fixtures, not fresh held-out challenges.

## Validation and limits

See `VALIDATION.md` for exact runs and preserved harness corrections. Local unit, build and production-bundle Chromium results are evidence of software behavior, not CI results or paid model results.

The new relation measurements are explicitly **world bounding-envelope** facts. They do not establish surface distance, contact, support, attachment or permitted edit scope. Rotated, concave and hollow geometry can have empty space inside its envelope. Physical geometric checks remain the independent verifier's responsibility. Unsupported facts remain unknown.

Fresh AI has not yet chosen this tool or these edits. We have not measured its effect on AI completion rate, scope decisions, latency or API cost. Large source recipes can increase request payload size; original descriptions are sent only when changed, and the model receives their details only when it asks to inspect them. The original reference is for one request, not unlimited cross-session design memory. Existing snapshot-description limits still apply to imported/complex geometry. No physical phone/voice tests were added for this server/client inspection change.

The original frozen verifier package and its proposed baseline-versus-`433d9ba` paid comparison remain independent. No tasks for a fresh evaluation of this new improvement have been selected yet. Define them after this implementation freeze and obtain separate API authorization. No merge or deployment is authorized by this offline delivery.
