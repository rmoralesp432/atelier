import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
const correction = new Quaternion().setFromAxisAngle(
  new Vector3(1, 0, 0),
  -Math.PI / 2,
);
/** Device coordinates to a world camera, including portrait/landscape correction. */
export function orientationQuaternion(
  alpha: number | null,
  beta: number | null,
  gamma: number | null,
  screenAngle: number,
) {
  if ([alpha, beta, gamma].some((n) => n === null || !Number.isFinite(n)))
    return null;
  return new Quaternion()
    .setFromEuler(
      new Euler(
        MathUtils.degToRad(beta!),
        MathUtils.degToRad(alpha!),
        -MathUtils.degToRad(gamma!),
        'YXZ',
      ),
    )
    .multiply(correction)
    .multiply(
      new Quaternion().setFromAxisAngle(
        new Vector3(0, 0, 1),
        -MathUtils.degToRad(screenAngle),
      ),
    );
}
