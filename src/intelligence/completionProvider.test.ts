import { expect, it, vi } from 'vitest';
import { createProvider, completionRequestSchema } from '../../server/provider';
import { createApi } from '../../server/app';
import { sceneContext, defaultCamera, emptyContext } from './context';
import { newSession } from './engine';
import { criteria, measure } from '../../tests/fixtures/completion';
import { conversationHistory } from './client';
import {
  compactCompletionCriteria,
  expandCompletionWire,
  expandCompletionCorrections,
} from '../../server/completionWire';
import { reportedCriteriaIncident } from '../../tests/fixtures/criteria-contracts';
import { verifyCompletion } from './completion';

const message = 'Create three cubes with sides of two meters.';
const input = () => ({
  message,
  history: [],
  scene: sceneContext(
    newSession({ volumes: [], selectedId: null }).project,
    emptyContext(),
    defaultCamera,
  ),
  candidate: [
    { id: 'provisional', name: 'Cube', groupId: null, role: null, level: null },
  ],
});
const expected = expandCompletionWire(
  compactCompletionCriteria(
    criteria(
      [measure('count', 'count', 3), measure('height', 'height', 2)],
      [],
      'three cubes',
    ),
  ),
);

it.each(['responses', 'chat_completions'] as const)(
  'bounded %s criterion correction returns patches, retaining request evidence and immutable scope',
  async (api) => {
    const {
      original,
      candidate,
      criteria: c,
      request,
    } = await reportedCriteriaIncident();
    // Normal server criteria have host-generated check IDs. The patch path also
    // retains arbitrary historical IDs instead of re-numbering them.
    const report = await verifyCompletion(c, original, candidate);
    const corrected = structuredClone(c);
    (corrected.checks[4].requirement as any).value = -3.5;
    (corrected.checks[5].requirement as any).property = 'materialSpec';
    const compact = compactCompletionCriteria(corrected);
    const patch = {
      corrections: [4, 5].map((i) => ({
        checkId: c.checks[i].requirement.id,
        test: compact.checks[i].test,
      })),
    };
    let calls = 0;
    const provider = createProvider(
      'offline-only',
      async (_url, init) => {
        calls++;
        const body = JSON.parse(init!.body as string);
        const data = JSON.parse(
          api === 'responses'
            ? body.input[0].content[0].text
            : body.messages[1].content[0].text,
        );
        expect(data.instruction).toBe(request);
        expect(data.criterionCorrection.issues).toHaveLength(2);
        expect(data.criterionCorrection.observations).toHaveLength(
          report.checks.length,
        );
        const schema =
          api === 'responses'
            ? body.text.format.schema
            : body.response_format.json_schema.schema;
        expect(Object.keys(schema.properties)).toEqual(['corrections']);
        const text = JSON.stringify(patch);
        return Response.json(
          api === 'responses'
            ? {
                id: 'r',
                object: 'response',
                status: 'completed',
                output: [
                  {
                    id: 'm',
                    type: 'message',
                    role: 'assistant',
                    status: 'completed',
                    content: [{ type: 'output_text', text, annotations: [] }],
                  },
                ],
              }
            : {
                id: 'c',
                object: 'chat.completion',
                choices: [
                  {
                    index: 0,
                    finish_reason: 'stop',
                    message: { role: 'assistant', content: text },
                  },
                ],
              },
        );
      },
      { agent: true, textApi: api },
    );
    const result = await provider.completionCriteria!({
      ...input(),
      message: request,
      scene: sceneContext(original.project, original.context, defaultCamera),
      revision: {
        criteria: c,
        issues: report.criterionIssues!,
        observations: report.checks.map(({ id, outcome, observed }) => ({
          id,
          outcome,
          observed,
        })),
      },
    });
    expect(calls).toBe(1);
    expect(result).toEqual(corrected);
    expect(() =>
      expandCompletionCorrections(
        { corrections: [{ ...patch.corrections[0], checkId: 'invented' }] },
        c,
      ),
    ).toThrow();
  },
);
function response(api: string, value: unknown) {
  const text = JSON.stringify(
    compactCompletionCriteria(value as typeof expected),
  );
  return new Response(
    JSON.stringify(
      api === 'responses'
        ? {
            id: 'r',
            object: 'response',
            status: 'completed',
            output: [
              {
                id: 'm',
                type: 'message',
                role: 'assistant',
                status: 'completed',
                content: [{ type: 'output_text', text, annotations: [] }],
              },
            ],
          }
        : {
            id: 'c',
            object: 'chat.completion',
            choices: [
              {
                index: 0,
                finish_reason: 'stop',
                message: { role: 'assistant', content: text },
              },
            ],
          },
    ),
    { headers: { 'Content-Type': 'application/json' } },
  );
}
it.each(['responses', 'chat_completions'] as const)(
  'separates the independent reader from executing-agent claims and uses strict %s output (offline SDK)',
  async (api) => {
    let sent: any;
    const provider = createProvider(
      'offline-only',
      async (_url, init) => {
        sent = JSON.parse(init!.body as string);
        return response(api, expected);
      },
      { agent: true, textApi: api },
    );
    expect(await provider.completionCriteria!(input())).toEqual(expected);
    const text =
      api === 'responses'
        ? sent.input[0].content[0].text
        : sent.messages[1].content[0].text;
    const data = JSON.parse(text);
    expect(data.instruction).toBe(message);
    expect(data.candidateIdentities).toEqual(input().candidate);
    expect(data).not.toHaveProperty('execution');
    expect(data).not.toHaveProperty('operations');
    expect(data).not.toHaveProperty('completionClaim');
    expect(data.candidateIdentities[0]).not.toHaveProperty('dimensions');
    expect(data.original.conversation).not.toHaveProperty('lastBrief');
    expect(sent.store).toBe(false);
    expect(
      api === 'responses' ? sent.reasoning.effort : sent.reasoning_effort,
    ).toBe('low');
    expect(
      api === 'responses'
        ? sent.text.format.strict
        : sent.response_format.json_schema.strict,
    ).toBe(true);
    expect(JSON.stringify(sent)).not.toContain('finish_task');
  },
);
it('rejects invented provenance and candidate measurements at the review boundary', async () => {
  const falseEvidence = criteria(
    [measure('count', 'count', 1)],
    [],
    'The user only asked for one cube',
  );
  const provider = createProvider(
    'offline-only',
    async () => response('responses', falseEvidence),
    { agent: true },
  );
  await expect(provider.completionCriteria!(input())).rejects.toThrow();
  expect(
    completionRequestSchema.safeParse({
      ...input(),
      candidate: [
        {
          ...input().candidate[0],
          dimensions: { width: 1, height: 1, depth: 1 },
        },
      ],
    }).success,
  ).toBe(false);
  expect(
    completionRequestSchema.safeParse({
      ...input(),
      execution: { receipts: [] },
    }).success,
  ).toBe(false);
});
it('marks failed conversation turns without discarding context needed for a deliberate retry', () => {
  const history = conversationHistory([
    { role: 'user', content: 'Create a curved study' },
    { role: 'assistant', content: 'The operation failed', outcome: 'failed' },
  ]);
  expect(history[0].content).toBe('Create a curved study');
  expect(history[1].content).toContain('no proposed changes were committed');
  expect(history[1].content).toContain('not pending work');
});

it('classifies an incomplete independent response once, preserves its cause, and never starts a modeling repair', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  let calls = 0;
  const provider = createProvider(
    'offline-only',
    async () => {
      calls++;
      return Response.json({
        id: 'incomplete',
        object: 'response',
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
        output: [],
        usage: { input_tokens: 3200, output_tokens: 6000, total_tokens: 9200 },
      });
    },
    { agent: true, textApi: 'responses' },
  );
  try {
    const result = await provider.completionCriteria!(input());
    expect(calls).toBe(1);
    expect(result.scopeKnown).toBe(false);
    expect(result.checks[0].requirement.kind).toBe('unavailable');
    expect(JSON.stringify(result)).toContain('max_output_tokens');
    expect(JSON.stringify(result)).toContain('6000 output tokens');
    expect(warning).toHaveBeenCalledWith(
      'Independent review incomplete',
      expect.objectContaining({
        status: 'max_output_tokens',
        outputTokens: 6000,
      }),
    );
  } finally {
    warning.mockRestore();
  }
});

it('keeps deeper independent interpretation for image references while text-only review uses low effort', async () => {
  let sent: any;
  const provider = createProvider(
    'offline-only',
    async (_url, init) => {
      sent = JSON.parse(init!.body as string);
      return response('responses', expected);
    },
    { agent: true, textApi: 'responses' },
  );
  await provider.completionCriteria!({
    ...input(),
    images: ['data:image/png;base64,aGVsbG8='],
  });
  expect(sent.reasoning.effort).toBe('high');
});
it('uses the protected API boundary for independent checks and fails closed without a verifier', async () => {
  let calls = 0;
  const server = createApi(
    {
      agent: true,
      plan: async () => {
        throw new Error('not the execution agent');
      },
      voice: async () => '',
      completionCriteria: async (data) => {
        calls++;
        expect(data.message).toBe(message);
        return expected;
      },
    },
    { password: 'test-password' },
  ).listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const post = (route: string, data: unknown, headers = {}) =>
    fetch(url + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(data),
    });
  try {
    expect((await post('/api/completion-criteria', input())).status).toBe(401);
    expect(calls).toBe(0);
    const login = await post('/api/login', { password: 'test-password' });
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    expect(
      (
        await post('/api/completion-criteria', input(), {
          cookie,
          origin: 'https://other.example',
        })
      ).status,
    ).toBe(403);
    const good = await post('/api/completion-criteria', input(), { cookie });
    expect(good.status).toBe(200);
    expect(await good.json()).toEqual(expected);
    expect(calls).toBe(1);
    expect(
      (
        await post(
          '/api/completion-criteria',
          { ...input(), candidate: [{ bad: 'shape' }] },
          { cookie },
        )
      ).status,
    ).toBe(400);
    expect(calls).toBe(1);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
  const unavailable = createApi({
    agent: true,
    plan: async () => {
      throw new Error('unused');
    },
    voice: async () => '',
  }).listen(0, '127.0.0.1');
  await new Promise<void>((r) => unavailable.once('listening', r));
  try {
    const res = await fetch(
      `http://127.0.0.1:${(unavailable.address() as { port: number }).port}/api/completion-criteria`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input()),
      },
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain('unavailable');
  } finally {
    await new Promise<void>((r) => unavailable.close(() => r()));
  }
});
