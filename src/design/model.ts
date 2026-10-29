import { explosionOffsets } from './explosion';
import { z } from 'zod';
import type { Volume, ObjectGroup, Project } from '../model';
import {
  savedViewSchema,
  type SavedView,
  type ComponentInfo,
  type Exploration,
} from './schema';
export type DesignOption = {
  name: string;
  volumes: Volume[];
  groups: ObjectGroup[];
};
export type DesignLibrary = { views: SavedView[]; options: DesignOption[] };
export function validateDesign(
  value: unknown,
  validate: (v: Volume) => void,
): DesignLibrary {
  const data = z
    .object({
      views: z.array(savedViewSchema).max(30),
      options: z
        .array(
          z
            .object({
              name: z.string().min(1).max(80),
              volumes: z.array(z.any()).max(200),
              groups: z
                .array(
                  z
                    .object({
                      id: z.string().min(1).max(100),
                      name: z.string().min(1).max(80),
                      visible: z.boolean(),
                      locked: z.boolean(),
                    })
                    .strict(),
                )
                .max(50),
            })
            .strict(),
        )
        .max(6),
    })
    .strict()
    .parse(value) as DesignLibrary;
  if (
    new Set(data.views.map((v) => v.name)).size !== data.views.length ||
    new Set(data.options.map((v) => v.name)).size !== data.options.length
  )
    throw new Error('View and alternative names must be unique.');
  for (const option of data.options) {
    const ids = new Set<string>();
    for (const v of option.volumes) {
      validate(v);
      if (ids.has(v.id)) throw new Error('Duplicate alternative element.');
      ids.add(v.id);
      if (v.groupId && !option.groups.some((g) => g.id === v.groupId))
        throw new Error('Missing alternative group.');
    }
  }
  return data;
}
export function componentInfo(v: Volume): ComponentInfo {
  // Name-based suggestions help old projects; never fabricate hinge/room metadata.
  const role =
    v.component?.role ??
    (/roof/i.test(v.name)
      ? 'roof'
      : /slab|floor|terrace/i.test(v.name)
        ? 'floor'
        : /column/i.test(v.name)
          ? 'column'
          : v.material === 'glass'
            ? 'window'
            : 'element');
  return (
    v.component ?? {
      role,
      hostId: null,
      level: null,
      motion: 'none',
      travel: 1,
    }
  );
}
export function explorationTransform(
  v: Volume,
  project: Project,
  state: Exploration,
  ancestors = new Set<string>(),
  offsets?: Map<string, import('../model').Vec3>,
) {
  const position = { ...v.position };
  let rotation = v.rotation;
  if (state.mode === 'assembled' || !state.amount || ancestors.has(v.id))
    return { position, rotation };
  const info = componentInfo(v),
    amount =
      !state.targets.length || state.targets.includes(v.id) ? state.amount : 0;
  ancestors.add(v.id);
  if (state.mode === 'roof' && info.role === 'roof')
    position.y += amount * Math.max(3, v.dimensions.height * 2);
  if (state.mode === 'exploded') {
    const offset = (offsets ?? explosionOffsets(project, state)).get(v.id);
    if (offset) {
      position.x += offset.x;
      position.y += offset.y;
      position.z += offset.z;
    }
  }
  if (state.mode === 'open') {
    const yaw = (v.rotation * Math.PI) / 180;
    if (info.motion.startsWith('hinge')) {
      const pivot =
        ((info.motion === 'hinge-left' ? -1 : 1) * v.dimensions.width) / 2;
      const angle =
        ((info.motion === 'hinge-left' ? -1 : 1) * amount * Math.PI) / 2;
      const dx = pivot - Math.cos(angle) * pivot,
        dz = Math.sin(angle) * pivot;
      position.x += dx * Math.cos(yaw) + dz * Math.sin(yaw);
      position.z += -dx * Math.sin(yaw) + dz * Math.cos(yaw);
      rotation += (angle * 180) / Math.PI;
    } else if (info.motion === 'slide-x' || info.motion === 'slide-z') {
      const x = info.motion === 'slide-x' ? info.travel * amount : 0,
        z = info.motion === 'slide-z' ? info.travel * amount : 0;
      position.x += x * Math.cos(yaw) + z * Math.sin(yaw);
      position.z += -x * Math.sin(yaw) + z * Math.cos(yaw);
    }
  }
  // Handles and other hosted parts follow the parent's presentation without
  // baking an animation into their modeling coordinates.
  if ((state.mode === 'open' || state.mode === 'roof') && info.hostId) {
    const parent = project.volumes.find((o) => o.id === info.hostId);
    if (parent) {
      const moved = explorationTransform(parent, project, state, ancestors);
      const delta = ((moved.rotation - parent.rotation) * Math.PI) / 180;
      const x = position.x - parent.position.x,
        z = position.z - parent.position.z;
      position.x = moved.position.x + x * Math.cos(delta) + z * Math.sin(delta);
      position.z = moved.position.z - x * Math.sin(delta) + z * Math.cos(delta);
      position.y += moved.position.y - parent.position.y;
      rotation += moved.rotation - parent.rotation;
    }
  }
  return { position, rotation };
}

/** Hosted elements keep their own sizes while their anchor locations follow a
 * host's move, yaw and envelope resize. Explicit child edits take precedence. */
export function propagateHosted(before: Volume[], after: Volume[]): Volume[] {
  const old = new Map(before.map((v) => [v.id, v]));
  const result = new Map(after.map((v) => [v.id, v]));
  const done = new Set<string>(),
    visiting = new Set<string>();
  const visit = (id: string): Volume | undefined => {
    const v = result.get(id);
    if (!v || done.has(id)) return v;
    if (visiting.has(id))
      throw new Error('Component relationships cannot contain cycles.');
    visiting.add(id);
    const previous = old.get(id),
      hostId = v.component?.hostId,
      host = hostId ? visit(hostId) : undefined,
      oldHost = hostId ? old.get(hostId) : undefined;
    if (
      previous &&
      host &&
      oldHost &&
      v.position.x === previous.position.x &&
      v.position.y === previous.position.y &&
      v.position.z === previous.position.z &&
      v.rotation === previous.rotation
    ) {
      const changed =
        JSON.stringify([host.position, host.rotation, host.dimensions]) !==
        JSON.stringify([
          oldHost.position,
          oldHost.rotation,
          oldHost.dimensions,
        ]);
      if (changed) {
        const a = (oldHost.rotation * Math.PI) / 180,
          b = (host.rotation * Math.PI) / 180;
        const dx = previous.position.x - oldHost.position.x,
          dz = previous.position.z - oldHost.position.z;
        const x =
            ((dx * Math.cos(a) - dz * Math.sin(a)) * host.dimensions.width) /
            oldHost.dimensions.width,
          z =
            ((dx * Math.sin(a) + dz * Math.cos(a)) * host.dimensions.depth) /
            oldHost.dimensions.depth;
        result.set(id, {
          ...v,
          position: {
            x: host.position.x + x * Math.cos(b) + z * Math.sin(b),
            z: host.position.z - x * Math.sin(b) + z * Math.cos(b),
            y:
              host.position.y +
              ((previous.position.y - oldHost.position.y) *
                host.dimensions.height) /
                oldHost.dimensions.height,
          },
          rotation: previous.rotation + host.rotation - oldHost.rotation,
        });
      }
    }
    visiting.delete(id);
    done.add(id);
    return result.get(id);
  };
  after.forEach((v) => visit(v.id));
  return after.map((v) => result.get(v.id)!);
}
