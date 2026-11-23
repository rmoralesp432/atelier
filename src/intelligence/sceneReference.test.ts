import { expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeVolume as createVolume, type Dimensions } from '../model';
import { newSession, applyPlan, directPlan } from './engine';
import { defaultCamera, sceneContext } from './context';
import { sceneReference } from './sceneReference';
import { inspectScene, referenceSummary } from '../../server/sceneInspection';
import { requestSchema, type ModelRequest } from '../../server/provider';
import { solidStats } from '../geometry/kernel';
import { stagedPlan } from './checkedPlanner';
import { verifyCompletion } from './completion';
import { criteria, measure, selector } from '../../tests/fixtures/completion';
import { parseSession, serializeSession } from './engine';

const makeVolume = (name: string, dimensions?: Dimensions) => ({
  ...createVolume(1, dimensions),
  name,
});

const describe = (s: ReturnType<typeof newSession>) =>
  sceneContext(s.project, s.context, defaultCamera);
function input(
  original: ReturnType<typeof newSession>,
  current = original,
): ModelRequest {
  const scene = describe(current);
  return requestSchema.parse({
    message: 'Keep the existing clearances',
    history: [],
    scene,
    sceneReference: sceneReference(original, scene, defaultCamera),
  });
}
const query = {
  ids: [],
  role: null,
  snapshot: 'compare',
  relativeTo: null,
} as const;
const inspect = (
  r: ModelRequest,
  q: Partial<Parameters<typeof inspectScene>[1]> = {},
) => inspectScene(r, { ...query, ids: [], ...q }) as any;

it('retains the request-start model across several provisional changes, including removals and new identities', async () => {
  const base = makeVolume('Elliptical foot', {
    width: 0.72,
    depth: 0.44,
    height: 0.11,
  });
  base.geometry = { kind: 'cylinder' };
  const original = newSession({ volumes: [base], selectedId: null });
  const frozen = structuredClone(original);
  const initial = input(original);
  expect(initial.sceneReference!.replacements).toHaveLength(0);
  let current = (
    await applyPlan(
      original,
      directPlan({
        type: 'move',
        targets: [base.id],
        direction: 'up',
        distance: 0.27,
      }),
    )
  ).session;
  current = (
    await applyPlan(
      current,
      directPlan({
        type: 'move',
        targets: [base.id],
        direction: 'right',
        distance: 0.42,
      }),
    )
  ).session;
  const data = inspect(input(original, current));
  expect(data.objects[0].before.position.y).toBe(0);
  expect(data.objects[0].current.position.y).toBe(0.27);
  expect(data.objects[0].changedFields).toContain('position');
  expect(original).toEqual(frozen);
  // A new user turn starts from the last committed model, not an old reference.
  expect(inspect(input(current)).objects[0].before.position.y).toBe(0.27);
  expect(referenceSummary(input(current)).changed).toEqual([]);
  current = (
    await applyPlan(
      current,
      directPlan({ type: 'delete', targets: [base.id] }),
      defaultCamera,
      true,
    )
  ).session;
  const fresh = makeVolume('Fresh identity', {
    width: 0.2,
    depth: 0.2,
    height: 0.2,
  });
  current.project = { ...current.project, volumes: [fresh] };
  const removed = inspect(input(original, current));
  expect(removed.objects.map((o: any) => o.state)).toEqual([
    'removed',
    'created',
  ]);
  expect(removed.objects[0].before).toEqual(describe(original).objects[0]);
  expect(removed.objects[1].before).toBeNull();
});

it('compares reversed signed gaps in world coordinates for rotated different shapes, without claiming surface contact', async () => {
  const prism = makeVolume('Prism', { width: 0.9, depth: 0.55, height: 0.62 });
  prism.rotation = 31;
  prism.position = { x: -1.1, y: 0.4, z: 0.6 };
  const sphere = makeVolume('Sphere', {
    width: 0.36,
    depth: 0.36,
    height: 0.36,
  });
  sphere.geometry = { kind: 'sphere' };
  sphere.position = { x: 0.8, y: 1.3, z: -0.2 };
  const original = newSession({ volumes: [prism, sphere], selectedId: null });
  const current = (
    await applyPlan(
      original,
      directPlan({
        type: 'move',
        targets: [sphere.id],
        direction: 'down',
        distance: 0.21,
      }),
    )
  ).session;
  const r = input(original, current);
  const forward = inspect(r, { ids: [sphere.id], relativeTo: prism.id });
  const reverse = inspect(r, { ids: [prism.id], relativeTo: sphere.id });
  const a = await solidStats(prism),
    b = await solidStats(sphere);
  expect(forward.relations[0].before.forwardGap.y).toBeCloseTo(
    b.bounds.min[1] - a.bounds.max[1],
    6,
  );
  expect(forward.relations[0].current.forwardGap.y).toBeCloseTo(
    b.bounds.min[1] - 0.21 - a.bounds.max[1],
    6,
  );
  expect(forward.relations[0].before.centerDelta.x).toBeCloseTo(
    -reverse.relations[0].before.centerDelta.x,
    9,
  );
  expect(forward.relations[0].before.forwardGap.x).toBeCloseTo(
    reverse.relations[0].before.reverseGap.x,
    9,
  );
  expect(forward.frame).toContain('Y up');
  expect(forward.measurementContract).toContain('not physical contact');
});

it('never substitutes the edited model for absent or incomplete original data', () => {
  const original = newSession({ volumes: [makeVolume('A')], selectedId: null });
  const r = input(original);
  expect(inspect({ ...r, sceneReference: undefined }).available).toBe(false);
  expect(
    inspect({ ...r, sceneReference: undefined }, { snapshot: 'current' })
      .available,
  ).toBe(true);
  const broken = structuredClone(r);
  broken.sceneReference!.ids.push('lost-id');
  expect(inspect(broken).available).toBe(false);
  expect(inspect(r, { ids: ['unknown'] }).missingIds).toEqual(['unknown']);
  expect(inspect(r, { relativeTo: 'unknown' }).relations[0].before).toBeNull();
});

it('bounds inspection output and reports omitted rows for large scenes; initial reference contains no duplicate object inventory', () => {
  const original = newSession({
    volumes: Array.from({ length: 431 }, (_, i) => makeVolume(`Object ${i}`)),
    selectedId: null,
  });
  const r = input(original);
  expect(r.sceneReference!.replacements).toHaveLength(0);
  expect(inspect(r).objects).toHaveLength(200);
  expect(inspect(r).matched).toBe(431);
  expect(inspect(r).omitted).toBe(231);
  const last = original.project.volumes.at(-1)!.id;
  expect(inspect(r, { ids: [last] }).objects[0].id).toBe(last);
});

it('transfers to a hollow horizontal sleeve: retains the pre-edit cap clearance across stages, protects neighbors and blocks displacement', async () => {
  let original = newSession({ volumes: [], selectedId: null });
  original = (
    await applyPlan(
      original,
      directPlan({
        type: 'create_at',
        name: 'Sleeve',
        shape: 'cylinder',
        width: 0.8,
        depth: 0.8,
        height: 1.2,
        x: 0,
        y: 0.2,
        z: 0,
        rotation: 0,
      }),
    )
  ).session;
  const sleeve = original.project.volumes[0].id;
  original = (
    await applyPlan(
      original,
      directPlan({
        type: 'hollow',
        target: sleeve,
        thickness: 0.08,
        openTop: true,
      }),
      defaultCamera,
      true,
    )
  ).session;
  original = (
    await applyPlan(
      original,
      directPlan({ type: 'orient', targets: [sleeve], x: 90, y: 0, z: 0 }),
    )
  ).session;
  const cap = makeVolume('Loose cap', {
    width: 0.96,
    depth: 0.12,
    height: 0.96,
  });
  cap.position = { x: 0, y: 0.32, z: 0.94 };
  const neighbor = makeVolume('Nearby untouched sphere', {
    width: 0.3,
    depth: 0.3,
    height: 0.3,
  });
  neighbor.geometry = { kind: 'sphere' };
  neighbor.position = { x: 0.7, y: 0.4, z: 1 };
  original.project = {
    ...original.project,
    volumes: [...original.project.volumes, cap, neighbor],
  };
  const untouched = structuredClone(original);
  const target = criteria(
    [
      measure('length', 'depth', 1.66, selector([sleeve])),
      {
        kind: 'offset',
        id: 'gap',
        label: 'Retain cap clearance',
        first: selector([sleeve]),
        second: selector([cap.id]),
        axis: 'z',
        firstAnchor: 'max',
        secondAnchor: 'min',
        value: 0.28,
        tolerance: 0.00001,
      },
      {
        kind: 'preserve',
        id: 'cap',
        label: 'Retain cap form and transverse position',
        selector: selector([cap.id]),
        properties: [
          'identity',
          'geometry',
          'dimensions',
          'x',
          'y',
          'rotation',
        ],
      },
    ],
    [sleeve, cap.id],
    'Lengthen the sleeve symmetrically by 0.46 m and retain the loose cap clearance.',
  );
  let calls = 0;
  const result = await stagedPlan(
    original,
    defaultCamera,
    async (working) => {
      if (++calls === 1)
        return {
          intent: 'apply',
          message: 'Lengthen sleeve',
          operations: [
            {
              type: 'edit_components',
              edits: [
                {
                  targets: [sleeve],
                  where: [],
                  translation: null,
                  resize: {
                    axis: 'depth',
                    mode: 'add',
                    value: 0.46,
                    anchor: 0.5,
                  },
                },
              ],
            },
          ],
          planning: {
            stage: 'Lengthen',
            assumptions: [],
            next: 'Inspect original clearance',
          },
        };
      const data = inspect(input(original, working), {
        ids: [cap.id],
        relativeTo: sleeve,
      });
      const gap = data.relations[0];
      expect(gap.before.forwardGap.z).toBeCloseTo(0.28, 8);
      expect(gap.current.forwardGap.z).toBeCloseTo(0.05, 8);
      // This rule exists only in the test driver, not in the application.
      const wantedZ =
        gap.current.firstBounds.max.z +
        gap.before.forwardGap.z +
        cap.dimensions.depth / 2;
      return directPlan({
        type: 'position',
        targets: [cap.id],
        x: null,
        y: null,
        z: wantedZ,
      });
    },
    undefined,
    undefined,
    {
      agent: true,
      verifyCompletion: (candidate) =>
        verifyCompletion(target, original, candidate),
    },
  );
  expect(result.verification?.canCommit).toBe(true);
  expect(result.verification?.status).toBe('verified');
  const after = result.prepared!.session;
  expect(after.project.volumes.map((v) => v.id)).toEqual(
    original.project.volumes.map((v) => v.id),
  );
  expect(after.project.volumes[2]).toEqual(neighbor);
  expect(original).toEqual(untouched);
  const beforeSolid = await solidStats(original.project.volumes[0]),
    afterSolid = await solidStats(after.project.volumes[0]);
  expect(afterSolid.bounds.max[2] - afterSolid.bounds.min[2]).toBeCloseTo(
    1.66,
    6,
  );
  expect(afterSolid.volume / beforeSolid.volume).toBeCloseTo(1.66 / 1.2, 5);
  expect(afterSolid.volume).toBeLessThan(0.5 * Math.PI * 0.4 ** 2 * 1.66); // Still hollow.
  const bad = (
    await applyPlan(
      after,
      directPlan({
        type: 'move',
        targets: [cap.id],
        direction: 'back',
        distance: 0.12,
      }),
    )
  ).session;
  expect((await verifyCompletion(target, original, bad)).canCommit).toBe(false);
  const restored = parseSession(serializeSession(after));
  expect(restored.project).toEqual(after.project);
  const undo = (
    await applyPlan(restored, directPlan({ type: 'undo', count: 1 }))
  ).session;
  expect(undo.project).toEqual(original.project);
  expect(
    (await applyPlan(undo, directPlan({ type: 'redo', count: 1 }))).session
      .project,
  ).toEqual(after.project);
  const evidenceDirectory = process.env.ATELIER_WORKSHOP_EVIDENCE_DIR;
  if (evidenceDirectory) {
    mkdirSync(evidenceDirectory, { recursive: true });
    for (const [name, session] of [
      ['sleeve-before', original],
      ['sleeve-after', after],
    ] as const)
      writeFileSync(
        join(evidenceDirectory, `${name}.atelier.json`),
        JSON.stringify(
          {
            ...JSON.parse(serializeSession(session)),
            name: `Offline transfer: ${name}`,
          },
          null,
          2,
        ),
      );
    writeFileSync(
      join(evidenceDirectory, 'sleeve-evidence.json'),
      JSON.stringify(
        {
          provenance:
            'Scripted stagedPlan driver and acceptance criteria; actual geometry kernel, independent completion predicates and session codec. This transfer test does not exercise App.tsx or fresh AI.',
          request: target.checks[0].evidence,
          before: beforeSolid,
          after: afterSolid,
          comparison: inspect(input(original, after), {
            ids: [cap.id],
            relativeTo: sleeve,
          }),
          verification: result.verification,
          displacedCap: await verifyCompletion(target, original, bad),
          allIdsPreserved: true,
          neighborUnchanged: true,
          serializationUndoRedo: true,
        },
        null,
        2,
      ),
    );
  }
});
