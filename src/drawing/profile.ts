import { operationSchema, type Operation } from '../intelligence/plan';
import { validatePolygon, type FootprintPoint } from '../geometry/polygon';
export type DrawingMode = 'rectangle' | 'circle' | 'outline';
export type DrawingTool = `draw_${DrawingMode}`;
export type Point = FootprintPoint;
export function snapPoint(
  p: Point,
  step: number,
  anchor?: Point,
  lock = false,
): Point {
  const result = {
    x: Math.round(p.x / step) * step,
    z: Math.round(p.z / step) * step,
  };
  if (anchor && lock) {
    if (Math.abs(result.x - anchor.x) >= Math.abs(result.z - anchor.z))
      result.z = anchor.z;
    else result.x = anchor.x;
  }
  return result;
}
export function drawingPoint(
  mode: DrawingMode,
  p: Point,
  step: number,
  anchor?: Point,
  shift = false,
): Point {
  const result = snapPoint(p, step, anchor, shift && mode !== 'rectangle');
  if (shift && anchor && mode === 'rectangle') {
    const side = Math.max(
      Math.abs(result.x - anchor.x),
      Math.abs(result.z - anchor.z),
    );
    return {
      x: anchor.x + (result.x < anchor.x ? -side : side),
      z: anchor.z + (result.z < anchor.z ? -side : side),
    };
  }
  return result;
}
export function profileOperation(
  mode: DrawingMode,
  points: Point[],
  elevation: number,
  name: string,
): Operation {
  if (points.length < 2)
    throw new Error('Place the first point, then draw a shape.');
  const [a, b] = points;
  const base = { name, height: 3, y: elevation, rotation: 0 };
  if (mode === 'circle') {
    const diameter = Math.hypot(b.x - a.x, b.z - a.z) * 2;
    if (diameter < 0.1 || diameter > 500)
      throw new Error('Choose a radius between 0.05 and 250 m.');
    return operationSchema.parse({
      type: 'create_at',
      shape: 'circle',
      ...base,
      width: diameter,
      depth: diameter,
      x: a.x,
      z: a.z,
    });
  }
  if (mode === 'rectangle') {
    const width = Math.abs(b.x - a.x),
      depth = Math.abs(b.z - a.z);
    if (Math.min(width, depth) < 0.1 || Math.max(width, depth) > 500)
      throw new Error('Each side must be between 0.1 and 500 m.');
    return operationSchema.parse({
      type: 'create_at',
      shape: 'rectangle',
      ...base,
      width,
      depth,
      x: (a.x + b.x) / 2,
      z: (a.z + b.z) / 2,
    });
  }
  const x =
    (Math.min(...points.map((p) => p.x)) +
      Math.max(...points.map((p) => p.x))) /
    2;
  const z =
    (Math.min(...points.map((p) => p.z)) +
      Math.max(...points.map((p) => p.z))) /
    2;
  const local = points.map((p) => ({ x: p.x - x, z: p.z - z }));
  validatePolygon(local);
  return operationSchema.parse({
    type: 'footprint',
    ...base,
    points: local,
    extruded: false,
    x,
    z,
  });
}
export function previewPoints(
  mode: DrawingMode,
  points: Point[],
  cursor: Point,
): Point[] {
  const a = points[0];
  if (!a) return [];
  if (mode === 'rectangle')
    return [a, { x: cursor.x, z: a.z }, cursor, { x: a.x, z: cursor.z }];
  if (mode === 'circle') {
    const r = Math.hypot(cursor.x - a.x, cursor.z - a.z);
    return Array.from({ length: 96 }, (_, i) => ({
      x: a.x + Math.cos((i * Math.PI) / 48) * r,
      z: a.z + Math.sin((i * Math.PI) / 48) * r,
    }));
  }
  return [...points, cursor];
}
