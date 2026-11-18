import { expect, it } from 'vitest';
import { makeVolume } from '../model';
import {
  newSession,
  applyPlan,
  directPlan,
  serializeSession,
  parseSession,
  type Session,
} from './engine';
import { stagedPlan } from './checkedPlanner';
import { defaultCamera } from './context';
import { verifyCompletion } from './completion';
import { solidStats } from '../geometry/kernel';
import { criteria, measure, selector } from '../../tests/fixtures/completion';
import type { Plan } from './plan';
import type { CompletionCriteria } from './completionSchema';

const empty = () => newSession({ volumes: [], selectedId: null });
const box = (name = 'Piece', x = 0, height = 2) =>
  directPlan({
    type: 'create_at',
    name,
    shape: 'box',
    x,
    y: 0,
    z: 0,
    width: 2,
    depth: 2,
    height,
    rotation: 0,
  });
const step = (p: Plan): Plan => ({
  ...p,
  brief: null,
  planning: { stage: 'Model', assumptions: [], next: 'Inspect' },
});
const finish: Plan = {
  intent: 'finish',
  operations: [],
  message: 'Everything is correct: 999 perfect objects.',
};
const options = (c: CompletionCriteria, original: Session) => ({
  agent: true,
  verifyCompletion: (s: Session) => verifyCompletion(c, original, s),
});

it('rejects the independently reviewed one-box false finish, repairs missing/wrong objects, preserves IDs and commits once', async () => {
  const original = newSession({
    volumes: [
      {
        ...makeVolume(),
        id: 'neighbor',
        name: 'Neighbor',
        position: { x: -20, y: 0, z: 0 },
      },
    ],
    selectedId: null,
  });
  const c = criteria([
    measure('count', 'count', 3),
    measure('height', 'height', 2),
    {
      id: 'layout',
      label: 'Three distinct positions',
      kind: 'layout',
      selector: selector(),
      origin: { x: 0, y: 0, z: 0 },
      counts: { x: 3, y: 1, z: 1 },
      step: { x: 4, y: 0, z: 0 },
      rotation: 0,
      tolerance: 0.00001,
    },
  ]);
  let calls = 0,
    id = '';
  const result = await stagedPlan(
    original,
    defaultCamera,
    async (s, feedback) => {
      calls++;
      if (calls === 1) return step(box('Piece', 0, 1));
      if (calls === 2) {
        id = s.project.volumes[1].id;
        return finish;
      }
      if (calls === 3) {
        expect(
          feedback?.verification?.checks.filter((r) => !r.met).map((r) => r.id),
        ).toEqual(['count', 'height', 'layout']);
        expect(feedback?.error).toContain('expected equal 3');
        expect(
          feedback?.verification?.checks.find((r) => r.id === 'height')?.ids,
        ).toEqual([id]);
        expect(s.project.volumes[1].id).toBe(id);
        return step({
          intent: 'apply',
          message: 'Repair',
          operations: [
            {
              type: 'resize',
              targets: [id],
              axis: 'height',
              mode: 'set',
              value: 2,
            },
            ...box('Piece 2', 4).operations,
            ...box('Piece 3', 8).operations,
          ],
        });
      }
      return finish;
    },
    undefined,
    undefined,
    options(c, original),
  );
  expect(calls).toBe(4);
  expect(result.verification?.passed).toBe(true);
  expect(result.plan.message).not.toContain('999');
  expect(result.plan.message).toContain('count (each): 3');
  const built = result.prepared!.session;
  expect(built.project.volumes[0]).toEqual(original.project.volumes[0]);
  expect(built.project.volumes[1].id).toBe(id);
  expect(built.past).toEqual([original.project]);
  for (const v of built.project.volumes.slice(1))
    expect((await solidStats(v)).volume).toBeCloseTo(8, 6);
  const restored = parseSession(serializeSession(built));
  const undone = (
    await applyPlan(restored, directPlan({ type: 'undo', count: 1 }))
  ).session;
  expect(undone.project).toEqual(original.project);
  expect(
    (await applyPlan(undone, directPlan({ type: 'redo', count: 1 }))).session
      .project,
  ).toEqual(built.project);
});

it('checks solid material volume, not the envelope or a success message', async () => {
  const original = empty();
  const mass = (
    await applyPlan(
      original,
      directPlan({
        type: 'create_at',
        name: 'Frame',
        shape: 'box',
        width: 4,
        depth: 2,
        height: 4,
        x: 0,
        y: 0,
        z: 0,
        rotation: 0,
      }),
    )
  ).session;
  const c = criteria([measure('remaining-material', 'volume', 24)]);
  expect((await verifyCompletion(c, original, mass)).passed).toBe(false);
  const cutter = (
    await applyPlan(
      mass,
      directPlan({
        type: 'create_at',
        name: 'Void',
        shape: 'box',
        width: 1,
        depth: 2,
        height: 4,
        x: 0,
        y: 0,
        z: 0,
        rotation: 0,
      }),
    )
  ).session;
  const result = (
    await applyPlan(
      cutter,
      directPlan({
        type: 'boolean',
        operation: 'subtract',
        targets: cutter.project.volumes.map((v) => v.id),
      }),
      defaultCamera,
      true,
    )
  ).session;
  expect(result.project.volumes[0].dimensions).toEqual(
    mass.project.volumes[0].dimensions,
  );
  expect((await verifyCompletion(c, original, result)).passed).toBe(true);
});

it('checks alignment, positions and real solid-bound offsets; stale earlier success does not authorize a later mutation', async () => {
  const original = empty();
  let model = (
    await applyPlan(original, {
      intent: 'apply',
      message: 'Parts',
      operations: [...box('Lower').operations, ...box('Upper').operations],
    })
  ).session;
  model = (
    await applyPlan(
      model,
      directPlan({
        type: 'move',
        targets: [model.project.volumes[1].id],
        direction: 'up',
        distance: 2,
      }),
    )
  ).session;
  const c = criteria([
    { ...measure('aligned', 'x', 0), aggregation: 'range' },
    {
      kind: 'offset',
      id: 'contact-datum',
      label: 'Upper base meets lower top',
      first: selector(['$new'], 'Lower'),
      second: selector(['$new'], 'Upper'),
      axis: 'y',
      firstAnchor: 'max',
      secondAnchor: 'min',
      value: 0,
      tolerance: 0.000001,
    },
    {
      kind: 'relation',
      id: 'no-overlap',
      label: 'No shared solid material',
      first: selector(['$new'], 'Lower'),
      second: selector(['$new'], 'Upper'),
      relation: 'disjoint',
      tolerance: 0.000001,
    },
  ]);
  expect((await verifyCompletion(c, original, model)).passed).toBe(true);
  const misaligned = structuredClone(model);
  misaligned.project.volumes[1].position.x += 0.5;
  expect(
    (await verifyCompletion(c, original, misaligned)).checks.find(
      (r) => r.id === 'aligned',
    )?.met,
  ).toBe(false);
  const overlap = structuredClone(model);
  overlap.project.volumes[1].position.y -= 0.25;
  const failed = await verifyCompletion(c, original, overlap);
  expect(failed.checks.filter((r) => !r.met).map((r) => r.id)).toEqual([
    'contact-datum',
    'no-overlap',
  ]);
});

it('protects original identities/properties even after rename/removal and preserves out-of-scope exceptions', async () => {
  const original = (await applyPlan(empty(), box('Manual part'))).session;
  const id = original.project.volumes[0].id;
  const c = criteria(
    [
      {
        id: 'identity',
        label: 'Keep the original part',
        kind: 'preserve',
        selector: selector(['$original'], 'Manual'),
        properties: ['identity', 'dimensions'],
      },
    ],
    [id],
  );
  const renamed = structuredClone(original);
  renamed.project.volumes[0].name = 'Renamed';
  expect((await verifyCompletion(c, original, renamed)).passed).toBe(true);
  renamed.project.volumes[0].dimensions.width += 1;
  expect((await verifyCompletion(c, original, renamed)).passed).toBe(false);
  renamed.project.volumes[0] = {
    ...original.project.volumes[0],
    id: 'replacement',
  };
  expect(
    (await verifyCompletion(c, original, renamed)).checks.find(
      (r) => r.id === 'identity',
    )?.observed,
  ).toContain('removed/replaced');
  const protectedCriteria = criteria([
    measure('count', 'count', 1, selector(['$all'])),
  ]);
  expect(
    (await verifyCompletion(protectedCriteria, original, renamed)).checks.find(
      (r) => r.id === 'preserved-scope',
    )?.met,
  ).toBe(false);
});

it('cannot hide protected objects indirectly through their group, but permits explicitly requested visibility changes', async () => {
  const original = (await applyPlan(empty(), box('Keep visible'))).session;
  const id = original.project.volumes[0].id;
  original.project.volumes[0].groupId = 'group';
  original.project.groups = [
    { id: 'group', name: 'Existing group', visible: true, locked: false },
  ];
  const hidden = structuredClone(original);
  hidden.project.groups![0].visible = false;
  expect(hidden.project.volumes).toEqual(original.project.volumes);
  const c = criteria([measure('count', 'count', 1, selector(['$all']))]);
  const protectedResult = await verifyCompletion(c, original, hidden);
  expect(protectedResult.passed).toBe(false);
  expect(protectedResult.checks[0].observed).toContain('visible false');
  const authorized = criteria(
    [
      {
        kind: 'property',
        id: 'hidden',
        label: 'Hide the requested object',
        selector: selector([id]),
        property: 'visible',
        value: false,
      },
    ],
    [id],
  );
  expect((await verifyCompletion(authorized, original, hidden)).passed).toBe(
    true,
  );
  authorized.checks.push({
    source: 'request',
    evidence: 'Keep visible',
    requirement: {
      kind: 'preserve',
      id: 'keep-visible',
      label: 'Keep visible',
      selector: selector([id]),
      properties: ['visible'],
    },
  });
  expect((await verifyCompletion(authorized, original, hidden)).passed).toBe(
    false,
  );
});

it('checks a 225-part layout beyond the old brief limit and catches a duplicate despite the correct count', async () => {
  const original = empty();
  const seed = (await applyPlan(original, box())).session;
  const model = (
    await applyPlan(
      seed,
      directPlan({
        type: 'array_grid',
        targets: ['$created'],
        rows: 15,
        columns: 15,
        spacingX: 3,
        spacingZ: 4,
      }),
    )
  ).session;
  const c = criteria([
    {
      kind: 'layout',
      id: 'grid',
      label: 'Distinct grid positions',
      selector: selector(),
      origin: { x: 0, y: 0, z: 0 },
      counts: { x: 15, y: 1, z: 15 },
      step: { x: 3, y: 0, z: 4 },
      rotation: 0,
      tolerance: 0.000001,
    },
  ]);
  expect((await verifyCompletion(c, original, model)).passed).toBe(true);
  const duplicate = structuredClone(model);
  duplicate.project.volumes[224].position = {
    ...duplicate.project.volumes[0].position,
  };
  expect(
    (await verifyCompletion(c, original, duplicate)).checks.find(
      (r) => r.id === 'grid',
    )?.observed,
  ).toContain('224/225');
  const collapsed = structuredClone(c);
  const layout = collapsed.checks[0].requirement;
  if (layout.kind !== 'layout') throw new Error('Expected layout fixture');
  layout.step.x = 0;
  expect(
    (await verifyCompletion(collapsed, original, model)).checks.find(
      (r) => r.id === 'grid',
    )?.observed,
  ).toContain('positions must be distinct');
});

it('accepts a new correction instead of keeping an earlier satisfied dimension as an immutable obligation', async () => {
  const first = await stagedPlan(
    empty(),
    defaultCamera,
    async () => box(),
    undefined,
    undefined,
    options(criteria([measure('height', 'height', 2)]), empty()),
  );
  const original = first.prepared!.session;
  const id = original.project.volumes[0].id;
  const c = criteria(
    [
      measure('revised-height', 'height', 3, selector([id])),
      {
        kind: 'preserve',
        id: 'retained',
        label: 'Keep identity and footprint',
        selector: selector([id]),
        properties: ['identity', 'width', 'depth', 'position'],
      },
    ],
    [id],
  );
  const corrected = await stagedPlan(
    original,
    defaultCamera,
    async () =>
      directPlan({
        type: 'resize',
        targets: [id],
        axis: 'height',
        mode: 'set',
        value: 3,
      }),
    undefined,
    undefined,
    options(c, original),
  );
  expect(corrected.verification?.passed).toBe(true);
  const result = corrected.prepared!.session;
  expect(result.project.volumes[0].id).toBe(id);
  expect((await solidStats(result.project.volumes[0])).volume).toBeCloseTo(
    12,
    6,
  );
  expect(
    (await applyPlan(result, directPlan({ type: 'undo', count: 1 }))).session
      .project,
  ).toEqual(original.project);
});

it('failure/repair exhaustion leaves no state that poisons a new unrelated request', async () => {
  const original = (await applyPlan(empty(), box('Existing'))).session;
  const saved = serializeSession(original);
  const impossible = criteria([measure('missing', 'count', 4)]);
  let calls = 0;
  await expect(
    stagedPlan(
      original,
      defaultCamera,
      async () => (++calls === 1 ? step(box('Discarded', 30)) : finish),
      undefined,
      undefined,
      options(impossible, original),
    ),
  ).rejects.toThrow('Your project is unchanged');
  expect(calls).toBe(5);
  expect(serializeSession(original)).toBe(saved);
  let nextCalls = 0;
  const c = criteria([
    measure('one', 'count', 1),
    measure('height', 'height', 2),
  ]);
  const next = await stagedPlan(
    original,
    defaultCamera,
    async (s, feedback, execution) => {
      if (++nextCalls === 1) {
        expect(feedback).toBeUndefined();
        expect(execution?.receipts).toEqual([]);
        expect(execution?.remainingOperations).toBe(64);
        expect(serializeSession(s)).toBe(saved);
        return step(box('New unrelated cube', 10));
      }
      return finish;
    },
    undefined,
    undefined,
    options(c, original),
  );
  expect(next.verification?.passed).toBe(true);
  expect(next.prepared!.session.project.volumes.map((v) => v.name)).toEqual([
    'Existing',
    'New unrelated cube',
  ]);
  expect(next.prepared!.session.past.at(-1)).toEqual(original.project);
});

it('fails closed on absent checks, unavailable evidence, empty selectors and cancelled verification', async () => {
  const original = empty(),
    candidate = (await applyPlan(original, box())).session;
  expect(
    (await verifyCompletion(criteria([]), original, candidate)).passed,
  ).toBe(false);
  expect(
    (
      await verifyCompletion(
        criteria([
          measure('height', 'height', 2, selector(['$new'], 'Missing')),
        ]),
        original,
        candidate,
      )
    ).passed,
  ).toBe(false);
  expect(
    (
      await verifyCompletion(
        criteria([
          {
            id: 'unknown',
            label: 'Curvature continuity',
            kind: 'unavailable',
            reason: 'No analytic continuity measurement is available.',
          },
        ]),
        original,
        candidate,
      )
    ).passed,
  ).toBe(false);
  await expect(
    stagedPlan(
      original,
      defaultCamera,
      async () => box(),
      undefined,
      undefined,
      { agent: true },
    ),
  ).rejects.toThrow('verification is unavailable');
  const abort = new AbortController();
  await expect(
    stagedPlan(
      original,
      defaultCamera,
      async () => box(),
      undefined,
      abort.signal,
      {
        agent: true,
        verifyCompletion: async (s) => {
          abort.abort();
          return verifyCompletion(
            criteria([measure('one', 'count', 1)]),
            original,
            s,
          );
        },
      },
    ),
  ).rejects.toThrow('Stopped');
  expect(original.project.volumes).toEqual([]);
});
