import { expect, it } from 'vitest';
import { makeVolume, updateVolume } from '../model';
import { equalData } from './equalData';
import { createSessionEncoder } from './sessionCodec';
import { newSession, parseSession } from '../intelligence/engine';

it('selects, recolors and compares metadata without traversing shared mesh arrays', () => {
  const v = {
    ...makeVolume(),
    geometry: {
      kind: 'mesh' as const,
      source: 'fbx',
      solid: false,
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2],
    },
  };
  const p = { volumes: [v], selectedId: v.id };
  const inaccessible = new Proxy(v.geometry.indices, {
    get() {
      throw new Error('Unchanged triangle data was accessed');
    },
  });
  v.geometry.indices = inaccessible;
  const colored = updateVolume(p, v.id, { color: '#ff0000' });
  expect(colored.volumes[0].geometry).toBe(v.geometry);
  expect(equalData(p, { ...p, volumes: [{ ...v }] })).toBe(true);
  expect(equalData(p, colored)).toBe(false);
  expect(equalData(p, { ...p, selectedId: null })).toBe(false);
  expect(() => updateVolume(p, v.id, { color: 'invalid' })).toThrow();
  expect(() =>
    updateVolume(p, v.id, { geometry: { ...v.geometry } }),
  ).toThrow();
});

it('reuses mesh encoding for edits, but saves replacement geometry and full undo history', () => {
  let reads = 0;
  const indices = Array.from({ length: 150_000 }, (_, i) => i % 3);
  Object.defineProperty(indices, '0', {
    get() {
      reads++;
      return 0;
    },
    enumerable: true,
  });
  const v = {
    ...makeVolume(),
    geometry: {
      kind: 'mesh' as const,
      source: 'fbx',
      solid: false,
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices,
    },
  };
  const session = newSession({ volumes: [v], selectedId: v.id });
  const encode = createSessionEncoder();
  encode(session);
  const firstReads = reads;
  const colored = {
    ...session,
    project: updateVolume(session.project, v.id, { color: '#abcdef' }),
    past: [session.project],
  };
  const saved = encode(colored);
  expect(reads).toBe(firstReads);
  const restored = parseSession(saved);
  expect(restored.project.volumes[0].color).toBe('#abcdef');
  expect(restored.past[0].volumes[0].color).toBeUndefined();
  expect(restored.project.volumes[0].geometry).toBe(
    restored.past[0].volumes[0].geometry,
  );
  const replacement = {
    ...v.geometry,
    positions: [0, 0, 0, 0.5, 0, 0, 0, 1, 0],
  };
  const changed = {
    ...colored,
    project: {
      ...colored.project,
      volumes: [{ ...colored.project.volumes[0], geometry: replacement }],
    },
  };
  expect(parseSession(encode(changed)).project.volumes[0].geometry).toEqual(
    replacement,
  );
});
