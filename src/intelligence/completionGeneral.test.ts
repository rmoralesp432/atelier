import { expect, it } from 'vitest';
import saved from '../../tests/fixtures/completion-live.json';
import { criteria, measure, selector } from '../../tests/fixtures/completion';
import { makeVolume, type Volume, type Project } from '../model';
import { meshData, booleanVolume } from '../geometry/kernel';
import { newSession, applyPlan, directPlan, type Session } from './engine';
import { defaultCamera } from './context';
import { stagedPlan } from './checkedPlanner';
import { verifyCompletion, unavailableCompletionCriteria } from './completion';
import {
  completionCriteriaSchema,
  type CompletionCriteria,
} from './completionSchema';
import {
  compactCompletionCriteria,
  expandCompletionWire,
} from '../../server/completionWire';

const empty = () => newSession({ volumes: [], selectedId: null });
const piece = (
  id: string,
  x: number,
  y: number,
  z: number,
  kind: 'box' | 'sphere' | 'cylinder' = 'box',
): Volume => ({
  ...makeVolume(),
  id,
  name: id,
  geometry: { kind },
  dimensions: { width: 0.6, height: 0.8, depth: 0.6 },
  position: { x, y, z },
  rotation: 0,
});
async function bake(v: Volume) {
  const mesh = await meshData(v),
    scale = [v.dimensions.width, v.dimensions.height, v.dimensions.depth];
  return {
    ...v,
    geometry: {
      kind: 'mesh' as const,
      positions: Array.from(mesh.positions, (n, i) => n / scale[i % 3]),
      indices: Array.from(mesh.indices),
      solid: true,
      source: 'Equivalent physical geometry',
    },
  };
}
function recorded(name: 'ring' | 'stand') {
  return {
    original: newSession(saved[name].original as unknown as Project),
    candidate: newSession(saved[name].candidate as unknown as Project),
    c: completionCriteriaSchema.parse(saved[name].criteria),
  };
}
function supported(
  name: 'ring' | 'stand',
  c: CompletionCriteria,
): CompletionCriteria {
  return {
    ...c,
    checks: c.checks.map((check) => {
      if (check.requirement.kind !== 'unavailable') return check;
      const { id, label } = check.requirement;
      const requirement: CompletionCriteria['checks'][number]['requirement'] =
        name === 'ring'
          ? {
              kind: 'radial',
              id,
              label,
              selector: selector(),
              center: { x: 3, y: 0, z: -2 },
              plane: 'xz',
              radius: 1.65,
              count: 7,
              start: 0,
              step: 360 / 7,
              tolerance: 0.001,
            }
          : id === 'independent-editability'
            ? { kind: 'editable', id, label, selector: selector() }
            : {
                kind: 'group',
                id,
                label,
                selector: selector(),
                name: 'Display stand',
                exclusive: true,
              };
      return { ...check, requirement };
    }),
  };
}

it.each(['ring', 'stand'] as const)(
  'replays saved real-AI %s criteria: unknown is not incorrect; supported predicates verify the recorded solids',
  async (name) => {
    const { original, candidate, c } = recorded(name);
    const unknown = await verifyCompletion(c, original, candidate);
    expect(unknown.status).toBe('unverified');
    expect(unknown.passed).toBe(false);
    expect(unknown.canCommit).toBe(true);
    expect(unknown.checks.filter((c) => c.outcome === 'incorrect')).toEqual([]);
    const complete = supported(name, c);
    expect((await verifyCompletion(complete, original, candidate)).status).toBe(
      'verified',
    );
    const ids = new Set(original.project.volumes.map((v) => v.id));
    const meshes = structuredClone(candidate);
    meshes.project.volumes = await Promise.all(
      meshes.project.volumes.map((v) => (ids.has(v.id) ? v : bake(v))),
    );
    expect((await verifyCompletion(complete, original, meshes)).status).toBe(
      'verified',
    );
    // Same physical shelves expressed with swapped local axes and a 90° turn.
    for (const v of meshes.project.volumes.filter((v) => !ids.has(v.id))) {
      if (v.geometry?.kind !== 'mesh') throw new Error('Mesh control missing');
      const p = v.geometry.positions;
      v.geometry.positions = p.map((n, i) =>
        i % 3 === 0 ? -p[i + 2] : i % 3 === 2 ? p[i - 2] : n,
      );
      [v.dimensions.width, v.dimensions.depth] = [
        v.dimensions.depth,
        v.dimensions.width,
      ];
      v.rotation += 90;
    }
    expect((await verifyCompletion(complete, original, meshes)).status).toBe(
      'verified',
    );
    meshes.project.volumes[0].position.x += 0.4;
    expect((await verifyCompletion(complete, original, meshes)).status).toBe(
      'incorrect',
    );
  },
);

it('matches an unfamiliar 11-sphere radial arrangement and a nonplanar point set without names or primitive-type dependence', async () => {
  const original = empty(),
    center = { x: -5, y: 2, z: 8 };
  const points = Array.from({ length: 11 }, (_, i) => {
    const a = ((17 + (i * 360) / 11) * Math.PI) / 180;
    return {
      x: center.x + 2.35 * Math.cos(a),
      y: center.y,
      z: center.z + 2.35 * Math.sin(a),
    };
  });
  const candidate = newSession({
    volumes: await Promise.all(
      points.map((p, i) => bake(piece(String(i), p.x, p.y, p.z, 'sphere'))),
    ),
    selectedId: null,
  });
  const c = criteria([
    {
      kind: 'radial',
      id: 'orbit',
      label: 'Requested arrangement',
      selector: selector(),
      center,
      plane: 'xz',
      radius: 2.35,
      count: 11,
      start: 17,
      step: 360 / 11,
      tolerance: 0.002,
    },
  ]);
  expect((await verifyCompletion(c, original, candidate)).status).toBe(
    'verified',
  );
  const missing = newSession({
    ...candidate.project,
    volumes: candidate.project.volumes.slice(1),
  });
  const missingReport = await verifyCompletion(c, original, missing);
  expect(missingReport.status).toBe('incorrect');
  expect(
    missingReport.checks.find((c) => c.id === 'orbit')?.observed,
  ).toContain('10/11');
  candidate.project.volumes[4].position.z += 0.09;
  expect((await verifyCompletion(c, original, candidate)).status).toBe(
    'incorrect',
  );
  const irregular = [
    { x: 0, y: 0.2, z: 0 },
    { x: 1.5, y: 3, z: -1 },
    { x: 0.2, y: 0.8, z: 4 },
    { x: -2, y: 2, z: 1 },
  ];
  const free = newSession({
    volumes: irregular.map((p, i) => piece(`part${i}`, p.x, p.y, p.z)),
    selectedId: null,
  });
  const set = criteria([
    {
      kind: 'positions',
      id: 'free',
      label: '3D positions',
      selector: selector(),
      points: irregular,
      tolerance: 0.001,
    },
  ]);
  free.project.volumes.reverse();
  expect((await verifyCompletion(set, original, free)).status).toBe('verified');
  free.project.volumes[0].position = { ...free.project.volumes[1].position };
  expect((await verifyCompletion(set, original, free)).status).toBe(
    'incorrect',
  );
});

it('measures real solid contact and a positioned void, rather than confusing overlapping bounding boxes with contact', async () => {
  const original = empty(),
    bottom = piece('base', 1, 0, -4),
    top = piece('top', 1, 0.8, -4);
  const model = newSession({ volumes: [bottom, top], selectedId: null });
  const contact = criteria([
    {
      kind: 'relationship',
      id: 'joins',
      label: 'Connected parts',
      first: selector(['base']),
      second: selector(['top']),
      relation: 'touching',
      quantifier: 'each',
      distance: 0,
      tolerance: 0.001,
    },
  ]);
  expect((await verifyCompletion(contact, original, model)).status).toBe(
    'verified',
  );
  model.project.volumes[1].position.y += 0.08;
  expect((await verifyCompletion(contact, original, model)).status).toBe(
    'incorrect',
  );
  const mass = {
    ...piece('block', -3, 0, 2),
    dimensions: { width: 3.4, height: 1.2, depth: 2.2 },
  };
  const cutter = {
    ...piece('void', -2.6, 0, 1.7),
    dimensions: { width: 0.7, height: 3, depth: 0.5 },
  };
  const cut = await booleanVolume(mass, cutter, 'subtract');
  const cavity = criteria([
    {
      kind: 'region',
      id: 'cavity',
      label: 'Requested empty space',
      selector: selector(),
      center: { x: -2.6, y: 0.6, z: 1.7 },
      size: { x: 0.7, y: 1.2, z: 0.5 },
      rotation: 0,
      occupancy: 'empty',
      tolerance: 0.001,
    },
  ]);
  const result = newSession({ volumes: [cut], selectedId: null });
  expect((await verifyCompletion(cavity, original, result)).status).toBe(
    'verified',
  );
  result.project.volumes = [mass];
  expect((await verifyCompletion(cavity, original, result)).status).toBe(
    'incorrect',
  );
  // A small solid sits within the cut's envelope but does not touch its walls.
  const inside = {
    ...piece('inside', -2.6, 0.3, 1.7),
    dimensions: { width: 0.2, height: 0.4, depth: 0.2 },
  };
  const gap = criteria([
    {
      kind: 'relationship',
      id: 'gap',
      label: 'No touching',
      first: selector([cut.id]),
      second: selector(['inside']),
      relation: 'touching',
      quantifier: 'all',
      distance: 0,
      tolerance: 0.001,
    },
  ]);
  expect(
    (
      await verifyCompletion(
        gap,
        original,
        newSession({ volumes: [cut, inside], selectedId: null }),
      )
    ).status,
  ).toBe('incorrect');
});

it('checks editability and exact group membership for different components, including locks and extra group members', async () => {
  const a = { ...piece('a', 0, 0, 0, 'sphere'), groupId: 'g' },
    b = { ...piece('b', 2, 0, 0, 'cylinder'), groupId: 'g' };
  const session = newSession({
    volumes: [a, b],
    selectedId: null,
    groups: [{ id: 'g', name: 'Mechanism', locked: false, visible: true }],
  });
  const c = criteria([
    {
      kind: 'editable',
      id: 'edit',
      label: 'Independent parts',
      selector: selector(),
    },
    {
      kind: 'group',
      id: 'group',
      label: 'Assembly',
      selector: selector(),
      name: 'Mechanism',
      exclusive: true,
    },
  ]);
  expect((await verifyCompletion(c, empty(), session)).status).toBe('verified');
  const neighbor = { ...piece('neighbor', -8, 0, 0), groupId: 'other' };
  const otherGroup = {
    id: 'other',
    name: 'Mechanism',
    locked: false,
    visible: true,
  };
  const original = newSession({
    volumes: [neighbor],
    groups: [otherGroup],
    selectedId: null,
  });
  const withNeighbor = newSession({
    ...session.project,
    volumes: [neighbor, a, b],
    groups: [otherGroup, ...session.project.groups!],
  });
  expect((await verifyCompletion(c, original, withNeighbor)).status).toBe(
    'verified',
  );
  session.project.groups![0].locked = true;
  expect(
    (await verifyCompletion(c, empty(), session)).checks.find(
      (x) => x.id === 'edit',
    )?.outcome,
  ).toBe('incorrect');
  session.project.groups![0].locked = false;
  session.project.volumes[1].groupId = undefined;
  expect(
    (await verifyCompletion(c, empty(), session)).checks.find(
      (x) => x.id === 'group',
    )?.outcome,
  ).toBe('incorrect');
});

it('repairs only measured errors, then commits unknown qualities once with honest messaging and Undo/Redo', async () => {
  const original = newSession({
    volumes: [piece('neighbor', -9, 0, -9)],
    selectedId: null,
  });
  const unknown = {
    kind: 'unavailable' as const,
    id: 'aesthetic',
    label: 'Surface character',
    reason: 'No quantitative test for this aesthetic judgment.',
  };
  const c = criteria([measure('count', 'count', 2), unknown]);
  let calls = 0;
  const made = (name: string) => ({
    ...directPlan({
      type: 'create_at',
      name,
      shape: 'sphere',
      width: 0.7,
      depth: 0.7,
      height: 0.7,
      x: calls * 2,
      y: 0,
      z: 1,
      rotation: 0,
    }),
    planning: { stage: 'Model', assumptions: [], next: 'Inspect' },
    brief: null,
  });
  const finish = {
    intent: 'finish' as const,
    operations: [],
    message: 'Everything is perfect.',
  };
  const result = await stagedPlan(
    original,
    defaultCamera,
    async (_s, feedback) => {
      calls++;
      if (calls === 1) return made('A');
      if (calls === 3) {
        expect(feedback?.error).not.toContain('aesthetic');
        expect(feedback?.error).toContain('count');
        return made('B');
      }
      return finish;
    },
    undefined,
    undefined,
    { agent: true, verifyCompletion: (s) => verifyCompletion(c, original, s) },
  );
  expect(calls).toBe(4);
  expect(result.verification?.status).toBe('unverified');
  expect(result.plan.message).toContain('incomplete verification');
  expect(result.plan.message).not.toContain('perfect');
  expect(result.reviewRequired).toBe(false);
  const after = result.prepared!.session;
  expect(after.project.volumes[0]).toEqual(original.project.volumes[0]);
  expect(after.past).toEqual([original.project]);
  const undo = (await applyPlan(after, directPlan({ type: 'undo', count: 1 })))
    .session;
  expect(undo.project).toEqual(original.project);
  expect(
    (await applyPlan(undo, directPlan({ type: 'redo', count: 1 }))).session
      .project,
  ).toEqual(after.project);
});

it('an unavailable reader permits only safe additions and never authorizes an unknown edit scope', async () => {
  const original = newSession({
    volumes: [piece('keep', 0, 0, 0)],
    selectedId: null,
  });
  const c = unavailableCompletionCriteria(
    'Reader output was incomplete.',
    'Make the requested change.',
  );
  const addition = newSession({
    ...original.project,
    volumes: [...original.project.volumes, piece('new', 2, 0, 0)],
  });
  const safe = await verifyCompletion(c, original, addition);
  expect(safe.status).toBe('unverified');
  expect(safe.canCommit).toBe(true);
  addition.project.volumes = structuredClone(addition.project.volumes);
  addition.project.volumes[0].position.x = 9;
  const unsafe = await verifyCompletion(c, original, addition);
  expect(unsafe.status).toBe('unverified');
  expect(unsafe.canCommit).toBe(false);
});

it('compact independent interpretation preserves predicate semantics with less redundant output', () => {
  for (const name of ['ring', 'stand'] as const) {
    const c = recorded(name).c,
      wire = compactCompletionCriteria(c),
      roundtrip = expandCompletionWire(wire);
    const content = (v: CompletionCriteria) =>
      v.checks.map((c) => {
        const { id: _id, label: _label, ...r } = c.requirement;
        return { ...c, requirement: r };
      });
    expect(content(roundtrip)).toEqual(content(c));
    expect(JSON.stringify(wire).length).toBeLessThan(
      JSON.stringify(c).length * 0.8,
    );
  }
});

it('uncertain scope and qualitative evidence remain unknown; unrelated group metadata stays protected', async () => {
  const original = newSession({
    volumes: [{ ...piece('original', 0, 0, 0), groupId: 'existing' }],
    selectedId: null,
    groups: [
      {
        id: 'existing',
        name: 'Unrelated assembly',
        visible: true,
        locked: false,
      },
    ],
  });
  const addition = newSession({
    ...structuredClone(original.project),
    volumes: [
      ...structuredClone(original.project.volumes),
      piece('added', 5, 0, 0),
    ],
  });
  const c = criteria([measure('count', 'count', 1)]);
  const unresolved = { ...c, editable: ['$name:Missing original'] };
  expect(await verifyCompletion(unresolved, original, addition)).toMatchObject({
    status: 'unverified',
    canCommit: true,
    passed: false,
  });
  expect(
    await verifyCompletion(
      {
        ...c,
        qualitativeLimits: ['Visual resemblance has not been assessed.'],
      },
      original,
      addition,
    ),
  ).toMatchObject({
    status: 'unverified',
    canCommit: true,
    passed: false,
  });
  addition.project.groups![0].name = 'Accidental rename';
  expect(await verifyCompletion(c, original, addition)).toMatchObject({
    status: 'incorrect',
    canCommit: false,
  });
  expect(await verifyCompletion(unresolved, original, addition)).toMatchObject({
    status: 'unverified',
    canCommit: false,
  });
  expect(
    await verifyCompletion(
      { ...c, editable: ['existing'] },
      original,
      addition,
    ),
  ).toMatchObject({ status: 'verified', canCommit: true });
});

it('does not reject an equivalent box with a rotated internal mesh frame that the canonical fitter cannot classify', async () => {
  const v = await bake(piece('angled prism', 2, 0, 3));
  const angle = (37 * Math.PI) / 180,
    p = v.geometry.positions;
  v.geometry.positions = p.map((n, i) =>
    i % 3 === 0
      ? n * Math.cos(angle) + p[i + 2] * Math.sin(angle)
      : i % 3 === 2
        ? n * Math.cos(angle) - p[i - 2] * Math.sin(angle)
        : n,
  );
  const c = criteria([
    {
      kind: 'shape',
      id: 'box',
      label: 'Prismatic shape',
      selector: selector(),
      shape: 'box',
    },
  ]);
  expect(
    await verifyCompletion(
      c,
      empty(),
      newSession({ volumes: [v], selectedId: null }),
    ),
  ).toMatchObject({
    status: 'unverified',
    passed: false,
    canCommit: true,
  });
});
