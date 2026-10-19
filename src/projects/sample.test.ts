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
  expect(p.groups).toHaveLength(6);
  expect(p.volumes).toHaveLength(134);
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
  const pane = p.volumes.find((v) => v.material === 'glass')!;
  expect((await renderMeshData(pane))[0].material).toBe('glass');
  expect(p.volumes.filter((v) => v.name.includes('steel column'))).toHaveLength(
    8,
  );
  expect(
    p.volumes.filter((v) => v.material === 'glass').length,
  ).toBeGreaterThan(15);
  expect(p.site).toMatchObject({
    latitude: 41.6354,
    longitude: -88.5357,
    style: 'satellite',
  });
  const moved = await applyPlan(
    s,
    directPlan({
      type: 'move',
      targets: [pane.id],
      direction: 'up',
      distance: 0.2,
    }),
    defaultCamera,
  );
  expect(moved.session.project.volumes.filter((v) => v.id !== pane.id)).toEqual(
    p.volumes.filter((v) => v.id !== pane.id),
  );
  expect(
    parseSession(JSON.stringify({ version: 2, ...moved.session })).project,
  ).toEqual(moved.session.project);
  const terrace = p.volumes.find((v) => v.name === 'Lower terrace')!;
  expect(terrace.geometry?.kind).toBe('box');
  const stretched = await applyPlan(
    s,
    directPlan({
      type: 'stretch',
      targets: [terrace.id],
      axis: 'width',
      side: 'max',
      distance: 2,
    }),
    defaultCamera,
  );
  const changedTerrace = stretched.session.project.volumes.find(
    (v) => v.id === terrace.id,
  )!;
  expect(changedTerrace.dimensions.width).toBe(18.68);
  expect(changedTerrace.position.x - changedTerrace.dimensions.width / 2).toBe(
    terrace.position.x - terrace.dimensions.width / 2,
  );
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

it('keeps the reference terrace stagger and connects two flights without intersecting the slabs', async () => {
  const p = parseSession(sampleHouse().session).project;
  const terrace = p.volumes.find((v) => v.name === 'Lower terrace')!;
  const porch = p.volumes.find((v) => v.name === 'Porch · travertine floor')!;
  const westProjection =
    porch.position.x -
    porch.dimensions.width / 2 -
    (terrace.position.x - terrace.dimensions.width / 2);
  // Reference-model lower/upper mortar beds: 6.5708 m westward projection.
  expect(westProjection).toBeCloseTo(6.57, 2);
  expect(terrace.dimensions.width).toBeCloseTo(16.679, 2);
  expect(
    terrace.position.z -
      terrace.dimensions.depth / 2 -
      porch.dimensions.depth / 2,
  ).toBeCloseTo(0.24, 2);
  const supports = p.volumes.filter((v) => v.name === 'Terrace · support');
  expect(supports).toHaveLength(4);
  expect(supports.filter((v) => v.position.z > 10)).toHaveLength(3);
  const sharedPosts = p.volumes.filter(
    (v) =>
      v.name.startsWith('South · steel column') &&
      v.position.x >= -11.232 &&
      v.position.x <= -4.524,
  );
  expect(sharedPosts).toHaveLength(2);
  for (const post of sharedPosts) {
    expect(post.position.z + post.dimensions.depth / 2).toBeGreaterThan(
      terrace.position.z - terrace.dimensions.depth / 2,
    );
  }
  for (const v of supports) {
    expect(
      Math.abs(v.position.x - terrace.position.x) - v.dimensions.width / 2,
    ).toBeLessThanOrEqual(terrace.dimensions.width / 2);
    expect(
      Math.abs(v.position.z - terrace.position.z) - v.dimensions.depth / 2,
    ).toBeLessThanOrEqual(terrace.dimensions.depth / 2 + 1e-8);
    expect(v.position.y + v.dimensions.height).toBe(terrace.position.y);
  }
  const { sharedVolume } = await import('../geometry/kernel');
  for (const prefix of ['Porch step', 'Garden step']) {
    const steps = p.volumes.filter((v) => v.name.startsWith(prefix));
    expect(steps).toHaveLength(4);
    for (const step of steps) {
      expect(step.dimensions.width).toBe(3.66);
      expect(step.dimensions.height).toBe(0.08);
      expect(await sharedVolume(step, terrace)).toBeCloseTo(0, 5);
      expect(await sharedVolume(step, porch)).toBeCloseTo(0, 5);
    }
  }
});
