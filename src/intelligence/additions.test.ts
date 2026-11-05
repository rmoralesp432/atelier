import { it, expect } from 'vitest';
import { applyPlan, directPlan, newSession } from './engine';
import { makeVolume, parseProject, serializeProject } from '../model';
import { renderMeshData, solidStats } from '../geometry/kernel';
it('adds an independently sized lower floor with explicit lift approval and one undo transaction', async () => {
  const v = makeVolume(1, { width: 100, depth: 40, height: 8 }),
    s = newSession({ volumes: [v], selectedId: v.id });
  const op = {
    type: 'attach' as const,
    target: v.id,
    name: 'Ground floor',
    side: 'below' as const,
    width: 100,
    depth: 30,
    height: 4,
    gap: 0,
    offsetX: 0,
    offsetZ: 0,
    liftExisting: false,
  };
  await expect(applyPlan(s, directPlan(op))).rejects.toThrow(
    'Ask whether to lift',
  );
  await expect(
    applyPlan(s, directPlan({ ...op, liftExisting: true })),
  ).rejects.toThrow('Review');
  const r = await applyPlan(
    s,
    directPlan({ ...op, liftExisting: true }),
    undefined,
    true,
  );
  expect(r.session.project.volumes[0].position.y).toBe(4);
  expect(r.session.project.volumes[1].dimensions).toEqual({
    width: 100,
    depth: 30,
    height: 4,
  });
  expect(s.project.volumes[0].position.y).toBe(0);
  expect(r.session.past).toHaveLength(1);
});
it('toggles floors, glass and massing without destroying architectural parameters', async () => {
  const v = makeVolume(1, { width: 10, depth: 8, height: 6 }),
    s = newSession({ volumes: [v], selectedId: v.id });
  const b = await applyPlan(
    s,
    directPlan({
      type: 'building',
      target: v.id,
      floors: 2,
      slabThickness: 0.25,
      facade: true,
      panelWidth: 2,
      mullionWidth: 0.06,
    }),
    undefined,
    true,
  );
  const before = b.session.project.volumes[0],
    stats = await solidStats(before);
  const out = await applyPlan(
    b.session,
    directPlan({
      type: 'building_display',
      targets: [v.id],
      mode: 'architecture',
      floors: true,
      glass: false,
    }),
  );
  expect(
    (await renderMeshData(out.session.project.volumes[0])).map(
      (p) => p.material,
    ),
  ).toEqual(['solid']);
  expect((await solidStats(out.session.project.volumes[0])).volume).toBeCloseTo(
    stats.volume,
    4,
  );
  const volume = {
    ...before,
    display: { mode: 'volume' as const, floors: true, glass: true },
  };
  expect((await renderMeshData(volume))[0].volume).toBeCloseTo(480, 4);
  expect(
    parseProject(serializeProject({ volumes: [volume], selectedId: v.id }))
      .volumes[0].geometry,
  ).toEqual(before.geometry);
});
it('keeps actual glazing clear widths fixed after narrowing the building', async () => {
  const { getKernel } = await import('../geometry/kernel');
  const v = makeVolume(1, { width: 10, depth: 8, height: 6 }),
    s = newSession({ volumes: [v], selectedId: v.id });
  let out = await applyPlan(
    s,
    directPlan({
      type: 'building',
      target: v.id,
      floors: 2,
      slabThickness: 0.25,
      facade: true,
      panelWidth: 2,
      mullionWidth: 0.06,
    }),
    undefined,
    true,
  );
  out = await applyPlan(
    out.session,
    directPlan({ type: 'window_module', target: v.id, width: 1.2 }),
  );
  const widths = async (v: (typeof s.project.volumes)[number]) => {
    const part = (await renderMeshData(v)).find((p) => p.material === 'glass')!,
      m = await getKernel();
    const solid = new m.Manifold(
      new m.Mesh({
        numProp: 3,
        vertProperties: part.positions,
        triVerts: part.indices,
      }),
    );
    const pieces = solid.decompose();
    try {
      return pieces
        .filter((s) => s.volume() > 1e-8)
        .map((s) => s.boundingBox())
        .filter((b) => b.max[2] - b.min[2] < 0.1)
        .map((b) => b.max[0] - b.min[0]);
    } finally {
      pieces.forEach((s) => s.delete());
      solid.delete();
    }
  };
  const before = await widths(out.session.project.volumes[0]);
  expect(before.length).toBeGreaterThan(0);
  before.forEach((w) => expect(w).toBeCloseTo(1.2, 4));
  out = await applyPlan(
    out.session,
    directPlan({
      type: 'resize',
      targets: [v.id],
      axis: 'width',
      mode: 'set',
      value: 8,
    }),
  );
  const after = await widths(out.session.project.volumes[0]);
  expect(after.length).toBeLessThan(before.length);
  after.forEach((w) => expect(w).toBeCloseTo(1.2, 4));
});
