import { expect, test } from '@playwright/test';

// A genuine 131,072-triangle surface: unique vertices, no repeated filler faces.
function facade() {
  const lines: string[] = [];
  const n = 256;
  for (let y = 0; y <= n; y++)
    for (let x = 0; x <= n; x++)
      lines.push(`v ${x / 4} ${y / 4} ${Math.sin(x / 17).toFixed(6)}`);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const a = y * (n + 1) + x + 1,
        b = a + 1,
        c = a + n + 1,
        d = c + 1;
      lines.push(`f ${a} ${b} ${d}`, `f ${a} ${d} ${c}`);
    }
  return Buffer.from(lines.join('\n'));
}
test('dense import exceeds the old triangle and storage limits, saves without localStorage, reloads and undoes', async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-model-objects', '2');
  // IndexedDB must remain authoritative when the synchronous checkpoint is full.
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'atelier.session.v2')
        throw new DOMException('Quota reached', 'QuotaExceededError');
      return original.call(this, k, v);
    };
  });
  await page.getByLabel('Import project file').setInputFiles({
    name: 'Dense facade.obj',
    mimeType: 'text/plain',
    buffer: facade(),
  });
  const dialog = page.getByRole('dialog', { name: 'Import 3D element' });
  await expect(dialog).toContainText('131,072 triangles', { timeout: 60000 });
  await expect(
    dialog.getByLabel('Check closed-solid modeling eligibility'),
  ).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Add to workspace' }).click();
  await expect(viewport).toHaveAttribute('data-model-objects', '3', {
    timeout: 60000,
  });
  const record = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('atelier-projects');
      r.onsuccess = () => resolve(r.result);
    });
    return new Promise<any>((resolve) => {
      const r = db.transaction('projects').objectStore('projects').getAll();
      r.onsuccess = () => {
        resolve(r.result[0]);
        db.close();
      };
    });
  });
  const stored = JSON.parse(record.session);
  expect(stored.version).toBe(3);
  expect(stored.meshes).toHaveLength(1);
  expect(stored.meshes[0].indices).toHaveLength(131072 * 3);
  expect(record.session.length).toBeGreaterThan(2_000_000);
  await page.reload();
  await expect(viewport).toHaveAttribute('data-model-objects', '3', {
    timeout: 60000,
  });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(viewport).toHaveAttribute('data-model-objects', '2');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(viewport).toHaveAttribute('data-model-objects', '3', {
    timeout: 60000,
  });
  expect(errors).toEqual([]);
});

test('a 51 MB OBJ crosses the old byte limit without changing geometry', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const { writeFile } = await import('node:fs/promises');
  const path = info.outputPath('large-byte-fixture.obj');
  // Padding tests file size independently of geometry density.
  await writeFile(
    path,
    'v 0 0 0\nv 2 0 0\nv 0 3 0\nf 1 2 3\n#' + '.'.repeat(51_000_000),
  );
  await page.goto('/');
  await page.getByLabel('Import project file').setInputFiles(path);
  const dialog = page.getByRole('dialog', { name: 'Import 3D element' });
  await expect(dialog).toContainText('1 triangles', { timeout: 30000 });
  await dialog.getByRole('button', { name: 'Add to workspace' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
  );
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
  );
});

test('an aborted import save retains the original workspace and saved project', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-model-objects', '2');
  const before = await page.evaluate(() =>
    localStorage.getItem('atelier.session.v2'),
  );
  await page.getByLabel('Import project file').setInputFiles({
    name: 'panel.obj',
    mimeType: 'text/plain',
    buffer: Buffer.from('v 0 0 0\nv 2 0 0\nv 0 3 0\nf 1 2 3\n'),
  });
  const dialog = page.getByRole('dialog', { name: 'Import 3D element' });
  await expect(dialog).toContainText('Reference surface');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      const r = original.apply(this, args);
      if (this.name === 'projects') this.transaction.abort();
      return r;
    };
  });
  await dialog.getByRole('button', { name: 'Add to workspace' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Could not save');
  await expect(viewport).toHaveAttribute('data-model-objects', '2');
  expect(
    await page.evaluate(() => localStorage.getItem('atelier.session.v2')),
  ).toBe(before);
  await dialog.getByRole('button', { name: 'Cancel import' }).click();
  await page.reload();
  await expect(viewport).toHaveAttribute('data-model-objects', '2');
  expect(
    await page.evaluate(() => localStorage.getItem('atelier.session.v2')),
  ).toBe(before);
});

test('AR preparation reduces a dense OBJ copy while keeping the original project open', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Import project file').setInputFiles({
    name: 'Dense AR facade.obj',
    mimeType: 'text/plain',
    buffer: facade(),
  });
  const dialog = page.getByRole('dialog', { name: 'Import 3D element' });
  await expect(dialog).toContainText('131,072 triangles', { timeout: 60000 });
  await dialog.getByRole('button', { name: 'Add to workspace' }).click();
  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-model-objects', '3', {
    timeout: 60000,
  });
  // The desktop toolbar exposes Camera directly; the Tools button is mobile-only.
  if (
    !(await page
      .getByRole('button', { name: 'Camera settings', exact: true })
      .isVisible())
  )
    await page
      .getByRole('button', { name: 'Design tools', exact: true })
      .click();
  await page
    .getByRole('button', { name: 'Camera settings', exact: true })
    .click();
  await page.getByRole('button', { name: 'View in your space · AR' }).click();
  await page
    .getByRole('button', { name: 'Prepare AR model', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'Download AR model (.usdz)' }),
  ).toBeVisible({ timeout: 30000 });
  const panel = page.getByRole('region', { name: 'View in your space' });
  expect(
    Number(await panel.getAttribute('data-ar-triangles')),
  ).toBeLessThanOrEqual(100000);
  expect(
    Number(await viewport.getAttribute('data-indexed-triangles')),
  ).toBeGreaterThanOrEqual(131072);
  await expect(viewport).toHaveAttribute('data-model-objects', '3');
  await expect(page.getByRole('button', { name: 'Projects' })).toBeVisible();
  expect(errors).toEqual([]);
});
