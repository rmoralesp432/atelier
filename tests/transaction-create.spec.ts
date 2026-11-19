import { test, expect } from '@playwright/test';
import { criteria, measure } from './fixtures/completion';

test.use({ actionTimeout: 15000 });

test('hundreds of newly created components retain preview IDs through finalization, UI activity, persistence and whole-request Undo', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: {
        configured: true,
        authenticated: true,
        agentConfigured: true,
        voiceConfigured: false,
      },
    }),
  );
  await page.route('**/api/completion-criteria', (r) =>
    r.fulfill({
      json: criteria(
        [
          measure('count', 'count', 221),
          measure('width', 'width', 0.43),
          measure('height', 'height', 1.1),
        ],
        [],
        r.request().postDataJSON().message,
      ),
    }),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let waiting = false,
    calls = 0;
  let previewIds: string[] = [];
  await page.route('**/api/plan', async (r) => {
    const b = r.request().postDataJSON();
    calls++;
    const parts = b.scene.objects.filter((o: any) =>
      o.name.startsWith('Fabrication piece'),
    );
    if (calls === 1)
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Create the repeated components',
          planning: {
            stage: 'Construct',
            assumptions: [],
            next: 'Adjust and inspect',
          },
          operations: [
            {
              type: 'create_at',
              name: 'Fabrication piece',
              shape: 'box',
              width: 0.43,
              height: 0.72,
              depth: 0.91,
              x: 18,
              y: 0,
              z: -22,
              rotation: 0,
            },
            {
              type: 'array_grid',
              targets: ['$created'],
              columns: 13,
              rows: 17,
              spacingX: 1.2,
              spacingZ: 1.6,
            },
          ],
        },
      });
    expect(parts).toHaveLength(221);
    if (calls === 2) {
      previewIds = parts.map((o: any) => o.id);
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Set the final height',
          planning: { stage: 'Refine', assumptions: [], next: 'Inspect' },
          operations: [
            {
              type: 'resize',
              targets: previewIds,
              axis: 'height',
              mode: 'set',
              value: 1.1,
            },
          ],
        },
      });
    }
    expect(parts.map((o: any) => o.id)).toEqual(previewIds);
    waiting = true;
    await gate;
    return r.fulfill({
      json: { intent: 'finish', message: 'Complete', operations: [] },
    });
  });
  await page.goto('/');
  const saved = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem('atelier.session.v2')!),
    );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await expect
    .poll(async () => (await saved())?.project?.volumes.length)
    .toBe(2);
  const original = await saved();
  await page
    .getByRole('textbox', { name: 'Message Atelier' })
    .fill(
      'Create an editable arrangement of 221 pieces, 43 cm wide and 1.1 m tall.',
    );
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => waiting, { timeout: 60000 }).toBe(true);
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '223',
  );
  await expect(
    page.getByText('Working preview · not saved yet', { exact: true }),
  ).toBeVisible();
  expect((await saved()).project.volumes).toEqual(original.project.volumes);
  await page.getByRole('button', { name: 'Show objects', exact: true }).click();
  await page.locator('.object-row').first().click();
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  await page.setViewportSize({ width: 1240, height: 820 });
  release();
  await expect
    .poll(async () => (await saved()).project.volumes.length, {
      timeout: 60000,
    })
    .toBe(223);
  const committed = await saved();
  expect(committed.project.volumes.slice(0, 2)).toEqual(
    original.project.volumes,
  );
  expect(committed.project.volumes.slice(2).map((o: any) => o.id)).toEqual(
    previewIds,
  );
  expect(
    committed.project.volumes
      .slice(2)
      .every((o: any) => o.dimensions.height === 1.1),
  ).toBe(true);
  expect(committed.past).toHaveLength(original.past.length + 1);
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '223',
  );
  await expect
    .poll(async () => (await saved()).context)
    .toEqual(committed.context);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => (await saved()).project.volumes)
    .toEqual(original.project.volumes);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect
    .poll(async () => (await saved()).project.volumes)
    .toEqual(committed.project.volumes);
  expect(calls).toBe(3);
  await page.screenshot({
    path: 'test-results/transaction-created-components.png',
  });
});
