import { validateVolume, type Volume } from '../model';
import { isFlat } from './spatial';
export type FaceAxis = 'x' | 'y' | 'z';
export function pullFace(
  v: Volume,
  axis: FaceAxis,
  side: 1 | -1,
  delta: number,
): Volume {
  const flat = isFlat(v);
  if (flat && (axis !== 'y' || side !== 1))
    throw new Error('Pull the upper face to extrude this profile.');
  const dimension = { x: 'width', y: 'height', z: 'depth' }[axis] as
    'width' | 'height' | 'depth';
  const size = (flat ? 0 : v.dimensions[dimension]) + delta;
  const dimensions = { ...v.dimensions, [dimension]: size },
    position = { ...v.position };
  if (axis === 'y') {
    if (side === -1) position.y -= delta;
  } else {
    const a = (v.rotation * Math.PI) / 180,
      offset = (side * delta) / 2;
    position.x += axis === 'x' ? Math.cos(a) * offset : Math.sin(a) * offset;
    position.z += axis === 'x' ? -Math.sin(a) * offset : Math.cos(a) * offset;
  }
  let geometry = v.geometry;
  if (flat)
    geometry =
      geometry?.kind === 'polygon'
        ? { ...geometry, extruded: true }
        : {
            kind: 'extrusion',
            profile: geometry?.kind === 'circle' ? 'circle' : 'rectangle',
          };
  const next = { ...v, dimensions, position, geometry };
  validateVolume(next);
  return next;
}
