import { resolve } from 'node:path';
export const root = resolve(
  '/workspace/atelier-campaign/.cloud/workshop-campaign',
);
export const docs = resolve('docs/evaluations/workshop-reliability/live');
export const versions = {
  baseline: {
    path: '/workspace/atelier-phase3',
    commit: 'f925e4cef7b4c6a27eb1532476879728aa5d7584',
  },
  reliability: {
    path: '/workspace/atelier-reliability',
    commit: '16361bba915d56f1eca224c953b53a30d59bc5c9',
  },
} as const;
export type Version = keyof typeof versions;
export const conditions = {
  model: 'gpt-6.1-sol',
  api: 'responses',
  serviceTier: 'default',
  executorEffort: 'high',
  reviewerEffort: 'low',
  maxOutputTokens: 6000,
  parallelLanes: 2,
  maximumCallsPerTurn: 32,
  turnDeadlineMs: 900000,
  positionToleranceM: 0.002,
  roundSolidRelativeTolerance: 0.02,
};
