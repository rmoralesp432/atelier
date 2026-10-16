import type { Vec3, Volume } from '../model';

export const isFlat = (v: Volume) =>
  v.geometry?.kind === 'rectangle' ||
  v.geometry?.kind === 'circle' ||
  (v.geometry?.kind === 'polygon' && !v.geometry.extruded);

// Projection of the oriented modeling envelope, not its world-aligned box.
// Keeping the dot products together avoids inflated gaps at oblique cameras.
export function projectedExtent(v: Volume, d: Vec3) {
  const a = (v.rotation * Math.PI) / 180;
  return (
    Math.abs(d.x * Math.cos(a) - d.z * Math.sin(a)) * v.dimensions.width +
    Math.abs(d.x * Math.sin(a) + d.z * Math.cos(a)) * v.dimensions.depth +
    Math.abs(d.y) * (isFlat(v) ? 0 : v.dimensions.height)
  );
}
export function center(v: Volume): Vec3 {
  return {
    ...v.position,
    y: v.position.y + (isFlat(v) ? 0 : v.dimensions.height / 2),
  };
}
export function envelopeBounds(v: Volume) {
  const c = center(v);
  const x = projectedExtent(v, { x: 1, y: 0, z: 0 }) / 2;
  const y = (isFlat(v) ? 0 : v.dimensions.height) / 2;
  const z = projectedExtent(v, { x: 0, y: 0, z: 1 }) / 2;
  return {
    min: { x: c.x - x, y: c.y - y, z: c.z - z },
    max: { x: c.x + x, y: c.y + y, z: c.z + z },
  };
}
export function groupBounds(vs: Volume[]) {
  const bounds = vs.map(envelopeBounds);
  const component = (edge: 'min' | 'max', axis: keyof Vec3) =>
    (edge === 'min' ? Math.min : Math.max)(...bounds.map((b) => b[edge][axis]));
  return {
    min: {
      x: component('min', 'x'),
      y: component('min', 'y'),
      z: component('min', 'z'),
    },
    max: {
      x: component('max', 'x'),
      y: component('max', 'y'),
      z: component('max', 'z'),
    },
  };
}
