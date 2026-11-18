import { z } from 'zod';
import { MAX_SCENE_OBJECTS } from '../limits';
import {
  designRequirement,
  designSelector,
  designBriefSchema,
  briefAssessmentSchema,
} from './designBriefSchema';

const identity = {
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(200),
};
const point = z
  .object({
    x: z.number().min(-4000).max(4000),
    y: z.number().min(-4000).max(4000),
    z: z.number().min(-4000).max(4000),
  })
  .strict();
const tolerance = z.number().min(0).max(0.1);
export const spatialRequirements = [
  z
    .object({
      ...identity,
      kind: z.literal('positions'),
      selector: designSelector,
      points: z.array(point).min(1).max(MAX_SCENE_OBJECTS),
      tolerance,
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal('radial'),
      selector: designSelector,
      center: point,
      plane: z.enum(['xy', 'xz', 'yz']),
      radius: z.number().positive().max(2000),
      count: z.number().int().min(1).max(MAX_SCENE_OBJECTS),
      start: z.number().finite(),
      step: z.number().finite(),
      tolerance,
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal('group'),
      selector: designSelector,
      name: z.string().min(1).max(200),
      exclusive: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal('editable'),
      selector: designSelector,
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal('relationship'),
      first: designSelector,
      second: designSelector,
      relation: z.enum([
        'touching',
        'disjoint',
        'intersects',
        'contained',
        'distance',
      ]),
      quantifier: z.enum(['each', 'all', 'any']),
      distance: z.number().min(0).max(2000),
      tolerance,
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal('region'),
      selector: designSelector,
      center: point,
      size: point,
      rotation: z.number().finite(),
      occupancy: z.enum(['empty', 'filled']),
      tolerance,
    })
    .strict(),
] as const;
export const completionCriteriaSchema = z
  .object({
    modeling: z.boolean(),
    scopeKnown: z.boolean().optional(),
    editable: z.array(z.string().min(1).max(100)).max(MAX_SCENE_OBJECTS),
    checks: z
      .array(
        z
          .object({
            source: z.enum(['request', 'history', 'reference']),
            evidence: z.string().min(1).max(400),
            requirement: z.union([
              designRequirement,
              ...spatialRequirements,
              z
                .object({
                  ...identity,
                  kind: z.literal('preserve'),
                  selector: designSelector,
                  properties: z
                    .array(
                      z.union([
                        designBriefSchema.shape.preserve.element.shape
                          .properties.element,
                        z.literal('identity'),
                        z.literal('all'),
                      ]),
                    )
                    .min(1)
                    .max(18),
                })
                .strict(),
              z
                .object({
                  ...identity,
                  kind: z.literal('offset'),
                  first: designSelector,
                  second: designSelector,
                  axis: z.enum(['x', 'y', 'z']),
                  firstAnchor: z.enum(['min', 'center', 'max']),
                  secondAnchor: z.enum(['min', 'center', 'max']),
                  value: z.number().min(-2000).max(2000),
                  tolerance: z.number().min(0).max(0.1),
                })
                .strict(),
              z
                .object({
                  ...identity,
                  kind: z.literal('unavailable'),
                  reason: z.string().min(1).max(400),
                })
                .strict(),
            ]),
          })
          .strict(),
      )
      .max(32),
    qualitativeLimits: z.array(z.string().min(1).max(300)).max(8),
  })
  .strict();
export type CompletionCriteria = z.infer<typeof completionCriteriaSchema>;
export const completionReportSchema = z
  .object({
    modeling: z.boolean(),
    passed: z.boolean(),
    status: z.enum(['verified', 'incorrect', 'unverified']),
    canCommit: z.boolean(),
    checks: z
      .array(
        briefAssessmentSchema
          .extend({
            ids: z.array(z.string().max(100)).max(16),
            outcome: z.enum(['verified', 'incorrect', 'unverified']),
          })
          .strict(),
      )
      .max(35),
    qualitativeLimits: z.array(z.string().max(300)).max(8),
  })
  .strict();
export type CompletionReport = z.infer<typeof completionReportSchema>;

// Only identities/classification from the candidate are supplied to the
// independent reader. Desired dimensions cannot be copied from its result.
export const completionInventorySchema = z
  .array(
    z
      .object({
        id: z.string().max(100),
        name: z.string().max(200),
        groupId: z.string().max(100).nullable(),
        role: z.string().max(80).nullable(),
        level: z.string().max(80).nullable(),
      })
      .strict(),
  )
  .max(MAX_SCENE_OBJECTS);
