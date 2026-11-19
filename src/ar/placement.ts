export type FloorPoint = { x: number; y: number; z: number };
/** Fit a model's width to two tracked points on the same horizontal real surface. */
export function fitToRealWidth(
  a: FloorPoint,
  b: FloorPoint,
  modelWidth: number,
) {
  if (
    ![a.x, a.y, a.z, b.x, b.y, b.z, modelWidth].every(Number.isFinite) ||
    modelWidth <= 0
  )
    throw new Error('A visible model width is required.');
  if (Math.abs(a.y - b.y) > 0.15)
    throw new Error('Choose two points on the same level surface.');
  const distance = Math.hypot(b.x - a.x, b.z - a.z);
  if (distance < 0.1) throw new Error('Place the points at least 10 cm apart.');
  const scale = distance / modelWidth;
  if (scale < 0.001 || scale > 1)
    throw new Error(
      'This span needs a scale outside 1:1000 to 1:1. Try a different span.',
    );
  return {
    distance,
    scale,
    rotation: (-Math.atan2(b.z - a.z, b.x - a.x) * 180) / Math.PI,
    position: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 },
  };
}
