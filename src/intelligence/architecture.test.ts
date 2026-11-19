import { describe, it, expect } from 'vitest';
import {
  applyPlan,
  directPlan,
  newSession,
  resolveIds,
  serializeSession,
  parseSession,
} from './engine';
import { constructAssembly } from './assembly';
import { assemblySchema, type Assembly } from './architectureSchema';
import { solidStats } from '../geometry/kernel';
import { defaultCamera, sceneContext } from './context';
import { makeVolume } from '../model';

export const testAssembly = (): Assembly => ({
  type: 'assembly',
  name: 'Gallery',
  origin: { x: 20, y: 1, z: 5 },
  rotation: 90,
  elements: [
    {
      key: 'slab',
      name: 'Gallery slab',
      shape: 'box',
      dimensions: { width: 14, depth: 9, height: 0.25 },
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      role: 'floor',
      level: 'Ground',
      material: 'solid',
      color: '#cccccc',
      host: null,
      repeat: null,
    },
    {
      key: 'glass',
      name: 'East glazing',
      shape: 'box',
      dimensions: { width: 1.8, depth: 0.012, height: 3 },
      position: { x: -5, y: 0.25, z: 4.4 },
      rotation: 0,
      role: 'window',
      level: 'Ground',
      material: 'glass',
      color: '#aaccdd',
      host: '$part:slab',
      repeat: { x: 6, y: 1, z: 1, step: { x: 2, y: 0, z: 0 } },
    },
    {
      key: 'columns',
      name: 'Circular column',
      shape: 'cylinder',
      dimensions: { width: 0.3, depth: 0.3, height: 3 },
      position: { x: -6, y: 0.25, z: -4 },
      rotation: 0,
      role: 'column',
      level: 'Ground',
      material: 'solid',
      color: '#eeeeee',
      host: null,
      repeat: { x: 4, y: 1, z: 2, step: { x: 4, y: 0, z: 8 } },
    },
  ],
});
describe('general architectural assemblies', () => {
  it('constructs rotated thin glazing and circular column systems with measured solids and named groups', async () => {
    const s = newSession({ volumes: [], selectedId: null });
    const r = await applyPlan(
      s,
      directPlan(assemblySchema.parse(testAssembly())),
    );
    const p = r.session.project;
    expect(p.volumes).toHaveLength(15);
    expect(s.project.volumes).toHaveLength(0);
    expect(resolveIds(['$group:Gallery'], r.session)).toHaveLength(15);
    const glass = p.volumes.find((v) => v.name === 'East glazing 1')!;
    expect(glass.position).toEqual({ x: 24.4, y: 1.25, z: 10 });
    expect(glass.material).toBe('glass');
    expect(glass.component?.hostId).toBe(p.volumes[0].id);
    expect((await solidStats(glass)).volume).toBeCloseTo(1.8 * 0.012 * 3, 5);
    const column = p.volumes.find((v) => v.component?.role === 'column')!;
    expect((await solidStats(column)).volume).toBeCloseTo(
      Math.PI * 0.15 ** 2 * 3,
      2,
    );
    expect(parseSession(serializeSession(r.session)).project).toEqual(p);
  });
  it('queries roles inside one group and changes only those elements', async () => {
    const other = makeVolume();
    let s = newSession({ volumes: [other], selectedId: null });
    s = (await applyPlan(s, directPlan(testAssembly()))).session;
    const result = await applyPlan(s, {
      intent: 'apply',
      message: 'Taller columns',
      operations: [
        {
          type: 'select_query',
          scope: ['$group:Gallery'],
          role: 'column',
          level: 'Ground',
          material: null,
          nameContains: null,
          visible: null,
        },
        {
          type: 'resize',
          targets: ['$selected'],
          axis: 'height',
          mode: 'set',
          value: 4,
        },
        {
          type: 'verify',
          targets: ['$selected'],
          metric: 'height',
          comparison: 'equal',
          value: 4,
          tolerance: 0.001,
        },
        {
          type: 'verify',
          targets: ['$selected'],
          metric: 'count',
          comparison: 'equal',
          value: 8,
          tolerance: 0,
        },
      ],
    });
    expect(result.session.project.volumes[0]).toEqual(other);
    expect(
      result.session.project.volumes.filter((v) => v.material === 'glass'),
    ).toEqual(s.project.volumes.filter((v) => v.material === 'glass'));
    expect(result.message).toContain('Verified count: 8');
    await expect(
      applyPlan(
        s,
        directPlan({
          type: 'verify',
          targets: ['$group:Gallery'],
          metric: 'count',
          comparison: 'equal',
          value: 16,
          tolerance: 0,
        }),
      ),
    ).rejects.toThrow('measured 15');
  });
  it('remaps copied host identities for duplication, grid, polar and mirrored instances', async () => {
    const source = (
      await applyPlan(
        newSession({ volumes: [], selectedId: null }),
        directPlan(testAssembly()),
      )
    ).session;
    for (const op of [
      {
        type: 'duplicate' as const,
        targets: ['$group:Gallery'],
        count: 2,
        direction: 'right' as const,
        distance: 30,
      },
      {
        type: 'array_grid' as const,
        targets: ['$group:Gallery'],
        rows: 1,
        columns: 3,
        spacingX: 30,
        spacingZ: 30,
      },
      {
        type: 'array_polar' as const,
        targets: ['$group:Gallery'],
        count: 3,
        center: { x: 0, y: 0, z: 0 },
        angle: 360,
        rotate: true,
      },
      {
        type: 'mirror' as const,
        targets: ['$group:Gallery'],
        axis: 'x' as const,
        coordinate: 0,
        copy: true,
      },
    ]) {
      const s = (await applyPlan(source, directPlan(op))).session;
      const newIds = new Set(s.context.lastCreatedIds);
      const copies = s.project.volumes.filter((v) => newIds.has(v.id));
      for (const window of copies.filter((v) => v.material === 'glass')) {
        expect(newIds.has(window.component!.hostId!)).toBe(true);
        expect(
          s.project.volumes.find((v) => v.id === window.component!.hostId)
            ?.component?.role,
        ).toBe('floor');
      }
    }
  });
  it('rejects ambiguous keys, host cycles and excessive repetitions before committing', () => {
    const spec = testAssembly();
    spec.elements[0].host = '$part:glass';
    expect(() =>
      constructAssembly({ volumes: [], selectedId: null }, spec),
    ).toThrow('matching repeated set');
    spec.elements[1].repeat = null;
    expect(() =>
      constructAssembly({ volumes: [], selectedId: null }, spec),
    ).toThrow('cycles');
    spec.elements[0].host = null;
    spec.elements[1].repeat = {
      x: 50,
      y: 30,
      z: 50,
      step: { x: 2, y: 4, z: 3 },
    };
    expect(() =>
      constructAssembly({ volumes: [], selectedId: null }, spec),
    ).toThrow('object slots');
  });
  it('persists concise design decisions and makes them available beyond chat history', async () => {
    const s = (
      await applyPlan(
        newSession({ volumes: [], selectedId: null }),
        directPlan({
          type: 'design_note',
          topic: 'Levels',
          text: 'User requested two occupied floors, 3.2 m floor to floor.',
          source: 'user',
        }),
      )
    ).session;
    const restored = parseSession(serializeSession(s));
    expect(
      sceneContext(restored.project, restored.context, defaultCamera).design
        .notes[0].source,
    ).toBe('user');
  });
});
