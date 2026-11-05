import type { Project, Vec3, Volume } from '../model';
import { isVisible } from '../model';
import { groupBounds } from '../geometry/spatial';
import { componentInfo } from './model';
import type { Exploration } from './schema';

/** A diagram of assemblies, not an arbitrary radial scatter. Environment stays put;
 * floors stack, facades pull outward, and hosted parts keep their relationships. */
export function explosionOffsets(project: Project, state: Exploration) {
  const result = new Map<string, Vec3>();
  if (state.mode !== 'exploded' || !state.amount) return result;
  const eligible = project.volumes.filter(
    (v) =>
      isVisible(v, project) &&
      !['tree', 'person'].includes(v.geometry?.kind ?? ''),
  );
  const byId = new Map(eligible.map((v) => [v.id, v]));
  const included = new Set(
    state.targets.length ? state.targets : eligible.map((v) => v.id),
  );
  // Descendants follow even when a handle appears before its door in file order.
  for (let pass = 0; pass < eligible.length; pass++) {
    let changed = false;
    for (const v of eligible)
      if (
        v.component?.hostId &&
        included.has(v.component.hostId) &&
        !included.has(v.id)
      ) {
        included.add(v.id);
        changed = true;
      }
    if (!changed) break;
  }
  const scope = eligible.filter((v) => included.has(v.id));
  if (!scope.length) return result;
  // Use a nearby floor as the architectural datum, not the scene's centroid:
  // furniture, terraces and a second building must not reverse a facade's exit.
  const slabs = eligible.filter((v) => componentInfo(v).role === 'floor');
  const b = groupBounds(scope);
  const defaultGap =
    state.gap ?? Math.max(1.5, Math.min(12, (b.max.y - b.min.y) * 0.65));
  const floors = [
    ...new Set(
      scope
        .filter((v) => componentInfo(v).role === 'floor')
        .map((v) => Math.round(v.position.y * 10) / 10),
    ),
  ].sort((a, b) => a - b);
  const anchor = (v: Volume) => {
    const candidates = slabs.filter((s) => s.groupId === v.groupId);
    const pool = candidates.length ? candidates : slabs;
    const ranked = pool
      .map((s) => {
        const a = (s.rotation * Math.PI) / 180;
        const dx = v.position.x - s.position.x,
          dz = v.position.z - s.position.z;
        const x = dx * Math.cos(a) - dz * Math.sin(a);
        const z = dx * Math.sin(a) + dz * Math.cos(a);
        const outside = Math.hypot(
          Math.max(0, Math.abs(x) - s.dimensions.width / 2),
          Math.max(0, Math.abs(z) - s.dimensions.depth / 2),
        );
        return {
          s,
          score: outside * 100 + Math.abs(v.position.y - s.position.y),
        };
      })
      .sort((a, b) => a.score - b.score);
    return (
      ranked[0]?.s ?? {
        position: {
          x: (b.min.x + b.max.x) / 2,
          y: b.min.y,
          z: (b.min.z + b.max.z) / 2,
        },
        rotation: 0,
        dimensions: {
          width: b.max.x - b.min.x,
          depth: b.max.z - b.min.z,
          height: 0.1,
        },
      }
    );
  };
  const visiting = new Set<string>();
  const offset = (v: Volume): Vec3 => {
    if (result.has(v.id)) return result.get(v.id)!;
    if (visiting.has(v.id)) return { x: 0, y: 0, z: 0 };
    visiting.add(v.id);
    const custom = state.overrides?.find((o) => o.id === v.id);
    if (state.fixed?.includes(v.id) || custom) {
      const out = { x: 0, y: 0, z: 0 };
      if (custom && !state.fixed?.includes(v.id)) {
        const sign = custom.direction.startsWith('-') ? -1 : 1;
        const axis = custom.direction.replace('-', '') as keyof Vec3;
        out[axis] = sign * custom.distance * state.amount;
        const a = (v.rotation * Math.PI) / 180,
          x = out.x,
          z = out.z;
        out.x = x * Math.cos(a) + z * Math.sin(a);
        out.z = -x * Math.sin(a) + z * Math.cos(a);
      }
      result.set(v.id, out);
      visiting.delete(v.id);
      return out;
    }
    const parent = v.component?.hostId
      ? byId.get(v.component.hostId)
      : undefined;
    if (parent && included.has(parent.id)) {
      const value = { ...offset(parent) };
      result.set(v.id, value);
      visiting.delete(v.id);
      return value;
    }
    const role = componentInfo(v).role;
    const datum = anchor(v);
    const localSlabs = slabs.filter(
      (s) =>
        Math.hypot(
          s.position.x - datum.position.x,
          s.position.z - datum.position.z,
        ) < 0.25 && Math.abs(s.rotation - datum.rotation) % 180 < 0.1,
    );
    const localFloors = localSlabs.length
      ? [
          ...new Set(localSlabs.map((s) => Math.round(s.position.y * 10) / 10)),
        ].sort((a, b) => a - b)
      : floors;
    const gap =
      state.gap ??
      (localFloors.length > 1
        ? Math.max(
            1.5,
            Math.min(
              12,
              (localFloors.at(-1)! - localFloors[0]) / (localFloors.length - 1),
            ),
          )
        : defaultGap);
    const level = Math.max(
      0,
      localFloors.filter((y) => y <= v.position.y + 0.15).length - 1,
    );
    const out = { x: 0, y: 0, z: 0 };
    if (state.layout === 'levels')
      out.y = (role === 'roof' ? localFloors.length : level) * gap;
    else if (role === 'roof')
      out.y = Math.max(1, localFloors.length) * gap + gap * 0.8;
    else if (role === 'floor') out.y = level * gap;
    else if (
      ['wall', 'window', 'door', 'panel', 'frame', 'sunshade'].includes(role)
    ) {
      const c = datum.position,
        a = (v.rotation * Math.PI) / 180;
      const dx = v.position.x - c.x,
        dz = v.position.z - c.z;
      const lx = dx * Math.cos(a) - dz * Math.sin(a);
      const lz = dx * Math.sin(a) + dz * Math.cos(a);
      // A facade exits perpendicular to its thin horizontal dimension. Small
      // mullions use their location instead. Exactly ONE local axis moves.
      const thinX = v.dimensions.width < v.dimensions.depth * 0.5;
      const thinZ = v.dimensions.depth < v.dimensions.width * 0.5;
      const useX = thinX || (!thinZ && Math.abs(lx) > Math.abs(lz));
      const distance =
        gap *
        (0.7 +
          level * 0.2 +
          (state.layout === 'systems'
            ? role === 'window' || role === 'panel'
              ? 0.8
              : role === 'frame'
                ? 0.4
                : 0
            : 0));
      const x = useX ? (Math.sign(lx) || 1) * distance : 0;
      const z = useX ? 0 : (Math.sign(lz) || 1) * distance;
      out.x = x * Math.cos(a) + z * Math.sin(a);
      out.z = -x * Math.sin(a) + z * Math.cos(a);
    } else out.y = (level + (role === 'column' ? 0.2 : 0.35)) * gap;
    out.x *= state.amount;
    out.y *= state.amount;
    out.z *= state.amount;
    result.set(v.id, out);
    visiting.delete(v.id);
    return out;
  };
  for (const v of scope) offset(v);
  return result;
}
