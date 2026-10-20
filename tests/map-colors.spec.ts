import { expect, test } from '@playwright/test';

test('day and night satellite views retain model colors at distant orthographic camera positions', async ({
  page,
}) => {
  test.setTimeout(120000);
  const volumes = [
    {
      id: 'red',
      name: 'Red building',
      color: '#cc2222',
      position: { x: -150, y: 0, z: 0 },
    },
    {
      id: 'blue',
      name: 'Blue building',
      color: '#2233cc',
      position: { x: 150, y: 0, z: 0 },
    },
  ].map((v) => ({
    ...v,
    rotation: 0,
    dimensions: { width: 200, depth: 200, height: 80 },
  }));
  await page.addInitScript((volumes) => {
    localStorage.setItem(
      'atelier.project.v1',
      JSON.stringify({ version: 1, volumes, selectedId: null }),
    );
    localStorage.setItem(
      'atelier.appearance',
      JSON.stringify({
        theme: 'day',
        mode: 'studio',
        lineColor: '#222222',
        surfaceColor: '#ffffff',
      }),
    );
  }, volumes);
  await page.route('https://server.arcgisonline.com/**', (r) =>
    r.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path fill="#56734e" d="M0 0h16v16H0z"/></svg>',
    }),
  );
  await page.route('https://tile.openstreetmap.org/**', (r) => r.abort());
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await page
    .getByLabel('Camera view', { exact: true })
    .selectOption('orthographic');
  await page
    .getByRole('button', { name: 'Change map location', exact: true })
    .click();
  await page.getByLabel('Latitude', { exact: true }).fill('31.74');
  await page.getByLabel('Longitude', { exact: true }).fill('-106.43');
  await page.getByRole('button', { name: 'Satellite', exact: true }).click();
  await page.getByLabel('Map area', { exact: true }).selectOption('5000');
  await page
    .getByRole('button', { name: 'Show model on map', exact: true })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-map-status',
    'ready',
  );
  await page
    .getByRole('button', { name: 'See entire map', exact: true })
    .click();
  await expect
    .poll(async () =>
      Number(
        await page.getByTestId('viewport').getAttribute('data-camera-distance'),
      ),
    )
    .toBeGreaterThan(5000);
  await page.getByRole('button', { name: 'Close studio settings' }).click();
  const canvas = page.locator('canvas').first();
  const rect = (await canvas.boundingBox())!;
  await page.mouse.move(rect.x + rect.width * 0.7, rect.y + rect.height * 0.4);
  await page.mouse.wheel(0, -1300);
  await page.waitForTimeout(1600);
  const colors = async () => {
    const png = (await canvas.screenshot()).toString('base64');
    return page.evaluate(async (png) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + png;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      let red = 0,
        blue = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] > 100 && px[i] > px[i + 1] + 15 && px[i] > px[i + 2] + 15)
          red++;
        if (
          px[i + 2] > 100 &&
          px[i + 2] > px[i + 1] + 12 &&
          px[i + 2] > px[i] + 12
        )
          blue++;
      }
      return { red, blue };
    }, png);
  };
  let actual = await colors();
  expect(actual.red).toBeGreaterThan(300);
  expect(actual.blue).toBeGreaterThan(300);
  await page.screenshot({ path: 'test-results/atelier-map-colors-day.png' });
  await page
    .getByRole('button', { name: 'Studio appearance and location' })
    .click();
  await page.getByRole('button', { name: 'Night', exact: true }).click();
  await page.getByRole('button', { name: 'Close studio settings' }).click();
  await page.waitForTimeout(500);
  actual = await colors();
  expect(actual.red).toBeGreaterThan(300);
  expect(actual.blue).toBeGreaterThan(300);
  await page.getByRole('button', { name: 'Toggle site map' }).click();
  await page.getByRole('button', { name: 'Toggle site map' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-map-status',
    'ready',
  );
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('atelier.session.v2')!),
  );
  expect(state.project.volumes).toEqual(volumes);
});
