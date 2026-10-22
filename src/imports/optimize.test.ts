import { expect, it } from 'vitest';
import * as THREE from 'three';
import { optimizeGeometry } from './optimize';
import { extractMeshAsset, prepareImport } from './mesh';

it('compacts repeated OBJ positions without removing any full-detail face', async () => {
  const original = new THREE.BoxGeometry(20, 8, 10, 20, 20, 20).toNonIndexed();
  const { geometry } = await optimizeGeometry(original, 100, false);
  expect(geometry.index!.count).toBe(original.attributes.position.count);
  expect(geometry.attributes.position.count).toBeLessThan(
    original.attributes.position.count,
  );
  for (let i = 0; i < geometry.index!.count; i++)
    for (let axis = 0; axis < 3; axis++)
      expect(
        geometry.attributes.position.getComponent(
          geometry.index!.getX(i),
          axis,
        ),
      ).toBeCloseTo(original.attributes.position.getComponent(i, axis), 12);
});

it('reduces a copy, retains open boundaries, dimensions, element identity, colors and placement', async () => {
  const root = new THREE.Group();
  root.userData.unitScaleFactor = 100;
  for (let i = 0; i < 2; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 10, 240, 240),
      new THREE.MeshStandardMaterial({ color: i ? '#aa3311' : '#1122aa' }),
    );
    mesh.name = `Panel ${i + 1}`;
    mesh.position.set(i * 30, 5, 3);
    root.add(mesh);
  }
  const asset = await extractMeshAsset(root, 'Assembly.fbx', 'fbx', 'light');
  expect(asset.sourceTriangles).toBe(230400);
  expect(asset.indices.length / 3).toBeLessThanOrEqual(100000);
  expect(asset.parts?.map((p) => p.name)).toEqual(['Panel 1', 'Panel 2']);
  expect(asset.parts?.map((p) => p.color)).toEqual(['#1122aa', '#aa3311']);
  // Every original boundary vertex survives, not just bounding-box corners.
  const p = asset.parts![0].positions;
  const boundary = new Set<string>();
  for (let i = 0; i < p.length; i += 3) {
    if (Math.abs(p[i]) === 10 || p[i + 1] === 0 || p[i + 1] === 10)
      boundary.add(`${p[i]},${p[i + 1]}`);
  }
  expect(boundary.size).toBe(960);
  const prepared = await prepareImport(
    asset,
    { units: 'source', up: 'Y' },
    true,
    false,
  );
  expect(prepared.dimensions.width).toBe(50);
  expect(prepared.dimensions.height).toBe(10);
  expect(prepared.volumes[1].position.x - prepared.volumes[0].position.x).toBe(
    30,
  );
});

it('rejects oversized geometry before reading vertex data and does not strip morph checks', async () => {
  const geometry = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(new Float32Array(9), 3);
  Object.defineProperty(attr, 'count', { value: 15_000_003 });
  geometry.setAttribute('position', attr);
  await expect(
    extractMeshAsset(new THREE.Mesh(geometry), 'huge.obj', 'obj'),
  ).rejects.toThrow('5,000,000');
  const morphed = new THREE.BoxGeometry(1, 1, 1, 20, 20, 20);
  morphed.morphAttributes.position = [morphed.attributes.position.clone()];
  await expect(
    extractMeshAsset(new THREE.Mesh(morphed), 'animated.fbx', 'fbx', 'light'),
  ).rejects.toThrow('morph targets');
});

it('reduces unindexed OBJ/STL-style surfaces instead of treating duplicate face vertices as locked seams', async () => {
  const original = new THREE.PlaneGeometry(30, 30, 180, 180).toNonIndexed();
  const p = original.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) / 10));
  const { geometry } = await optimizeGeometry(original, 10000, true);
  expect(geometry.index!.count / 3).toBeLessThanOrEqual(10000);
  geometry.computeBoundingBox();
  original.computeBoundingBox();
  expect(geometry.boundingBox!.min.toArray()).toEqual(
    original.boundingBox!.min.toArray(),
  );
  expect(geometry.boundingBox!.max.toArray()).toEqual(
    original.boundingBox!.max.toArray(),
  );
});

it('preserves world-axis extents when reducing a rotated FBX element', async () => {
  const source = new THREE.SphereGeometry(5, 128, 64);
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(2, 3, 7),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.31, 0.67, 0.15)),
    new THREE.Vector3(1, 2, 1),
  );
  const { geometry } = await optimizeGeometry(source, 1000, true, matrix);
  const bounds = (g: THREE.BufferGeometry) => {
    const b = new THREE.Box3(),
      p = g.attributes.position,
      v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++)
      b.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(matrix));
    return b;
  };
  expect(geometry.index!.count).toBeLessThan(source.index!.count);
  expect(bounds(geometry)).toEqual(bounds(source));
});
