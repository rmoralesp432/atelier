import { resolve } from 'node:path';
export const root = resolve('.cloud/workshop-campaign');
export const docs = resolve('docs/evaluations/workshop-campaign');
export const versions = {
  baseline: {
    path: '/workspace/atelier-phase3',
    commit: 'f925e4cef7b4c6a27eb1532476879728aa5d7584',
  },
  workshop: {
    path: '/workspace/atelier-workshop',
    commit: 'f5ba62621db0d9c0a02f90be5b0143c7e21b53f7',
  },
  verifier: {
    path: '/workspace/atelier-derived-verification',
    commit: '433d9baed8265cc4eb78a5b0bfb914911b734cf7',
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
