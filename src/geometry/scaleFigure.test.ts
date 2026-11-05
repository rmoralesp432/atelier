import { expect, it } from 'vitest';
import { scaleFigureOutline } from './entourage';
import {
  applyPlan,
  directPlan,
  newSession,
  parseSession,
  serializeSession,
} from '../intelligence/engine';
import { solidStats } from './kernel';

it('creates a closed thin scale cutout with full-size bounds, a 1.83 m head and a 2.26 m reach', async () => {
  const s = (
    await applyPlan(
      newSession({ volumes: [], selectedId: null }),
      directPlan({
        type: 'person',
        height: 2.26,
        position: { x: 0, y: 0, z: 0 },
      }),
    )
  ).session;
  const v = s.project.volumes[0];
  expect(v.dimensions).toEqual({ width: 0.85, height: 2.26, depth: 0.025 });
  const stats = await solidStats(v);
  expect(stats.status).toBe('NoError');
  expect(stats.volume).toBeGreaterThan(0.005);
  expect(stats.volume).toBeLessThan(0.03);
  expect(stats.bounds.max[1]).toBeCloseTo(2.26);
  expect(stats.bounds.max[0] - stats.bounds.min[0]).toBeCloseTo(0.85);
  expect(stats.bounds.max[2] - stats.bounds.min[2]).toBeCloseTo(0.025);
  // Head summit and fingertips are explicit contour landmarks, not labels only.
  expect(
    scaleFigureOutline.some(
      ([x, y]) => Math.abs(x) < 0.15 && Math.abs(y * 2.26 - 1.83) < 1e-8,
    ),
  ).toBe(true);
  expect(Math.max(...scaleFigureOutline.map(([, y]) => y))).toBe(1);
  expect(parseSession(serializeSession(s))).toEqual(s);
});
