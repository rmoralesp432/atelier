import { z } from 'zod';
import { MAX_SCENE_OBJECTS } from '../limits';

const ref = z.number().int().min(0).max(63);
const finite = z.number().finite().min(-1e12).max(1e12);
const unit = z.enum(['scalar', 'm', 'cm', 'mm', 'deg', 'rad']);

/** A finite data-flow calculation, never executable code. References point only
 * to earlier nodes. Original measurements cannot read the candidate scene. */
export const calculationSchema = z
  .object({
    frame: z.literal('world_xyz_y_up'),
    nodes: z
      .array(
        z.union([
          z
            .object({
              kind: z.literal('quantity'),
              value: finite,
              unit,
              source: z.enum(['request', 'history']),
              evidence: z.string().min(1).max(400),
            })
            .strict(),
          z.object({ kind: z.literal('constant'), value: finite }).strict(),
          z
            .object({
              kind: z.literal('original'),
              objectId: z.string().min(1).max(100),
              metric: z.enum([
                'x',
                'y',
                'z',
                'top',
                'width',
                'height',
                'depth',
                'volume',
                'rotation_y',
              ]),
            })
            .strict(),
          z
            .object({
              kind: z.literal('operation'),
              op: z.enum([
                'add',
                'subtract',
                'multiply',
                'divide',
                'negate',
                'sin',
                'cos',
                'range',
                'concat',
              ]),
              args: z.array(ref).min(1).max(8),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(64),
    output: z.union([
      z.object({ kind: z.literal('value'), node: ref }).strict(),
      z.object({ kind: z.literal('points'), x: ref, y: ref, z: ref }).strict(),
    ]),
  })
  .strict();
export type Calculation = z.infer<typeof calculationSchema>;
export const calculationTraceSchema = z
  .object({
    definition: calculationSchema,
    sources: z
      .array(
        z
          .object({
            node: ref,
            unit: z.string().max(40),
            values: z.array(finite).max(MAX_SCENE_OBJECTS),
          })
          .strict(),
      )
      .max(64),
    expectedUnit: z.string().max(40),
    expected: z.union([
      finite,
      z
        .array(z.object({ x: finite, y: finite, z: finite }).strict())
        .max(MAX_SCENE_OBJECTS),
    ]),
  })
  .strict();
export type CalculationTrace = z.infer<typeof calculationTraceSchema>;
