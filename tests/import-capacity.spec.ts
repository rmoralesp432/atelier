import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

function facade(n: number) {
  const rows: string[] = [];
  for (let y = 0; y <= n; y++)
    for (let x = 0; x <= n; x++)
      rows.push(`v ${x / 10} ${y / 10} ${Math.sin(x / 70).toFixed(6)}`);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const a = y * (n + 1) + x + 1,
        c = a + n + 1;
      rows.push(`f ${a} ${a + 1} ${c + 1}`, `f ${a} ${c + 1} ${c}`);
    }
  return rows.join('\n');
}

test('full detail imports over a million genuine faces and restores them from saved storage', async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const path = info.outputPath('million-face-facade.obj');
  await writeFile(path, facade(730));
  await page.goto('/');
  await page.getByLabel('Import project file').setInputFiles(path);
  const dialog = page.getByRole('dialog', { name: 'Import 3D element' });
  await expect(dialog).toContainText('1,065,800 triangles', {
    timeout: 120000,
  });
  await expect(dialog.getByLabel('Import detail')).toHaveValue('full');
  await dialog
    .getByRole('button', { name: 'Add to workspace' })
    .click({ timeout: 120000 });
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
    { timeout: 120000 },
  );
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
    { timeout: 120000 },
  );
  const triangles = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('atelier-projects');
      r.onsuccess = () => resolve(r.result);
    });
    return new Promise<number>((resolve) => {
      const r = db.transaction('projects').objectStore('projects').getAll();
      r.onsuccess = () => {
        const s = JSON.parse(r.result[0].session);
        db.close();
        resolve(s.meshes[0].indices.length / 3);
      };
    });
  });
  expect(triangles).toBe(1065800);
  expect(errors).toEqual([]);
});

test('201 MB source can be cancelled during reading, retried, and added', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const path = info.outputPath('201mb.obj');
  // Byte-limit test, not a claim that the padding is dense geometry.
  await writeFile(
    path,
    'v 0 0 0\nv 2 0 0\nv 0 3 0\nf 1 2 3\n#' + '.'.repeat(201_000_000),
  );
  await page.goto('/');
  await page.getByLabel('Import project file').setInputFiles(path);
  const dialog = page.getByRole('dialog', { name: 'Import 3D element' });
  await dialog.getByRole('button', { name: 'Cancel import' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await page.getByLabel('Import project file').setInputFiles(path);
  await expect(dialog).toContainText('1 triangles', { timeout: 60000 });
  await dialog.getByRole('button', { name: 'Add to workspace' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
  );
});

test('phone detail is optional, reports reduction, and ignores obsolete option previews', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('/');
  await page.getByLabel('Import project file').setInputFiles({
    name: 'Curved facade.obj',
    mimeType: 'text/plain',
    buffer: Buffer.from(facade(300)),
  });
  const dialog = page.getByRole('dialog', { name: 'Import 3D element' });
  await expect(dialog).toContainText('180,000 triangles', { timeout: 60000 });
  await dialog.getByLabel('Import detail').selectOption('light');
  await expect(dialog).toContainText('180,000 original →', { timeout: 60000 });
  await dialog.getByLabel('File units').selectOption('cm');
  await dialog.getByLabel('File units').selectOption('m');
  await expect(dialog.locator('.asset-result')).toContainText('30 ×');
  await dialog.getByRole('button', { name: 'Add to workspace' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
    { timeout: 60000 },
  );
});
