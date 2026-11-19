import { it, expect, vi } from 'vitest';
import { checkedPlan } from './checkedPlanner';
import { directPlan, newSession } from './engine';
import { defaultCamera } from './context';
import { makeVolume } from '../model';
it('repairs a failed multi-step transaction against the original scene without partial edits', async () => {
  const v = makeVolume(),
    s = newSession({ volumes: [v], selectedId: v.id }),
    before = structuredClone(s);
  const request = vi
    .fn()
    .mockResolvedValueOnce(
      directPlan({
        type: 'hollow',
        target: v.id,
        thickness: 100,
        openTop: true,
      }),
    )
    .mockResolvedValueOnce(
      directPlan({
        type: 'hollow',
        target: v.id,
        thickness: 0.2,
        openTop: true,
      }),
    );
  const plan = await checkedPlan(s, defaultCamera, request);
  expect(plan.operations[0]).toMatchObject({ thickness: 0.2 });
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[1][0].error).toContain('interior');
  expect(s).toEqual(before);
});
it('never retries a billing or provider failure and bounds invalid-geometry attempts', async () => {
  const s = newSession({ volumes: [], selectedId: null });
  const failed = vi
    .fn()
    .mockRejectedValue(new Error('API credits unavailable'));
  await expect(checkedPlan(s, defaultCamera, failed)).rejects.toThrow(
    'credits',
  );
  expect(failed).toHaveBeenCalledTimes(1);
  const invalid = vi.fn().mockResolvedValue(
    directPlan({
      type: 'hollow',
      target: 'missing',
      thickness: 1,
      openTop: true,
    }),
  );
  await expect(checkedPlan(s, defaultCamera, invalid)).rejects.toThrow(
    'no longer',
  );
  expect(invalid).toHaveBeenCalledTimes(2);
});
it('accepts a clarification after a failed geometry proposal', async () => {
  const s = newSession({ volumes: [], selectedId: null });
  const request = vi
    .fn()
    .mockResolvedValueOnce(
      directPlan({
        type: 'hollow',
        target: 'missing',
        thickness: 1,
        openTop: true,
      }),
    )
    .mockResolvedValueOnce({
      intent: 'clarify',
      message: 'Which building should I hollow?',
      operations: [],
    });
  expect((await checkedPlan(s, defaultCamera, request)).intent).toBe('clarify');
});
