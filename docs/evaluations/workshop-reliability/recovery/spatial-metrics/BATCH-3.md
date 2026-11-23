# Matched contextual-edit diagnostics

Application freeze: 0527761. Same actual saved starting models and natural follow-up prompts were given to both versions. These are **edit diagnostics**, not fresh creation-to-edit successes. Original starting dimensions were not supplied in the follow-up prompt. The ordinary scene summary remained available to each agent.

10 executed turns: 8 PASS, 2 NOT_COMMITTED. Two dependent candidate second edits were not attempted. All saved results passed independent solids, exact identities/unrelated-object preservation, reload, conversation/context/camera persistence, one atomic history entry, Undo and Redo. No new or removed component IDs in any successful edit.

| Starting model / requested changes | Stable | Candidate |
| --- | --- | --- |
| 31-part shelf: widen 90 cm; lift the second shelves 12 cm | Both edits pass | First proposal geometrically correct in offline replay, but save held on unresolved position calculation. Second edit not attempted. |
| 34-part conveyor: widen 30 cm; raise bed 20 cm with feet fixed | Both edits pass | First proposal geometrically correct in offline replay, but save held on unresolved position calculation. Second edit not attempted. |
| 65-part curved sculpture: lift balls/stems 20 cm; enlarge balls 6 cm with fixed centers and adjusted stems | Both edits pass | Both edits pass. Each changes 64 original components and preserves the plinth plus two unrelated samples exactly. |

Candidate inspection explicitly returned all 31 shelf members and all 34 conveyor members through group references, without missing IDs. For the second sculpture edit it explicitly inspected three starting objects; the first used the already-provided scene summary. Its independent calculations used pre-edit sphere width/base and stem height plus the requested changes, not candidate-derived desired targets. The resulting 32 spheres retain their centers; their stems remain connected. Both versions succeeded on the sculpture; this is not evidence that the candidate alone can perform that edit.

For the two held edits, corrected criteria alone pass actual geometry, but the host cannot prove those corrections equivalent within its restricted normalization rules. Source values remain unchanged; the issue involves zero/array expressions rather than a needed geometry alteration. The host correctly holds the save as unresolved, without instructing geometry repair. This remains a significant usability limitation. Offline replay is not an application commit, and it does not bypass correction policy.

Cost: 27 calls, estimated $1.827214; conservative accounting $2.2840175. No unknown usage. Executor median 14.20 s, reviewer median 13.33 s (reviewer maximum 28.95 s). Full per-turn durations, sources, traces, numerical facts and original scores are preserved in this directory and ../live/boundaries.json.

The new external measurement contract passed 39 offline controls, including different thin/rotated geometry, allowed sub-tolerance translation, blocked over-tolerance translation, wrong shape, displaced components, changed identities and unrelated changes. Reassessment of the previous sculpture shows maximum placement error 0.574 mm, negligible dimension error, and passing shape checks. Its original strict-score failure is retained in batch 2; it is not a confirmed application false acceptance.
