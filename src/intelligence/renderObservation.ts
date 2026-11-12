import * as THREE from 'three';
import { isVisible, type Project } from '../model';
import { isProfile, renderMeshData } from '../geometry/kernel';
import type { SceneObservation } from './observation';

/** Independent neutral study views of the actual working geometry, not the live
 * camera, UI, site map or a generated illustration. Never emit partial renders. */
export async function renderObservation(
  project: Project,
  signal?: AbortSignal,
): Promise<SceneObservation> {
  const unavailable = (note: string): SceneObservation => ({
    status: 'unavailable',
    note,
    objectIds: [],
    views: [],
  });
  const volumes = project.volumes.filter((v) => isVisible(v, project));
  if (!volumes.length) return unavailable('No visible geometry to render.');
  // Preflight dense imported buffers before copying them to a second GPU context.
  if (
    volumes.reduce(
      (n, v) =>
        n + (v.geometry?.kind === 'mesh' ? v.geometry.indices.length / 3 : 0),
      0,
    ) > 500000
  )
    return unavailable(
      'Visual observation skipped: dense mesh budget exceeded. Use structured measurements; no visual inspection was performed.',
    );
  let renderer: THREE.WebGLRenderer | undefined;
  const scene = new THREE.Scene(),
    geometries: THREE.BufferGeometry[] = [],
    materials: THREE.Material[] = [];
  const stop = () => {
    if (signal?.aborted) throw new Error('Observation cancelled.');
  };
  try {
    stop();
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: false,
    });
    renderer.setSize(640, 640);
    renderer.setPixelRatio(1);
    scene.background = new THREE.Color('#e9edf0');
    scene.add(new THREE.HemisphereLight(0xffffff, 0x687078, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(30, 50, 20);
    scene.add(sun);
    let triangles = 0;
    for (const v of volumes) {
      stop();
      const group = new THREE.Group();
      group.position.set(v.position.x, v.position.y, v.position.z);
      group.rotation.y = (v.rotation * Math.PI) / 180;
      const parts = isProfile(v) ? null : await renderMeshData(v);
      const meshes: { geometry: THREE.BufferGeometry; glass: boolean }[] = [];
      if (parts) {
        for (const part of parts) {
          triangles += part.indices.length / 3;
          if (triangles > 500000)
            throw new Error('Observation geometry budget exceeded.');
          const g = new THREE.BufferGeometry();
          geometries.push(g);
          g.setAttribute(
            'position',
            new THREE.BufferAttribute(part.positions, 3),
          );
          g.setIndex(new THREE.BufferAttribute(part.indices, 1));
          g.computeVertexNormals();
          meshes.push({
            geometry: g,
            glass: part.material === 'glass' || part.material === 'foliage',
          });
        }
      } else {
        const polygon = v.geometry?.kind === 'polygon' ? v.geometry : null;
        const g = polygon
          ? new THREE.ShapeGeometry(
              new THREE.Shape(
                polygon.points.map((p) => new THREE.Vector2(p.x, -p.z)),
              ),
            )
          : v.geometry?.kind === 'circle'
            ? new THREE.CircleGeometry(1, 64)
            : new THREE.PlaneGeometry(2, 2);
        geometries.push(g);
        g.rotateX(-Math.PI / 2);
        g.scale(
          v.dimensions.width / (polygon ? 1 : 2),
          1,
          v.dimensions.depth / (polygon ? 1 : 2),
        );
        meshes.push({ geometry: g, glass: false });
      }
      for (const { geometry, glass } of meshes) {
        const material = new THREE.MeshStandardMaterial({
          color: v.color ?? '#d7dbdf',
          roughness: 0.8,
          flatShading: !v.geometry || v.geometry.kind === 'polygon',
          side: THREE.DoubleSide,
          transparent: glass,
          opacity: glass ? 0.35 : 1,
          depthWrite: !glass,
        });
        materials.push(material);
        group.add(new THREE.Mesh(geometry, material));
      }
      scene.add(group);
    }
    const box = new THREE.Box3().setFromObject(scene),
      center = box.getCenter(new THREE.Vector3()),
      radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.5);
    const camera = new THREE.OrthographicCamera(
      -radius * 1.12,
      radius * 1.12,
      radius * 1.12,
      -radius * 1.12,
      0.01,
      radius * 12,
    );
    const views: SceneObservation['views'] = [];
    for (const [label, dir] of [
      [
        'Oblique study; camera at project +X,+Y,+Z; Y is up',
        new THREE.Vector3(1, 0.8, 1),
      ],
      ['Plan; project north (-Z) is up', new THREE.Vector3(0, 1, 0)],
    ] as const) {
      stop();
      camera.position
        .copy(center)
        .addScaledVector(dir.clone().normalize(), radius * 4);
      camera.up.set(0, dir.y === 1 ? 0 : 1, dir.y === 1 ? -1 : 0);
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      const image = renderer.domElement.toDataURL('image/jpeg', 0.78);
      if (image.length > 800000)
        throw new Error('Observation image budget exceeded.');
      views.push({ label, image });
    }
    return {
      status: 'ready',
      note: 'Actual visible provisional geometry in neutral study views. Site, solar lighting, sections, exploded display and live-camera surroundings are not represented. Check dimensions using scene facts.',
      objectIds: volumes.map((v) => v.id),
      views,
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return unavailable(
      `Visual observation unavailable: ${error instanceof Error ? error.message : 'render failed'}`.slice(
        0,
        600,
      ),
    );
  } finally {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
}
