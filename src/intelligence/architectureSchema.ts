import { MAX_SCENE_OBJECTS } from '../limits';
import { z } from 'zod';
import { componentRoles } from '../design/schema';

const coordinate = z.number().min(-1000).max(1000);
const vector = z
  .object({ x: coordinate, y: coordinate, z: coordinate })
  .strict();
const size = z.number().min(0.005).max(500);
export const assemblySchema = z
  .object({
    type: z.literal('assembly'),
    name: z.string().min(1).max(80),
    origin: vector,
    rotation: z.number().min(-360).max(360),
    elements: z
      .array(
        z
          .object({
            key: z.string().min(1).max(60),
            name: z.string().min(1).max(70),
            shape: z.enum(['box', 'cylinder', 'sphere']),
            dimensions: z
              .object({ width: size, depth: size, height: size })
              .strict(),
            position: vector.describe(
              'Local BASE center, not geometric center. For a slab with top elevation T and thickness H, use y=T-H. Do not subtract half the thickness. World base is origin.y + position.y and must be >= 0. Raise the assembly origin if a local element base is negative.',
            ),
            rotation: z.number().min(-360).max(360),
            role: z.enum(componentRoles),
            level: z.string().max(80).nullable(),
            material: z.enum(['solid', 'glass', 'frame']),
            color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
            host: z.string().max(100).nullable(),
            repeat: z
              .object({
                x: z.number().int().min(1).max(50),
                y: z.number().int().min(1).max(30),
                z: z.number().int().min(1).max(50),
                step: vector,
              })
              .strict()
              .nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(80),
  })
  .strict();
export type Assembly = z.infer<typeof assemblySchema>;
export const architecturalOperations = [
  assemblySchema,
  z
    .object({
      type: z.literal('select_query'),
      scope: z.array(z.string().max(100)).max(MAX_SCENE_OBJECTS).nullable(),
      role: z.enum(componentRoles).nullable(),
      level: z.string().max(80).nullable(),
      material: z.enum(['solid', 'glass', 'frame']).nullable(),
      nameContains: z.string().min(1).max(80).nullable(),
      visible: z.boolean().nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('material'),
      targets: z
        .array(z.string().min(1).max(100))
        .min(1)
        .max(MAX_SCENE_OBJECTS),
      material: z.enum(['solid', 'glass', 'frame']),
    })
    .strict(),
  z
    .object({
      type: z.literal('verify'),
      targets: z
        .array(z.string().min(1).max(100))
        .min(1)
        .max(MAX_SCENE_OBJECTS),
      metric: z
        .enum(['count', 'width', 'depth', 'height', 'base', 'top', 'volume'])
        .describe(
          'count measures the number of resolved objects. Every other metric is checked on EACH object separately, never the combined group bounds. For group extents, read scene.groups bounds or measure properties.',
        ),
      comparison: z.enum(['equal', 'at_least', 'at_most']),
      value: z.number().finite(),
      tolerance: z.number().min(0).max(0.1),
    })
    .strict(),
  z
    .object({
      type: z.literal('design_note'),
      topic: z.string().min(1).max(80),
      text: z.string().min(1).max(1500),
      source: z.enum(['user', 'drawing', 'assumption']),
    })
    .strict(),
] as const;
