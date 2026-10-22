import { expect, it } from 'vitest';
import { makeVolume } from '../model';
import {
  solidStats,
  editableBuildingComponents,
  renderMeshData,
  orientVolume,
} from './kernel';
import {
  applyPlan,
  directPlan,
  newSession,
  parseSession,
  serializeSession,
} from '../intelligence/engine';
import { createARModel, disposeARModel } from '../ar/model';
import { Mesh, MeshStandardMaterial } from 'three';

it('separates a rotated raised building into true editable components without geometry loss, and restores it with undo', async () => {
  const box = {
    ...makeVolume(),
    position: { x: 17, y: 4, z: -8 },
    rotation: 37,
  };
  const built = await applyPlan(
    newSession({ volumes: [box], selectedId: box.id }),
    directPlan({
      type: 'building',
      target: box.id,
      floors: 2,
      slabThickness: 0.25,
      facade: true,
      panelWidth: 3,
      mullionWidth: 0.06,
    }),
    undefined,
    true,
  );
  const before = built.session,
    original = before.project.volumes[0];
  const result = await applyPlan(
    before,
    directPlan({ type: 'components', target: box.id }),
    undefined,
    true,
  );
  const parts = result.session.project.volumes;
  expect(parts.filter((p) => p.material === 'solid')).toHaveLength(3);
  expect(parts.filter((p) => p.material === 'glass').length).toBeGreaterThan(4);
  expect(parts.filter((p) => p.material === 'frame').length).toBeGreaterThan(4);
  expect(parts[0].id).toBe(box.id);
  expect(new Set(parts.map((p) => p.groupId)).size).toBe(1);
  const originalStats = await solidStats(original),
    stats = await Promise.all(parts.map(solidStats));
  expect(stats.every((s) => s.status === 'NoError')).toBe(true);
  expect(stats.reduce((s, p) => s + p.volume, 0)).toBeCloseTo(
    originalStats.volume,
    3,
  );
  for (let axis = 0; axis < 3; axis++) {
    expect(Math.min(...stats.map((s) => s.bounds.min[axis]))).toBeCloseTo(
      originalStats.bounds.min[axis],
      3,
    );
    expect(Math.max(...stats.map((s) => s.bounds.max[axis]))).toBeCloseTo(
      originalStats.bounds.max[axis],
      3,
    );
  }
  const window = parts.find((p) => p.material === 'glass')!;
  const changed = await applyPlan(
    result.session,
    directPlan({
      type: 'move',
      targets: [window.id],
      direction: 'up',
      distance: 1,
    }),
  );
  expect(
    changed.session.project.volumes.filter((p) => p.id !== window.id),
  ).toEqual(parts.filter((p) => p.id !== window.id));
  expect(parseSession(serializeSession(changed.session)).project).toEqual(
    changed.session.project,
  );
  expect(
    (await applyPlan(result.session, directPlan({ type: 'undo', count: 1 })))
      .session.project,
  ).toEqual(before.project);
}, 20000);
it('rejects non-buildings and locked assemblies without partial changes', async () => {
  const box = makeVolume();
  await expect(editableBuildingComponents(box)).rejects.toThrow('building');
  const s = newSession({
    volumes: [{ ...box, groupId: 'g' }],
    selectedId: box.id,
    groups: [{ id: 'g', name: 'Locked', locked: true, visible: true }],
  });
  const before = serializeSession(s);
  await expect(
    applyPlan(
      s,
      directPlan({ type: 'components', target: box.id }),
      undefined,
      true,
    ),
  ).rejects.toThrow('Unlock');
  expect(serializeSession(s)).toBe(before);
});
it('keeps trees as sparse transparent silhouettes in shared viewport/AR geometry and USDZ materials', async () => {
  const tree = {
    ...makeVolume(1, { width: 6, depth: 6, height: 9 }),
    geometry: { kind: 'tree' as const },
  };
  const data = await renderMeshData(tree),
    stats = await solidStats(tree);
  expect(data[0].material).toBe('foliage');
  const turned = await orientVolume(
    { ...tree, position: { x: 0, y: 10, z: 0 } },
    { x: 10, y: 20, z: 0 },
  );
  expect((await renderMeshData(turned))[0].material).toBe('foliage');
  expect(stats.volume).toBeGreaterThan(0);
  expect(stats.volume).toBeLessThan(6 * 6 * 9 * 0.04);
  expect(stats.bounds.max[1]).toBeCloseTo(9);
  const model = await createARModel({ volumes: [tree], selectedId: null });
  model.traverse((o) => {
    if (o instanceof Mesh) {
      const m = o.material as MeshStandardMaterial;
      expect(m.transparent).toBe(true);
      expect(m.opacity).toBe(0.42);
      expect(m.depthWrite).toBe(false);
    }
  });
  disposeARModel(model);
});
