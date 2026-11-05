import {
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  Ray,
  DoubleSide,
} from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { ManifoldToplevel } from 'manifold-3d';
import type { Volume, Dimensions, Vec3 } from '../model';
import type { MeshRecipe } from '../imports/mesh';
import { validateVolume } from '../model';
import { getKernel, withSolid } from './kernel';
import { closedOrganicMesh, packOrganic, smoothMinimum } from './organic';
import { sculptSettingsSchema, type SculptSettings } from './sculptSchema';
export type SculptRecipe = {
  kind: 'sculpt';
  source: Volume;
  settings: SculptSettings;
  mesh: MeshRecipe;
  origin: Vec3;
  base: Dimensions;
};
export type BlendRecipe = {
  kind: 'blend';
  operands: Volume[];
  operation: 'union' | 'subtract' | 'intersect';
  radius: number;
  resolution: number;
  mesh: MeshRecipe;
  origin: Vec3;
  base: Dimensions;
};
function shifted(v: Volume, delta: Vec3) {
  const a = (v.rotation * Math.PI) / 180;
  return {
    x: v.position.x + delta.x * Math.cos(a) + delta.z * Math.sin(a),
    y: v.position.y + delta.y,
    z: v.position.z - delta.x * Math.sin(a) + delta.z * Math.cos(a),
  };
}
/** Evaluate from the retained original when changing the last brush, not from
 * an already distorted approximation. Mesh output is cached like other forms. */
export async function sculptVolume(
  v: Volume,
  settings: SculptSettings,
  replaceLast: boolean,
): Promise<Volume> {
  sculptSettingsSchema.parse(settings);
  const prior =
    replaceLast && v.geometry?.kind === 'sculpt' ? v.geometry : null;
  if (replaceLast && !prior)
    throw new Error('This object has no retained sculpt operation to adjust.');
  const source = prior?.source ?? v,
    m = await getKernel();
  const result = await withSolid(
    source,
    (s) => {
      if (s.numTri() > 40000)
        throw new Error(
          'Sculpting needs a control form or a solid under 40,000 triangles. The imported model remains unchanged.',
        );
      const length = Math.max(
        settings.radius / 4,
        Math.max(...Object.values(source.dimensions)) / 24,
      );
      const refined = s.refineToLength(length);
      try {
        if (refined.numTri() > 120000)
          throw new Error(
            'The sculpt brush would exceed its editing budget. Increase its radius.',
          );
        const mesh = refined.getMesh(),
          points = Array.from(
            { length: mesh.numVert },
            (_, i) =>
              new Vector3(
                mesh.vertProperties[i * mesh.numProp],
                mesh.vertProperties[i * mesh.numProp + 1],
                mesh.vertProperties[i * mesh.numProp + 2],
              ),
          ),
          indices = Array.from(mesh.triVerts);
        const g = new BufferGeometry();
        g.setAttribute(
          'position',
          new Float32BufferAttribute(
            points.flatMap((p) => p.toArray()),
            3,
          ),
        );
        g.setIndex(indices);
        g.computeVertexNormals();
        const normals = g.getAttribute('normal'),
          center = new Vector3(
            settings.center.x * source.dimensions.width,
            settings.center.y * source.dimensions.height,
            settings.center.z * source.dimensions.depth,
          );
        const smooth = (t: number) => {
          t = Math.min(1, Math.max(0, t));
          return t * t * (3 - 2 * t);
        };
        points.forEach((p, i) => {
          const r = p.distanceTo(center) / settings.radius;
          if (r >= 1) return;
          let weight = (1 - r * r) ** 2;
          if (settings.preserveBase)
            weight *= smooth(
              p.y / Math.max(0.01, source.dimensions.height * 0.12),
            );
          if (settings.mode === 'pull')
            p.addScaledVector(
              new Vector3(settings.delta.x, settings.delta.y, settings.delta.z),
              weight,
            );
          else if (settings.mode === 'inflate')
            p.addScaledVector(
              new Vector3().fromBufferAttribute(normals, i),
              settings.strength * weight,
            );
          else {
            const angle = (settings.strength * weight * Math.PI) / 180,
              x = p.x - center.x,
              z = p.z - center.z;
            p.x = center.x + x * Math.cos(angle) + z * Math.sin(angle);
            p.z = center.z - x * Math.sin(angle) + z * Math.cos(angle);
          }
        });
        g.dispose();
        return closedOrganicMesh(m, points, indices, 'sculpt');
      } finally {
        refined.delete();
      }
    },
    false,
  );
  const scale = prior
    ? {
        x: v.dimensions.width / prior.base.width,
        y: v.dimensions.height / prior.base.height,
        z: v.dimensions.depth / prior.base.depth,
      }
    : { x: 1, y: 1, z: 1 };
  const old = prior?.origin ?? { x: 0, y: 0, z: 0 };
  const next: Volume = {
    ...v,
    position: shifted(v, {
      x: (result.origin.x - old.x) * scale.x,
      y: (result.origin.y - old.y) * scale.y,
      z: (result.origin.z - old.z) * scale.z,
    }),
    dimensions: {
      width: result.dimensions.width * scale.x,
      height: result.dimensions.height * scale.y,
      depth: result.dimensions.depth * scale.z,
    },
    geometry: {
      kind: 'sculpt',
      source: structuredClone(source),
      settings,
      mesh: result.mesh,
      base: result.dimensions,
      origin: result.origin,
    },
  };
  validateVolume(next);
  return next;
}
async function distanceField(v: Volume) {
  return withSolid(v, (s) => {
    if (s.numTri() > 40000)
      throw new Error(
        'Smooth blending is for conceptual solids under 40,000 triangles each. Detailed imports remain unchanged.',
      );
    const raw = s.getMesh(),
      positions: number[] = [];
    for (let i = 0; i < raw.numVert; i++)
      positions.push(
        ...raw.vertProperties.slice(i * raw.numProp, i * raw.numProp + 3),
      );
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setIndex(Array.from(raw.triVerts));
    const bvh = new MeshBVH(geometry),
      point = new Vector3(),
      ray = new Ray(),
      direction = new Vector3(0.173, 0.941, 0.291).normalize();
    return {
      bounds: s.boundingBox(),
      dispose: () => geometry.dispose(),
      distance: (p: number[]) => {
        point.set(p[0], p[1], p[2]);
        const nearest = bvh.closestPointToPoint(point);
        if (!nearest) throw new Error('Could not evaluate this solid.');
        if (nearest.distance < 1e-7) return 0;
        ray.set(point, direction);
        const hits = bvh
          .raycast(ray, DoubleSide)
          .map((h) => h.distance)
          .sort((a, b) => a - b);
        let count = 0,
          last = -Infinity;
        for (const h of hits)
          if (h > 1e-7 && h - last > 1e-6) {
            count++;
            last = h;
          }
        return count % 2 ? -nearest.distance : nearest.distance;
      },
    };
  });
}
export async function smoothBoolean(
  volumes: Volume[],
  operation: BlendRecipe['operation'],
  radius: number,
  resolution: number,
): Promise<Volume> {
  const m: ManifoldToplevel = await getKernel(),
    fields: Awaited<ReturnType<typeof distanceField>>[] = [];
  try {
    for (const v of volumes) fields.push(await distanceField(v));
    const min = [0, 1, 2].map(
        (a) =>
          Math.min(...fields.map((f) => f.bounds.min[a])) -
          radius -
          resolution * 2,
      ),
      max = [0, 1, 2].map(
        (a) =>
          Math.max(...fields.map((f) => f.bounds.max[a])) +
          radius +
          resolution * 2,
      );
    if (
      max.reduce((n, v, i) => n * Math.ceil((v - min[i]) / resolution), 1) >
      150000
    )
      throw new Error(
        'Smooth blending would exceed its sampling budget. Increase spacing or blend a smaller part.',
      );
    const sampled = m.Manifold.levelSet(
      (p) => {
        let value = fields[0].distance(p);
        for (const field of fields.slice(1)) {
          const b = field.distance(p);
          value =
            operation === 'union'
              ? smoothMinimum(value, b, radius)
              : operation === 'intersect'
                ? -smoothMinimum(-value, -b, radius)
                : -smoothMinimum(-value, b, radius);
        }
        return -value;
      },
      {
        min: min as [number, number, number],
        max: max as [number, number, number],
      },
      resolution,
    );
    // Smooth unions may expand below their original floor. Preserve the lowest
    // source datum with a real planar cut, never a bounding-box rescale.
    const datum = Math.min(...fields.map((f) => f.bounds.min[1]));
    const solid = sampled.trimByPlane([0, 1, 0], datum);
    sampled.delete();
    try {
      const result = packOrganic(solid, 'smooth-boolean');
      if (operation === 'union') {
        const parts = solid.decompose();
        const count = parts.length;
        parts.forEach((p) => p.delete());
        if (count > 1)
          throw new Error(
            'The volumes remain disconnected. Move them together or increase the blend radius.',
          );
      }
      const v: Volume = {
        ...volumes[0],
        rotation: 0,
        position: result.origin,
        dimensions: result.dimensions,
        geometry: {
          kind: 'blend',
          operands: structuredClone(volumes),
          operation,
          radius,
          resolution,
          mesh: result.mesh,
          origin: result.origin,
          base: result.dimensions,
        },
      };
      validateVolume(v);
      return v;
    } finally {
      solid.delete();
    }
  } finally {
    fields.forEach((f) => f.dispose());
  }
}

export async function reviseBlend(
  v: Volume,
  radius: number,
  resolution: number,
): Promise<Volume> {
  const g = v.geometry;
  if (g?.kind !== 'blend')
    throw new Error('Choose an existing smooth blend to adjust.');
  const next = await smoothBoolean(g.operands, g.operation, radius, resolution);
  const scale = {
    x: v.dimensions.width / g.base.width,
    y: v.dimensions.height / g.base.height,
    z: v.dimensions.depth / g.base.depth,
  };
  const result = {
    ...v,
    geometry: next.geometry,
    dimensions: {
      width: next.dimensions.width * scale.x,
      height: next.dimensions.height * scale.y,
      depth: next.dimensions.depth * scale.z,
    },
    position: shifted(v, {
      x: (next.position.x - g.origin.x) * scale.x,
      y: (next.position.y - g.origin.y) * scale.y,
      z: (next.position.z - g.origin.z) * scale.z,
    }),
  };
  validateVolume(result);
  return result;
}
