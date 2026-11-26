import { it, expect } from 'vitest';
import { applyPlan, directPlan, newSession } from './engine';
import { makeVolume } from '../model';
import { parsePlan } from './plan';
import { requestSchema } from '../../server/provider';
import { sceneContext, defaultCamera } from './context';
it('workspace controls preserve geometry, selection, redo and modeling context', async () => {
  const v = makeVolume(1, { width: 4, depth: 3, height: 2 });
  const s = newSession({ volumes: [v], selectedId: v.id });
  const moved = await applyPlan(
    s,
    directPlan({
      type: 'move',
      targets: ['$selected'],
      direction: 'right',
      distance: 2,
    }),
  );
  const undone = await applyPlan(
    moved.session,
    directPlan({ type: 'undo', count: 1 }),
  );
  const before = structuredClone(undone.session);
  const next = await applyPlan(before, {
    intent: 'apply',
    message: 'Switch the view and toggle the map.',
    operations: [
      { type: 'workspace', action: 'view_orthographic' },
      { type: 'workspace', action: 'map_toggle' },
    ],
  });
  expect(next.session).toEqual(before);
  expect(
    parsePlan(directPlan({ type: 'workspace', action: 'theme_day' }))
      .operations,
  ).toHaveLength(1);
  expect(() =>
    parsePlan({
      intent: 'apply',
      message: 'Unsupported',
      operations: [{ type: 'workspace', action: 'run_script' }],
    }),
  ).toThrow();
});
it('workspace context is validated at the provider boundary', () => {
  const p = { volumes: [], selectedId: null };
  const s = newSession(p);
  const input = {
    message: 'Toggle map',
    history: [],
    scene: sceneContext(s.project, s.context, defaultCamera),
    workspace: {
      mapVisible: false,
      mapConfigured: false,
      view: 'orthographic',
      theme: 'day',
      renderMode: 'studio',
    },
  };
  expect(requestSchema.parse(input).workspace?.view).toBe('orthographic');
  expect(() =>
    requestSchema.parse({
      ...input,
      workspace: { ...input.workspace, view: 'unknown' },
    }),
  ).toThrow();
});
