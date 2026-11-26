# Design-intent investigation — offline only

- [Findings and the smallest proposed improvement](FINDINGS.md)
- [Natural eight-turn session, independent scoring and proposed fresh-AI protocol](WORKFLOW.md)
- [Actual browser replay and saved sessions](offline-1/result.json)
- [Context/citation-boundary probes](context-probes.json)
- [Editable project copies and framed viewport captures](models)
- [Separate frozen-candidate release review](../../release-reviews/711a8cf/REVIEW.md)

Application: frozen `711a8cf`. Production remains `f925e4c`. Executor and reviewer outputs in this investigation are **scripted**. All geometry, host verification, browser commits and storage checks use the actual application. Zero paid calls; no application behavior change, merge or deployment.

The editable `.atelier.json` files are copies of the browser's committed projects, including conversation and Undo/Redo history. Open them using **Projects → Open project copy**. Importing creates a new project; it does not overwrite an existing one. Framed screenshots change the camera only and do not replace the original replay screenshots or alter scored geometry.
