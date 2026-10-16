import { test, expect, type Page } from '@playwright/test';
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
const menu = (page: Page) =>
  page.getByRole('button', { name: 'Projects', exact: true }).click();
test('projects isolate geometry, conversation, site and history, restore on reload and preserve the first workspace', async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://tile.openstreetmap.org/**', (r) =>
    r.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.route('**/api/plan', (r) =>
    r.fulfill({
      json: {
        intent: 'apply',
        message: 'Move the pavilion.',
        operations: [
          {
            type: 'move',
            targets: ['$selected'],
            direction: 'east',
            distance: 2,
          },
        ],
      },
    }),
  );
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await menu(page);
  await page.getByLabel('Current project name').fill('Courtyard study');
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page
    .getByRole('button', { name: 'Close projects', exact: true })
    .click();
  await page.getByRole('button', { name: 'Toggle site map' }).click();
  await page.getByLabel('Latitude', { exact: true }).fill('31.742388');
  await page.getByLabel('Longitude', { exact: true }).fill('-106.439452');
  await page.getByRole('button', { name: 'Show model on map' }).click();
  await page.getByRole('button', { name: 'Close studio settings' }).click();
  await page
    .getByRole('textbox', { name: 'Message Atelier' })
    .fill('Move it east two meters.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Moved');
  const first = await saved(page);
  const firstChat = await page.evaluate(() =>
    localStorage.getItem('atelier.conversation.v2'),
  );
  await menu(page);
  await page
    .getByRole('button', { name: 'Close projects', exact: true })
    .focus();
  await page.keyboard.press('Control+z');
  expect(await saved(page)).toEqual(first);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await saved(page)).toEqual(first);
  await menu(page);
  await page.getByLabel('New project name').fill('Garden house');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '0',
  );
  expect((await saved(page)).past).toHaveLength(0);
  expect((await saved(page)).project.site).toBeUndefined();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('atelier.conversation.v2')!),
    ),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Show objects' }).click();
  await page.getByText('Manual tools', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Create volume', exact: true })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '1',
  );
  const second = await saved(page);
  await menu(page);
  await page.getByRole('button', { name: /Courtyard study/ }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  expect(await saved(page)).toEqual(first);
  expect(
    await page.evaluate(() => localStorage.getItem('atelier.conversation.v2')),
  ).toBe(firstChat);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await saved(page)).project.volumes[0].position.x).toBe(
    first.project.volumes[0].position.x - 2,
  );
  await menu(page);
  await page.getByRole('button', { name: /Garden house/ }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '1',
  );
  expect(await saved(page)).toEqual(second);
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '1',
  );
  expect(await saved(page)).toEqual(second);
  await menu(page);
  await expect(page.locator('.project-entry')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/atelier-projects.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = await page.getByRole('dialog').boundingBox();
  expect(dialog!.x).toBeGreaterThanOrEqual(0);
  expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/atelier-projects-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: /Courtyard study/ }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect.poll(async () => (await saved(page)).future.length).toBe(1);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(await saved(page)).toEqual(first);
  expect(errors).toEqual([]);
});
test('a failed project save keeps the current workspace and project identity', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await menu(page);
  const before = await saved(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      if (this.name === 'projects') {
        this.transaction.abort();
        throw new DOMException('Test storage full', 'QuotaExceededError');
      }
      return original.apply(this, args);
    };
  });
  await page.getByLabel('New project name').fill('Must not switch');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await saved(page)).toEqual(before);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  expect(await saved(page)).toEqual(before);
});
