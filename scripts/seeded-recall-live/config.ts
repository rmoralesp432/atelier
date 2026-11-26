/** Approved two-turn seeded diagnostic; expectations never enter provider requests. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export const root = resolve('.cloud/seeded-recall-live');
export const docs = resolve('docs/evaluations/design-decisions/seeded-live');
export const appCommit = 'deb730317cafe2e0b251a788693934196660140c';
export const protocol =
  'docs/evaluations/design-decisions/seeded/FRESH-AI-PROTOCOL.md';
export const fixture = 'docs/evaluations/design-decisions/seeded/fixture';
export const seed = JSON.parse(
  readFileSync(fixture + '/starting-session.json', 'utf8'),
);
export const history = JSON.parse(
  readFileSync(fixture + '/full-history.json', 'utf8'),
);
export const originalQuote =
  'Leave exactly 32 cm clear between the turntable top and the underside of the light panel so bulky samples can be inserted. Keep that sample-loading space usable as we develop the rig.';
export const prompts = [
  'Raise the turntable surface by 11 cm. Keep its diameter and horizontal position unchanged.',
  'We will only scan flatter samples now. Change the sample-loading clearance to exactly 18 cm instead of 32 cm. Keep the turntable where it is and leave the storage cube and sample puck alone.',
];
export const conditions = {
  model: 'gpt-6.1-sol',
  api: 'responses',
  serviceTier: 'default',
  executorEffort: 'high',
  reviewerEffort: 'low',
  maxOutputTokens: 6000,
  ceilingUSD: 2,
  maximumPaidCalls: 20,
  maximumCallsPerTurn: 20,
  turnDeadlineMs: 900000,
  positionToleranceM: 0.001,
  roundRelativeTolerance: 0.02,
};
