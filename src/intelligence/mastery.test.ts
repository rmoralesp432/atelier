import { describe, it, expect } from 'vitest';
import {
  applyPlan,
  directPlan,
  newSession,
  parseSession,
  serializeSession,
} from './engine';
import { defaultCamera, sceneContext, directionVector } from './context';
import { makeVolume } from '../model';
import { meshData, solidStats, sharedVolume } from '../geometry/kernel';
import { projectedExtent, envelopeBounds } from '../geometry/spatial';
import { requestSchema } from '../../server/provider';
import type { Operation } from './plan';

const empty = () => newSession({ volumes: [], selectedId: null });
const lShape: Extract<Operation, { type: 'footprint' }> = {
  type: 'footprint',
  name: 'Library',
  points: [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 10, z: 3 },
    { x: 4, z: 3 },
    { x: 4, z: 8 },
    { x: 0, z: 8 },
  ],
  height: 5,
  extruded: true,
  x: 20,
  y: 2,
  z: -10,
  rotation: 0,
};

describe('grounded architectural operations (no paid model calls)', () => {
  it('builds an asymmetric concave footprint with the correct orientation, closed mesh and preserved data', async () => {
    let s = (await applyPlan(empty(), directPlan(lShape))).session;
    const v = s.project.volumes[0];
    const stats = await solidStats(v);
    expect(stats.volume).toBeCloseTo(250);
    expect(stats.bounds.min).toEqual([15, 2, -14]);
    expect(stats.bounds.max).toEqual([25, 7, -6]);
    const probe = makeVolume(2, { width: 1, depth: 1, height: 1 });
    probe.position = { x: 23, y: 3, z: -7 }; // missing upper-right corner
    expect(await sharedVolume(v, probe)).toBeCloseTo(0);
    probe.position.x = 17;
    expect(await sharedVolume(v, probe)).toBeCloseTo(1);
    const mesh = await meshData(v),
      edges = new Map<string, number>();
    for (let i = 0; i < mesh.indices.length; i += 3)
      for (let j = 0; j < 3; j++) {
        const key = [mesh.indices[i + j], mesh.indices[i + ((j + 1) % 3)]]
          .sort((a, b) => a - b)
          .join(':');
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    expect([...edges.values()].every((n) => n === 2)).toBe(true);
    s = parseSession(serializeSession(s));
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'resize',
          targets: ['$focus'],
          axis: 'width',
          mode: 'scale',
          value: 2,
        }),
      )
    ).session;
    expect((await solidStats(s.project.volumes[0])).volume).toBeCloseTo(500);
    expect(s.project.volumes[0].id).toBe(v.id);
    s = (await applyPlan(s, directPlan({ type: 'undo', count: 1 }))).session;
    expect((await solidStats(s.project.volumes[0])).volume).toBeCloseTo(250);
  });
  it('keeps flat footprints flat until extrusion and rejects crossing, repeated and degenerate boundaries atomically', async () => {
    let s = (
      await applyPlan(empty(), directPlan({ ...lShape, extruded: false }))
    ).session;
    const measured = await applyPlan(
      s,
      directPlan({
        type: 'measure',
        targets: ['$focus'],
        metric: 'properties',
      }),
    );
    expect(measured.message).toContain('profile area 50 m²');
    expect(measured.session).toEqual(s);
    s = (
      await applyPlan(
        s,
        directPlan({ type: 'extrude', target: '$focus', height: 3 }),
      )
    ).session;
    expect((await solidStats(s.project.volumes[0])).volume).toBeCloseTo(150);
    for (const points of [
      [
        { x: 0, z: 0 },
        { x: 4, z: 4 },
        { x: 0, z: 4 },
        { x: 4, z: 0 },
      ],
      [
        { x: 0, z: 0 },
        { x: 4, z: 0 },
        { x: 4, z: 4 },
        { x: 0, z: 0 },
      ],
      [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 2, z: 0 },
      ],
    ]) {
      const before = serializeSession(s);
      await expect(
        applyPlan(s, directPlan({ ...lShape, name: 'Invalid', points })),
      ).rejects.toThrow();
      expect(serializeSession(s)).toBe(before);
    }
  });
  it('performs real cuts and floor conversions on custom footprints', async () => {
    let s = (await applyPlan(empty(), directPlan(lShape))).session;
    const id = s.project.volumes[0].id;
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'create_at',
          name: 'Courtyard',
          shape: 'box',
          width: 1,
          depth: 1,
          height: 5,
          x: 17,
          y: 2,
          z: -10,
          rotation: 0,
        }),
      )
    ).session;
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'boolean',
          operation: 'subtract',
          targets: [id, '$focus'],
        }),
        defaultCamera,
        true,
      )
    ).session;
    expect((await solidStats(s.project.volumes[0])).volume).toBeCloseTo(245);
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'building',
          target: id,
          floors: 2,
          slabThickness: 0.25,
          facade: false,
          panelWidth: 1.5,
          mullionWidth: 0.06,
        }),
        defaultCamera,
        true,
      )
    ).session;
    expect((await solidStats(s.project.volumes[0])).volume).toBeCloseTo(
      49 * 0.75,
    );
  });
  it('measures real material and shared volume without changing selection, geometry, undo or redo', async () => {
    let s = (
      await applyPlan(
        empty(),
        directPlan({
          type: 'create',
          shape: 'box',
          width: 4,
          depth: 2,
          height: 3,
          count: 2,
        }),
      )
    ).session;
    const [a, b] = s.project.volumes.map((v) => v.id);
    s = (
      await applyPlan(
        s,
        directPlan({ type: 'position', targets: [b], x: 2, y: null, z: null }),
      )
    ).session;
    const before = serializeSession(s);
    const result = await applyPlan(
      s,
      directPlan({ type: 'measure', targets: [a, b], metric: 'relationship' }),
    );
    expect(result.message).toContain('center distance 2 m');
    expect(result.message).toContain('Shared solid volume 12 m³');
    expect(serializeSession(result.session)).toBe(before);
    const properties = await applyPlan(
      s,
      directPlan({ type: 'measure', targets: [a], metric: 'properties' }),
    );
    expect(properties.message).toContain('Material volume 24 m³');
    expect(properties.message).toContain('surface area 52 m²');
    s = (await applyPlan(s, directPlan({ type: 'undo', count: 1 }))).session;
    const measured = await applyPlan(
      s,
      directPlan({ type: 'measure', targets: [a, b], metric: 'relationship' }),
    );
    expect(measured.session.future).toHaveLength(1);
    expect(measured.message).toContain('Shared solid volume 0 m³');
  });
  it('rotates compositions around a common center or explicit pivot and preserves distances and undo', async () => {
    const a = makeVolume(),
      b = makeVolume();
    a.position = { x: -10, y: 2, z: 0 };
    b.position = { x: 10, y: 5, z: 0 };
    let s = newSession({ volumes: [a, b], selectedId: b.id });
    const original = serializeSession(s);
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'rotate_group',
          targets: [a.id, b.id],
          degrees: 90,
          pivot: null,
        }),
      )
    ).session;
    expect(s.project.volumes.map((v) => v.position)).toEqual([
      { x: 0, y: 2, z: 10 },
      { x: 0, y: 5, z: -10 },
    ]);
    expect(s.project.volumes.every((v) => v.rotation === 90)).toBe(true);
    s = (await applyPlan(s, directPlan({ type: 'undo', count: 1 }))).session;
    expect(s.project).toEqual(JSON.parse(original).project);
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'rotate_group',
          targets: [b.id],
          degrees: 90,
          pivot: a.id,
        }),
      )
    ).session;
    expect(s.project.volumes[1].position).toEqual({ x: -10, y: 5, z: -20 });
  });
  it('preserves a mixed-size composition during approximate moves and arrays', async () => {
    const a = makeVolume(1, { width: 2, depth: 2, height: 2 }),
      b = makeVolume(2, { width: 10, depth: 2, height: 2 });
    b.position.x = 10;
    let s = newSession({
      volumes: [a, b],
      selectedId: a.id,
      selectedIds: [a.id, b.id],
    });
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'move',
          targets: ['$selected'],
          direction: 'right',
          distance: null,
        }),
      )
    ).session;
    expect(s.project.volumes.map((v) => v.position.x)).toEqual([1, 11]);
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'duplicate',
          targets: ['$selected'],
          count: 1,
          direction: 'right',
          distance: null,
        }),
      )
    ).session;
    expect(s.project.volumes.map((v) => v.position.x)).toEqual([1, 11, 19, 29]);
  });
  it('aligns roofs at different heights and uses projected oriented extents at angled views', async () => {
    const a = makeVolume(1, { width: 10, depth: 2, height: 6 }),
      b = makeVolume(2, { width: 3, depth: 2, height: 2 });
    a.rotation = 45;
    const d = { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 };
    expect(projectedExtent(a, d)).toBeCloseTo(2);
    let s = newSession({ volumes: [a, b], selectedId: b.id });
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'align_edges',
          targets: [a.id, b.id],
          axis: 'y',
          edge: 'max',
        }),
      )
    ).session;
    expect(s.project.volumes[1].position.y).toBe(4);
    expect(envelopeBounds(s.project.volumes[1]).max.y).toBe(6);
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'place',
          target: b.id,
          reference: a.id,
          relation: 'next_to',
          direction: 'right',
          gap: 2,
        }),
        { ...defaultCamera, right: d },
      )
    ).session;
    const placed = s.project.volumes[1];
    const projectedCenter = placed.position.x * d.x + placed.position.z * d.z;
    expect(
      projectedCenter - projectedExtent(a, d) / 2 - projectedExtent(b, d) / 2,
    ).toBeCloseTo(2, 2);
  });
  it('renames with stable identity and selection does not consume undo steps', async () => {
    let s = (
      await applyPlan(empty(), directPlan({ ...lShape, name: 'Old name' }))
    ).session;
    const id = s.project.volumes[0].id;
    s = (
      await applyPlan(
        s,
        directPlan({ type: 'rename', target: id, name: 'West wing' }),
      )
    ).session;
    const n = s.past.length;
    s = (
      await applyPlan(
        s,
        directPlan({ type: 'select', targets: ['$name:West wing'] }),
      )
    ).session;
    expect(s.past).toHaveLength(n);
    s = (await applyPlan(s, directPlan({ type: 'undo', count: 1 }))).session;
    expect(s.project.volumes[0].name).toBe('Old name');
    expect(s.context.focusIds).toEqual([id]);
  });
  it('sends bounded spatial context that the server actually accepts', async () => {
    const s = (await applyPlan(empty(), directPlan(lShape))).session;
    const scene = sceneContext(s.project, s.context, defaultCamera);
    expect(scene.objects[0].spatial.footprint).toHaveLength(6);
    expect(scene.objects[0].spatial.envelopeBounds.min.y).toBe(2);
    expect(
      requestSchema.safeParse({
        message: 'How much material?',
        history: [],
        scene,
        historyAvailability: { undo: 1, redo: 0 },
      }).success,
    ).toBe(true);
  });
  it('rejects below-ground roof alignment without partially changing a project', async () => {
    const a = makeVolume(1, { width: 2, depth: 2, height: 1 }),
      b = makeVolume(2, { width: 2, depth: 2, height: 10 });
    const s = newSession({ volumes: [a, b], selectedId: a.id });
    const before = serializeSession(s);
    await expect(
      applyPlan(
        s,
        directPlan({
          type: 'align_edges',
          targets: [a.id, b.id],
          axis: 'y',
          edge: 'max',
        }),
      ),
    ).rejects.toThrow('negative');
    expect(serializeSession(s)).toBe(before);
  });
});

it('keeps camera-relative movement on the ground and increases rather than reduces spacing', async () => {
  expect(
    directionVector('forward', {
      ...defaultCamera,
      forward: { x: 0, y: -0.8, z: -0.6 },
    }),
  ).toEqual({ x: 0, y: 0, z: -1 });
  const a = makeVolume(1, { width: 2, depth: 2, height: 2 }),
    b = makeVolume(2, { width: 2, depth: 2, height: 2 });
  b.position.x = 12;
  let s = newSession({
    volumes: [a, b],
    selectedId: a.id,
    selectedIds: [a.id, b.id],
  });
  s = (
    await applyPlan(
      s,
      directPlan({
        type: 'spread',
        targets: ['$selected'],
        direction: 'right',
        gap: null,
      }),
    )
  ).session;
  expect(s.project.volumes[1].position.x).toBe(12.25);
  for (let i = 0; i < 2; i++)
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'duplicate',
          targets: [a.id],
          count: 1,
          direction: 'right',
          distance: 20,
        }),
      )
    ).session;
  expect(new Set(s.project.volumes.map((v) => v.name)).size).toBe(
    s.project.volumes.length,
  );
});

it('rejects imported footprints whose declared dimensions do not match their normalized bounds', async () => {
  const s = (await applyPlan(empty(), directPlan(lShape))).session;
  const v = s.project.volumes[0];
  if (v.geometry?.kind !== 'polygon') throw new Error('Missing footprint');
  v.geometry.points = v.geometry.points.map((p) => ({ x: p.x / 2, z: p.z }));
  expect(() => parseSession(serializeSession(s))).toThrow(
    'normalized footprint',
  );
});
it('does not widen an offset opening through the outer wall edge', async () => {
  let s = (
    await applyPlan(
      empty(),
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
        target: '$focus',
        width: 1,
        height: 2,
        sill: 0,
        offset: 3.5,
      }),
      defaultCamera,
      true,
    )
  ).session;
  const before = serializeSession(s);
  await expect(
    applyPlan(
      s,
      directPlan({
        type: 'edit_opening',
        target: '$focus',
        width: 4,
        height: null,
      }),
    ),
  ).rejects.toThrow('opening must fit');
  expect(serializeSession(s)).toBe(before);
});
