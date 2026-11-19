import { Matrix4, Vector3 } from 'three';
import type { Manifold } from 'manifold-3d';
import type { Volume } from '../model';
import { getKernel, withSolid } from '../geometry/kernel';
import { isFlat } from '../geometry/spatial';

/** Occupied-solid evidence, not recipe classification. Round shapes are metric:
 * sphere means one radius; cylinder means a right, circular cylinder. Ellipsoid
 * and elliptic_cylinder explicitly allow independent transverse radii.
 * Fits allow 2% curved tessellation-volume error (box 0.001%). */
export async function shapeEvidence(
  v: Volume,
  kind: string,
): Promise<{
  met: boolean | undefined;
  diameter?: number;
}> {
  if (
    !['box', 'sphere', 'cylinder', 'ellipsoid', 'elliptic_cylinder'].includes(
      kind,
    )
  )
    return { met: undefined };
  if (isFlat(v)) return { met: false };
  const m = await getKernel();
  return withSolid(v, (solid) => {
    const mesh = solid.getMesh();
    if (mesh.numVert > 150_000) return { met: undefined };
    const points = Array.from({ length: mesh.numVert }, (_, i) =>
      new Vector3().fromArray(mesh.vertProperties, i * mesh.numProp),
    );
    if (!points.length || solid.volume() <= 0) return { met: undefined };
    const frames: Matrix4[] = [
      new Matrix4(),
      new Matrix4().makeRotationY((v.rotation * Math.PI) / 180),
    ];
    if (kind !== 'sphere') {
      // Recover support frames from actual faces, including baked rotations.
      // Frames only propose a fit; the occupied solid must still match.
      const normals: { n: Vector3; edge: Vector3; area: number }[] = [];
      for (let i = 0; i < mesh.triVerts.length; i += 3) {
        const a = points[mesh.triVerts[i]],
          b = points[mesh.triVerts[i + 1]],
          c = points[mesh.triVerts[i + 2]];
        const edge = b.clone().sub(a),
          n = edge.clone().cross(c.clone().sub(a));
        const area = n.length();
        if (area < 1e-12) continue;
        n.divideScalar(area);
        const found = normals.find((p) => Math.abs(p.n.dot(n)) > 1 - 1e-6);
        if (found) found.area += area;
        else if (normals.length < 128)
          normals.push({ n, edge: edge.normalize(), area });
      }
      normals.sort((a, b) => b.area - a.area);
      for (const { n: y, edge } of normals.slice(0, kind === 'box' ? 12 : 96)) {
        const x = edge.clone().addScaledVector(y, -edge.dot(y)).normalize();
        frames.push(new Matrix4().makeBasis(x, y, x.clone().cross(y)));
      }
    }
    for (const frame of frames) {
      const inverse = frame.clone().transpose();
      const local = points.map((p) => p.clone().applyMatrix4(inverse));
      const min = new Vector3(Infinity, Infinity, Infinity),
        max = new Vector3(-Infinity, -Infinity, -Infinity);
      for (const p of local) {
        min.min(p);
        max.max(p);
      }
      const size = max.clone().sub(min),
        center = min.clone().add(max).multiplyScalar(0.5);
      if (Math.min(size.x, size.y, size.z) <= 0) continue;
      const round = kind === 'sphere' || kind === 'cylinder';
      const extents =
        kind === 'sphere' ? [size.x, size.y, size.z] : [size.x, size.z];
      // Rotated tessellations slightly undershoot ideal bounds. Never fit
      // independently scaled radii for a round requirement.
      if (
        round &&
        Math.max(...extents) - Math.min(...extents) >
          Math.max(...extents) * 0.005 + 1e-7
      ) {
        if (kind === 'sphere') return { met: false };
        continue;
      }
      let radius = 0;
      for (const p of local)
        radius = Math.max(
          radius,
          kind === 'sphere'
            ? p.distanceTo(center)
            : Math.hypot(p.x - center.x, p.z - center.z),
        );
      if (
        kind === 'sphere' &&
        local.some(
          (p) =>
            Math.abs(p.distanceTo(center) - radius) > radius * 0.005 + 1e-7,
        )
      )
        return { met: false };
      const allocated: Manifold[] = [];
      const keep = (s: Manifold) => {
        allocated.push(s);
        return s;
      };
      try {
        let reference: Manifold;
        if (kind === 'box')
          reference = keep(m.Manifold.cube([size.x, size.y, size.z], true));
        else if (kind === 'sphere' || kind === 'ellipsoid') {
          reference = keep(m.Manifold.sphere(1, 48));
          reference = keep(
            reference.scale(
              kind === 'sphere'
                ? [radius, radius, radius]
                : [size.x / 2, size.y / 2, size.z / 2],
            ),
          );
        } else {
          reference = keep(m.Manifold.cylinder(size.y, 1, 1, 64, true));
          reference = keep(reference.rotate([-90, 0, 0]));
          reference = keep(
            reference.scale(
              kind === 'cylinder'
                ? [radius, 1, radius]
                : [size.x / 2, 1, size.z / 2],
            ),
          );
        }
        reference = keep(reference.translate([center.x, center.y, center.z]));
        reference = keep(
          reference.transform(
            frame.elements as Parameters<Manifold['transform']>[0],
          ),
        );
        const intersection = keep(solid.intersect(reference));
        if (intersection.status() !== 'NoError') continue;
        const difference = Math.max(
          0,
          solid.volume() + reference.volume() - 2 * intersection.volume(),
        );
        if (
          difference <=
          Math.max(
            1e-10,
            reference.volume() * (kind === 'box' ? 0.00001 : 0.02),
          )
        )
          return { met: true, ...(round ? { diameter: 2 * radius } : {}) };
      } finally {
        allocated.reverse().forEach((s) => s.delete());
      }
    }
    // Frame-search failure cannot disprove an unfamiliar mesh. Canonical
    // primitives have an explicit frame, so their failed fit is conclusive.
    return {
      met: ['box', 'sphere', 'cylinder'].includes(v.geometry?.kind ?? 'box')
        ? false
        : undefined,
    };
  });
}
