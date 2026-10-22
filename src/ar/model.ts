import { cloneARView, setARTransparency, disposeARView } from './appearance';
import * as THREE from 'three';
import { isVisible, validateVolume, type Project, type Volume } from '../model';
import { isProfile, renderMeshData } from '../geometry/kernel';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { importedARChunks } from './meshChunks';
import {
  AR_TRIANGLE_LIMIT,
  prepareARPart,
  type ARPartJob,
  type ARMeshData,
} from './preparation';
export type ARPreparationOptions = {
  floorLevel?: number;
  triangleLimit?: number;
  selectedOnly?: boolean;
  signal?: AbortSignal;
  progress?: (message: string) => void;
  processPart?: (job: ARPartJob) => Promise<ARMeshData>;
};
// A cheap allocation estimate: never stringify mesh coordinates or retained operands.
function estimatedTriangles(v: Volume): number {
  const g = v.geometry;
  if (g?.kind === 'mesh') return g.indices.length / 3;
  if (g?.kind === 'form') return g.mesh.indices.length / 3;
  if (g?.kind === 'boolean')
    return g.operands.reduce((sum, v) => sum + estimatedTriangles(v), 0);
  if (g && 'source' in g) return Math.max(1000, estimatedTriangles(g.source));
  return !g || g.kind === 'box' ? 12 : 1000;
}
export function disposeARModel(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        m.dispose(),
      );
    }
  });
}
/** A detached, meter-based snapshot. No map imagery or private project upload. */
export async function createARModel(
  project: Project,
  origin?: { x: number; z: number },
  options: ARPreparationOptions = {},
): Promise<THREE.Group> {
  const root = new THREE.Group();
  const limit = options.triangleLimit ?? AR_TRIANGLE_LIMIT;
  if (!Number.isFinite(limit) || limit < 12 || limit > AR_TRIANGLE_LIMIT)
    throw new Error('Choose a supported AR detail limit.');
  if (
    options.floorLevel !== undefined &&
    (!Number.isFinite(options.floorLevel) ||
      Math.abs(options.floorLevel) > 2000)
  )
    throw new Error('Choose a valid AR floor level.');
  const selected = new Set(
    project.selectedIds?.length
      ? project.selectedIds
      : project.selectedId
        ? [project.selectedId]
        : [],
  );
  const volumes = project.volumes.filter(
    (v) =>
      isVisible(v, project) &&
      !isProfile(v) &&
      (!options.selectedOnly || selected.has(v.id)),
  );
  if (options.selectedOnly && !volumes.length)
    throw new Error(
      'Select an object before preparing selected objects for AR.',
    );
  const estimate = volumes.reduce((sum, v) => sum + estimatedTriangles(v), 0);
  let sourceTriangles = 0,
    outputTriangles = 0;
  try {
    for (const [n, v] of volumes.entries()) {
      options.signal?.throwIfAborted();
      validateVolume(v, false);
      options.progress?.(`Preparing ${n + 1} of ${volumes.length} · ${v.name}`);
      // Let progress/cancel paint before allocating a part, not after export.
      if (options.progress) await new Promise((r) => setTimeout(r, 0));
      options.signal?.throwIfAborted();
      if (
        options.floorLevel !== undefined &&
        v.position.y + v.dimensions.height < options.floorLevel
      )
        continue;
      const group = new THREE.Group();
      group.name = v.name;
      group.userData.id = v.id;
      group.position.set(
        v.position.x,
        v.position.y - (options.floorLevel ?? 0),
        v.position.z,
      );
      group.rotation.y = (v.rotation * Math.PI) / 180;
      root.add(group);
      if (v.geometry?.kind !== 'mesh' && estimatedTriangles(v) > 500_000)
        throw new Error(
          'This derived object is too complex for phone AR. Use a lighter imported copy or select simpler objects. The project is unchanged.',
        );
      const parts =
        v.geometry?.kind === 'mesh'
          ? importedARChunks(v)
          : await renderMeshData(v);
      const faces =
        v.geometry?.kind === 'mesh'
          ? v.geometry.indices.length / 3
          : (parts as import('../geometry/kernel').RenderPart[]).reduce(
              (sum, p) => sum + p.indices.length / 3,
              0,
            );
      const allocation = Math.max(
        12,
        // Leave room for unsimplifiable small components, cut boundaries and
        // triangle-pair rounding. The final limit is enforced independently.
        Math.floor(
          (limit * 0.9 * estimatedTriangles(v)) / Math.max(1, estimate),
        ),
      );
      for (const part of parts) {
        options.signal?.throwIfAborted();
        sourceTriangles += part.indices.length / 3;
        options.progress?.(
          `Preparing ${v.name} · ${sourceTriangles.toLocaleString()} triangles read`,
        );
        const data = await (options.processPart ?? prepareARPart)({
          positions: part.positions,
          indices: part.indices,
          target: Math.max(
            12,
            Math.floor(
              (allocation * part.indices.length) / 3 / Math.max(1, faces),
            ),
          ),
          cutY:
            options.floorLevel === undefined
              ? undefined
              : options.floorLevel - v.position.y,
        });
        options.signal?.throwIfAborted();
        if (!data.indices.length) continue;
        outputTriangles += data.indices.length / 3;
        if (outputTriangles > limit)
          throw new Error(
            'The AR copy is still too detailed for safe phone AR. Choose selected objects only or hide smaller details, then try again. Your project is unchanged.',
          );
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(data.positions, 3),
        );
        geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
        geometry.computeVertexNormals();
        const glass = part.material === 'glass',
          foliage = part.material === 'foliage';
        group.add(
          new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({
              color:
                part.material === 'frame' ? '#555b60' : (v.color ?? '#d9e3e2'),
              roughness: glass ? 0.15 : 0.75,
              metalness: 0,
              flatShading: true,
              transparent: glass || foliage,
              opacity: foliage ? 0.42 : glass ? 0.3 : 1,
              depthWrite: !glass && !foliage,
              side: THREE.DoubleSide,
            }),
          ),
        );
      }
      if (!group.children.length) root.remove(group);
    }
    if (!root.children.length)
      throw new Error(
        options.floorLevel === undefined
          ? 'Show a 3D object or extrude a shape before opening AR.'
          : 'Nothing remains above this floor level. Choose a lower level.',
      );
    const bounds = new THREE.Box3().setFromObject(root),
      center = bounds.getCenter(new THREE.Vector3());
    root.children.forEach((g) => {
      g.position.x -= origin?.x ?? center.x;
      g.position.z -= origin?.z ?? center.z;
    });
    root.userData.origin = origin ?? { x: center.x, z: center.z };
    root.userData.arPreparation = {
      sourceTriangles,
      outputTriangles,
      floorLevel: options.floorLevel,
      lowestPoint: bounds.min.y,
    };
    root.updateMatrixWorld(true);
    return root;
  } catch (error) {
    disposeARModel(root);
    throw error;
  }
}
export async function exportARModel(
  root: THREE.Group,
  scale: number,
  rotation = 0,
  transparent = false,
  heightOffset = 0,
): Promise<Uint8Array> {
  if (!Number.isFinite(scale) || scale < 0.001 || scale > 1)
    throw new Error('Choose a scale between 1:1000 and 1:1.');
  if (!Number.isFinite(rotation)) throw new Error('Choose a valid rotation.');
  if (!Number.isFinite(heightOffset) || Math.abs(heightOffset) > 1000)
    throw new Error('Choose an AR height adjustment between −1000 and 1000 m.');
  let triangles = 0,
    vertices = 0;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    triangles +=
      (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    vertices += o.geometry.attributes.position.count;
  });
  if (triangles > AR_TRIANGLE_LIMIT || vertices > AR_TRIANGLE_LIMIT * 3)
    throw new Error(
      'This AR copy exceeds the safe export limit. Prepare a lighter copy first.',
    );
  const scene = new THREE.Scene(),
    copy = cloneARView(root);
  setARTransparency(copy, transparent);
  copy.scale.setScalar(scale);
  copy.rotation.y = (rotation * Math.PI) / 180;
  // Offset is in project meters, so it follows the viewing ratio. Translate
  // only this detached export; never move the original project or rescale it.
  copy.position.y += heightOffset * scale;
  scene.add(copy);
  scene.updateMatrixWorld(true);
  try {
    return await new USDZExporter().parseAsync(scene, {
      quickLookCompatible: true,
    });
  } finally {
    disposeARView(copy);
  }
}
