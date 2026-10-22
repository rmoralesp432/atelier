import { expect, it } from 'vitest';
import {
  Box3,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
} from 'three';
import { createARModel, disposeARModel, exportARModel } from './model';
import { clipAbove, prepareARPart, AR_TRIANGLE_LIMIT } from './preparation';
import type { Project, Volume } from '../model';
import { importedARChunks, AR_INPUT_CHUNK_TRIANGLES } from './meshChunks';

const box = (id: string, y: number, height: number): Volume => ({
  id,
  name: id,
  dimensions: { width: 8, depth: 4, height },
  position: { x: 12, y, z: -6 },
  rotation: 45,
  color: '#aa3322',
});
it('streams imported faces in bounded owned buffers without detaching or changing canonical arrays', () => {
  const count = AR_INPUT_CHUNK_TRIANGLES + 5;
  const indices = Array.from({ length: count * 3 }, (_, i) => i % 3);
  const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
  const v: Volume = {
    ...box('imported', 0, 4),
    geometry: {
      kind: 'mesh',
      positions,
      indices,
      solid: false,
      source: 'chunk-fixture.obj',
    },
  };
  let faces = 0,
    pieces = 0;
  for (const chunk of importedARChunks(v)) {
    faces += chunk.indices.length / 3;
    pieces++;
    expect(chunk.indices.length / 3).toBeLessThanOrEqual(
      AR_INPUT_CHUNK_TRIANGLES,
    );
    expect(chunk.positions.buffer.byteLength).toBeLessThanOrEqual(
      AR_INPUT_CHUNK_TRIANGLES * 9 * 4,
    );
    // Worker transfer detaches only this fresh AR buffer.
    structuredClone(chunk, {
      transfer: [chunk.positions.buffer, chunk.indices.buffer],
    });
    expect(positions).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(indices.length).toBe(count * 3);
  }
  expect(faces).toBe(count);
  expect(pieces).toBe(2);
});
it('cuts actual floor geometry, puts the chosen level at zero and preserves source/undo objects', async () => {
  const project: Project = {
    selectedId: 'upper',
    volumes: [box('legs', 0, 1), box('lower', 1, 3), box('upper', 4, 4)],
  };
  const original = JSON.stringify(project);
  const copy = await createARModel(project, undefined, { floorLevel: 4 });
  expect(copy.children.map((c) => c.userData.id)).toEqual(['lower', 'upper']); // Lower slab's exact top surface remains at zero.
  const b = new Box3().setFromObject(copy);
  expect(b.min.y).toBe(0);
  expect(b.max.y).toBe(4);
  copy.updateMatrixWorld(true);
  copy.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++)
      expect(
        new Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).y,
      ).toBeGreaterThanOrEqual(-1e-6);
    expect((o.material as MeshStandardMaterial).color.getHexString()).toBe(
      'aa3322',
    );
  });
  expect(new TextDecoder().decode(await exportARModel(copy, 1))).toContain(
    'metersPerUnit = 1',
  );
  expect(JSON.stringify(project)).toBe(original);
  const whole = await createARModel(project);
  expect(new Box3().setFromObject(whole).min.y).toBe(0);
  expect(new Box3().setFromObject(whole).max.y).toBe(8);
  expect(whole.children).toHaveLength(3);
  disposeARModel(copy);
  disposeARModel(whole);
});
it('clips intersecting triangles at the exact plane, including open imported meshes', () => {
  const data = clipAbove(
    {
      positions: new Float32Array([0, 0, 0, 2, 2, 0, 0, 2, 0]),
      indices: new Uint32Array([0, 1, 2]),
    },
    1,
  );
  expect(data.indices.length).toBe(6);
  const ys = [...data.positions].filter((_, i) => i % 3 === 1);
  expect(Math.min(...ys)).toBe(1);
  expect(Math.max(...ys)).toBe(2);
  expect(clipAbove(data, 3).indices.length).toBe(0);
});
it('reduces dense AR geometry within budget while retaining the full source, dimensions and border', async () => {
  const g = new PlaneGeometry(20, 12, 400, 400);
  const positions = new Float32Array(g.attributes.position.array);
  const indices = new Uint32Array(g.index!.array);
  const result = await prepareARPart({ positions, indices, target: 50000 });
  expect(indices.length / 3).toBe(320000);
  expect(result.indices.length / 3).toBeLessThanOrEqual(50000);
  for (const axis of [0, 1]) {
    let min = Infinity,
      max = -Infinity;
    for (let i = axis; i < result.positions.length; i += 3) {
      min = Math.min(min, result.positions[i]);
      max = Math.max(max, result.positions[i]);
    }
    expect(max - min).toBe(axis === 0 ? 20 : 12);
  }
  g.dispose();
});
it('rejects irreducible meshes before oversized export rather than dropping objects or faces', async () => {
  // Disconnected open triangles cannot simplify with border protection.
  const count = AR_TRIANGLE_LIMIT + 1;
  const p = new Float32Array(count * 9),
    indices = new Uint32Array(count * 3);
  for (let i = 0; i < count; i++) {
    p.set([i * 2, 0, 0, i * 2 + 1, 0, 0, i * 2, 1, 0], i * 9);
    indices.set([i * 3, i * 3 + 1, i * 3 + 2], i * 3);
  }
  await expect(
    prepareARPart({ positions: p, indices, target: 50000 }),
  ).rejects.toThrow('still too detailed');
  expect(indices.length).toBe(count * 3);
});
it('supports selected-only scope and rejects empty/invalid cuts and cancellation without mutation', async () => {
  const p: Project = {
    selectedId: 'upper',
    volumes: [box('lower', 0, 3), box('upper', 3, 3)],
  };
  const only = await createARModel(p, undefined, { selectedOnly: true });
  expect(only.children.map((o) => o.userData.id)).toEqual(['upper']);
  disposeARModel(only);
  await expect(createARModel(p, undefined, { floorLevel: 10 })).rejects.toThrow(
    'Nothing remains',
  );
  await expect(
    createARModel(p, undefined, { floorLevel: NaN }),
  ).rejects.toThrow('floor');
  const controller = new AbortController();
  controller.abort();
  await expect(
    createARModel(p, undefined, { signal: controller.signal }),
  ).rejects.toThrow();
  expect(p.volumes).toHaveLength(2);
});
