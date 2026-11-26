import { openTool } from './tools';
import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
async function nativePhone(page: Page) {
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
}
async function panel(page: Page) {
  await page.getByRole('button', { name: 'Design tools', exact: true }).click();
  await openTool(page, 'Camera settings');
  await page.getByRole('button', { name: 'View in your space · AR' }).click();
}
const saved = (page: Page) =>
  page.evaluate(() => localStorage.getItem('atelier.session.v2'));

test('native iPhone AR exports a real USDZ without requesting the WebXR module', async ({
  page,
}) => {
  test.setTimeout(60000);
  let webxrRequests = 0;
  await page.route(
    /\/(assets\/webxr-[^/]+\.js|src\/ar\/webxr\.ts)/,
    async (r) => {
      webxrRequests++;
      await r.abort();
    },
  );
  await nativePhone(page);
  await panel(page);
  await page
    .getByRole('button', { name: 'Prepare AR model', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'Download AR model (.usdz)' }),
  ).toBeVisible({ timeout: 30000 });
  expect(webxrRequests).toBe(0);
});

test('missing AR module offers a saved refresh, refuses reload on save failure and recovers without losing the project', async ({
  page,
}) => {
  test.setTimeout(120000);
  await nativePhone(page);
  const before = await saved(page);
  let blocked = 0;
  const modulePath = process.env.ATELIER_TEST_PRODUCTION
    ? '/assets/' +
      readdirSync('dist/assets').find(
        (f) =>
          f.startsWith('model-') &&
          f.endsWith('.js') &&
          readFileSync('dist/assets/' + f, 'utf8').includes(
            'Choose a scale between 1:1000',
          ),
      )
    : '/src/ar/model.ts';
  const match = '**' + modulePath;
  await page.route(match, async (r) => {
    blocked++;
    await r.fulfill({
      status: 404,
      contentType: 'text/plain',
      body: 'Old deployment chunk removed',
    });
  });
  await panel(page);
  await page
    .getByRole('button', { name: 'Prepare AR model', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'The AR files could not load',
  );
  expect(blocked).toBeGreaterThan(0);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as any).__failSave = true;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      const result = original.apply(this, args);
      if ((window as any).__failSave && this.name === 'projects')
        this.transaction.abort();
      return result;
    };
    (window as any).__stillThisPage = true;
  });
  await page
    .getByRole('button', { name: 'Save project and refresh', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'View in your space' }).getByRole('alert'),
  ).toContainText('Could not save');
  expect(await page.evaluate(() => (window as any).__stillThisPage)).toBe(true);
  expect(await saved(page)).toBe(before);
  await page.evaluate(() => {
    (window as any).__failSave = false;
  });
  await page.unroute(match);
  await Promise.all([
    page.waitForEvent('load'),
    page
      .getByRole('button', { name: 'Save project and refresh', exact: true })
      .click(),
  ]);
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  expect(await saved(page)).toBe(before);
  await panel(page);
  await page
    .getByRole('button', { name: 'Prepare AR model', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'Download AR model (.usdz)' }),
  ).toBeVisible({ timeout: 30000 });
});

test('production HTML and missing chunks are not cached; hashed assets are immutable', async ({
  request,
}) => {
  test.skip(
    !process.env.ATELIER_TEST_PRODUCTION,
    'Production server cache policy only',
  );
  const response = await request.get('/');
  expect(response.headers()['cache-control']).toBe('no-store');
  const html = await response.text();
  const script = html.match(/src="([^\"]+\.js)"/)![1];
  const asset = await request.get('/' + script.replace(/^\.\//, ''));
  expect(asset.status()).toBe(200);
  expect(asset.headers()['cache-control']).toContain('immutable');
  const missing = await request.get('/assets/model-old-deployment.js');
  expect(missing.status()).toBe(404);
  expect(missing.headers()['cache-control']).toBe('no-store');
  expect(missing.headers()['content-type']).toContain('text/plain');
});
