import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { Dimensions } from '../model';
import type { MeshRecipe } from '../imports/mesh';
import { validatePolygon, type FootprintPoint } from './polygon';

export type ParametricDefinition =
  | { method: 'revolve'; profile: FootprintPoint[]; degrees: number }
  | {
      method: 'profile';
      profile: FootprintPoint[];
      axis: 'x' | 'y' | 'z';
      length: number;
      shape: 'rectangle' | 'ellipse' | 'i_section' | 'polygon';
      web: number | null;
      flange: number | null;
    };

export function validateParametric(d: ParametricDefinition) {
  validatePolygon(d.profile);
  if (d.method === 'revolve') {
    if (
      !Number.isFinite(d.degrees) ||
      d.degrees < 1 ||
      d.degrees > 360 ||
      d.profile.some((p) => p.x < 0)
    )
      throw new Error(
        'Revolve needs a radial profile on or outside the axis and an angle from 1–360 degrees.',
      );
  } else if (
    !['x', 'y', 'z'].includes(d.axis) ||
    !Number.isFinite(d.length) ||
    d.length < 0.005 ||
    d.length > 500 ||
    !['rectangle', 'ellipse', 'i_section', 'polygon'].includes(d.shape) ||
    [d.web, d.flange].some(
      (n) => n !== null && (!Number.isFinite(n) || n <= 0 || n > 500),
    )
  ) {
    throw new Error('Invalid extruded section parameters.');
  }
}

/** Convert a verified Manifold solid into the same normalized editable form
 * representation used by loft/sweep. No rendering-only geometry. */
export function parametricMesh(
  m: ManifoldToplevel,
  d: ParametricDefinition,
): { mesh: MeshRecipe; dimensions: Dimensions } {
  validateParametric(d);
  const allocated: Manifold[] = [];
  const keep = (s: Manifold) => {
    allocated.push(s);
    return s;
  };
  try {
    let solid: Manifold;
    if (d.method === 'revolve') {
      solid = keep(
        m.Manifold.revolve([d.profile.map((p) => [p.x, p.z])], 96, d.degrees),
      );
      solid = keep(solid.rotate([-90, 0, 0]));
    } else {
      // Extrusion starts along Z. Cross section coordinates are X/Y for Z,
      // X/Z for Y and Z/Y for X; keeping these fixed avoids Frenet-frame flips.
      const section = new m.CrossSection(
        [
          d.profile.map((p) => [
            d.axis === 'x' ? -p.x : p.x,
            d.axis === 'y' ? -p.z : p.z,
          ]),
        ],
        'EvenOdd',
      );
      try {
        solid = keep(section.extrude(d.length));
      } finally {
        section.delete();
      }
      if (d.axis === 'y') solid = keep(solid.rotate([-90, 0, 0]));
      if (d.axis === 'x') solid = keep(solid.rotate([0, 90, 0]));
    }
    if (
      solid.status() !== 'NoError' ||
      solid.isEmpty() ||
      solid.volume() < 1e-6
    )
      throw new Error('The profile does not produce a closed, nonempty solid.');
    const b = solid.boundingBox(),
      raw = solid.getMesh();
    const span = b.max.map((n, i) => n - b.min[i]);
    if (span.some((n) => !Number.isFinite(n) || n < 0.001 || n > 500))
      throw new Error('Generated dimensions must be between 1 mm and 500 m.');
    const origin = [
      (b.min[0] + b.max[0]) / 2,
      b.min[1],
      (b.min[2] + b.max[2]) / 2,
    ];
    const positions: number[] = [];
    for (let i = 0; i < raw.numVert; i++)
      for (let a = 0; a < 3; a++)
        positions.push(
          (raw.vertProperties[i * raw.numProp + a] - origin[a]) / span[a],
        );
    return {
      dimensions: { width: span[0], height: span[1], depth: span[2] },
      mesh: {
        kind: 'mesh',
        source: d.method,
        solid: true,
        positions,
        indices: Array.from(raw.triVerts),
      },
    };
  } finally {
    allocated.reverse().forEach((s) => s.delete());
  }
}

export function sectionOutline(
  shape: 'rectangle' | 'ellipse' | 'i_section' | 'polygon',
  width: number,
  height: number,
  web: number | null,
  flange: number | null,
  points: FootprintPoint[] | null,
): FootprintPoint[] {
  const w = width / 2,
    h = height / 2;
  if (shape === 'ellipse')
    return Array.from({ length: 64 }, (_, i) => ({
      x: w * Math.cos((i * Math.PI) / 32),
      z: h * Math.sin((i * Math.PI) / 32),
    }));
  if (shape === 'i_section') {
    if (
      web === null ||
      flange === null ||
      web >= width ||
      flange * 2 >= height ||
      web < 0.005 ||
      flange < 0.005
    )
      throw new Error(
        'An I-section needs explicit web and flange thicknesses smaller than its envelope. No structural equivalence is inferred.',
      );
    const t = web / 2,
      f = flange;
    return [
      [-w, -h],
      [w, -h],
      [w, -h + f],
      [t, -h + f],
      [t, h - f],
      [w, h - f],
      [w, h],
      [-w, h],
      [-w, h - f],
      [-t, h - f],
      [-t, -h + f],
      [-w, -h + f],
    ].map(([x, z]) => ({ x, z }));
  }
  if (shape === 'polygon') {
    if (!points) throw new Error('A polygon section needs its outline.');
    validatePolygon(points);
    const minX = Math.min(...points.map((p) => p.x)),
      maxX = Math.max(...points.map((p) => p.x));
    const minZ = Math.min(...points.map((p) => p.z)),
      maxZ = Math.max(...points.map((p) => p.z));
    return points.map((p) => ({
      x: ((p.x - (minX + maxX) / 2) * width) / (maxX - minX),
      z: ((p.z - (minZ + maxZ) / 2) * height) / (maxZ - minZ),
    }));
  }
  return [
    { x: -w, z: -h },
    { x: w, z: -h },
    { x: w, z: h },
    { x: -w, z: h },
  ];
}
