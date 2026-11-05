import { it, expect } from 'vitest';
import { prepareARPart } from './preparation';
it('reduces disconnected export seams within an AR budget without editing source data', async () => {
  const positions: number[] = [],
    indices: number[] = [];
  for (let z = 0; z < 100; z++)
    for (let x = 0; x < 100; x++) {
      const i = positions.length / 3;
      positions.push(
        x,
        0,
        z,
        x + 0.9,
        0,
        z,
        x + 0.9,
        0,
        z + 0.9,
        x,
        0,
        z + 0.9,
      );
      indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
    }
  const p = new Float32Array(positions),
    idx = new Uint32Array(indices);
  const result = await prepareARPart({
    positions: p,
    indices: idx,
    target: 2000,
  });
  expect(result.indices.length / 3).toBeLessThanOrEqual(2000);
  expect(result.indices.length).toBeGreaterThan(0);
  expect(p.every((n, i) => n === Math.fround(positions[i]))).toBe(true);
  expect(idx.every((n, i) => n === indices[i])).toBe(true);
  expect(
    [...result.indices].every((i) => i < result.positions.length / 3),
  ).toBe(true);
});
