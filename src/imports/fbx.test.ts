import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { asciiAssembly } from '../../tests/fixtures/fbx/assembly';
import { parseMeshAsset, prepareImport, MAX_IMPORT_TRIANGLES } from './mesh';
import { importedSession } from './transaction';
import { solidStats, booleanVolume } from '../geometry/kernel';
import { initialProject } from '../model';
import {
  applyPlan,
  directPlan,
  newSession,
  parseSession,
  serializeSession,
} from '../intelligence/engine';
const bytes = (text: string) => new TextEncoder().encode(text).buffer;
const fixture = (name: string) => {
  const b = readFileSync(
    new URL(`../../tests/fixtures/fbx/${name}.fbx`, import.meta.url),
  );
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
afterEach(() => vi.unstubAllGlobals());

it('reads a real binary Revit export: feet, Z-up, original names, wall solids and reference annotations', async () => {
  // Three's loader reads viewport dimensions when parsing an FBX camera;
  // browsers supply this normally. Imported cameras do not alter ATELIER's view.
  vi.stubGlobal('window', { innerWidth: 1440, innerHeight: 900 });
  const asset = await parseMeshAsset('Revit walls.fbx', fixture('revit-wall'));
  expect(asset.metersPerUnit).toBe(0.3048);
  expect(asset.parts).toHaveLength(6);
  const prepared = await prepareImport(asset, { units: 'source', up: 'Y' });
  const walls = prepared.volumes.filter((v) => v.name.startsWith('Basic Wall'));
  expect(walls).toHaveLength(4);
  expect(walls[0].name).toContain('[320878]');
  for (const wall of walls) {
    expect(wall.dimensions.height).toBeCloseTo(8, 5);
    expect((await solidStats(wall)).volume).toBeGreaterThan(0);
  }
  expect(walls[0].dimensions.width).toBeCloseTo(0.29, 5);
  expect(walls[1].dimensions.width).toBeCloseTo(5, 5);
  expect(prepared.volumes[4].geometry).toMatchObject({
    kind: 'mesh',
    solid: false,
  });
  expect(
    prepared.volumes[5].position.y - prepared.volumes[4].position.y,
  ).toBeCloseTo(4);
});

it('imports binary FBX 7.4 and rejects unsupported/empty FBX without a partial result', async () => {
  const asset = await parseMeshAsset('Cube.fbx', fixture('maya-cube'));
  expect(asset.parts?.[0].name).toBe('pCube1');
  const { volumes } = await prepareImport(asset, { units: 'source', up: 'Y' });
  expect(volumes[0].dimensions.height).toBeCloseTo(0.01);
  expect((await solidStats(volumes[0])).volume).toBeCloseTo(0.000001, 8);
  await expect(parseMeshAsset('broken.fbx', bytes('not fbx'))).rejects.toThrow(
    'FBX could not be read',
  );
  await expect(
    parseMeshAsset(
      'empty.fbx',
      bytes(asciiAssembly().replaceAll('"Mesh"', '"Null"')),
    ),
  ).rejects.toThrow();
});

it('preserves parent transforms, instance offsets, mirrored winding, colors and source units without texture requests', async () => {
  const network = vi
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('Unexpected request'));
  // A TextureLoader fallback would also attempt document.createElementNS.
  vi.stubGlobal('document', {
    createElementNS: () => {
      throw new Error('Unexpected image decoding');
    },
  });
  try {
    const asset = await parseMeshAsset('Assembly.fbx', bytes(asciiAssembly()));
    const p = await prepareImport(asset, { units: 'source', up: 'Y' });
    expect(p.volumes.map((v) => v.color)).toEqual(['#ff0000', '#0000ff']);
    expect(p.dimensions.width).toBeCloseTo(4);
    expect(p.dimensions.height).toBeCloseTo(6);
    expect(p.dimensions.depth).toBeCloseTo(8);
    expect(p.volumes[1].position.y - p.volumes[0].position.y).toBeCloseTo(3);
    expect(p.volumes[1].position.z - p.volumes[0].position.z).toBeCloseTo(-6);
    for (const v of p.volumes)
      expect((await solidStats(v)).volume).toBeCloseTo(24);
    const a = { ...p.volumes[0], position: { x: 0, y: 0, z: 0 } },
      b = { ...p.volumes[1], position: { x: 0, y: 0, z: 0 } };
    expect(
      (await solidStats(await booleanVolume(a, b, 'intersect'))).volume,
    ).toBeCloseTo(24);
    expect(network).not.toHaveBeenCalled();
    const combined = await prepareImport(
      asset,
      { units: 'source', up: 'Y' },
      false,
    );
    expect(combined.volumes).toHaveLength(1);
    expect(combined.dimensions).toEqual(p.dimensions);
    const cm = await prepareImport(asset, { units: 'cm', up: 'Y' });
    expect(cm.dimensions.height).toBeCloseTo(0.06);
  } finally {
    network.mockRestore();
  }
});

it('groups the assembly atomically, keeps existing work, moves all selected parts, and restores through undo and reload', async () => {
  const p = await prepareImport(
    await parseMeshAsset('Assembly.fbx', bytes(asciiAssembly())),
    { units: 'source', up: 'Y' },
  );
  const original = newSession(initialProject()),
    before = structuredClone(original);
  const imported = importedSession(original, p);
  expect(original).toEqual(before);
  expect(imported.project.volumes.slice(0, 2)).toEqual(before.project.volumes);
  expect(imported.project.selectedIds).toHaveLength(2);
  expect(imported.project.groups).toHaveLength(1);
  expect(imported.project.volumes[2].groupId).toBe(
    imported.project.volumes[3].groupId,
  );
  expect(parseSession(serializeSession(imported))).toEqual(imported);
  const moved = (
    await applyPlan(
      imported,
      directPlan({
        type: 'move',
        targets: ['$selected'],
        direction: 'right',
        distance: 2,
      }),
    )
  ).session;
  for (let i = 2; i < 4; i++)
    expect(moved.project.volumes[i].position.x).toBeCloseTo(
      imported.project.volumes[i].position.x + 2,
    );
  const undo = (
    await applyPlan(imported, directPlan({ type: 'undo', count: 1 }))
  ).session;
  expect(undo.project).toEqual(original.project);
  const redo = (await applyPlan(undo, directPlan({ type: 'redo', count: 1 })))
    .session;
  expect(redo.project).toEqual(imported.project);
  const duplicate = importedSession(imported, p);
  expect(new Set(duplicate.project.volumes.map((v) => v.id)).size).toBe(6);
  expect(new Set(duplicate.project.volumes.map((v) => v.name)).size).toBe(6);
});

it('rejects oversized assemblies before changing the project and reports per-face color limitations', async () => {
  const asset = await parseMeshAsset(
    'Assembly.fbx',
    bytes(asciiAssembly({ multiMaterial: true })),
  );
  expect(asset.warnings?.join(' ')).toContain('first material');
  const p = await prepareImport(asset, { units: 'source', up: 'Y' });
  const session = newSession(initialProject());
  expect(() =>
    importedSession(session, { ...p, volumes: Array(201).fill(p.volumes[0]) }),
  ).toThrow('200 objects');
  expect(session.project.volumes).toHaveLength(2);
  const invalid = await parseMeshAsset(
    'Invalid.fbx',
    bytes(asciiAssembly({ unit: -1 })),
  );
  await expect(
    prepareImport(invalid, { units: 'source', up: 'Y' }),
  ).rejects.toThrow('Invalid source units');
});

it('supports more than the old 20,000 triangle cap while retaining the new hard cap', async () => {
  // An open tiled facade is representative of a larger architectural surface.
  const size = 105,
    rows: string[] = [];
  for (let z = 0; z <= size; z++)
    for (let x = 0; x <= size; x++) rows.push(`v ${x} 0 ${z}`);
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) {
      const i = z * (size + 1) + x + 1;
      rows.push(
        `f ${i} ${i + 1} ${i + size + 2}`,
        `f ${i} ${i + size + 2} ${i + size + 1}`,
      );
    }
  const asset = await parseMeshAsset('Facade.obj', bytes(rows.join('\n')));
  expect(asset.indices.length / 3).toBe(22050);
  const p = await prepareImport(asset, { units: 'm', up: 'Y' });
  const s = importedSession(newSession({ volumes: [], selectedId: null }), p);
  expect(
    parseSession(serializeSession(s)).project.volumes[0].dimensions.width,
  ).toBe(105);
  expect(MAX_IMPORT_TRIANGLES).toBe(1000000);
  await expect(
    parseMeshAsset(
      'Too many.obj',
      bytes(
        'v 0 0 0\nv 1 0 0\nv 0 1 0\n' +
          'f 1 2 3\n'.repeat(MAX_IMPORT_TRIANGLES + 1),
      ),
    ),
  ).rejects.toThrow('1,000,000');
});

it('can combine an FBX with more source elements than the workspace object limit', async () => {
  let text = asciiAssembly({ texture: false });
  const models: string[] = [],
    connections: string[] = [];
  for (let i = 0; i < 199; i++) {
    const id = 1000 + i;
    models.push(
      `\tModel: ${id}, "Model::Element ${id}", "Mesh" {\n\t\tProperties70:  {\n\t\t\tP: "Lcl Translation", "Lcl Translation", "", "A",${i * 2},1.5,0\n\t\t}\n\t}\n`,
    );
    connections.push(
      `\tC: "OO",1,${id}\n\tC: "OO",40,${id}\n\tC: "OO",${id},30\n`,
    );
  }
  text = text.replace('\tModel: 30', models.join('') + '\tModel: 30');
  text = text.slice(0, text.lastIndexOf('}')) + connections.join('') + '}\n';
  const asset = await parseMeshAsset('Many elements.fbx', bytes(text));
  expect(asset.parts).toHaveLength(201);
  const combined = await prepareImport(
    asset,
    { units: 'source', up: 'Y' },
    false,
  );
  expect(combined.volumes).toHaveLength(1);
  const result = importedSession(
    newSession({ volumes: [], selectedId: null }),
    combined,
  );
  expect(parseSession(serializeSession(result)).project.volumes).toHaveLength(
    1,
  );
});
