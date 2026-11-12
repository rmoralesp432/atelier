import { it, expect } from 'vitest';
import { cameraViewOperation, resolveCameraView } from './cameraView';
import { makeVolume } from '../model';
import { applyPlan, directPlan, newSession } from '../intelligence/engine';
import { defaultCamera } from '../intelligence/context';
const view = () =>
  cameraViewOperation.parse({
    type: 'camera_view',
    targets: [],
    projection: 'orthographic',
    bearing: 45,
    elevation: 45,
    distance: null,
    target: null,
  });
it.each([23, 45, 137, 280])(
  'positions the camera at arbitrary bearing %s without moving or isolating geometry',
  (bearing) => {
    const project = { volumes: [makeVolume()], selectedId: null };
    const before = structuredClone(project);
    const saved = resolveCameraView(project, { ...view(), bearing });
    const p = saved.pose!,
      dx = p.position.x - p.target.x,
      dy = p.position.y - p.target.y,
      dz = p.position.z - p.target.z;
    expect(((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360).toBeCloseTo(
      bearing,
    );
    expect((Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI).toBeCloseTo(
      45,
    );
    expect(p.projection).toBe('orthographic');
    expect(saved.targets).toEqual([]);
    expect(project).toEqual(before);
  },
);
it('resolves camera references at their actual position in the operation sequence', async () => {
  const blank = newSession({ volumes: [], selectedId: null });
  const create = (name: string, x: number) => ({
    type: 'create_at' as const,
    name,
    shape: 'box' as const,
    width: 4,
    depth: 4,
    height: 4,
    x,
    y: 0,
    z: 0,
    rotation: 0,
  });
  const result = await applyPlan(
    blank,
    {
      intent: 'apply',
      message: 'Study two objects',
      operations: [
        create('First', 10),
        { ...view(), targets: ['$created'] },
        create('Second', 40),
      ],
    },
    defaultCamera,
  );
  const camera = result.effectiveOperations!.find(
    (o) => o.type === 'camera_view',
  )!;
  expect(camera.type).toBe('camera_view');
  if (camera.type !== 'camera_view') throw Error('missing camera');
  expect(camera.targets).toEqual([result.session.project.volumes[0].id]);
  expect(resolveCameraView(result.session.project, camera).pose!.target.x).toBe(
    10,
  );
});
it('rejects unavailable scene targets and solar playback without a site before committing geometry', async () => {
  expect(() =>
    resolveCameraView({ volumes: [], selectedId: null }, view()),
  ).toThrow('visible geometry');
  const blank = newSession({ volumes: [], selectedId: null });
  await expect(
    applyPlan(blank, directPlan({ type: 'workspace', action: 'solar_play' })),
  ).rejects.toThrow('site location');
  expect(blank.project.volumes).toHaveLength(0);
});
