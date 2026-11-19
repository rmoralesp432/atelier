export type FootprintPoint = { x: number; z: number };
const cross = (a: FootprintPoint, b: FootprintPoint, c: FootprintPoint) =>
  (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
export const polygonArea = (points: FootprintPoint[]) =>
  Math.abs(
    points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length];
      return sum + p.x * q.z - q.x * p.z;
    }, 0),
  ) / 2;
export function validatePolygon(points: FootprintPoint[]) {
  if (
    !Array.isArray(points) ||
    points.length < 3 ||
    points.length > 64 ||
    points.some(
      (p) =>
        !p ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.z) ||
        Math.abs(p.x) > 500 ||
        Math.abs(p.z) > 500,
    )
  )
    throw new Error('A footprint needs 3–64 finite corners within 500 meters.');
  const eps = 1e-9;
  const on = (a: FootprintPoint, b: FootprintPoint, p: FootprintPoint) =>
    Math.abs(cross(a, b, p)) < eps &&
    p.x >= Math.min(a.x, b.x) - eps &&
    p.x <= Math.max(a.x, b.x) + eps &&
    p.z >= Math.min(a.z, b.z) - eps &&
    p.z <= Math.max(a.z, b.z) + eps;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    if (Math.hypot(a.x - b.x, a.z - b.z) < 1e-6)
      throw new Error('Footprint corners must be distinct.');
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      const c = points[j],
        d = points[(j + 1) % points.length];
      if (
        (cross(a, b, c) * cross(a, b, d) < 0 &&
          cross(c, d, a) * cross(c, d, b) < 0) ||
        on(a, b, c) ||
        on(a, b, d) ||
        on(c, d, a) ||
        on(c, d, b)
      )
        throw new Error(
          'The footprint crosses or touches itself. Describe a simple closed outline.',
        );
    }
    const prev = points[(i + points.length - 1) % points.length];
    if (
      Math.abs(cross(prev, a, b)) < eps &&
      (prev.x - a.x) * (b.x - a.x) + (prev.z - a.z) * (b.z - a.z) > 0
    )
      throw new Error('The footprint doubles back on itself.');
  }
  if (polygonArea(points) < 1e-8)
    throw new Error('The footprint must enclose an area.');
}
export function normalizePolygon(points: FootprintPoint[]) {
  validatePolygon(points);
  const minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x));
  const minZ = Math.min(...points.map((p) => p.z)),
    maxZ = Math.max(...points.map((p) => p.z));
  const width = maxX - minX,
    depth = maxZ - minZ;
  return {
    width,
    depth,
    points: points.map((p) => ({
      x: (p.x - (minX + maxX) / 2) / width,
      z: (p.z - (minZ + maxZ) / 2) / depth,
    })),
  };
}
