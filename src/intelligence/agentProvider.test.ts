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
      toolResponse('responses', 'finish_task', {
        message: 'Created it.',
        outcome: 'completed',
      }),
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

it.each(['responses', 'chat_completions'] as const)(
  'keeps actual model observations distinct from reference images on %s',
  async (api) => {
    let request: any;
    const provider = createProvider(
      'offline-test',
      async (_url, init) => {
        request = JSON.parse(init!.body as string);
        return toolResponse(api, 'execute_step', {
          message: 'Construct study',
          assumptions: [],
          operations: box().operations,
        });
      },
      { agent: true, textApi: api },
    );
    await provider.plan({
      ...input(),
      images: ['data:image/jpeg;base64,cmVm'],
      observation: {
        status: 'ready',
        note: 'Actual provisional scene',
        objectIds: [],
        views: [{ label: 'Oblique', image: 'data:image/jpeg;base64,bW9kZWw=' }],
      },
    });
    const messages = api === 'responses' ? request.input : request.messages;
    const content = messages.at(-1).content;
    expect(
      content.some(
        (p: any) => p.text === 'MODEL OBSERVATION (not a reference): Oblique',
      ),
    ).toBe(true);
    const urls = content
      .filter((p: any) => p.type === 'input_image' || p.type === 'image_url')
      .map((p: any) => p.image_url.url ?? p.image_url);
    expect(urls).toEqual([
      'data:image/jpeg;base64,cmVm',
      'data:image/jpeg;base64,bW9kZWw=',
    ]);
    expect(content[0].text).not.toContain('base64');
  },
);

it('discards a blocked task instead of committing its successful partial steps or retrying it as invalid JSON', async () => {
  const original = empty();
  let calls = 0;
  const provider = createProvider(
    'offline-test',
    async () => {
      calls++;
      return calls === 1
        ? toolResponse('responses', 'execute_step', {
            message: 'Construct first piece',
            assumptions: [],
            operations: box().operations,
          })
        : toolResponse('responses', 'finish_task', {
            outcome: 'blocked',
            message: 'The remaining requested surface is unsupported.',
          });
    },
    { agent: true },
  );
  await expect(
    stagedPlan(
      original,
      defaultCamera,
      (s, validationFeedback, execution) =>
        provider.plan({
          ...input(),
          scene: sceneContext(s.project, s.context, defaultCamera),
          validationFeedback,
          execution,
        }),
      undefined,
      undefined,
      { agent: true },
    ),
  ).rejects.toThrow('No changes were applied');
  expect(calls).toBe(2);
  expect(original.project.volumes).toHaveLength(0);
});

it('provides a compact complete inventory and full actual construction on inspection', async () => {
  const s = (await applyPlan(empty(), box())).session;
  const scene = sceneContext(s.project, s.context, defaultCamera);
  const requests: any[] = [];
  const provider = createProvider(
    'offline-test',
    async (_url, init) => {
      requests.push(JSON.parse(init!.body as string));
      return requests.length === 1
        ? toolResponse('responses', 'inspect_scene', {
            ids: [s.project.volumes[0].id],
            role: null,
          })
        : toolResponse('responses', 'execute_step', {
            message: 'Measure actual geometry',
            assumptions: [],
            operations: [
              { type: 'measure', targets: ['$focus'], metric: 'properties' },
            ],
          });
    },
    { agent: true },
  );
  await provider.plan({ ...input(), scene });
  const inventory = JSON.parse(requests[0].input.at(-1).content[0].text).scene;
  expect(inventory.objects.map((o: any) => o.id)).toEqual(
    scene.objects.map((o) => o.id),
  );
  expect(inventory.objects[0].dimensions).toEqual(scene.objects[0].dimensions);
  expect(inventory.objects[0]).not.toHaveProperty('construction');
  const inspected = JSON.parse(
    requests[1].input.find((i: any) => i.type === 'function_call_output')
      .output,
  );
  expect(inspected.objects).toEqual(scene.objects);
});
