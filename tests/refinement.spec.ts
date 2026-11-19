import { openTool } from './tools';
import { test, expect, type Page } from '@playwright/test';
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
const ready = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
};
test('a multi-selection moves as one rigid group, rotates, selects by layer, and undoes together', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    localStorage.setItem(
      'atelier.project.v1',
      JSON.stringify({
        version: 2,
        volumes: [-12, 12, 0].map((x, i) => ({
          id: String(i),
          name: `Box ${i}`,
          dimensions: { width: 4, depth: 4, height: 4 },
          position: { x, y: 0, z: 0 },
          rotation: 0,
        })),
        selectedId: '2',
        selectedIds: ['0', '1', '2'],
      }),
    );
  });
  await ready(page);
  await page.getByLabel('Camera view', { exact: true }).selectOption('top');
  await page.waitForTimeout(900);
  const before = await saved(page),
    box = (await page.locator('canvas').boundingBox())!,
    cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  await page.mouse.move(cx + 45, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 125, cy, { steps: 12 });
  await expect(page.getByLabel('Transform measurements')).toContainText(
    'm moved',
  );
  await page.mouse.up();
  await expect
    .poll(async () => (await saved(page)).project.volumes[2].position.x)
    .not.toBe(0);
  const moved = await saved(page),
    delta = moved.project.volumes[2].position.x;
  expect(
    moved.project.volumes.map((v: { position: { x: number } }) => v.position.x),
  ).toEqual([-12 + delta, 12 + delta, delta]);
  expect(moved.past.length).toBe(before.past.length + 1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await saved(page)).project.volumes).toEqual(before.project.volumes);
  // Escape cancels the entire preview without changing project selection or undo history.
  await page.mouse.move(cx + 45, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 100, cy, { steps: 8 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect((await saved(page)).project).toEqual(before.project);
  await page.getByRole('button', { name: 'Rotate', exact: true }).click();
  await page.mouse.move(cx + 90, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 64, cy - 64, { steps: 12 });
  await page.mouse.up();
  const turned = (await saved(page)).project.volumes;
  expect(turned[2].rotation).not.toBe(0);
  expect(
    turned.every(
      (v: { rotation: number }) => v.rotation === turned[2].rotation,
    ),
  ).toBe(true);
  expect(Math.hypot(turned[0].position.x, turned[0].position.z)).toBeCloseTo(
    12,
    2,
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await openTool(page, 'Layers and groups');
  await page.getByLabel('New group name').fill('Pavilions');
  await page.getByRole('button', { name: 'Group selected objects' }).click();
  await page.getByRole('button', { name: 'Select group Pavilions' }).click();
  expect((await saved(page)).project.selectedIds).toHaveLength(3);
  await page.screenshot({ path: 'test-results/refined-group.png' });
});
test('visible creation tools make a 2D profile, extrude, scale, stretch, and replace other panels', async ({
  page,
}) => {
  test.setTimeout(120000);
  await ready(page);
  await openTool(page, 'Solar study');
  await expect(
    page.getByRole('region', { name: 'Solar study controls' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Create and transform', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Solar study controls' }),
  ).toBeHidden();
  await page
    .getByRole('region', { name: 'Create and transform', exact: true })
    .getByRole('button', { name: 'Draw 2D', exact: true })
    .click();
  await page.getByLabel('Shape width', { exact: true }).fill('10');
  await page.getByLabel('Shape depth', { exact: true }).fill('6');
  await page
    .getByRole('button', { name: 'Create 2D shape', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Extrude selected shape' }),
  ).toBeVisible();
  await page.getByLabel('Extrusion height · m', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Extrude selected shape' }).click();
  await expect
    .poll(async () => (await saved(page)).project.volumes.at(-1).geometry.kind)
    .toBe('extrusion');
  await page
    .getByRole('toolbar', { name: 'Shape selected objects' })
    .getByRole('button', { name: 'Scale', exact: true })
    .click();
  await page.getByLabel('Scale factor', { exact: true }).fill('1.5');
  await page
    .getByRole('button', { name: 'Scale selection', exact: true })
    .click();
  await expect
    .poll(
      async () => (await saved(page)).project.volumes.at(-1).dimensions.width,
    )
    .toBe(15);
  await page
    .getByRole('toolbar', { name: 'Shape selected objects' })
    .getByRole('button', { name: 'Stretch', exact: true })
    .click();
  await page.getByLabel('Stretch distance · m', { exact: true }).fill('2');
  await page
    .getByRole('button', { name: 'Stretch selection', exact: true })
    .click();
  await expect
    .poll(
      async () => (await saved(page)).project.volumes.at(-1).dimensions.width,
    )
    .toBe(17);
  await page.screenshot({ path: 'test-results/refined-modeling.png' });
  await openTool(page, 'Section view');
  await expect(
    page.getByRole('region', { name: 'Create and transform' }),
  ).toBeHidden();
  await expect
    .poll(async () =>
      Number(
        await page
          .getByTestId('viewport')
          .getAttribute('data-section-cap-triangles'),
      ),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/refined-section.png' });
});
test('map alignment drags and nudges imagery while preserving the model and true north', async ({
  page,
}) => {
  test.setTimeout(120000);
  const tile = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=',
    'base64',
  );
  await page.route('https://tile.openstreetmap.org/**', (r) =>
    r.fulfill({ contentType: 'image/png', body: tile }),
  );
  await ready(page);
  const before = (await saved(page)).project.volumes;
  await openTool(page, 'Change map location');
  await page.getByLabel('Latitude', { exact: true }).fill('31.742');
  await page.getByLabel('Longitude', { exact: true }).fill('-106.439');
  await page.getByRole('button', { name: 'Show model on map' }).click();
  await page.getByRole('button', { name: '90°', exact: true }).click();
  const site = (await saved(page)).project.site;
  await page
    .getByRole('button', { name: 'Move map right', exact: true })
    .click();
  await expect
    .poll(async () => (await saved(page)).project.site.latitude)
    .toBeGreaterThan(site.latitude);
  await page.getByRole('button', { name: 'Drag map under model' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-align-map',
    'true',
  );
  await page.waitForTimeout(900);
  const b = (await page.locator('canvas').boundingBox())!,
    prev = (await saved(page)).project.site;
  await page.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.4 + 70, b.y + b.height * 0.4 + 25, {
    steps: 10,
  });
  await page.mouse.up();
  await expect
    .poll(async () => (await saved(page)).project.site.latitude)
    .not.toBe(prev.latitude);
  expect((await saved(page)).project.site.bearing).toBe(90);
  expect((await saved(page)).project.volumes).toEqual(before);
  await page.getByRole('button', { name: 'Finish moving map' }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await saved(page)).project.site).toEqual(prev);
  await page.screenshot({ path: 'test-results/refined-map.png' });
});
test('phone layout exposes AR with an honest fallback and generates a real USDZ download', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.getByRole('button', { name: 'Design tools', exact: true }).click();
  await openTool(page, 'Camera settings');
  await page.getByRole('button', { name: 'View in your space · AR' }).click();
  await expect(
    page.getByRole('region', { name: 'Camera controls' }),
  ).toBeHidden();
  await expect(
    page.getByText('Camera AR is unavailable in this browser.', {
      exact: false,
    }),
  ).toBeVisible();
  const before = (await saved(page)).project;
  await page
    .getByRole('button', { name: 'Prepare AR model', exact: true })
    .click();
  const link = page.getByRole('link', { name: 'Download AR model (.usdz)' });
  await expect(link).toBeVisible({ timeout: 30000 });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    link.click(),
  ]);
  expect(download.suggestedFilename()).toBe('atelier.usdz');
  const stream = await download.createReadStream();
  let bytes = Buffer.alloc(0);
  for await (const chunk of stream!) bytes = Buffer.concat([bytes, chunk]);
  expect(bytes.subarray(0, 4).toString('hex')).toBe('504b0304');
  expect(bytes.length).toBeGreaterThan(1000);
  expect((await saved(page)).project).toEqual(before);
  await page.screenshot({ path: 'test-results/refined-phone-ar.png' });
  const panel = (await page
    .getByRole('region', { name: 'View in your space' })
    .boundingBox())!;
  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.x + panel.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Close AR', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'View in your space' }),
  ).toBeHidden();
  await page.getByRole('button', { name: 'Show objects', exact: true }).click();
  await page
    .getByRole('button', { name: 'Select several', exact: true })
    .click();
  await page.locator('.object-row').nth(1).click();
  await expect
    .poll(async () => (await saved(page)).project.selectedIds.length)
    .toBe(2);
  await expect(
    page.getByRole('button', { name: 'Group selection', exact: true }),
  ).toBeVisible();
  await page.locator('.object-row').nth(0).click();
  await expect
    .poll(async () => (await saved(page)).project.selectedIds.length)
    .toBe(1);
  await page
    .getByRole('button', { name: 'Close objects', exact: true })
    .click();
});

test('an explicitly mocked WebXR permission failure exits cleanly and preserves the project', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'xr', {
      configurable: true,
      value: {
        isSessionSupported: () => Promise.resolve(true),
        requestSession: () =>
          Promise.reject(new Error('Camera permission denied')),
      },
    }),
  );
  await ready(page);
  const before = (await saved(page)).project;
  await openTool(page, 'Camera settings');
  await page.getByRole('button', { name: 'View in your space · AR' }).click();
  await page
    .getByRole('button', { name: 'Prepare AR model', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm scale', exact: false })
    .click();
  await page.getByRole('button', { name: 'Open real AR', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Camera permission denied',
  );
  await expect(page.locator('.ar-overlay')).toBeHidden();
  expect((await saved(page)).project).toEqual(before);
});
