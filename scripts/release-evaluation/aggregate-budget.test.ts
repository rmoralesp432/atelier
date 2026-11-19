import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { model, save } from '../completion-evaluation/budget';
import { digest } from './continuation-budget';
import {
  aggregateFetch,
  priorAccounting,
  type AggregateAuthorization,
} from './aggregate-budget';

test('US$20 is aggregate: prior estimates, unknown allowance, margins and all calls survive', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'atelier-release20-'));
  const old = join(dir, 'old.json'),
    settled = join(dir, 'settled.json'),
    path = join(dir, 'new.json');
  const scope = { caseId: 'building', role: 'executor' as const };
  const known = {
    ...scope,
    reservedUsd: 1,
    estimatedUsd: 0.8,
    chargedUsd: 1,
    started: '',
    outcome: 'usage-reconciled',
  };
  save(old, {
    ceilingUsd: 5,
    authorized: true,
    calls: [
      {
        ...scope,
        reservedUsd: 0.613085,
        started: '',
        outcome: 'interrupted-reservation-retained',
      },
    ],
  });
  save(settled, { ceilingUsd: 5, authorized: true, calls: [known] });
  save(path, { ceilingUsd: 20, authorized: true, calls: [] });
  const authorization: AggregateAuthorization = {
    approved: true,
    ceilingUsd: 20,
    unknownAllowanceUsd: 0.62,
    unknownLedger: { path: old, sha256: digest(old) },
    settledLedgers: [{ path: settled, sha256: digest(settled) }],
    maximumCalls: 60,
    maximumCallsPerTask: 16,
  };
  const raw = readFileSync(old, 'utf8');
  const init = {
    method: 'POST',
    body: JSON.stringify({
      model,
      input: 'Offline test',
      max_output_tokens: 6000,
    }),
  };
  let sent = 0;
  const run = aggregateFetch(
    path,
    authorization,
    () => scope,
    async () => {
      sent++;
      return Response.json({
        model,
        service_tier: 'default',
        usage: { input_tokens: 1000, output_tokens: 1000 },
      });
    },
  );
  try {
    assert.equal(priorAccounting(authorization).accountedUsd, 1.62);
    await run('https://api.openai.com/v1/responses', init);
    assert.equal(readFileSync(old, 'utf8'), raw);
    save(path, {
      ceilingUsd: 20,
      authorized: true,
      calls: [{ ...known, chargedUsd: 18.3 }],
    });
    await assert.rejects(
      run('https://api.openai.com/v1/responses', init),
      /US\$20 ceiling/,
    );
    save(path, {
      ceilingUsd: 20,
      authorized: true,
      calls: Array(14).fill(known),
    });
    await assert.rejects(
      run('https://api.openai.com/v1/responses', init),
      /per-task/,
    );
    save(path, {
      ceilingUsd: 20,
      authorized: true,
      calls: [{ ...known, outcome: 'unreconciled-stop' }],
    });
    await assert.rejects(
      run('https://api.openai.com/v1/responses', init),
      /unresolved prior charge/,
    );
    assert.equal(sent, 1);
    // A terminated historical attempt may be explicitly carried at its full
    // reservation. Never turn missing usage into an estimated/confirmed charge.
    const interrupted = join(dir, 'interrupted.json');
    save(interrupted, {
      ceilingUsd: 20,
      authorized: true,
      calls: [
        {
          ...scope,
          reservedUsd: 0.22113,
          started: '',
          outcome: 'interrupted-reservation-retained',
        },
      ],
    });
    const contents = readFileSync(interrupted, 'utf8');
    authorization.interruptedLedgers = [
      { path: interrupted, sha256: digest(interrupted) },
    ];
    const totals = priorAccounting(authorization);
    assert.equal(totals.calls.length, 3);
    assert.equal(totals.estimatedUsd, 0.8);
    assert(Math.abs(totals.accountedUsd - 1.84113) < 1e-12);
    assert.equal(readFileSync(interrupted, 'utf8'), contents);
    authorization.interruptedLedgers.push(authorization.interruptedLedgers[0]);
    assert.throws(() => priorAccounting(authorization), /twice/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
