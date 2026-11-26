/** Evaluation only; frozen application code is never modified. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export const root = resolve('.cloud/design-decision-live');
export const docs = resolve('docs/evaluations/design-decisions/live');
export const appCommit = 'deb730317cafe2e0b251a788693934196660140c';
export const protocol =
  'docs/evaluations/design-decisions/FRESH-AI-PROTOCOL.md';
export const prompts = [
  ...readFileSync(protocol, 'utf8').matchAll(
    /^\d+\. (?:\*\*After reload:\*\* )?“([^”]+)”$/gm,
  ),
].map((m) => m[1]);
if (prompts.length !== 14)
  throw Error('Frozen protocol must contain exactly 14 user turns');
export const originalQuote =
  'Leave exactly 32 cm clear between the turntable top and the underside of the light panel so bulky samples can be inserted. Keep that sample-loading space usable as we develop the rig.';
export const conditions = {
  model: 'gpt-6.1-sol',
  api: 'responses',
  serviceTier: 'default',
  executorEffort: 'high',
  reviewerEffort: 'low',
  maxOutputTokens: 6000,
  ceilingUSD: 5,
  maximumPaidCalls: 60,
  maximumCallsPerTurn: 32,
  turnDeadlineMs: 900000,
  positionToleranceM: 0.001,
  roundRelativeTolerance: 0.02,
};
