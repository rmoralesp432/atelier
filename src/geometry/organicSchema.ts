import { z } from 'zod';
export const organicPoint = z
  .object({
    x: z.number().min(-500).max(500),
    y: z.number().min(-500).max(500),
    z: z.number().min(-500).max(500),
  })
  .strict();
const point2 = z
  .object({
    x: z.number().min(-500).max(500),
    z: z.number().min(-500).max(500),
  })
  .strict();
export const organicDefinitionSchema = z.discriminatedUnion('method', [
  z
    .object({
      method: z.literal('nurbs'),
      degreeU: z.number().int().min(1).max(3),
      degreeV: z.number().int().min(1).max(3),
      points: z
        .array(
          z
            .array(organicPoint.extend({ weight: z.number().min(0.1).max(10) }))
            .min(2)
            .max(8),
        )
        .min(2)
        .max(8),
      thickness: z.number().min(0.02).max(5),
      samples: z.number().int().min(8).max(40),
    })
    .strict(),
  z
    .object({
      method: z.literal('organic_sweep'),
      path: z.array(organicPoint).min(2).max(16),
      profile: z.enum(['rectangle', 'ellipse']),
      stations: z
        .array(
          z
            .object({
              at: z.number().min(0).max(1),
              width: z.number().min(0.02).max(100),
              depth: z.number().min(0.02).max(100),
              twist: z.number().min(-720).max(720),
            })
            .strict(),
        )
        .min(2)
        .max(12),
      samples: z.number().int().min(12).max(96),
    })
    .strict(),
  z
    .object({
      method: z.literal('smooth_loft'),
      sections: z
        .array(
          z
            .object({
              y: z.number().min(-500).max(500),
              points: z.array(point2).min(3).max(64),
            })
            .strict(),
        )
        .min(2)
        .max(12),
      smoothProfiles: z.boolean(),
      alignProfiles: z.boolean(),
      samples: z.number().int().min(16).max(64),
    })
    .strict(),
  z
    .object({
      method: z.literal('subdivision'),
      vertices: z.array(organicPoint).min(4).max(80),
      faces: z
        .array(z.array(z.number().int().min(0).max(79)).length(4))
        .min(4)
        .max(80),
      creases: z
        .array(z.array(z.number().int().min(0).max(79)).length(2))
        .max(100),
      iterations: z.number().int().min(1).max(3),
      preserveBase: z.boolean(),
    })
    .strict(),
  z
    .object({
      method: z.literal('field'),
      elements: z
        .array(
          z
            .object({
              shape: z.enum(['ellipsoid', 'capsule']),
              center: organicPoint,
              end: organicPoint,
              radii: organicPoint,
              endRadius: z.number().min(0.1).max(100),
              subtract: z.boolean(),
            })
            .strict(),
        )
        .min(1)
        .max(24),
      blend: z.number().min(0.01).max(20),
      resolution: z.number().min(0.1).max(5),
    })
    .strict(),
]);
export type OrganicDefinition = z.infer<typeof organicDefinitionSchema>;
export const organicOperations = [
  z
    .object({
      type: z.literal('organic_form'),
      target: z.string().nullable(),
      name: z.string().min(1).max(80),
      definition: organicDefinitionSchema,
      position: organicPoint,
    })
    .strict(),
  z
    .object({
      type: z.literal('edit_control_points'),
      target: z.string(),
      changes: z
        .array(
          z
            .object({
              index: z.number().int().min(0).max(1000),
              point: organicPoint,
              weight: z.number().min(0.1).max(10).nullable(),
            })
            .strict(),
        )
        .min(1)
        .max(80),
    })
    .strict(),
  z
    .object({
      type: z.literal('inset_layout'),
      targets: z.array(z.string()).min(1).max(200),
      reference: z.string(),
      distance: z.number().min(-100).max(100),
      axes: z.enum(['x', 'z', 'xz']),
    })
    .strict(),
] as const;
