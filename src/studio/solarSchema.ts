import { z } from 'zod';
export const solarSchema = z
  .object({
    enabled: z.boolean(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((s) => {
        const date = new Date(`${s}T00:00:00Z`);
        return (
          Number.isFinite(date.getTime()) &&
          date.toISOString().slice(0, 10) === s
        );
      }, 'Use a real calendar date.'),
    minutes: z.number().int().min(0).max(1439),
    utcOffset: z.number().min(-12).max(14),
    path: z.boolean(),
    seasonal: z.boolean().optional(),
  })
  .strict();
// Provider output has no optional members; existing local solar state remains
// backward-compatible when seasonal is absent.
export const solarOperation = z
  .object({
    type: z.literal('solar_study'),
    ...solarSchema.shape,
    seasonal: z.boolean(),
    targets: z.array(z.string().min(1).max(100)).max(200),
  })
  .strict();
