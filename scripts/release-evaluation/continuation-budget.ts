/** Explicitly approved continuation; the original ledger is never rewritten. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  budgetUsed,
  meteredFetch,
  reservation,
  type Call,
  type Ledger,
} from '../completion-evaluation/budget';

export type CarryForward = {
  authorized: boolean;
  actualUsage: 'unknown';
  allowanceUsd: number;
  maximumAdditionalUsd: number;
  originalLedgerPath: string;
  originalLedgerSha256: string;
  settledLedgers?: { path: string; sha256: string }[];
};
export const digest = (path: string) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

export function originalCalls(carry: CarryForward) {
  assert(carry.authorized, 'Explicit continuation authorization required.');
  assert.equal(carry.actualUsage, 'unknown');
  assert.equal(carry.allowanceUsd, 0.62);
  assert.equal(carry.maximumAdditionalUsd, 4.38);
  assert.equal(
    digest(carry.originalLedgerPath),
    carry.originalLedgerSha256,
    'Original accounting changed.',
  );
  const original: Ledger = JSON.parse(
    readFileSync(carry.originalLedgerPath, 'utf8'),
  );
  assert.equal(
    original.calls.length,
    1,
    'Only the specifically approved interrupted request may be carried forward.',
  );
  assert.equal(original.calls[0].outcome, 'interrupted-reservation-retained');
  assert.equal(
    original.calls[0].estimatedUsd,
    undefined,
    'Unknown usage must remain unknown.',
  );
  assert.equal(
    original.calls[0].chargedUsd,
    undefined,
    'Allowance is not a confirmed charge.',
  );
  assert(budgetUsed(original) <= carry.allowanceUsd);
  return original.calls;
}

export function settledCalls(carry: CarryForward) {
  return (carry.settledLedgers ?? []).flatMap(({ path, sha256 }) => {
    assert.equal(digest(path), sha256, 'Settled accounting changed.');
    const ledger: Ledger = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(ledger.ceilingUsd, 5);
    assert(ledger.authorized);
    assert(
      ledger.calls.every(
        (c) =>
          c.outcome === 'usage-reconciled' &&
          Number.isFinite(c.estimatedUsd) &&
          Number.isFinite(c.chargedUsd),
      ),
      'Unresolved charges cannot be carried as settled.',
    );
    return ledger.calls;
  });
}

export function continuationFetch(
  path: string,
  carry: CarryForward,
  context: () => Pick<Call, 'caseId' | 'role'>,
  send: typeof fetch = fetch,
): typeof fetch {
  const metered = meteredFetch(path, context, send);
  return async (url, init) => {
    const settled = settledCalls(carry);
    const prior = [...originalCalls(carry), ...settled];
    const settledUsed = settled.reduce((n, c) => n + c.chargedUsd!, 0);
    const current: Ledger = JSON.parse(readFileSync(path, 'utf8'));
    const scope = context();
    assert(
      prior.length + current.calls.length < 32,
      'Combined request limit reached.',
    );
    assert(
      [...prior, ...current.calls].filter((c) => c.caseId === scope.caseId)
        .length < 8,
      'Combined per-task request limit reached.',
    );
    assert(typeof init?.body === 'string');
    const reserved = reservation(JSON.parse(init.body));
    assert(
      settledUsed + budgetUsed(current) + reserved <=
        carry.maximumAdditionalUsd,
      'Additional US$4.38 ceiling reached.',
    );
    assert(
      carry.allowanceUsd + settledUsed + budgetUsed(current) + reserved <= 5,
      'Aggregate US$5 ceiling reached.',
    );
    // All existing endpoint, model, authorization, token and unknown-new-charge
    // checks remain in force. No old call is marked usage-reconciled.
    return metered(url, init);
  };
}
