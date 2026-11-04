import { z } from 'zod';
export const executionSchema = z
  .object({
    stage: z.number().int().min(1).max(5),
    remaining: z.number().int().min(0).max(4),
    next: z.string().max(400),
    receipts: z
      .array(
        z
          .object({
            stage: z.string().max(160),
            result: z.string().max(14000),
            created: z.array(z.string().max(100)).max(200),
            changed: z.array(z.string().max(100)).max(200),
            removed: z.array(z.string().max(100)).max(200),
          })
          .strict(),
      )
      .max(5),
  })
  .strict();
export type ExecutionContext = z.infer<typeof executionSchema>;
