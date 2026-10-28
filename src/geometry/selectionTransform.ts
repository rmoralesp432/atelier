import { propagateHosted } from '../design/model';
import {
  isLocked,
  isVisible,
  round,
  updateVolume,
  validateVolume,
  type Project,
  type Volume,
} from '../model';

/** Rigid transform about the active object's base; keeps spacing and clamps the whole selection to ground. */
export function transformSelection(
  project: Project,
  activeId: string,
  patch: Partial<Volume>,
): Project {
  const active = project.volumes.find((v) => v.id === activeId);
  if (!active || isLocked(active, project)) return project;
  const ids = new Set(
    project.selectedIds?.includes(activeId) ? project.selectedIds : [activeId],
  );
  const members = project.volumes.filter(
    (v) => ids.has(v.id) && isVisible(v, project) && !isLocked(v, project),
  );
  if (!members.length) return project;
  const position = patch.position ?? active.position;
  const dx = position.x - active.position.x,
    dz = position.z - active.position.z;
  const dy = Math.max(
    position.y - active.position.y,
    -Math.min(...members.map((v) => v.position.y)),
  );
  const angle = (patch.rotation ?? active.rotation) - active.rotation;
  const radians = (angle * Math.PI) / 180,
    c = Math.cos(radians),
    s = Math.sin(radians);
  let next = project;
  for (const v of members) {
    const x = v.position.x - active.position.x,
      z = v.position.z - active.position.z;
    next = updateVolume(
      next,
      v.id,
      {
        position: {
          x: round(active.position.x + dx + x * c + z * s),
          y: round(v.position.y + dy),
          z: round(active.position.z + dz - x * s + z * c),
        },
        rotation: round((((v.rotation + angle) % 360) + 360) % 360),
      },
      false,
    );
  }
  const volumes = propagateHosted(project.volumes, next.volumes);
  for (const v of volumes) {
    const old = project.volumes.find((o) => o.id === v.id);
    if (v === old) continue;
    if (isLocked(v, project))
      throw new Error(
        'This change would move a locked component. Unlock it first.',
      );
    validateVolume(v, false);
  }
  return { ...next, volumes };
}
