import { MAX_SCENE_OBJECTS } from '../limits';
import { z } from 'zod';

const ref = z.string().min(1).max(100);
const size = z.number().min(0.005).max(500);
const coordinate = z.number().min(-1000).max(1000);
const vector = z
  .object({ x: coordinate, y: coordinate, z: coordinate })
  .strict();
const factor = z.number().min(0.05).max(20);
const anchor = z
  .object({
    x: z.number().min(-0.5).max(0.5),
    y: z.number().min(0).max(1),
    z: z.number().min(-0.5).max(0.5),
  })
  .strict();
export const profileShape = z.enum([
  'rectangle',
  'ellipse',
  'i_section',
  'polygon',
]);
export const profileSolid = z
  .object({
    type: z.literal('profile_solid'),
    targets: z.array(ref).max(MAX_SCENE_OBJECTS),
    name: z.string().min(1).max(80),
    position: vector,
    dimensions: z
      .object({ width: size, depth: size, height: size })
      .strict()
      .nullable(),
    axis: z.enum(['x', 'y', 'z']),
    shape: profileShape,
    web: size.nullable(),
    flange: size.nullable(),
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
      .max(64)
      .nullable(),
  })
  .strict();
export const volumetricOperations = [
  profileSolid,
  z
    .object({
      type: z.literal('glaze_opening'),
      target: ref,
      frameWidth: size,
      frameDepth: size,
      paneThickness: size,
    })
    .strict(),
  z
    .object({
      type: z.literal('verify_relation'),
      targets: z.array(ref).length(2),
      relation: z.enum(['disjoint', 'intersects', 'contained']),
      tolerance: z.number().min(0).max(0.1),
    })
    .strict(),
  z
    .object({
      type: z.literal('revolve'),
      target: ref.nullable(),
      name: z.string().min(1).max(80),
      profile: z
        .array(
          z
            .object({
              radius: z.number().min(0).max(250),
              height: z.number().min(-500).max(500),
            })
            .strict(),
        )
        .min(3)
        .max(64),
      degrees: z.number().min(1).max(360),
      position: vector,
    })
    .strict(),
  z
    .object({
      type: z.literal('opening_shape'),
      target: ref,
      shape: z.enum(['rectangle', 'ellipse']),
    })
    .strict(),
  z
    .object({
      type: z.literal('split_levels'),
      target: ref,
      levels: z
        .array(
          z
            .object({
              name: z.string().min(1).max(50),
              height: z.number().min(0.1).max(500),
              offsetX: coordinate,
              offsetZ: coordinate,
              rotation: z.number().min(-360).max(360),
              scaleX: factor,
              scaleZ: factor,
            })
            .strict(),
        )
        .min(2)
        .max(30),
    })
    .strict(),
  z
    .object({
      type: z.literal('progressive_array'),
      target: ref,
      count: z.number().int().min(2).max(60),
      step: vector,
      rotationStep: z.number().min(-360).max(360),
      scaleStep: z.object({ x: factor, y: factor, z: factor }).strict(),
      anchor,
    })
    .strict(),
  z
    .object({
      type: z.literal('constrained_resize'),
      targets: z.array(ref).min(1).max(MAX_SCENE_OBJECTS),
      axis: z.enum(['width', 'height', 'depth']),
      value: size,
      preserveVolume: z.boolean(),
      anchor,
    })
    .strict(),
  z
    .object({
      type: z.literal('bridge'),
      targets: z.array(ref).length(2),
      name: z.string().min(1).max(80),
      elevation: z
        .number()
        .min(0)
        .max(1000)
        .describe(
          'BASE elevation of the bridge deck, not its walking surface. If the top must meet level L, set elevation=L-thickness.',
        ),
      width: size,
      thickness: size,
      embed: z.number().min(0.01).max(5),
    })
    .strict(),
] as const;
export type ProfileSolid = z.infer<typeof profileSolid>;
export type VolumetricOperation = z.infer<
  (typeof volumetricOperations)[number]
>;
