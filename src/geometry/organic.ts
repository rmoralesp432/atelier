import { rejectCrossingSurface } from './surfaceValidation';
import { CatmullRomCurve3, Vector2, Vector3, Vector4, ShapeUtils } from 'three';
import { NURBSSurface } from 'three/addons/curves/NURBSSurface.js';
import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import {
  organicDefinitionSchema,
  type OrganicDefinition,
} from './organicSchema';
import { validatePolygon } from './polygon';
import type { MeshRecipe } from '../imports/mesh';
import type { Dimensions, Vec3 } from '../model';
const vec = (p: Vec3) => new Vector3(p.x, p.y, p.z);
export function validateOrganic(d: OrganicDefinition) {
  organicDefinitionSchema.parse(d);
  if (d.method === 'nurbs') {
    if (
      d.points.some((r) => r.length !== d.points[0].length) ||
      d.degreeU >= d.points.length ||
      d.degreeV >= d.points[0].length
    )
      throw new Error(
        'NURBS needs a rectangular control net with more points than its degree.',
      );
  } else if (d.method === 'organic_sweep') {
    if (
      d.stations[0].at !== 0 ||
      d.stations.at(-1)!.at !== 1 ||
      d.stations.some((s, i) => i > 0 && s.at <= d.stations[i - 1].at)
    )
      throw new Error('Sweep stations must increase from 0 to 1.');
    if (
      d.path.some(
        (p, i) => i > 0 && vec(p).distanceTo(vec(d.path[i - 1])) < 0.01,
      )
    )
      throw new Error('Sweep path points must be distinct.');
  } else if (d.method === 'smooth_loft') {
    d.sections.forEach((s, i) => {
      validatePolygon(s.points);
      if (i && s.y <= d.sections[i - 1].y)
        throw new Error('Loft stations must increase in elevation.');
    });
  } else if (d.method === 'subdivision') {
    const edges = new Map<string, number>();
    for (const f of d.faces) {
      if (new Set(f).size !== 4 || f.some((i) => i >= d.vertices.length))
        throw new Error('Subdivision needs valid quad faces.');
      for (let i = 0; i < 4; i++) {
        const k = edge(f[i], f[(i + 1) % 4]);
        edges.set(k, (edges.get(k) ?? 0) + 1);
      }
    }
    if (
      [...edges.values()].some((n) => n !== 2) ||
      d.creases.some(([a, b]) => !edges.has(edge(a, b)))
    )
      throw new Error(
        'Subdivision cage must be closed; crease edges must exist.',
      );
  } else if (
    d.elements.every((e) => e.subtract) ||
    d.elements.some((e) =>
      Object.values(e.radii).some((r) => r < 0.1 || r > 100),
    )
  )
    throw new Error('Fields need a positive solid and radii from 0.1–100 m.');
}
const edge = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
/** Normalize only the display mesh. Keep the original modeling coordinates and controls. */
export function packOrganic(
  s: Manifold,
  source: string,
): { mesh: MeshRecipe; dimensions: Dimensions; origin: Vec3 } {
  if (s.status() !== 'NoError' || s.isEmpty() || s.volume() < 1e-6)
    throw new Error(
      'The organic form does not enclose a valid solid. Adjust its controls.',
    );
  const b = s.boundingBox(),
    raw = s.getMesh(),
    span = b.max.map((n, i) => n - b.min[i]);
  if (span.some((n) => !Number.isFinite(n) || n < 0.001 || n > 500))
    throw new Error('Organic dimensions must be 1 mm–500 m.');
  const origin = {
    x: (b.min[0] + b.max[0]) / 2,
    y: b.min[1],
    z: (b.min[2] + b.max[2]) / 2,
  };
  const offsets = [origin.x, origin.y, origin.z],
    positions: number[] = [];
  for (let i = 0; i < raw.numVert; i++)
    for (let a = 0; a < 3; a++)
      positions.push(
        (raw.vertProperties[i * raw.numProp + a] - offsets[a]) / span[a],
      );
  return {
    mesh: {
      kind: 'mesh',
      source,
      solid: true,
      positions,
      indices: Array.from(raw.triVerts),
    },
    dimensions: { width: span[0], height: span[1], depth: span[2] },
    origin,
  };
}
export function closedOrganicMesh(
  m: ManifoldToplevel,
  points: Vector3[],
  indices: number[],
  source: string,
) {
  rejectCrossingSurface(
    points.flatMap((p) => p.toArray()),
    indices,
  );
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3)
    volume +=
      points[indices[i]].dot(
        points[indices[i + 1]].clone().cross(points[indices[i + 2]]),
      ) / 6;
  if (volume < 0)
    for (let i = 0; i < indices.length; i += 3)
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const s = new m.Manifold(
    new m.Mesh({
      numProp: 3,
      vertProperties: new Float32Array(points.flatMap((p) => p.toArray())),
      triVerts: new Uint32Array(indices),
    }),
  );
  try {
    return packOrganic(s, source);
  } finally {
    s.delete();
  }
}
function ringMesh(
  m: ManifoldToplevel,
  rings: Vector3[][],
  caps: Vector2[][],
  source: string,
) {
  const n = rings[0].length,
    indices: number[] = [];
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const a = j * n + i,
        b = j * n + ((i + 1) % n);
      indices.push(a, b, b + n, a, b + n, a + n);
    }
  for (const [cap, offset, reverse] of [
    [caps[0], 0, true],
    [caps[1], (rings.length - 1) * n, false],
  ] as const) {
    const area = ShapeUtils.area(cap);
    // Earcut may omit collinear outline samples. Split cap edges at those
    // samples so each side edge has a matching cap edge (no T-junctions).
    const pending = ShapeUtils.triangulateShape(cap, []).filter(
        ([a, b, c]) =>
          Math.abs(
            (cap[b].x - cap[a].x) * (cap[c].y - cap[a].y) -
              (cap[b].y - cap[a].y) * (cap[c].x - cap[a].x),
          ) > 1e-12,
      ),
      complete: number[][] = [];
    while (pending.length) {
      const tri = pending.pop()!;
      let split = false;
      for (let edge = 0; edge < 3 && !split; edge++) {
        const a = tri[edge],
          b = tri[(edge + 1) % 3],
          c = tri[(edge + 2) % 3],
          ab = cap[b].clone().sub(cap[a]);
        for (let p = 0; p < cap.length; p++) {
          if (tri.includes(p)) continue;
          const t = cap[p].clone().sub(cap[a]).dot(ab) / ab.lengthSq();
          if (
            t > 1e-7 &&
            t < 1 - 1e-7 &&
            cap[a].clone().addScaledVector(ab, t).distanceTo(cap[p]) < 1e-8
          ) {
            pending.push([a, p, c], [p, b, c]);
            split = true;
            break;
          }
        }
      }
      if (!split) complete.push(tri);
    }
    for (let tri of complete) {
      if (area < 0) tri = [tri[0], tri[2], tri[1]];
      indices.push(
        ...(reverse ? [tri[2], tri[1], tri[0]] : tri).map((i) => i + offset),
      );
    }
  }
  return closedOrganicMesh(m, rings.flat(), indices, source);
}
function knots(count: number, degree: number) {
  return Array.from({ length: count + degree + 1 }, (_, i) =>
    i <= degree ? 0 : i >= count ? 1 : (i - degree) / (count - degree),
  );
}
export function organicMesh(m: ManifoldToplevel, d: OrganicDefinition) {
  validateOrganic(d);
  if (d.method === 'nurbs') {
    const surface = new NURBSSurface(
      d.degreeU,
      d.degreeV,
      knots(d.points.length, d.degreeU),
      knots(d.points[0].length, d.degreeV),
      d.points.map((r) => r.map((p) => new Vector4(p.x, p.y, p.z, p.weight))),
    );
    const n = d.samples,
      points: Vector3[] = [],
      normals: Vector3[] = [];
    const point = (u: number, v: number) => {
      const p = new Vector3();
      surface.getPoint(u, v, p);
      return p;
    };
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= n; j++) {
        const u = i / n,
          v = j / n,
          p = point(u, v),
          a = point(Math.min(1, u + 0.001), v).sub(
            point(Math.max(0, u - 0.001), v),
          ),
          b = point(u, Math.min(1, v + 0.001)).sub(
            point(u, Math.max(0, v - 0.001)),
          ),
          normal = a.cross(b);
        if (normal.lengthSq() < 1e-14)
          throw new Error(
            'The NURBS net folds to a singularity. Separate its control rows.',
          );
        normals.push(normal.normalize());
        points.push(p);
      }
    const size = points.length,
      vertices = [
        ...points.map((p, i) =>
          p.clone().addScaledVector(normals[i], d.thickness / 2),
        ),
        ...points.map((p, i) =>
          p.clone().addScaledVector(normals[i], -d.thickness / 2),
        ),
      ],
      indices: number[] = [];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const a = i * (n + 1) + j,
          b = a + n + 1,
          c = b + 1,
          e = a + 1;
        indices.push(
          a,
          b,
          c,
          a,
          c,
          e,
          a + size,
          c + size,
          b + size,
          a + size,
          e + size,
          c + size,
        );
      }
    const perimeter: number[] = [];
    for (let i = 0; i < n; i++) perimeter.push(i * (n + 1));
    for (let j = 0; j < n; j++) perimeter.push(n * (n + 1) + j);
    for (let i = n; i > 0; i--) perimeter.push(i * (n + 1) + n);
    for (let j = n; j > 0; j--) perimeter.push(j);
    for (let i = 0; i < perimeter.length; i++) {
      const a = perimeter[i],
        b = perimeter[(i + 1) % perimeter.length];
      indices.push(a, b + size, b, a, a + size, b + size);
    }
    return closedOrganicMesh(m, vertices, indices, d.method);
  }
  if (d.method === 'organic_sweep') {
    const curve = new CatmullRomCurve3(d.path.map(vec), false, 'centripetal');
    const frames = curve.computeFrenetFrames(d.samples, false);
    const profile =
      d.profile === 'ellipse'
        ? Array.from(
            { length: 32 },
            (_, i) =>
              new Vector2(
                Math.cos((i * Math.PI) / 16) / 2,
                Math.sin((i * Math.PI) / 16) / 2,
              ),
          )
        : [
            new Vector2(-0.5, -0.5),
            new Vector2(0.5, -0.5),
            new Vector2(0.5, 0.5),
            new Vector2(-0.5, 0.5),
          ].flatMap((p, i, arr) =>
            Array.from({ length: 8 }, (_, j) =>
              p.clone().lerp(arr[(i + 1) % 4], j / 8),
            ),
          );
    const rings = Array.from({ length: d.samples + 1 }, (_, i) => {
      const t = i / d.samples,
        after = d.stations.findIndex((s) => s.at >= t),
        b = d.stations[Math.max(1, after)],
        a = d.stations[Math.max(0, after - 1)],
        f = (t - a.at) / (b.at - a.at),
        mix = (key: 'width' | 'depth' | 'twist') =>
          a[key] + (b[key] - a[key]) * f;
      const angle = (mix('twist') * Math.PI) / 180,
        n = frames.normals[i]
          .clone()
          .multiplyScalar(Math.cos(angle))
          .addScaledVector(frames.binormals[i], Math.sin(angle)),
        bin = frames.binormals[i]
          .clone()
          .multiplyScalar(Math.cos(angle))
          .addScaledVector(frames.normals[i], -Math.sin(angle));
      return profile.map((p) =>
        curve
          .getPointAt(t)
          .addScaledVector(n, p.x * mix('width'))
          .addScaledVector(bin, p.y * mix('depth')),
      );
    });
    return ringMesh(m, rings, [profile, profile], d.method);
  }
  if (d.method === 'smooth_loft') {
    const sampled = d.sections.map((s) => {
      const points = s.points.map((p) => new Vector3(p.x, s.y, p.z));
      if (ShapeUtils.area(s.points.map((p) => new Vector2(p.x, p.z))) < 0)
        points.reverse();
      if (d.smoothProfiles) {
        const c = new CatmullRomCurve3(points, true, 'centripetal');
        return Array.from({ length: d.samples }, (_, i) =>
          c.getPointAt(i / d.samples),
        );
      }
      const lengths = points.map((p, i) =>
          p.distanceTo(points[(i + 1) % points.length]),
        ),
        total = lengths.reduce((a, b) => a + b, 0);
      return Array.from({ length: d.samples }, (_, i) => {
        let dist = (i * total) / d.samples,
          k = 0;
        while (k < lengths.length - 1 && dist > lengths[k])
          dist -= lengths[k++];
        return points[k]
          .clone()
          .lerp(points[(k + 1) % points.length], dist / lengths[k]);
      });
    });
    if (d.alignProfiles)
      for (let row = 1; row < sampled.length; row++) {
        const normalize = (r: Vector3[]) => {
          const c = r
            .reduce((sum, p) => sum.add(p), new Vector3())
            .divideScalar(r.length);
          const scale = Math.max(
            ...r.map((p) => Math.hypot(p.x - c.x, p.z - c.z)),
          );
          return r.map(
            (p) => new Vector2((p.x - c.x) / scale, (p.z - c.z) / scale),
          );
        };
        const previous = normalize(sampled[row - 1]),
          current = normalize(sampled[row]);
        let best = 0,
          cost = Infinity;
        for (let shift = 0; shift < d.samples; shift++) {
          const score = previous.reduce(
            (sum, p, i) =>
              sum + p.distanceToSquared(current[(i + shift) % d.samples]),
            0,
          );
          if (score < cost) {
            cost = score;
            best = shift;
          }
        }
        sampled[row] = sampled[row].map(
          (_, i) => sampled[row][(i + best) % d.samples],
        );
      }
    const curves = Array.from(
      { length: d.samples },
      (_, i) =>
        new CatmullRomCurve3(
          sampled.map((row) => row[i]),
          false,
          'centripetal',
        ),
    );
    const steps = (d.sections.length - 1) * 8;
    const rings = Array.from({ length: steps + 1 }, (_, i) =>
      curves.map((c) => c.getPoint(i / steps)),
    );
    return ringMesh(
      m,
      rings,
      [sampled[0], sampled.at(-1)!].map((row) =>
        row.map((p) => new Vector2(p.x, p.z)),
      ),
      d.method,
    );
  }
  if (d.method === 'subdivision') return subdivision(m, d);
  return fieldMesh(m, d);
}
function subdivision(
  m: ManifoldToplevel,
  d: Extract<OrganicDefinition, { method: 'subdivision' }>,
) {
  let vertices = d.vertices.map(vec),
    faces = d.faces.map((f) => [...f]),
    creases = new Set(d.creases.map(([a, b]) => edge(a, b)));
  const base = Math.min(...vertices.map((v) => v.y));
  if (d.preserveBase)
    for (const f of faces)
      f.forEach((a, i) => {
        const b = f[(i + 1) % f.length];
        if (
          Math.abs(vertices[a].y - base) < 1e-8 &&
          Math.abs(vertices[b].y - base) < 1e-8
        )
          creases.add(edge(a, b));
      });
  for (let iteration = 0; iteration < d.iterations; iteration++) {
    const centers = faces.map((f) =>
      f
        .reduce((p, i) => p.add(vertices[i]), new Vector3())
        .divideScalar(f.length),
    );
    const edges = new Map<
        string,
        { a: number; b: number; faces: number[]; index: number }
      >(),
      adj = vertices.map(() => [] as number[]);
    faces.forEach((f, fi) => {
      f.forEach((a, i) => {
        adj[a].push(fi);
        const b = f[(i + 1) % f.length],
          key = edge(a, b);
        if (!edges.has(key)) edges.set(key, { a, b, faces: [], index: -1 });
        edges.get(key)!.faces.push(fi);
      });
    });
    const next = vertices.map((p, i) => {
      const joined = [...edges.entries()].filter(
        ([, e]) => e.a === i || e.b === i,
      );
      if (
        (d.preserveBase && Math.abs(p.y - base) < 1e-8) ||
        joined.some(([k]) => creases.has(k))
      )
        return p.clone();
      const n = adj[i].length,
        face = adj[i]
          .reduce((p, j) => p.add(centers[j]), new Vector3())
          .divideScalar(n),
        mid = joined
          .reduce(
            (p, [, e]) =>
              p.add(
                vertices[e.a].clone().add(vertices[e.b]).multiplyScalar(0.5),
              ),
            new Vector3(),
          )
          .divideScalar(joined.length);
      return face
        .addScaledVector(mid, 2)
        .addScaledVector(p, n - 3)
        .divideScalar(n);
    });
    for (const [key, e] of edges) {
      e.index = next.length;
      const point = vertices[e.a].clone().add(vertices[e.b]);
      if (creases.has(key)) point.multiplyScalar(0.5);
      else
        point
          .add(centers[e.faces[0]])
          .add(centers[e.faces[1]])
          .multiplyScalar(0.25);
      next.push(point);
    }
    const faceStart = next.length;
    next.push(...centers);
    const nextFaces: number[][] = [];
    faces.forEach((f, fi) =>
      f.forEach((a, i) =>
        nextFaces.push([
          a,
          edges.get(edge(a, f[(i + 1) % f.length]))!.index,
          faceStart + fi,
          edges.get(edge(a, f[(i + f.length - 1) % f.length]))!.index,
        ]),
      ),
    );
    const nextCreases = new Set<string>();
    for (const key of creases) {
      const e = edges.get(key)!;
      nextCreases.add(edge(e.a, e.index));
      nextCreases.add(edge(e.index, e.b));
    }
    vertices = next;
    faces = nextFaces;
    creases = nextCreases;
  }
  return closedOrganicMesh(
    m,
    vertices,
    faces.flatMap(([a, b, c, e]) => [a, b, c, a, c, e]),
    d.method,
  );
}
export const smoothMinimum = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
function fieldMesh(
  m: ManifoldToplevel,
  d: Extract<OrganicDefinition, { method: 'field' }>,
) {
  const positive = d.elements.filter((e) => !e.subtract);
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const e of positive) {
    const r =
      e.shape === 'capsule'
        ? Math.max(e.radii.x, e.endRadius)
        : Math.max(...Object.values(e.radii));
    for (const p of [e.center, e.shape === 'capsule' ? e.end : e.center])
      [p.x, p.y, p.z].forEach((v, i) => {
        min[i] = Math.min(min[i], v - r - d.blend);
        max[i] = Math.max(max[i], v + r + d.blend);
      });
  }
  if (
    max.reduce((n, v, i) => n * Math.ceil((v - min[i]) / d.resolution), 1) >
    250000
  )
    throw new Error(
      'This field is too dense. Increase resolution spacing or reduce its extent.',
    );
  const sdf = (e: (typeof d.elements)[number], p: number[]) => {
    if (e.shape === 'ellipsoid') {
      const q = [p[0] - e.center.x, p[1] - e.center.y, p[2] - e.center.z],
        r = [e.radii.x, e.radii.y, e.radii.z];
      const k0 = Math.hypot(...q.map((v, i) => v / r[i])),
        k1 = Math.hypot(...q.map((v, i) => v / (r[i] * r[i])));
      return k1 < 1e-9 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1;
    }
    const a = vec(e.center),
      ab = vec(e.end).sub(a),
      ap = new Vector3(...p).sub(a),
      t = Math.max(0, Math.min(1, ap.dot(ab) / (ab.lengthSq() || 1)));
    return (
      ap.addScaledVector(ab, -t).length() -
      (e.radii.x + (e.endRadius - e.radii.x) * t)
    );
  };
  const s = m.Manifold.levelSet(
    (p) => {
      let outer = Infinity,
        cut = Infinity;
      for (const e of d.elements) {
        const v = sdf(e, p);
        if (e.subtract) cut = smoothMinimum(cut, v, d.blend);
        else outer = smoothMinimum(outer, v, d.blend);
      }
      return -(Number.isFinite(cut)
        ? -smoothMinimum(-outer, cut, d.blend)
        : outer);
    },
    {
      min: min as [number, number, number],
      max: max as [number, number, number],
    },
    d.resolution,
  );
  try {
    return packOrganic(s, d.method);
  } finally {
    s.delete();
  }
}
