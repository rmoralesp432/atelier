# Evaluator corrections, preserved separately from application outcomes

The application implementations remain unchanged. This record does not turn interrupted trials into completed successes.

## Before paid execution

The first geometric calibration returned 28/31 passing controls. Its classifier confused the thin mechanical shaft with the base plate because both were long and shallow. Adding the transverse-depth condition separated them; all 31 controls then passed. The initial console oracle also incorrectly assumed which side was the back without a front orientation in the request; it was corrected before paid calls to accept either valid back convention. The halo's opening exclusion is measured by solid intersection, rather than a loose bounding-height rule. Grouping is not required where the sculpture request did not request a group.

## Browser coordinator revision 2

First paid batch, `workshop-1`: both W1 creations committed and passed all independent solid measurements. Both also encountered evaluator persistence assertions. Baseline reload exceeded the Playwright assertion default of five seconds. Workshop and the separately seeded baseline edit encountered a raw camera-state inequality. Camera writes in the application are debounced 350 ms; the first harness sampled immediately after completion. This explains a possible race, not proof that every camera difference is harmless. The first harness did not preserve camera-before/after evidence, so those particular camera outcomes remain unresolved.

A lane could leave a page open after an `open()` assertion, and server teardown waited on it. Two contexts also shared one software WebGL/GPU process. Revision 2 gives each lane its own Chromium process, waits up to 45 seconds for reload readiness, samples camera state after settling, records both camera snapshots, and guarantees browser/server cleanup. Camera differences are reported separately and never erase already measured geometry; geometry, identities, unrelated-object and Undo requirements are unchanged. Committed browser storage is now captured before persistence assertions. A pause file stops between episodes.

The coordinator was stopped to correct this infrastructure. The stop note captured nine reconciled calls, but a tenth baseline W2 call completed before teardown; the ledger retains **all ten** with known usage, total estimated **$0.330894**, no unknown-charge reservation. That W2 attempt is interrupted, not a modeling failure or pass. The two paid W1 creations and one fixture-based W1 edit remain preserved. Their core geometry passed; full end-to-end persistence was not established by the initial attempt. Resume the original created models for fresh follow-up requests, and run a separate fresh matched repeat. The fixture edit remains diagnostic only.

Before the verifier batch, comparison against the original published D-H2 protocol also caught swapped height/depth in the new fixture's box (0.46/0.31). Revision 2 restores the original 0.31 m height and 0.46 m depth **before any paid D-H2 calls**, and recalibrates its independent oracle. It has no effect on workshop trials or application code. The first freeze is retained as `FREEZE-v1.json`; the revision gets a new hash manifest and commit.
