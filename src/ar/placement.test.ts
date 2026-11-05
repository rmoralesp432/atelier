import { expect, it } from 'vitest';
import { fitToRealWidth } from './placement';
it('fits project width to actual meter-based tracked endpoints without modifying them', () => {
  const a = { x: 1, y: 0, z: 2 },
    b = { x: 1, y: 0, z: 4 };
  const fit = fitToRealWidth(a, b, 20);
  expect(fit).toEqual({
    distance: 2,
    scale: 0.1,
    rotation: -90,
    position: { x: 1, y: 0, z: 3 },
  });
  expect(a).toEqual({ x: 1, y: 0, z: 2 });
  expect(fitToRealWidth(a, { x: 21, y: 0, z: 2 }, 20).scale).toBe(1);
});
it('rejects unstable, sloping, oversized, tiny and nonfinite tracked spans', () => {
  const a = { x: 0, y: 0, z: 0 };
  for (const [b, w] of [
    [{ x: 0.01, y: 0, z: 0 }, 20],
    [{ x: 2, y: 0.3, z: 0 }, 20],
    [{ x: 21, y: 0, z: 0 }, 20],
    [{ x: 1, y: 0, z: 0 }, 2000],
    [{ x: NaN, y: 0, z: 0 }, 20],
    [{ x: 1, y: 0, z: 0 }, 0],
  ] as const) {
    expect(() => fitToRealWidth(a, b, w)).toThrow();
  }
});
