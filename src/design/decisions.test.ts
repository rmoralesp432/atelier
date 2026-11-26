import { expect, it } from 'vitest';
import {
  updateDesignNotes,
  decisionCitation,
  compactDesignNotes,
} from './decisions';
import { validateDesign } from './model';
import { validateVolume } from '../model';
import {
  applyPlan,
  directPlan,
  newSession,
  parseSession,
  serializeSession,
} from '../intelligence/engine';
import { defaultCamera, sceneContext } from '../intelligence/context';
import { conversationHistory } from '../intelligence/client';
import { compactScene, agentPlan } from '../../server/agent';
import { readCompletionCriteria } from '../../server/completion';
import { compactCompletionCriteria } from '../../server/completionWire';
import { completionRequestSchema, requestSchema } from '../../server/provider';
import { criteria, measure, selector } from '../../tests/fixtures/completion';
import { verifyCompletion } from '../intelligence/completion';

const quote =
  'Keep a 25 cm gap beside the spindle so the guard can be serviced.';
const origin = {
  id: 'user-turn-original',
  text: `Build the machine. ${quote}`,
};
const note = (text = quote, revises: string | null = null) => ({
  type: 'design_note' as const,
  topic: 'Service access',
  text,
  source: 'user' as const,
  capture: { quote: text, revises },
});
const empty = () => newSession({ volumes: [], selectedId: null });

it('records original user wording only with host source evidence, keeping assumptions and legacy notes distinct', () => {
  const notes = updateDesignNotes([], note(), origin);
  expect(notes[0].decision).toMatchObject({ quote, revision: 1, origin });
  expect(decisionCitation(notes, quote)).toEqual(notes[0].decision);
  expect(() => updateDesignNotes([], note())).toThrow(/exact quotation/);
  expect(() => updateDesignNotes([], note('Use a 90 cm gap.'), origin)).toThrow(
    /exact quotation/,
  );
  expect(() =>
    updateDesignNotes([], { ...note(), source: 'assumption' }, origin),
  ).toThrow(/Assumptions/);
  for (const source of ['assumption', 'drawing', 'user'] as const)
    expect(() =>
      decisionCitation([{ topic: 'Legacy', text: quote, source }], quote),
    ).toThrow(/legacy/);
  const compact = compactDesignNotes(notes)[0];
  expect(compact.decision).toMatchObject({ quote, sourceMessageId: origin.id });
  expect(compact.decision).not.toHaveProperty('origin');
});

it('revises a decision by stable identity even when renamed, without retaining an obsolete active constraint', () => {
  const notes = updateDesignNotes([], note(), origin),
    id = notes[0].decision!.id;
  const revisedQuote =
    'Access is now from the other side; replace that gap with 12 cm.';
  const revision = { id: 'user-turn-revision', text: revisedQuote };
  const updated = updateDesignNotes(
    notes,
    { ...note(revisedQuote, id), topic: 'Guard clearance' },
    revision,
  );
  expect(updated).toHaveLength(1);
  expect(updated[0].decision).toMatchObject({
    id,
    revision: 2,
    quote: revisedQuote,
    origin: revision,
  });
  expect(notes[0].decision!.quote).toBe(quote);
  expect(() => decisionCitation(updated, quote)).toThrow();
  expect(decisionCitation(updated, revisedQuote).id).toBe(id);
  expect(
    updateDesignNotes(
      updated,
      { ...note(revisedQuote, id), topic: 'Guard clearance' },
      revision,
    )[0].decision!.revision,
  ).toBe(2);
  expect(() =>
    updateDesignNotes(notes, {
      ...note(),
      capture: null,
      source: 'assumption',
    }),
  ).toThrow(/Revise/);
  expect(() =>
    updateDesignNotes(notes, note(revisedQuote, 'missing'), revision),
  ).toThrow(/not active/);
  expect(() =>
    validateDesign(
      {
        views: [],
        options: [],
        notes: [notes[0], { ...notes[0], topic: 'Duplicate' }],
      },
      validateVolume,
    ),
  ).toThrow(/identities/);
});

it('persists provenance, atomically rejects invented decisions, and restores both decision versions through reload/Undo/Redo', async () => {
  const original = empty();
  const first = (
    await applyPlan(original, directPlan(note()), defaultCamera, true, origin)
  ).session;
  const id = first.project.design!.notes![0].decision!.id;
  const revisedQuote =
    'Use 12 cm clearance instead; the guard opens sideways now.';
  const revised = (
    await applyPlan(
      first,
      directPlan(note(revisedQuote, id)),
      defaultCamera,
      true,
      { id: 'revision', text: revisedQuote },
    )
  ).session;
  const loaded = parseSession(serializeSession(revised));
  expect(loaded).toEqual(revised);
  const undo = (await applyPlan(loaded, directPlan({ type: 'undo', count: 1 })))
    .session;
  expect(undo.project).toEqual(first.project);
  const redo = (
    await applyPlan(
      parseSession(serializeSession(undo)),
      directPlan({ type: 'redo', count: 1 }),
    )
  ).session;
  expect(redo.project).toEqual(revised.project);
  const bytes = serializeSession(revised);
  await expect(
    applyPlan(
      revised,
      {
        intent: 'apply',
        message: 'Must remain atomic',
        operations: [
          {
            type: 'create_at',
            name: 'Uncommitted part',
            shape: 'box',
            width: 1,
            height: 1,
            depth: 1,
            x: 0,
            y: 0,
            z: 0,
            rotation: 0,
          },
          note('A fabricated instruction.', id),
        ],
      },
      defaultCamera,
      true,
      origin,
    ),
  ).rejects.toThrow(/exact quotation/);
  expect(serializeSession(revised)).toBe(bytes);
});

it('both AI roles recover the same decision after history truncation and reviewer citations measure real rotated solids', async () => {
  const initial = (
    await applyPlan(
      empty(),
      {
        intent: 'apply',
        message: 'Machine',
        operations: [
          {
            type: 'create_at',
            shape: 'cylinder',
            name: 'Spindle',
            width: 0.6,
            depth: 0.6,
            height: 1.1,
            x: 0,
            y: 0,
            z: 0,
            rotation: 37,
          },
          {
            type: 'create_at',
            shape: 'box',
            name: 'Guard',
            width: 0.2,
            depth: 1,
            height: 1.4,
            x: 0.65,
            y: 0,
            z: 0,
            rotation: 0,
          },
          {
            type: 'create_at',
            shape: 'sphere',
            name: 'Unrelated knob',
            width: 0.4,
            depth: 0.4,
            height: 0.4,
            x: 4,
            y: 0,
            z: 2,
            rotation: 0,
          },
          note(),
        ],
      },
      defaultCamera,
      true,
      origin,
    )
  ).session;
  const history = conversationHistory([
    { role: 'user', content: origin.text },
    ...Array.from({ length: 24 }, (_, i) => ({
      role: i % 2 ? ('assistant' as const) : ('user' as const),
      content: 'Other work ' + i,
    })),
  ]);
  expect(history).toHaveLength(20);
  expect(JSON.stringify(history)).not.toContain(quote);
  const scene = sceneContext(
    parseSession(serializeSession(initial)).project,
    initial.context,
    defaultCamera,
  );
  const spindle = initial.project.volumes[0],
    guard = initial.project.volumes[1];
  const prompt =
    'Move the spindle 40 cm to the right, keeping the assembly usable.';
  const correct = (
    await applyPlan(
      initial,
      directPlan({
        type: 'move',
        targets: [spindle.id, guard.id],
        direction: 'east',
        distance: 0.4,
      }),
    )
  ).session;
  const wrong = (
    await applyPlan(
      initial,
      directPlan({
        type: 'move',
        targets: [spindle.id],
        direction: 'east',
        distance: 0.4,
      }),
    )
  ).session;
  const checks = criteria(
    [
      {
        id: 'service-gap',
        label: 'Service access',
        kind: 'offset',
        first: selector([spindle.id]),
        second: selector([guard.id]),
        axis: 'x',
        firstAnchor: 'max',
        secondAnchor: 'min',
        value: 0,
        tolerance: 0.001,
      },
    ],
    [spindle.id, guard.id],
    quote,
  );
  checks.checks[0].source = 'decision';
  checks.checks[0].calculation = {
    frame: 'world_xyz_y_up',
    nodes: [
      {
        kind: 'quantity',
        value: 25,
        unit: 'cm',
        source: 'decision',
        evidence: quote,
      },
    ],
    output: { kind: 'value', node: 0 },
  };
  const payloads: any[] = [];
  const sdk: any = {
    responses: {
      create: async (body: any) => {
        payloads.push(body);
        if (body.tools)
          return {
            status: 'completed',
            output: [
              {
                type: 'function_call',
                name: 'ask_user',
                call_id: 'offline',
                arguments: JSON.stringify({
                  message: 'Offline transport probe only.',
                }),
              },
            ],
          };
        return {
          status: 'completed',
          output_text: JSON.stringify(compactCompletionCriteria(checks)),
        };
      },
    },
  };
  const settings = {
    model: 'offline-no-api',
    textApi: 'responses' as const,
    maxOutputTokens: 3000,
  };
  await agentPlan(
    sdk,
    requestSchema.parse({ message: prompt, history, scene }),
    settings,
  );
  const accepted = await readCompletionCriteria(
    sdk,
    completionRequestSchema.parse({
      message: prompt,
      history,
      scene,
      candidate: [],
    }),
    settings,
  );
  const executorPayload = JSON.parse(payloads[0].input.at(-1).content[0].text);
  const reviewerPayload = JSON.parse(payloads[1].input[0].content[0].text);
  expect(executorPayload.scene.design.notes).toEqual(
    reviewerPayload.original.design.notes,
  );
  expect(compactScene(scene).design!.notes![0].decision!.quote).toBe(quote);
  expect((await verifyCompletion(accepted, initial, correct)).canCommit).toBe(
    true,
  );
  const rejected = await verifyCompletion(accepted, initial, wrong);
  expect(rejected.status).toBe('incorrect');
  expect(rejected.canCommit).toBe(false);
  expect(correct.project.volumes[2]).toEqual(initial.project.volumes[2]);
  expect(correct.project.volumes.map((v) => v.id)).toEqual(
    initial.project.volumes.map((v) => v.id),
  );
  const fabricatedScene = structuredClone(scene);
  delete fabricatedScene.design!.notes![0].decision;
  await expect(
    readCompletionCriteria(
      sdk,
      { message: prompt, history, scene: fabricatedScene, candidate: [] },
      settings,
    ),
  ).rejects.toThrow();
});
