import { it, expect } from 'vitest';
import { createProvider, type ModelRequest } from '../../server/provider';
import { sceneContext, defaultCamera } from './context';
import { newSession, directPlan, applyPlan } from './engine';
import { stagedPlan } from './checkedPlanner';
import { ModelPlanError } from './planFailure';

const empty = () => newSession({ volumes: [], selectedId: null });
const input = (): ModelRequest => ({
  message: 'Construct an editable object and check it',
  history: [],
  scene: sceneContext(empty().project, empty().context, defaultCamera),
});
const box = () =>
  directPlan({
    type: 'create_at',
    name: 'Study',
    shape: 'box',
    width: 7,
    depth: 5,
    height: 3,
    x: 0,
    y: 0,
    z: 0,
    rotation: 0,
  });
const toolResponse = (api: string, name: string, args: unknown) =>
  new Response(
    JSON.stringify(
      api === 'responses'
        ? {
            id: 'response_test',
            object: 'response',
            status: 'completed',
            output: [
              {
                type: 'function_call',
                id: 'fc_test',
                call_id: 'call_test',
                status: 'completed',
                name,
                arguments: JSON.stringify(args),
              },
            ],
          }
        : {
            id: 'chat_test',
            object: 'chat.completion',
            choices: [
              {
                index: 0,
                finish_reason: 'tool_calls',
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_test',
                      type: 'function',
                      function: { name, arguments: JSON.stringify(args) },
                    },
                  ],
                },
              },
            ],
          },
    ),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

it.each(['responses', 'chat_completions'] as const)(
  'uses %s function tools and returns real scene inspection to the model',
  async (api) => {
    const requests: any[] = [];
    const provider = createProvider(
      'offline-test',
      async (_url, init) => {
        requests.push(JSON.parse(init!.body as string));
        return requests.length === 1
          ? toolResponse(api, 'inspect_scene', { ids: [], role: null })
          : toolResponse(api, 'execute_step', {
              message: 'Construct the study',
              assumptions: [],
              operations: box().operations,
            });
      },
      { agent: true, textApi: api },
    );
    const plan = await provider.plan(input());
    expect(plan.operations).toEqual(box().operations);
    expect(plan.brief).toBeNull();
    expect(plan.planning?.next).toBeTruthy();
    expect(requests).toHaveLength(2);
    expect(
      requests[0].tools.some(
        (t: any) => (t.name ?? t.function?.name) === 'execute_step',
      ),
    ).toBe(true);
    const messages =
      api === 'responses' ? requests[1].input : requests[1].messages;
    const receipt = messages.find(
      (m: any) => m.type === 'function_call_output' || m.role === 'tool',
    );
    expect(JSON.parse(receipt.output ?? receipt.content).matched).toBe(0);
    expect(requests[0].store).toBe(false);
  },
);
it('keeps actual provisional geometry through a malformed response and finishes with one undo', async () => {
  const original = empty();
  let calls = 0;
  const result = await stagedPlan(
    original,
    defaultCamera,
    async (s, feedback, execution) => {
      calls++;
      if (calls === 1)
        return {
          ...box(),
          brief: null,
          planning: { stage: 'Construct', assumptions: [], next: 'Inspect' },
        };
      if (calls === 2)
        throw new ModelPlanError('operations.0: missing dimensions');
      expect(feedback?.error).toContain('dimensions');
      expect(s.project.volumes).toHaveLength(1);
      expect(execution!.receipts[0].created).toEqual([s.project.volumes[0].id]);
      return {
        intent: 'finish',
        message: 'Study verified',
        operations: [],
        brief: null,
        planning: null,
      };
    },
    undefined,
    undefined,
    { agent: true },
  );
  expect(calls).toBe(3);
  expect(result.prepared!.session.project.volumes).toHaveLength(1);
  expect(original.project.volumes).toHaveLength(0);
  const undo = await applyPlan(
    result.prepared!.session,
    directPlan({ type: 'undo', count: 1 }),
  );
  expect(undo.session.project).toEqual(original.project);
});
it('does not retry transport/auth failures or accept a finish without executed work', async () => {
  let calls = 0;
  await expect(
    stagedPlan(
      empty(),
      defaultCamera,
      async () => {
        calls++;
        throw new Error('Authentication failed');
      },
      undefined,
      undefined,
      { agent: true },
    ),
  ).rejects.toThrow('Authentication');
  expect(calls).toBe(1);
  const provider = createProvider(
    'offline-test',
    async () =>
      toolResponse('responses', 'finish_task', { message: 'Created it.' }),
    { agent: true },
  );
  await expect(provider.plan(input())).rejects.toThrow(
    'No successful execution',
  );
});
it('repairs malformed structured plans without committing them', async () => {
  let calls = 0;
  const result = await stagedPlan(
    empty(),
    defaultCamera,
    async (_s, feedback) => {
      calls++;
      if (calls === 1)
        return {
          ...box(),
          operations: [{ type: 'create_at', name: 'bad' }],
        } as any;
      expect(feedback?.error).toContain('operations');
      return box();
    },
  );
  expect(calls).toBe(2);
  expect(result.prepared!.session.project.volumes).toHaveLength(1);
});
