import { expect, it } from 'vitest';
import {
  applyPlan,
  newSession,
  parseSession,
  serializeSession,
} from '../intelligence/engine';
import { defaultCamera } from '../intelligence/context';
import type { Operation } from '../intelligence/plan';
import { renderMeshData, solidStats } from './kernel';
import type { Session } from '../intelligence/engine';

const create = (
  name: string,
  width: number,
  depth: number,
  height: number,
  y = 0,
): Operation => ({
  type: 'create_at',
  name,
  shape: 'box',
  width,
  depth,
  height,
  x: 0,
  y,
  z: 0,
  rotation: 0,
});
const build = (target: string, floors = 2): Operation => ({
  type: 'building',
  target,
  floors,
  slabThickness: 0.25,
  facade: true,
  panelWidth: 1.5,
  mullionWidth: 0.06,
});
const run = async (s: Session, ...operations: Operation[]) =>
  (
    await applyPlan(
      s,
      { intent: 'apply', message: 'Architectural test', operations },
      defaultCamera,
      true,
    )
  ).session;

it('builds the elevated 100 × 20 × 8 m pavilion, offsets its base and retains identity/history through real intersection and curtain walls', async () => {
  let s = await run(
    newSession({ volumes: [], selectedId: null }),
    create('Upper', 100, 20, 8, 4),
    {
      type: 'offset_base',
      target: '$name:Upper',
      offset: 3,
      height: 4,
      name: 'Base',
    },
  );
  const upperId = s.project.volumes[0].id;
  expect(s.project.volumes[1].dimensions).toEqual({
    width: 106,
    depth: 26,
    height: 4,
  });
  expect(s.project.volumes[1].position.y).toBe(0);
  expect(s.project.selectedId).toBe(upperId);
  s = await run(s, {
    type: 'rotate',
    targets: ['$selected'],
    degrees: 45,
    relative: true,
  });
  expect(s.project.volumes[0].rotation).toBe(45);
  s = await run(
    s,
    { ...create('Cylinder', 8, 8, 12), shape: 'cylinder' } as Operation,
    {
      type: 'center_on',
      target: '$name:Cylinder',
      reference: upperId,
      vertical: 'center',
      gap: 0,
    },
    {
      type: 'boolean',
      operation: 'intersect',
      targets: [upperId, '$name:Cylinder'],
    },
  );
  const intersection = s.project.volumes.find((v) => v.id === upperId)!;
  expect(intersection.position.y).toBeCloseTo(4);
  expect(intersection.dimensions.height).toBeCloseTo(8);
  expect((await solidStats(intersection)).volume).toBeCloseTo(401.48, 0);
  s = await run(s, build(upperId));
  const result = s.project.volumes.find((v) => v.id === upperId)!;
  expect(result.geometry?.kind).toBe('building');
  expect(result.position.y).toBe(4);
  expect(result.dimensions.height).toBe(8);
  const data = await renderMeshData(result);
  expect(data.map((p) => p.material).sort()).toEqual([
    'frame',
    'glass',
    'solid',
  ]);
  expect(data.every((p) => p.volume > 0 && p.indices.length > 0)).toBe(true);
  const stats = await solidStats(result);
  expect(stats.status).toBe('NoError');
  expect(stats.bounds.min[1]).toBeCloseTo(4);
  expect(stats.bounds.max[1]).toBeCloseTo(12);
  expect(stats.volume).toBeLessThan(401);
  expect(parseSession(serializeSession(s))).toEqual(s);
  s = await run(s, { type: 'undo', count: 1 });
  expect(s.project.volumes.find((v) => v.id === upperId)?.geometry?.kind).toBe(
    'boolean',
  );
});

it('constructs a full rectangular facade and edits floor count without nesting recipes or changing elevation', async () => {
  let s = await run(
    newSession({ volumes: [], selectedId: null }),
    create('Pavilion', 100, 20, 8, 4),
  );
  const id = s.project.selectedId!;
  s = await run(s, build(id));
  const first = s.project.volumes[0];
  const slabs = (await renderMeshData(first)).find(
    (p) => p.material === 'solid',
  )!;
  expect(slabs.volume).toBeCloseTo(100 * 20 * 0.25 * 3);
  s = await run(s, build(id, 3));
  const g = s.project.volumes[0].geometry;
  expect(g?.kind === 'building' && g.source.geometry?.kind).toBe('box');
  expect(s.project.volumes[0].id).toBe(id);
  expect(s.project.volumes[0].position.y).toBe(4);
  s = await run(
    s,
    { type: 'resize', targets: [id], axis: 'height', mode: 'set', value: 16 },
    { type: 'resize', targets: [id], axis: 'width', mode: 'set', value: 120 },
  );
  const resized = s.project.volumes[0];
  expect(
    resized.geometry?.kind === 'building' && resized.geometry.slabThickness,
  ).toBe(0.25);
  expect(
    (await renderMeshData(resized)).find((p) => p.material === 'solid')!.volume,
  ).toBeCloseTo(120 * 20 * 0.25 * 4);
  expect(resized.position.y).toBe(4);
  await expect(
    run(s, {
      type: 'resize',
      targets: [id],
      axis: 'height',
      mode: 'set',
      value: 0.5,
    }),
  ).rejects.toThrow('not enough height');
});

it('places different-height objects exactly above each other and rejects ambiguous names', async () => {
  let s = await run(
    newSession({ volumes: [], selectedId: null }),
    create('Base', 3, 4, 3),
    { ...create('Sphere', 10, 10, 10), shape: 'sphere' } as Operation,
    {
      type: 'center_on',
      target: '$name:Sphere',
      reference: '$name:Base',
      vertical: 'above',
      gap: 0,
    },
  );
  expect(s.project.volumes[1].position.y).toBe(3);
  s = await run(s, {
    type: 'place',
    target: '$name:Sphere',
    reference: '$name:Base',
    relation: 'next_to',
    direction: 'up',
    gap: 0,
  });
  expect(s.project.volumes[1].position.y).toBe(3);
  await expect(run(s, create('Base', 5, 5, 5))).rejects.toThrow(
    'distinct name',
  );
});

it('rejects unsupported sloping facades and invalid clearances atomically', async () => {
  const s = await run(newSession({ volumes: [], selectedId: null }), {
    ...create('Sphere', 10, 10, 10),
    shape: 'sphere',
  } as Operation);
  const before = serializeSession(s);
  await expect(run(s, build('$selected'))).rejects.toThrow(
    'constant footprint',
  );
  expect(serializeSession(s)).toBe(before);
  const box = await run(
    newSession({ volumes: [], selectedId: null }),
    create('Upper', 4, 4, 3, 2),
  );
  await expect(
    run(box, {
      type: 'offset_base',
      target: '$selected',
      offset: 1,
      height: 4,
      name: 'Base',
    }),
  ).rejects.toThrow('elevation');
});
