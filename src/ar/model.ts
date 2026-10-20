import * as THREE from 'three';
import { isVisible, type Project } from '../model';
import { isProfile, renderMeshData } from '../geometry/kernel';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
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
): Promise<THREE.Group> {
  const root = new THREE.Group();
  try {
    for (const v of project.volumes.filter(
      (v) => isVisible(v, project) && !isProfile(v),
    )) {
      const group = new THREE.Group();
      group.name = v.name;
      group.userData.id = v.id;
      group.position.set(v.position.x, v.position.y, v.position.z);
      group.rotation.y = (v.rotation * Math.PI) / 180;
      root.add(group);
      for (const part of await renderMeshData(v)) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(part.positions, 3),
        );
        geometry.setIndex(new THREE.BufferAttribute(part.indices, 1));
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
    }
    if (!root.children.length)
      throw new Error('Show a 3D object or extrude a shape before opening AR.');
    const bounds = new THREE.Box3().setFromObject(root),
      center = bounds.getCenter(new THREE.Vector3());
    root.children.forEach((g) => {
      g.position.x -= origin?.x ?? center.x;
      g.position.z -= origin?.z ?? center.z;
    });
    root.userData.origin = origin ?? { x: center.x, z: center.z };
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
): Promise<Uint8Array> {
  if (!Number.isFinite(scale) || scale < 0.001 || scale > 1)
    throw new Error('Choose a scale between 1:1000 and 1:1.');
  if (!Number.isFinite(rotation)) throw new Error('Choose a valid rotation.');
  const scene = new THREE.Scene(),
    copy = root.clone(true);
  copy.scale.setScalar(scale);
  copy.rotation.y = (rotation * Math.PI) / 180;
  scene.add(copy);
  scene.updateMatrixWorld(true);
  return new USDZExporter().parseAsync(scene, { quickLookCompatible: true });
}
