import { describe, it, expect } from 'vitest';
import { curvedWireframe } from './curvedWireframe';
import type { Volume } from '../model';
const v: Volume = {
  id: 'v',
  name: 'Curve',
  position: { x: 0, y: 0, z: 0 },
  rotation: 0,
  dimensions: { width: 8, depth: 6, height: 12 },
};
describe('symbolic curved wireframes', () => {
  it('traces ellipsoid meridians and parallels on the actual surface', () => {
    const data = curvedWireframe({ ...v, geometry: { kind: 'sphere' } });
    expect(data.length).toBeGreaterThan(1000);
    for (let i = 0; i < data.length; i += 3)
      expect(
        (data[i] / 4) ** 2 +
          ((data[i + 1] - 6) / 6) ** 2 +
          (data[i + 2] / 3) ** 2,
      ).toBeCloseTo(1, 6);
    expect(Math.min(...data.filter((_, i) => i % 3 === 1))).toBe(0);
    expect(Math.max(...data.filter((_, i) => i % 3 === 1))).toBe(12);
  });
  it('adds eight full-height cylinder generators without changing the solid', () => {
    const cylinder: Volume = { ...v, geometry: { kind: 'cylinder' } };
    const original = structuredClone(cylinder);
    const data = curvedWireframe(cylinder);
    expect(data.length).toBe(48);
    for (let i = 0; i < data.length; i += 6) {
      expect(data[i + 1]).toBe(0);
      expect(data[i + 4]).toBe(12);
      expect(data[i]).toBe(data[i + 3]);
      expect(data[i + 2]).toBe(data[i + 5]);
    }
    expect(cylinder).toEqual(original);
    expect(
      curvedWireframe({
        ...v,
        geometry: { kind: 'extrusion', profile: 'circle' },
      }),
    ).toEqual(data);
    expect(curvedWireframe(v)).toEqual([]);
  });
});
