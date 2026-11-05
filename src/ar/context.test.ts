import { expect, it } from 'vitest';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
} from 'three';
import { arCameraContext } from './context';
import { directionVector } from '../intelligence/context';
it('maps AR right to the rotated project and identifies actual visible object IDs', () => {
  const model = new Group(),
    object = new Group();
  object.userData.id = 'building';
  object.add(new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial()));
  model.add(object);
  model.rotation.y = Math.PI / 2;
  model.scale.setScalar(0.1);
  const camera = new PerspectiveCamera(60, 1, 0.01, 100);
  camera.position.z = 2;
  camera.lookAt(0, 0, 0);
  const context = arCameraContext(model, camera);
  expect(context.visible).toHaveLength(1);
  expect(context.visible[0].id).toBe('building');
  const right = directionVector('right', context);
  expect(right.x).toBeCloseTo(0);
  expect(right.z).toBeCloseTo(1);
  camera.rotation.y = Math.PI;
  expect(arCameraContext(model, camera).visible).toHaveLength(0);
  (object.children[0] as Mesh).geometry.dispose();
});
