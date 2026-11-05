import { requestSchema } from '../../server/provider';
import { sceneContext, defaultCamera } from '../intelligence/context';
import { it, expect } from 'vitest';
import { organicMesh } from './organic';
import type { OrganicDefinition } from './organicSchema';
import { getKernel, solidStats, meshData, withSolid } from './kernel';
import { makeVolume } from '../model';
import {
  applyPlan,
  directPlan,
  newSession,
  serializeSession,
  parseSession,
} from '../intelligence/engine';
export const roof: OrganicDefinition = {
  method: 'nurbs',
  degreeU: 3,
  degreeV: 3,
  points: Array.from({ length: 4 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) => ({
      x: i * 4 - 6,
      y: 2,
      z: j * 3 - 4.5,
      weight: 1,
    })),
  ),
  thickness: 0.2,
  samples: 12,
};
async function build(d: OrganicDefinition) {
  const r = organicMesh(await getKernel(), d);
  return {
    ...makeVolume(1),
    dimensions: r.dimensions,
    geometry: {
      kind: 'form' as const,
      mesh: r.mesh,
      definition: d,
      origin: r.origin,
      base: r.dimensions,
    },
  };
}
it('constructs a true rational NURBS shell with analytic flat volume and editable interior controls', async () => {
  const v = await build(roof);
  expect((await solidStats(v)).volume).toBeCloseTo(12 * 9 * 0.2, 3);
  const source = newSession({ volumes: [v], selectedId: v.id });
  const result = await applyPlan(
    source,
    directPlan({
      type: 'edit_control_points',
      target: v.id,
      changes: [{ index: 5, point: { x: -2, y: 7, z: -1.5 }, weight: 1.6 }],
    }),
  );
  expect(result.session.project.volumes[0].id).toBe(v.id);
  expect(result.session.project.volumes[0].dimensions.height).toBeGreaterThan(
    1,
  );
  expect((await solidStats(result.session.project.volumes[0])).status).toBe(
    'NoError',
  );
  expect(
    requestSchema.safeParse({
      message: 'Raise the roof again',
      history: [],
      scene: sceneContext(
        result.session.project,
        result.session.context,
        defaultCamera,
      ),
    }).success,
  ).toBe(true);
  expect(parseSession(serializeSession(result.session)).project).toEqual(
    result.session.project,
  );
  expect(
    (await applyPlan(result.session, directPlan({ type: 'undo', count: 1 })))
      .session.project,
  ).toEqual(source.project);
});
it('makes variable-section twisted ribbons as closed solids, not double-sided display planes', async () => {
  const v = await build({
    method: 'organic_sweep',
    profile: 'rectangle',
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 12, z: 0 },
    ],
    stations: [
      { at: 0, width: 2, depth: 0.2, twist: 0 },
      { at: 1, width: 2, depth: 0.2, twist: 90 },
    ],
    samples: 48,
  });
  expect((await solidStats(v)).volume).toBeCloseTo(4.8, 1);
  const curved = await build({
    method: 'organic_sweep',
    profile: 'ellipse',
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 7, z: 2 },
      { x: 4, y: 14, z: 4 },
    ],
    stations: [
      { at: 0, width: 2, depth: 2, twist: 0 },
      { at: 0.5, width: 3, depth: 3, twist: 30 },
      { at: 1, width: 1, depth: 1, twist: 90 },
    ],
    samples: 48,
  });
  expect((await solidStats(curved)).volume).toBeGreaterThan(20);
});
it('smoothly lofts unlike profile counts with retained sections', async () => {
  const v = await build({
    method: 'smooth_loft',
    sections: [
      {
        y: 0,
        points: [
          { x: -3, z: -2 },
          { x: 3, z: -2 },
          { x: 3, z: 2 },
          { x: -3, z: 2 },
        ],
      },
      {
        y: 5,
        points: Array.from({ length: 12 }, (_, i) => ({
          x: 5 * Math.cos((i * Math.PI) / 6),
          z: 3 * Math.sin((i * Math.PI) / 6),
        })),
      },
      {
        y: 10,
        points: [
          { x: -2, z: -2 },
          { x: 4, z: -1 },
          { x: 3, z: 2 },
          { x: -1, z: 3 },
        ],
      },
    ],
    samples: 32,
    smoothProfiles: false,
    alignProfiles: true,
  });
  expect((await solidStats(v)).volume).toBeGreaterThan(200);
  expect(v.dimensions.height).toBeCloseTo(10, 4);
});
it('Catmull–Clark subdivision preserves the base and explicit creases while rounding the rest', async () => {
  const d: OrganicDefinition = {
    method: 'subdivision',
    vertices: [
      [-2, 0, -2],
      [2, 0, -2],
      [2, 0, 2],
      [-2, 0, 2],
      [-2, 4, -2],
      [2, 4, -2],
      [2, 4, 2],
      [-2, 4, 2],
    ].map(([x, y, z]) => ({ x, y, z })),
    faces: [
      [0, 1, 2, 3],
      [4, 7, 6, 5],
      [0, 4, 5, 1],
      [1, 5, 6, 2],
      [2, 6, 7, 3],
      [3, 7, 4, 0],
    ],
    creases: [[0, 4]],
    iterations: 2,
    preserveBase: true,
  };
  const v = await build(d),
    stats = await solidStats(v);
  expect(stats.volume).toBeLessThan(64);
  expect(stats.volume).toBeGreaterThan(35);
  expect(v.dimensions.width).toBeCloseTo(4);
  expect(v.dimensions.depth).toBeCloseTo(4);
  expect(v.dimensions.height).toBeCloseTo(4);
  const mesh = await meshData(v);
  expect(mesh.indices.length / 3).toBeGreaterThan(150);
});
it('creates genuinely connected blended fields with a retained flowing cavity', async () => {
  const d: OrganicDefinition = {
    method: 'field',
    elements: [
      {
        shape: 'ellipsoid',
        center: { x: 0, y: 3, z: 0 },
        end: { x: 0, y: 3, z: 0 },
        radii: { x: 3, y: 3, z: 3 },
        endRadius: 3,
        subtract: false,
      },
      {
        shape: 'capsule',
        center: { x: -5, y: 3, z: 0 },
        end: { x: 5, y: 3, z: 0 },
        radii: { x: 1, y: 1, z: 1 },
        endRadius: 1,
        subtract: true,
      },
    ],
    blend: 0.3,
    resolution: 0.35,
  };
  const v = await build(d);
  const stats = await solidStats(v);
  expect(stats.volume).toBeGreaterThan(80);
  expect(stats.volume).toBeLessThan(110);
  expect(stats.status).toBe('NoError');
});
it('rejects open cages, singular control nets and excessive implicit grids', async () => {
  const m = await getKernel();
  expect(() =>
    organicMesh(m, {
      ...roof,
      degreeU: 3,
      points: roof.method === 'nurbs' ? roof.points.slice(0, 2) : [],
    } as OrganicDefinition),
  ).toThrow();
  expect(() =>
    organicMesh(m, {
      method: 'field',
      elements: [
        {
          shape: 'ellipsoid',
          center: { x: 0, y: 50, z: 0 },
          end: { x: 0, y: 50, z: 0 },
          radii: { x: 50, y: 50, z: 50 },
          endRadius: 50,
          subtract: false,
        },
      ],
      blend: 1,
      resolution: 0.1,
    }),
  ).toThrow(/dense/);
});
it('corrects existing column positions inward in a rotated reference frame without replacing them', async () => {
  const ref = makeVolume(1, { width: 20, depth: 12, height: 0.3 });
  ref.rotation = 90;
  ref.id = 'floor';
  const cols = [
    [-8, -4],
    [8, -4],
    [8, 4],
    [-8, 4],
  ].map(([x, z], i) => ({
    ...makeVolume(i + 2, { width: 0.9, depth: 0.9, height: 4 }),
    id: 'c' + i,
    position: { x: z, y: 0.3, z: -x },
  }));
  const start = newSession({ volumes: [ref, ...cols], selectedId: cols[0].id });
  const r = await applyPlan(
    start,
    directPlan({
      type: 'inset_layout',
      targets: cols.map((v) => v.id),
      reference: ref.id,
      distance: 2,
      axes: 'xz',
    }),
  );
  r.session.project.volumes.slice(1).forEach((v, i) => {
    expect(v.dimensions).toEqual(cols[i].dimensions);
    expect(v.id).toBe(cols[i].id);
    expect(Math.abs(v.position.x)).toBeCloseTo(2);
    expect(Math.abs(v.position.z)).toBeCloseTo(6);
  });
  expect(r.session.project.volumes[0]).toEqual(ref);
});
it('makes a connected five-branch organic structure with editable tapering segments', async () => {
  const d: Extract<OrganicDefinition, { method: 'field' }> = {
    method: 'field',
    blend: 0.6,
    resolution: 0.4,
    elements: [
      {
        shape: 'capsule',
        center: { x: 0, y: 1, z: 0 },
        end: { x: 0, y: 5, z: 0 },
        radii: { x: 1, y: 1, z: 1 },
        endRadius: 0.9,
        subtract: false,
      },
    ],
  };
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI * 2) / 5;
    const joint = { x: 2 * Math.cos(angle), y: 7, z: 2 * Math.sin(angle) };
    d.elements.push(
      {
        shape: 'capsule',
        center: { x: 0, y: 4.5, z: 0 },
        end: joint,
        radii: { x: 0.8, y: 0.8, z: 0.8 },
        endRadius: 0.6,
        subtract: false,
      },
      {
        shape: 'capsule',
        center: joint,
        end: { x: 4 * Math.cos(angle), y: 8, z: 4 * Math.sin(angle) },
        radii: { x: 0.6, y: 0.6, z: 0.6 },
        endRadius: 0.3,
        subtract: false,
      },
    );
  }
  const v = await build(d);
  expect((await solidStats(v)).status).toBe('NoError');
  await withSolid(v, (s) => {
    const parts = s.decompose();
    expect(parts.length).toBe(1);
    parts.forEach((p) => p.delete());
  });
});
it('rejects malformed saved coordinate frames and supports genuinely thin NURBS shells', async () => {
  const thin = await build({ ...roof, thickness: 0.03 } as OrganicDefinition);
  const start = newSession({ volumes: [thin], selectedId: thin.id });
  expect(
    parseSession(serializeSession(start)).project.volumes[0].dimensions.height,
  ).toBeCloseTo(0.03, 5);
  const invalid = JSON.parse(serializeSession(start));
  invalid.project.volumes[0].geometry.origin = { x: 0 };
  expect(() => parseSession(JSON.stringify(invalid))).toThrow();
});
