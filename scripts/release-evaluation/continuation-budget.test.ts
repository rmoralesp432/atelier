import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { model, save, type Ledger } from '../completion-evaluation/budget';
import { continuationFetch, digest } from './continuation-budget';

const scope = () => ({ caseId: 'building', role: 'executor' as const });
const request = {
  method: 'POST',
  body: JSON.stringify({
    model,
    max_output_tokens: 6000,
    input: 'Offline budget check',
  }),
};
const url = 'https://api.openai.com/v1/responses';
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'atelier-continuation-')),
    prior = join(dir, 'prior.json'),
    next = join(dir, 'next.json');
  save(prior, {
    authorized: true,
    ceilingUsd: 5,
    calls: [
      {
        ...scope(),
        reservedUsd: 0.613085,
        started: 'prior',
        outcome: 'interrupted-reservation-retained',
      },
    ],
  });
  save(next, { authorized: true, ceilingUsd: 5, calls: [] });
  return {
    dir,
    prior,
    next,
    carry: {
      authorized: true,
      actualUsage: 'unknown' as const,
      allowanceUsd: 0.62,
      maximumAdditionalUsd: 4.38,
      originalLedgerPath: prior,
      originalLedgerSha256: digest(prior),
    },
  };
}
test('continuation retains unknown original usage and reconciles only new usage', async () => {
  const s = setup(),
    raw = readFileSync(s.prior, 'utf8');
  try {
    const run = continuationFetch(s.next, s.carry, scope, async () =>
      Response.json({
        model,
        service_tier: 'default',
        usage: { input_tokens: 1000, output_tokens: 1000 },
      }),
    );
    await run(url, request);
    assert.equal(readFileSync(s.prior, 'utf8'), raw);
    const ledger: Ledger = JSON.parse(readFileSync(s.next, 'utf8'));
    assert.equal(ledger.calls[0].outcome, 'usage-reconciled');
    assert.equal(ledger.calls[0].estimatedUsd, 0.012);
    await assert.rejects(
      continuationFetch(
        s.next,
        { ...s.carry, authorized: false },
        scope,
      )(url, request),
      /authorization/,
    );
  } finally {
    rmSync(s.dir, { recursive: true });
  }
});
test('both caps, old request counts and original integrity are enforced before sending', async () => {
  const s = setup();
  let sent = 0;
  const run = continuationFetch(s.next, s.carry, scope, async () => {
    sent++;
    throw new Error('must not send');
  });
  const call = {
    ...scope(),
    reservedUsd: 0.01,
    chargedUsd: 0.01,
    started: 'new',
    outcome: 'usage-reconciled',
  };
  try {
    save(s.next, {
      authorized: true,
      ceilingUsd: 5,
      calls: [{ ...call, chargedUsd: 4.3 }],
    });
    await assert.rejects(run(url, request), /4.38 ceiling/);
    save(s.next, {
      authorized: true,
      ceilingUsd: 5,
      calls: Array(7).fill(call),
    });
    await assert.rejects(run(url, request), /per-task/);
    save(s.next, {
      authorized: true,
      ceilingUsd: 5,
      calls: Array.from({ length: 31 }, (_, i) => ({
        ...call,
        caseId: `task-${i}`,
      })),
    });
    await assert.rejects(run(url, request), /Combined request/);
    save(s.next, { authorized: true, ceilingUsd: 5, calls: [] });
    save(s.prior, { authorized: true, ceilingUsd: 5, calls: [] });
    await assert.rejects(run(url, request), /accounting changed/);
    assert.equal(sent, 0);
  } finally {
    rmSync(s.dir, { recursive: true });
  }
});
test('unknown usage on a new call still blocks continuation', async () => {
  const s = setup();
  let sent = 0;
  try {
    const run = continuationFetch(s.next, s.carry, scope, async () => {
      sent++;
      return Response.json({ model, status: 'completed' });
    });
    await assert.rejects(run(url, request), /unknown billing/);
    await assert.rejects(run(url, request), /unresolved prior charge/);
    assert.equal(sent, 1);
  } finally {
    rmSync(s.dir, { recursive: true });
  }
});
