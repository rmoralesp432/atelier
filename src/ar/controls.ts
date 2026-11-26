import { Box3, Group, Object3D, PerspectiveCamera, Vector3 } from 'three';

export const AR_SCALES = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
export const normalizeRotation = (degrees: number) =>
  ((((degrees + 180) % 360) + 360) % 360) - 180;
const up = new Vector3(0, 1, 0);

/** Bounds in project meters, independent of the viewing transform. */
export function modelBounds(model: Group) {
  const copy = model.clone(true);
  copy.position.set(0, 0, 0);
  copy.rotation.set(0, 0, 0);
  copy.scale.setScalar(1);
  return new Box3().setFromObject(copy);
}

/** Keep a chosen floor point fixed while scaling or turning a large model. */
export function transformAround(
  anchor: Group,
  model: Group,
  pivot: Vector3,
  scale: number,
  degrees: number,
) {
  if (
    !Number.isFinite(scale) ||
    scale < 0.001 ||
    scale > 1 ||
    !Number.isFinite(degrees)
  )
    return;
  const before = pivot
    .clone()
    .multiplyScalar(model.scale.x)
    .applyAxisAngle(up, model.rotation.y);
  model.scale.setScalar(scale);
  model.rotation.y = (normalizeRotation(degrees) * Math.PI) / 180;
  const after = pivot
    .clone()
    .multiplyScalar(scale)
    .applyAxisAngle(up, model.rotation.y);
  anchor.position.add(before.sub(after));
}

export function floorDirections(camera: Object3D) {
  const forward = camera.getWorldDirection(new Vector3());
  forward.y = 0;
  if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
  forward.normalize();
  return { forward, right: forward.clone().cross(up) };
}

/** Put the nearest footprint edge one real meter ahead, preserving elevation/yaw. */
export function bringModelInFront(
  anchor: Group,
  model: Group,
  camera: Object3D,
) {
  const bounds = modelBounds(model);
  const center = bounds.getCenter(new Vector3());
  center.y = 0;
  const { forward } = floorDirections(camera);
  const localForward = forward.clone().applyAxisAngle(up, -model.rotation.y);
  const size = bounds.getSize(new Vector3());
  const halfDepth =
    ((Math.abs(localForward.x) * size.x + Math.abs(localForward.z) * size.z) *
      model.scale.x) /
    2;
  const target = camera
    .getWorldPosition(new Vector3())
    .addScaledVector(forward, 1 + halfDepth);
  target.y = anchor.position.y;
  anchor.position
    .copy(target)
    .sub(
      center
        .clone()
        .multiplyScalar(model.scale.x)
        .applyAxisAngle(up, model.rotation.y),
    );
  // The nearest footprint point becomes the stable rotation/scale handle.
  const pivot = camera
    .getWorldPosition(new Vector3())
    .sub(anchor.position)
    .applyAxisAngle(up, -model.rotation.y)
    .divideScalar(model.scale.x);
  pivot.clamp(bounds.min, bounds.max);
  pivot.y = 0;
  return pivot;
}

/** Frame an entire model in the untracked camera overlay without changing its ratio. */
export function frameCameraModel(
  anchor: Group,
  model: Group,
  camera: PerspectiveCamera,
) {
  const copy = model.clone(true);
  copy.position.set(0, 0, 0);
  const bounds = new Box3().setFromObject(copy);
  const size = bounds.getSize(new Vector3()),
    center = bounds.getCenter(new Vector3());
  const tan = Math.tan((camera.fov * Math.PI) / 360);
  const distance =
    Math.max(size.y / 2 / tan, size.x / 2 / (tan * camera.aspect)) * 1.15 +
    size.z / 2;
  anchor.position
    .copy(camera.position)
    .add(new Vector3(0, 0, -Math.max(1, distance)))
    .sub(center);
  return modelBounds(model).getCenter(new Vector3());
}
