import { sampleGlb } from '../../tests/fixtures/mesh';
import {
  sceneContext,
  defaultCamera,
  emptyContext,
} from '../intelligence/context';
import { requestSchema } from '../../server/provider';
import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { parseMeshAsset, prepareMesh, isReference } from './mesh';
import { solidStats, booleanVolume, renderMeshData } from '../geometry/kernel';
import { makeVolume, parseProject, serializeProject } from '../model';
import {
  applyPlan,
  directPlan,
  newSession,
  parseSession,
  serializeSession,
} from '../intelligence/engine';
const buffer = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;
function cube() {
  const m = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 4));
  m.position.set(5, 1.5, -7);
  m.updateMatrixWorld();
  return m;
}
it('imports OBJ geometry as a measured closed solid and performs a real cut', async () => {
  const asset = await parseMeshAsset(
    'Chair base.OBJ',
    buffer(new OBJExporter().parse(cube())),
  );
  const v = await prepareMesh(asset, { units: 'm', up: 'Y' });
  expect(v.dimensions).toEqual({ width: 2, height: 3, depth: 4 });
  expect(isReference(v)).toBe(false);
  expect((await solidStats(v)).volume).toBeCloseTo(24);
  const cutter = makeVolume(2, { width: 1, height: 3, depth: 4 });
  const result = await booleanVolume(v, cutter, 'subtract');
  expect((await solidStats(result)).volume).toBeCloseTo(12);
  expect(
    parseProject(serializeProject({ volumes: [v], selectedId: v.id }))
      .volumes[0],
  ).toEqual(v);
});
it('imports binary and ASCII STL with explicit units and axis conversion', async () => {
  const exporter = new STLExporter();
  for (const bytes of [
    buffer(exporter.parse(cube())),
    exporter.parse(cube(), { binary: true }).buffer as ArrayBuffer,
  ]) {
    const asset = await parseMeshAsset('element.stl', bytes),
      v = await prepareMesh(asset, { units: 'cm', up: 'Z' });
    expect(v.dimensions.width).toBeCloseTo(0.02);
    expect(v.dimensions.height).toBeCloseTo(0.04);
    expect(v.dimensions.depth).toBeCloseTo(0.03);
    expect((await solidStats(v)).volume).toBeCloseTo(0.000024, 8);
  }
});
it('imports embedded GLB geometry with node transforms and mirrored winding, without network access', async () => {
  const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    throw new Error('Unexpected network request');
  });
  try {
    const v = await prepareMesh(
      await parseMeshAsset('mirrored.glb', sampleGlb()),
      { units: 'm', up: 'Y' },
    );
    expect((await solidStats(v)).volume).toBeCloseTo(24);
    expect(v.dimensions).toEqual({ width: 2, height: 3, depth: 4 });
    await expect(
      parseMeshAsset('external.glb', sampleGlb(true)),
    ).rejects.toThrow('self-contained');
    expect(network).not.toHaveBeenCalled();
  } finally {
    network.mockRestore();
  }
});
it('keeps open OBJ surfaces visible and transformable without inventing a solid volume', async () => {
  const v = await prepareMesh(
    await parseMeshAsset(
      'panel.obj',
      buffer('v 0 0 0\nv 2 0 0\nv 0 3 0\nf 1 2 3\n'),
    ),
    { units: 'm', up: 'Y' },
  );
  expect(isReference(v)).toBe(true);
  const scene = sceneContext(
    { volumes: [v], selectedId: v.id },
    emptyContext(),
    defaultCamera,
  );
  expect(scene.objects[0].spatial.reference).toBe(true);
  expect(JSON.stringify(scene)).not.toContain('indices');
  expect(JSON.stringify(scene)).not.toContain('positions');
  expect(
    requestSchema.safeParse({
      message: 'Move this to the right',
      history: [],
      scene,
    }).success,
  ).toBe(true);
  expect((await renderMeshData(v))[0].indices.length).toBe(3);
  await expect(solidStats(v)).rejects.toThrow('reference mesh');
  let s = newSession({ volumes: [v], selectedId: v.id });
  s = (
    await applyPlan(
      s,
      directPlan({
        type: 'move',
        targets: ['$selected'],
        direction: 'right',
        distance: 2,
      }),
    )
  ).session;
  expect(s.project.volumes[0].position.x).toBe(2);
  expect(
    (
      await applyPlan(
        s,
        directPlan({
          type: 'measure',
          targets: ['$selected'],
          metric: 'properties',
        }),
      )
    ).message,
  ).toContain('solid volume is unavailable');
  const saved = parseSession(serializeSession(s));
  expect(saved).toEqual(s);
  expect(
    (await applyPlan(saved, directPlan({ type: 'undo', count: 1 }))).session
      .project.volumes[0].position.x,
  ).toBe(0);
});

it('does not silently drop GLB instances or load texture URLs', async () => {
  await expect(
    parseMeshAsset(
      'instances.glb',
      sampleGlb(false, (json) => {
        json.nodes[0].extensions = {
          EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: 0 } },
        };
      }),
    ),
  ).rejects.toThrow('extension-dependent');
  const network = vi
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('Unexpected request'));
  try {
    const asset = await parseMeshAsset(
      'textured.glb',
      sampleGlb(false, (json) => {
        json.images = [{ uri: 'https://example.invalid/texture.png' }];
        json.textures = [{ source: 0 }];
        json.materials = [
          { pbrMetallicRoughness: { baseColorTexture: { index: 0 } } },
        ];
        json.meshes[0].primitives[0].material = 0;
      }),
    );
    expect(asset.indices).toHaveLength(36);
    expect(network).not.toHaveBeenCalled();
  } finally {
    network.mockRestore();
  }
});
it('rejects malformed, oversized and empty geometry before it reaches the project', async () => {
  for (const [name, bytes] of [
    ['broken.obj', buffer('v NaN 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3')],
    ['empty.obj', buffer('# no triangles')],
    ['wrong.glb', new ArrayBuffer(20)],
    ['huge.obj', new ArrayBuffer(10_000_001)],
  ] as const)
    await expect(parseMeshAsset(name, bytes)).rejects.toThrow();
  const asset = await parseMeshAsset(
    'cube.obj',
    buffer(new OBJExporter().parse(cube())),
  );
  asset.positions = asset.positions.map((n) => n * 1000);
  await expect(prepareMesh(asset, { units: 'm', up: 'Y' })).rejects.toThrow(
    'units',
  );
});
