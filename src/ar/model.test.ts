import { it, expect } from 'vitest';
import { Box3, Vector3 } from 'three';
import { createARModel, disposeARModel, exportARModel } from './model';
import type { Project } from '../model';
it('exports a genuine meter-based USDZ snapshot without mutating or including hidden geometry', async () => {
  const p: Project = {
    selectedId: null,
    groups: [{ id: 'hidden', name: 'Hidden', visible: false, locked: false }],
    volumes: [
      {
        id: 'box',
        name: 'Raised box',
        dimensions: { width: 8, depth: 4, height: 3 },
        position: { x: 100, y: 4, z: 80 },
        rotation: 0,
      },
      {
        id: 'hidden',
        name: 'Hidden',
        groupId: 'hidden',
        dimensions: { width: 50, depth: 50, height: 50 },
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
      },
    ],
  };
  const original = JSON.stringify(p),
    model = await createARModel(p),
    b = new Box3().setFromObject(model);
  expect(model.children).toHaveLength(1);
  expect(b.getSize(new Vector3()).toArray()).toEqual([8, 3, 4]);
  expect(b.min.y).toBe(4);
  expect(b.getCenter(new Vector3()).x).toBe(0);
  const usdz = await exportARModel(model, 0.01);
  expect(Array.from(usdz.slice(0, 4))).toEqual([80, 75, 3, 4]);
  const text = new TextDecoder().decode(usdz);
  expect(text).toContain('metersPerUnit = 1');
  expect(text).toContain('0.01');
  const oriented = new TextDecoder().decode(
    await exportARModel(model, 0.04, 90),
  );
  const matrices = [
    ...oriented.matchAll(/matrix4d xformOp:transform = \(([^\n]+)\)/g),
  ].map((match) => match[1].replace(/[()]/g, '').split(',').map(Number));
  const rotationMatrix = matrices.find(
    (m) => Math.abs(m[2] + 0.04) < 1e-6 && Math.abs(m[8] - 0.04) < 1e-6,
  );
  expect(rotationMatrix).toBeDefined();
  expect(rotationMatrix![0]).toBeCloseTo(0);
  expect(rotationMatrix![5]).toBeCloseTo(0.04);
  expect(model.rotation.y).toBe(0);
  expect(model.scale.x).toBe(1);
  expect(JSON.stringify(p)).toBe(original);
  disposeARModel(model);
});
it('reports an empty AR scene and rejects unsupported scale', async () => {
  await expect(
    createARModel({ volumes: [], selectedId: null }),
  ).rejects.toThrow('3D object');
  const model = await createARModel({
    volumes: [
      {
        id: 'b',
        name: 'B',
        dimensions: { width: 1, depth: 1, height: 1 },
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
      },
    ],
    selectedId: null,
  });
  await expect(exportARModel(model, 0)).rejects.toThrow('scale');
  for (const height of [NaN, Infinity, -Infinity, -1001, 1001])
    await expect(exportARModel(model, 1, 0, false, height)).rejects.toThrow(
      'height',
    );
  disposeARModel(model);
});
it.each([
  [1, -1.5],
  [0.01, -1.5],
  [1, 2],
])(
  'exports height at ratio %s with offset %s without resizing or editing the project',
  async (scale, offset) => {
    const project: Project = {
      selectedId: 'floor',
      volumes: [
        {
          id: 'floor',
          name: 'Raised floor',
          dimensions: { width: 20, depth: 10, height: 0.3 },
          position: { x: 0, y: 1.2, z: 0 },
          rotation: 0,
        },
      ],
    };
    const before = JSON.stringify(project);
    const model = await createARModel(project);
    const bounds = new Box3().setFromObject(model);
    const usdz = new TextDecoder().decode(
      await exportARModel(model, scale, 90, false, offset),
    );
    const matrices = [
      ...usdz.matchAll(/matrix4d xformOp:transform = \(([^\n]+)\)/g),
    ].map((match) => match[1].replace(/[()]/g, '').split(',').map(Number));
    const root = matrices.find(
      (m) => Math.abs(m[2] + scale) < 1e-6 && Math.abs(m[8] - scale) < 1e-6,
    )!;
    expect(root).toBeDefined();
    expect(root[5]).toBeCloseTo(scale);
    expect(root[12]).toBe(0);
    expect(root[13]).toBeCloseTo(offset * scale);
    expect(root[14]).toBe(0);
    expect(usdz).toContain('metersPerUnit = 1');
    expect(model.position.y).toBe(0);
    expect(model.scale.x).toBe(1);
    expect(new Box3().setFromObject(model).equals(bounds)).toBe(true);
    expect(JSON.stringify(project)).toBe(before);
    disposeARModel(model);
  },
);
it('keeps the initial project origin during live AR edits so existing objects do not jump', async () => {
  const p: Project = {
    selectedId: null,
    volumes: [
      {
        id: 'a',
        name: 'A',
        dimensions: { width: 10, depth: 4, height: 3 },
        position: { x: 100, y: 0, z: 80 },
        rotation: 0,
      },
    ],
  };
  const first = await createARModel(p);
  const updated = await createARModel(
    {
      ...p,
      volumes: [
        ...p.volumes,
        {
          ...p.volumes[0],
          id: 'b',
          name: 'B',
          position: { x: 150, y: 0, z: 80 },
        },
      ],
    },
    first.userData.origin,
  );
  expect(updated.children[0].position.toArray()).toEqual(
    first.children[0].position.toArray(),
  );
  expect(updated.children[1].position.x - updated.children[0].position.x).toBe(
    50,
  );
  disposeARModel(first);
  disposeARModel(updated);
});
