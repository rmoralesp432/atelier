# Budgeted live modeling evaluation

This is an explicit opt-in evaluation of real GPT-4.1 plans executed through the same checked planner and solid engine as the app. It uses synthetic projects, never the user's saved designs. It is not included in CI and does not test a physical microphone or AR placement.

## Before running

Configure `ATELIER_OPENAI_API_KEY` as an OpenAI API secret, not ATELIER's workspace unlock password. A successful GET model listing is not sufficient proof that generation is authenticated: model metadata was available without authentication during setup. A generation request returning `401 invalid_api_key` does not verify modeling and does not consume generation tokens.

Review pricing before each authorized evaluation round. The public LiteLLM price table checked on 2026-11-05 lists GPT-4.1 at $2 per million input tokens and $8 per million output tokens. This is a cross-check, not an invoice. Cached-input discounts are intentionally ignored in the reported estimate. The request ledger uses an additional 25% margin, a $2.80 conservative accounting ceiling, at most 40 total calls and at most five per scenario. Before each call it reserves the output-token maximum plus a conservative input estimate (serialized UTF-8 request bytes plus 4096 tokens). Unknown outcomes remain fully reserved; explicit authentication failures release the reservation. The SDK performs no transport retries.

The approved round targets $2 and authorizes no more than $3. These are client-side controls for this script, not an account-wide OpenAI billing limit. Other users/app requests are outside this ledger. Do not delete the ledger or start simultaneous instances during the same authorized round. The ledger is local to the current environment; preserve it before replacing that environment.

## Run

List available scenarios without spending:

```sh
node --use-env-proxy --import tsx scripts/evaluate-budgeted.ts
```

Run one or a few explicitly selected scenarios:

```sh
node --use-env-proxy --import tsx scripts/evaluate-budgeted.ts --live --case=dimensions --case=correction
```

Available scenarios cover precise dimensions/elevation, contextual correction, radial arrays, real subtraction, undo followed by intersection, editable gallery components, scoped column modification, retained organic ribbons, 2D-to-3D extrusion, and workspace actions. Run `dimensions` before `correction`, `subtract` before `undo_intersect`, and `gallery` before `scoped_columns` so follow-ups use genuine previous model output.

Artifacts and the cumulative ledger are written to `/tmp/atelier-budgeted-evaluation`. Scenarios assert actual dimensions, volumes, retained identities, preserved unrelated components or structured workspace effects; all generated solids are checked by Manifold. Workspace tests validate emitted effects, not a physical browser/microphone session. An organic-form check establishes retained editable geometry, not visual likeness to a reference. A clarification is reported explicitly rather than treated as successful modeling.

## Current verification

Harness dry-run succeeds. The first live creation request was rejected with `401 invalid_api_key` before model generation. No live modeling capability is verified by this attempt; no output tokens were generated. Raw authentication error bodies and credentials are not recorded. The suite remains prepared for a functioning API key.
