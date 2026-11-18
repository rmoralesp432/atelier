import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  budgetUsed,
  ceilingUsd,
  meteredFetch,
  model,
  reservation,
  save,
  type Ledger,
} from './budget';

const body = {
  model,
  max_output_tokens: 6000,
  input: 'Synthetic evaluation request',
};
const url = 'https://api.openai.com/v1/responses';
const scope = () => ({ caseId: 'test', role: 'executor' as const });
const init = () => ({ method: 'POST', body: JSON.stringify(body) });
const read = (path: string): Ledger => JSON.parse(readFileSync(path, 'utf8'));
function ledger(authorized = false) {
  const dir = mkdtempSync(join(tmpdir(), 'atelier-completion-budget-')),
    path = join(dir, 'ledger.json');
  save(path, { authorized, ceilingUsd, calls: [] });
  return { dir, path };
}
test('no authorization, insufficient headroom, and pending charges all stop before network', async () => {
  const { dir, path } = ledger();
  let calls = 0;
  const send: typeof fetch = async () => {
    calls++;
    throw new Error('must not send');
  };
  const run = meteredFetch(path, scope, send);
  try {
    await assert.rejects(run(url, init()), /approval/);
    save(path, {
      authorized: true,
      ceilingUsd,
      calls: [
        {
          ...scope(),
          reservedUsd: 2.99,
          chargedUsd: 2.99,
          started: '',
          outcome: 'usage-reconciled',
        },
      ],
    });
    await assert.rejects(run(url, init()), /ceiling/);
    save(path, {
      authorized: true,
      ceilingUsd,
      calls: [{ ...scope(), reservedUsd: 0.2, started: '' }],
    });
    await assert.rejects(run(url, init()), /unresolved prior charge/);
    assert.equal(calls, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
test('reserves before sending, forces default tier, records actual usage and separate budget margin', async () => {
  const { dir, path } = ledger(true);
  try {
    const run = meteredFetch(path, scope, async (_url, args) => {
      const pending = read(path);
      assert.equal(pending.calls.length, 1);
      assert.equal(pending.calls[0].outcome, undefined);
      assert.equal(JSON.parse(args!.body as string).service_tier, 'default');
      assert(budgetUsed(pending) <= ceilingUsd);
      return Response.json({
        model,
        service_tier: 'default',
        usage: { input_tokens: 1000, output_tokens: 2000 },
      });
    });
    await run(url, init());
    const c = read(path).calls[0];
    assert(Math.abs(c.estimatedUsd! - 0.022) < 1e-10);
    assert(Math.abs(c.chargedUsd! - 0.0275) < 1e-10);
    assert(c.reservedUsd > c.chargedUsd!);
    assert.equal(c.outcome, 'usage-reconciled');
  } finally {
    rmSync(dir, { recursive: true });
  }
});
test('unknown provider usage retains the reservation and blocks another request', async () => {
  const { dir, path } = ledger(true);
  let calls = 0;
  try {
    const run = meteredFetch(path, scope, async () => {
      calls++;
      return Response.json({ status: 'completed', model });
    });
    await assert.rejects(run(url, init()), /unknown billing/);
    const l = read(path);
    assert.equal(budgetUsed(l), l.calls[0].reservedUsd);
    await assert.rejects(run(url, init()), /unresolved/);
    assert.equal(calls, 1);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
test('token, image, endpoint and per-turn limits cannot silently enlarge the budget', async () => {
  assert.throws(() => reservation({ ...body, max_output_tokens: 6001 }));
  assert.throws(() =>
    reservation({
      ...body,
      input: [{ image_url: 'https://example.com/unbounded.png' }],
    }),
  );
  assert.throws(() =>
    reservation({
      ...body,
      input: Array(3).fill({ image_url: 'data:image/jpeg;base64,eA==' }),
    }),
  );
  assert(
    reservation({
      ...body,
      schema: { $schema: 'https://json-schema.org/draft/2020-12/schema' },
    }) > 0,
  );
  const { dir, path } = ledger(true);
  let calls = 0;
  try {
    save(path, {
      authorized: true,
      ceilingUsd,
      calls: Array.from({ length: 8 }, () => ({
        ...scope(),
        reservedUsd: 0.01,
        chargedUsd: 0.01,
        started: '',
        outcome: 'usage-reconciled',
      })),
    });
    const run = meteredFetch(path, scope, async () => {
      calls++;
      throw new Error();
    });
    await assert.rejects(run(url, init()), /call limit/);
    await assert.rejects(
      run('https://api.openai.com/v1/audio/speech', init()),
      /endpoint/,
    );
    assert.equal(calls, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
