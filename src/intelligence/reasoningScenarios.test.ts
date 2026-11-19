import { describe, it, expect } from 'vitest';
import { applyPlan, directPlan, newSession, type Session } from './engine';
import { stagedPlan } from './checkedPlanner';
import { bindBrief, assessBrief, checkEditScope } from './designBrief';
import { defaultCamera, sceneContext } from './context';
import type {
  DesignBrief,
  DesignRequirement,
  DesignSelector,
} from './designBriefSchema';
import type { Assembly } from './architectureSchema';
import { makeVolume } from '../model';
import { sharedVolume, solidStats } from '../geometry/kernel';
import { requestSchema } from '../../server/provider';

// Generated numerical variants and adversarial mutations are an execution and
// verification corpus. Prompts document intent; no live understanding is claimed.
const selection = (
  refs: string[],
  role: DesignSelector['role'] = null,
): DesignSelector => ({ refs, role, level: null, nameContains: null });
const measurement = (
  id: string,
  selector: DesignSelector,
  metric: Extract<DesignRequirement, { kind: 'measure' }>['metric'],
  value: number,
): DesignRequirement => ({
  kind: 'measure',
  id,
  label: id,
  selector,
  metric,
  value,
  comparison: 'equal',
  aggregation: 'each',
  tolerance: 0.001,
  relativeTolerance: 0,
});
const design = (
  requirements: DesignRequirement[],
  editable: string[] = [],
): DesignBrief => ({
  objective: 'An editable architectural composition with preserved context',
  editable,
  preserve: [],
  requirements,
  evidence: [
    {
      source: 'user',
      statement:
        'Use the stated metric dimensions and preserve unrelated geometry.',
    },
  ],
});
const initial = () =>
  newSession({
    volumes: [
      {
        ...makeVolume(),
        name: 'Existing neighbor',
        position: { x: -100, y: 0, z: -100 },
      },
    ],
    selectedId: null,
  });
const asserted = async (
  brief: DesignBrief,
  source: Session,
  result: Session,
) => {
  const bound = bindBrief(brief, source);
  checkEditScope(bound, source, result);
  const report = await assessBrief(bound, result);
  expect(report.filter((r) => !r.met)).toEqual([]);
};

describe('varied construction and adversarial outcome corpus', () => {
  it.each([0, 1, 2, 3, 4, 5])(
    'grid → section replacement preserves placement and catches wrong spacing (variant %i)',
    async (seed) => {
      const nx = 2 + (seed % 3),
        nz = 2 + (seed % 2),
        spacing = 8.5 + seed,
        diameter = 0.6 + seed * 0.05,
        height = 3.5 + seed * 0.2,
        rotation = seed * 13;
      const origin = { x: 5 + seed, y: 0.3, z: -8 };
      const assembly: Assembly = {
        type: 'assembly',
        name: 'Supports',
        origin,
        rotation,
        elements: [
          {
            key: 'column',
            name: 'Circular support',
            shape: 'cylinder',
            dimensions: { width: diameter, depth: diameter, height },
            position: { x: 0, y: 0, z: 0 },
            rotation: 0,
            role: 'column',
            level: 'Ground',
            material: 'solid',
            color: '#cccccc',
            host: null,
            repeat: {
              x: nx,
              y: 1,
              z: nz,
              step: { x: spacing, y: 0, z: spacing },
            },
          },
        ],
      };
      const selected = selection(['$group:Supports'], 'column');
      const goal = design([
        measurement('support count', selected, 'count', nx * nz),
        measurement('diameter', selected, 'width', diameter),
        measurement('height', selected, 'height', height),
        {
          kind: 'layout',
          id: 'grid',
          label: 'Every grid intersection occupied once',
          selector: selected,
          origin,
          counts: { x: nx, y: 1, z: nz },
          step: { x: spacing, y: 0, z: spacing },
          rotation,
          tolerance: 0.001,
        },
        {
          kind: 'shape',
          id: 'round',
          label: 'Circular columns',
          selector: selected,
          shape: 'cylinder',
        },
      ]);
      const source = initial();
      const built = await stagedPlan(source, defaultCamera, async () => ({
        ...directPlan(assembly),
        brief: goal,
      }));
      const result = built.prepared!.session;
      await asserted(goal, source, result);
      expect(result.project.volumes[0]).toEqual(source.project.volumes[0]);
      const context = sceneContext(
        result.project,
        result.context,
        defaultCamera,
      );
      expect(
        context.understanding.inventory.find((g) => g.name === 'Supports')
          ?.roles[0].ids,
      ).toHaveLength(nx * nz);
      expect(
        requestSchema.safeParse({
          message:
            'Replace these circular supports with I-sections of the same envelope',
          history: [],
          scene: context,
        }).success,
      ).toBe(true);
      const ids = result.project.volumes.slice(1).map((v) => v.id);
      const replacement = design(
        [
          {
            kind: 'shape',
            id: 'profile',
            label: 'I-sections',
            selector: selected,
            shape: 'i_section',
          },
          measurement('count', selected, 'count', nx * nz),
        ],
        ids,
      );
      replacement.preserve = [
        {
          targets: ids,
          properties: [
            'position',
            'dimensions',
            'rotation',
            'component',
            'name',
          ],
        },
      ];
      const next = await stagedPlan(result, defaultCamera, async () => ({
        ...directPlan({
          type: 'profile_solid',
          targets: ['$group:Supports'],
          name: 'unused',
          position: { x: 0, y: 0, z: 0 },
          dimensions: null,
          axis: 'y',
          shape: 'i_section',
          web: 0.02,
          flange: 0.03,
          points: null,
        }),
        brief: replacement,
      }));
      await asserted(replacement, result, next.prepared!.session);
      const expected =
        (2 * diameter * 0.03 + 0.02 * (diameter - 0.06)) * height;
      for (const v of next.prepared!.session.project.volumes.slice(1))
        expect((await solidStats(v)).volume).toBeCloseTo(expected, 4);
      // Same count and sizes, one wrong position: a count-only check would miss it.
      const corrupted = {
        ...result,
        project: {
          ...result.project,
          volumes: result.project.volumes.map((v, i) =>
            i === 2
              ? { ...v, position: { ...v.position, x: v.position.x + 0.4 } }
              : v,
          ),
        },
      };
      expect(
        (await assessBrief(bindBrief(goal, source), corrupted)).find(
          (r) => r.id === 'grid',
        )?.met,
      ).toBe(false);
      const duplicate = {
        ...result,
        project: {
          ...result.project,
          volumes: result.project.volumes.map((v, i) =>
            i === 2
              ? { ...v, position: { ...result.project.volumes[1].position } }
              : v,
          ),
        },
      };
      expect(
        (await assessBrief(bindBrief(goal, source), duplicate)).find(
          (r) => r.id === 'grid',
        )?.met,
      ).toBe(false);
    },
  );
  it('replaces a wall system with columns while protecting slabs and neighboring geometry', async () => {
    let source = initial();
    const slab = {
      ...makeVolume(),
      name: 'Hall floor',
      dimensions: { width: 16, depth: 20, height: 0.3 },
      component: {
        role: 'floor' as const,
        hostId: null,
        level: 'Ground',
        motion: 'none' as const,
        travel: 1,
      },
    };
    const walls = [0, 12].map((z, i) => ({
      ...makeVolume(),
      name: `Partition ${i + 1}`,
      dimensions: { width: 12, depth: 0.2, height: 4 },
      position: { x: 0, y: 0.3, z },
      component: {
        role: 'wall' as const,
        hostId: null,
        level: 'Ground',
        motion: 'none' as const,
        travel: 1,
      },
    }));
    source.project.volumes.push(slab, ...walls);
    const cols: Assembly = {
      type: 'assembly',
      name: 'New support system',
      origin: { x: -6, y: 0.3, z: 0 },
      rotation: 0,
      elements: [
        {
          key: 'support',
          name: 'Support',
          shape: 'cylinder',
          dimensions: { width: 0.5, depth: 0.5, height: 4 },
          position: { x: 0, y: 0, z: 0 },
          rotation: 0,
          role: 'column',
          level: 'Ground',
          material: 'solid',
          color: '#cccccc',
          host: null,
          repeat: { x: 2, y: 1, z: 2, step: { x: 12, y: 0, z: 12 } },
        },
      ],
    };
    const goal = design(
      [
        measurement(
          'four supports',
          selection(['$group:New support system'], 'column'),
          'count',
          4,
        ),
        measurement('partitions removed', selection([], 'wall'), 'count', 0),
        measurement(
          'support height',
          selection(['$group:New support system']),
          'height',
          4,
        ),
      ],
      walls.map((v) => v.id),
    );
    const result = await stagedPlan(source, defaultCamera, async () => ({
      intent: 'apply',
      message: 'Replace scoped partitions with four conceptual supports.',
      brief: goal,
      operations: [cols, { type: 'delete', targets: walls.map((v) => v.id) }],
    }));
    await asserted(goal, source, result.prepared!.session);
    expect(result.reviewRequired).toBe(true);
    expect(
      result.prepared!.session.project.volumes.find((v) => v.id === slab.id),
    ).toEqual(slab);
    const undo = await applyPlan(
      result.prepared!.session,
      directPlan({ type: 'undo', count: 1 }),
    );
    expect(undo.session.project).toEqual(source.project);
  });
  it('checks an elevated connection against real landing solids without altering its buildings', async () => {
    const a = {
        ...makeVolume(),
        name: 'West volume',
        dimensions: { width: 16, depth: 10, height: 8 },
      },
      b = {
        ...makeVolume(2),
        name: 'East volume',
        dimensions: { width: 10, depth: 12, height: 9 },
        position: { x: 40, y: 0, z: 10 },
        rotation: 30,
      };
    const source = newSession({ volumes: [a, b], selectedId: a.id });
    const bridge = selection(['$name:Garden bridge']);
    const goal = design([
      measurement('deck elevation', bridge, 'base', 4),
      measurement('deck width', bridge, 'depth', 3),
      {
        kind: 'relation',
        id: 'west',
        label: 'Connect west landing',
        first: bridge,
        second: selection([a.id]),
        relation: 'intersects',
        tolerance: 0.00001,
      },
      {
        kind: 'relation',
        id: 'east',
        label: 'Connect east landing',
        first: bridge,
        second: selection([b.id]),
        relation: 'intersects',
        tolerance: 0.00001,
      },
    ]);
    const result = await stagedPlan(source, defaultCamera, async () => ({
      ...directPlan({
        type: 'bridge',
        targets: [a.id, b.id],
        name: 'Garden bridge',
        width: 3,
        thickness: 0.3,
        elevation: 4,
        embed: 0.2,
      }),
      brief: goal,
    }));
    await asserted(goal, source, result.prepared!.session);
    const displaced = {
      ...result.prepared!.session,
      project: {
        ...result.prepared!.session.project,
        volumes: result.prepared!.session.project.volumes.map((v) =>
          v.name === 'Garden bridge'
            ? { ...v, position: { ...v.position, y: 20 } }
            : v,
        ),
      },
    };
    expect(
      (await assessBrief(bindBrief(goal, source), displaced)).filter(
        (r) => r.met,
      ),
    ).toHaveLength(1); // Width alone still correct.
  });
  it.each([7, 11])(
    'models a hollow radial ceiling with an oculus at radius %i without a sphere proxy',
    async (radius) => {
      const thickness = 0.4,
        oculus = 2,
        outerAngle = Math.acos(oculus / radius),
        innerAngle = Math.acos(oculus / (radius - thickness));
      const profile = [
        ...Array.from({ length: 25 }, (_, i) => ({
          radius: radius * Math.cos((outerAngle * i) / 24),
          height: radius * Math.sin((outerAngle * i) / 24),
        })),
        ...Array.from({ length: 25 }, (_, i) => ({
          radius: (radius - thickness) * Math.cos((innerAngle * (24 - i)) / 24),
          height: (radius - thickness) * Math.sin((innerAngle * (24 - i)) / 24),
        })),
      ];
      const source = initial(),
        target = selection(['$name:Radial ceiling']);
      const goal = design([
        {
          kind: 'shape',
          id: 'radial',
          label: 'Radial shell',
          selector: target,
          shape: 'revolve',
        },
        measurement('ceiling diameter', target, 'width', 2 * radius),
        measurement('base', target, 'base', 8),
      ]);
      const result = await stagedPlan(source, defaultCamera, async () => ({
        ...directPlan({
          type: 'revolve',
          target: null,
          name: 'Radial ceiling',
          profile,
          degrees: 360,
          position: { x: 0, y: 8, z: 0 },
        }),
        brief: goal,
      }));
      const dome = result.prepared!.session.project.volumes.at(-1)!;
      const probe = {
        ...makeVolume(),
        dimensions: {
          width: 2 * (oculus - 0.05),
          depth: 2 * (oculus - 0.05),
          height: 40,
        },
        geometry: { kind: 'cylinder' as const },
      };
      expect(await sharedVolume(dome, probe)).toBeLessThan(1e-6);
      expect((await solidStats(dome)).volume).toBeLessThan(
        ((4 / 3) * Math.PI * radius ** 3) / 4,
      );
      await asserted(goal, source, result.prepared!.session);
    },
  );
  it('will not count an unextruded footprint as a five-meter-high volume', async () => {
    const v = {
      ...makeVolume(),
      geometry: { kind: 'rectangle' as const },
      dimensions: { width: 10, depth: 8, height: 5 },
    };
    const s = newSession({ volumes: [v], selectedId: v.id });
    const goal = design([
      measurement('height', selection([v.id]), 'height', 5),
      measurement('top', selection([v.id]), 'top', 5),
      measurement('volume', selection([v.id]), 'volume', 400),
    ]);
    expect((await assessBrief(goal, s)).every((r) => !r.met)).toBe(true);
  });
});
