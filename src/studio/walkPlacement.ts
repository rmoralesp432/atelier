import { isVisible, type Project, type Vec3 } from '../model';
import { center, envelopeBounds } from '../geometry/spatial';
import type { Operation } from '../intelligence/plan';
export type WalkPlacement = { position: Vec3; lookAt: Vec3 };
/** Feet position, in project meters. This is a viewpoint, not collision/pathfinding. */
export function resolveWalkPlacement(
  project: Project,
  op: Extract<Operation, { type: 'walk_to' }>,
): WalkPlacement {
  const volumes = op.targets.map((id) => {
    const candidates = project.volumes.filter(
      (v) => v.id === id || v.name.toLowerCase() === id.toLowerCase(),
    );
    if (candidates.length !== 1 || !isVisible(candidates[0], project))
      throw new Error(`Choose one visible object for camera placement: ${id}.`);
    return candidates[0];
  });
  let position: Vec3;
  let lookAt: Vec3;
  if (op.placement === 'coordinates') {
    if (!op.position || volumes.length)
      throw new Error(
        'Camera coordinates need a floor point and no object targets.',
      );
    position = { ...op.position };
    lookAt = { ...position, z: position.z - 10 };
  } else if (op.placement === 'between') {
    if (volumes.length !== 2 || volumes[0].id === volumes[1].id)
      throw new Error('Choose two different objects to stand between.');
    const a = center(volumes[0]),
      b = center(volumes[1]);
    position = {
      x: (a.x + b.x) / 2,
      y: Math.min(volumes[0].position.y, volumes[1].position.y),
      z: (a.z + b.z) / 2,
    };
    lookAt = a;
  } else {
    if (volumes.length !== 1)
      throw new Error('Choose one object for this viewpoint.');
    const v = volumes[0],
      c = center(v),
      bounds = envelopeBounds(v);
    position = {
      x: c.x,
      y: v.position.y,
      z: op.placement === 'in_front' ? bounds.max.z + 3 : c.z,
    };
    lookAt =
      op.placement === 'in_front' ? c : { ...position, z: position.z - 10 };
  }
  if (
    ![position.x, position.y, position.z].every(Number.isFinite) ||
    position.y < 0 ||
    position.y > 1000
  )
    throw new Error('Choose a walk floor between 0 and 1000 m.');
  return { position, lookAt: op.lookAt ?? lookAt };
}
