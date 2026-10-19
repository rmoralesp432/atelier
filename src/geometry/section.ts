import { withSolid, getKernel, renderMeshData } from './kernel';
import { isFlat } from './spatial';
import { isReference } from '../imports/mesh';
import type { Volume } from '../model';
import type { SectionView } from '../studio/section';
// Compute only true cut faces of the material. Cavities and disconnected parts
// remain holes; there is no opaque rectangle pretending to cap the model.
export async function sectionCap(v: Volume, section: SectionView) {
  if (isFlat(v) || isReference(v)) return [];
  const axis = { x: 0, y: 1, z: 2 }[section.axis],
    normal: [number, number, number] = [0, 0, 0];
  normal[axis] = section.flip ? 1 : -1;
  const cap = (s: import('manifold-3d').Manifold) => {
    const cut = s.trimByPlane(normal, section.position * normal[axis]);
    try {
      if (cut.status() !== 'NoError')
        throw new Error('Section could not be evaluated.');
      const mesh = cut.getMesh(),
        positions: number[] = [];
      for (let i = 0; i < mesh.triVerts.length; i += 3) {
        const vertices = [0, 1, 2].map(
          (j) => mesh.triVerts[i + j] * mesh.numProp,
        );
        if (
          vertices.every(
            (k) =>
              Math.abs(mesh.vertProperties[k + axis] - section.position) < 1e-4,
          )
        )
          vertices.forEach((k) =>
            positions.push(...mesh.vertProperties.slice(k, k + 3)),
          );
      }
      return positions;
    } finally {
      cut.delete();
    }
  };
  if (v.geometry?.kind === 'building') {
    const m = await getKernel(),
      parts = await renderMeshData(v),
      result: number[] = [];
    for (const part of parts) {
      const allocated: import('manifold-3d').Manifold[] = [];
      try {
        let s = new m.Manifold(
          new m.Mesh({
            numProp: 3,
            vertProperties: part.positions,
            triVerts: part.indices,
          }),
        );
        allocated.push(s);
        s = s.rotate([0, v.rotation, 0]);
        allocated.push(s);
        s = s.translate([v.position.x, v.position.y, v.position.z]);
        allocated.push(s);
        result.push(...cap(s));
      } finally {
        allocated.reverse().forEach((s) => s.delete());
      }
    }
    return result;
  }
  return withSolid(v, cap);
}
