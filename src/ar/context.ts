import { Box3, Camera, Group, Quaternion, Vector3 } from 'three';
import type { CameraContext } from '../intelligence/context';
/** Convert the tracked camera into project axes, undoing the AR viewing rotation. */
export function arCameraContext(model: Group, camera: Camera): CameraContext {
  model.updateWorldMatrix(true, true);
  camera.updateMatrixWorld(true);
  const inverse = model.getWorldQuaternion(new Quaternion()).invert();
  const right = new Vector3(1, 0, 0)
    .applyQuaternion(camera.quaternion)
    .applyQuaternion(inverse);
  right.y = 0;
  if (right.lengthSq() < 0.000001) right.set(1, 0, 0);
  right.normalize();
  const forward = new Vector3(right.z, 0, -right.x);
  const visible = model.children.flatMap((group) => {
    if (!group.userData.id || !group.visible) return [];
    const center = new Box3()
      .setFromObject(group)
      .getCenter(new Vector3())
      .project(camera);
    return center.z >= -1 &&
      center.z <= 1 &&
      Math.abs(center.x) <= 1 &&
      Math.abs(center.y) <= 1
      ? [{ id: group.userData.id as string, x: center.x, y: center.y }]
      : [];
  });
  return {
    right: { x: right.x, y: 0, z: right.z },
    forward: { x: forward.x, y: 0, z: forward.z },
    visible,
  };
}
