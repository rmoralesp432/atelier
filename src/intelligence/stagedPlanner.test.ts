import { it, expect, vi } from 'vitest';
import { stagedPlan } from './checkedPlanner';
import { applyPlan, directPlan, newSession } from './engine';
import { defaultCamera } from './context';
import { solidStats } from '../geometry/kernel';
import type { Plan } from './plan';

const empty = () => newSession({ volumes: [], selectedId: null });
const creation = (): Plan => ({
  ...directPlan({
    type: 'create_at',
    name: 'Study wall',
    shape: 'box',
    width: 8,
    depth: 0.3,
    height: 4,
    x: 0,
    y: 0,
    z: 0,
    rotation: 0,
  }),
  planning: {
    stage: 'Wall',
    next: 'Cut and check the opening',
    assumptions: [],
  },
});
const finish = (): Plan => ({
  intent: 'finish',
  message: 'Wall and opening checked.',
  operations: [],
  planning: { stage: 'Verification', next: null, assumptions: [] },
});
it('passes evaluated scene identities to subsequent stages, commits one undo step, and preserves originals', async () => {
  const original = empty(),
    seenIds: string[] = [];
  const request = vi.fn(async (session, _feedback, execution) => {
    if (!execution) return creation();
    const wall = session.project.volumes[0];
    seenIds.push(wall.id);
    if (execution.stage === 2) {
      expect(execution.receipts[0].created).toEqual([wall.id]);
      return {
        ...directPlan({
          type: 'opening',
          target: wall.id,
          width: 2,
          height: 2,
          sill: 1,
          offset: 0,
        }),
        planning: {
          stage: 'Opening',
          next: 'Inspect the resulting geometry',
          assumptions: [],
        },
      };
    }
    expect((await solidStats(wall)).volume).toBeCloseTo(
      8 * 0.3 * 4 - 2 * 0.3 * 2,
      4,
    );
    expect(execution.receipts[1].changed).toEqual([wall.id]);
    return finish();
  });
  const result = await stagedPlan(original, defaultCamera, request);
  expect(seenIds[0]).toBe(seenIds[1]);
  expect(result.prepared!.session.project.volumes[0].id).toBe(seenIds[0]);
  expect(result.prepared!.session.past).toEqual([original.project]);
  expect(original).toEqual(empty());
  expect(result.reviewRequired).toBe(false); // New geometry only, no repeated review.
  const undo = await applyPlan(
    result.prepared!.session,
    directPlan({ type: 'undo', count: 1 }),
  );
  expect(undo.session.project).toEqual(original.project);
});
it('requires review for destructive changes to existing geometry', async () => {
  const source = (await applyPlan(empty(), { ...creation(), planning: null }))
    .session;
  const r = await stagedPlan(source, defaultCamera, async (s) =>
    directPlan({
      type: 'opening',
      target: s.project.volumes[0].id,
      width: 2,
      height: 2,
      sill: 1,
      offset: 0,
    }),
  );
  expect(r.reviewRequired).toBe(true);
  expect(source.project.volumes[0].geometry?.kind).toBe('box');
});
it('repairs a stage against its last successful state without re-creating members', async () => {
  const source = empty();
  let calls = 0;
  const result = await stagedPlan(
    source,
    defaultCamera,
    async (s, feedback, execution) => {
      calls++;
      if (!execution) return creation();
      expect(s.project.volumes).toHaveLength(1);
      if (!feedback)
        return directPlan({
          type: 'opening',
          target: s.project.volumes[0].id,
          width: 9,
          height: 2,
          sill: 1,
          offset: 0,
        });
      expect(feedback.error).toContain('fit');
      expect(s.project.volumes[0].geometry?.kind).toBe('box');
      return directPlan({
        type: 'opening',
        target: s.project.volumes[0].id,
        width: 2,
        height: 2,
        sill: 1,
        offset: 0,
      });
    },
  );
  expect(calls).toBe(3);
  expect(result.prepared!.session.project.volumes).toHaveLength(1);
  expect(source.project.volumes).toHaveLength(0);
});
it('discards all provisional edits on clarification, cancellation or exhausted continuation budget', async () => {
  const source = empty();
  const clarified = await stagedPlan(
    source,
    defaultCamera,
    async (_s, _f, execution) =>
      execution
        ? {
            intent: 'clarify',
            message: 'Which facade should have the opening?',
            operations: [],
          }
        : creation(),
  );
  expect(clarified.prepared).toBeUndefined();
  expect(clarified.plan.intent).toBe('clarify');
  const abort = new AbortController();
  await expect(
    stagedPlan(
      source,
      defaultCamera,
      async () => {
        abort.abort();
        return creation();
      },
      undefined,
      abort.signal,
    ),
  ).rejects.toThrow('Stopped');
  await expect(
    stagedPlan(source, defaultCamera, async () => ({
      ...directPlan({
        type: 'create',
        shape: 'box',
        width: 1,
        depth: 1,
        height: 1,
        count: 1,
      }),
      planning: { stage: 'More', next: 'More', assumptions: [] },
    })),
  ).rejects.toThrow('five checked stages');
  expect(source.project.volumes).toHaveLength(0);
});
it('does not create undo entries for staged read-only inspection or permit premature success', async () => {
  const source = (await applyPlan(empty(), { ...creation(), planning: null }))
    .session;
  const r = await stagedPlan(
    source,
    defaultCamera,
    async (_s, _f, execution) =>
      execution
        ? finish()
        : {
            ...directPlan({
              type: 'measure',
              targets: ['$selected'],
              metric: 'properties',
            }),
            planning: { stage: 'Measure', next: 'Inspect', assumptions: [] },
          },
  );
  expect(r.prepared!.session.past).toEqual(source.past);
  await expect(
    stagedPlan(empty(), defaultCamera, async () => finish()),
  ).rejects.toThrow('before producing');
});
