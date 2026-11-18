import { z } from 'zod';
import { MAX_SCENE_OBJECTS } from '../limits';
import { componentInfo, propagateHosted } from '../design/model';
import { patchedVolume, round, type Volume } from '../model';

const offset = z.number().min(-1000).max(1000);
const predicate = z.union([
  z
    .object({
      property: z.enum(['role', 'level', 'material']),
      equals: z.string().min(1).max(80),
    })
    .strict(),
  z
    .object({
      property: z.enum(['x', 'y', 'z', 'top', 'width', 'height', 'depth']),
      min: offset.nullable(),
      max: offset.nullable(),
    })
    .strict(),
]);
export const componentEditOperation = z
  .object({
    type: z.literal('edit_components'),
    edits: z
      .array(
        z
          .object({
            targets: z
              .array(z.string().min(1).max(100))
              .min(1)
              .max(MAX_SCENE_OBJECTS),
            where: z
              .array(predicate)
              .max(8)
              .describe(
                'AND filters within targets. Empty means all targets. Numeric bounds are inclusive, in world metres (dimensions are local); y is base elevation, top is base + height. Read actual scene values.',
              ),
            translation: z
              .object({ x: offset, y: offset, z: offset })
              .strict()
              .nullable(),
            resize: z
              .object({
                axis: z.enum(['width', 'depth', 'height']),
                mode: z.enum(['set', 'add', 'scale']),
                value: z.number().min(-500).max(500),
                anchor: z
                  .number()
                  .min(0)
                  .max(1)
                  .describe(
                    'Fixed local face: 0 = minimum (base for height), 0.5 = center, 1 = maximum. Translation follows resizing.',
                  ),
              })
              .strict()
              .nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(32),
  })
  .strict();

export type ComponentEdit = z.infer<typeof componentEditOperation>;

/** One bounded pass over an existing assembly. Rules share transforms, not
 * per-object patches. All references resolve against the SAME starting scene;
 * explicit children are never transformed a second time by host propagation. */
export function editComponents(
  before: Volume[],
  edits: ComponentEdit['edits'],
  resolve: (refs: string[]) => string[],
): { volumes: Volume[]; ids: string[] } {
  const rules = new Map<string, ComponentEdit['edits'][number]>();
  const byId = new Map(before.map((v) => [v.id, v]));
  for (const rule of edits) {
    if (!rule.translation && !rule.resize)
      throw new Error('A component edit needs a translation or resize.');
    if (rule.resize && rule.resize.mode !== 'add' && rule.resize.value <= 0)
      throw new Error('Set dimensions and scale factors must be positive.');
    for (const condition of rule.where)
      if (
        'min' in condition &&
        condition.min !== null &&
        condition.max !== null &&
        condition.min > condition.max
      )
        throw new Error('Component filter minimum exceeds its maximum.');
    const matches = resolve(rule.targets).filter((id) => {
      const v = byId.get(id);
      if (!v)
        throw new Error(
          'A coordinated edit target is missing from the current scene.',
        );
      return rule.where.every((condition) => {
        if ('equals' in condition) {
          const value =
            condition.property === 'role'
              ? componentInfo(v).role
              : condition.property === 'level'
                ? v.component?.level
                : (v.material ?? 'solid');
          return value === condition.equals;
        }
        const key = condition.property;
        const value =
          key === 'top'
            ? v.position.y + v.dimensions.height
            : key === 'x' || key === 'y' || key === 'z'
              ? v.position[key]
              : v.dimensions[key];
        return (
          (condition.min === null || value >= condition.min - 1e-8) &&
          (condition.max === null || value <= condition.max + 1e-8)
        );
      });
    });
    if (!matches.length)
      throw new Error(
        'No components match an edit set. Inspect the supplied scene and revise its scope or filters; nothing was applied.',
      );
    for (const id of matches) {
      if (rules.has(id))
        throw new Error(
          "Component edit sets overlap. Combine each component's resize and translation in one rule; nothing was applied.",
        );
      rules.set(id, rule);
    }
  }
  if (rules.size > MAX_SCENE_OBJECTS)
    throw new Error(
      `A coordinated edit supports at most ${MAX_SCENE_OBJECTS} existing components.`,
    );
  const after = before.map((v) => {
    const rule = rules.get(v.id);
    if (!rule) return v;
    const dimensions = { ...v.dimensions };
    const position = { ...v.position };
    if (rule.resize) {
      const { axis, mode, value, anchor } = rule.resize;
      const old = dimensions[axis];
      dimensions[axis] = round(
        mode === 'set' ? value : mode === 'add' ? old + value : old * value,
      );
      const delta = old - dimensions[axis];
      const x = axis === 'width' ? delta * (anchor - 0.5) : 0;
      const z = axis === 'depth' ? delta * (anchor - 0.5) : 0;
      const angle = (v.rotation * Math.PI) / 180;
      position.x += x * Math.cos(angle) + z * Math.sin(angle);
      position.z += -x * Math.sin(angle) + z * Math.cos(angle);
      if (axis === 'height') position.y += delta * anchor;
    }
    if (rule.translation)
      for (const axis of ['x', 'y', 'z'] as const)
        position[axis] += rule.translation[axis];
    // Keep unchanged coordinates exact, including rotated assemblies.
    for (const axis of ['x', 'y', 'z'] as const)
      if (position[axis] !== v.position[axis])
        position[axis] = round(position[axis]);
    return patchedVolume(v, {
      position,
      ...(rule.resize ? { dimensions } : {}),
    });
  });
  return {
    volumes: propagateHosted(before, after, new Set(rules.keys())),
    ids: [...rules.keys()],
  };
}
