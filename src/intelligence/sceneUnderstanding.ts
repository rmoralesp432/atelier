import { MAX_SCENE_OBJECTS } from '../limits';
import { z } from 'zod';
import type { Project, Volume } from '../model';
import { isVisible } from '../model';
import { componentRoles } from '../design/schema';
import {
  center,
  envelopeBounds,
  groupBounds,
  isFlat,
} from '../geometry/spatial';
import { semanticShape } from './geometryFacts';
const vec = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
  })
  .strict();
const bounds = z.object({ min: vec, max: vec }).strict();
export const understandingSchema = z
  .object({
    inventory: z
      .array(
        z
          .object({
            groupId: z.string().nullable(),
            name: z.string().max(80),
            bounds,
            visible: z.number().int(),
            roles: z
              .array(
                z
                  .object({
                    role: z.enum(componentRoles),
                    ids: z.array(z.string()).max(MAX_SCENE_OBJECTS),
                  })
                  .strict(),
              )
              .max(20),
            levels: z
              .array(
                z
                  .object({
                    name: z.string().max(80),
                    base: z.number(),
                    top: z.number(),
                    ids: z.array(z.string()).max(MAX_SCENE_OBJECTS),
                  })
                  .strict(),
              )
              .max(MAX_SCENE_OBJECTS),
            shapes: z
              .array(
                z
                  .object({
                    shape: z.string().max(40),
                    count: z.number().int(),
                  })
                  .strict(),
              )
              .max(30),
          })
          .strict(),
      )
      .max(51),
    focus: z
      .object({
        ids: z.array(z.string()).max(MAX_SCENE_OBJECTS),
        bounds: bounds.nullable(),
        nearby: z
          .array(
            z
              .object({
                id: z.string(),
                name: z.string().max(80),
                envelopeGap: z.number(),
                relativeCenter: vec,
              })
              .strict(),
          )
          .max(8),
      })
      .strict(),
  })
  .strict();

/** Summarized facts reduce counting/axis guesses; all values come from the
 * project, never inferred building templates or imported triangle semantics. */
export function sceneUnderstanding(project: Project, focusIds: string[]) {
  const groups = new Map<string | null, Volume[]>();
  for (const v of project.volumes) {
    const key = v.groupId ?? null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(v);
  }
  const inventory = [...groups].map(([groupId, vs]) => {
    const roles = new Map<(typeof componentRoles)[number], string[]>(),
      levels = new Map<string, Volume[]>(),
      shapes = new Map<string, number>();
    for (const v of vs) {
      const role = v.component?.role ?? 'element';
      if (!roles.has(role)) roles.set(role, []);
      roles.get(role)!.push(v.id);
      if (v.component?.level) {
        if (!levels.has(v.component.level)) levels.set(v.component.level, []);
        levels.get(v.component.level)!.push(v);
      }
      const shape = semanticShape(v);
      shapes.set(shape, (shapes.get(shape) ?? 0) + 1);
    }
    return {
      groupId,
      name: project.groups?.find((g) => g.id === groupId)?.name ?? 'Ungrouped',
      bounds: groupBounds(vs),
      visible: vs.filter((v) => isVisible(v, project)).length,
      roles: [...roles].map(([role, ids]) => ({ role, ids })),
      levels: [...levels]
        .map(([name, members]) => ({
          name,
          base: Math.min(...members.map((v) => v.position.y)),
          top: Math.max(
            ...members.map(
              (v) => v.position.y + (isFlat(v) ? 0 : v.dimensions.height),
            ),
          ),
          ids: members.map((v) => v.id),
        }))
        .sort((a, b) => a.base - b.base),
      shapes: [...shapes].map(([shape, count]) => ({ shape, count })),
    };
  });
  const selected = project.volumes.filter((v) => focusIds.includes(v.id)),
    b = selected.length ? groupBounds(selected) : null;
  const c = b
    ? {
        x: (b.min.x + b.max.x) / 2,
        y: (b.min.y + b.max.y) / 2,
        z: (b.min.z + b.max.z) / 2,
      }
    : null;
  const nearby =
    b && c
      ? project.volumes
          .filter((v) => !focusIds.includes(v.id) && isVisible(v, project))
          .map((v) => {
            const other = envelopeBounds(v),
              p = center(v);
            const gap = (a: 'x' | 'y' | 'z') =>
              Math.max(0, other.min[a] - b.max[a], b.min[a] - other.max[a]);
            return {
              id: v.id,
              name: v.name,
              envelopeGap: Math.hypot(gap('x'), gap('y'), gap('z')),
              relativeCenter: { x: p.x - c.x, y: p.y - c.y, z: p.z - c.z },
            };
          })
          .sort(
            (a, b) =>
              a.envelopeGap - b.envelopeGap || a.name.localeCompare(b.name),
          )
          .slice(0, 8)
      : [];
  return {
    inventory,
    focus: { ids: selected.map((v) => v.id), bounds: b, nearby },
  };
}
