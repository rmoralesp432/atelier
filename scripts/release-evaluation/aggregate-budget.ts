/** New user authorization supersedes the ceiling, never the prior accounting. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  budgetUsed,
  meteredFetch,
  reservation,
  type Call,
  type Ledger,
} from '../completion-evaluation/budget';
import { digest } from './continuation-budget';

export type AggregateAuthorization = {
  approved: boolean;
  ceilingUsd: 20;
  unknownAllowanceUsd: 0.62;
  unknownLedger: { path: string; sha256: string };
  settledLedgers: { path: string; sha256: string }[];
  maximumCalls: 60;
  maximumCallsPerTask: 16;
};
export function priorAccounting(authorization: AggregateAuthorization) {
  assert(authorization.approved && authorization.ceilingUsd === 20);
  assert.equal(authorization.unknownAllowanceUsd, 0.62);
  const read = ({ path, sha256 }: { path: string; sha256: string }): Ledger => {
    assert.equal(digest(path), sha256, 'Preserved accounting changed.');
    return JSON.parse(readFileSync(path, 'utf8'));
  };
  const original = read(authorization.unknownLedger);
  assert.equal(original.calls.length, 1);
  assert.equal(original.calls[0].outcome, 'interrupted-reservation-retained');
  assert.equal(original.calls[0].estimatedUsd, undefined);
  assert.equal(original.calls[0].chargedUsd, undefined);
  assert(budgetUsed(original) <= authorization.unknownAllowanceUsd);
  assert.equal(
    new Set(authorization.settledLedgers.map((x) => x.path)).size,
    authorization.settledLedgers.length,
  );
  const settled = authorization.settledLedgers.flatMap((p) => read(p).calls);
  assert(
    settled.every(
      (c) =>
        c.outcome === 'usage-reconciled' &&
        Number.isFinite(c.estimatedUsd) &&
        Number.isFinite(c.chargedUsd),
    ),
    'Unknown new charges stop the evaluation.',
  );
  return {
    calls: [...original.calls, ...settled],
    estimatedUsd: settled.reduce((n, c) => n + c.estimatedUsd!, 0),
    accountedUsd:
      authorization.unknownAllowanceUsd +
      settled.reduce((n, c) => n + c.chargedUsd!, 0),
  };
}
export function aggregateFetch(
  path: string,
  authorization: AggregateAuthorization,
  context: () => Pick<Call, 'caseId' | 'role'>,
  send: typeof fetch = fetch,
): typeof fetch {
  const metered = meteredFetch(path, context, send, authorization);
  return async (url, init) => {
    const prior = priorAccounting(authorization);
    const current: Ledger = JSON.parse(readFileSync(path, 'utf8'));
    assert(typeof init?.body === 'string');
    assert(
      prior.calls.length + current.calls.length < authorization.maximumCalls,
      'Aggregate call limit reached.',
    );
    assert(
      [...prior.calls, ...current.calls].filter(
        (c) => c.caseId === context().caseId,
      ).length < authorization.maximumCallsPerTask,
      'Aggregate per-task limit reached.',
    );
    assert(
      prior.accountedUsd +
        budgetUsed(current) +
        reservation(JSON.parse(init.body)) <=
        authorization.ceilingUsd,
      'Aggregate US$20 ceiling reached before network.',
    );
    return metered(url, init);
  };
}
