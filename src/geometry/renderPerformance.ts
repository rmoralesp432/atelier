import * as THREE from 'three';
import { acceleratedRaycast, MeshBVH } from 'three-mesh-bvh';
import type { Volume } from '../model';

export type ViewQuality = 'auto' | 'detail' | 'responsive';
export const DENSE_SCENE_TRIANGLES = 100_000;
export const INDEXED_PART_TRIANGLES = 20_000;

/** Immutable recipes: weak identity keys avoid serializing millions of coordinates
 * on selection, color, position, camera, or tool updates without retaining them. */
const identities = new WeakMap<object, number>();
let nextIdentity = 0;
function identity(value: object | undefined) {
  if (!value) return 0;
  if (!identities.has(value)) identities.set(value, ++nextIdentity);
  return identities.get(value)!;
}
export function renderSignature(v: Volume) {
  return JSON.stringify([
    v.dimensions,
    identity(v.geometry),
    v.display,
    v.material,
  ]);
}
export function importedTriangles(v: Volume): number {
  const g = v.geometry;
  if (g?.kind === 'mesh') return g.indices.length / 3;
  if (g && 'source' in g && typeof g.source === 'object')
    return importedTriangles(g.source);
  return 0;
}
export function responsiveView(
  quality: ViewQuality | undefined,
  triangles: number,
) {
  return (
    quality === 'responsive' ||
    (quality !== 'detail' && triangles >= DENSE_SCENE_TRIANGLES)
  );
}

/** The BVH is render-only and indirect: neither saved mesh nor triangle order
 * changes. Other meshes retain Three's standard raycaster. */
export function acceleratePicking(mesh: THREE.Mesh) {
  if ((mesh.geometry.index?.count ?? 0) / 3 < INDEXED_PART_TRIANGLES) return;
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
  mesh.geometry.boundsTree = new MeshBVH(mesh.geometry, { indirect: true });
  mesh.raycast = acceleratedRaycast;
}
