import { afterEach, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { startAR } from './webxr';
afterEach(() => vi.unstubAllGlobals());
it('reports unsupported camera AR without asking for access', async () => {
  vi.stubGlobal('navigator', {});
  await expect(
    startAR(
      new Group(),
      {} as HTMLElement,
      1,
      () => {},
      () => {},
    ),
  ).rejects.toThrow('does not support');
});
it('requests actual surface hit testing and propagates denied camera/session access', async () => {
  const requestSession = vi
    .fn()
    .mockRejectedValue(new Error('Permission denied'));
  vi.stubGlobal('navigator', { xr: { requestSession } });
  const overlay = {} as HTMLElement;
  await expect(
    startAR(
      new Group(),
      overlay,
      1,
      () => {},
      () => {},
    ),
  ).rejects.toThrow('Permission denied');
  expect(requestSession).toHaveBeenCalledWith('immersive-ar', {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: overlay },
  });
});
it('ends a session that arrives after the panel was closed', async () => {
  let resolve!: (s: { end: () => Promise<void> }) => void;
  vi.stubGlobal('navigator', {
    xr: {
      requestSession: () =>
        new Promise((r) => {
          resolve = r;
        }),
    },
  });
  const abort = new AbortController(),
    end = vi.fn().mockResolvedValue(undefined);
  const pending = startAR(
    new Group(),
    {} as HTMLElement,
    1,
    () => {},
    () => {},
    abort.signal,
  );
  abort.abort();
  resolve({ end });
  await expect(pending).rejects.toThrow('closed');
  expect(end).toHaveBeenCalledOnce();
});
