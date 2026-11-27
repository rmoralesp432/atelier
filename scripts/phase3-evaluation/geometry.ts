/** External benchmark utilities. Never imported by the application. */
import { getKernel, withSolid } from '../../src/geometry/kernel';
import { makeVolume, type Volume } from '../../src/model';
import type { Manifold } from 'manifold-3d';

export const K = await getKernel();
export type V3 = [number, number, number];
export const rad = (d: number) => (d * Math.PI) / 180;
export const near = (a: number, b: number, t = 0.002) => Math.abs(a - b) <= t;
export const length = (p: number[]) => Math.hypot(...p);
export const direction = (degrees: number): V3 => [
  Math.cos(rad(degrees)),
  0,
  Math.sin(rad(degrees)),
];
export function mapSolid(s: Manifold, f: (s: Manifold) => Manifold) {
  try {
    return f(s);
  } finally {
    s.delete();
  }
}
export const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) =>
  mapSolid(K.Manifold.cube([w, h, d]), (s) =>
    s.translate([x - w / 2, y, z - d / 2]),
  );
export const vertical = (h: number, r0: number, r1 = r0, segments = 128) =>
  mapSolid(K.Manifold.cylinder(h, r0, r1, segments), (s) =>
    s.rotate([-90, 0, 0]),
  );
export function axial(h: number, r: number, angle: number, center: V3) {
  return mapSolid(K.Manifold.cylinder(h, r, r, 128, true), (s) =>
    mapSolid(s.rotate([0, 90, 0]), (a) =>
      mapSolid(a.rotate([0, -angle, 0]), (b) => b.translate(center)),
    ),
  );
}
export function union(solids: Manifold[]) {
  try {
    return K.Manifold.union(solids);
  } finally {
    solids.forEach((s) => s.delete());
  }
}
export function subtract(a: Manifold, b: Manifold) {
  try {
    return a.subtract(b);
  } finally {
    a.delete();
    b.delete();
  }
}
export function intersect(a: Manifold, b: Manifold) {
  try {
    return a.intersect(b);
  } finally {
    a.delete();
    b.delete();
  }
}
export function asVolume(s: Manifold, id: string, name = id): Volume {
  try {
    if (s.status() !== 'NoError' || s.volume() <= 0)
      throw new Error('Invalid evaluator fixture solid');
    const b = s.boundingBox(),
      m = s.getMesh();
    const dimensions = {
      width: b.max[0] - b.min[0],
      height: b.max[1] - b.min[1],
      depth: b.max[2] - b.min[2],
    };
    const position = {
      x: (b.min[0] + b.max[0]) / 2,
      y: b.min[1],
      z: (b.min[2] + b.max[2]) / 2,
    };
    const positions: number[] = [];
    for (let i = 0; i < m.numVert; i++)
      positions.push(
        (m.vertProperties[i * m.numProp] - position.x) / dimensions.width,
        (m.vertProperties[i * m.numProp + 1] - position.y) / dimensions.height,
        (m.vertProperties[i * m.numProp + 2] - position.z) / dimensions.depth,
      );
    return {
      ...makeVolume(),
      id,
      name,
      position,
      dimensions,
      rotation: 0,
      geometry: {
        kind: 'mesh',
        positions,
        indices: Array.from(m.triVerts),
        solid: true,
        source: 'phase3-evaluator-fixture',
      },
    };
  } finally {
    s.delete();
  }
}
export const cloneSolid = (v: Volume) =>
  withSolid(v, (s) => s.translate([0, 0, 0]));
export type Frame = { x: number; z: number; angle: number };
export const worldToLocal = (s: Manifold, f: Frame) =>
  mapSolid(s.translate([-f.x, 0, -f.z]), (a) => a.rotate([0, f.angle, 0]));
export const localToWorld = (s: Manifold, f: Frame) =>
  mapSolid(s.rotate([0, -f.angle, 0]), (a) => a.translate([f.x, 0, f.z]));
export function vertices(s: Manifold): V3[] {
  const m = s.getMesh();
  return Array.from(
    { length: m.numVert },
    (_, i) =>
      Array.from(
        m.vertProperties.slice(i * m.numProp, i * m.numProp + 3),
      ) as V3,
  );
}
export function hull(points: number[][]): number[][] {
  const p = [
    ...new Map(
      points.map((v) => [v.map((x) => x.toFixed(6)).join(','), v]),
    ).values(),
  ].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const lower: number[][] = [],
    upper: number[][] = [];
  for (const q of p) {
    while (lower.length > 1 && cross(lower.at(-2)!, lower.at(-1)!, q) <= 1e-8)
      lower.pop();
    lower.push(q);
  }
  for (const q of [...p].reverse()) {
    while (upper.length > 1 && cross(upper.at(-2)!, upper.at(-1)!, q) <= 1e-8)
      upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
export function frame(s: Manifold): Frame {
  const points = hull(vertices(s).map((p) => [p[0], p[2]]));
  let best = { area: Infinity, angle: 0, x: 0, z: 0 };
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      q = points[(i + 1) % points.length];
    let a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    let xx = points.map((p) => p[0] * Math.cos(a) + p[1] * Math.sin(a)),
      zz = points.map((p) => -p[0] * Math.sin(a) + p[1] * Math.cos(a));
    const w = Math.max(...xx) - Math.min(...xx),
      d = Math.max(...zz) - Math.min(...zz);
    if (w < d) a += Math.PI / 2;
    if (w * d < best.area - 1e-7) {
      const b = s.boundingBox();
      best = {
        area: w * d,
        angle: (a * 180) / Math.PI,
        x: (b.min[0] + b.max[0]) / 2,
        z: (b.min[2] + b.max[2]) / 2,
      };
    }
  }
  return best;
}
export function stats(s: Manifold) {
  const bounds = s.boundingBox();
  const size = bounds.max.map((n, i) => n - bounds.min[i]);
  const center = bounds.max.map((n, i) => (n + bounds.min[i]) / 2);
  const mesh = s.getMesh();
  let signed = 0;
  for (let i = 0; i < mesh.triVerts.length; i += 3) {
    const v = [0, 1, 2].map((j) =>
      Array.from(
        mesh.vertProperties.slice(
          mesh.triVerts[i + j] * mesh.numProp,
          mesh.triVerts[i + j] * mesh.numProp + 3,
        ),
      ),
    );
    const [a, b, c] = v;
    signed +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) +
        a[1] * (b[2] * c[0] - b[0] * c[2]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) /
      6;
  }
  return {
    bounds,
    size,
    center,
    volume: s.volume(),
    triangleVolume: Math.abs(signed),
    triangles: s.numTri(),
  };
}
export function difference(a: Manifold, b: Manifold) {
  const overlap = a.intersect(b);
  try {
    return Math.max(0, a.volume() + b.volume() - 2 * overlap.volume());
  } finally {
    overlap.delete();
  }
}
export function sameSolid(
  a: Manifold,
  b: Manifold,
  relative = 0.001,
  linear = 0.002,
) {
  const x = stats(a),
    y = stats(b);
  return (
    ['min', 'max'].every((k) =>
      x.bounds[k as 'min' | 'max'].every((n, i) =>
        near(n, y.bounds[k as 'min' | 'max'][i], linear),
      ),
    ) && difference(a, b) <= Math.max(1e-8, y.volume * relative)
  );
}
export function sections(s: Manifold, heights: number[]) {
  const up = s.rotate([90, 0, 0]);
  try {
    return heights.map((y) => {
      const c = up.slice(y);
      try {
        return { y, area: c.area(), polygons: c.toPolygons() };
      } finally {
        c.delete();
      }
    });
  } finally {
    up.delete();
  }
}
export function overlap(s: Manifold, probe: Manifold) {
  try {
    const i = s.intersect(probe);
    try {
      return i.volume();
    } finally {
      i.delete();
    }
  } finally {
    probe.delete();
  }
}
