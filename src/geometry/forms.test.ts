import { describe, it, expect } from 'vitest';
import { getKernel, solidStats, orientVolume } from './kernel';
import { formMesh } from './forms';
import { makeVolume, parseProject, serializeProject } from '../model';
import { applyPlan, directPlan, newSession } from '../intelligence/engine';
const square = [
  { x: -1, z: -1 },
  { x: 1, z: -1 },
  { x: 1, z: 1 },
  { x: -1, z: 1 },
];
describe('expressive solids', () => {
  it('lofts a tapered prism with analytic volume, closed topology and persistent definition', async () => {
    const definition = {
      method: 'loft' as const,
      sections: [
        { y: 0, points: square },
        { y: 6, points: square.map((p) => ({ x: p.x * 2, z: p.z * 2 })) },
      ],
    };
    const result = formMesh(await getKernel(), definition);
    const v = {
      ...makeVolume(1, result.dimensions),
      geometry: { kind: 'form' as const, mesh: result.mesh, definition },
    };
    expect((await solidStats(v)).volume).toBeCloseTo(56, 4);
    const restored = parseProject(
      serializeProject({ volumes: [v], selectedId: v.id }),
    );
    expect((await solidStats(restored.volumes[0])).volume).toBeCloseTo(56, 4);
  });
  it('sweeps a profile along straight and curved paths as a closed solid', async () => {
    for (const smooth of [false, true]) {
      const definition = {
        method: 'sweep' as const,
        profile: square,
        path: smooth
          ? [
              { x: 0, y: 0, z: 0 },
              { x: 0, y: 5, z: 2 },
              { x: 2, y: 10, z: 0 },
            ]
          : [
              { x: 0, y: 0, z: 0 },
              { x: 0, y: 10, z: 0 },
            ],
        smooth,
      };
      const result = formMesh(await getKernel(), definition);
      const v = {
        ...makeVolume(1, result.dimensions),
        geometry: { kind: 'form' as const, mesh: result.mesh, definition },
      };
      const stats = await solidStats(v);
      expect(stats.status).toBe('NoError');
      expect(stats.volume).toBeGreaterThan(30);
      if (!smooth) expect(stats.volume).toBeCloseTo(40, 4);
    }
  });
  it('rotates a cylinder onto its side with stable identity, center and volume', async () => {
    const v = {
      ...makeVolume(1, { width: 4, depth: 4, height: 12 }),
      geometry: { kind: 'cylinder' as const },
      position: { x: 2, y: 5, z: 3 },
    };
    const rotated = await orientVolume(v, { x: 90, y: 0, z: 0 });
    expect(rotated.id).toBe(v.id);
    expect(rotated.dimensions.height).toBeCloseTo(4);
    expect(rotated.dimensions.depth).toBeCloseTo(12);
    expect(rotated.position.y + rotated.dimensions.height / 2).toBeCloseTo(11);
    expect((await solidStats(rotated)).volume).toBeCloseTo(
      (await solidStats(v)).volume,
      4,
    );
  });
  it('hollows a box with exact wall thickness and reversible history', async () => {
    const v = makeVolume(1, { width: 10, depth: 8, height: 6 }),
      s = newSession({ volumes: [v], selectedId: v.id });
    const out = await applyPlan(
      s,
      directPlan({
        type: 'hollow',
        target: v.id,
        thickness: 0.5,
        openTop: true,
      }),
      undefined,
      true,
    );
    expect(
      (await solidStats(out.session.project.volumes[0])).volume,
    ).toBeCloseTo(480 - 9 * 7 * 5.5, 4);
    expect(out.session.past).toHaveLength(1);
    expect(s.project.volumes[0].geometry).toBeUndefined();
    await expect(
      applyPlan(
        s,
        directPlan({
          type: 'hollow',
          target: v.id,
          thickness: 5,
          openTop: true,
        }),
        undefined,
        true,
      ),
    ).rejects.toThrow(/interior/);
  });
  it('rejects crossing profiles and mismatched loft stations without changing the scene', async () => {
    const m = await getKernel();
    expect(() =>
      formMesh(m, {
        method: 'loft',
        sections: [
          { y: 0, points: square },
          { y: 4, points: square.slice(0, 3) },
        ],
      }),
    ).toThrow(/matching/);
    const v = makeVolume();
    await expect(orientVolume(v, { x: 90, y: 0, z: 0 })).rejects.toThrow(
      /below ground/,
    );
  });
});
it('rejects a folded sweep whose thick sections cross', async () => {
  const m = await getKernel();
  expect(() =>
    formMesh(m, {
      method: 'sweep',
      profile: square,
      smooth: false,
      path: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 10, z: 0 },
        { x: 0.5, y: 10, z: 0 },
        { x: 0.5, y: 0, z: 0 },
      ],
    }),
  ).toThrow();
});
it('accepts consistently reversed loft winding with the same positive volume', async () => {
  const definition = {
    method: 'loft' as const,
    sections: [
      { y: 0, points: [...square].reverse() },
      {
        y: 6,
        points: [...square].reverse().map((p) => ({ x: 2 * p.x, z: 2 * p.z })),
      },
    ],
  };
  const result = formMesh(await getKernel(), definition);
  const v = {
    ...makeVolume(1, result.dimensions),
    geometry: { kind: 'form' as const, definition, mesh: result.mesh },
  };
  expect((await solidStats(v)).volume).toBeCloseTo(56, 4);
});
