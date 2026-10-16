import { expect, it } from 'vitest';
import {
  applyPlan,
  directPlan,
  newSession,
  parseSession,
  serializeSession,
} from './engine';
import {
  executeCommand,
  buildingSettings,
  makeVolume,
  parseProject,
  serializeProject,
} from '../model';
import { solidStats, withSolid, renderMeshData } from '../geometry/kernel';
import { sceneContext, defaultCamera } from './context';
import { envelopeBounds } from '../geometry/spatial';
import { siteTiles, googleMapsUrl } from '../studio/site';
const seed = () => {
  const v = makeVolume(1, { width: 4, depth: 2, height: 3 });
  return newSession({ volumes: [v], selectedId: v.id });
};
it('colors preserve identity, geometry, history and project round trips', async () => {
  const s = seed();
  const result = await applyPlan(
    s,
    directPlan({ type: 'color', targets: ['$selected'], color: '#d58b69' }),
  );
  expect(result.session.project.volumes[0]).toEqual({
    ...s.project.volumes[0],
    color: '#d58b69',
  });
  expect(parseSession(serializeSession(result.session))).toEqual(
    result.session,
  );
  const undone = await applyPlan(
    result.session,
    directPlan({ type: 'undo', count: 1 }),
  );
  expect(undone.session.project).toEqual(s.project);
  await expect(
    applyPlan(
      s,
      directPlan({ type: 'color', targets: ['$selected'], color: 'red' }),
    ),
  ).rejects.toThrow();
});
it('creates a recognizable solid scale figure at exact height with ground contact', async () => {
  const result = await applyPlan(
    seed(),
    directPlan({ type: 'person', height: 1.75, position: null }),
  );
  const person = result.session.project.volumes[1],
    stats = await solidStats(person);
  expect(person.geometry?.kind).toBe('person');
  expect(person.position.x).toBe(3.5);
  expect(stats.bounds.min[1]).toBeCloseTo(0);
  expect(stats.bounds.max[1]).toBeCloseTo(1.75);
  expect(stats.status).toBe('NoError');
  expect(stats.volume).toBeGreaterThan(0.02);
  expect(
    sceneContext(result.session.project, result.session.context, defaultCamera)
      .objects[1].shape,
  ).toBe('person');
});
it('uniform scaling changes group spacing and real volume about a shared base', async () => {
  const s = seed();
  const b = structuredClone(s.project.volumes[0]);
  b.id = 'b';
  b.position.x = 10;
  s.project.volumes.push(b);
  const result = await applyPlan(
    s,
    directPlan({
      type: 'scale',
      targets: [b.id, s.project.volumes[0].id],
      factor: 2,
      pivot: null,
    }),
  );
  expect(result.session.project.volumes.map((v) => v.position.x)).toEqual([
    -5, 15,
  ]);
  expect(
    (await solidStats(result.session.project.volumes[0])).volume,
  ).toBeCloseTo(192);
});
it('stretch preserves the opposite local face for a rotated box', async () => {
  const s = seed();
  s.project.volumes[0].rotation = 90;
  const before = envelopeBounds(s.project.volumes[0]);
  const result = await applyPlan(
    s,
    directPlan({
      type: 'stretch',
      targets: ['$selected'],
      axis: 'width',
      side: 'max',
      distance: 2,
    }),
  );
  const after = envelopeBounds(result.session.project.volumes[0]);
  expect(after.max.z).toBeCloseTo(before.max.z);
  expect(after.min.z).toBeCloseTo(before.min.z - 2);
  expect(
    (await solidStats(result.session.project.volumes[0])).volume,
  ).toBeCloseTo(36);
  await expect(
    applyPlan(
      s,
      directPlan({
        type: 'stretch',
        targets: ['$selected'],
        axis: 'width',
        side: 'max',
        distance: -5,
      }),
    ),
  ).rejects.toThrow();
  expect(s.past).toHaveLength(0);
});
it('mirror reflects asymmetric geometry and world placement, keeps original and supports undo', async () => {
  let s = seed();
  s = (
    await applyPlan(
      s,
      directPlan({
        type: 'footprint',
        name: 'L',
        points: [
          { x: 0, z: 0 },
          { x: 4, z: 0 },
          { x: 4, z: 1 },
          { x: 1, z: 1 },
          { x: 1, z: 3 },
          { x: 0, z: 3 },
        ],
        height: 3,
        extruded: true,
        x: 6,
        y: 0,
        z: 2,
        rotation: 35,
      }),
    )
  ).session;
  const original = s.project.volumes[1];
  const result = await applyPlan(
    s,
    directPlan({
      type: 'mirror',
      targets: ['$selected'],
      axis: 'x',
      coordinate: 1,
      copy: true,
    }),
  );
  const copy = result.session.project.volumes[2],
    a = await solidStats(original),
    b = await solidStats(copy);
  expect(copy.id).not.toBe(original.id);
  expect(copy.position.x).toBe(-4);
  expect(copy.rotation).toBe(325);
  expect(b.volume).toBeCloseTo(a.volume);
  expect(b.bounds.min[0]).toBeCloseTo(2 - a.bounds.max[0]);
  expect(b.bounds.max[0]).toBeCloseTo(2 - a.bounds.min[0]);
  // Test the actual shape, not just its envelope: mirror the result back and compare the symmetric difference.
  await withSolid(original, async (first) =>
    withSolid(copy, (second) => {
      const reflected = second
        .translate([-1, 0, 0])
        .mirror([1, 0, 0])
        .translate([1, 0, 0]);
      const cut = first.subtract(reflected);
      try {
        expect(cut.volume()).toBeCloseTo(0, 5);
      } finally {
        cut.delete();
        reflected.delete();
      }
    }),
  );
  expect(
    parseSession(serializeSession(result.session)).project.volumes[2],
  ).toEqual(copy);
  expect(
    (await applyPlan(result.session, directPlan({ type: 'undo', count: 1 })))
      .session.project,
  ).toEqual(s.project);
});
it('rectangular and polar arrays use total count, distinct identities and exact spacing', async () => {
  const grid = await applyPlan(
    seed(),
    directPlan({
      type: 'array_grid',
      targets: ['$selected'],
      rows: 2,
      columns: 3,
      spacingX: 8,
      spacingZ: 6,
    }),
  );
  expect(grid.session.project.volumes.map((v) => v.position)).toEqual([
    { x: 0, y: 0, z: 0 },
    { x: 8, y: 0, z: 0 },
    { x: 16, y: 0, z: 0 },
    { x: 0, y: 0, z: 6 },
    { x: 8, y: 0, z: 6 },
    { x: 16, y: 0, z: 6 },
  ]);
  const s = seed();
  s.project.volumes[0].position.x = 10;
  const polar = await applyPlan(
    s,
    directPlan({
      type: 'array_polar',
      targets: ['$selected'],
      count: 4,
      center: { x: 0, y: 0, z: 0 },
      angle: 360,
      rotate: true,
    }),
  );
  expect(
    polar.session.project.volumes.map((v) => [
      v.position.x,
      v.position.z,
      v.rotation,
    ]),
  ).toEqual([
    [10, 0, 0],
    [0, -10, 90],
    [-10, 0, 180],
    [0, 10, 270],
  ]);
  expect(new Set(polar.session.project.volumes.map((v) => v.id)).size).toBe(4);
  await expect(
    applyPlan(
      s,
      directPlan({
        type: 'array_grid',
        targets: ['$selected'],
        rows: 20,
        columns: 20,
        spacingX: 10,
        spacingZ: 10,
      }),
    ),
  ).rejects.toThrow('limit');
});
it('geographic anchors round trip without moving geometry and tile scale follows latitude', () => {
  const s = seed(),
    site = { latitude: 20.9674, longitude: -89.5926, bearing: 45 };
  s.project.site = site;
  expect(parseProject(serializeProject(s.project))).toEqual(s.project);
  const tiles = siteTiles(site);
  expect(tiles).toHaveLength(9);
  expect(tiles[1].x - tiles[0].x).toBeCloseTo(tiles[0].size);
  expect(
    siteTiles({ ...site, latitude: 60 })[0].size /
      siteTiles({ ...site, latitude: 0 })[0].size,
  ).toBeCloseTo(0.5);
  expect(googleMapsUrl(site)).toContain('20.9674,-89.5926');
  expect(() => siteTiles({ ...site, latitude: 91 })).toThrow();
});

it('uniform scale also scales material thickness and solid volume of an existing building', async () => {
  let s = seed();
  s = (
    await applyPlan(
      s,
      directPlan({
        type: 'building',
        target: '$selected',
        floors: 1,
        slabThickness: 0.2,
        facade: true,
        panelWidth: 1,
        mullionWidth: 0.05,
      }),
      defaultCamera,
      true,
    )
  ).session;
  const before = await solidStats(s.project.volumes[0]);
  const result = await applyPlan(
    s,
    directPlan({
      type: 'scale',
      targets: ['$selected'],
      factor: 2,
      pivot: null,
    }),
  );
  expect(
    (await solidStats(result.session.project.volumes[0])).volume,
  ).toBeCloseTo(before.volume * 8, 3);
  expect(
    buildingSettings(result.session.project.volumes[0])!.slabThickness,
  ).toBeCloseTo(0.4);
});

it('mirrored curtain walls retain glass and frame render parts with correct winding', async () => {
  let s = seed();
  s = (
    await applyPlan(
      s,
      directPlan({
        type: 'building',
        target: '$selected',
        floors: 1,
        slabThickness: 0.2,
        facade: true,
        panelWidth: 1,
        mullionWidth: 0.05,
      }),
      defaultCamera,
      true,
    )
  ).session;
  const original = await renderMeshData(s.project.volumes[0]);
  const result = await applyPlan(
    s,
    directPlan({
      type: 'mirror',
      targets: ['$selected'],
      axis: 'z',
      coordinate: 0,
      copy: false,
    }),
  );
  const mirrored = await renderMeshData(result.session.project.volumes[0]);
  expect(mirrored.map((p) => p.material)).toEqual(
    original.map((p) => p.material),
  );
  expect(mirrored.some((p) => p.material === 'glass')).toBe(true);
  for (let i = 0; i < original.length; i++) {
    expect(mirrored[i].positions[2]).toBe(-original[i].positions[2]);
    expect(mirrored[i].indices[1]).toBe(original[i].indices[2]);
  }
});

it('manual creation preserves map location and resets old multi-selection', () => {
  const s = seed();
  s.project.site = { latitude: 20, longitude: -90, bearing: 0 };
  s.project.selectedIds = [s.project.selectedId!];
  const next = executeCommand(
    s.project,
    'create volume width 4 depth 3 height 2',
  ).project;
  expect(next.site).toEqual(s.project.site);
  expect(next.selectedIds).toEqual([next.selectedId]);
  expect(next.selectedId).not.toBe(s.project.selectedId);
});
