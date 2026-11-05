import { it, expect } from 'vitest';
import { initialProject } from '../model';
import { applyPlan, newSession, directPlan } from '../intelligence/engine';
import { defaultCamera } from '../intelligence/context';
import { operationSchema, type Operation } from '../intelligence/plan';
import { resolveWalkPlacement } from './walkPlacement';
const op = (targets: string[]): Extract<Operation, { type: 'walk_to' }> => ({
  type: 'walk_to',
  placement: 'between',
  targets,
  position: null,
  lookAt: null,
  eyeHeight: null,
});
it('places between named objects without editing geometry, selection, or modeling history', async () => {
  const project = initialProject();
  project.volumes[0].position = { x: -20, y: 4, z: 10 };
  project.volumes[1].position = { x: 10, y: 0, z: 20 };
  const operation = op(project.volumes.map((v) => v.id));
  expect(resolveWalkPlacement(project, operation).position).toEqual({
    x: -5,
    y: 0,
    z: 15,
  });
  const s = newSession(project);
  const result = await applyPlan(s, directPlan(operation), defaultCamera);
  expect(result.session).toEqual(s);
  expect(
    resolveWalkPlacement(project, op(project.volumes.map((v) => v.name)))
      .position,
  ).toEqual({ x: -5, y: 0, z: 15 });
});
it('rejects ambiguous, missing, duplicate and invalid camera placements atomically', async () => {
  const project = initialProject(),
    s = newSession(project),
    before = structuredClone(s);
  expect(() =>
    resolveWalkPlacement(project, op(['missing', 'missing'])),
  ).toThrow();
  expect(() =>
    resolveWalkPlacement(
      project,
      op([project.volumes[0].id, project.volumes[0].id]),
    ),
  ).toThrow();
  await expect(
    applyPlan(
      s,
      {
        intent: 'apply',
        message: 'test',
        operations: [
          {
            type: 'create',
            shape: 'box',
            width: 2,
            depth: 2,
            height: 3,
            count: 1,
          },
          op(['missing', 'missing']),
        ],
      },
      defaultCamera,
    ),
  ).rejects.toThrow();
  expect(s).toEqual(before);
  expect(operationSchema.safeParse({ ...op([]), eyeHeight: 200 }).success).toBe(
    false,
  );
  expect(() =>
    resolveWalkPlacement(project, {
      ...op([]),
      placement: 'coordinates',
      position: { x: 0, y: -1, z: 0 },
    }),
  ).toThrow();
});
it('supports exact coordinates, interior and front-of-object viewpoints', () => {
  const project = initialProject(),
    v = project.volumes[0];
  expect(
    resolveWalkPlacement(project, {
      ...op([]),
      placement: 'coordinates',
      position: { x: 12, y: 4, z: 20 },
    }).position,
  ).toEqual({ x: 12, y: 4, z: 20 });
  expect(
    resolveWalkPlacement(project, { ...op([v.id]), placement: 'center' })
      .position,
  ).toEqual(v.position);
  const front = resolveWalkPlacement(project, {
    ...op([v.id]),
    placement: 'in_front',
  });
  expect(front.position.z).toBeGreaterThan(
    v.position.z + v.dimensions.depth / 2,
  );
});
