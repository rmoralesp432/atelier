/** Evaluation-only accounting, shared by parallel lanes in one coordinator. */
import assert from 'node:assert/strict';
import {
  readFileSync,
  existsSync,
  writeFileSync,
  renameSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  reservation,
  inputUpperBound,
  pricing,
} from '../completion-evaluation/budget';
import { root, conditions } from './config';
export { pricing, reservation };
export function save(path: string, value: unknown) {
  writeFileSync(path + '.tmp', JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(path + '.tmp', path);
}
const path = join(root, 'ledger.json');
export function ledger() {
  return existsSync(path)
    ? JSON.parse(readFileSync(path, 'utf8'))
    : {
        authorization:
          '2026-11-23 broad campaign; no fixed dollar/trial cap; estimated pricing approved',
        ceilingUSD: null,
        availableCreditEstimateUSD: 66.554426,
        autoRechargeChanged: false,
        calls: [],
      };
}
export const accounted = (l = ledger()) =>
  l.calls.reduce(
    (n: number, c: any) => n + (c.accountedUsd ?? c.reservedUsd),
    0,
  );
export const costs = (caseId?: string) => {
  const c = ledger().calls.filter((x: any) => !caseId || x.caseId === caseId);
  return {
    calls: c.length,
    estimatedUSD: c.reduce((n: number, x: any) => n + (x.estimatedUsd ?? 0), 0),
    accountedUSD: c.reduce(
      (n: number, x: any) => n + (x.accountedUsd ?? x.reservedUsd),
      0,
    ),
    unknownReservations: c
      .filter(
        (x: any) =>
          !['usage-reconciled', 'rejected-no-generation'].includes(x.outcome),
      )
      .map((x: any) => ({
        id: x.id,
        reservedUSD: x.reservedUsd,
        outcome: x.outcome,
      })),
    inputTokens: c.reduce((n: number, x: any) => n + (x.inputTokens ?? 0), 0),
    outputTokens: c.reduce((n: number, x: any) => n + (x.outputTokens ?? 0), 0),
    reviewerMs: c
      .filter((x: any) => x.role === 'reviewer')
      .reduce((n: number, x: any) => n + (x.elapsedMs ?? 0), 0),
    executorMs: c
      .filter((x: any) => x.role === 'executor')
      .reduce((n: number, x: any) => n + (x.elapsedMs ?? 0), 0),
  };
};
let blocked: string | undefined;
export const stopReason = () => blocked;
export function meter(
  scope: () => { caseId: string; role: string; version: string },
  capture: (body: any) => void,
): typeof fetch {
  return async (url, init) => {
    assert(!blocked, blocked);
    assert.equal(String(url), 'https://api.openai.com/v1/responses');
    assert.equal(typeof init?.body, 'string');
    const body = JSON.parse(init!.body as string),
      who = scope();
    inputUpperBound(body);
    const l = ledger(),
      reservedUsd = reservation(body);
    assert(
      l.calls.filter((c: any) => c.caseId === who.caseId).length <
        conditions.maximumCallsPerTurn,
      'Evaluation per-turn runaway guard reached; report incomplete, do not force commit',
    );
    assert(
      accounted(l) + reservedUsd <= l.availableCreditEstimateUSD,
      'Insufficient conservatively estimated prepaid credits for this call',
    );
    const call = {
      id: randomUUID(),
      ...who,
      started: new Date().toISOString(),
      reservedUsd,
      outcome: 'reserved-before-send',
    } as any;
    l.calls.push(call);
    mkdirSync(join(root, 'calls'), { recursive: true });
    save(path, l);
    save(join(root, 'calls', call.id + '-request.json'), body);
    capture(body);
    const update = () => {
      const latest = ledger();
      const i = latest.calls.findIndex((c: any) => c.id === call.id);
      assert(i >= 0);
      latest.calls[i] = call;
      save(path, latest);
    };
    try {
      const response = await fetch(url, {
        ...init,
        body: JSON.stringify({ ...body, service_tier: 'default' }),
      });
      call.httpStatus = response.status;
      const data = await response.clone().json();
      call.elapsedMs = Date.now() - Date.parse(call.started);
      save(
        join(root, 'calls', call.id + '-response.json'),
        response.ok
          ? data
          : {
              status: response.status,
              code: data.error?.code,
              type: data.error?.type,
              message: String(data.error?.message ?? '').replace(
                /sk-[A-Za-z0-9_-]+/g,
                '[redacted]',
              ),
            },
      );
      if (!response.ok) {
        call.providerCode = data.error?.code;
        call.outcome = 'http-error-reservation-retained';
        if (
          [
            'insufficient_quota',
            'credit_balance_exhausted',
            'invalid_api_key',
          ].includes(data.error?.code) ||
          [401, 402, 403].includes(response.status)
        )
          blocked = `Provider access/credit stop: ${response.status} ${data.error?.code ?? ''}`;
        update();
        return response;
      }
      const input = data.usage?.input_tokens,
        output = data.usage?.output_tokens;
      assert(
        Number.isInteger(input) &&
          Number.isInteger(output) &&
          input >= 0 &&
          output >= 0 &&
          input <= inputUpperBound(body).inputBound &&
          output <= 6000,
        'Usage could not be safely reconciled',
      );
      assert(
        data.model === 'gpt-6.1-sol' || data.model?.startsWith('gpt-6.1-sol-'),
        'Unexpected model',
      );
      assert(
        !data.service_tier || data.service_tier === 'default',
        'Unexpected service tier',
      );
      const long = input > pricing.longContextThreshold;
      call.inputTokens = input;
      call.outputTokens = output;
      call.reasoningTokens =
        data.usage?.output_tokens_details?.reasoning_tokens;
      call.cachedInputTokens = data.usage?.input_tokens_details?.cached_tokens;
      call.modelReturned = data.model;
      call.serviceTier = data.service_tier;
      call.responseStatus = data.status;
      call.incompleteReason = data.incomplete_details?.reason;
      call.estimatedUsd =
        (input *
          (long ? pricing.reserveInputPerMillion : pricing.inputPerMillion) +
          output *
            (long
              ? pricing.reserveOutputPerMillion
              : pricing.outputPerMillion)) /
        1e6;
      call.accountedUsd = call.estimatedUsd * pricing.margin;
      assert(call.accountedUsd <= reservedUsd, 'Usage exceeded reservation');
      call.outcome = 'usage-reconciled';
      update();
      return response;
    } catch (e) {
      call.elapsedMs = Date.now() - Date.parse(call.started);
      call.outcome =
        call.outcome === 'reserved-before-send'
          ? 'interrupted-reservation-retained'
          : call.outcome;
      call.error = String(e)
        .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
        .slice(0, 1000);
      if (/Usage|Unexpected/.test(String(e))) blocked = call.error;
      update();
      throw e;
    }
  };
}
