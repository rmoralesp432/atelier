import { expect, it } from 'vitest';
import { sampleHouse } from './sample';
import { applyPlan, directPlan, parseSession } from '../intelligence/engine';
import { solidStats, renderMeshData } from '../geometry/kernel';
import { defaultCamera } from '../intelligence/context';
it('creates a fresh editable, grouped house with actual solid geometry and glazed building parts', async () => {
  const a = sampleHouse(),
    b = sampleHouse(),
    s = parseSession(a.session),
    p = s.project;
  expect(a.id).not.toBe(b.id);
  const other = parseSession(b.session).project;
  expect(
    p.volumes.every((v) => !other.volumes.some((o) => o.id === v.id)),
  ).toBe(true);
  expect(p.groups).toHaveLength(5);
  expect(p.volumes).toHaveLength(24);
  expect(
    p.volumes.every((v) =>
      p.groups?.some((g) => g.id === v.groupId && !g.locked && g.visible),
    ),
  ).toBe(true);
  for (const v of p.volumes) {
    const stats = await solidStats(v);
    expect(stats.status, v.name).toBe('NoError');
    expect(stats.volume, v.name).toBeGreaterThan(0);
  }
  const parts = await renderMeshData(p.volumes[0]);
  expect(parts.some((p) => p.material === 'glass')).toBe(true);
  expect(parts.some((p) => p.material === 'solid')).toBe(true);
  const terrace = p.volumes.find((v) => v.name === 'Lower terrace')!;
  const result = await applyPlan(
    s,
    directPlan({
      type: 'resize',
      targets: [terrace.id],
      axis: 'width',
      mode: 'set',
      value: 14,
    }),
    defaultCamera,
  );
  expect(
    result.session.project.volumes.find((v) => v.id === terrace.id)?.dimensions
      .width,
  ).toBe(14);
  expect(result.session.project.volumes[0]).toEqual(p.volumes[0]);
  const undone = await applyPlan(
    result.session,
    directPlan({ type: 'undo', count: 1 }),
    defaultCamera,
  );
  expect(undone.session.project).toEqual(p);
});
