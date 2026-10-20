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
test('map coverage expands to 5 km, persists, undoes and never scales buildings', async ({
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
  await page
    .getByRole('button', { name: 'Change map location', exact: true })
    .click();
  await page.getByLabel('Latitude', { exact: true }).fill('31.74');
  await page.getByLabel('Longitude', { exact: true }).fill('-106.43');
  await page.getByLabel('Map area', { exact: true }).selectOption('1000');
  await page
    .getByRole('button', { name: 'Show model on map', exact: true })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-map-status',
    'ready',
  );
  await page.getByLabel('Map area', { exact: true }).selectOption('5000');
  await expect
    .poll(async () => (await saved(page)).project.site.coverage)
    .toBe(5000);
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-map-status',
    'ready',
  );
  expect(
    Number(await page.getByTestId('viewport').getAttribute('data-map-tiles')),
  ).toBeLessThanOrEqual(25);
  expect((await saved(page)).project.volumes).toEqual(before);
  await page
    .getByRole('button', { name: 'See entire map', exact: true })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-camera-framing',
    'map',
  );
  await expect
    .poll(async () =>
      Number(
        await page.getByTestId('viewport').getAttribute('data-camera-distance'),
      ),
    )
    .toBeGreaterThan(5000);
  expect((await saved(page)).project.volumes).toEqual(before);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('Map area', { exact: true })).toHaveValue(
    '1000',
  );
  await page.getByLabel('Map area', { exact: true }).selectOption('5000');
  await page.reload();
  await expect
    .poll(async () => (await saved(page)).project.site.coverage)
    .toBe(5000);
  await page
    .getByRole('button', { name: 'Change map location', exact: true })
    .click();
  await expect(page.getByLabel('Map area', { exact: true })).toHaveValue(
    '5000',
  );
  expect((await saved(page)).project.volumes).toEqual(before);
});
test('selection shortcuts reveal scale, stretch, copy and array; pull labels track actual geometry', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  const toolbar = page.getByRole('toolbar', { name: 'Shape selected objects' });
  await toolbar.getByRole('button', { name: 'Stretch', exact: true }).click();
  await expect(
    page.getByLabel('Stretch distance · m', { exact: true }),
  ).toBeInViewport();
  await page.getByLabel('Stretch distance · m', { exact: true }).fill('2');
  const old = await saved(page),
    id = old.project.selectedId,
    width = old.project.volumes.find((v: any) => v.id === id).dimensions.width;
  await page
    .getByRole('button', { name: 'Stretch selection', exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await saved(page)).project.volumes.find((v: any) => v.id === id)
          .dimensions.width,
    )
    .toBe(width + 2);
  await toolbar.getByRole('button', { name: 'Scale', exact: true }).click();
  await expect(
    page.getByLabel('Scale factor', { exact: true }),
  ).toBeInViewport();
  await toolbar.getByRole('button', { name: 'Copy', exact: true }).click();
  await page
    .getByRole('button', { name: 'Copy selection', exact: true })
    .click();
  await expect
    .poll(async () => (await saved(page)).project.volumes.length)
    .toBe(3);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await toolbar.getByRole('button', { name: 'Array', exact: true }).click();
  await page.getByLabel('Columns', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Create array', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project.volumes.length)
    .toBe(3);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page
    .getByRole('button', { name: 'Close modeling tools', exact: true })
    .click();
  await toolbar
    .getByRole('button', { name: 'Pull selected face', exact: true })
    .click();
  await expect(
    page.getByLabel('Live face dimension', { exact: true }),
  ).toContainText('Height');
  const canvas = page.locator('canvas');
  const handle = JSON.parse((await canvas.getAttribute('data-pull-handles'))!)[
    'y1'
  ];
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x, handle.y - 60, { steps: 12 });
  await expect(
    page.getByLabel('Live face dimension', { exact: true }),
  ).toContainText('+');
  await page.screenshot({ path: 'test-results/atelier-spatial-pull.png' });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect(
    (await saved(page)).project.volumes.find((v: any) => v.id === id).dimensions
      .width,
  ).toBe(width + 2);
  expect(errors).toEqual([]);
});
test('click-to-place previews floor and heading, enters at eye level and cancels without edits', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  const before = await saved(page);
  await page
    .getByRole('button', { name: 'Camera settings', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Place me in the model', exact: true })
    .click();
  await expect(
    page.getByText('Place yourself in the model', { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1000);
  const canvas = page.locator('canvas'),
    b = (await canvas.boundingBox())!;
  const x = b.x + b.width * 0.6,
    y = b.y + b.height * 0.62;
  await page.mouse.move(x, y);
  await expect(canvas).toHaveAttribute('data-walk-placement', /\[/);
  const point = JSON.parse((await canvas.getAttribute('data-walk-placement'))!);
  await page.mouse.click(x, y);
  await expect(
    page.getByText('Set your direction', { exact: true }),
  ).toBeVisible();
  await page.mouse.move(x - 100, y - 70);
  await page.screenshot({ path: 'test-results/atelier-place-camera.png' });
  await page.mouse.click(x - 100, y - 70);
  await expect(page.locator('.walk-placement-bar')).toBeHidden();
  await expect
    .poll(async () =>
      JSON.parse((await canvas.getAttribute('data-walk-position')) ?? '[]').map(
        (n: number) => Math.round(n * 100),
      ),
    )
    .toEqual(
      [point[0], point[1] + 1.65, point[2]].map((n) => Math.round(n * 100)),
    );
  expect(await saved(page)).toEqual(before);
  await page
    .getByRole('button', { name: 'Camera settings', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Place me in the model', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.walk-placement-bar')).toBeHidden();
  expect(await saved(page)).toEqual(before);
  expect(errors).toEqual([]);
});
test('a structured AI camera request places between named volumes without replacing modeling context', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  await page.route('**/api/plan', (r) =>
    r.fulfill({
      json: {
        intent: 'apply',
        message: 'Stand between the two buildings.',
        operations: [
          {
            type: 'walk_to',
            placement: 'between',
            targets: ['Main pavilion', 'Vertical annex'],
            position: null,
            lookAt: null,
            eyeHeight: 1.8,
          },
        ],
      },
    }),
  );
  await ready(page);
  const before = await saved(page),
    [a, b] = before.project.volumes;
  await page
    .getByRole('textbox', { name: 'Message Atelier' })
    .fill('Place me between Main pavilion and Vertical annex');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  const expected = [
    (a.position.x + b.position.x) / 2,
    Math.min(a.position.y, b.position.y) + 1.8,
    (a.position.z + b.position.z) / 2,
  ];
  await expect
    .poll(async () =>
      JSON.parse(
        (await page.locator('canvas').getAttribute('data-walk-position')) ??
          '[]',
      ),
    )
    .toEqual(expected);
  expect(await saved(page)).toEqual(before);
});
test('phone tools remain reachable and the placement instruction stays clear of conversation', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const toolbar = page.getByRole('toolbar', { name: 'Shape selected objects' });
  const b = (await toolbar.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(390);
  await toolbar.getByRole('button', { name: 'Pull selected face' }).click();
  const feedback = page.locator('.pull-feedback');
  await expect(feedback).toBeVisible();
  expect((await feedback.boundingBox())!.y).toBeGreaterThan(b.y + b.height);
  for (const width of [320, 430, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(async () => {
        const tools = (await toolbar.boundingBox())!;
        return (await feedback.boundingBox())!.y - tools.y - tools.height;
      })
      .toBeGreaterThan(0);
  }
  await toolbar.getByRole('button', { name: 'Stretch', exact: true }).click();
  await expect(
    page.getByLabel('Stretch distance · m', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.conversation-area')).toBeHidden();
  const beforeStretch = await saved(page);
  await page.getByLabel('Stretch distance · m', { exact: true }).fill('1');
  await page
    .getByRole('button', { name: 'Stretch selection', exact: true })
    .click();
  await expect
    .poll(async () => JSON.stringify((await saved(page)).project))
    .not.toBe(JSON.stringify(beforeStretch.project));
  await page.screenshot({ path: 'test-results/atelier-tools-phone.png' });
  await page
    .getByRole('button', { name: 'Close modeling tools', exact: true })
    .click();
  await page.getByRole('button', { name: 'Design tools', exact: true }).click();
  await page
    .getByRole('button', { name: 'Camera settings', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Place me in the model', exact: true })
    .click();
  await expect(page.locator('.conversation-area')).toBeHidden();
  await expect(
    page.getByText('Place yourself in the model', { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/atelier-placement-phone.png' });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.conversation-area')).toBeVisible();
});
