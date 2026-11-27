import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  meteredFetch,
  save,
  budgetUsed,
  reservation,
} from '../completion-evaluation/budget';

test('Phase 3 $15 aggregate cap, reservations, both roles, and unresolved calls', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'phase3-budget-')),
    path = join(dir, 'ledger.json');
  const body = {
    model: 'gpt-6.1-sol',
    max_output_tokens: 6000,
    input: 'Offline budget fixture',
  };
  const init = { method: 'POST', body: JSON.stringify(body) };
  let role: 'executor' | 'reviewer' = 'executor',
    sends = 0;
  const read = () => JSON.parse(readFileSync(path, 'utf8'));
  try {
    save(path, { ceilingUsd: 15, authorized: true, calls: [] });
    const run = meteredFetch(
      path,
      () => ({ caseId: 'offline', role }),
      async () => {
        sends++;
        assert(read().calls.at(-1).reservedUsd > 0);
        return Response.json({
          model: 'gpt-6.1-sol',
          service_tier: 'default',
          usage: { input_tokens: 1000, output_tokens: 500 },
        });
      },
      { ceilingUsd: 15, maximumCalls: 60, maximumCallsPerTask: 16 },
    );
    await run('https://api.openai.com/v1/responses', init);
    role = 'reviewer';
    await run('https://api.openai.com/v1/responses', init);
    assert.deepEqual(
      read().calls.map((c: any) => c.role),
      ['executor', 'reviewer'],
    );
    assert(budgetUsed(read()) > 0);
    const l = read();
    l.calls.push({
      caseId: 'prior',
      role: 'executor',
      chargedUsd: 15 - budgetUsed(l) - reservation(body) + 0.001,
      outcome: 'usage-reconciled',
    });
    save(path, l);
    await assert.rejects(
      run('https://api.openai.com/v1/responses', init),
      /ceiling/,
    );
    assert.equal(sends, 2);
    save(path, {
      ceilingUsd: 15,
      authorized: true,
      calls: [
        {
          caseId: 'unknown',
          role: 'reviewer',
          reservedUsd: 0.4,
          outcome: 'interrupted-reservation-retained',
        },
      ],
    });
    await assert.rejects(
      run('https://api.openai.com/v1/responses', init),
      /unresolved/,
    );
    assert.equal(sends, 2);
    assert.equal(budgetUsed(read()), 0.4);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
