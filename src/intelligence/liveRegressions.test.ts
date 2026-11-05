import { it, expect, vi } from 'vitest';
import { stagedPlan } from './checkedPlanner';
import { parsePlan } from './plan';
import { applyPlan, directPlan, newSession } from './engine';
import { defaultCamera } from './context';
import { solidStats } from '../geometry/kernel';
import { makeVolume } from '../model';
import windowResponse from './fixtures/live-circular-window.json';
import type { DesignBrief } from './designBriefSchema';
const count = (n: number): DesignBrief => ({
  objective: 'Independent parts',
  editable: [],
  preserve: [],
  evidence: [],
  requirements: [
    {
      id: 'n',
      label: 'Count',
      kind: 'measure',
      selector: { refs: [], role: null, level: null, nameContains: null },
      metric: 'count',
      aggregation: 'each',
      comparison: 'equal',
      value: n,
      tolerance: 0,
      relativeTolerance: 0,
    },
  ],
});
it('executes the actual live circular-window response without losing the wall name between opening and glazing', async () => {
  const result = await stagedPlan(
    newSession({ volumes: [], selectedId: null }),
    defaultCamera,
    async () => parsePlan(windowResponse),
  );
  const vs = result.prepared!.session.project.volumes;
  const wall = vs.find((v) => v.name === 'Muro')!;
  expect(wall).toBeDefined();
  expect(
    Math.abs((await solidStats(wall)).volume - (9.6 - Math.PI * 0.3)),
  ).toBeLessThan(0.04);
  expect(vs.filter((v) => v.component?.hostId === wall.id)).toHaveLength(2);
  expect(vs.some((v) => v.material === 'glass')).toBe(true);
  expect(vs.some((v) => v.component?.role === 'frame')).toBe(true);
});
it('allows correcting provisional parts listed as editable while keeping the original acceptance checklist', async () => {
  const request = vi.fn(async (s, _feedback, execution) => {
    if (!execution)
      return {
        ...directPlan({
          type: 'create',
          shape: 'box',
          width: 2,
          depth: 2,
          height: 2,
          count: 1,
        }),
        brief: count(2),
        planning: { stage: 'First', next: 'Second', assumptions: [] },
      };
    return {
      ...directPlan({
        type: 'duplicate',
        targets: [s.project.volumes[0].id],
        count: 1,
        direction: 'right',
        distance: 3,
      }),
      brief: { ...count(2), editable: [s.project.volumes[0].id] },
    };
  });
  const result = await stagedPlan(
    newSession({ volumes: [], selectedId: null }),
    defaultCamera,
    request,
  );
  expect(result.prepared!.session.project.volumes).toHaveLength(2);
  expect(result.prepared!.session.context.lastBrief?.editable).toEqual([]);
});
it('binds undo-then-intersect to the restored operands and leaves unrelated models untouched', async () => {
  const a = {
    ...makeVolume(1, { width: 4, depth: 4, height: 4 }),
    name: 'Block',
  };
  const b = {
    ...makeVolume(2, { width: 2, depth: 2, height: 4 }),
    position: { ...a.position },
    name: 'Cutter',
  };
  const source = newSession({ volumes: [a, b], selectedId: a.id });
  const cut = (
    await applyPlan(
      source,
      directPlan({
        type: 'boolean',
        operation: 'subtract',
        targets: [a.id, b.id],
      }),
      defaultCamera,
      true,
    )
  ).session;
  const goal = { ...count(1), editable: [a.id, b.id] };
  const result = await stagedPlan(cut, defaultCamera, async () => ({
    intent: 'apply',
    message: 'Intersect originals',
    operations: [
      { type: 'undo', count: 1 },
      { type: 'boolean', operation: 'intersect', targets: [a.id, b.id] },
    ],
    brief: goal,
  }));
  expect(
    (await solidStats(result.prepared!.session.project.volumes[0])).volume,
  ).toBeCloseTo(16);
  expect((await solidStats(cut.project.volumes[0])).volume).toBeCloseTo(48);
});
