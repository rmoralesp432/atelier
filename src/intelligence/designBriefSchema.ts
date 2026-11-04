import { z } from 'zod';
import { componentRoles } from '../design/schema';

const refs = z.array(z.string().min(1).max(100)).max(200);
export const designSelector = z
  .object({
    refs,
    role: z.enum(componentRoles).nullable(),
    level: z.string().max(80).nullable(),
    nameContains: z.string().min(1).max(80).nullable(),
  })
  .strict();
const identity = {
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(200),
};
export const designRequirement = z.union([
  z
    .object({
      ...identity,
      kind: z.literal('property'),
      selector: designSelector,
      property: z.enum([
        'material',
        'color',
        'role',
        'level',
        'visible',
        'hostId',
      ]),
      value: z.union([z.string().max(100), z.boolean(), z.null()]),
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal('layout'),
      selector: designSelector,
      origin: z
        .object({
          x: z.number().min(-1000).max(1000),
          y: z.number().min(0).max(1000),
          z: z.number().min(-1000).max(1000),
        })
        .strict(),
      counts: z
        .object({
          x: z.number().int().min(1).max(200),
          y: z.number().int().min(1).max(200),
          z: z.number().int().min(1).max(200),
        })
        .strict(),
      step: z
        .object({
          x: z.number().min(-1000).max(1000),
          y: z.number().min(-1000).max(1000),
          z: z.number().min(-1000).max(1000),
        })
        .strict(),
      rotation: z.number().min(-360).max(360),
      tolerance: z.number().min(0).max(0.1),
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal('measure'),
      selector: designSelector,
      metric: z.enum([
        'count',
        'width',
        'depth',
        'height',
        'base',
        'top',
        'volume',
      ]),
      aggregation: z.enum(['each', 'sum', 'min', 'max', 'envelope']),
      comparison: z.enum(['equal', 'at_least', 'at_most']),
      value: z.number().finite(),
      tolerance: z.number().min(0).max(0.1),
      relativeTolerance: z.number().min(0).max(0.02),
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal('shape'),
      selector: designSelector,
      shape: z.enum([
        'box',
        'cylinder',
        'sphere',
        'rectangle',
        'circle',
        'polygon',
        'extrusion',
        'i_section',
        'ellipse',
        'revolve',
        'sweep',
        'loft',
        'boolean',
        'hollow',
        'mesh',
      ]),
    })
    .strict(),
  z
    .object({
      ...identity,
      kind: z.literal('relation'),
      first: designSelector,
      second: designSelector,
      relation: z.enum(['disjoint', 'intersects', 'contained']),
      tolerance: z.number().min(0).max(0.1),
    })
    .strict(),
]);
export const designBriefSchema = z
  .object({
    objective: z.string().min(1).max(500),
    editable: refs,
    preserve: z
      .array(
        z
          .object({
            targets: refs.min(1),
            properties: z
              .array(
                z.enum([
                  'dimensions',
                  'position',
                  'rotation',
                  'geometry',
                  'name',
                  'component',
                  'material',
                  'color',
                  'groupId',
                  'visible',
                ]),
              )
              .min(1)
              .max(10),
          })
          .strict(),
      )
      .max(20),
    requirements: z.array(designRequirement).min(1).max(24),
    evidence: z
      .array(
        z
          .object({
            source: z.enum(['user', 'reference', 'assumption']),
            statement: z.string().min(1).max(400),
          })
          .strict(),
      )
      .max(12),
  })
  .strict();
export type DesignBrief = z.infer<typeof designBriefSchema>;
export type DesignRequirement = z.infer<typeof designRequirement>;
export type DesignSelector = z.infer<typeof designSelector>;
export const briefAssessmentSchema = z
  .object({
    id: z.string().max(60),
    label: z.string().max(200),
    met: z.boolean(),
    observed: z.string().max(800),
  })
  .strict();
export type BriefAssessment = z.infer<typeof briefAssessmentSchema>;
