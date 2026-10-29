import { z } from 'zod';
export const componentRoles = [
  'element',
  'building',
  'room',
  'floor',
  'roof',
  'wall',
  'column',
  'window',
  'door',
  'panel',
  'furniture',
] as const;
export const componentSchema = z
  .object({
    role: z.enum(componentRoles),
    hostId: z.string().max(100).nullable(),
    level: z.string().max(80).nullable(),
    motion: z.enum(['none', 'hinge-left', 'hinge-right', 'slide-x', 'slide-z']),
    travel: z.number().min(0).max(20),
  })
  .strict();
export type ComponentInfo = z.infer<typeof componentSchema>;
const vector = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
  })
  .strict();
export const poseSchema = z
  .object({
    position: vector,
    target: vector,
    projection: z.enum(['perspective', 'orthographic']),
    zoom: z.number().min(0.001).max(10000),
    fov: z.number().min(1).max(170),
    orthoHeight: z.number().positive().max(100000).optional(),
  })
  .strict();
export type ViewPose = z.infer<typeof poseSchema>;
export const sectionSchema = z
  .object({
    enabled: z.boolean(),
    planeVisible: z.boolean().optional(),
    axis: z.enum(['x', 'y', 'z']),
    position: z.number().min(-2000).max(2000),
    flip: z.boolean(),
  })
  .strict();
export const savedViewSchema = z
  .object({
    name: z.string().min(1).max(80),
    pose: poseSchema.nullable(),
    targets: z.array(z.string().max(100)).max(200),
    section: sectionSchema.nullable(),
  })
  .strict();
export type SavedView = z.infer<typeof savedViewSchema>;
export const explorationSchema = z
  .object({
    mode: z.enum(['assembled', 'exploded', 'roof', 'open']),
    amount: z.number().min(0).max(1),
    targets: z.array(z.string().max(100)).max(200),
  })
  .strict();
export type Exploration = z.infer<typeof explorationSchema>;
export const assembled: Exploration = {
  mode: 'assembled',
  amount: 0,
  targets: [],
};
export const designOperations = [
  z
    .object({
      type: z.literal('component'),
      targets: z.array(z.string().min(1).max(100)).min(1).max(200),
      settings: componentSchema,
    })
    .strict(),
  z.object({ type: z.literal('explore'), ...explorationSchema.shape }).strict(),
  z
    .object({
      type: z.literal('alternative'),
      action: z.enum(['save', 'restore', 'delete']),
      name: z.string().min(1).max(80),
    })
    .strict(),
  z
    .object({
      type: z.literal('save_view'),
      name: z.string().min(1).max(80),
      targets: z.array(z.string().max(100)).max(200),
      cutaway: z.boolean(),
    })
    .strict(),
  z
    .object({ type: z.literal('show_view'), name: z.string().min(1).max(80) })
    .strict(),
  z.object({ type: z.literal('room_views') }).strict(),
  z
    .object({
      type: z.literal('furnish'),
      room: z.string().min(1).max(100),
      layout: z.enum(['meeting', 'classroom', 'lounge']),
      clearance: z.number().min(0.6).max(3),
    })
    .strict(),
] as const;
