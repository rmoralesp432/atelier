import { expect, test, type Page } from '@playwright/test';
import type { Plan, Operation } from '../src/intelligence/plan';
test('serves the real backend with honest unconfigured AI status', async ({
  request,
}) => {
  const health = await request.get('/healthz');
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: 'ok' });
  const config = await request.get('/api/config');
  expect(await config.json()).toEqual({
    configured: false,
    authenticated: true,
    voiceConfigured: false,
  });
  const unavailable = await request.post('/api/plan', {
    data: { message: 'Create two boxes.' },
  });
  expect(unavailable.status()).toBe(503);
  expect((await unavailable.json()).error).toContain('AI is not configured');
});
const makePlan = (
  operations: Operation[],
  message = 'Proposed geometry edit',
): Plan => ({ intent: 'apply', message, operations });
async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await expect(page.locator('canvas')).toBeVisible();
}
async function say(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Message Atelier' }).fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
}
async function fixture(page: Page, plan: (body: any) => Plan) {
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  await page.route('**/api/plan', (r) =>
    r.fulfill({ json: plan(r.request().postDataJSON()) }),
  );
}
async function importProject(page: Page, volumes: any[]) {
  await page.getByLabel('Import project file').setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        volumes,
        selectedId: volumes[0]?.id ?? null,
      }),
    ),
  });
  await expect(page.locator('.object-row')).toHaveCount(volumes.length);
}
const box = (id: string, x = 0) => ({
  id,
  name: id,
  dimensions: { width: 4, depth: 4, height: 4 },
  position: { x, y: 0, z: 0 },
  rotation: 0,
});
test('actual WebGL rendering, orbit, view changes and collapsible inspector', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/atelier-phase2-desktop.png' });
  const canvas = page.locator('canvas'),
    before = await canvas.screenshot(),
    r = (await canvas.boundingBox())!;
  await page.mouse.move(r.x + r.width * 0.65, r.y + r.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.8, r.y + r.height * 0.6, {
    steps: 12,
  });
  await page.mouse.up();
  await page.waitForTimeout(500);
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  await page.getByRole('button', { name: 'Frame all', exact: true }).click();
  await page.getByRole('button', { name: 'Perspective', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Top view', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Collapse inspector' }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Width', exact: true }),
  ).toBeHidden();
  await page.getByRole('button', { name: 'Expand inspector' }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Width', exact: true }),
  ).toHaveValue('14');
  expect(errors).toEqual([]);
});
test('migrates legacy projects without overwriting them and preserves precise edits and undo after reload', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('atelier.project.v1'))
      localStorage.setItem(
        'atelier.project.v1',
        JSON.stringify({
          version: 1,
          volumes: [
            {
              id: 'legacy',
              name: 'Existing project',
              dimensions: { width: 7, depth: 5, height: 3 },
              position: { x: 0, y: 0, z: 0 },
              rotation: 0,
            },
          ],
          selectedId: 'legacy',
        }),
      );
  });
  await page.goto('/');
  const w = page.getByRole('spinbutton', { name: 'Width', exact: true });
  await expect(w).toHaveValue('7');
  await w.fill('8.125');
  await w.press('Enter');
  await expect(w).toHaveValue('8.125');
  await page.reload();
  await expect(w).toHaveValue('8.125');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(w).toHaveValue('7');
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('atelier.project.v1')!).volumes[0]
          .dimensions.width,
    ),
  ).toBe(7);
  await w.fill('-1');
  await w.press('Enter');
  await expect(page.getByRole('alert')).toContainText(
    'Dimensions must be between',
  );
  await expect(w).toHaveValue('7');
});
test('direct primitives, extrusion, viewport selection and exact measurements remain functional without AI', async ({
  page,
}) => {
  await ready(page);
  await page.getByLabel('Primitive shape').selectOption('circle');
  await page.getByRole('button', { name: 'Add shape', exact: true }).click();
  await expect(page.locator('.object-row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Extrude 3 m', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Height', exact: true }),
  ).toHaveValue('3');
  await expect(page.getByTestId('volume-stat')).not.toHaveText('0 m³');
  await page
    .getByRole('button', { name: 'Clear selection', exact: true })
    .click();
  const canvas = page.locator('canvas'),
    r = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: r.width / 2, y: r.height / 2 } });
  await expect(
    page.getByRole('textbox', { name: 'Object name', exact: true }),
  ).toBeVisible();
  await canvas.click({ position: { x: r.width - 25, y: r.height - 85 } });
  await expect(page.getByText('Make a selection')).toBeVisible();
});
test('success sequence through UI and genuine CSG using explicit model-response fixtures (not live AI)', async ({
  page,
}) => {
  let turn = 0;
  await fixture(page, (body) => {
    const objects = body.scene.objects;
    const first = objects[0]?.id,
      second = objects[1]?.id;
    const plans = [
      makePlan([
        {
          type: 'create',
          shape: 'box',
          width: 12,
          depth: 8,
          height: 6,
          count: 2,
        },
      ]),
      makePlan([
        { type: 'move', targets: [second], direction: 'right', distance: 2 },
      ]),
      makePlan([
        {
          type: 'resize',
          targets: ['$selected'],
          axis: 'height',
          mode: 'scale',
          value: 1.1,
        },
      ]),
      makePlan([
        {
          type: 'place',
          target: second,
          reference: first,
          relation: 'overlap',
          direction: 'east',
          gap: null,
        },
      ]),
      makePlan(
        [{ type: 'boolean', operation: 'subtract', targets: [first, second] }],
        'Subtract the second box from the first.',
      ),
      makePlan(
        [
          { type: 'undo', count: 1 },
          { type: 'boolean', operation: 'intersect', targets: ['$operands'] },
        ],
        'Undo subtraction and intersect the original boxes.',
      ),
      makePlan([
        {
          type: 'resize',
          targets: ['$selected'],
          axis: 'width',
          mode: 'scale',
          value: 1.1,
        },
      ]),
    ];
    return plans[turn++];
  });
  await ready(page);
  await importProject(page, []);
  await say(page, 'Create two boxes.');
  await expect(page.locator('.object-row')).toHaveCount(2);
  await say(page, 'Move the second one to the right.');
  await expect(page.getByRole('log')).toContainText('2 m right');
  await say(page, 'Make it taller.');
  await expect(
    page.getByRole('spinbutton', { name: 'Height', exact: true }),
  ).toHaveValue('6.6');
  await say(page, 'Now overlap them.');
  await expect(page.getByRole('log')).toContainText('Overlapped');
  await say(page, 'Subtract this one from that one.');
  await page.getByRole('button', { name: 'Apply change', exact: true }).click();
  await expect(page.locator('.object-row')).toHaveCount(1);
  await expect(page.getByTestId('volume-stat')).toHaveText('288 m³');
  await say(page, 'Actually, undo that and intersect them instead.');
  await page.getByRole('button', { name: 'Apply change', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: 'Object name', exact: true }),
  ).toHaveValue(/intersect/);
  await expect(page.getByTestId('volume-stat')).toHaveText('288 m³');
  await say(page, 'Make the result a little wider.');
  await expect(page.getByTestId('volume-stat')).toHaveText('316.8 m³');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '1',
  );
  await page.screenshot({ path: 'test-results/atelier-conversation-csg.png' });
});
test('clarification and stale destructive reviews preserve existing geometry', async ({
  page,
}) => {
  let turn = 0;
  await fixture(page, (body) =>
    turn++ === 0
      ? {
          intent: 'clarify',
          message: 'Which two objects should I align, and on which axis?',
          operations: [],
        }
      : makePlan(
          [
            {
              type: 'boolean',
              operation: 'subtract',
              targets: body.scene.objects.map((o: any) => o.id),
            },
          ],
          'Subtract annex from pavilion.',
        ),
  );
  await ready(page);
  await say(page, 'Align these.');
  await expect(page.getByRole('log')).toContainText('which axis');
  await expect(page.locator('.object-row')).toHaveCount(2);
  await say(page, 'Subtract the annex.');
  await expect(
    page.getByRole('region', { name: 'Review geometry change' }),
  ).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Width', exact: true }).fill('20');
  await page
    .getByRole('spinbutton', { name: 'Width', exact: true })
    .press('Enter');
  await page.getByRole('button', { name: 'Apply change', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('changed');
  await expect(page.locator('.object-row')).toHaveCount(2);
});
test('JSON project plus history export/import and invalid file protection', async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole('button', { name: 'Create volume', exact: true })
    .click();
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export project', exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('atelier-project.json');
  await page
    .getByRole('button', { name: 'Delete volume', exact: true })
    .click();
  await expect(page.locator('.object-row')).toHaveCount(2);
  await page
    .getByLabel('Import project file')
    .setInputFiles((await download.path())!);
  await expect(page.locator('.object-row')).toHaveCount(3);
  await page.getByLabel('Import project file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":9000}'),
  });
  await expect(page.getByRole('alert')).toContainText('Unsupported project');
  await expect(page.locator('.object-row')).toHaveCount(3);
});
test('real translation handles preserve snapping and undo', async ({
  page,
}) => {
  await ready(page);
  await importProject(page, [box('single')]);
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '1',
  );
  await page.getByRole('button', { name: 'Perspective', exact: true }).click();
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await page.waitForTimeout(800);
  const r = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(r.x + r.width / 2 + 45, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + 125, r.y + r.height / 2, {
    steps: 15,
  });
  await page.mouse.up();
  const x = page.getByRole('spinbutton', { name: 'X', exact: true });
  await expect(x).not.toHaveValue('0');
  expect(Number(await x.inputValue()) % 0.5).toBe(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(x).toHaveValue('0');
});
test('missing AI credentials show an honest error and voice is not simulated', async ({
  page,
}) => {
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: false, authenticated: true, voiceConfigured: false },
    }),
  );
  await page.route('**/api/plan', (r) =>
    r.fulfill({
      status: 503,
      json: {
        error:
          'AI is not configured. Add ATELIER_OPENAI_API_KEY securely on the server.',
      },
    }),
  );
  await ready(page);
  await expect(
    page.getByRole('button', { name: 'Start voice conversation' }),
  ).toBeDisabled();
  await say(page, 'Design a small courtyard house.');
  await expect(page.getByRole('log')).toContainText('AI is not configured');
  await expect(page.locator('.object-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Connect AI', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Never add a provider key',
  );
});

test('direct wall opening and cutter parameter edits produce persistent solid geometry', async ({
  page,
}) => {
  await ready(page);
  await importProject(page, [
    { ...box('Wall'), dimensions: { width: 10, depth: 0.4, height: 3 } },
  ]);
  await page.getByRole('button', { name: 'Cut opening', exact: true }).click();
  await page.getByRole('button', { name: 'Apply change', exact: true }).click();
  await expect(page.getByTestId('volume-stat')).toHaveText('10.992 m³');
  const width = page.getByRole('spinbutton', {
    name: 'Opening width',
    exact: true,
  });
  await width.fill('2');
  await width.press('Enter');
  await expect(page.getByTestId('volume-stat')).toHaveText('10.32 m³');
  await page.reload();
  await expect(width).toHaveValue('2');
  await expect(page.getByTestId('volume-stat')).toHaveText('10.32 m³');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(width).toHaveValue('1.2');
  await page.screenshot({ path: 'test-results/atelier-real-opening.png' });
});

test('session import retains imported undo history and a backup of the receiving session', async ({
  page,
}) => {
  await ready(page);
  const original = box('Imported');
  const earlier = {
    ...original,
    dimensions: { ...original.dimensions, width: 2 },
  };
  await page.getByLabel('Import project file').setInputFiles({
    name: 'session.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: 2,
        project: { volumes: [original], selectedId: original.id },
        past: [{ volumes: [earlier], selectedId: earlier.id }],
        future: [],
        context: {
          focusIds: [original.id],
          lastCreatedIds: [original.id],
          lastOperands: [],
          lastOperation: 'resize',
        },
      }),
    ),
  });
  await expect(
    page.getByRole('spinbutton', { name: 'Width', exact: true }),
  ).toHaveValue('4');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.object-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Width', exact: true }),
  ).toHaveValue('2');
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('atelier.session.v2.before-import')!)
          .project.volumes.length,
    ),
  ).toBe(2);
});
