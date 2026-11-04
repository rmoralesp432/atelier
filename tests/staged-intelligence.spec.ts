import { expect, test, type Page } from '@playwright/test';

const state = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
async function ready(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
}
async function say(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Message Atelier' }).fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
}
const wall = {
  type: 'create_at',
  name: 'Test gallery wall',
  shape: 'box',
  width: 8,
  depth: 0.3,
  height: 4,
  x: 20,
  y: 0,
  z: 0,
  rotation: 0,
};

test('staged construction uses real geometry IDs, commits once, and can be undone in one action (provider fixtures)', async ({
  page,
}) => {
  test.setTimeout(90000);
  let id = '',
    turn = 0;
  let release!: () => Promise<void>;
  await page.route('**/api/plan', async (r) => {
    const body = r.request().postDataJSON();
    turn++;
    if (turn === 1)
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'A gallery wall.',
          operations: [wall],
          planning: {
            stage: 'Wall',
            next: 'Create the opening',
            assumptions: ['Wall thickness is 30 cm.'],
          },
        },
      });
    if (turn === 2) {
      const created = body.scene.objects.find((v: any) => v.name === wall.name);
      id = created.id;
      expect(body.execution.receipts[0].created).toEqual([id]);
      expect(created.dimensions).toEqual({ width: 8, depth: 0.3, height: 4 });
      release = () =>
        r.fulfill({
          json: {
            intent: 'apply',
            message: 'An opening in the wall.',
            operations: [
              {
                type: 'opening',
                target: id,
                width: 2,
                height: 2,
                sill: 1,
                offset: 0,
              },
              {
                type: 'verify',
                targets: [id],
                metric: 'volume',
                comparison: 'equal',
                value: 8.4,
                tolerance: 0.001,
              },
              {
                type: 'design_note',
                topic: 'Envelope',
                text: '8 m wall with a 2 × 2 m opening, sill 1 m.',
                source: 'user',
              },
            ],
            planning: {
              stage: 'Opening',
              next: 'Review measured geometry',
              assumptions: [],
            },
          },
        });
      return;
    }
    expect(body.scene.objects.find((v: any) => v.id === id).opening).toBe(true);
    expect(body.execution.receipts[1].result).toContain('Verified volume: 8.4');
    return r.fulfill({
      json: {
        intent: 'finish',
        message: 'Gallery wall and opening checked.',
        operations: [],
        planning: { stage: 'Checked', next: null, assumptions: [] },
      },
    });
  });
  await ready(page);
  const original = await state(page);
  await say(
    page,
    'Create a gallery wall with an opening and check its geometry.',
  );
  await expect.poll(() => turn).toBe(2);
  expect((await state(page)).project).toEqual(original.project); // No partial save.
  await release();
  await expect(page.getByRole('log')).toContainText(
    'Gallery wall and opening checked.',
  );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
  );
  const completed = await state(page);
  expect(
    completed.project.volumes.find((v: any) => v.id === id).geometry.kind,
  ).toBe('boolean');
  expect(completed.past.length).toBe(original.past.length + 1);
  await expect(
    page.getByRole('region', { name: 'Review geometry change' }),
  ).toBeHidden();
  await page.screenshot({
    path: 'test-results/checked-architectural-design.png',
  });
  await page.reload();
  expect((await state(page)).project.design.notes[0].topic).toBe('Envelope');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  expect((await state(page)).project.volumes).toEqual(original.project.volumes);
});

test('Stop cancels an unfinished staged design without saving provisional geometry', async ({
  page,
}) => {
  test.setTimeout(60000);
  let turn = 0;
  await page.route('**/api/plan', (r) => {
    turn++;
    if (turn === 1)
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Wall',
          operations: [wall],
          planning: { stage: 'Wall', next: 'Inspect', assumptions: [] },
        },
      });
    // Keep the continuation pending until the actual fetch is aborted.
  });
  await ready(page);
  const original = await state(page);
  await say(page, 'Develop a gallery.');
  await expect.poll(() => turn).toBe(2);
  await page.getByRole('button', { name: 'Stop design request' }).click();
  await expect(page.getByRole('log')).toContainText(
    'Stopped. No changes were applied',
  );
  expect((await state(page)).project).toEqual(original.project);
});

test('six image references reach every construction stage and remain available on the next conversation turn (provider fixtures)', async ({
  page,
}) => {
  test.setTimeout(90000);
  let turn = 0;
  const received: string[][] = [];
  await page.route('**/api/plan', (r) => {
    const body = r.request().postDataJSON();
    received.push(
      body.images?.length
        ? body.images
        : body.history.findLast((m: any) => m.images?.length)?.images,
    );
    expect(received.at(-1)).toHaveLength(6);
    if (turn++ === 0)
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Study wall',
          operations: [wall],
          planning: {
            stage: 'Reference study',
            next: 'Inspect',
            assumptions: ['Unseen faces are inferred.'],
          },
        },
      });
    return r.fulfill({
      json: body.execution
        ? {
            intent: 'finish',
            message: 'Editable interpretation ready.',
            operations: [],
            planning: null,
          }
        : {
            intent: 'clarify',
            message: 'The six references are available for this revision.',
            operations: [],
            planning: null,
          },
    });
  });
  await ready(page);
  const png = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const g = c.getContext('2d')!;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 128, 128);
      g.strokeRect(20, 20, 80, 60);
      return c.toDataURL('image/png').split(',')[1];
    }),
    'base64',
  );
  await page
    .getByLabel('Attach reference image file')
    .setInputFiles(
      Array.from({ length: 6 }, (_, i) => ({
        name: `drawing-${i + 1}.png`,
        mimeType: 'image/png',
        buffer: png,
      })),
    );
  await expect(page.locator('.pending-references img')).toHaveCount(6);
  await say(
    page,
    'Interpret these plans and elevations at the supplied scale.',
  );
  await expect(page.getByRole('log')).toContainText(
    'Editable interpretation ready.',
  );
  expect(received[0]).toEqual(received[1]);
  await say(page, 'Tell me which portions are inferred.');
  await expect(page.getByRole('log')).toContainText(
    'six references are available',
  );
  expect(received[2]).toEqual(received[0]);
});
