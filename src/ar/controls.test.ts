import { expect, it } from 'vitest';
import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  PerspectiveCamera,
  Vector3,
} from 'three';
import {
  bringModelInFront,
  floorDirections,
  transformAround,
} from './controls';

it('keeps a life-size rotated building ahead of the viewer and its near-edge pivot stable', () => {
  const anchor = new Group(),
    model = new Group(),
    camera = new PerspectiveCamera();
  model.add(new Mesh(new BoxGeometry(100, 8, 40)));
  model.children[0].position.set(20, 8, 10);
  model.rotation.y = Math.PI / 4;
  model.scale.setScalar(1);
  anchor.add(model);
  anchor.position.set(90, 3, -200);
  camera.position.set(10, 1.7, 12);
  camera.rotation.y = Math.PI / 3;
  const original = model.children[0].position.toArray();
  const pivot = bringModelInFront(anchor, model, camera);
  const { forward } = floorDirections(camera);
  const local = new Box3().setFromObject(model.children[0], true);
  // Every actual corner, rather than its world-aligned bounding box, is ahead.
  const distances: number[] = [];
  anchor.updateMatrixWorld(true);
  for (const x of [-50, 50])
    for (const z of [-20, 20]) {
      const corner = model.children[0].localToWorld(new Vector3(x, 0, z));
      distances.push(corner.sub(camera.position).dot(forward));
    }
  expect(Math.min(...distances)).toBeCloseTo(1);
  expect(anchor.position.y).toBe(3);
  const fixed = model.localToWorld(pivot.clone());
  transformAround(anchor, model, pivot, 0.01, -90);
  anchor.updateMatrixWorld(true);
  expect(model.localToWorld(pivot.clone()).distanceTo(fixed)).toBeLessThan(
    1e-10,
  );
  transformAround(anchor, model, pivot, 1, 90);
  anchor.updateMatrixWorld(true);
  expect(model.localToWorld(pivot.clone()).distanceTo(fixed)).toBeLessThan(
    1e-10,
  );
  expect(model.children[0].position.toArray()).toEqual(original);
  expect(local.isEmpty()).toBe(false);
  transformAround(anchor, model, pivot, NaN, 90);
  expect(model.scale.x).toBe(1);
  (model.children[0] as Mesh).geometry.dispose();
});

it('keeps camera-relative floor moves horizontal even when looking down', () => {
  const camera = new PerspectiveCamera();
  camera.rotation.set(-Math.PI / 3, Math.PI / 2, 0, 'YXZ');
  const { forward, right } = floorDirections(camera);
  expect(forward.y).toBe(0);
  expect(right.y).toBe(0);
  expect(forward.length()).toBeCloseTo(1);
  expect(forward.dot(right)).toBeCloseTo(0);
  expect(forward.x).toBeCloseTo(-1);
});
