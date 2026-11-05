import { it, expect } from 'vitest';
import { applyPlan, directPlan, newSession } from './engine';
import { makeVolume, parseProject, serializeProject } from '../model';
import { solidStats } from '../geometry/kernel';
it('places real volumetric trees around a rotated footprint with clearance and one undo', async () => {
  const v = {
    ...makeVolume(1, { width: 20, depth: 10, height: 8 }),
    rotation: 45,
    position: { x: 30, y: 4, z: 20 },
  };
  const original = newSession({ volumes: [v], selectedId: v.id });
  const result = await applyPlan(
    original,
    directPlan({
      type: 'trees',
      target: v.id,
      count: 12,
      height: 4.5,
      crown: 3,
      clearance: 2,
      position: null,
    }),
  );
  const trees = result.session.project.volumes.slice(1);
  expect(trees).toHaveLength(12);
  expect(new Set(trees.map((t) => t.id)).size).toBe(12);
  for (const t of trees) {
    const x = t.position.x - 30,
      z = t.position.z - 20,
      a = Math.PI / 4;
    const lx = x * Math.cos(a) - z * Math.sin(a),
      lz = x * Math.sin(a) + z * Math.cos(a);
    expect(Math.max(Math.abs(lx) - 10, Math.abs(lz) - 5)).toBeCloseTo(3.5, 5);
    expect(t.position.y).toBe(0);
  }
  expect((await solidStats(trees[0])).volume).toBeGreaterThan(0);
  expect((await solidStats(trees[0])).volume).toBeLessThan(1);
  expect(result.session.past).toHaveLength(1);
  expect(
    parseProject(serializeProject(result.session.project)).volumes,
  ).toEqual(result.session.project.volumes);
  const undo = await applyPlan(
    result.session,
    directPlan({ type: 'undo', count: 1 }),
  );
  expect(undo.session.project).toEqual(original.project);
});
it('persists layers and rejects edits and deletion of locked members atomically', async () => {
  const v = makeVolume(),
    s = newSession({ volumes: [v], selectedId: v.id });
  let r = await applyPlan(
    s,
    directPlan({ type: 'group_create', name: 'Structure', targets: [v.id] }),
  );
  const id = r.session.project.groups![0].id;
  r = await applyPlan(
    r.session,
    directPlan({
      type: 'group_edit',
      id,
      name: null,
      visible: false,
      locked: true,
    }),
  );
  expect(
    parseProject(serializeProject(r.session.project)).groups![0],
  ).toMatchObject({ name: 'Structure', visible: false, locked: true });
  await expect(
    applyPlan(
      r.session,
      directPlan({
        type: 'move',
        targets: [v.id],
        direction: 'right',
        distance: 2,
      }),
    ),
  ).rejects.toThrow(/locked/i);
  await expect(
    applyPlan(
      r.session,
      directPlan({ type: 'delete', targets: [v.id] }),
      undefined,
      true,
    ),
  ).rejects.toThrow(/locked/i);
  expect(r.session.project.volumes[0].position).toEqual(v.position);
});
it('automatic planting avoids neighboring envelopes and explicit blocked counts are rejected', async () => {
  const target = makeVolume(1, { width: 20, depth: 10, height: 8 });
  const neighbor = {
    ...makeVolume(2, { width: 20, depth: 10, height: 8 }),
    position: { x: 20, y: 0, z: 0 },
  };
  const s = newSession({ volumes: [target, neighbor], selectedId: target.id });
  const op = {
    type: 'trees' as const,
    target: target.id,
    count: null,
    height: 4.5,
    crown: 3,
    clearance: 2,
    position: null,
  };
  const r = await applyPlan(s, directPlan(op));
  const trees = r.session.project.volumes.slice(2);
  expect(trees.length).toBeGreaterThan(4);
  expect(trees.length).toBeLessThan(19);
  for (const t of trees)
    expect(
      Math.hypot(
        Math.max(0, Math.abs(t.position.x - 20) - 10),
        Math.max(0, Math.abs(t.position.z) - 5),
      ),
    ).toBeGreaterThanOrEqual(1.6);
  await expect(applyPlan(s, directPlan({ ...op, count: 12 }))).rejects.toThrow(
    /blocks/,
  );
  expect(s.project.volumes).toHaveLength(2);
});
