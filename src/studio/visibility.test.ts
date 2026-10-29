import { expect, it } from 'vitest';
import {
  initialProject,
  isVisible,
  parseProject,
  serializeProject,
} from '../model';
import {
  applyPlan,
  directPlan,
  newSession,
  parseSession,
  serializeSession,
} from '../intelligence/engine';
import { sceneContext, defaultCamera } from '../intelligence/context';
import { exportObj } from '../geometry/export';
import { createARModel, disposeARModel } from '../ar/model';
import { setObjectVisibility } from './visibility';

it('hides a multi-selection without losing geometry or conversational focus, persists and undoes', async () => {
  const p = initialProject();
  p.selectedIds = p.volumes.map((v) => v.id);
  const original = newSession(p);
  const hidden = (
    await applyPlan(
      original,
      directPlan({
        type: 'visibility',
        targets: ['$selected'],
        visible: false,
      }),
    )
  ).session;
  expect(hidden.project.volumes).toEqual(
    p.volumes.map((v) => ({ ...v, visible: false })),
  );
  expect(hidden.project.selectedId).toBeNull();
  expect(hidden.project.selectedIds).toEqual([]);
  expect(hidden.context.focusIds).toEqual(p.selectedIds);
  expect(parseSession(serializeSession(hidden))).toEqual(hidden);
  expect(parseProject(serializeProject(hidden.project)).volumes).toEqual(
    hidden.project.volumes,
  );
  expect(
    sceneContext(hidden.project, hidden.context, defaultCamera).objects.every(
      (o) => !o.visible,
    ),
  ).toBe(true);
  const shown = (
    await applyPlan(
      hidden,
      directPlan({ type: 'visibility', targets: ['$focus'], visible: true }),
    )
  ).session;
  expect(shown.project.volumes.every((v) => isVisible(v, shown.project))).toBe(
    true,
  );
  const undone = (
    await applyPlan(hidden, directPlan({ type: 'undo', count: 1 }))
  ).session;
  expect(undone.project).toEqual(p);
  expect(original.project).toEqual(p);
});

it('reveals one item from a hidden locked layer while preserving siblings, and restores all undoably', async () => {
  const p = initialProject();
  p.groups = [{ id: 'layer', name: 'Structure', visible: false, locked: true }];
  p.volumes.forEach((v) => {
    v.groupId = 'layer';
  });
  const s = (
    await applyPlan(
      newSession(p),
      directPlan({
        type: 'visibility',
        targets: [p.volumes[0].id],
        visible: true,
      }),
    )
  ).session;
  expect(s.project.volumes.map((v) => isVisible(v, s.project))).toEqual([
    true,
    false,
  ]);
  expect(s.project.groups![0].locked).toBe(true);
  await expect(
    applyPlan(
      s,
      directPlan({
        type: 'move',
        targets: [p.volumes[0].id],
        direction: 'up',
        distance: 1,
      }),
    ),
  ).rejects.toThrow(/locked/);
  const all = (await applyPlan(s, directPlan({ type: 'show_all' }))).session;
  expect(all.project.volumes.every((v) => isVisible(v, all.project))).toBe(
    true,
  );
  expect(
    (await applyPlan(all, directPlan({ type: 'undo', count: 1 }))).session
      .project,
  ).toEqual(s.project);
});

it('omits individually hidden solids from real OBJ and AR snapshots and rejects invalid visibility', async () => {
  const p = initialProject();
  const hidden = setObjectVisibility(p, [p.volumes[0].id], false);
  const obj = await exportObj(hidden);
  expect(obj).not.toContain('o Main_pavilion');
  expect(obj).toContain('o Vertical_annex');
  const ar = await createARModel(hidden);
  expect(ar.children.map((o) => o.userData.id)).toEqual([p.volumes[1].id]);
  disposeARModel(ar);
  expect(() =>
    parseProject(
      JSON.stringify({
        version: 2,
        ...p,
        volumes: [{ ...p.volumes[0], visible: 'false' }],
      }),
    ),
  ).toThrow(/visibility/);
  await expect(exportObj(setObjectVisibility(p, 'all', false))).rejects.toThrow(
    /visible/,
  );
});
