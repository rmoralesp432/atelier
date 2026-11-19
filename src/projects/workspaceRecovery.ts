import { poseSchema, type ViewPose } from '../design/schema';
const key = (id?: string) => `atelier.workspace-recovery:${id ?? 'current'}`;
export type Recovery = { pose?: ViewPose; interrupted?: boolean };
export function readRecovery(id?: string): Recovery {
  try {
    const data = JSON.parse(sessionStorage.getItem(key(id)) || '{}');
    let durablePose;
    try {
      durablePose = JSON.parse(
        localStorage.getItem(`${key(id)}:camera`) || 'null',
      );
    } catch {
      /* Tab state can still be available. */
    }
    const pose = poseSchema.safeParse(data.pose ?? durablePose);
    return {
      ...(pose.success ? { pose: pose.data } : {}),
      interrupted: data.interrupted === true,
    };
  } catch {
    return {};
  }
}
export function writeRecovery(id: string | undefined, update: Recovery) {
  try {
    if (update.pose)
      localStorage.setItem(`${key(id)}:camera`, JSON.stringify(update.pose));
  } catch {
    /* A full localStorage must not prevent the small tab checkpoint. */
  }
  try {
    sessionStorage.setItem(
      key(id),
      JSON.stringify({ ...readRecovery(id), ...update }),
    );
  } catch {
    /* Durable project storage remains authoritative. */
  }
}
