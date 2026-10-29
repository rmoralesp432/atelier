import { describe, it, expect } from 'vitest';
import {
  applyPlan,
  newSession,
  directPlan,
  serializeSession,
  parseSession,
} from './engine';
import { defaultCamera } from './context';
import { solidStats } from '../geometry/kernel';
import type { Plan } from './plan';
describe('conversational execution (structured model-output fixtures, not live language tests)', () => {
  it('executes the requested success sequence with valid geometry and stable context', async () => {
    let s = newSession({ volumes: [], selectedId: null });
    async function run(plan: Plan) {
      s = (await applyPlan(s, plan, defaultCamera, true)).session;
    }
    await run(
      directPlan({
        type: 'create',
        shape: 'box',
        width: 12,
        depth: 8,
        height: 6,
        count: 2,
      }),
    );
    const [a, b] = s.project.volumes.map((v) => v.id);
    await run(
      directPlan({
        type: 'move',
        targets: [b],
        direction: 'right',
        distance: 2,
      }),
    );
    expect(s.project.volumes[1].position.x).toBe(16);
    await run(
      directPlan({
        type: 'resize',
        targets: ['$selected'],
        axis: 'height',
        mode: 'scale',
        value: 1.1,
      }),
    );
    expect(s.project.volumes[1].dimensions.height).toBe(6.6);
    await run(
      directPlan({
        type: 'place',
        target: b,
        reference: a,
        relation: 'overlap',
        direction: 'right',
        gap: null,
      }),
    );
    await run(
      directPlan({ type: 'boolean', operation: 'subtract', targets: [a, b] }),
    );
    expect((await solidStats(s.project.volumes[0])).volume).toBeCloseTo(288);
    await run({
      intent: 'apply',
      message: 'Undo and intersect the original operands.',
      operations: [
        { type: 'undo', count: 1 },
        { type: 'boolean', operation: 'intersect', targets: ['$operands'] },
      ],
    });
    expect(s.project.volumes).toHaveLength(1);
    expect(s.project.volumes[0].id).toBe(a);
    expect((await solidStats(s.project.volumes[0])).volume).toBeCloseTo(288);
    await run(
      directPlan({
        type: 'resize',
        targets: ['$selected'],
        axis: 'width',
        mode: 'scale',
        value: 1.1,
      }),
    );
    expect((await solidStats(s.project.volumes[0])).volume).toBeCloseTo(316.8);
    expect(parseSession(serializeSession(s))).toEqual(s);
  });
  it('rolls back the entire plan on invalid geometry and rejects ambiguous target groups', async () => {
    let s = (
      await applyPlan(
        newSession({ volumes: [], selectedId: null }),
        directPlan({
          type: 'create',
          shape: 'box',
          width: 2,
          depth: 2,
          height: 2,
          count: 2,
        }),
      )
    ).session;
    const before = serializeSession(s);
    await expect(
      applyPlan(s, {
        intent: 'apply',
        message: 'edit',
        operations: [
          {
            type: 'move',
            targets: ['$selected'],
            direction: 'right',
            distance: 1,
          },
          {
            type: 'resize',
            targets: ['$selected'],
            axis: 'height',
            mode: 'set',
            value: -2,
          },
        ],
      }),
    ).rejects.toThrow();
    expect(serializeSession(s)).toBe(before);
    await expect(
      applyPlan(
        s,
        directPlan({
          type: 'opening',
          target: '$selected',
          width: 1,
          height: 1,
          sill: 0,
          offset: 0,
        }),
        defaultCamera,
        true,
      ),
    ).rejects.toThrow('Which single volume should I change?');
  });
  it('creates a real wall opening, edits its cutter and restores history', async () => {
    let s = (
      await applyPlan(
        newSession({ volumes: [], selectedId: null }),
        directPlan({
          type: 'create',
          shape: 'box',
          width: 10,
          depth: 0.4,
          height: 3,
          count: 1,
        }),
      )
    ).session;
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'opening',
          target: '$selected',
          width: 2,
          height: 2,
          sill: 0,
          offset: 0,
        }),
        defaultCamera,
        true,
      )
    ).session;
    expect((await solidStats(s.project.volumes[0])).volume).toBeCloseTo(10.4);
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'edit_opening',
          target: '$selected',
          width: 3,
          height: null,
        }),
      )
    ).session;
    expect((await solidStats(s.project.volumes[0])).volume).toBeCloseTo(9.6);
    s = (await applyPlan(s, directPlan({ type: 'undo', count: 1 }))).session;
    expect((await solidStats(s.project.volumes[0])).volume).toBeCloseTo(10.4);
  });
  it('executes camera-relative follow-ups, arrays, spacing, alignment and extrusion', async () => {
    let s = (
      await applyPlan(
        newSession({ volumes: [], selectedId: null }),
        directPlan({
          type: 'create',
          shape: 'rectangle',
          width: 4,
          depth: 2,
          height: 1,
          count: 1,
        }),
      )
    ).session;
    s = (
      await applyPlan(
        s,
        directPlan({ type: 'extrude', target: '$selected', height: 3 }),
      )
    ).session;
    expect((await solidStats(s.project.volumes[0])).volume).toBeCloseTo(24);
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'move',
          targets: ['$selected'],
          direction: 'left',
          distance: 2,
        }),
        { ...defaultCamera, right: { x: 0, y: 0, z: 1 } },
      )
    ).session;
    expect(s.project.volumes[0].position.z).toBe(-2);
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'duplicate',
          targets: ['$selected'],
          count: 4,
          direction: 'right',
          distance: 6,
        }),
      )
    ).session;
    expect(s.project.volumes).toHaveLength(5);
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'spread',
          targets: ['$focus'],
          direction: 'right',
          gap: 3,
        }),
      )
    ).session;
    expect(
      s.project.volumes[1].position.x - s.project.volumes[0].position.x,
    ).toBe(7);
    s = (
      await applyPlan(
        s,
        directPlan({ type: 'align', targets: ['$focus'], axis: 'z' }),
      )
    ).session;
    expect(new Set(s.project.volumes.map((v) => v.position.z)).size).toBe(1);
  });
});

it('restores a Boolean through redo after persistence without losing operand identities', async () => {
  let s = (
    await applyPlan(
      newSession({ volumes: [], selectedId: null }),
      directPlan({
        type: 'create',
        shape: 'box',
        width: 4,
        depth: 4,
        height: 4,
        count: 2,
      }),
    )
  ).session;
  const [a, b] = s.project.volumes.map((v) => v.id);
  s = (
    await applyPlan(
      s,
      directPlan({
        type: 'place',
        target: b,
        reference: a,
        relation: 'overlap',
        direction: 'east',
        gap: null,
      }),
    )
  ).session;
  s = (
    await applyPlan(
      s,
      directPlan({ type: 'boolean', operation: 'union', targets: [a, b] }),
      defaultCamera,
      true,
    )
  ).session;
  const volume = (await solidStats(s.project.volumes[0])).volume;
  s = (await applyPlan(s, directPlan({ type: 'undo', count: 1 }))).session;
  s = parseSession(serializeSession(s));
  s = (await applyPlan(s, directPlan({ type: 'redo', count: 1 }))).session;
  expect(s.project.volumes[0].id).toBe(a);
  expect((await solidStats(s.project.volumes[0])).volume).toBeCloseTo(volume);
  expect(s.context.lastOperands).toEqual([a, b]);
});

it('edits the physical opening width after rotation and nonuniform result scaling', async () => {
  let s = (
    await applyPlan(
      newSession({ volumes: [], selectedId: null }),
      directPlan({
        type: 'create',
        shape: 'box',
        width: 10,
        depth: 0.4,
        height: 3,
        count: 1,
      }),
    )
  ).session;
  s = (
    await applyPlan(
      s,
      directPlan({
        type: 'rotate',
        targets: ['$selected'],
        degrees: 45,
        relative: false,
      }),
    )
  ).session;
  s = (
    await applyPlan(
      s,
      directPlan({
        type: 'opening',
        target: '$selected',
        width: 1.2,
        height: 2.1,
        sill: 0,
        offset: 0,
      }),
      defaultCamera,
      true,
    )
  ).session;
  s = (
    await applyPlan(
      s,
      directPlan({
        type: 'resize',
        targets: ['$selected'],
        axis: 'width',
        mode: 'scale',
        value: 1.5,
      }),
    )
  ).session;
  s = (
    await applyPlan(
      s,
      directPlan({
        type: 'edit_opening',
        target: '$selected',
        width: 3,
        height: null,
      }),
    )
  ).session;
  const v = s.project.volumes[0],
    g = v.geometry;
  if (g?.kind !== 'boolean') throw new Error('Expected an opening recipe.');
  const factor = Math.hypot(
    (Math.cos(Math.PI / 4) * v.dimensions.width) / g.base.width,
    (Math.sin(Math.PI / 4) * v.dimensions.depth) / g.base.depth,
  );
  expect(g.operands[1].dimensions.width * factor).toBeCloseTo(3);
  expect((await solidStats(v)).status).toBe('NoError');
});
