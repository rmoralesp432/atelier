import { openTool } from './tools';
import { expect, test, type Page } from '@playwright/test';
import { writeFile, open, stat } from 'node:fs/promises';

async function phone(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const supports = DOMTokenList.prototype.supports;
    DOMTokenList.prototype.supports = function (token: string) {
      return token === 'ar' || supports.call(this, token);
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('atelier.session.v2')))
    .not.toBeNull();
}
async function openPanel(page: Page) {
  await page.getByRole('button', { name: 'Design tools', exact: true }).click();
  await openTool(page, 'Camera settings');
  await page.getByRole('button', { name: 'View in your space · AR' }).click();
}
function denseFacade(n = 730) {
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
test('300 MB OBJ with a million faces prepares bounded real USDZ without reload or reducing saved detail', async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const path = info.outputPath('dense-ar-facade.obj');
  await writeFile(path, denseFacade());
  // Large source text plus genuinely dense geometry exercises both byte and
  // triangle paths. Comments model source metadata; they do not add geometry.
  const padding = '\n# ' + 'source metadata '.repeat(4096) + '\n';
  const file = await open(path, 'a');
  let size = (await stat(path)).size;
  while (size < 300_000_000) {
    await file.write(padding);
    size += Buffer.byteLength(padding);
  }
  await file.close();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await phone(page);
  await page.getByLabel('Import project file').setInputFiles(path);
  const dialog = page.getByRole('dialog', { name: 'Import 3D element' });
  await expect(dialog).toContainText('1,065,800 triangles', {
    timeout: 120000,
  });
  await expect(dialog.getByLabel('Import detail')).toHaveValue('full');
  await dialog.getByRole('button', { name: 'Add to workspace' }).click();
  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-model-objects', '3', {
    timeout: 120000,
  });
  await page.evaluate(() => {
    (window as any).__arPageSurvived = true;
    (window as any).__arTicks = 0;
    (window as any).__arTickTimer = setInterval(
      () => (window as any).__arTicks++,
      30,
    );
  });
  await openPanel(page);
  const workerRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('preparation.worker')) workerRequests.push(r.url());
  });
  await page
    .getByRole('button', { name: 'Prepare life-size AR', exact: true })
    .click();
  const native = page.getByRole('link', { name: 'Open real AR', exact: true });
  await expect(native).toBeVisible({ timeout: 120000 });
  const panel = page.getByRole('region', {
    name: 'View in your space',
    exact: true,
  });
  expect(
    Number(await panel.getAttribute('data-ar-triangles')),
  ).toBeLessThanOrEqual(100000);
  expect(Number(await panel.getAttribute('data-ar-triangles'))).toBeGreaterThan(
    1000,
  );
  expect(workerRequests.length).toBeGreaterThan(0);
  const usdz = await native.evaluate(async (a: HTMLAnchorElement) => {
    const bytes = new Uint8Array(await (await fetch(a.href)).arrayBuffer());
    return {
      magic: Array.from(bytes.slice(0, 4)),
      bytes: bytes.length,
      meters: new TextDecoder().decode(bytes).includes('metersPerUnit = 1'),
    };
  });
  expect(usdz.magic).toEqual([80, 75, 3, 4]);
  expect(usdz.meters).toBe(true);
  expect(usdz.bytes).toBeLessThan(32_000_000);
  expect(await page.evaluate(() => (window as any).__arPageSurvived)).toBe(
    true,
  );
  expect(await page.evaluate(() => (window as any).__arTicks)).toBeGreaterThan(
    3,
  );
  await page.evaluate(() => clearInterval((window as any).__arTickTimer));
  await page.getByRole('button', { name: 'Close AR', exact: true }).click();
  // After temporary GPU release the original viewport still renders all original faces.
  await expect(viewport).toHaveAttribute('data-model-objects', '3');
  expect(
    Number(await viewport.getAttribute('data-indexed-triangles')),
  ).toBeGreaterThanOrEqual(1065800);
  const storedFaces = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('atelier-projects');
      r.onsuccess = () => resolve(r.result);
    });
    return new Promise<number>((resolve) => {
      const r = db.transaction('projects').objectStore('projects').getAll();
      r.onsuccess = () => {
        const record = JSON.parse(r.result[0].session);
        resolve(record.meshes[0].indices.length / 3);
        db.close();
      };
    });
  });
  expect(storedFaces).toBe(1065800);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: info.outputPath('dense-ar-original-retained.png'),
  });
});

test('cancels a stalled worker, keeps the project and retries real preparation', async ({
  page,
}) => {
  test.setTimeout(90000);
  await phone(page);
  const before = await page.evaluate(() =>
    localStorage.getItem('atelier.session.v2'),
  );
  const worker = /\/preparation\.worker(?:-[^/]+\.js|\.ts)(?:\?.*)?$/;
  await page.route(worker, (r) =>
    r.fulfill({
      contentType: 'application/javascript',
      body: 'onmessage=()=>{};',
    }),
  );
  await openPanel(page);
  await page
    .getByRole('button', { name: 'Prepare AR model', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Cancel preparation', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Prepare AR model', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('link', { name: 'Open real AR', exact: true }),
  ).toBeHidden();
  await page.unroute(worker);
  await page
    .getByRole('button', { name: 'Prepare life-size AR', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'Open real AR', exact: true }),
  ).toBeVisible({ timeout: 30000 });
  expect(
    await page.evaluate(() => localStorage.getItem('atelier.session.v2')),
  ).toBe(before);
});

test('a crashed preparation worker fails closed without reloading and can be retried', async ({
  page,
}) => {
  await phone(page);
  const before = await page.evaluate(() =>
    localStorage.getItem('atelier.session.v2'),
  );
  const worker = /\/preparation\.worker(?:-[^/]+\.js|\.ts)(?:\?.*)?$/;
  await page.route(worker, (r) =>
    r.fulfill({
      contentType: 'application/javascript',
      body: 'onmessage=()=>{throw new Error("worker failure fixture")};',
    }),
  );
  await openPanel(page);
  await page
    .getByRole('button', { name: 'Prepare AR model', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('AR preparation stopped');
  await expect(
    page.getByRole('button', { name: 'Prepare AR model', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('link', { name: 'Download AR model (.usdz)' }),
  ).toBeHidden();
  expect(
    await page.evaluate(() => localStorage.getItem('atelier.session.v2')),
  ).toBe(before);
});
