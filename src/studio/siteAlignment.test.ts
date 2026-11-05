import { it, expect } from 'vitest';
import { shiftMap, siteTiles, trueNorth } from './site';
it('moves imagery by a meter in fixed project axes at arbitrary bearing', () => {
  for (const bearing of [0, 45, 90, -130]) {
    const site = { latitude: 31.74, longitude: -106.43, bearing },
      next = shiftMap(site, 2, 0),
      a = (bearing * Math.PI) / 180;
    const before = siteTiles(site)[4],
      after = siteTiles(next)[4];
    const x = after.x - before.x,
      z = after.z - before.z;
    expect(x * Math.cos(a) + z * Math.sin(a)).toBeCloseTo(2, 3);
    expect(-x * Math.sin(a) + z * Math.cos(a)).toBeCloseTo(0, 3);
    expect(trueNorth(next.bearing)).toEqual(trueNorth(site.bearing));
  }
});
it('round trips adjustment and rejects invalid geographic extents', () => {
  const s = { latitude: 0, longitude: 0, bearing: 90 };
  const n = shiftMap(shiftMap(s, 0, 10), 0, -10);
  expect(n.latitude).toBeCloseTo(0, 8);
  expect(n.longitude).toBeCloseTo(0, 8);
  expect(() => shiftMap({ ...s, latitude: 85 }, 0, 1e8)).toThrow();
});
it('covers exact metric squares with bounded imagery at any latitude and the date line', () => {
  for (const latitude of [0, 31.74, 60, 85, -85])
    for (const longitude of [0, 179.999, -179.999])
      for (const coverage of [250, 500, 1000, 2000, 5000]) {
        const tiles = siteTiles({ latitude, longitude, bearing: 45, coverage });
        expect(tiles.length).toBeLessThanOrEqual(25);
        expect(Math.min(...tiles.map((t) => t.x - t.width / 2))).toBeCloseTo(
          -coverage / 2,
          5,
        );
        expect(Math.max(...tiles.map((t) => t.x + t.width / 2))).toBeCloseTo(
          coverage / 2,
          5,
        );
        expect(Math.min(...tiles.map((t) => t.z - t.depth / 2))).toBeCloseTo(
          -coverage / 2,
          5,
        );
        expect(Math.max(...tiles.map((t) => t.z + t.depth / 2))).toBeCloseTo(
          coverage / 2,
          5,
        );
        expect(tiles.reduce((a, t) => a + t.width * t.depth, 0)).toBeCloseTo(
          coverage * coverage,
          3,
        );
        for (const tile of tiles)
          for (const value of Object.values(tile.uv)) {
            expect(value).toBeGreaterThanOrEqual(-1e-10);
            expect(value).toBeLessThanOrEqual(1 + 1e-10);
          }
      }
  expect(() =>
    siteTiles({ latitude: 0, longitude: 0, bearing: 0, coverage: 1e9 }),
  ).toThrow();
});
