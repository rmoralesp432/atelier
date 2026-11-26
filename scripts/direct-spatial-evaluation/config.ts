import { resolve } from 'node:path';
export const docs = resolve('docs/evaluations/direct-spatial-live');
export const root = resolve('.cloud/direct-spatial-live');
export const versions = {
  baseline: {
    path: '/workspace/atelier-reliability-recovery',
    commit: '05277619f6fa337cdb1bfb0825654cbe5259ed2d',
  },
  treatment: {
    path: '/workspace/atelier-spatial-relations',
    commit: '711a8cff9eb54a4c5254e5c20187b7b2614020da',
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
  maximumCallsPerTurn: 20,
  maximumCalls: 20,
  ceilingUSD: 3,
  turnDeadlineMs: 900000,
  positionToleranceM: 0.001,
  roundSolidRelativeTolerance: 0.02,
  // Counterbalance version order, preserving the same starting fixture per task.
  order: ['A-baseline', 'A-treatment', 'B-treatment', 'B-baseline'],
};
