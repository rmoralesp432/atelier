# Narrow correction after the first frozen live batch

The first implementation remains frozen at `16361bb`; all first-batch failures remain published at `1481258`. This branch is a separate, focused correction. No application code was changed while that scored batch was running.

The fresh 31-part library-shelf request produced correct solids, but its generated position calculation used a scalar zero where the typed range required a distance. The existing one-attempt independent correction returned zero times an already-cited shelf thickness. That is mathematically zero with length units. The first guard rejected this equivalent representation because its expression trees differed.

The correction permits only multiplication of constant zero by an existing finite scalar source. Source inventory, citations, units, coordinate frame, requested predicate, selectors, tolerances and edit scope remain fixed. It does not cancel arrays, measurements or compound expressions, so it cannot erase cardinality or hide division by zero. The corrected expression must still pass normal dimensional validation and actual-solid measurement. No geometry repair is requested for malformed criteria, and required unresolved placement still prevents saving.

`tests/fixtures/workshop-reliability/zero.json` preserves the actual executor and reviewer responses from the failed paid trial. Offline replay is explicitly saved-response evidence; it is not a new live-AI success. A 25 mm displaced shelf remains incorrect. Separate checks reject altered source values, erased arrays and undefined expressions.

Offline validation: 459/459 unit tests, production build, and all 5 production-browser replay tests passed. Correct group, reflection and saved live shelving results committed, survived reload, and restored through Undo/Redo. The displaced reflection and unresolved-criterion controls kept the original saved project intact. Unrelated objects remained byte-for-byte equal. Browser JSON reports and screenshots are in `browser/`; logs are in `logs/`. Fresh follow-up results will be reported separately. No merge or deployment is authorized by this work.
