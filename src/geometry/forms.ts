import { organicMesh, validateOrganic } from './organic';
import type { OrganicDefinition } from './organicSchema';
import { rejectCrossingSurface } from './surfaceValidation';
import {
  CatmullRomCurve3,
  CurvePath,
  LineCurve3,
  ShapeUtils,
  Vector2,
  Vector3,
} from 'three';
import type { ManifoldToplevel } from 'manifold-3d';
import type { Dimensions, Vec3 } from '../model';
import type { MeshRecipe } from '../imports/mesh';
import { validatePolygon, type FootprintPoint } from './polygon';
import {
  parametricMesh,
  validateParametric,
  type ParametricDefinition,
} from './parametric';

export type FormDefinition =
  | OrganicDefinition
  | ParametricDefinition
  | {
      method: 'sweep';
      profile: FootprintPoint[];
      path: Vec3[];
      smooth: boolean;
    }
  | { method: 'loft'; sections: { y: number; points: FootprintPoint[] }[] };
export type FormRecipe = {
  kind: 'form';
  mesh: MeshRecipe;
  definition: FormDefinition;
  origin?: Vec3;
  base?: Dimensions;
};
const signedArea = (p: FootprintPoint[]) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a.x * b.z - b.x * a.z;
  }, 0);
export function validateForm(d: FormDefinition) {
  if (
    d &&
    ['nurbs', 'organic_sweep', 'smooth_loft', 'subdivision', 'field'].includes(
      d.method,
    )
  )
    return validateOrganic(d as OrganicDefinition);
  if (!d || !['sweep', 'loft', 'revolve', 'profile'].includes(d.method))
    throw new Error('Unsupported form definition.');
  if (d.method !== 'sweep' && d.method !== 'loft')
    return validateParametric(d as ParametricDefinition);
  if (d.method === 'sweep') {
    validatePolygon(d.profile);
    if (
      typeof d.smooth !== 'boolean' ||
      !Array.isArray(d.path) ||
      d.path.length < 2 ||
      d.path.length > 24 ||
      d.path.some(
        (p, i) =>
          !p ||
          !['x', 'y', 'z'].every(
            (k) =>
              Number.isFinite(p[k as keyof Vec3]) &&
              Math.abs(p[k as keyof Vec3]) <= 500,
          ) ||
          (i > 0 &&
            Math.hypot(
              p.x - d.path[i - 1].x,
              p.y - d.path[i - 1].y,
              p.z - d.path[i - 1].z,
            ) < 0.01),
      )
    )
      throw new Error('A sweep needs 2–24 distinct path points within 500 m.');
    const first = d.path[0],
      last = d.path.at(-1)!;
    if (Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z) < 0.01)
      throw new Error('Sweep currently needs an open path.');
  } else {
    if (
      !Array.isArray(d.sections) ||
      d.sections.length < 2 ||
      d.sections.length > 16
    )
      throw new Error('A loft needs 2–16 sections.');
    d.sections.forEach((s, i) => {
      validatePolygon(s.points);
      if (
        !Number.isFinite(s.y) ||
        Math.abs(s.y) > 500 ||
        (i && s.y - d.sections[i - 1].y < 0.1) ||
        s.points.length !== d.sections[0].points.length ||
        Math.sign(signedArea(s.points)) !==
          Math.sign(signedArea(d.sections[0].points))
      )
        throw new Error(
          'Loft sections must rise in Y, with matching corner counts and winding.',
        );
      // Corresponding vertices must also form simple outlines between stations.
      if (i)
        for (let t = 0.1; t < 1; t += 0.1)
          validatePolygon(
            s.points.map((p, j) => ({
              x: p.x * t + d.sections[i - 1].points[j].x * (1 - t),
              z: p.z * t + d.sections[i - 1].points[j].z * (1 - t),
            })),
          );
    });
  }
}
// Closed tessellated solids, not display-only surfaces. Cap triangulation also
// supports concave profiles. The recipe keeps the original parameters for edits.
export function formMesh(
  m: ManifoldToplevel,
  definition: FormDefinition,
): { mesh: MeshRecipe; dimensions: Dimensions } {
  validateForm(definition);
  if (
    ['nurbs', 'organic_sweep', 'smooth_loft', 'subdivision', 'field'].includes(
      definition.method,
    )
  )
    return organicMesh(m, definition as OrganicDefinition);
  if (definition.method !== 'sweep' && definition.method !== 'loft')
    return parametricMesh(m, definition as ParametricDefinition);
  let rings: Vector3[][], profile: FootprintPoint[];
  if (definition.method === 'loft') {
    profile = definition.sections[0].points;
    rings = definition.sections.map((s) =>
      s.points.map((p) => new Vector3(p.x, s.y, p.z)),
    );
  } else {
    profile = definition.profile;
    const points = definition.path.map((p) => new Vector3(p.x, p.y, p.z));
    const polyline = new CurvePath<Vector3>();
    for (let i = 1; i < points.length; i++)
      polyline.add(new LineCurve3(points[i - 1], points[i]));
    const curve =
      definition.smooth && points.length > 2
        ? new CatmullRomCurve3(points, false, 'centripetal')
        : polyline;
    const steps = Math.min(96, Math.max(16, points.length * 4));
    const frames = curve.computeFrenetFrames(steps, false);
    rings = Array.from({ length: steps + 1 }, (_, i) => {
      const center = curve.getPointAt(i / steps);
      return profile.map((p) =>
        center
          .clone()
          .addScaledVector(frames.normals[i], p.x)
          .addScaledVector(frames.binormals[i], p.z),
      );
    });
  }
  const count = profile.length,
    positions = rings.flatMap((r) => r.flatMap((p) => p.toArray())),
    indices: number[] = [];
  for (let r = 0; r < rings.length - 1; r++)
    for (let i = 0; i < count; i++) {
      const a = r * count + i,
        b = r * count + ((i + 1) % count),
        c = b + count,
        d = a + count;
      indices.push(a, b, c, a, c, d);
    }
  const end = (rings.length - 1) * count;
  const topProfile =
    definition.method === 'loft' ? definition.sections.at(-1)!.points : profile;
  for (const [points, offset, reverse] of [
    [profile, 0, true],
    [topProfile, end, false],
  ] as const) {
    const caps = ShapeUtils.triangulateShape(
      points.map((p) => new Vector2(p.x, p.z)),
      [],
    );
    for (const [a, b, c] of caps) {
      const tri = signedArea(points) > 0 ? [a, b, c] : [a, c, b];
      indices.push(
        ...(reverse
          ? [tri[2] + offset, tri[1] + offset, tri[0] + offset]
          : tri.map((i) => i + offset)),
      );
    }
  }
  rejectCrossingSurface(positions, indices);
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = new Vector3().fromArray(positions, indices[i] * 3),
      b = new Vector3().fromArray(positions, indices[i + 1] * 3),
      c = new Vector3().fromArray(positions, indices[i + 2] * 3);
    volume += a.dot(b.cross(c)) / 6;
  }
  if (volume < 0)
    for (let i = 0; i < indices.length; i += 3)
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const solid = new m.Manifold(
    new m.Mesh({
      numProp: 3,
      vertProperties: new Float32Array(positions),
      triVerts: new Uint32Array(indices),
    }),
  );
  try {
    if (
      solid.status() !== 'NoError' ||
      solid.isEmpty() ||
      solid.volume() < 1e-6
    )
      throw new Error(
        'The form could not make a closed solid. Use a simpler path or matching sections.',
      );
    const b = solid.boundingBox();
    const dimensions = {
      width: b.max[0] - b.min[0],
      height: b.max[1] - b.min[1],
      depth: b.max[2] - b.min[2],
    };
    const origin = [
      (b.min[0] + b.max[0]) / 2,
      b.min[1],
      (b.min[2] + b.max[2]) / 2,
    ];
    const dims = [dimensions.width, dimensions.height, dimensions.depth];
    return {
      dimensions,
      mesh: {
        kind: 'mesh',
        solid: true,
        source: definition.method,
        positions: positions.map((n, i) => (n - origin[i % 3]) / dims[i % 3]),
        indices,
      },
    };
  } finally {
    solid.delete();
  }
}
