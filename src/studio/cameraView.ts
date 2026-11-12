import { z } from 'zod';
import { MAX_SCENE_OBJECTS } from '../limits';
import { isVisible, type Project } from '../model';
import { groupBounds } from '../geometry/spatial';
import type { SavedView } from '../design/schema';
const coordinate = z.number().finite().min(-1000).max(1000);
export const cameraViewOperation = z
  .object({
    type: z.literal('camera_view'),
    targets: z
      .array(z.string().min(1).max(100))
      .max(MAX_SCENE_OBJECTS)
      .describe(
        'Objects to frame; empty frames all visible geometry. Does not hide unrelated objects.',
      ),
    projection: z.enum(['perspective', 'orthographic']),
    bearing: z
      .number()
      .min(0)
      .max(360)
      .describe(
        'Camera bearing clockwise from project north: 0 north, 90 east. This positions the camera on that side looking toward the target.',
      ),
    elevation: z
      .number()
      .min(1)
      .max(89)
      .describe(
        'Camera elevation in degrees above the horizontal. For exact plan use workspace view_top.',
      ),
    distance: z
      .number()
      .min(0.1)
      .max(10000)
      .nullable()
      .describe(
        'Distance from target in metres; null automatically fits the geometry.',
      ),
    target: z
      .object({ x: coordinate, y: coordinate, z: coordinate })
      .strict()
      .nullable()
      .describe(
        'Explicit world look-at point, or null to use the framed objects centre.',
      ),
  })
  .strict();
export type CameraViewOperation = z.infer<typeof cameraViewOperation>;
/** Resolve actual IDs before calling. Pure shared geometry, used by engine and UI. */
export function resolveCameraView(
  project: Project,
  op: CameraViewOperation,
): SavedView {
  const volumes = op.targets.length
    ? op.targets.map((id) => {
        const v = project.volumes.find((v) => v.id === id);
        if (!v)
          throw new Error('A camera target is no longer present in the scene.');
        return v;
      })
    : project.volumes.filter((v) => isVisible(v, project));
  if (!volumes.length && !op.target)
    throw new Error('Provide a look-at point or visible geometry to frame.');
  const bounds = volumes.length ? groupBounds(volumes) : null;
  const target = op.target ?? {
    x: (bounds!.min.x + bounds!.max.x) / 2,
    y: (bounds!.min.y + bounds!.max.y) / 2,
    z: (bounds!.min.z + bounds!.max.z) / 2,
  };
  // Include distance from an off-centre explicit target when fitting.
  const radius = bounds
    ? Math.max(
        ...[bounds.min.x, bounds.max.x].flatMap((x) =>
          [bounds.min.y, bounds.max.y].flatMap((y) =>
            [bounds.min.z, bounds.max.z].map((z) =>
              Math.hypot(x - target.x, y - target.y, z - target.z),
            ),
          ),
        ),
      )
    : 5;
  const fitted = Math.max(radius, 0.5);
  const distance =
    op.distance ?? (fitted / Math.sin((20 * Math.PI) / 180)) * 1.15;
  const a = (op.bearing * Math.PI) / 180,
    e = (op.elevation * Math.PI) / 180;
  return {
    name: 'Conversation view',
    targets: [],
    section: null,
    pose: {
      projection: op.projection,
      zoom: 1,
      fov: 40,
      orthoHeight: fitted * 2.3,
      target,
      position: {
        x: target.x + Math.sin(a) * Math.cos(e) * distance,
        y: target.y + Math.sin(e) * distance,
        z: target.z - Math.cos(a) * Math.cos(e) * distance,
      },
    },
  };
}
