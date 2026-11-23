/** Offline demonstration: scripted language/tool choices, real provider adapter,
 * inspection tool, App transaction, CAD kernel, completion gate and persistence.
 * Nothing here establishes fresh-AI interpretation or autonomous reasoning. */
import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { createProvider, requestSchema } from '../server/provider';
import { criteria, measure, selector } from './fixtures/completion';
import {
  newSession,
  parseSession,
  serializeSession,
} from '../src/intelligence/engine';
import { makeVolume, type Project } from '../src/model';
import { solidStats } from '../src/geometry/kernel';
import type { CompletionCriteria } from '../src/intelligence/completionSchema';
import type { Operation } from '../src/intelligence/plan';

const definitions = [
  ['Oval foot', 'cylinder', 0.6, 0.42, 0.08, 0, 0],
  ['Mast', 'cylinder', 0.06, 0.06, 1.44, 0, 0.08],
  ['Crossbar', 'box', 1.6, 0.06, 0.08, 0, 1.52],
  ['Left suspension', 'cylinder', 0.015, 0.015, 0.5, -0.62, 1.02],
  ['Right suspension', 'cylinder', 0.015, 0.015, 0.72, 0.56, 0.8],
  ['Spherical weight', 'sphere', 0.22, 0.22, 0.22, -0.62, 0.8],
  ['Elliptical weight', 'cylinder', 0.18, 0.12, 0.24, 0.56, 0.56],
] as const;
const createPrompt =
  'Build a freestanding asymmetric display mobile with an oval base, slender central mast, one horizontal crossbar and two hanging weights, one spherical and one elliptical cylindrical. Keep the seven parts separately editable, group the mobile and leave my two existing markers untouched.';
const editPrompt =
  'Raise the crossbar by 0.29 m, extend the mast from its fixed foot, and let both pendants follow without changing their drop or weight shapes. Leave the base and my other objects alone.';
const creation: Operation[] = [
  {
    type: 'assembly',
    name: 'Display mobile',
    origin: { x: 0, y: 0, z: 0 },
    rotation: 0,
    elements: definitions.map(
      ([name, shape, width, depth, height, x, y], i) => ({
        key: `part${i}`,
        name,
        shape,
        dimensions: { width, depth, height },
        position: { x, y, z: 0 },
        rotation: 0,
        role: 'element',
        level: null,
        material: 'solid',
        color: i > 4 ? '#bc815c' : '#6f7c82',
        host: null,
        repeat: null,
      }),
    ),
  },
];
const tool = (name: string, args: unknown) =>
  new Response(
    JSON.stringify({
      id: 'offline',
      object: 'response',
      status: 'completed',
      output: [
        {
          type: 'function_call',
          id: 'offline',
          call_id: 'offline',
          status: 'completed',
          name,
          arguments: JSON.stringify(args),
        },
      ],
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
const step = (operations: Operation[], complete = true) =>
  tool('execute_step', {
    message: 'Apply the measured changes',
    assumptions: ['Offline scripted choices; fresh AI is not being tested.'],
    request_completion: complete,
    operations,
  });
const saved = async (page: Page) =>
  parseSession(
    await page.evaluate(() => localStorage.getItem('atelier.session.v2')!),
  );
async function send(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Message Atelier' }).fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
}
function checks(original: Project, editing: boolean): CompletionCriteria {
  const parts = original.volumes.filter((v) =>
    definitions.some((d) => d[0] === v.name),
  );
  const selection = selector(editing ? parts.map((v) => v.id) : ['$new']);
  const reqs: CompletionCriteria['checks'][number]['requirement'][] = [
    measure('count', 'count', 7, selection),
    {
      kind: 'editable',
      id: 'editable',
      label: 'Separate editable parts',
      selector: selection,
    },
    {
      kind: 'group',
      id: 'group',
      label: 'Assembly membership',
      selector: selection,
      name: 'Display mobile',
      exclusive: true,
    },
  ];
  for (const [i, [name, , width, , height, x, y]] of definitions.entries()) {
    const sel = editing
      ? selector([parts.find((v) => v.name === name)!.id])
      : selector(['$new'], name);
    const dy = editing && name !== 'Oval foot' && name !== 'Mast' ? 0.29 : 0;
    reqs.push(
      measure(
        `height${i}`,
        'height',
        height + (editing && name === 'Mast' ? 0.29 : 0),
        sel,
      ),
    );
    reqs.push(measure(`width${i}`, 'width', width, sel));
    reqs.push({
      kind: 'positions',
      id: `point${i}`,
      label: 'Measured placement',
      selector: sel,
      points: [{ x, y: y + dy, z: 0 }],
      tolerance: 0.00001,
    });
  }
  if (editing)
    reqs.push({
      kind: 'preserve',
      id: 'identities',
      label: 'Retain identities, shapes and horizontal arrangement',
      selector: selection,
      properties: [
        'identity',
        'geometry',
        'width',
        'depth',
        'x',
        'z',
        'rotation',
        'groupId',
      ],
    });
  return criteria(
    reqs,
    editing ? parts.filter((v) => v.name !== 'Oval foot').map((v) => v.id) : [],
    editing ? editPrompt : createPrompt,
  );
}
async function externalMeasurements(project: Project, editing: boolean) {
  const rows = [];
  for (const [name, shape, w, d, h, x, y] of definitions) {
    const v = project.volumes.find((v) => v.name === name)!;
    expect(v).toBeTruthy();
    const stats = await solidStats(v);
    const expectedH = h + (editing && name === 'Mast' ? 0.29 : 0);
    const expectedY =
      y + (editing && name !== 'Oval foot' && name !== 'Mast' ? 0.29 : 0);
    const { min, max } = stats.bounds;
    expect(max[0] - min[0]).toBeCloseTo(w, 5);
    expect(max[2] - min[2]).toBeCloseTo(d, 5);
    expect(max[1] - min[1]).toBeCloseTo(expectedH, 5);
    expect((min[0] + max[0]) / 2).toBeCloseTo(x, 5);
    expect(min[1]).toBeCloseTo(expectedY, 5);
    expect((min[2] + max[2]) / 2).toBeCloseTo(0, 5);
    const analyticVolume =
      shape === 'box'
        ? w * d * expectedH
        : shape === 'sphere'
          ? (Math.PI / 6) * w * d * expectedH
          : (Math.PI / 4) * w * d * expectedH;
    expect(Math.abs(stats.volume / analyticVolume - 1)).toBeLessThan(0.015);
    rows.push({
      id: v.id,
      name,
      bounds: stats.bounds,
      volume: stats.volume,
      analyticVolume,
      expectedY,
      expectedH,
    });
  }
  return rows;
}

test('normal workspace builds and contextually edits an unfamiliar mobile using before/after inspection, with real commits and reload Undo/Redo (scripted provider)', async ({
  page,
}, info) => {
  test.setTimeout(150000);
  const marker = makeVolume(1, { width: 0.16, depth: 0.12, height: 0.14 });
  marker.name = 'Unrelated nearby marker';
  marker.position = { x: 0.4, y: 0, z: 0.22 };
  const other = makeVolume(2, { width: 0.1, depth: 0.18, height: 0.31 });
  other.name = 'Unrelated tall marker';
  other.position = { x: -1.05, y: 0, z: -0.4 };
  const seeded = serializeSession(
    newSession({ volumes: [marker, other], selectedId: null }),
  );
  await page.addInitScript((s) => {
    if (!localStorage.getItem('atelier.session.v2'))
      localStorage.setItem('atelier.session.v2', s);
  }, seeded);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: {
        configured: true,
        authenticated: true,
        voiceConfigured: false,
        agentConfigured: true,
      },
    }),
  );
  const trace: unknown[] = [];
  let beforeEdit: Project | undefined;
  let negative = false;
  await page.route('**/api/completion-criteria', (r) => {
    const b = r.request().postDataJSON();
    // The independent gate keeps receiving the original scene, not candidate measurements.
    expect(b).not.toHaveProperty('sceneReference');
    if (negative)
      return r.fulfill({
        json: criteria(
          [
            {
              kind: 'preserve',
              id: 'preserve-all',
              label: 'Keep all committed geometry intact',
              selector: selector(['$original']),
              properties: ['all'],
            },
          ],
          [],
          b.message,
        ),
      });
    return r.fulfill({
      json: checks(
        beforeEdit ?? (JSON.parse(seeded).project as Project),
        !!beforeEdit,
      ),
    });
  });
  await page.route('**/api/plan', async (r) => {
    const input = requestSchema.parse(r.request().postDataJSON());
    const provider = createProvider(
      'offline-scripted-no-network',
      async (_url, init) => {
        const request = JSON.parse(init!.body as string);
        const last = request.input.at(-1);
        if (input.message === createPrompt) return step(creation);
        const crossbar = input.scene.objects.find(
          (v) => v.name === 'Crossbar',
        )!;
        if (negative)
          return step([
            {
              type: 'move',
              targets: [marker.id],
              direction: 'up',
              distance: 0.1,
            },
          ]);
        if (last.type !== 'function_call_output') {
          const schema = request.tools.find(
            (t: any) => t.name === 'inspect_scene',
          ).parameters;
          expect(schema.required).toContain('snapshot');
          expect(schema.required).toContain('relativeTo');
          return tool('inspect_scene', {
            ids: [],
            role: null,
            snapshot: 'compare',
            relativeTo: crossbar.id,
          });
        }
        const inspection = JSON.parse(last.output);
        expect(inspection.available).toBe(true);
        const rows = inspection.objects as any[];
        const bar = rows.find((o) => o.id === crossbar.id);
        expect(bar.before.position.y).toBe(1.52);
        expect(
          inspection.relations.find(
            (x: any) =>
              x.id ===
              rows.find((o) => o.before?.name === 'Spherical weight').id,
          ).before.forwardGap.y,
        ).toBeCloseTo(-0.8, 6);
        trace.push({ stage: input.execution?.stage, inspection });
        if (bar.state === 'unchanged') {
          // First provisional change; later stages must still see the original bar.
          return step(
            [
              {
                type: 'move',
                targets: [crossbar.id],
                direction: 'up',
                distance: 0.29,
              },
            ],
            false,
          );
        }
        expect(bar.current.position.y).toBeCloseTo(1.81, 6);
        expect((await saved(page)).project).toEqual(beforeEdit);
        const delta = bar.current.position.y - bar.before.position.y;
        const operations: Operation[] = [];
        for (const row of rows.filter(
          (o) =>
            o.before?.groupId === bar.before.groupId &&
            o.id !== bar.id &&
            o.before.name !== 'Oval foot',
        )) {
          if (row.before.name === 'Mast')
            operations.push({
              type: 'edit_components',
              edits: [
                {
                  targets: [row.id],
                  where: [],
                  translation: null,
                  resize: {
                    axis: 'height',
                    mode: 'set',
                    value: row.before.dimensions.height + delta,
                    anchor: 0,
                  },
                },
              ],
            });
          else {
            const relationship = inspection.relations.find(
              (x: any) => x.id === row.id,
            );
            // Read the old signed clearance from tool evidence, not from edited coordinates.
            const wantedY =
              bar.current.spatial.envelopeBounds.max.y +
              relationship.before.forwardGap.y;
            operations.push({
              type: 'position',
              targets: [row.id],
              x: null,
              y: wantedY,
              z: null,
            });
          }
        }
        return step(operations);
      },
      { agent: true, textApi: 'responses' },
    );
    return r.fulfill({ json: await provider.plan(input) });
  });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await send(page, createPrompt);
  await expect
    .poll(async () => (await saved(page)).project.volumes.length, {
      timeout: 60000,
    })
    .toBe(9);
  await expect(
    page.getByRole('button', { name: 'Stop design request', exact: true }),
  ).toBeHidden();
  const created = await saved(page);
  beforeEdit = created.project;
  const initial = await externalMeasurements(created.project, false);
  await page.getByRole('button', { name: 'Frame all', exact: true }).click();
  await page.screenshot({ path: info.outputPath('mobile-before.png') });
  await send(page, editPrompt);
  await expect
    .poll(
      async () =>
        (await saved(page)).project.volumes.find((v) => v.name === 'Mast')
          ?.dimensions.height,
      { timeout: 60000 },
    )
    .toBe(1.73);
  await expect(
    page.getByRole('button', { name: 'Stop design request', exact: true }),
  ).toBeHidden();
  const edited = await saved(page);
  expect(edited.project.volumes.map((v) => v.id)).toEqual(
    created.project.volumes.map((v) => v.id),
  );
  expect(edited.project.volumes.slice(0, 3)).toEqual(
    created.project.volumes.slice(0, 3),
  );
  expect(edited.project.groups).toEqual(created.project.groups);
  expect(edited.past).toHaveLength(created.past.length + 1);
  const final = await externalMeasurements(edited.project, true);
  expect(trace).toHaveLength(2);
  await page.getByRole('button', { name: 'Frame all', exact: true }).click();
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  await page.screenshot({ path: info.outputPath('mobile-after.png') });
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '9',
  );
  expect((await saved(page)).project).toEqual(edited.project);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project)
    .toEqual(created.project);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project)
    .toEqual(edited.project);
  const messages = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('atelier.conversation.v2')!),
  );
  writeFileSync(
    info.outputPath('mobile-created.atelier.json'),
    JSON.stringify(
      {
        ...JSON.parse(serializeSession(created)),
        name: 'Offline mobile — before edit',
        messages: messages.slice(0, 2),
      },
      null,
      2,
    ),
  );
  writeFileSync(
    info.outputPath('mobile-edited.atelier.json'),
    JSON.stringify(
      {
        ...JSON.parse(serializeSession(edited)),
        name: 'Offline mobile — after edit',
        messages,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    info.outputPath('evidence.json'),
    JSON.stringify(
      {
        provenance:
          'Scripted provider and independent criteria; actual App/provider tools/geometry/commit/reload/Undo/Redo. No paid API calls.',
        prompts: [createPrompt, editPrompt],
        trace,
        initial,
        final,
        changed: edited.project.volumes
          .filter(
            (v, i) =>
              JSON.stringify(v) !== JSON.stringify(created.project.volumes[i]),
          )
          .map((v) => ({ id: v.id, name: v.name })),
        preserved: edited.project.volumes
          .filter(
            (v, i) =>
              JSON.stringify(v) === JSON.stringify(created.project.volumes[i]),
          )
          .map((v) => ({ id: v.id, name: v.name })),
        messages,
      },
      null,
      2,
    ),
  );
  // The new read-only access cannot broaden the independent edit scope.
  negative = true;
  if (
    !(await page.getByRole('textbox', { name: 'Message Atelier' }).isVisible())
  )
    await page
      .getByRole('button', { name: 'Voice orb', exact: true })
      .press('Shift+Enter');
  await send(page, 'Keep the mobile and both markers exactly as they are.');
  await expect(
    page.getByRole('button', { name: 'Stop design request', exact: true }),
  ).toBeHidden({ timeout: 60000 });
  expect((await saved(page)).project).toEqual(edited.project);
  expect((await saved(page)).past).toEqual(edited.past);
  const failed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('atelier.conversation.v2')!),
  );
  expect(failed.at(-1).outcome).toBe('failed');
  writeFileSync(
    info.outputPath('negative-control.json'),
    JSON.stringify(
      {
        outcome: 'blocked',
        projectUnchanged: true,
        historyUnchanged: true,
        conversation: failed.slice(-2),
      },
      null,
      2,
    ),
  );
});
