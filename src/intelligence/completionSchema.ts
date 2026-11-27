import { z } from 'zod';
import { MAX_SCENE_OBJECTS } from '../limits';
import { calculationSchema, calculationTraceSchema } from './calculationSchema';
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
      kind: z.literal('preserve_offsets'),
      first: designSelector,
      second: designSelector,
      axis: z.enum(['x', 'y', 'z']),
      firstAnchor: z.enum(['min', 'center', 'max']),
      secondAnchor: z.enum(['min', 'center', 'max']),
      tolerance,
    })
    .strict()
    .describe(
      'For each original first object, bind the nearest distinct original second object by world-bounds anchor-point distance (other axes at center). Preserve secondAnchor minus firstAnchor on axis using the SAME identities after editing. Ties are unverified. Bounds offsets do not prove surface contact. Expected values come only from the original scene; no calculation is needed.',
    ),
  z
    .object({
      ...identity,
      kind: z.literal('diameter'),
      selector: designSelector,
      shape: z.enum(['sphere', 'cylinder']),
      value: z.number().positive().max(2000),
      tolerance,
    })
    .strict(),
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
            calculation: calculationSchema.optional(),
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
                  value: z
                    .number()
                    .min(-2000)
                    .max(2000)
                    .describe(
                      'Signed WORLD-axis displacement: second.secondAnchor minus first.firstAnchor. Reversing first/second reverses the sign. Each selector identifies one object. Anchors are actual world solid bounds, not local coordinates.',
                    ),
                  tolerance: z.number().min(0).max(0.1),
                })
                .strict(),
              z
                .object({
                  ...identity,
                  kind: z.literal('unavailable'),
                  required: z.boolean().optional(),
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
export const criterionIssueSchema = z
  .object({
    checkId: z.string().max(60),
    code: z.enum([
      'contradiction',
      'invalid_contract',
      'invalid_calculation',
      'unsupported_property',
    ]),
    detail: z.string().max(1000),
    related: z.array(z.string().max(60)).max(32),
  })
  .strict();
export type CriterionIssue = z.infer<typeof criterionIssueSchema>;
export const offsetPreservationTraceSchema = z
  .object({
    source: z.literal('original'),
    frame: z.literal('world_xyz_y_up'),
    unit: z.literal('m'),
    axis: z.enum(['x', 'y', 'z']),
    firstAnchor: z.enum(['min', 'center', 'max']),
    secondAnchor: z.enum(['min', 'center', 'max']),
    formula: z.literal('second - first'),
    binding: z.literal('nearest_original_anchor_points'),
    pairs: z.number().int().positive(),
    maxError: z.number().finite().nonnegative().nullable(),
    // All pairs are checked. Keep response size bounded; failed pairs first.
    samples: z
      .array(
        z
          .object({
            first: z.string(),
            second: z.string(),
            originalFirst: z.number().finite(),
            originalSecond: z.number().finite(),
            expected: z.number().finite(),
            measured: z.number().finite().nullable(),
          })
          .strict(),
      )
      .max(16),
  })
  .strict();
export type OffsetPreservationTrace = z.infer<
  typeof offsetPreservationTraceSchema
>;
export const completionReportSchema = z
  .object({
    modeling: z.boolean(),
    passed: z.boolean(),
    status: z.enum(['verified', 'incorrect', 'unverified']),
    canCommit: z.boolean(),
    criterionIssues: z.array(criterionIssueSchema).max(32).optional(),
    checks: z
      .array(
        briefAssessmentSchema
          .extend({
            ids: z.array(z.string().max(100)).max(16),
            outcome: z.enum(['verified', 'incorrect', 'unverified']),
            calculation: calculationTraceSchema.optional(),
            offsets: offsetPreservationTraceSchema.optional(),
          })
          .strict(),
      )
      .max(35),
    qualitativeLimits: z.array(z.string().max(300)).max(8),
  })
  .strict();
export type CompletionReport = z.infer<typeof completionReportSchema>;
export const criteriaRevisionSchema = z
  .object({
    criteria: completionCriteriaSchema,
    issues: z.array(criterionIssueSchema).min(1).max(32),
    observations: z
      .array(
        z
          .object({
            id: z.string().max(60),
            outcome: z.enum(['verified', 'incorrect', 'unverified']),
            observed: z.string().max(800),
          })
          .strict(),
      )
      .max(35),
  })
  .strict();
export type CriteriaRevision = z.infer<typeof criteriaRevisionSchema>;

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
