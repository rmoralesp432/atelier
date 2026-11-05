import { it, expect } from 'vitest';
import { makeVolume } from '../model';
import { pullFace } from './pull';
import { solidStats } from './kernel';
it('pulls a rotated box face while keeping the opposite face fixed', () => {
  const v = {
    ...makeVolume(1, { width: 10, depth: 8, height: 6 }),
    rotation: 90,
  };
  const next = pullFace(v, 'x', 1, 4);
  expect(next.dimensions.width).toBe(14);
  expect(next.position.z).toBeCloseTo(-2);
  expect(next.position.z + next.dimensions.width / 2).toBeCloseTo(
    v.position.z + v.dimensions.width / 2,
  );
  expect(() => pullFace(v, 'y', -1, 2)).toThrow(/elevation/);
});
it('extrudes a flat profile into valid solid geometry', async () => {
  const v = {
    ...makeVolume(1, { width: 10, depth: 8, height: 0.1 }),
    geometry: { kind: 'rectangle' as const },
  };
  const next = pullFace(v, 'y', 1, 5);
  expect(next.geometry).toEqual({ kind: 'extrusion', profile: 'rectangle' });
  expect((await solidStats(next)).volume).toBeCloseTo(400, 4);
  expect(v.geometry.kind).toBe('rectangle');
});
