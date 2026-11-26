import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  inputUpperBound,
  pricing,
  reservation,
} from '../completion-evaluation/budget';
export { pricing, reservation };
export const safe = (e: unknown) =>
  String(e).replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]');
export const save = (path: string, data: unknown) => {
  writeFileSync(path + '.tmp', JSON.stringify(data, null, 2), { mode: 0o600 });
  renameSync(path + '.tmp', path);
};
export class TrialBudget {
  blocked: string | null = null;
  constructor(
    readonly dir: string,
    readonly transport: typeof fetch = fetch,
  ) {
    mkdirSync(join(dir, 'calls'), { recursive: true });
  }
  ledger() {
    const p = join(this.dir, 'ledger.json');
    assert(existsSync(p), 'Explicit trial authorization ledger missing');
    return JSON.parse(readFileSync(p, 'utf8'));
  }
  accounted(l = this.ledger()) {
    return l.calls.reduce(
      (n: number, c: any) => n + (c.accountedUSD ?? c.reservedUSD),
      0,
    );
  }
  costs() {
    const l = this.ledger();
    return {
      calls: l.calls.length,
      ceilingUSD: l.ceilingUSD,
      accountedUSD: this.accounted(l),
      estimatedUSD: l.calls.reduce(
        (n: number, c: any) => n + (c.estimatedUSD ?? 0),
        0,
      ),
      unknownReservations: l.calls
        .filter((c: any) => c.outcome !== 'usage-reconciled')
        .map((c: any) => ({
          id: c.id,
          turn: c.turn,
          role: c.role,
          outcome: c.outcome,
          reservedUSD: c.reservedUSD,
        })),
      inputTokens: l.calls.reduce(
        (n: number, c: any) => n + (c.inputTokens ?? 0),
        0,
      ),
      outputTokens: l.calls.reduce(
        (n: number, c: any) => n + (c.outputTokens ?? 0),
        0,
      ),
      reviewerMs: l.calls
        .filter((c: any) => c.role === 'reviewer')
        .reduce((n: number, c: any) => n + (c.elapsedMs ?? 0), 0),
      stopReason: this.blocked,
    };
  }
  async call(
    scope: { turn: number; role: string; event: number },
    url: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) {
    assert(!this.blocked, this.blocked ?? 'Budget blocked');
    assert.equal(String(url), 'https://api.openai.com/v1/responses');
    assert.equal(typeof init?.body, 'string');
    const body = JSON.parse(init!.body as string),
      bound = inputUpperBound(body),
      reservedUSD = reservation(body),
      l = this.ledger();
    assert(
      l.authorized === true &&
        l.ceilingUSD > 0 &&
        l.ceilingUSD <= 5 &&
        l.maximumPaidCalls <= 60,
    );
    if (
      l.calls.length >= l.maximumPaidCalls ||
      this.accounted(l) + reservedUSD > l.ceilingUSD ||
      l.calls.filter((c: any) => c.turn === scope.turn).length >= 32
    ) {
      this.blocked = 'Next call exceeds the authorized accounting/call limit';
      throw Error(this.blocked);
    }
    const call: any = {
      id: randomUUID(),
      ...scope,
      started: new Date().toISOString(),
      reservedUSD,
      outcome: 'reserved-before-send',
    };
    l.calls.push(call);
    save(join(this.dir, 'ledger.json'), l);
    save(join(this.dir, 'calls', call.id + '-request.json'), {
      ...body,
      service_tier: 'default',
    });
    const update = () => {
      const current = this.ledger();
      const i = current.calls.findIndex((c: any) => c.id === call.id);
      assert(i >= 0);
      current.calls[i] = call;
      save(join(this.dir, 'ledger.json'), current);
    };
    try {
      const response = await this.transport(url, {
        ...init,
        body: JSON.stringify({ ...body, service_tier: 'default' }),
      });
      call.httpStatus = response.status;
      const data = await response.clone().json();
      call.elapsedMs = Date.now() - Date.parse(call.started);
      save(
        join(this.dir, 'calls', call.id + '-response.json'),
        response.ok
          ? data
          : {
              status: response.status,
              code: data.error?.code,
              message: safe(data.error?.message ?? '').slice(0, 500),
            },
      );
      if (!response.ok) {
        call.outcome = 'http-error-reservation-retained';
        call.providerCode = data.error?.code;
        if (
          [401, 402, 403].includes(response.status) ||
          [
            'insufficient_quota',
            'credit_balance_exhausted',
            'invalid_api_key',
          ].includes(data.error?.code)
        )
          this.blocked = `Provider access/credit stop: ${response.status} ${data.error?.code ?? ''}`;
        update();
        return response;
      }
      const input = data.usage?.input_tokens,
        output = data.usage?.output_tokens;
      assert(
        Number.isInteger(input) &&
          input >= 0 &&
          input <= bound.inputBound &&
          Number.isInteger(output) &&
          output >= 0 &&
          output <= bound.maximum,
        'Usage outside reserved bounds',
      );
      assert(
        data.model === 'gpt-6.1-sol' || data.model?.startsWith('gpt-6.1-sol-'),
        'Unexpected served model',
      );
      assert(
        !data.service_tier || data.service_tier === 'default',
        'Unexpected service tier',
      );
      const long = input > pricing.longContextThreshold;
      Object.assign(call, {
        inputTokens: input,
        outputTokens: output,
        reasoningTokens: data.usage?.output_tokens_details?.reasoning_tokens,
        cachedInputTokens: data.usage?.input_tokens_details?.cached_tokens,
        modelReturned: data.model,
        serviceTier: data.service_tier,
        responseStatus: data.status,
        incompleteReason: data.incomplete_details?.reason,
      });
      call.estimatedUSD =
        (input *
          (long ? pricing.reserveInputPerMillion : pricing.inputPerMillion) +
          output *
            (long
              ? pricing.reserveOutputPerMillion
              : pricing.outputPerMillion)) /
        1e6;
      call.accountedUSD = call.estimatedUSD * pricing.margin;
      assert(call.accountedUSD <= reservedUSD, 'Usage exceeded reservation');
      call.outcome = 'usage-reconciled';
      update();
      return response;
    } catch (e) {
      call.elapsedMs = Date.now() - Date.parse(call.started);
      call.outcome =
        call.outcome === 'reserved-before-send'
          ? 'interrupted-reservation-retained'
          : call.outcome;
      call.error = safe(e).slice(0, 1000);
      if (/Usage|Unexpected|reservation/.test(String(e)))
        this.blocked = call.error;
      update();
      throw e;
    }
  }
}
