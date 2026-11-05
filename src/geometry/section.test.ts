import { it, expect } from 'vitest';
import { makeVolume } from '../model';
import { sectionCap } from './section';
import { Vector3 } from 'three';
it('caps a hollow section with its real material area, keeping the interior open', async () => {
  const source = makeVolume(1, { width: 10, depth: 8, height: 6 });
  const v = {
    ...source,
    geometry: {
      kind: 'hollow' as const,
      source,
      thickness: 0.5,
      openTop: true,
    },
  };
  const positions = await sectionCap(v, {
    enabled: true,
    axis: 'y',
    position: 3,
    flip: false,
  });
  let area = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const a = new Vector3().fromArray(positions, i),
      b = new Vector3().fromArray(positions, i + 3),
      c = new Vector3().fromArray(positions, i + 6);
    expect(a.y).toBeCloseTo(3);
    area += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  expect(area).toBeCloseTo(10 * 8 - 9 * 7, 4);
  expect(
    await sectionCap(v, {
      enabled: true,
      axis: 'y',
      position: 100,
      flip: false,
    }),
  ).toHaveLength(0);
});
