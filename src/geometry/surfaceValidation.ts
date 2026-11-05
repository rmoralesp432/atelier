import { Vector3, Ray } from 'three';
// Sweep along the largest bounding axis to avoid testing every triangle pair.
// Ignore shared-vertex neighbors; reject intersections through other triangles.
export function rejectCrossingSurface(positions: number[], indices: number[]) {
  const points = Array.from({ length: positions.length / 3 }, (_, i) =>
    new Vector3().fromArray(positions, i * 3),
  );
  const spans = [0, 1, 2].map(
    (a) =>
      Math.max(...points.map((p) => p.getComponent(a))) -
      Math.min(...points.map((p) => p.getComponent(a))),
  );
  const axis = spans.indexOf(Math.max(...spans));
  const faces = Array.from({ length: indices.length / 3 }, (_, i) => {
    const ids = indices.slice(i * 3, i * 3 + 3),
      p = ids.map((j) => points[j]);
    return {
      ids,
      p,
      min: [0, 1, 2].map((a) => Math.min(...p.map((v) => v.getComponent(a)))),
      max: [0, 1, 2].map((a) => Math.max(...p.map((v) => v.getComponent(a)))),
    };
  })
    .filter(
      (f) =>
        f.p[1]
          .clone()
          .sub(f.p[0])
          .cross(f.p[2].clone().sub(f.p[0]))
          .lengthSq() > 1e-20,
    )
    .sort((a, b) => a.min[axis] - b.min[axis]);
  const ray = new Ray(),
    hit = new Vector3(),
    direction = new Vector3();
  const intersects = (a: Vector3[], b: Vector3[]) =>
    a.some((p, i) => {
      // A resampled cap may contain collinear boundary vertices. Reject true
      // crossings, not numerical ray hits along an edge coplanar with that cap.
      const normal = b[1]
        .clone()
        .sub(b[0])
        .cross(b[2].clone().sub(b[0]))
        .normalize();
      const da = p.clone().sub(b[0]).dot(normal),
        db = a[(i + 1) % 3].clone().sub(b[0]).dot(normal);
      if ((Math.abs(da) < 1e-7 && Math.abs(db) < 1e-7) || da * db > 1e-14)
        return false;
      direction.copy(a[(i + 1) % 3]).sub(p);
      const length = direction.length();
      if (length < 1e-8) return false;
      ray.set(p, direction.multiplyScalar(1 / length));
      const result = ray.intersectTriangle(b[0], b[1], b[2], false, hit);
      return (
        result !== null &&
        p.distanceTo(hit) > 1e-6 &&
        p.distanceTo(hit) < length - 1e-6
      );
    });
  for (let i = 0; i < faces.length; i++)
    for (
      let j = i + 1;
      j < faces.length && faces[j].min[axis] <= faces[i].max[axis] + 1e-7;
      j++
    ) {
      const a = faces[i],
        b = faces[j];
      if (
        a.ids.some((id) => b.ids.includes(id)) ||
        [0, 1, 2].some(
          (k) => a.min[k] > b.max[k] + 1e-7 || b.min[k] > a.max[k] + 1e-7,
        )
      )
        continue;
      if (intersects(a.p, b.p) || intersects(b.p, a.p))
        throw new Error(
          'The form crosses itself. Use a gentler path, smaller profile, or aligned loft sections.',
        );
    }
}
