import { expect, it } from 'vitest';
import {
  buildingWithNeighbors,
  expectedStoreyEdit,
  storeyEdit,
} from '../../tests/fixtures/storey-building';
import {
  applyPlan,
  directPlan,
  newSession,
  parseSession,
  serializeSession,
} from './engine';
import { stagedPlan } from './checkedPlanner';
import { defaultCamera } from './context';
import { makeVolume, type Project } from '../model';
import { solidStats } from '../geometry/kernel';
import type { Operation, Plan } from './plan';
import { componentEditOperation } from './componentEdits';

const finish: Plan = {
  intent: 'finish',
  message: 'Checked the resulting building.',
  operations: [],
};
const continuing = (operations: Operation[]): Plan => ({
  intent: 'apply',
  message: 'Coordinate the edit',
  operations,
  planning: { stage: 'Edit', assumptions: [], next: 'Inspect and verify' },
});

function check(actual: Project, expected: Project) {
  expect(actual.volumes.map((v) => v.id)).toEqual(
    expected.volumes.map((v) => v.id),
  );
  expect(actual.groups).toEqual(expected.groups);
  actual.volumes.forEach((v, i) => {
    const wanted = expected.volumes[i];
    expect({ ...v, position: null, dimensions: null }).toEqual({
      ...wanted,
      position: null,
      dimensions: null,
    });
    for (const axis of ['x', 'y', 'z'] as const)
      expect(v.position[axis]).toBeCloseTo(wanted.position[axis], 9);
    for (const axis of ['width', 'height', 'depth'] as const)
      expect(v.dimensions[axis]).toBeCloseTo(wanted.dimensions[axis], 9);
  });
}

it('recovers the reproduced 64-operation failure by regrouping the entire 244-component edit, with one Undo', async () => {
  const session = newSession(buildingWithNeighbors());
  const before = structuredClone(session);
  const changes: Operation[] = session.project.volumes
    .filter((v) => v.groupId === 'building' && v.component?.level !== 'Level 0')
    .map((v) => ({
      type: 'move',
      targets: [v.id],
      direction: 'up',
      distance: 1,
    }));
  let calls = 0;
  const budgets: number[] = [];
  const result = await stagedPlan(
    session,
    defaultCamera,
    async (working, feedback, execution): Promise<Plan> => {
      budgets.push(execution!.remainingOperations!);
      if (++calls <= 3)
        return continuing(changes.slice((calls - 1) * 32, calls * 32));
      if (calls === 4) {
        expect(feedback?.error).toContain('64-operation transaction budget');
        expect(feedback?.error).toContain(
          'ALL provisional steps were discarded',
        );
        expect(execution?.receipts).toEqual([]);
        expect(working).toEqual(before);
        return continuing([storeyEdit(working.project)]);
      }
      check(working.project, expectedStoreyEdit(before.project));
      expect(execution?.receipts[0].created).toEqual([]);
      expect(execution?.receipts[0].removed).toEqual([]);
      expect(execution?.receipts[0].changed).toHaveLength(227);
      return finish;
    },
    undefined,
    undefined,
    {
      agent: true,
      verifyCompletion: async (candidate) => {
        check(candidate.project, expectedStoreyEdit(before.project));
        return {
          modeling: true,
          passed: true,
          checks: [],
          qualitativeLimits: [],
        };
      },
    },
  );
  expect(budgets).toEqual([64, 32, 0, 64, 63]);
  expect(result.plan.operations).toHaveLength(1);
  expect(result.prepared!.session.past).toEqual([before.project]);
  expect(result.reviewRequired).toBe(false);
  expect(session).toEqual(before);
  const undo = await applyPlan(
    result.prepared!.session,
    directPlan({ type: 'undo', count: 1 }),
  );
  expect(undo.session.project).toEqual(before.project);
  const redo = await applyPlan(
    undo.session,
    directPlan({ type: 'redo', count: 1 }),
  );
  expect(redo.session.project).toEqual(result.prepared!.session.project);
});

it.each([
  [0, 0, 1],
  [7, 37, -0.75],
  [2, 90, 1.6],
])(
  'coordinates a storey at base %s/yaw %s/delta %s without scaling slabs, rails or other storeys',
  async (base, yaw, delta) => {
    const original = newSession(buildingWithNeighbors(base, yaw));
    const before = structuredClone(original);
    const result = await applyPlan(
      original,
      directPlan(storeyEdit(original.project, delta)),
    );
    check(result.session.project, expectedStoreyEdit(original.project, delta));
    expect(result.session.project.volumes.at(-1)).toEqual(
      before.project.volumes.at(-1),
    );
    expect(original).toEqual(before);
    for (const v of result.session.project.volumes.filter(
      (v) => v.groupId === 'building',
    )) {
      expect(v.geometry).toBe(
        original.project.volumes.find((old) => old.id === v.id)!.geometry,
      );
      const stats = await solidStats(v);
      expect(stats.volume).toBeGreaterThan(0);
      if (/^(column|head|upright)-/.test(v.id)) {
        const level = Number(v.component!.level!.split(' ')[1]);
        const slab = result.session.project.volumes.find(
          (o) => o.id === (level === 2 ? 'roof' : `floor-${level + 1}`),
        )!;
        expect(v.position.y + v.dimensions.height).toBeCloseTo(
          slab.position.y,
          8,
        );
      }
    }
    const restored = parseSession(serializeSession(result.session));
    check(restored.project, result.session.project);
    const undone = await applyPlan(
      restored,
      directPlan({ type: 'undo', count: 1 }),
    );
    expect(undone.session.project).toEqual(original.project);
  },
);

it('honors local resize anchors and world translation; explicit children are not moved twice', async () => {
  const host = { ...makeVolume(), id: 'host', rotation: 90 };
  const child = {
    ...makeVolume(),
    id: 'child',
    position: { x: 0, y: 2, z: 0 },
    component: {
      role: 'panel' as const,
      hostId: host.id,
      level: null,
      motion: 'none' as const,
      travel: 1,
    },
  };
  const follower = { ...child, id: 'follower' };
  const original = newSession({
    volumes: [host, child, follower],
    selectedId: null,
  });
  const { session } = await applyPlan(
    original,
    directPlan({
      type: 'edit_components',
      edits: [
        {
          targets: [host.id, child.id],
          where: [],
          translation: { x: 1, y: 3, z: 0 },
          resize: { axis: 'width', mode: 'add', value: 2, anchor: 1 },
        },
      ],
    }),
  );
  expect(session.project.volumes[0].position).toEqual({ x: 1, y: 3, z: 1 });
  expect(session.project.volumes[1].position).toEqual({ x: 0, y: 5, z: 0 });
  expect(session.project.volumes[2].position.y).toBe(5);
  expect(session.project.volumes[1].component).toEqual(child.component);
});

it.each([
  'overlap',
  'missing',
  'invalid size',
  'locked',
  'verification',
] as const)('rolls back every component and history on %s', async (failure) => {
  const original = newSession(buildingWithNeighbors());
  if (failure === 'locked') original.project.groups![0].locked = true;
  const before = structuredClone(original);
  const op = storeyEdit(original.project);
  if (failure === 'overlap') op.edits.push(op.edits[0]);
  if (failure === 'missing') op.edits[1].targets.push('does-not-exist');
  if (failure === 'invalid size')
    op.edits.push({
      targets: ['neighbor'],
      where: [],
      translation: null,
      resize: { axis: 'height', mode: 'add', value: -400, anchor: 0 },
    });
  const plan = directPlan(op);
  if (failure === 'verification')
    plan.operations.push({
      type: 'verify',
      targets: ['roof'],
      metric: 'base',
      comparison: 'equal',
      value: 100,
      tolerance: 0,
    });
  await expect(applyPlan(original, plan)).rejects.toThrow();
  expect(original).toEqual(before);
});

it('keeps the 32-set / 4096-object bounds and rejects empty transforms and nonpositive scaling', async () => {
  const original = newSession(buildingWithNeighbors());
  const op = storeyEdit(original.project);
  expect(
    componentEditOperation.safeParse({
      ...op,
      edits: Array(33).fill(op.edits[0]),
    }).success,
  ).toBe(false);
  expect(
    componentEditOperation.safeParse({
      ...op,
      edits: [{ ...op.edits[0], targets: Array(4097).fill('roof') }],
    }).success,
  ).toBe(false);
  for (const resize of [
    null,
    { axis: 'height' as const, mode: 'scale' as const, value: -1, anchor: 0 },
  ])
    await expect(
      applyPlan(
        original,
        directPlan({
          type: 'edit_components',
          edits: [{ targets: ['roof'], where: [], translation: null, resize }],
        }),
      ),
    ).rejects.toThrow();
});

it('terminates repeated budget overflows within the existing repair allowance and leaves the original untouched', async () => {
  const original = newSession({ volumes: [makeVolume()], selectedId: null });
  const before = structuredClone(original);
  let calls = 0;
  await expect(
    stagedPlan(
      original,
      defaultCamera,
      async (): Promise<Plan> => {
        calls++;
        return continuing(
          Array.from({ length: 32 }, () => ({
            type: 'move',
            targets: [original.project.volumes[0].id],
            direction: 'east',
            distance: 0.01,
          })),
        );
      },
      undefined,
      undefined,
      { agent: true },
    ),
  ).rejects.toThrow('Your project is unchanged');
  expect(calls).toBe(12);
  expect(original).toEqual(before);
});

it('rejects empty or reversed filters and propagating into a locked descendant', async () => {
  const original = newSession(buildingWithNeighbors());
  for (const where of [
    [{ property: 'level' as const, equals: 'Missing level' }],
    [{ property: 'height' as const, min: 10, max: 2 }],
  ]) {
    const op = storeyEdit(original.project);
    op.edits[0].where = where;
    await expect(applyPlan(original, directPlan(op))).rejects.toThrow();
  }
  const protectedChild = {
    ...makeVolume(),
    id: 'protected',
    groupId: 'locked',
    position: { x: 0, y: 11, z: 0 },
    component: {
      role: 'element' as const,
      hostId: 'roof',
      level: null,
      motion: 'none' as const,
      travel: 1,
    },
  };
  original.project.groups!.push({
    id: 'locked',
    name: 'Protected',
    locked: true,
    visible: true,
  });
  original.project.volumes.push(protectedChild);
  const before = structuredClone(original);
  await expect(
    applyPlan(original, directPlan(storeyEdit(original.project))),
  ).rejects.toThrow('locked');
  expect(original).toEqual(before);
});

it('handles the existing 4096-component capacity in one bounded edit and one Undo', async () => {
  const volumes = Array.from({ length: 4096 }, (_, i) => ({
    ...makeVolume(),
    id: `part-${i}`,
    groupId: 'repeated',
    dimensions: { width: 1, depth: 1, height: 2 },
    position: { x: i % 64, y: 0, z: Math.floor(i / 64) },
  }));
  const original = newSession({
    volumes,
    selectedId: null,
    groups: [
      {
        id: 'repeated',
        name: 'Repeated structure',
        visible: true,
        locked: false,
      },
    ],
  });
  const { session } = await applyPlan(
    original,
    directPlan({
      type: 'edit_components',
      edits: [
        {
          targets: ['$group:repeated'],
          where: [{ property: 'height', min: 2, max: 2 }],
          resize: { axis: 'height', mode: 'add', value: 0.5, anchor: 0 },
          translation: null,
        },
      ],
    }),
  );
  expect(session.project.volumes).toHaveLength(4096);
  expect(
    session.project.volumes.every(
      (v, i) =>
        v.id === volumes[i].id &&
        v.dimensions.height === 2.5 &&
        v.position.y === 0,
    ),
  ).toBe(true);
  expect(session.past).toEqual([original.project]);
  expect(original.project.volumes.every((v) => v.dimensions.height === 2)).toBe(
    true,
  );
  const undo = await applyPlan(session, directPlan({ type: 'undo', count: 1 }));
  expect(undo.session.project).toEqual(original.project);
});
