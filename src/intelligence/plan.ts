import { designOperations } from '../design/schema';
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
export const workspaceActionSchema = z.enum([
  'draw_rectangle',
  'draw_circle',
  'draw_outline',
  'tool_pushpull',
  'tool_move',
  'tool_rotate',
  'tool_select',
  'solar_settings',
  'solar_on',
  'solar_off',
  'camera_settings',
  'walk_on',
  'walk_off',
  'layers_open',
  'layers_close',
  'map_on',
  'map_off',
  'map_toggle',
  'map_settings',
  'map_street',
  'map_satellite',
  'section_on',
  'section_off',
  'section_plane_on',
  'section_plane_off',
  'moodboard_open',
  'moodboard_close',
  'presentation_on',
  'presentation_off',
  'view_perspective',
  'view_orthographic',
  'view_top',
  'theme_day',
  'theme_night',
  'display_solid',
  'display_wireframe',
  'display_hidden_line',
  'frame_all',
  'inspector_open',
  'inspector_close',
  'objects_open',
  'objects_close',
]);
export type WorkspaceAction = z.infer<typeof workspaceActionSchema>;
const profilePoints = z
  .array(
    z
      .object({
        x: z.number().min(-500).max(500),
        z: z.number().min(-500).max(500),
      })
      .strict(),
  )
  .min(3)
  .max(64);
const formPosition = point;
export const operationSchema = z.discriminatedUnion('type', [
  ...designOperations,
  z
    .object({
      type: z.literal('walk_to'),
      placement: z.enum(['coordinates', 'between', 'center', 'in_front']),
      targets: z.array(z.string().min(1).max(100)).max(2),
      position: point.nullable(),
      lookAt: point.nullable(),
      eyeHeight: z.number().min(0.5).max(2.5).nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('trees'),
      target: z.string().nullable(),
      count: z.number().int().min(1).max(60).nullable(),
      height: z.number().min(1).max(30),
      crown: z.number().min(0.5).max(20),
      clearance: z.number().min(0.1).max(100),
      position: point.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('group_create'),
      name: z.string().min(1).max(80),
      targets: z.array(z.string().min(1).max(100)).max(200),
    })
    .strict(),
  z
    .object({
      type: z.literal('group_edit'),
      id: z.string(),
      name: z.string().min(1).max(80).nullable(),
      visible: z.boolean().nullable(),
      locked: z.boolean().nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('visibility'),
      targets: z.array(z.string().min(1).max(100)).min(1).max(200),
      visible: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal('show_all') }).strict(),
  z
    .object({
      type: z.literal('map_rotation'),
      degrees: z.number().min(-360).max(360),
      relative: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal('components'),
      target: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal('window_module'),
      target: z.string(),
      width: z.number().min(0.3).max(10).nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('building_display'),
      targets: ids,
      mode: z.enum(['architecture', 'volume']),
      floors: z.boolean(),
      glass: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal('attach'),
      target: z.string(),
      name: z.string().min(1).max(80),
      side: z.enum(['above', 'below', 'left', 'right', 'front', 'back']),
      width: dimension,
      depth: dimension,
      height: dimension,
      gap: z.number().min(0).max(500),
      offsetX: z.number().min(-500).max(500),
      offsetZ: z.number().min(-500).max(500),
      liftExisting: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal('sweep'),
      target: z.string().nullable(),
      name: z.string().min(1).max(80),
      profile: profilePoints,
      path: z
        .array(
          z
            .object({
              x: z.number().min(-500).max(500),
              y: z.number().min(-500).max(500),
              z: z.number().min(-500).max(500),
            })
            .strict(),
        )
        .min(2)
        .max(24),
      smooth: z.boolean(),
      position: formPosition,
    })
    .strict(),
  z
    .object({
      type: z.literal('loft'),
      target: z.string().nullable(),
      name: z.string().min(1).max(80),
      sections: z
        .array(
          z
            .object({ y: z.number().min(-500).max(500), points: profilePoints })
            .strict(),
        )
        .min(2)
        .max(16),
      position: formPosition,
    })
    .strict(),
  z
    .object({
      type: z.literal('orient'),
      targets: ids,
      x: z.number().min(-360).max(360),
      y: z.number().min(-360).max(360),
      z: z.number().min(-360).max(360),
    })
    .strict(),
  z
    .object({
      type: z.literal('hollow'),
      target: z.string(),
      thickness: z.number().min(0.05).max(100),
      openTop: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal('section'),
      enabled: z.boolean(),
      axis: z.enum(['x', 'y', 'z']),
      position: z.number().min(-1000).max(1000),
      flip: z.boolean(),
    })
    .strict(),

  z
    .object({ type: z.literal('workspace'), action: workspaceActionSchema })
    .strict(),
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
      (op.type === 'alternative' && op.action === 'restore') ||
      op.type === 'furnish' ||
      op.type === 'delete' ||
      op.type === 'boolean' ||
      op.type === 'opening' ||
      op.type === 'building' ||
      op.type === 'components' ||
      op.type === 'hollow' ||
      (op.type === 'attach' && op.liftExisting) ||
      ((op.type === 'sweep' || op.type === 'loft') && op.target !== null),
  );
