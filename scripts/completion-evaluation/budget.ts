import assert from 'node:assert/strict';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';

export const ceilingUsd = 5;
export const model = 'gpt-6.1-sol';
// Current secondary pricing reference, retrieved 2026-11-18. No cached-input
// discounts are assumed. Reserve at the higher standard long-context rates.
export const pricing = {
  source:
    'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json',
  checked: '2026-11-18',
  inputPerMillion: 2,
  outputPerMillion: 10,
  reserveInputPerMillion: 4,
  reserveOutputPerMillion: 15,
  longContextThreshold: 272000,
  maximumInputTokens: 922000,
  margin: 1.25,
};
export type Call = {
  caseId: string;
  role: 'executor' | 'reviewer';
  reservedUsd: number;
  started: string;
  status?: number;
  elapsedMs?: number;
  estimatedUsd?: number;
  chargedUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  modelReturned?: string;
  serviceTier?: string;
  outcome?: string;
  responseStatus?: string;
  incompleteReason?: string;
  reasoningTokens?: number;
  responseBytes?: number;
};
export type Ledger = { ceilingUsd: number; authorized: boolean; calls: Call[] };
export function save(path: string, value: unknown) {
  writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(`${path}.tmp`, path);
}
export function budgetUsed(ledger: Ledger) {
  return ledger.calls.reduce((n, c) => n + (c.chargedUsd ?? c.reservedUsd), 0);
}
export function inputUpperBound(body: any) {
  assert.equal(body.model, model, 'Evaluation cannot change models.');
  assert(!body.stream, 'No unmetered streaming.');
  assert(
    !body.tools || body.tools.every((t: any) => t.type === 'function'),
    'No billable external tools.',
  );
  const maximum = body.max_output_tokens ?? body.max_completion_tokens;
  assert(
    Number.isInteger(maximum) && maximum > 0 && maximum <= 6000,
    'Use the production output limit.',
  );
  let images = 0;
  const text = JSON.stringify(body, (key, v) => {
    if (typeof v === 'string' && v.startsWith('data:image/')) {
      images++;
      return '[640px observation]';
    }
    if (key === 'image_url' || key === 'url')
      assert(
        typeof v !== 'string' ||
          !(v.startsWith('http:') || v.startsWith('https:')),
        'No remote image inputs with unbounded token cost.',
      );
    return v;
  });
  assert(
    images <= 2,
    'Only the two production observation images are allowed.',
  );
  // The API decodes transport JSON before tokenizing message text. Escaped
  // quotation marks, newlines and backslashes are not extra model input.
  // Deduct only that transport escaping from actual message-text fields;
  // retain all JSON structure/schema overhead and image allowances.
  const messageText: string[] = [];
  if (typeof body.instructions === 'string')
    messageText.push(body.instructions);
  if (typeof body.input === 'string') messageText.push(body.input);
  for (const item of [
    ...(Array.isArray(body.input) ? body.input : []),
    ...(body.messages ?? []),
  ]) {
    if (typeof item.content === 'string') messageText.push(item.content);
    if (Array.isArray(item.content))
      for (const part of item.content)
        if (
          ['input_text', 'text'].includes(part.type) &&
          typeof part.text === 'string'
        )
          messageText.push(part.text);
  }
  const transportEscaping = messageText.reduce(
    (n, value) =>
      n +
      Buffer.byteLength(JSON.stringify(value)) -
      Buffer.byteLength(value) -
      2,
    0,
  );
  // UTF-8 bytes still upper-bound decoded text tokens, without a tokenizer
  // assumption or any change to the submitted request or generation limits.
  const inputBound =
    Buffer.byteLength(text) - transportEscaping + 4096 + images * 16000;
  assert(
    inputBound <= pricing.maximumInputTokens,
    'Conservative input bound exceeds the model context capacity.',
  );
  return { inputBound, maximum };
}
export function reservation(body: any) {
  const { inputBound, maximum } = inputUpperBound(body);
  return (
    (pricing.margin *
      (inputBound * pricing.reserveInputPerMillion +
        maximum * pricing.reserveOutputPerMillion)) /
    1e6
  );
}
export function meteredFetch(
  path: string,
  context: () => Pick<Call, 'caseId' | 'role'>,
  send: typeof fetch = fetch,
  limits = { ceilingUsd, maximumCalls: 48, maximumCallsPerTask: 8 },
): typeof fetch {
  return async (url, init) => {
    assert(
      [
        'https://api.openai.com/v1/responses',
        'https://api.openai.com/v1/chat/completions',
      ].includes(String(url)),
      'Unapproved generation endpoint.',
    );
    assert(typeof init?.body === 'string');
    const body = JSON.parse(init.body);
    const ledger: Ledger = JSON.parse(readFileSync(path, 'utf8'));
    assert(
      ledger.authorized && ledger.ceilingUsd === limits.ceilingUsd,
      `Paid evaluation requires explicit approval of the $${limits.ceilingUsd} ceiling.`,
    );
    assert(
      ledger.calls.every((c) => c.outcome === 'usage-reconciled'),
      'An unresolved prior charge blocks further paid calls.',
    );
    const scope = context();
    const reservedUsd = reservation(body);
    assert(
      ledger.calls.length < limits.maximumCalls &&
        ledger.calls.filter((c) => c.caseId === scope.caseId).length <
          limits.maximumCallsPerTask,
      'Evaluation call limit reached before sending.',
    );
    assert(
      budgetUsed(ledger) + reservedUsd <= limits.ceilingUsd,
      'Evaluation dollar ceiling reached before sending.',
    );
    const call: Call = {
      ...scope,
      reservedUsd,
      started: new Date().toISOString(),
    };
    ledger.calls.push(call);
    save(path, ledger); // Persist before sending; interruption keeps the reservation.
    try {
      const response = await send(url, {
        ...init,
        body: JSON.stringify({ ...body, service_tier: 'default' }),
      });
      call.status = response.status;
      const data = await response.clone().json();
      call.elapsedMs = Date.now() - Date.parse(call.started);
      call.modelReturned = data.model;
      call.serviceTier = data.service_tier;
      call.responseStatus = data.status ?? data.choices?.[0]?.finish_reason;
      call.incompleteReason = data.incomplete_details?.reason;
      call.reasoningTokens =
        data.usage?.output_tokens_details?.reasoning_tokens ??
        data.usage?.completion_tokens_details?.reasoning_tokens;
      call.responseBytes = Buffer.byteLength(JSON.stringify(data));
      save(
        `${path}.response-${ledger.calls.length}.json`,
        response.ok
          ? data
          : {
              status: response.status,
              type: data.error?.type,
              code: data.error?.code,
            },
      );
      const input = data.usage?.input_tokens ?? data.usage?.prompt_tokens;
      const output = data.usage?.output_tokens ?? data.usage?.completion_tokens;
      if (
        response.ok &&
        Number.isInteger(input) &&
        Number.isInteger(output) &&
        input >= 0 &&
        input <= inputUpperBound(body).inputBound &&
        output >= 0 &&
        output <= 6000 &&
        (data.model === model || data.model?.startsWith(`${model}-`)) &&
        (!data.service_tier || data.service_tier === 'default')
      ) {
        call.inputTokens = input;
        call.outputTokens = output;
        const longContext = input > pricing.longContextThreshold;
        call.estimatedUsd =
          (input *
            (longContext
              ? pricing.reserveInputPerMillion
              : pricing.inputPerMillion) +
            output *
              (longContext
                ? pricing.reserveOutputPerMillion
                : pricing.outputPerMillion)) /
          1e6;
        // Retain a 25% margin even after successful usage reconciliation.
        call.chargedUsd = call.estimatedUsd * pricing.margin;
        assert(
          call.chargedUsd <= reservedUsd,
          'Unexpected usage exceeded reservation; stop evaluation.',
        );
        call.outcome = 'usage-reconciled';
      } else {
        call.outcome = 'unreconciled-stop';
        throw new Error(
          'Provider error or unknown billing/usage: reservation retained; stop paid evaluation.',
        );
      }
      save(path, ledger);
      return response;
    } catch (e) {
      call.elapsedMs = Date.now() - Date.parse(call.started);
      call.outcome ??= 'interrupted-reservation-retained';
      save(path, ledger);
      throw e;
    }
  };
}
