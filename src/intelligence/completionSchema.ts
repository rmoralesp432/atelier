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
export const completionCriteriaSchema = z
  .object({
    modeling: z.boolean(),
    editable: z.array(z.string().min(1).max(100)).max(MAX_SCENE_OBJECTS),
    checks: z
      .array(
        z
          .object({
            source: z.enum(['request', 'history', 'reference']),
            evidence: z.string().min(1).max(400),
            requirement: z.union([
              designRequirement,
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
    checks: z
      .array(
        briefAssessmentSchema
          .extend({ ids: z.array(z.string().max(100)).max(16) })
          .strict(),
      )
      .max(34),
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
