import { test, expect, type Page } from '@playwright/test';
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
async function color(page: Page, label: string, value: string) {
  await page.getByLabel(label, { exact: true }).evaluate((el, value) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
const openStudio = (page: Page) =>
  page.getByRole('button', { name: 'Studio appearance and location' }).click();
async function pixels(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ bright: number; total: number }>((resolve) =>
        requestAnimationFrame(() => {
          const source = document.querySelector('canvas')!;
          const sample = document.createElement('canvas');
          sample.width = source.width;
          sample.height = source.height;
          const ctx = sample.getContext('2d')!;
          ctx.drawImage(source, 0, 0);
          const data = ctx.getImageData(0, 0, sample.width, sample.height).data;
          let bright = 0,
            total = 0;
          for (let i = 0; i < data.length; i += 4) {
            const mean = (data[i] + data[i + 1] + data[i + 2]) / 3;
            if (mean > 175) bright++;
            total += mean;
          }
          resolve({ bright, total });
        }),
      ),
  );
}
test('object color, solid scale person, persistent display settings and real hidden-line occlusion', async ({
  page,
}) => {
  test.setTimeout(120000); // Multiple render styles, reloads and screenshots on software-rendered CI.
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
  const initial = (await saved(page)).project.volumes;
  await color(page, 'Selected object color', '#d58b69');
  await expect
    .poll(async () => (await saved(page)).project.volumes[0].color)
    .toBe('#d58b69');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await saved(page)).project.volumes).toEqual(initial);
  await color(page, 'Selected object color', '#8acbc5');
  await openStudio(page);
  await page
    .getByRole('button', { name: 'Add a person', exact: false })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
  );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-construction-active',
    'false',
  );
  const person = (await saved(page)).project.volumes[2];
  expect(person.geometry.kind).toBe('person');
  expect(person.dimensions.height).toBe(1.75);
  await openStudio(page);
  await page.getByRole('button', { name: 'Wireframe', exact: true }).click();
  await color(page, 'Line color', '#ffffff');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-render-mode',
    'wireframe',
  );
  await page.waitForTimeout(150);
  const wire = await pixels(page);
  expect(wire.bright).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Hidden line', exact: true }).click();
  await color(page, 'Surface color', '#181818');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-render-mode',
    'hidden-line',
  );
  await page.waitForTimeout(150);
  const hidden = await pixels(page);
  expect(hidden.bright).toBeLessThan(wire.bright * 0.95);
  await color(page, 'Surface color', '#e0e8ed');
  await page.waitForTimeout(150);
  expect((await pixels(page)).total).toBeGreaterThan(hidden.total * 1.1);
  await page.getByRole('button', { name: 'Close studio settings' }).click();
  await page.screenshot({ path: 'test-results/atelier-hidden-line.png' });
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-render-mode',
    'hidden-line',
  );
  expect((await saved(page)).project.volumes[0].color).toBe('#8acbc5');
  expect((await saved(page)).project.volumes[2]).toEqual(person);
  await openStudio(page);
  await expect(page.getByLabel('Surface color')).toHaveValue('#e0e8ed');
  await page.getByRole('button', { name: 'Solid', exact: true }).click();
  await page.getByRole('button', { name: 'Close studio settings' }).click();
  await page.screenshot({ path: 'test-results/atelier-refined.png' });
  expect(errors).toEqual([]);
});
test('map anchoring uses bounded tiles, keeps geometry and saves the location; tile failures are honest', async ({
  page,
}) => {
  test.setTimeout(60000);
  const urls: string[] = [];
  // Explicit imagery fixture: these checks verify placement/loading, not live OSM availability.
  await page.route('https://tile.openstreetmap.org/**', (r) => {
    urls.push(r.request().url());
    return r.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=',
        'base64',
      ),
    });
  });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  const before = (await saved(page)).project.volumes;
  await openStudio(page);
  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await page.getByLabel('Latitude', { exact: true }).fill('20.9674');
  await page.getByLabel('Longitude', { exact: true }).fill('-89.5926');
  await page.getByLabel('Map rotation', { exact: true }).fill('45');
  await page.getByRole('button', { name: 'Show model on map' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-map-status',
    'ready',
  );
  expect(urls).toHaveLength(9);
  expect(new Set(urls).size).toBe(9);
  expect((await saved(page)).project.volumes).toEqual(before);
  expect((await saved(page)).project.site).toEqual({
    latitude: 20.9674,
    longitude: -89.5926,
    bearing: 45,
    style: 'street',
  });
  await expect(
    page.getByRole('link', { name: '© OpenStreetMap contributors' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Find this location in Google Maps' }),
  ).toHaveAttribute(
    'href',
    'https://www.google.com/maps/search/?api=1&query=20.9674,-89.5926',
  );
  await page.reload();
  await expect(
    page.getByRole('link', { name: '© OpenStreetMap contributors' }),
  ).toHaveCount(0);
  await openStudio(page);
  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await expect(page.getByLabel('Latitude', { exact: true })).toHaveValue(
    '20.9674',
  );
  await page.unroute('https://tile.openstreetmap.org/**');
  await page.route('https://tile.openstreetmap.org/**', (r) => r.abort());
  await page.getByRole('button', { name: 'Show map', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Map imagery could not load',
  );
  expect((await saved(page)).project.volumes).toEqual(before);
  await page.getByRole('button', { name: 'Hide map', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('shadows follow a moved object beyond the original site and studio controls fit mobile', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
  expect(
    Number(await page.getByTestId('viewport').getAttribute('data-shadow-span')),
  ).toBeGreaterThanOrEqual(160);
  await page.getByRole('button', { name: 'Expand inspector' }).click();
  const x = page.getByRole('spinbutton', { name: 'X', exact: true });
  await x.fill('600');
  await x.press('Enter');
  await expect
    .poll(async () =>
      Number(
        await page.getByTestId('viewport').getAttribute('data-shadow-span'),
      ),
    )
    .toBeGreaterThan(1000);
  expect(
    Number(
      (await page
        .getByTestId('viewport')
        .getAttribute('data-shadow-center'))!.split(',')[0],
    ),
  ).toBeGreaterThan(290);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Collapse inspector' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await openStudio(page);
  await page.getByRole('button', { name: 'Hidden line', exact: true }).click();
  await expect(page.getByLabel('Surface color')).toBeVisible();
  const panel = await page
    .getByRole('region', { name: 'Studio settings' })
    .boundingBox();
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Close studio settings' }).click();
  const input = await page
    .getByRole('textbox', { name: 'Message Atelier' })
    .boundingBox();
  expect(input!.y + input!.height).toBeLessThan(844);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/atelier-refined-mobile.png' });
});
