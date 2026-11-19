import { describe, expect, it } from 'vitest';
import { applyPlan, directPlan, newSession } from './engine';
import { defaultCamera } from './context';
import { makeVolume } from '../model';
import {
  assertTransactionCurrent,
  captureTransaction,
  reconcileTransaction,
} from './transaction';

function setup() {
  const volume = { ...makeVolume(), id: 'a' };
  const live = newSession({ volumes: [volume], selectedId: 'a' });
  live.context.focusIds = ['a'];
  return live;
}
describe('transaction commit contract', () => {
  it('freezes alias bindings and mutable history containers while sharing immutable geometry', () => {
    const live = setup();
    const baseline = captureTransaction(live);
    live.context.focusIds.push('b');
    live.past.push(live.project);
    expect(baseline.context.focusIds).toEqual(['a']);
    expect(baseline.past).toEqual([]);
    expect(baseline.project.volumes).toBe(live.project.volumes);
    expect(() => assertTransactionCurrent(baseline, live)).toThrow(
      'Undo history',
    );
  });
  it('commits actual geometry and preserves newer UI selection without changing IDs or one-step Undo', async () => {
    const live = setup();
    const baseline = captureTransaction(live);
    const result = await applyPlan(
      baseline,
      directPlan({
        type: 'move',
        targets: ['$selected'],
        direction: 'up',
        distance: 2.7,
      }),
      defaultCamera,
    );
    live.project = { ...live.project, selectedId: null, selectedIds: [] };
    live.context.focusIds = [];
    const committed = reconcileTransaction(baseline, result.session, live);
    expect(committed.project.volumes[0].position.y).toBe(2.7);
    expect(committed.project.volumes[0].id).toBe('a');
    expect(committed.project.selectedId).toBe(null);
    expect(committed.context.focusIds).toEqual([]);
    expect(committed.past).toEqual([baseline.project]);
    const undone = await applyPlan(
      committed,
      directPlan({ type: 'undo', count: 1 }),
      defaultCamera,
    );
    expect(undone.session.project.volumes).toEqual(baseline.project.volumes);
    const redone = await applyPlan(
      undone.session,
      directPlan({ type: 'redo', count: 1 }),
      defaultCamera,
    );
    expect(redone.session.project.volumes).toEqual(committed.project.volumes);
  });
  it.each([
    'position',
    'dimensions',
    'identity',
    'visibility',
    'group',
    'history',
    'redo',
  ])(
    'rejects a genuine %s change even when component count is unchanged',
    (kind) => {
      const live = setup(),
        baseline = captureTransaction(live);
      const v = live.project.volumes[0];
      if (kind === 'history') live.past.push(live.project);
      else if (kind === 'redo') live.future.push(live.project);
      else
        live.project = {
          ...live.project,
          volumes: [
            {
              ...v,
              ...(kind === 'position'
                ? { position: { ...v.position, x: 9 } }
                : {}),
              ...(kind === 'dimensions'
                ? { dimensions: { ...v.dimensions, height: 9 } }
                : {}),
              ...(kind === 'identity' ? { id: 'b' } : {}),
              ...(kind === 'visibility' ? { visible: false } : {}),
              ...(kind === 'group' ? { groupId: 'different' } : {}),
            },
          ],
        };
      expect(() => assertTransactionCurrent(baseline, live)).toThrow(
        'not applied',
      );
    },
  );
  it('accepts independently encoded equal data, but protects group locks and design metadata', () => {
    const live = setup(),
      baseline = captureTransaction(live);
    expect(() =>
      assertTransactionCurrent(baseline, structuredClone(live)),
    ).not.toThrow();
    live.project = {
      ...live.project,
      groups: [{ id: 'g', name: 'Keep', locked: true, visible: true }],
    };
    expect(() => assertTransactionCurrent(baseline, live)).toThrow();
  });
});
