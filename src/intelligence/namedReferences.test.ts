import { it, expect } from 'vitest';
import { makeVolume } from '../model';
import { newSession, resolveIds } from './engine';
it('resolves exact plain object/group names without guessing across ambiguous namespaces', () => {
  const a = { ...makeVolume(1), name: 'Roof', groupId: 'g' };
  const b = { ...makeVolume(2), name: 'Slab', groupId: 'g' };
  const s = newSession({
    volumes: [a, b],
    selectedId: null,
    groups: [{ id: 'g', name: 'Gallery', visible: true, locked: false }],
  });
  expect(resolveIds(['Roof'], s)).toEqual([a.id]);
  expect(resolveIds(['Gallery'], s)).toEqual([a.id, b.id]);
  expect(resolveIds([a.id], s)).toEqual([a.id]);
  expect(() => resolveIds(['roof'], s)).toThrow();
  expect(() => resolveIds(['Missing'], s)).toThrow();
  s.project.groups![0].name = 'Roof';
  expect(() => resolveIds(['Roof'], s)).toThrow('ambiguous');
  expect(resolveIds(['$name:Roof'], s)).toEqual([a.id]);
  expect(resolveIds(['$group:Roof'], s)).toEqual([a.id, b.id]);
  s.project.volumes[1].name = 'Roof';
  expect(() => resolveIds(['Roof'], s)).toThrow('ambiguous');
  expect(() => resolveIds(['$name:Roof'], s)).toThrow();
});

it('adds members to an existing unique group without creating ambiguous duplicates, and respects locks', async () => {
  const { applyPlan, directPlan } = await import('./engine');
  const a = makeVolume(1),
    b = makeVolume(2);
  const source = newSession({ volumes: [a, b], selectedId: null });
  const first = (
    await applyPlan(
      source,
      directPlan({ type: 'group_create', name: 'Structure', targets: [a.id] }),
    )
  ).session;
  const second = (
    await applyPlan(
      first,
      directPlan({ type: 'group_create', name: 'Structure', targets: [b.id] }),
    )
  ).session;
  expect(second.project.groups).toHaveLength(1);
  expect(
    second.project.volumes.every(
      (v) => v.groupId === second.project.groups![0].id,
    ),
  ).toBe(true);
  expect(first.project.volumes[1].groupId).toBeUndefined();
  second.project.groups![0].locked = true;
  await expect(
    applyPlan(
      second,
      directPlan({ type: 'group_create', name: 'Structure', targets: [a.id] }),
    ),
  ).rejects.toThrow(/Unlock|locked/);
});
