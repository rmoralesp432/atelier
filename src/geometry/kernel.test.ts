import { describe, it, expect } from 'vitest';
import { makeVolume, parseProject, serializeProject } from '../model';
import { booleanVolume, solidStats, meshData } from './kernel';
describe('Manifold solid geometry', () => {
  it('computes real union, subtraction and intersection volumes and closed triangle meshes', async () => {
    const a = makeVolume(1, { width: 2, depth: 2, height: 2 }),
      b = makeVolume(2, { width: 2, depth: 2, height: 2 });
    b.position.x = 1;
    for (const [op, volume] of [
      ['union', 12],
      ['subtract', 4],
      ['intersect', 4],
    ] as const) {
      const result = await booleanVolume(a, b, op);
      const stats = await solidStats(result);
      expect(stats.volume).toBeCloseTo(volume);
      expect(stats.status).toBe('NoError');
      expect(result.id).toBe(a.id);
      const data = await meshData(result);
      expect(data.indices.length).toBeGreaterThan(0);
      const edges = new Map<string, number>();
      for (let i = 0; i < data.indices.length; i += 3)
        for (let j = 0; j < 3; j++) {
          const x = data.indices[i + j],
            y = data.indices[i + ((j + 1) % 3)],
            key = [Math.min(x, y), Math.max(x, y)].join(':');
          edges.set(key, (edges.get(key) || 0) + 1);
        }
      expect([...edges.values()].every((n) => n === 2)).toBe(true);
      expect(
        parseProject(
          serializeProject({ volumes: [result], selectedId: result.id }),
        ).volumes[0].geometry,
      ).toEqual(result.geometry);
    }
  });
  it('rejects an empty intersection atomically', async () => {
    const a = makeVolume(),
      b = makeVolume();
    b.position.x = 100;
    await expect(booleanVolume(a, b, 'intersect')).rejects.toThrow('no solid');
  });
  it('extrudes a circular section into a closed solid and scales a Boolean result', async () => {
    const v = makeVolume(1, { width: 2, depth: 2, height: 3 });
    v.geometry = { kind: 'extrusion', profile: 'circle' };
    expect((await solidStats(v)).volume).toBeCloseTo(Math.PI * 3, 1);
    const b = makeVolume();
    const a = makeVolume();
    b.position.x = 3;
    const r = await booleanVolume(a, b, 'union');
    const old = (await solidStats(r)).volume;
    r.dimensions = { ...r.dimensions, width: r.dimensions.width * 1.1 };
    expect((await solidStats(r)).volume).toBeCloseTo(old * 1.1);
  });
});

it('builds bounded, valid curved primitives and keeps 2D profiles out of solid Booleans', async () => {
  for (const kind of ['cylinder', 'sphere'] as const) {
    const v = makeVolume(1, { width: 2, depth: 2, height: 2 });
    v.geometry = { kind };
    const stats = await solidStats(v);
    const analytic = kind === 'sphere' ? (4 * Math.PI) / 3 : 2 * Math.PI;
    expect(Math.abs(stats.volume - analytic) / analytic).toBeLessThan(0.02);
    expect(stats.bounds.min[1]).toBeCloseTo(0);
    expect(stats.bounds.max[1]).toBeCloseTo(2);
    expect(stats.status).toBe('NoError');
  }
  const profile = makeVolume();
  profile.geometry = { kind: 'rectangle' };
  await expect(solidStats(profile)).rejects.toThrow('Extrude the 2D shape');
});
