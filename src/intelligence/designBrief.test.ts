import { describe, it, expect, vi } from 'vitest';
import { stagedPlan } from './checkedPlanner';
import {
  newSession,
  directPlan,
  applyPlan,
  parseSession,
  serializeSession,
} from './engine';
import { makeVolume } from '../model';
import { defaultCamera, sceneContext } from './context';
import { bindBrief, assessBrief, checkEditScope } from './designBrief';
import type {
  DesignBrief,
  DesignRequirement,
  DesignSelector,
} from './designBriefSchema';
import type { Plan } from './plan';
import { requestSchema } from '../../server/provider';

const selector = (
  refs: string[] = [],
  patch: Partial<DesignSelector> = {},
): DesignSelector => ({
  refs,
  role: null,
  level: null,
  nameContains: null,
  ...patch,
});
const measure = (
  id: string,
  metric: Extract<DesignRequirement, { kind: 'measure' }>['metric'],
  value: number,
  refs: string[] = [],
  patch: Partial<Extract<DesignRequirement, { kind: 'measure' }>> = {},
): DesignRequirement => ({
  id,
  label: id,
  kind: 'measure',
  selector: selector(refs),
  metric,
  aggregation: 'each',
  comparison: 'equal',
  value,
  tolerance: 0.001,
  relativeTolerance: 0,
  ...patch,
});
const brief = (
  requirements: DesignRequirement[],
  patch: Partial<DesignBrief> = {},
): DesignBrief => ({
  objective: 'Editable conceptual design',
  editable: [],
  preserve: [],
  requirements,
  evidence: [],
  ...patch,
});
const create = (name: string, width = 4): Plan =>
  directPlan({
    type: 'create_at',
    name,
    shape: 'box',
    width,
    depth: 3,
    height: 5,
    x: 0,
    y: 0,
    z: 0,
    rotation: 0,
  });
const finish = (): Plan => ({
  intent: 'finish',
  message: 'Completed',
  operations: [],
  brief: null,
  planning: null,
});

describe('outcome-based architectural planning (offline provider sequences)', () => {
  it('keeps saved geometry and history if optional reasoning metadata is stale', () => {
    const source = newSession({ volumes: [makeVolume()], selectedId: null });
    source.context.lastBrief = { objective: 'Older metadata' } as DesignBrief;
    source.past = [source.project];
    const restored = parseSession(serializeSession(source));
    expect(restored.project).toEqual(source.project);
    expect(restored.past).toEqual(source.past);
    expect(restored.context.lastBrief).toBeUndefined();
  });
  it('detects missing geometry even when every operation succeeds; repairs the provisional model and commits once', async () => {
    const source = newSession({ volumes: [], selectedId: null });
    const goal = brief([measure('two volumes', 'count', 2)]);
    const request = vi.fn(async (s, _feedback, execution) => {
      if (!execution) return { ...create('First'), brief: goal };
      expect(_feedback.error).toContain('count (each): 1');
      expect(execution.assessment[0].met).toBe(false);
      expect(s.project.volumes.map((v: any) => v.name)).toEqual(['First']);
      return { ...create('Second'), brief: null };
    });
    const result = await stagedPlan(source, defaultCamera, request);
    expect(request).toHaveBeenCalledTimes(2);
    expect(result.prepared!.session.project.volumes).toHaveLength(2);
    expect(result.prepared!.session.past).toEqual([source.project]);
    expect(result.prepared!.message).toContain('Design brief checked');
    expect(source.project.volumes).toHaveLength(0);
    const restored = parseSession(serializeSession(result.prepared!.session));
    expect(restored.context.lastBrief?.requirements).toEqual(goal.requirements);
    expect(
      requestSchema.safeParse({
        message: 'Refine that model',
        history: [],
        scene: sceneContext(restored.project, restored.context, defaultCamera),
      }).success,
    ).toBe(true);
  });
  it('will not finish or weaken an unmet brief to make an incomplete model look successful', async () => {
    const source = newSession({ volumes: [], selectedId: null }),
      goal = brief([measure('three volumes', 'count', 3)]);
    const request = vi
      .fn()
      .mockResolvedValueOnce({ ...create('Only one'), brief: goal })
      .mockResolvedValue(finish());
    await expect(stagedPlan(source, defaultCamera, request)).rejects.toThrow(
      /couldn't satisfy these design requirements/,
    );
    expect(request).toHaveBeenCalledTimes(3);
    expect(source.project.volumes).toHaveLength(0);
    const weakened = {
      ...goal,
      requirements: [measure('three volumes', 'count', 1)],
    };
    const changed = vi
      .fn()
      .mockResolvedValueOnce({ ...create('Only one'), brief: goal })
      .mockResolvedValue({ ...create('Extra'), brief: weakened });
    await expect(stagedPlan(source, defaultCamera, changed)).rejects.toThrow(
      /cannot be weakened/,
    );
    expect(source.project.volumes).toHaveLength(0);
  });
  it('protects unrelated geometry automatically and corrects a valid operation aimed at the wrong object', async () => {
    const a = makeVolume(),
      b = makeVolume(2);
    b.position.x = 30;
    const source = newSession({ volumes: [a, b], selectedId: a.id });
    const goal = brief(
      [measure('target height', 'height', 10, ['$selected'])],
      { editable: ['$selected'] },
    );
    const resize = (id: string) =>
      directPlan({
        type: 'resize',
        targets: [id],
        axis: 'height',
        mode: 'set',
        value: 10,
      });
    const request = vi
      .fn()
      .mockResolvedValueOnce({ ...resize(b.id), brief: goal })
      .mockImplementation(async (s, feedback) => {
        expect(feedback.error).toContain('Outside the agreed edit scope');
        expect(s.project).toEqual(source.project);
        return { ...resize(a.id), brief: goal };
      });
    const result = await stagedPlan(source, defaultCamera, request);
    expect(result.prepared!.session.project.volumes[0].dimensions.height).toBe(
      10,
    );
    expect(result.prepared!.session.project.volumes[1]).toEqual(b);
  });
  it('preserves window dimensions through a host edit while allowing expected child movement', async () => {
    const wall = makeVolume(),
      pane = {
        ...makeVolume(2),
        position: { x: 2, y: 1, z: 0 },
        component: {
          role: 'window' as const,
          hostId: wall.id,
          level: 'L1',
          motion: 'none' as const,
          travel: 1,
        },
      };
    const source = newSession({ volumes: [wall, pane], selectedId: wall.id });
    const goal = brief([measure('narrower wall', 'width', 8, [wall.id])], {
      editable: [wall.id],
      preserve: [{ targets: [pane.id], properties: ['dimensions'] }],
    });
    const bound = bindBrief(goal, source);
    expect(bound.editable).toContain(pane.id);
    const good = await applyPlan(
      source,
      directPlan({
        type: 'resize',
        targets: [wall.id],
        axis: 'width',
        mode: 'set',
        value: 8,
      }),
    );
    expect(() => checkEditScope(bound, source, good.session)).not.toThrow();
    const bad = await applyPlan(
      good.session,
      directPlan({
        type: 'resize',
        targets: [pane.id],
        axis: 'width',
        mode: 'set',
        value: 2,
      }),
    );
    expect(() => checkEditScope(bound, source, bad.session)).toThrow(
      /Preserved properties/,
    );
  });
  it('binds pronouns once, regardless of later selection changes', async () => {
    const a = makeVolume(),
      b = makeVolume(2),
      s = newSession({ volumes: [a, b], selectedId: a.id });
    const goal = bindBrief(
      brief([measure('original selection', 'height', 6, ['$selected'])], {
        editable: ['$selected'],
      }),
      s,
    );
    const later = await applyPlan(
      s,
      directPlan({ type: 'select', targets: [b.id] }),
    );
    later.session.project.volumes[1] = {
      ...b,
      dimensions: { ...b.dimensions, height: 99 },
    };
    expect((await assessBrief(goal, later.session))[0].met).toBe(true);
    expect(goal.requirements[0]).toMatchObject({ selector: { refs: [a.id] } });
  });
  it('asks for a brief when a strict provider response attempts complex construction without one', async () => {
    const source = newSession({ volumes: [], selectedId: null });
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        ...create('Mass'),
        brief: null,
        planning: { stage: 'Start', next: 'More', assumptions: [] },
      })
      .mockResolvedValueOnce({
        ...create('Mass'),
        brief: brief([measure('one mass', 'count', 1)]),
      });
    await stagedPlan(source, defaultCamera, request);
    expect(request.mock.calls[1][1].error).toContain('needs a brief');
  });
  it('discards the entire proposal when clarification follows a failed requirement', async () => {
    const source = newSession({ volumes: [], selectedId: null });
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        ...create('Mass'),
        brief: brief([measure('two masses', 'count', 2)]),
      })
      .mockResolvedValueOnce({
        intent: 'clarify',
        message: 'Should these be separate buildings or connected wings?',
        operations: [],
        brief: null,
      });
    const result = await stagedPlan(source, defaultCamera, request);
    expect(result.prepared).toBeUndefined();
    expect(result.plan.message).toContain('No changes applied yet');
    expect(source.project.volumes).toHaveLength(0);
  });
});

describe('independent geometric acceptance checks', () => {
  it('checks glazing properties and host links instead of accepting any opaque disk', async () => {
    const wall = makeVolume(),
      pane = {
        ...makeVolume(2),
        material: 'solid' as const,
        component: {
          role: 'window' as const,
          hostId: null,
          level: null,
          motion: 'none' as const,
          travel: 1,
        },
      };
    const source = newSession({ volumes: [wall, pane], selectedId: wall.id });
    const goal = bindBrief(
      brief([
        {
          kind: 'property',
          id: 'glass',
          label: 'Glazing material',
          selector: selector([pane.id]),
          property: 'material',
          value: 'glass',
        },
        {
          kind: 'property',
          id: 'host',
          label: 'Hosted by wall',
          selector: selector([pane.id]),
          property: 'hostId',
          value: '$selected',
        },
      ]),
      source,
    );
    expect((await assessBrief(goal, source)).map((r) => r.met)).toEqual([
      false,
      false,
    ]);
    const modified = {
      ...source,
      project: {
        ...source.project,
        selectedId: pane.id,
        volumes: [
          wall,
          {
            ...pane,
            material: 'glass' as const,
            component: { ...pane.component, hostId: wall.id },
          },
        ],
      },
    };
    expect((await assessBrief(goal, modified)).every((r) => r.met)).toBe(true);
  });
  it('handles curved-solid tessellation explicitly without loosening dimensional precision', async () => {
    const cylinder = {
      ...makeVolume(),
      dimensions: { width: 50, depth: 50, height: 20 },
      geometry: { kind: 'cylinder' as const },
    };
    const source = newSession({ volumes: [cylinder], selectedId: cylinder.id });
    const exact = measure('volume', 'volume', Math.PI * 25 ** 2 * 20, [
      cylinder.id,
    ]);
    expect((await assessBrief(brief([exact]), source))[0].met).toBe(false);
    expect(
      (
        await assessBrief(
          brief([{ ...exact, relativeTolerance: 0.002 } as DesignRequirement]),
          source,
        )
      )[0].met,
    ).toBe(true);
    expect(() =>
      bindBrief(
        brief([
          measure('width', 'width', 50, [cylinder.id], {
            relativeTolerance: 0.02,
          }),
        ]),
        source,
      ),
    ).toThrow(/absolute precision/);
  });
  it('does not treat empty selections or missing groups as a satisfied geometry requirement', async () => {
    const s = newSession({ volumes: [], selectedId: null });
    const checks = await assessBrief(
      brief([
        measure('future building', 'height', 8, ['$group:Future']),
        {
          id: 'shape',
          label: 'columns',
          kind: 'shape',
          selector: selector([], { role: 'column' }),
          shape: 'cylinder',
        },
        measure('no walls', 'count', 0, [], {
          selector: selector([], { role: 'wall' }),
        }),
      ]),
      s,
    );
    expect(checks.map((c) => c.met)).toEqual([false, false, true]);
  });
  it.each([3, 5, 7])(
    'verifies varied %i-level schedules and catches a misplaced upper slab',
    async (count) => {
      const heights = Array.from({ length: count }, (_, i) =>
        i < 2 ? 7.5 : 3.6,
      );
      let y = 0;
      const volumes = heights.map((height, i) => {
        const v = {
          ...makeVolume(i + 1),
          name: `Level ${i + 1}`,
          position: { x: 0, y, z: 0 },
          dimensions: { width: 20, depth: 14, height },
          component: {
            role: 'building' as const,
            hostId: null,
            level: `L${i + 1}`,
            motion: 'none' as const,
            travel: 1,
          },
        };
        y += height;
        return v;
      });
      const s = newSession({ volumes, selectedId: null });
      const goal = brief([
        measure('levels', 'count', count),
        measure('overall height', 'height', y, [], { aggregation: 'envelope' }),
        measure('upper level', 'base', 15, [], {
          selector: selector([], { level: 'L3' }),
        }),
      ]);
      expect((await assessBrief(goal, s)).every((c) => c.met)).toBe(true);
      s.project.volumes[2] = {
        ...volumes[2],
        position: { ...volumes[2].position, y: 15.5 },
      };
      expect(
        (await assessBrief(goal, s)).find((c) => c.id === 'upper level')?.met,
      ).toBe(false);
    },
  );
  it('uses evaluated solids rather than overlapping bounds for void containment/intersection checks', async () => {
    const shell = makeVolume(),
      inner = {
        ...makeVolume(2),
        dimensions: { width: 2, depth: 2, height: 2 },
        position: { x: 0, y: 1, z: 0 },
      };
    const s = newSession({ volumes: [shell, inner], selectedId: shell.id });
    const cut = (
      await applyPlan(
        s,
        directPlan({
          type: 'boolean',
          targets: [shell.id, inner.id],
          operation: 'subtract',
        }),
        defaultCamera,
        true,
      )
    ).session;
    cut.project.volumes.push(inner);
    const goal = brief([
      {
        id: 'void',
        label: 'Cutout is empty',
        kind: 'relation',
        first: selector([inner.id]),
        second: selector([shell.id]),
        relation: 'disjoint',
        tolerance: 0.00001,
      },
      measure('net volume', 'volume', 12 * 8 * 6 - 8, [shell.id]),
    ]);
    expect((await assessBrief(goal, cut)).every((c) => c.met)).toBe(true);
  });
});

it('preserves footprint axes and elevation while allowing the requested height, translation and rotation', async () => {
  const v = {
    ...makeVolume(1, { width: 10, depth: 6, height: 4 }),
    position: { x: 0, y: 2, z: 0 },
  };
  const source = newSession({ volumes: [v], selectedId: v.id });
  const goal = brief([measure('height', 'height', 6, [v.id])], {
    editable: [v.id],
    preserve: [
      { targets: [v.id], properties: ['width', 'depth', 'y', 'z', 'name'] },
    ],
  });
  const candidate = await applyPlan(
    source,
    {
      ...directPlan({ type: 'select', targets: [v.id] }),
      operations: [
        {
          type: 'resize',
          targets: [v.id],
          axis: 'height',
          mode: 'set',
          value: 6,
        },
        { type: 'move', targets: [v.id], direction: 'right', distance: 2 },
        { type: 'rotate', targets: [v.id], degrees: 45, relative: false },
      ],
    },
    defaultCamera,
    true,
  );
  expect(candidate.session.project.volumes[0].position.x).toBe(2);
  expect(candidate.session.project.volumes[0].rotation).toBe(45);
  expect(() => checkEditScope(goal, source, candidate.session)).not.toThrow();
  expect((await assessBrief(goal, candidate.session)).every((r) => r.met)).toBe(
    true,
  );
  const invalid = structuredClone(candidate.session);
  invalid.project.volumes[0].dimensions.width = 11;
  expect(() => checkEditScope(goal, source, invalid)).toThrow('width');
  invalid.project.volumes[0].dimensions.width = 10;
  invalid.project.volumes[0].position.y = 3;
  expect(() => checkEditScope(goal, source, invalid)).toThrow('y');
  expect(() =>
    checkEditScope(
      { ...goal, preserve: [{ targets: [v.id], properties: ['dimensions'] }] },
      source,
      candidate.session,
    ),
  ).toThrow('dimensions');
});

it('accepts a real extruded polygon as an extrusion and rejects its flat profile', async () => {
  const source = newSession({ volumes: [], selectedId: null });
  const command = directPlan({
    type: 'footprint',
    name: 'Rectangular solid',
    points: [
      { x: -3, z: -4 },
      { x: 3, z: -4 },
      { x: 3, z: 4 },
      { x: -3, z: 4 },
    ],
    height: 3,
    extruded: true,
    x: 0,
    y: 0,
    z: 0,
    rotation: 0,
  });
  const goal = brief([
    {
      id: 'extruded',
      label: 'Extruded solid',
      kind: 'shape',
      selector: selector(['$name:Rectangular solid']),
      shape: 'extrusion',
    },
    measure('volume', 'volume', 144),
  ]);
  const request = vi.fn(async () => ({ ...command, brief: goal }));
  const result = await stagedPlan(source, defaultCamera, request);
  expect(request).toHaveBeenCalledTimes(1);
  expect(result.prepared!.session.project.volumes[0].geometry?.kind).toBe(
    'polygon',
  );
  const flat = structuredClone(result.prepared!.session);
  const g = flat.project.volumes[0].geometry;
  if (g?.kind === 'polygon') g.extruded = false;
  expect((await assessBrief(goal, flat))[0].met).toBe(false);
});

it('checks curved-shell thickness independently from rise, and refuses a constant after nonuniform scaling', async () => {
  const source = newSession({ volumes: [], selectedId: null });
  const made = await applyPlan(
    source,
    directPlan({
      type: 'organic_form',
      target: null,
      name: 'Roof',
      position: { x: 0, y: 3, z: 0 },
      definition: {
        method: 'nurbs',
        degreeU: 1,
        degreeV: 1,
        thickness: 0.3,
        samples: 12,
        points: [
          [
            { x: -3, y: 0, z: -2, weight: 1 },
            { x: -3, y: 0, z: 2, weight: 1 },
          ],
          [
            { x: 3, y: 2, z: -2, weight: 1 },
            { x: 3, y: 2, z: 2, weight: 1 },
          ],
        ],
      },
    }),
  );
  const v = made.session.project.volumes[0];
  const check = brief([measure('shell thickness', 'thickness', 0.3, [v.id])]);
  expect((await assessBrief(check, made.session))[0].met).toBe(true);
  expect(
    (
      await assessBrief(
        brief([measure('not the envelope', 'height', 0.3, [v.id])]),
        made.session,
      )
    )[0].met,
  ).toBe(false);
  const uniform = structuredClone(made.session);
  uniform.project.volumes[0].dimensions = {
    width: v.dimensions.width * 2,
    depth: v.dimensions.depth * 2,
    height: v.dimensions.height * 2,
  };
  expect(
    (
      await assessBrief(
        brief([measure('scaled thickness', 'thickness', 0.6, [v.id])]),
        uniform,
      )
    )[0].met,
  ).toBe(true);
  uniform.project.volumes[0].dimensions.width *= 2;
  const result = (await assessBrief(check, uniform))[0];
  expect(result.met).toBe(false);
  expect(result.observed).toContain('Nonuniform');
});

it('rejects a contradictory shape checklist before binding, allowing a corrected checklist without relaxing committed requirements', async () => {
  const source = newSession({ volumes: [], selectedId: null });
  const sel = selector(['$name:Study']);
  const a = {
    kind: 'shape' as const,
    id: 'box',
    label: 'Box',
    selector: sel,
    shape: 'box' as const,
  };
  const b = {
    kind: 'shape' as const,
    id: 'cut',
    label: 'Cut solid',
    selector: sel,
    shape: 'boolean' as const,
  };
  expect(() => bindBrief(brief([a, b]), source)).toThrow('Contradictory');
  const request = vi.fn(async (_s, _feedback) =>
    request.mock.calls.length === 1
      ? { ...create('Study'), brief: brief([a, b]) }
      : { ...create('Study'), brief: brief([a]) },
  );
  const result = await stagedPlan(source, defaultCamera, request);
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[1][1]?.error).toContain('Contradictory');
  expect(result.prepared!.session.project.volumes).toHaveLength(1);
  expect(source.project.volumes).toHaveLength(0);
});
