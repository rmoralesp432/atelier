import { it, expect } from 'vitest';
import { createProvider } from '../../server/provider';
import { initialProject } from '../model';
import { sceneContext, defaultCamera, emptyContext } from './context';
it('uses the actual Responses SDK contract with strict schema, scene context and no stored responses', async () => {
  let body: any;
  const provider = createProvider(
    'test-only-not-a-credential',
    async (_url, init) => {
      body = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({
          id: 'response_test',
          object: 'response',
          status: 'completed',
          output: [
            {
              id: 'msg_test',
              type: 'message',
              role: 'assistant',
              status: 'completed',
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify({
                    intent: 'clarify',
                    message: 'Which building should I move?',
                    operations: [],
                  }),
                  annotations: [],
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    },
  );
  const plan = await provider.plan({
    message: 'Could you nudge the pavilion toward the street?',
    workspace: {
      mapVisible: false,
      arActive: true,
      mapConfigured: false,
      view: 'perspective',
      theme: 'night',
      renderMode: 'studio',
      section: {
        enabled: true,
        planeVisible: false,
        axis: 'y',
        position: 4.5,
        flip: false,
      },
    },
    history: [],
    images: ['data:image/png;base64,aGVsbG8='],
    scene: sceneContext(initialProject(), emptyContext(), defaultCamera),
    pendingReview: {
      message: 'Replace Main pavilion with two floor slabs and a roof.',
    },
  });
  expect(plan.intent).toBe('clarify');
  expect(body.store).toBe(false);
  expect(JSON.parse(body.input[0].content[0].text).workspace.arActive).toBe(
    true,
  );
  expect(JSON.parse(body.input[0].content[0].text).workspace.section).toEqual({
    enabled: true,
    planeVisible: false,
    axis: 'y',
    position: 4.5,
    flip: false,
  });
  expect(body.input[0].content[1]).toEqual({
    type: 'input_image',
    image_url: 'data:image/png;base64,aGVsbG8=',
    detail: 'high',
  });
  expect(body.text.format.strict).toBe(true);
  expect(body.text.format.type).toBe('json_schema');
  expect(body.text.format.schema.required).toContain('brief');
  expect(body.instructions).toContain('INTENT → DESIGN BRIEF');
  expect(
    JSON.parse(body.input[0].content[0].text).scene.understanding,
  ).toMatchObject({ inventory: expect.any(Array), focus: expect.any(Object) });
  // A live Responses request rejected `oneOf` at operations.items. Inspect
  // the actual serialized SDK request so the transport double cannot hide it.
  const items = body.text.format.schema.properties.operations.items;
  expect(items.oneOf).toBeUndefined();
  expect(items.anyOf.length).toBeGreaterThan(1);
  const types = items.anyOf.map((branch: any) => branch.properties.type.const);
  expect(new Set(types).size).toBe(types.length);
  expect(types).toContain('building_components');
  expect(types).not.toContain('building');
  for (const branch of items.anyOf) {
    expect(branch.additionalProperties).toBe(false);
    expect([...branch.required].sort()).toEqual(
      Object.keys(branch.properties).sort(),
    );
  }
  expect(body.input[0].content[0].text).toContain('toward the street');
  expect(
    JSON.parse(body.input[0].content[0].text).pendingReview.message,
  ).toContain('two floor slabs');
});
it('uses the realtime Calls SDK with SDP and a tool routed into the modeling planner', async () => {
  let form: FormData | undefined;
  const provider = createProvider(
    'test-only-not-a-credential',
    async (_url, init) => {
      form = init?.body as FormData;
      return new Response('v=0\r\ns=voice-answer\r\n', {
        status: 201,
        headers: { 'Content-Type': 'application/sdp' },
      });
    },
  );
  expect(await provider.voice('v=0\r\ns=offer\r\n')).toContain('voice-answer');
  expect(await (form?.get('sdp') as Blob).text()).toContain('offer');
  const session = JSON.parse(await (form?.get('session') as Blob).text());
  expect(session.audio.input.turn_detection.type).toBe('semantic_vad');
  expect(session.tools[0].name).toBe('design');
  expect(session.instructions).toContain('Never invent geometry changes');
  expect(session.instructions).toContain('spoken answer to design');
});
it('does not automatically repeat a provider billing rejection', async () => {
  let requests = 0;
  const provider = createProvider('test-only-not-a-credential', async () => {
    requests++;
    return new Response(
      JSON.stringify({
        error: {
          message: 'Insufficient credit',
          type: 'insufficient_quota',
          code: 'insufficient_quota',
        },
      }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  });
  await expect(
    provider.plan({
      message: 'Create a pavilion.',
      history: [],
      scene: sceneContext(initialProject(), emptyContext(), defaultCamera),
    }),
  ).rejects.toThrow();
  expect(requests).toBe(1);
});

it('keeps every nested provider object strict and exposes the staged/architectural tools', async () => {
  const { planJsonSchema } = await import('./plan');
  const walk = (schema: any) => {
    if (!schema || typeof schema !== 'object') return;
    if (schema.type === 'object') {
      expect(schema.additionalProperties).toBe(false);
      expect([...(schema.required ?? [])].sort()).toEqual(
        Object.keys(schema.properties ?? {}).sort(),
      );
    }
    Object.values(schema).forEach((v) =>
      Array.isArray(v) ? v.forEach(walk) : walk(v),
    );
  };
  walk(planJsonSchema);
  const properties = planJsonSchema.properties as any;
  expect(planJsonSchema.required).toContain('planning');
  expect(planJsonSchema.required).toContain('brief');
  expect(properties.intent.enum).toContain('finish');
  expect(
    properties.operations.items.anyOf.map(
      (op: any) => op.properties.type.const,
    ),
  ).toEqual(
    expect.arrayContaining([
      'assembly',
      'select_query',
      'verify',
      'material',
      'design_note',
      'solar_study',
    ]),
  );
});
it('project concierge uses a constrained project tool instead of modeling tools (SDK transport double)', async () => {
  let session: any;
  const provider = createProvider(
    'test-only-not-a-credential',
    async (_url, init) => {
      session = JSON.parse(
        await ((init?.body as FormData).get('session') as Blob).text(),
      );
      return new Response('v=0\r\ns=lobby\r\n', { status: 201 });
    },
  );
  await provider.voice('v=0\r\ns=offer\r\n', [
    { id: 'garden', name: 'Garden project' },
  ]);
  expect(session.tools[0].name).toBe('open_project');
  expect(session.tools[0].parameters.properties.projectId.enum).toEqual([
    'garden',
  ]);
  expect(session.instructions).toContain('untrusted labels');
  expect(session.tools.some((t: any) => t.name === 'design')).toBe(false);
});
