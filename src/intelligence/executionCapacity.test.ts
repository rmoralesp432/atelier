import { it, expect } from 'vitest';
import {
  applyPlan,
  directPlan,
  newSession,
  serializeSession,
  parseSession,
} from './engine';
import { makeVolume } from '../model';
import { sceneContext, defaultCamera } from './context';
import { requestSchema } from '../../server/provider';
import { groupBounds } from '../geometry/spatial';

it.each([
  ['box', 30, 30, 40, 10],
  ['cylinder', 30, 30, 40, 10],
  ['box', 17, 11, 24, 6],
] as const)(
  'constructs and persists independent %s building components (%s × %s × %s, %s floors)',
  async (shape, width, depth, height, floors) => {
    const mass = makeVolume(1, { width, depth, height });
    mass.geometry = { kind: shape };
    const original = newSession({ volumes: [mass], selectedId: mass.id });
    const result = await applyPlan(
      original,
      directPlan({
        type: 'building_components',
        target: mass.id,
        floors,
        slabThickness: 0.25,
        facade: true,
        panelWidth: 4,
        mullionWidth: 0.06,
      }),
      defaultCamera,
      true,
    );
    const parts = result.session.project.volumes;
    expect(parts.filter((p) => p.component?.role === 'floor')).toHaveLength(
      floors,
    );
    expect(parts.filter((p) => p.component?.role === 'roof')).toHaveLength(1);
    expect(parts.filter((p) => p.material === 'glass').length).toBeGreaterThan(
      floors,
    );
    expect(new Set(parts.map((p) => p.id)).size).toBe(parts.length);
    const bounds = groupBounds(parts),
      initial = groupBounds([mass]);
    for (const edge of ['min', 'max'] as const)
      for (const axis of ['x', 'y', 'z'] as const)
        expect(bounds[edge][axis]).toBeCloseTo(initial[edge][axis], 4);
    const restored = parseSession(serializeSession(result.session));
    expect(restored.project.volumes).toHaveLength(parts.length);
    const scene = sceneContext(
      restored.project,
      restored.context,
      defaultCamera,
    );
    expect(
      requestSchema.safeParse({
        message: 'Move the upper windows inward',
        history: [],
        scene,
      }).success,
    ).toBe(true);
    const pane = parts.find((p) => p.material === 'glass')!;
    const edited = await applyPlan(
      restored,
      directPlan({ type: 'color', targets: [pane.id], color: '#112233' }),
    );
    expect(
      edited.session.project.volumes.filter((p) => p.color === '#112233'),
    ).toHaveLength(1);
    const undo = await applyPlan(
      result.session,
      directPlan({ type: 'undo', count: 1 }),
    );
    expect(undo.session.project).toEqual(original.project);
  },
  20000,
);
it('keeps a 144-object array addressable through follow-up editing and persistence', async () => {
  const cube = makeVolume(1, { width: 3, depth: 3, height: 3 });
  const original = newSession({ volumes: [cube], selectedId: cube.id });
  const result = await applyPlan(
    original,
    directPlan({
      type: 'array_grid',
      targets: ['$selected'],
      rows: 12,
      columns: 12,
      spacingX: 6,
      spacingZ: 7,
    }),
  );
  const parts = result.session.project.volumes;
  expect(parts).toHaveLength(144);
  expect(
    new Set(parts.map((p) => `${p.position.x},${p.position.z}`)).size,
  ).toBe(144);
  const moved = await applyPlan(
    result.session,
    directPlan({
      type: 'move',
      targets: parts.map((p) => p.id),
      direction: 'up',
      distance: 2,
    }),
  );
  expect(moved.session.project.volumes.every((p) => p.position.y === 2)).toBe(
    true,
  );
  expect(
    parseSession(serializeSession(moved.session)).project.volumes,
  ).toHaveLength(144);
});
