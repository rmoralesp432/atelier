import { expect, it } from 'vitest';
import { makeVolume } from '../model';
import {
  newSession,
  parseSession,
  serializeSession,
} from '../intelligence/engine';
import type { MeshRecipe } from '../imports/mesh';

it('stores large mesh geometry once across fifty undo states and reopens version 2 and 3 sessions', () => {
  const geometry: MeshRecipe = {
    kind: 'mesh',
    source: 'obj',
    solid: false,
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    indices: Array.from({ length: 360_000 }, (_, i) => i % 3),
  };
  const volume = { ...makeVolume(), geometry };
  const project = { volumes: [volume], selectedId: volume.id };
  const session = {
    ...newSession(project),
    past: Array.from({ length: 50 }, (_, i) => ({
      ...project,
      volumes: [{ ...volume, rotation: i }],
    })),
  };
  const encoded = serializeSession(session);
  expect(JSON.parse(encoded).version).toBe(3);
  expect(JSON.parse(encoded).meshes).toHaveLength(1);
  expect(encoded.length).toBeLessThan(800_000);
  const restored = parseSession(encoded);
  expect(restored.context).toEqual(session.context);
  expect(restored.project).toEqual(project);
  expect(restored.future).toEqual([]);
  expect(restored.past.map((p) => p.volumes[0].rotation)).toEqual(
    Array.from({ length: 50 }, (_, i) => i),
  );
  expect(
    restored.past.every(
      (p) => p.volumes[0].geometry === restored.project.volumes[0].geometry,
    ),
  ).toBe(true);
  expect(restored.project.volumes[0].geometry).toBe(
    restored.past[49].volumes[0].geometry,
  );
  expect(
    parseSession(JSON.stringify({ version: 2, ...newSession(project) }))
      .project,
  ).toEqual(project);
  expect(
    JSON.parse(
      serializeSession(
        newSession({ volumes: [makeVolume()], selectedId: null }),
      ),
    ).version,
  ).toBe(2);
});

it('rejects missing, malformed and corrupt mesh references rather than restoring partial history', () => {
  const sample = {
    version: 3,
    meshes: [],
    project: { volumes: [{ geometry: { $mesh: 3 } }] },
    past: [],
    future: [],
  };
  expect(() => parseSession(JSON.stringify(sample))).toThrow('mesh reference');
  expect(() =>
    parseSession(JSON.stringify({ ...sample, meshes: [{}] })),
  ).toThrow('mesh');
  expect(() =>
    parseSession(JSON.stringify({ ...sample, meshes: undefined })),
  ).toThrow('mesh library');
});
