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
  const b = groupBounds(scope),
    cx = (b.min.x + b.max.x) / 2,
    cz = (b.min.z + b.max.z) / 2;
  const gap = Math.max(1.5, Math.min(12, (b.max.y - b.min.y) * 0.65));
  const floors = [
    ...new Set(
      scope
        .filter((v) => componentInfo(v).role === 'floor')
        .map((v) => Math.round(v.position.y * 10) / 10),
    ),
  ].sort((a, b) => a - b);
  const visiting = new Set<string>();
  const offset = (v: Volume): Vec3 => {
    if (result.has(v.id)) return result.get(v.id)!;
    if (visiting.has(v.id)) return { x: 0, y: 0, z: 0 };
    visiting.add(v.id);
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
    const level = Math.max(
      0,
      floors.filter((y) => y <= v.position.y + 0.15).length - 1,
    );
    const out = { x: 0, y: level * gap, z: 0 };
    if (role === 'roof') out.y = Math.max(1, floors.length) * gap + gap * 0.8;
    else if (role === 'floor') {
      /* slabs stay parallel and aligned */
    } else if (['wall', 'window', 'door', 'panel'].includes(role)) {
      out.y += gap * 0.35;
      const dx = v.position.x - cx,
        dz = v.position.z - cz;
      if (
        Math.abs(dx) / Math.max(1, b.max.x - b.min.x) >
        Math.abs(dz) / Math.max(1, b.max.z - b.min.z)
      )
        out.x = (Math.sign(dx) || 1) * gap * 0.7;
      else out.z = (Math.sign(dz) || 1) * gap * 0.7;
    } else if (role === 'column') out.y += gap * 0.2;
    else {
      out.y += gap * 0.15;
      const dx = v.position.x - cx,
        dz = v.position.z - cz,
        length = Math.hypot(dx, dz);
      if (length > 0.01) {
        out.x = (dx / length) * gap * 0.35;
        out.z = (dz / length) * gap * 0.35;
      }
    }
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
