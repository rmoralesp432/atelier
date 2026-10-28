import { openTool } from './tools';
import { test, expect, type Page } from '@playwright/test';
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
const ready = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
    { timeout: 20000 },
  );
};
const tile = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=',
  'base64',
);
test('discoverable location, satellite switch and independent north-preserving map rotation', async ({
  page,
}) => {
  test.setTimeout(90000);
  const urls: string[] = [];
  for (const host of ['tile.openstreetmap.org', 'server.arcgisonline.com'])
    await page.route(`https://${host}/**`, (r) => {
      urls.push(r.request().url());
      return r.fulfill({ contentType: 'image/png', body: tile });
    });
  await ready(page);
  const before = (await saved(page)).project.volumes;
  await page
    .getByLabel('Camera view', { exact: true })
    .selectOption('orthographic');
  await openTool(page, 'Change map location');
  await expect(
    page.getByRole('region', { name: 'Choose a site on the map' }),
  ).toBeVisible();
  await page.getByLabel('Latitude', { exact: true }).fill('31.742');
  await page.getByLabel('Longitude', { exact: true }).fill('-106.439');
  await page.getByRole('button', { name: 'Satellite', exact: true }).click();
  await page.getByRole('button', { name: 'Show model on map' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-map-status',
    'ready',
  );
  await page.getByRole('button', { name: '90°', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project.site.bearing)
    .toBe(90);
  expect((await saved(page)).project.volumes).toEqual(before);
  expect((await saved(page)).project.site.style).toBe('satellite');
  await expect(page.getByLabel('Camera view', { exact: true })).toHaveValue(
    'orthographic',
  );
  await expect(page.getByTitle('True north', { exact: true })).toBeVisible();
  expect(urls.some((u) => u.includes('World_Imagery'))).toBeTruthy();
  await page.getByRole('button', { name: 'Close studio settings' }).click();
  await openTool(page, 'Toggle site map');
  await expect(page.getByTestId('viewport')).not.toHaveAttribute(
    'data-map-status',
  );
});
test('section slider makes capped cuts without modifying the model; presentation hides tools', async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  const before = (await saved(page)).project;
  await openTool(page, 'Section view');
  await expect(
    page.getByRole('region', { name: 'Section controls' }),
  ).toBeVisible();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-section',
    'y',
  );
  await expect
    .poll(async () =>
      Number(
        await page
          .getByTestId('viewport')
          .getAttribute('data-section-cap-triangles'),
      ),
    )
    .toBeGreaterThan(0);
  await page.getByLabel('Exact section position').fill('2');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-section-position',
    '2',
  );
  expect((await saved(page)).project).toEqual(before);
  await page.getByRole('button', { name: 'Flip side', exact: true }).click();
  await page.screenshot({ path: 'test-results/atelier-section.png' });
  await page.getByRole('button', { name: 'Show whole model' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-section',
    'off',
  );
  await openTool(page, 'Presentation mode');
  await expect(
    page.getByRole('toolbar', { name: 'Modeling tools' }),
  ).toBeHidden();
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({ path: 'test-results/atelier-present.png' });
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('toolbar', { name: 'Modeling tools' }),
  ).toBeVisible();
});
test('dragging a face stretches with measurements, preserves the opposite side and supports undo', async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  await page.waitForTimeout(700);
  const before = (await saved(page)).project.volumes[0];
  await page.getByRole('button', { name: 'Push / pull', exact: true }).click();
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-pull-handles', /x1/);
  const h = JSON.parse((await canvas.getAttribute('data-pull-handles'))!)['x1'];
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  await page.mouse.move(h.x + 85, h.y + 10, { steps: 12 });
  await expect(
    page.getByRole('status').filter({ hasText: 'release to keep' }),
  ).toBeVisible();
  await page.mouse.up();
  await expect
    .poll(async () => (await saved(page)).project.volumes[0].dimensions.width)
    .not.toBe(before.dimensions.width);
  const after = (await saved(page)).project.volumes[0];
  expect(after.position.x - after.dimensions.width / 2).toBeCloseTo(
    before.position.x - before.dimensions.width / 2,
    3,
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project.volumes[0])
    .toEqual(before);
});
test('manual additions and architecture visibility preserve editable components', async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  await openTool(page, 'Expand inspector');
  await page
    .getByRole('button', { name: 'Add volume to this', exact: true })
    .click();
  await page.getByLabel('Addition placement').selectOption('above');
  await page.getByLabel('Addition depth').fill('5');
  await page.getByLabel('Addition height').fill('4');
  await page.getByRole('button', { name: 'Add volume', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
  );
  const addition = (await saved(page)).project.volumes[2];
  expect(addition.dimensions.depth).toBe(5);
  expect(addition.position.y).toBe(5);
  await page
    .getByRole('button', { name: 'Create floors and curtain wall' })
    .click();
  await page.getByRole('button', { name: 'Apply change', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project.volumes[2].geometry?.kind)
    .toBe('building');
  await page.getByLabel('Show glass and frames').uncheck();
  await expect
    .poll(async () => (await saved(page)).project.volumes[2].display.glass)
    .toBe(false);
  await page.getByRole('button', { name: 'Volume', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project.volumes[2].display.mode)
    .toBe('volume');
  expect((await saved(page)).project.volumes[2].geometry.kind).toBe('building');
});
test('expressive conversation validates a corrected sweep, renders lofts and preserves original project data', async ({
  page,
}) => {
  test.setTimeout(120000);
  let attempts = 0;
  // Explicit provider responses exercise real geometry, not live AI quality.
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  await page.route('**/api/plan', (r) => {
    const input = r.request().postDataJSON();
    attempts++;
    if (attempts === 2)
      expect(input.validationFeedback.error).toContain('open path');
    return r.fulfill({
      json: {
        intent: 'apply',
        message:
          'A flowing ribbon and a tapered companion volume, above the existing study.',
        operations: [
          {
            type: 'sweep',
            target: null,
            name: 'Ribbon',
            profile: [
              { x: -2, z: -0.3 },
              { x: 2, z: -0.3 },
              { x: 2, z: 0.3 },
              { x: -2, z: 0.3 },
            ],
            path:
              attempts === 1
                ? [
                    { x: 0, y: 0, z: 0 },
                    { x: 10, y: 5, z: 0 },
                    { x: 0, y: 0, z: 0 },
                  ]
                : [
                    { x: 0, y: 0, z: 0 },
                    { x: 5, y: 4, z: 2 },
                    { x: 12, y: 6, z: 0 },
                    { x: 20, y: 3, z: -4 },
                  ],
            smooth: true,
            position: { x: -12, y: 12, z: 0 },
          },
          {
            type: 'loft',
            target: null,
            name: 'Lantern',
            sections: [
              {
                y: 0,
                points: [
                  { x: -4, z: -4 },
                  { x: 4, z: -4 },
                  { x: 4, z: 4 },
                  { x: -4, z: 4 },
                ],
              },
              {
                y: 14,
                points: [
                  { x: -2, z: -2 },
                  { x: 2, z: -2 },
                  { x: 2, z: 2 },
                  { x: -2, z: 2 },
                ],
              },
            ],
            position: { x: 12, y: 0, z: -12 },
          },
          { type: 'color', targets: ['$name:Ribbon'], color: '#8acbc5' },
          { type: 'color', targets: ['$name:Lantern'], color: '#d7a883' },
        ],
      },
    });
  });
  await ready(page);
  const before = (await saved(page)).project.volumes;
  const input = page.getByRole('textbox', { name: 'Message Atelier' });
  await input.fill(
    'Explore a flowing ribbon and a tapered lantern beside my study.',
  );
  await input.press('Enter');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '4',
    { timeout: 30000 },
  );
  expect(attempts).toBe(2);
  const after = (await saved(page)).project.volumes;
  expect(after.slice(0, 2)).toEqual(before);
  expect(after[2].geometry.definition.method).toBe('sweep');
  expect(after[3].geometry.definition.method).toBe('loft');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-construction-active',
    'false',
    { timeout: 15000 },
  );
  await openTool(page, 'Presentation mode');
  await page.screenshot({ path: 'test-results/atelier-expressive-night.png' });
  await page.getByRole('button', { name: 'Orbit model', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Pause orbit', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Pause orbit', exact: true }).click();
  await page
    .getByRole('button', { name: 'Back to editing', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Studio appearance and location' })
    .click();
  await page.getByRole('button', { name: 'Day', exact: true }).click();
  await page.getByRole('button', { name: 'Close studio settings' }).click();
  await openTool(page, 'Presentation mode');
  await page.screenshot({ path: 'test-results/atelier-expressive-day.png' });
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '4',
  );
  expect((await saved(page)).project.volumes).toEqual(after);
});
test('late map-picker loading cannot overwrite coordinates already typed', async ({
  page,
}) => {
  test.setTimeout(60000);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/assets\/MapPicker-[^/]+\.js$/, async (route) => {
    await gate;
    await route.continue();
  });
  await page.route('https://tile.openstreetmap.org/**', (r) =>
    r.fulfill({ contentType: 'image/png', body: tile }),
  );
  await ready(page);
  await openTool(page, 'Change map location');
  await page.getByLabel('Latitude', { exact: true }).fill('31.742388');
  await page.getByLabel('Longitude', { exact: true }).fill('-106.439452');
  release();
  await expect(
    page.getByRole('region', { name: 'Choose a site on the map' }),
  ).toBeVisible();
  await expect(page.getByLabel('Latitude', { exact: true })).toHaveValue(
    '31.742388',
  );
  await expect(page.getByLabel('Longitude', { exact: true })).toHaveValue(
    '-106.439452',
  );
  await page.getByRole('button', { name: 'Show model on map' }).click();
  await expect
    .poll(async () => (await saved(page)).project.site.latitude)
    .toBe(31.742388);
});
