import { z } from 'zod';

const ids = z.array(z.string().min(1).max(100)).min(1).max(20);
const dimension = z.number().min(0.1).max(500);
const direction = z.enum([
  'left',
  'right',
  'forward',
  'back',
  'north',
  'south',
  'east',
  'west',
  'up',
  'down',
]);
const distance = z.number().min(0.01).max(1000).nullable();
const point = z
  .object({
    x: z.number().min(-1000).max(1000),
    y: z.number().min(0).max(1000),
    z: z.number().min(-1000).max(1000),
  })
  .strict();
export const operationSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('color'),
      targets: ids,
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    })
    .strict(),
  z
    .object({
      type: z.literal('person'),
      height: z.number().min(0.5).max(2.5),
      position: point.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('scale'),
      targets: ids,
      factor: z.number().min(0.01).max(100),
      pivot: point.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('stretch'),
      targets: ids,
      axis: z.enum(['width', 'depth', 'height']),
      side: z.enum(['min', 'max']),
      distance: z.number().min(-500).max(500),
    })
    .strict(),
  z
    .object({
      type: z.literal('mirror'),
      targets: ids,
      axis: z.enum(['x', 'z']),
      coordinate: z.number().min(-1000).max(1000),
      copy: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal('array_grid'),
      targets: ids,
      rows: z.number().int().min(1).max(20),
      columns: z.number().int().min(1).max(20),
      spacingX: z.number().min(0.1).max(1000),
      spacingZ: z.number().min(0.1).max(1000),
    })
    .strict(),
  z
    .object({
      type: z.literal('array_polar'),
      targets: ids,
      count: z.number().int().min(2).max(20),
      center: point,
      angle: z.number().min(-360).max(360),
      rotate: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal('measure'),
      targets: ids,
      metric: z.enum(['properties', 'relationship']),
    })
    .strict(),
  z
    .object({
      type: z.literal('rename'),
      target: z.string(),
      name: z.string().min(1).max(80),
    })
    .strict(),
  z
    .object({
      type: z.literal('rotate_group'),
      targets: ids,
      degrees: z.number().min(-3600).max(3600),
      pivot: z.string().nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('align_edges'),
      targets: ids,
      axis: z.enum(['x', 'y', 'z']),
      edge: z.enum(['min', 'center', 'max']),
    })
    .strict(),
  z
    .object({
      type: z.literal('footprint'),
      name: z.string().min(1).max(80),
      points: z
        .array(
          z
            .object({
              x: z.number().min(-500).max(500),
              z: z.number().min(-500).max(500),
            })
            .strict(),
        )
        .min(3)
        .max(64),
      height: dimension,
      extruded: z.boolean(),
      x: z.number().min(-1000).max(1000),
      y: z.number().min(0).max(1000),
      z: z.number().min(-1000).max(1000),
      rotation: z.number().min(-3600).max(3600),
    })
    .strict(),
  z
    .object({
      type: z.literal('create_at'),
      name: z.string().min(1).max(80),
      shape: z.enum(['box', 'cylinder', 'sphere', 'rectangle', 'circle']),
      width: dimension,
      depth: dimension,
      height: dimension,
      x: z.number().min(-1000).max(1000),
      y: z.number().min(0).max(1000),
      z: z.number().min(-1000).max(1000),
      rotation: z.number().min(-3600).max(3600),
    })
    .strict(),
  z
    .object({
      type: z.literal('position'),
      targets: ids,
      x: z.number().min(-1000).max(1000).nullable(),
      y: z.number().min(0).max(1000).nullable(),
      z: z.number().min(-1000).max(1000).nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('offset_base'),
      target: z.string(),
      offset: z.number().min(-100).max(100),
      height: dimension,
      name: z.string().min(1).max(80),
    })
    .strict(),
  z
    .object({
      type: z.literal('center_on'),
      target: z.string(),
      reference: z.string(),
      vertical: z.enum(['base', 'center', 'above', 'below']),
      gap: z.number().min(0).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal('building'),
      target: z.string(),
      floors: z.number().int().min(1).max(30),
      slabThickness: z.number().min(0.1).max(1),
      facade: z.boolean(),
      panelWidth: z.number().min(0.5).max(10),
      mullionWidth: z.number().min(0.03).max(0.3),
    })
    .strict(),
  z
    .object({
      type: z.literal('create'),
      shape: z.enum(['box', 'cylinder', 'sphere', 'rectangle', 'circle']),
      width: dimension,
      depth: dimension,
      height: dimension,
      count: z.number().int().min(1).max(20),
    })
    .strict(),
  z
    .object({ type: z.literal('move'), targets: ids, direction, distance })
    .strict(),
  z
    .object({
      type: z.literal('resize'),
      targets: ids,
      axis: z.enum(['width', 'depth', 'height']),
      mode: z.enum(['set', 'add', 'scale']),
      value: z.number().min(-500).max(500).nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('rotate'),
      targets: ids,
      degrees: z.number().min(-3600).max(3600),
      relative: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal('duplicate'),
      targets: ids,
      count: z.number().int().min(1).max(20),
      direction,
      distance,
    })
    .strict(),
  z
    .object({
      type: z.literal('spread'),
      targets: ids,
      direction,
      gap: z.number().min(0).max(500).nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('align'),
      targets: ids,
      axis: z.enum(['x', 'y', 'z']),
    })
    .strict(),
  z
    .object({
      type: z.literal('place'),
      target: z.string(),
      reference: z.string(),
      relation: z.enum(['next_to', 'overlap']),
      direction,
      gap: z.number().min(0).max(100).nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('boolean'),
      operation: z.enum(['union', 'subtract', 'intersect']),
      targets: ids,
    })
    .strict(),
  z
    .object({
      type: z.literal('extrude'),
      target: z.string(),
      height: dimension,
    })
    .strict(),
  z
    .object({
      type: z.literal('opening'),
      target: z.string(),
      width: dimension,
      height: dimension,
      sill: z.number().min(0).max(500),
      offset: z.number().min(-500).max(500),
    })
    .strict(),
  z
    .object({
      type: z.literal('edit_opening'),
      target: z.string(),
      width: dimension.nullable(),
      height: dimension.nullable(),
    })
    .strict(),
  z.object({ type: z.literal('delete'), targets: ids }).strict(),
  z.object({ type: z.literal('select'), targets: ids }).strict(),
  z
    .object({ type: z.literal('undo'), count: z.number().int().min(1).max(20) })
    .strict(),
  z
    .object({ type: z.literal('redo'), count: z.number().int().min(1).max(20) })
    .strict(),
]);
export const planSchema = z
  .object({
    intent: z.enum(['apply', 'clarify', 'confirm', 'cancel']),
    message: z.string().min(1).max(2000),
    operations: z.array(operationSchema).max(12),
  })
  .strict();
export type Plan = z.infer<typeof planSchema>;
export type Operation = z.infer<typeof operationSchema>;
export const planJsonSchema = z.toJSONSchema(planSchema, {
  override: ({ zodSchema, jsonSchema }) => {
    // Structured Outputs accepts anyOf, but rejects Zod's discriminated-union
    // oneOf. Each operation has a distinct literal `type`, so its branches
    // remain mutually exclusive. Keep the original Zod validator unchanged.
    if (zodSchema === operationSchema && jsonSchema.oneOf) {
      jsonSchema.anyOf = jsonSchema.oneOf;
      delete jsonSchema.oneOf;
    }
  },
});
export function parsePlan(raw: unknown): Plan {
  const plan = planSchema.parse(raw);
  if (plan.intent !== 'apply' && plan.operations.length)
    throw new Error(
      'A clarification or review response cannot contain new operations.',
    );
  if (plan.intent === 'apply' && !plan.operations.length)
    throw new Error('An edit must contain an operation.');
  return plan;
}
export const needsConfirmation = (plan: Plan) =>
  plan.operations.some(
    (op) =>
      op.type === 'delete' ||
      op.type === 'boolean' ||
      op.type === 'opening' ||
      op.type === 'building',
  );
