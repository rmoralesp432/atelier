import { test, expect, type Page } from '@playwright/test';
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on('pageerror', (error) => list.push(error.message));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /THREE.WebGLProgram|Shader Error|VALIDATE_STATUS/.test(message.text())
    )
      list.push(message.text());
  });
});
test.afterEach(({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
async function ready(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'atelier.project.v1',
      JSON.stringify({ version: 2, volumes: [], selectedId: null }),
    );
  });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
  await page.getByLabel('Camera view', { exact: true }).selectOption('top');
  await page.waitForTimeout(800);
}
async function point(page: Page, dx: number, dy: number) {
  const b = (await page.locator('.viewport-canvas > canvas').boundingBox())!;
  return { x: b.x + b.width / 2 + dx, y: b.y + b.height / 2 + dy };
}
test('draws a snapped rectangle directly, pulls it into 3D, and cancels a new draft without changing history', async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  await page.getByRole('button', { name: 'Draw 2D', exact: true }).click();
  const a = await point(page, -110, -110),
    b = await point(page, 100, 60);
  await page.mouse.click(a.x, a.y);
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await expect(page.locator('.sketch-readout')).toContainText('×');
  await page.screenshot({ path: 'test-results/drawing-preview.png' });
  await page.mouse.click(b.x, b.y);
  await expect
    .poll(async () => (await saved(page)).project.volumes.length)
    .toBe(1);
  const face = (await saved(page)).project.volumes[0];
  expect(face.geometry.kind).toBe('rectangle');
  expect(face.dimensions.width % 0.5).toBe(0);
  await expect(
    page.getByRole('button', { name: 'Push / pull', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .getByLabel('Camera view', { exact: true })
    .selectOption('perspective');
  await page.waitForTimeout(1000);
  const canvas = page.locator('.viewport-canvas > canvas');
  await expect(canvas).toHaveAttribute('data-pull-handles', /y1/);
  const h = JSON.parse((await canvas.getAttribute('data-pull-handles'))!)['y1'];
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  await page.mouse.move(h.x, h.y - 95, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(async () => (await saved(page)).project.volumes[0].geometry.kind)
    .toBe('extrusion');
  const solid = await saved(page);
  expect(solid.project.volumes[0].id).toBe(face.id);
  await page.getByRole('button', { name: 'Draw 2D', exact: true }).click();
  const c = await point(page, 180, -50);
  await page.mouse.click(c.x, c.y);
  await page.keyboard.press('Escape');
  expect((await saved(page)).project).toEqual(solid.project);
  expect((await saved(page)).past.length).toBe(solid.past.length);
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('region', { name: 'Draw in space' }),
  ).toBeHidden();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project.volumes[0].geometry.kind)
    .toBe('rectangle');
});
test('creates an exact circle from a picked center and a closed concave outline; rejects crossing edges', async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  await page.keyboard.press('c');
  const center = await point(page, 20, -20);
  await page.mouse.click(center.x, center.y);
  await page.getByText('Measurements & drawing plane', { exact: true }).click();
  await page.getByLabel('Exact drawing size', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Create exact face' }).click();
  await expect
    .poll(async () => (await saved(page)).project.volumes.length)
    .toBe(1);
  expect((await saved(page)).project.volumes[0].dimensions.width).toBe(8);
  // Return to a generous view before drawing the next profile.
  await page.getByRole('button', { name: 'Frame all', exact: true }).click();
  await page.waitForTimeout(750);
  await page.keyboard.press('l');
  for (const [x, y] of [
    [-80, -100],
    [120, -100],
    [120, -20],
    [20, -20],
    [20, 100],
    [-80, 100],
  ]) {
    const p = await point(page, x, y);
    await page.mouse.click(p.x, p.y);
  }
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await saved(page)).project.volumes.length)
    .toBe(2);
  expect((await saved(page)).project.volumes[1].geometry.points).toHaveLength(
    6,
  );
  const before = await saved(page);
  await page.keyboard.press('l');
  for (const [x, y] of [
    [-70, -80],
    [100, 100],
    [-70, 100],
    [100, -80],
  ]) {
    const p = await point(page, x, y);
    await page.mouse.click(p.x, p.y);
  }
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText('crosses');
  expect((await saved(page)).project).toEqual(before.project);
});
test('focuses new geometry without zooming back to distant objects and shows world-space formation labels', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() =>
    localStorage.setItem(
      'atelier.project.v1',
      JSON.stringify({
        version: 2,
        volumes: [
          {
            id: 'far',
            name: 'Distant',
            dimensions: { width: 8, depth: 8, height: 8 },
            position: { x: 300, y: 0, z: 0 },
            rotation: 0,
          },
        ],
        selectedId: null,
      }),
    ),
  );
  await page.goto('/');
  const view = page.getByTestId('viewport');
  await expect(view).toHaveAttribute('data-rendered', 'true');
  await page.waitForTimeout(800);
  const before = Number(await view.getAttribute('data-camera-distance'));
  await page
    .getByRole('button', { name: 'Create and transform', exact: true })
    .click();
  await page.getByLabel('Shape width', { exact: true }).fill('4');
  await page.getByLabel('Shape depth', { exact: true }).fill('4');
  await page
    .getByRole('button', { name: 'Create 2D shape', exact: true })
    .click();
  await expect(view).toHaveAttribute('data-camera-framing', 'creation');
  expect(
    Number(await view.getAttribute('data-camera-goal-distance')),
  ).toBeLessThan(before);
  await expect(page.locator('.spatial-creation-label')).toBeVisible();
  await expect(page.locator('.spatial-creation-label')).toContainText('4 × 4');
  const created = (await saved(page)).project.volumes.at(-1);
  expect(await view.getAttribute('data-camera-focus-ids')).toBe(created.id);
  await page.screenshot({ path: 'test-results/spatial-creation.png' });
  // Grid coverage remains at every permitted zoom, including beyond the old 400 m edge.
  await page.getByRole('button', { name: 'Close modeling tools' }).click();
  await page.mouse.move(850, 300);
  await page.locator('.viewport-canvas > canvas').evaluate((canvas) => {
    for (let i = 0; i < 130; i++)
      canvas.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: 200,
          bubbles: true,
          cancelable: true,
        }),
      );
  });
  await page.waitForTimeout(1000);
  await expect(view).toHaveAttribute('data-grid-spacing', /10|100/);
  await page.screenshot({ path: 'test-results/spatial-grid-wide.png' });
});
test.describe('touch drawing', () => {
  test.use({ hasTouch: true });
  test('a structured assistant action opens drawing on a phone; tapping a face needs no API credits', async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/config', (r) =>
      r.fulfill({
        json: { configured: true, authenticated: true, voiceConfigured: false },
      }),
    );
    await page.route('**/api/plan', (r) =>
      r.fulfill({
        json: {
          intent: 'apply',
          message: 'Draw your rectangle.',
          operations: [{ type: 'workspace', action: 'draw_rectangle' }],
        },
      }),
    );
    await ready(page);
    const input = page.getByRole('textbox', { name: 'Message Atelier' });
    await input.fill('Let me sketch a rectangle myself');
    await input.press('Enter');
    const panel = page.getByRole('region', { name: 'Draw in space' });
    await expect(panel).toBeVisible();
    const bounds = (await panel.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    // Panel occupies the top; draw below it in the unobstructed workspace.
    const a = await point(page, -70, 80),
      b = await point(page, 75, 165);
    await page.touchscreen.tap(a.x, a.y);
    await page.touchscreen.tap(b.x, b.y);
    await expect
      .poll(async () => (await saved(page)).project.volumes.length)
      .toBe(1);
    await page.screenshot({ path: 'test-results/drawing-phone.png' });
  });
});
