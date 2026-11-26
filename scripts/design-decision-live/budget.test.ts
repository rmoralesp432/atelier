import { it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TrialBudget, save, reservation } from './budget';
const body = {
  model: 'gpt-6.1-sol',
  max_output_tokens: 6000,
  input: 'Offline accounting probe',
};
const req = { method: 'POST', body: JSON.stringify(body) };
const scope = { turn: 1, role: 'executor', event: 0 };
const url = 'https://api.openai.com/v1/responses';
function make(transport: any, ceilingUSD = 5, maximumPaidCalls = 60) {
  const dir = mkdtempSync(join(tmpdir(), 'atelier-decision-budget-'));
  save(join(dir, 'ledger.json'), {
    authorized: true,
    ceilingUSD,
    maximumPaidCalls,
    calls: [],
  });
  return new TrialBudget(dir, transport);
}
it('reserves before transmission, reconciles conservative usage and stops at the call limit', async () => {
  let b: TrialBudget;
  let calls = 0;
  b = make(
    async () => {
      calls++;
      expect(b.accounted()).toBeGreaterThan(0);
      return new Response(
        JSON.stringify({
          model: 'gpt-6.1-sol',
          service_tier: 'default',
          usage: { input_tokens: 100, output_tokens: 50 },
          status: 'completed',
        }),
        { status: 200 },
      );
    },
    5,
    1,
  );
  await b.call(scope, url, req);
  expect(b.costs().accountedUSD).toBeCloseTo(0.000875);
  await expect(b.call(scope, url, req)).rejects.toThrow(/limit/);
  expect(calls).toBe(1);
});
it('blocks before sending when the reservation would exceed the dollar ceiling', async () => {
  let calls = 0;
  const b = make(
    async () => {
      calls++;
      return new Response('{}');
    },
    reservation(body) / 2,
  );
  await expect(b.call(scope, url, req)).rejects.toThrow(/limit/);
  expect(calls).toBe(0);
  expect(b.costs().calls).toBe(0);
});
it('retains unknown interrupted usage and stops on unexpected pricing/model evidence', async () => {
  const b = make(async () => {
    throw Error('Connection interrupted');
  });
  await expect(b.call(scope, url, req)).rejects.toThrow('interrupted');
  expect(b.costs().unknownReservations).toHaveLength(1);
  expect(b.accounted()).toBe(reservation(body));
  const c = make(
    async () =>
      new Response(
        JSON.stringify({
          model: 'different-model',
          usage: { input_tokens: 20, output_tokens: 10 },
        }),
      ),
  );
  await expect(c.call(scope, url, req)).rejects.toThrow('Unexpected');
  expect(c.blocked).toContain('Unexpected');
  expect(c.costs().unknownReservations).toHaveLength(1);
});
