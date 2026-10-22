import { expect, it } from 'vitest';
import * as THREE from 'three';
import { makeVolume } from '../model';
import {
  acceleratePicking,
  renderSignature,
  responsiveView,
  importedTriangles,
} from './renderPerformance';

it('adapts dense imports without requiring a reduced mesh and allows an explicit override', () => {
  expect(responsiveView(undefined, 100_000)).toBe(true);
  expect(responsiveView('auto', 99_999)).toBe(false);
  expect(responsiveView('detail', 2_000_000)).toBe(false);
  expect(responsiveView('responsive', 12)).toBe(true);
  const v = {
    ...makeVolume(),
    geometry: {
      kind: 'mesh' as const,
      source: 'fbx',
      solid: false,
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2],
    },
  };
  expect(importedTriangles(v)).toBe(1);
  const signature = renderSignature(v);
  expect(
    renderSignature({
      ...v,
      name: 'Renamed',
      color: '#ffffff',
      position: { x: 20, y: 3, z: 2 },
      rotation: 90,
    }),
  ).toBe(signature);
  expect(
    renderSignature({ ...v, dimensions: { ...v.dimensions, width: 5 } }),
  ).not.toBe(signature);
  expect(
    renderSignature({ ...v, geometry: { ...v.geometry, indices: [2, 1, 0] } }),
  ).not.toBe(signature);
});

it('accelerates exact surface picking without changing any vertices, faces or face indices', () => {
  const geometry = new THREE.PlaneGeometry(20, 20, 110, 110);
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  const positions = geometry.attributes.position.array.slice();
  const indices = geometry.index!.array.slice();
  const ray = new THREE.Raycaster(
    new THREE.Vector3(1.23, 2.41, 10),
    new THREE.Vector3(0, 0, -1),
  );
  const original = ray.intersectObject(mesh);
  acceleratePicking(mesh);
  expect(geometry.boundsTree).toBeDefined();
  const accelerated = ray.intersectObject(mesh);
  expect(accelerated.length).toBe(original.length);
  expect(accelerated[0].point.distanceTo(original[0].point)).toBeLessThan(1e-9);
  expect(accelerated[0].faceIndex).toBe(original[0].faceIndex);
  expect(geometry.index!.array).toEqual(indices);
  expect(geometry.attributes.position.array).toEqual(positions);
  mesh.position.set(4, 5, 2);
  mesh.updateMatrixWorld();
  ray.ray.origin.set(5.23, 7.41, 12);
  expect(ray.intersectObject(mesh)[0].point.toArray()).toEqual([5.23, 7.41, 2]);
  geometry.dispose();
  material.dispose();
});
