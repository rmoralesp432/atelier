import { z } from 'zod';
import { organicPoint } from './organicSchema';
export const sculptSettingsSchema = z
  .object({
    mode: z.enum(['pull', 'inflate', 'twist']),
    center: z
      .object({
        x: z.number().min(-0.5).max(0.5),
        y: z.number().min(0).max(1),
        z: z.number().min(-0.5).max(0.5),
      })
      .strict(),
    radius: z.number().min(0.1).max(500),
    delta: organicPoint,
    strength: z.number().min(-180).max(180),
    preserveBase: z.boolean(),
  })
  .strict();
export type SculptSettings = z.infer<typeof sculptSettingsSchema>;
export const sculptOperations = [
  z
    .object({
      type: z.literal('edit_blend'),
      target: z.string(),
      radius: z.number().min(0.05).max(20),
      resolution: z.number().min(0.1).max(5),
    })
    .strict(),
  z
    .object({
      type: z.literal('sculpt'),
      target: z.string(),
      settings: sculptSettingsSchema,
      replaceLast: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal('smooth_boolean'),
      targets: z.array(z.string()).min(2).max(4),
      operation: z.enum(['union', 'subtract', 'intersect']),
      radius: z.number().min(0.05).max(20),
      resolution: z.number().min(0.1).max(5),
    })
    .strict(),
] as const;
