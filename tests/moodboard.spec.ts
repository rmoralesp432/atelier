import { test, expect, type Page } from '@playwright/test';
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
const open = (page: Page) =>
  page.getByRole('button', { name: 'Pull up moodboard' }).click();
const persisted = (page: Page) =>
  page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('atelier-projects', 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const records = await new Promise<any[]>((resolve, reject) => {
      const r = db.transaction('projects').objectStore('projects').getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    db.close();
    return records;
  });
async function addImage(page: Page) {
  const image = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 550;
    const x = c.getContext('2d')!;
    x.fillStyle = '#d5b08d';
    x.fillRect(0, 0, 800, 550);
    x.fillStyle = '#314c48';
    x.fillRect(120, 100, 250, 450);
    x.fillStyle = '#f2e5cb';
    x.beginPath();
    x.arc(500, 270, 140, 0, Math.PI * 2);
    x.fill();
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Moodboard image', { exact: true }).setInputFiles({
    name: 'Light and form.png',
    mimeType: 'image/png',
    buffer: Buffer.from(image, 'base64'),
  });
}
test('a real 3D moodboard mixes images, model snapshots and references; arranging, undo, backup and reload preserve geometry', async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
  const before = await saved(page);
  await open(page);
  await addImage(page);
  const board = page.getByTestId('moodboard-viewport');
  await expect(board).toHaveAttribute('data-items', '1');
  await expect(board).toHaveAttribute('data-animating', 'false', {
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Add model to board' }).click();
  await expect(board).toHaveAttribute('data-items', '2');
  await page
    .getByRole('button', { name: 'Add reference', exact: true })
    .click();
  await page
    .getByLabel('Idea or reference')
    .fill('Soft light through a deep courtyard');
  await page
    .getByLabel('Reference link (optional)')
    .fill('https://example.com/courtyard');
  await page.getByRole('button', { name: 'Place reference' }).click();
  await expect(board).toHaveAttribute('data-items', '3');
  await page
    .getByRole('button', { name: 'Light and form', exact: true })
    .click();
  const center = JSON.parse((await board.getAttribute('data-centers'))!)[0];
  await page.mouse.move(center.x - 45, center.y - 30);
  await page.mouse.down();
  await page.mouse.move(center.x + 10, center.y + 5, { steps: 10 });
  await page.mouse.up();
  await expect
    .poll(async () => (await persisted(page))[0].moodboard.items[0].position.x)
    .not.toBe(-5);
  await page.getByLabel('Moodboard item depth').fill('2');
  await page.getByLabel('Moodboard item rotation').fill('30');
  await page.getByRole('button', { name: 'Undo moodboard edit' }).click();
  await expect(page.getByLabel('Moodboard item rotation')).toHaveValue('0');
  await page.getByRole('button', { name: 'Redo moodboard edit' }).click();
  await expect(page.getByLabel('Moodboard item rotation')).toHaveValue('30');
  await page.getByRole('button', { name: 'Frame moodboard' }).click();
  await expect(
    page.getByText('Saved with this project', { exact: true }),
  ).toBeVisible();
  await expect(board).toHaveAttribute('data-ready', 'true');
  await page.screenshot({ path: 'test-results/atelier-moodboard.png' });
  const boardData = (await persisted(page))[0].moodboard;
  await page.getByRole('button', { name: 'Back to model' }).click();
  expect(await saved(page)).toEqual(before);
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export project', exact: true })
    .click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.moodboard).toEqual(boardData);
  expect(backup.project).toEqual(before.project);
  await page.reload();
  await open(page);
  await expect(board).toHaveAttribute('data-items', '3');
  await expect(page.getByLabel('Moodboard item rotation')).toHaveValue('30');
  expect((await persisted(page))[0].moodboard).toEqual(boardData);
  expect(await saved(page)).toEqual(before);
  expect(errors).toEqual([]);
});
test('each project owns a separate moodboard and can borrow a saved model without importing it into geometry', async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByLabel('Current project name').fill('Courtyard');
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page
    .getByRole('button', { name: 'Close projects', exact: true })
    .click();
  await open(page);
  await addImage(page);
  await expect(page.getByTestId('moodboard-viewport')).toHaveAttribute(
    'data-items',
    '1',
  );
  await expect(
    page.getByText('Saved with this project', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to model' }).click();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByLabel('New project name').fill('Material exploration');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '0',
  );
  await open(page);
  await expect(page.getByText('Ideas, in space.')).toBeVisible();
  await page
    .getByLabel('Moodboard model source')
    .selectOption({ label: 'Courtyard' });
  await page.getByRole('button', { name: 'Add model to board' }).click();
  await expect(page.getByTestId('moodboard-viewport')).toHaveAttribute(
    'data-items',
    '1',
  );
  await expect(
    page.getByText('Saved with this project', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to model' }).click();
  expect((await saved(page)).project.volumes).toHaveLength(0);
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: /Courtyard/ }).click();
  await open(page);
  await expect(
    page.getByRole('button', { name: 'Light and form', exact: true }),
  ).toBeVisible();
  expect((await saved(page)).project.volumes).toHaveLength(2);
});
test('phone moodboard is reachable and the shared model-fixture workspace action pulls it up', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  await page.route('**/api/plan', (r) =>
    r.fulfill({
      json: {
        intent: 'apply',
        message: 'Your moodboard is ready.',
        operations: [{ type: 'workspace', action: 'moodboard_open' }],
      },
    }),
  );
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Message Atelier' });
  await input.fill('Pull up my moodboard');
  await input.press('Enter');
  await expect(
    page.getByRole('dialog', { name: '3D moodboard' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add model to board' }).click();
  await expect(page.getByTestId('moodboard-viewport')).toHaveAttribute(
    'data-items',
    '1',
  );
  const box = await page
    .getByRole('dialog', { name: '3D moodboard' })
    .boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await expect(page.getByTestId('moodboard-viewport')).toHaveAttribute(
    'data-animating',
    'false',
    { timeout: 10000 },
  );
  await page.screenshot({ path: 'test-results/atelier-moodboard-phone.png' });
  await page.getByRole('button', { name: 'Back to model' }).click();
  await open(page);
  await expect(page.getByTestId('moodboard-viewport')).toHaveAttribute(
    'data-items',
    '1',
  );
});
test('a failed moodboard save is visible and the unsaved references remain exportable', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
  await open(page);
  await expect(
    page.getByText('Saved with this project', { exact: true }),
  ).toBeVisible();
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
  await page
    .getByRole('button', { name: 'Add reference', exact: true })
    .click();
  await page.getByLabel('Idea or reference').fill('Keep this unsaved idea');
  await page.getByRole('button', { name: 'Place reference' }).click();
  await expect(
    page.getByText('Not saved — export a project backup', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to model' }).click();
  const pending = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export project', exact: true })
    .click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.moodboard.items[0].text).toBe('Keep this unsaved idea');
  expect(backup.project.volumes).toHaveLength(2);
});
