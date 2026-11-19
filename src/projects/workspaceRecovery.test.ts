import { afterEach, expect, it, vi } from 'vitest';
import { readRecovery, writeRecovery } from './workspaceRecovery';
const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    clear: () => values.clear(),
  };
};
afterEach(() => vi.unstubAllGlobals());
it('keeps interruption recovery when localStorage is full and isolates projects', () => {
  const tab = storage();
  vi.stubGlobal('sessionStorage', tab);
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw Error('blocked');
    },
    setItem: () => {
      throw Error('full');
    },
  });
  writeRecovery('a', { interrupted: true });
  expect(readRecovery('a').interrupted).toBe(true);
  expect(readRecovery('b').interrupted).toBe(false);
  writeRecovery('a', { interrupted: false });
  expect(readRecovery('a').interrupted).toBe(false);
});
it('validates recovered camera data and retains the last pose across tab-state loss', () => {
  const tab = storage(),
    durable = storage();
  vi.stubGlobal('sessionStorage', tab);
  vi.stubGlobal('localStorage', durable);
  const pose = {
    position: { x: 4, y: 5, z: 7 },
    target: { x: 0, y: 1, z: 0 },
    projection: 'perspective' as const,
    zoom: 1,
    fov: 45,
  };
  writeRecovery('a', { pose, interrupted: true });
  tab.clear();
  expect(readRecovery('a')).toEqual({ pose, interrupted: false });
  tab.setItem(
    'atelier.workspace-recovery:a',
    '{"pose":{"zoom":-1},"interrupted":true}',
  );
  expect(readRecovery('a')).toEqual({ interrupted: true });
});
