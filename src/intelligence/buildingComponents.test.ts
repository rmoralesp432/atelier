import { it, expect } from 'vitest';
import {
  newSession,
  applyPlan,
  directPlan,
  serializeSession,
  parseSession,
} from './engine';
import { makeVolume } from '../model';
import { defaultCamera } from './context';
import { groupBounds } from '../geometry/spatial';
it('a four-story building is an editable grouped assembly in one undoable operation', async () => {
  const mass = makeVolume(1, { width: 12, depth: 8, height: 16 });
  mass.position = { x: 20, y: 2, z: -10 };
  mass.rotation = 30;
  const source = newSession({ volumes: [mass], selectedId: mass.id });
  const result = await applyPlan(
    source,
    directPlan({
      type: 'building_components',
      target: mass.id,
      floors: 4,
      slabThickness: 0.25,
      facade: true,
      panelWidth: 4,
      mullionWidth: 0.06,
    }),
    defaultCamera,
    true,
  );
  const parts = result.session.project.volumes;
  expect(parts.filter((v) => v.component?.role === 'floor')).toHaveLength(4);
  expect(parts.filter((v) => v.component?.role === 'roof')).toHaveLength(1);
  expect(parts.filter((v) => v.material === 'glass').length).toBeGreaterThan(8);
  expect(parts.filter((v) => v.material === 'frame').length).toBeGreaterThan(8);
  expect(new Set(parts.map((v) => v.groupId)).size).toBe(1);
  expect(new Set(parts.map((v) => v.id)).size).toBe(parts.length);
  expect(groupBounds(parts)).toEqual(groupBounds([mass]));
  expect(parts.every((v) => v.geometry?.kind !== 'building')).toBe(true);
  const restored = parseSession(serializeSession(result.session));
  const pane = restored.project.volumes.find((v) => v.material === 'glass')!;
  const changed = await applyPlan(
    restored,
    directPlan({ type: 'color', targets: [pane.id], color: '#ff0000' }),
  );
  expect(
    changed.session.project.volumes.filter((v) => v.color === '#ff0000'),
  ).toHaveLength(1);
  const undone = await applyPlan(
    result.session,
    directPlan({ type: 'undo', count: 1 }),
  );
  expect(undone.session.project).toEqual(source.project);
});
