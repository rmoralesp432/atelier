import { test, expect, type Page } from '@playwright/test';
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
const studio = (page: Page) =>
  page.getByRole('button', { name: 'Studio appearance and location' }).click();
const fixture = [
  {
    id: 'red',
    name: 'Red cube',
    color: '#dd5555',
    dimensions: { width: 8, depth: 8, height: 8 },
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
  },
  {
    id: 'sphere',
    name: 'Sphere',
    geometry: { kind: 'sphere' },
    dimensions: { width: 6, depth: 6, height: 6 },
    position: { x: 12, y: 0, z: 0 },
    rotation: 0,
  },
  {
    id: 'cylinder',
    name: 'Cylinder',
    geometry: { kind: 'cylinder' },
    dimensions: { width: 6, depth: 6, height: 10 },
    position: { x: -12, y: 0, z: 0 },
    rotation: 0,
  },
];
async function setup(page: Page, single = false) {
  await page.addInitScript(
    (volumes) => {
      if (!localStorage.getItem('atelier.session.v2'))
        localStorage.setItem(
          'atelier.project.v1',
          JSON.stringify({ version: 1, volumes, selectedId: volumes[0].id }),
        );
    },
    single ? fixture.slice(0, 1) : fixture,
  );
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-transform-tool',
    'translate',
  );
}
async function brightness(page: Page) {
  const png = (await page.locator('canvas').screenshot()).toString('base64');
  return page.evaluate(async (png) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + png;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 100;
    c.height = 100;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const p = ctx.getImageData(0, 0, 100, 100).data;
    let sum = 0;
    for (let i = 0; i < p.length; i += 4)
      sum += (p[i] + p[i + 1] + p[i + 2]) / 3;
    return sum / (p.length / 4);
  }, png);
}
test('day/night themes preserve projects, curved wireframes are readable, and selection glows', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setup(page);
  const before = await saved(page);
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-selection-glow',
    '1',
  );
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/atelier-night.png' });
  const night = await brightness(page);
  await studio(page);
  await page.getByRole('button', { name: 'Day', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-theme',
    'day',
  );
  expect(await brightness(page)).toBeGreaterThan(night + 100);
  await page.getByRole('button', { name: 'Close studio settings' }).click();
  await page.screenshot({ path: 'test-results/atelier-day.png' });
  expect((await saved(page)).project.volumes).toEqual(before.project.volumes);
  expect((await saved(page)).past).toEqual(before.past);
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-theme',
    'day',
  );
  await studio(page);
  await page.getByRole('button', { name: 'Night', exact: true }).click();
  await page.getByRole('button', { name: 'Wireframe', exact: true }).click();
  await page.getByRole('button', { name: 'Close studio settings' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-render-mode',
    'wireframe',
  );
  await page.screenshot({ path: 'test-results/atelier-curved-wireframe.png' });
  expect(errors).toEqual([]);
});
test('panels close without losing selection, drag with pointer or keyboard, and names persist', async ({
  page,
}) => {
  test.setTimeout(120000);
  await setup(page);
  await page.getByRole('button', { name: 'Expand inspector' }).click();
  const inspector = page.getByRole('complementary', {
    name: 'Object inspector',
  });
  await page
    .getByRole('textbox', { name: 'Object name' })
    .fill('Courtyard pavilion');
  await page.getByRole('textbox', { name: 'Object name' }).press('Enter');
  expect((await saved(page)).project.volumes[0].name).toBe(
    'Courtyard pavilion',
  );
  await studio(page);
  const b = (await inspector.boundingBox())!,
    s = (await page
      .getByRole('region', { name: 'Studio settings' })
      .boundingBox())!;
  expect(s.x + s.width).toBeLessThan(b.x);
  const handle = page.getByLabel('Move Inspector panel');
  const r = (await handle.boundingBox())!;
  await page.mouse.move(r.x + 70, r.y + 20);
  await page.mouse.down();
  await page.mouse.move(r.x - 180, r.y + 60, { steps: 5 });
  await page.mouse.up();
  expect((await inspector.boundingBox())!.x).toBeLessThan(b.x - 150);
  const sh = page.getByLabel('Move Studio panel');
  await sh.focus();
  await sh.press('ArrowLeft');
  expect(
    (await page.getByRole('region', { name: 'Studio settings' }).boundingBox())!
      .x,
  ).toBeLessThan(s.x);
  await page
    .getByRole('button', { name: 'Close inspector', exact: true })
    .click();
  await expect(inspector).toBeHidden();
  expect((await saved(page)).project.selectedId).toBe('red');
  await page.getByRole('button', { name: 'Close studio settings' }).click();
  await page.getByRole('button', { name: 'Expand inspector' }).click();
  await page
    .getByRole('button', { name: 'Clear selection', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Close inspector', exact: true })
    .click();
  await expect(inspector).toBeHidden();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-selection-glow',
    '0',
  );
  await page.reload();
  await page.getByRole('button', { name: 'Expand inspector' }).click();
  await page.getByRole('button', { name: 'Show objects', exact: true }).click();
  await page
    .locator('.object-row')
    .filter({ hasText: 'Courtyard pavilion' })
    .click();
  await expect(page.getByRole('textbox', { name: 'Object name' })).toHaveValue(
    'Courtyard pavilion',
  );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-transform-tool',
    'translate',
  );
  await page.getByRole('textbox', { name: 'Object name' }).fill('');
  await page.getByRole('textbox', { name: 'Object name' }).press('Enter');
  await expect(page.getByRole('textbox', { name: 'Object name' })).toHaveValue(
    'Courtyard pavilion',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const small = (await inspector.boundingBox())!;
  expect(small.x).toBeGreaterThanOrEqual(0);
  expect(small.x + small.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Close inspector' }).click();
});
test('conversation selection activates movement; real drag reports distance and snapped rotation', async ({
  page,
}) => {
  test.setTimeout(120000);
  await setup(page, true);
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  // Explicit model fixture: tests validated selection execution, not a paid live language model.
  await page.route('**/api/plan', (r) =>
    r.fulfill({
      json: {
        intent: 'apply',
        message: 'Selected the red cube.',
        operations: [{ type: 'select', targets: ['red'] }],
      },
    }),
  );
  await page.getByRole('button', { name: 'Rotate', exact: true }).click();
  const message = page.getByRole('textbox', { name: 'Message Atelier' });
  await message.fill('Select the red cube');
  await message.press('Enter');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-transform-tool',
    'translate',
  );
  await page.getByLabel('Camera view').selectOption('top');
  await page.waitForTimeout(900);
  const rect = (await page.locator('canvas').boundingBox())!;
  const cx = rect.x + rect.width / 2,
    cy = rect.y + rect.height / 2;
  await page.mouse.move(cx + 45, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 125, cy, { steps: 10 });
  await expect(page.getByLabel('Transform measurements')).toContainText(
    'm moved',
  );
  await page.mouse.up();
  const moved = (await saved(page)).project.volumes[0].position.x;
  expect(moved).not.toBe(0);
  expect(moved % 0.5).toBe(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await saved(page)).project.volumes[0].position.x).toBe(0);
  await page.getByRole('button', { name: 'Rotate', exact: true }).click();
  await page.getByLabel('Rotation snap angle').selectOption('45');
  await expect(page.getByLabel('Transform measurements')).toContainText(
    '45° snap',
  );
  // The visible Y rotation ring is approximately 93 px from the projected pivot.
  await page.mouse.move(cx + 90, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 64, cy - 64, { steps: 12 });
  await page.mouse.up();
  const rotation = (await saved(page)).project.volumes[0].rotation;
  expect(rotation).not.toBe(0);
  expect(rotation % 45).toBe(0);
  await expect(page.getByLabel('Transform measurements')).toContainText('Turn');
  await page.screenshot({ path: 'test-results/atelier-rotation.png' });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await saved(page)).project.volumes[0].rotation).toBe(0);
  await expect(
    page.getByLabel('Transform measurements').locator('strong'),
  ).toHaveText('0°');
  await page.getByLabel('Rotation snap angle').selectOption('90');
  await page.mouse.move(cx + 90, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 90, { steps: 12 });
  await page.mouse.up();
  expect(
    Math.min(
      (await saved(page)).project.volumes[0].rotation,
      360 - (await saved(page)).project.volumes[0].rotation,
    ),
  ).toBe(90);
  await expect(page.getByLabel('Transform measurements')).toContainText(
    '90° snap',
  );
});

test('map replaces the ground surface and restores it on hide', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.route('https://tile.openstreetmap.org/**', (r) =>
    r.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await setup(page);
  const before = (await saved(page)).project.volumes;
  await page.getByRole('button', { name: 'Toggle site map' }).click();
  await page.getByLabel('Latitude', { exact: true }).fill('31.742388');
  await page.getByLabel('Longitude', { exact: true }).fill('-106.439452');
  await page.getByRole('button', { name: 'Show model on map' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-map-status',
    'ready',
  );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-base-ground-visible',
    'false',
  );
  await page.getByRole('button', { name: 'Close studio settings' }).click();
  const canvas = page.locator('canvas');
  const r = (await canvas.boundingBox())!;
  await page.mouse.move(r.x + r.width * 0.7, r.y + r.height * 0.6);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/atelier-map-surface.png' });
  // A second static frame must stay visually stable once orbit damping has settled.
  await page.waitForTimeout(1600);
  const a = await canvas.screenshot();
  await page.waitForTimeout(250);
  const b = await canvas.screenshot();
  const changed = await page.evaluate(
    async ([a, b]) => {
      const read = async (data: string) => {
        const i = new Image();
        i.src = 'data:image/png;base64,' + data;
        await i.decode();
        const c = document.createElement('canvas');
        c.width = i.width;
        c.height = i.height;
        const x = c.getContext('2d')!;
        x.drawImage(i, 0, 0);
        return x.getImageData(0, 0, c.width, c.height).data;
      };
      const p = await read(a),
        q = await read(b);
      let n = 0;
      for (let i = 0; i < p.length; i += 4)
        if (
          Math.abs(p[i] - q[i]) +
            Math.abs(p[i + 1] - q[i + 1]) +
            Math.abs(p[i + 2] - q[i + 2]) >
          45
        )
          n++;
      return n / (p.length / 4);
    },
    [a.toString('base64'), b.toString('base64')],
  );
  expect(changed).toBeLessThan(0.01);
  expect((await saved(page)).project.volumes).toEqual(before);
  await page.getByRole('button', { name: 'Toggle site map' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-base-ground-visible',
    'true',
  );
  await expect(
    page.getByRole('button', { name: 'Toggle site map' }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Toggle site map' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-map-status',
    'ready',
  );
  await expect(
    page.getByRole('button', { name: 'Toggle site map' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect((await saved(page)).project.site.latitude).toBe(31.742388);
});

test('interactive map picker supports pan, zoom, coordinates and device location without changing geometry', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 31.742388, longitude: -106.439452 });
  await page.route('https://tile.openstreetmap.org/**', (r) =>
    r.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await setup(page);
  const original = (await saved(page)).project;
  await page.getByRole('button', { name: 'Toggle site map' }).click();
  await page
    .getByRole('button', { name: 'Use my location', exact: true })
    .click();
  const picker = page.getByRole('region', { name: 'Choose a site on the map' });
  await expect(picker).toBeVisible();
  await expect(page.getByLabel('Latitude', { exact: true })).toHaveValue(
    '31.742388',
  );
  const r = (await picker.boundingBox())!;
  await page.mouse.move(r.x + r.width * 0.5, r.y + r.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.8, r.y + r.height * 0.65, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(page.getByLabel('Longitude', { exact: true })).not.toHaveValue(
    '-106.439452',
  );
  await picker.getByRole('button', { name: 'Zoom in' }).click();
  const latitude = Number(
      await page.getByLabel('Latitude', { exact: true }).inputValue(),
    ),
    longitude = Number(
      await page.getByLabel('Longitude', { exact: true }).inputValue(),
    );
  expect((await saved(page)).project).toEqual(original);
  await page.screenshot({ path: 'test-results/atelier-map-picker.png' });
  await page.getByRole('button', { name: 'Show model on map' }).click();
  expect((await saved(page)).project.site).toMatchObject({
    latitude,
    longitude,
  });
  expect((await saved(page)).project.volumes).toEqual(original.volumes);
  await page.getByRole('button', { name: 'Close map picker' }).click();
  await page.getByLabel('Latitude', { exact: true }).fill('20.9674');
  await page.getByLabel('Longitude', { exact: true }).fill('-89.5926');
  await page.getByRole('button', { name: 'Show model on map' }).click();
  expect((await saved(page)).project.site.latitude).toBe(20.9674);
});

test('model-driven workspace controls use real projections and do not consume modeling undo', async ({
  page,
}) => {
  test.setTimeout(120000);
  const requests: any[] = [];
  await page.route('**/api/plan', (r) => {
    requests.push(r.request().postDataJSON());
    const i = requests.length;
    return r.fulfill({
      json: {
        intent: 'apply',
        message: 'Update workspace.',
        operations:
          i === 1
            ? [
                { type: 'workspace', action: 'view_orthographic' },
                { type: 'workspace', action: 'theme_day' },
              ]
            : i === 2
              ? [{ type: 'workspace', action: 'view_top' }]
              : i === 3
                ? [{ type: 'workspace', action: 'view_perspective' }]
                : i === 4
                  ? [{ type: 'workspace', action: 'map_toggle' }]
                  : [
                      { type: 'workspace', action: 'theme_night' },
                      {
                        type: 'move',
                        targets: ['nonexistent'],
                        direction: 'right',
                        distance: 2,
                      },
                    ],
      },
    });
  });
  await setup(page);
  const initial = await saved(page);
  const say = async (text: string) => {
    await page.getByRole('textbox', { name: 'Message Atelier' }).fill(text);
    await page
      .getByRole('button', { name: 'Send message', exact: true })
      .click();
  };
  await say('Switch to orthogonal view and use day mode.');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-projection',
    'OrthographicCamera',
  );
  await expect(page.getByLabel('Camera view')).toHaveValue('orthographic');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-theme',
    'day',
  );
  await page.screenshot({ path: 'test-results/atelier-orthographic.png' });
  await say('Show it from above.');
  await expect(page.getByLabel('Camera view')).toHaveValue('top');
  await say('Back to perspective.');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-projection',
    'PerspectiveCamera',
  );
  await say('Toggle the map.');
  await expect(page.getByLabel('Latitude', { exact: true })).toBeVisible();
  expect((await saved(page)).project).toEqual(initial.project);
  expect((await saved(page)).past).toEqual(initial.past);
  expect(requests[1].workspace.view).toBe('orthographic');
  expect(requests[1].workspace.theme).toBe('day');
  await say('Use night mode and move the missing object.');
  await expect(
    page.getByRole('alert').filter({ hasText: 'That object is no longer' }),
  ).toBeVisible();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-theme',
    'day',
  );
});
