import { it, expect } from 'vitest';
import { makeVolume } from '../model';
import { sculptVolume, smoothBoolean } from './sculpt';
import { solidStats, meshData } from './kernel';
import type { SculptSettings } from './sculptSchema';
import {
  applyPlan,
  directPlan,
  newSession,
  parseSession,
  serializeSession,
} from '../intelligence/engine';
const brush: SculptSettings = {
  mode: 'pull',
  center: { x: 0.5, y: 1, z: 0.5 },
  radius: 5,
  delta: { x: 1, y: 0.5, z: 0 },
  strength: 0,
  preserveBase: true,
};
it('pulls a corner with smooth falloff, preserves the base and revises the brush from its retained source', async () => {
  const v = makeVolume(1, { width: 6, depth: 6, height: 6 });
  const a = await sculptVolume(v, brush, false);
  expect(a.id).toBe(v.id);
  expect(a.dimensions.width).toBeGreaterThan(6.5);
  expect(a.position.y).toBeCloseTo(0, 6);
  expect((await solidStats(a)).status).toBe('NoError');
  const data = await meshData(a);
  const floor = [];
  for (let i = 0; i < data.positions.length; i += 3)
    if (Math.abs(data.positions[i + 1]) < 1e-6)
      floor.push(data.positions[i] + a.position.x);
  expect(Math.min(...floor)).toBeCloseTo(-3);
  expect(Math.max(...floor)).toBeCloseTo(3);
  const settings = { ...brush, delta: { x: 0.5, y: 0.5, z: 0 } };
  const revised = await sculptVolume(a, settings, true),
    fresh = await sculptVolume(v, settings, false);
  expect(revised.dimensions).toEqual(fresh.dimensions);
  expect(revised.position).toEqual(fresh.position);
});
it('inflates and twists real surfaces; serialized recipes and undo retain the original geometry', async () => {
  const v = makeVolume(1, { width: 6, depth: 6, height: 6 });
  for (const [mode, strength] of [
    ['inflate', 0.3],
    ['twist', 20],
  ] as const) {
    const settings = {
      ...brush,
      mode,
      strength,
      center: { x: 0, y: 0.8, z: 0 },
      radius: 8,
    };
    const start = newSession({ volumes: [v], selectedId: v.id });
    const r = await applyPlan(
      start,
      directPlan({
        type: 'sculpt',
        target: v.id,
        settings,
        replaceLast: false,
      }),
    );
    expect(r.session.project.volumes[0].geometry?.kind).toBe('sculpt');
    expect((await solidStats(r.session.project.volumes[0])).status).toBe(
      'NoError',
    );
    expect(parseSession(serializeSession(r.session)).project).toEqual(
      r.session.project,
    );
    expect(
      (await applyPlan(r.session, directPlan({ type: 'undo', count: 1 })))
        .session.project,
    ).toEqual(start.project);
  }
});
it('smooth Boolean blending preserves genuine solids, cavities and source operands at the original floor datum', async () => {
  const a = makeVolume(1, { width: 4, depth: 4, height: 4 });
  const b = {
    ...makeVolume(2, { width: 4, depth: 4, height: 4 }),
    position: { x: 2, y: 0, z: 0 },
  };
  const united = await smoothBoolean([a, b], 'union', 0.6, 0.35);
  const u = await solidStats(united);
  expect(u.status).toBe('NoError');
  expect(u.volume).toBeGreaterThan(95);
  expect(u.volume).toBeLessThan(104);
  expect(united.position.y).toBeCloseTo(0, 5);
  expect(united.geometry?.kind === 'blend' && united.geometry.operands).toEqual(
    [a, b],
  );
  const cut = await smoothBoolean([a, b], 'subtract', 0.4, 0.35);
  expect((await solidStats(cut)).volume).toBeGreaterThan(25);
  expect((await solidStats(cut)).volume).toBeLessThan(33);
  const intersect = await smoothBoolean([a, b], 'intersect', 0.4, 0.35);
  expect((await solidStats(intersect)).volume).toBeGreaterThan(25);
  expect((await solidStats(intersect)).volume).toBeLessThan(33);
  const start = newSession({ volumes: [a, b], selectedId: a.id });
  const r = await applyPlan(
    start,
    directPlan({
      type: 'smooth_boolean',
      targets: [a.id, b.id],
      operation: 'union',
      radius: 0.6,
      resolution: 0.35,
    }),
    undefined,
    true,
  );
  expect(r.session.project.volumes).toHaveLength(1);
  expect(r.session.project.volumes[0].id).toBe(a.id);
  expect(parseSession(serializeSession(r.session)).project).toEqual(
    r.session.project,
  );
  expect(
    (await applyPlan(r.session, directPlan({ type: 'undo', count: 1 }))).session
      .project,
  ).toEqual(start.project);
}, 20000);
it('rejects disconnected blends and overly dense sampling without changing source geometry', async () => {
  const a = makeVolume(1, { width: 4, depth: 4, height: 4 });
  const b = {
    ...makeVolume(2, { width: 4, depth: 4, height: 4 }),
    position: { x: 15, y: 0, z: 0 },
  };
  await expect(smoothBoolean([a, b], 'union', 0.2, 0.5)).rejects.toThrow(
    /disconnected/,
  );
  await expect(smoothBoolean([a, b], 'union', 4, 0.1)).rejects.toThrow(
    /budget/,
  );
  expect(a.geometry).toBeUndefined();
});

it('revises a transformed smooth blend from its retained operands without losing placement or identity', async () => {
  const a = makeVolume(1, { width: 4, depth: 4, height: 4 });
  const b = {
    ...makeVolume(2, { width: 4, depth: 4, height: 4 }),
    position: { x: 2, y: 0, z: 0 },
  };
  const joined = await smoothBoolean([a, b], 'union', 0.5, 0.4);
  const v = {
    ...joined,
    position: { x: 20, y: 3, z: -10 },
    rotation: 45,
    dimensions: {
      width: joined.dimensions.width * 2,
      depth: joined.dimensions.depth * 2,
      height: joined.dimensions.height * 2,
    },
  };
  const start = newSession({ volumes: [v], selectedId: v.id });
  const r = await applyPlan(
    start,
    directPlan({
      type: 'edit_blend',
      target: v.id,
      radius: 0.9,
      resolution: 0.4,
    }),
  );
  const next = r.session.project.volumes[0];
  expect(next.id).toBe(v.id);
  expect(next.rotation).toBe(45);
  expect(next.position.y).toBeCloseTo(3);
  expect(next.position.x).toBeCloseTo(20, 3);
  expect(next.position.z).toBeCloseTo(-10, 3);
  expect(next.geometry?.kind === 'blend' && next.geometry.radius).toBe(0.9);
  expect((await solidStats(next)).status).toBe('NoError');
});
