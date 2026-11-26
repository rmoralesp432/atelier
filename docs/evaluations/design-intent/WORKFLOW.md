# Design intent through a project — offline protocol

Prepared November 26, 2026 against frozen application `711a8cff9eb54a4c5254e5c20187b7b2614020da`. This session tests whether an earlier user decision remains useful context, can authorize a necessary connected edit, and can later be revised. It is separate from the `711a8cf` release review and its completed four-run comparison. No application improvement is implemented here.

## One ordinary project session

Start in a genuinely empty project with an empty conversation. No fixture geometry, design notes, object IDs, construction recipe, verification predicate or expected coordinate is supplied to fresh AI. Enter these requests through the normal workspace. The numerical fixture used for offline rehearsal is only one valid construction; it is not a template the agent must reproduce.

1. **Initial brief and reason.** “Make an editable sample-review station: a simple table 1.8 m wide and 80 cm deep, with its working surface 75 cm above the floor, and a freestanding display panel centered behind it. Add a low sample plinth off to the left. Leave exactly 30 cm clear between the back edge of the tabletop and the display panel so I can reach the cables. Keep that access space usable as we develop the station. Keep the table, supports, panel and plinth as separate editable pieces. Choose reasonable dimensions for the unspecified parts.”
2. **Work elsewhere.** “Make the sample plinth 80 cm wide and 60 cm high. Leave the station alone.”
3. **New unrelated work.** “Add a simple round stool to the left of the table, clear of the plinth, 42 cm in diameter and 45 cm high.”
4. **Develop the table.** “Widen the tabletop to 2.1 m about its center and keep the legs sensibly under its corners. Leave the other objects alone.”
5. **Change the side arrangement.** “Move the plinth and stool 50 cm farther left. Leave everything else where it is.”
6. **Reload, then rely on the earlier decision.** “Make the table 1.2 m deep by extending its back. Keep the front edge and working height where they are.” Do not mention the panel, access reason or gap again. Correct completion includes moving the panel and its supports to retain the original 30 cm cable-access space, repositioning appropriate table supports, and preserving side objects.
7. **Explicitly revise the decision.** “The cables will now be reached from the side, so change the access gap to exactly 15 cm instead of 30 cm. Move only the display panel and its supports; leave the table and side pieces alone.” Correct completion changes the gap, updates any recorded decision, and does not treat the earlier value as permanent.
8. **Reload, then rely on the revised decision.** “Make the table 1.4 m deep, again extending the back while keeping the front edge and working height fixed.” The panel should follow the table's growing rear edge with the revised 15 cm gap, not restore 30 cm.

The user never names a modeling tool or tells the reviewer which check to choose. A reasonable reversible assumption may define construction thickness, leg design or panel height. It must remain distinguishable from the user's explicit dimensions and access requirement. A clarifying question is warranted only if competing interpretations materially affect the result.

## Independent scoring

Record the initial valid construction before scoring later edits. Bind semantic parts to their actual editable IDs and establish front/back/lateral directions from the delivered geometry and declared orientation. Accept different sensible support constructions and orientations; do not require the offline fixture's object count, colors or invented dimensions. If semantic binding is ambiguous, retain the result for human review instead of silently choosing whichever binding passes.

For each turn, report these separately:

| Dimension               | Evidence and scoring                                                                                                                                                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intent interpretation   | Did the proposed scope include the correct table, panel and support components? Did it keep side objects separate? Which observable inspection calls, decisions or citations support that interpretation? Do not infer hidden reasoning from a successful result.                                          |
| Decision provenance     | Exact initial user statement/reason remains distinct from assumed thickness, support design and orientation. Record whether the agent chose to create/update a design note. Merely having a note supplied by a fixture is not autonomous capture.                                                          |
| Recoverable context     | Save full browser conversation, the exact executor and reviewer input histories, scene notes, request-start inspection results, project identity and available Undo/Redo. Repeat after reload. Distinguish data saved on disk from data actually supplied to the AI.                                       |
| Independent expectation | User dimensions plus the validated pre-edit solid determine targets. At turn 6, required clearance is the active user decision, 0.30 m; at turn 8 it is 0.15 m. The candidate must not supply its own target. A preserved current offset alone does not prove that the agent recovered the earlier reason. |
| Actual geometry         | Measure occupied solids, width/depth/top, fixed front datum, panel clearance and centering, support placement, positive volume, stable IDs and editability. Positional tolerance 0.001 m; retain the existing 2% tessellation allowance for round-solid volume.                                            |
| Scope preservation      | Compare complete original objects outside each edit's justified scope. In turns 6–8 the plinth and stool must remain unchanged. Preserve original IDs and component/group properties unless explicitly changed.                                                                                            |
| Actual save             | The normal application must finalize a correct proposal, save one atomic history entry, and reload it from browser storage. Report proposal correctness independently of save success.                                                                                                                     |
| Revision                | Turn 7's explicit instruction supersedes the old gap for this design. The table and side pieces stay intact. Turn 8 uses the revised decision. An assumption or inferred geometric connection never becomes an immutable user instruction.                                                                 |
| History                 | Reload, Undo, reload while undone, and Redo restore the actual saved projects, including their design notes. The conversation remains an audit transcript; record this distinction rather than claiming that Undo erases spoken instructions.                                                              |

If initial creation fails, do not invent a starting model and count dependent edits as end-to-end successes. Preserve the failure and mark dependent steps not reached. A later diagnostic on a validated starting model would require separate labeling.

## Controlled negative variants and context boundary

Two offline negative variants use the same session's proposals and checks: (a) deepen the table but leave the panel behind; (b) keep the obsolete 30 cm gap after the explicit 15 cm revision. Both must be rejected by a measured failure, with geometry, notes and history preserved. Do not confuse an unverified block with measured rejection, or scripted negative controls with autonomous repair.

The eight-turn session stays within the present 20-message AI window. It tests connected interpretation, reload and revision without manufacturing a long conversation. A **separately labeled offline capacity probe** uses its saved pre-reload history and appends synthetic non-modeling messages to cross the window boundary. This is not an additional real-user trial. It identifies whether the reason disappears from transmitted history while remaining saved in the transcript and project notes, and whether the verifier can cite the retained decision. Any future claim of long-project recall must include a fresh, naturally extended session; the eight-turn positive rehearsal alone cannot establish it.

## Fresh-AI execution remains unapproved

A possible first fresh run is this one eight-turn session on frozen `711a8cf`, with real GPT-6.1-sol and the normal executor/reviewer path. The agent chooses all operations and checks; offline scripted responses are disabled. Capture failed and incomplete turns, interpretation, actual solids, saves, decision provenance and costs. Do not let the user restate the gap at turns 6 or 8 to rescue a failure.

Suggested ceiling for a separate approval: **US$3 aggregate and at most 30 paid calls**, covering executor, reviewer, bounded corrections and unknown reservations. Recheck model access and the pricing basis immediately before execution. Reuse conservative pre-call reservations and stop before either cap would be exceeded. November 26's accepted estimates were $2/M input and $10/M output, with $4/M and $15/M plus 25% used for reservations; these are not confirmed account-specific prices. No paid call is authorized or made by this document.

This published session is a diagnostic, not a fresh held-out test of a later implementation. Freeze any future improvement before defining new held-out objects and reasons. Merge and deployment are separate decisions.
