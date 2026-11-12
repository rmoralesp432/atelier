import { MAX_SCENE_OBJECTS } from '../limits';
import { z } from 'zod';
import { designBriefSchema, briefAssessmentSchema } from './designBriefSchema';
export const executionSchema = z
  .object({
    brief: designBriefSchema.optional(),
    assessment: z.array(briefAssessmentSchema).max(24).optional(),
    stage: z.number().int().min(1).max(5),
    remaining: z.number().int().min(0).max(4),
    next: z.string().max(400),
    receipts: z
      .array(
        z
          .object({
            stage: z.string().max(160),
            result: z.string().max(14000),
            created: z.array(z.string().max(100)).max(MAX_SCENE_OBJECTS),
            changed: z.array(z.string().max(100)).max(MAX_SCENE_OBJECTS),
            removed: z.array(z.string().max(100)).max(MAX_SCENE_OBJECTS),
          })
          .strict(),
      )
      .max(5),
  })
  .strict();
export type ExecutionContext = z.infer<typeof executionSchema>;
