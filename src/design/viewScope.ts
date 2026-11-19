import { Plane, Vector3 } from 'three';
import type { Project } from '../model';
import { envelopeBounds } from '../geometry/spatial';
import type { SavedView } from './schema';
/** A room cutaway clips the view only; even a shared floor remains unmodified. */
export function viewScope(project: Project, view?: SavedView) {
  const targets =
    view?.targets
      .map((id) => project.volumes.find((v) => v.id === id))
      .filter((v) => !!v) ?? [];
  if (!targets.length) return { ids: null, planes: [] as Plane[] };
  const ids = new Set(targets.map((v) => v.id));
  for (const v of project.volumes) {
    if (v.component?.hostId && ids.has(v.component.hostId)) ids.add(v.id);
    const b = envelopeBounds(v);
    if (
      targets.some((t) => {
        if (t.component?.role !== 'room') return false;
        const a = envelopeBounds(t);
        return (['x', 'y', 'z'] as const).every(
          (k) =>
            Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) >=
            -0.01,
        );
      })
    )
      ids.add(v.id);
  }
  const planes: Plane[] = [];
  if (targets.length === 1 && targets[0].component?.role === 'room') {
    const room = targets[0],
      a = (room.rotation * Math.PI) / 180,
      center = new Vector3(room.position.x, room.position.y, room.position.z);
    for (const [x, z, half] of [
      [1, 0, room.dimensions.width / 2],
      [-1, 0, room.dimensions.width / 2],
      [0, 1, room.dimensions.depth / 2],
      [0, -1, room.dimensions.depth / 2],
    ]) {
      const n = new Vector3(
        x * Math.cos(a) + z * Math.sin(a),
        0,
        -x * Math.sin(a) + z * Math.cos(a),
      );
      planes.push(new Plane(n, half - n.dot(center)));
    }
    planes.push(new Plane(new Vector3(0, 1, 0), -room.position.y));
  }
  return { ids, planes };
}
