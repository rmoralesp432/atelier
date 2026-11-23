import { sceneContext, type CameraContext } from './context';
import type { Session } from './engine';
import { equalData } from '../projects/equalData';

/** Request-local read-only reference, never a new model/history entry.
 * Only replaced/removed originals travel twice; unchanged objects are in scene.
 * Capture from transaction start, not the previous provisional stage. */
export function sceneReference(
  original: Session,
  current: ReturnType<typeof sceneContext>,
  camera: CameraContext,
) {
  const before = sceneContext(original.project, original.context, camera);
  const now = new Map(current.objects.map((o) => [o.id, o]));
  return {
    source: 'request_start' as const,
    ids: before.objects.map((o) => o.id),
    replacements: before.objects.filter((o) => !equalData(o, now.get(o.id))),
    groups: before.groups,
  };
}
