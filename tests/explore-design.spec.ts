import { test, expect, type Page } from '@playwright/test';
async function ready(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
}
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
async function explore(page: Page) {
  await page
    .getByRole('button', { name: 'Explore design', exact: true })
    .click();
  return page.getByRole('region', { name: 'Explore design', exact: true });
}
test('direct solid creation remains visible and creates real 3D shapes without drawing a profile', async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole('button', { name: 'Create a 3D shape', exact: true })
    .click();
  const panel = page.getByRole('region', {
    name: 'Create and transform',
    exact: true,
  });
  await expect(
    panel.getByRole('button', { name: '3D shapes', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: 'Cylinder', exact: true }).click();
  await panel.getByLabel('Solid width').fill('4');
  await panel.getByLabel('Solid height').fill('12');
  await panel
    .getByRole('button', { name: 'Create 3D shape', exact: true })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
  );
  await expect
    .poll(async () => {
      const s = await saved(page);
      return s.project.volumes.at(-1).geometry?.kind;
    })
    .toBe('cylinder');
  const v = (await saved(page)).project.volumes.at(-1);
  expect(v.dimensions).toEqual({ width: 4, depth: 4, height: 12 });
  await page.screenshot({ path: 'test-results/direct-3d-desktop.png' });
});
test('component motion, alternatives, and saved viewpoints work and survive reload', async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  const panel = await explore(page);
  await panel.getByRole('button', { name: 'Components', exact: true }).click();
  await panel.getByLabel('Element role').selectOption('door');
  await panel.getByLabel('Component movement').selectOption('hinge-left');
  await expect
    .poll(async () => (await saved(page)).project.volumes[0].component?.motion)
    .toBe('hinge-left');
  const original = (await saved(page)).project.volumes;
  await panel
    .getByRole('button', { name: 'Open selected', exact: true })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-exploration',
    'open',
  );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-exploration-animating',
    'false',
  );
  expect((await saved(page)).project.volumes).toEqual(original);
  await panel.getByRole('button', { name: 'Views', exact: true }).click();
  await panel.getByLabel('View name').fill('Entrance');
  await panel
    .getByRole('button', { name: 'Save this viewpoint', exact: true })
    .click();
  await expect(
    panel.getByRole('button', { name: 'Entrance Viewpoint' }),
  ).toBeVisible();
  await panel
    .getByRole('button', { name: 'Alternatives', exact: true })
    .click();
  await panel.getByLabel('Alternative name').fill('Original');
  await panel
    .getByRole('button', { name: 'Save current design', exact: true })
    .click();
  await panel.getByRole('button', { name: 'Original 2 elements' }).click();
  await expect(panel.getByText('Previewing Original')).toBeVisible();
  expect((await saved(page)).project.volumes).toEqual(original);
  await panel.getByRole('button', { name: 'Back to current design' }).click();
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  const restored = await saved(page);
  expect(restored.project.design.options[0].name).toBe('Original');
  expect(restored.project.design.views[0].name).toBe('Entrance');
  const again = await explore(page);
  await again.getByRole('button', { name: 'Views', exact: true }).click();
  await again.getByRole('button', { name: 'Entrance Viewpoint' }).click();
  await expect(
    page.getByText('Showing Entrance.', { exact: false }).first(),
  ).toBeVisible();
});
test('phone controls stay within the screen in day and night, and only one tool panel opens', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page
    .getByRole('button', { name: 'Create a 3D shape', exact: true })
    .click();
  const panel = page.getByRole('region', {
    name: 'Create and transform',
    exact: true,
  });
  await expect(panel).toBeVisible();
  const bounds = await panel.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(58);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: 'test-results/create-phone-night.png' });
  await explore(page);
  await expect(panel).toBeHidden();
  await page.getByRole('button', { name: 'Close explore' }).click();
  await page.getByRole('button', { name: 'Design tools', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Design tools menu' }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/tools-phone-night.png' });
  await page.evaluate(() =>
    localStorage.setItem(
      'atelier.appearance',
      JSON.stringify({
        theme: 'day',
        mode: 'studio',
        lineColor: '#555555',
        surfaceColor: '#eeeeee',
      }),
    ),
  );
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-theme',
    'day',
  );
  await page
    .getByRole('button', { name: 'Create a 3D shape', exact: true })
    .click();
  await page.screenshot({ path: 'test-results/create-phone-day.png' });
});

test('conversation plan builds a reviewed furniture alternative, previews it and opens its actual room cutaway (provider fixture)', async ({
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
        message:
          'Prepare a meeting layout as an alternative and a room cutaway.',
        operations: [
          { type: 'alternative', action: 'save', name: 'Original' },
          { type: 'furnish', room: 'room', layout: 'meeting', clearance: 0.8 },
          { type: 'alternative', action: 'save', name: 'Meeting layout' },
          { type: 'room_views' },
          { type: 'alternative', action: 'restore', name: 'Original' },
        ],
      },
    }),
  );
  await ready(page);
  await page.getByLabel('Import project file').setInputFiles({
    name: 'room.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: 2,
        selectedId: 'room',
        volumes: [
          {
            id: 'room',
            name: 'Meeting room',
            dimensions: { width: 10, depth: 8, height: 3 },
            position: { x: 0, y: 0, z: 0 },
            rotation: 0,
            component: {
              role: 'room',
              hostId: null,
              level: 'Ground',
              motion: 'none',
              travel: 0,
            },
          },
        ],
      }),
    ),
  });
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '1',
  );
  await page
    .getByRole('textbox', { name: 'Message Atelier' })
    .fill('Suggest a furniture layout and give me a cutaway.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByRole('button', { name: 'Apply change', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project.design?.options.length)
    .toBe(2);
  const panel = await explore(page);
  await panel
    .getByRole('button', { name: 'Alternatives', exact: true })
    .click();
  await panel
    .getByRole('button', { name: /Meeting layout \d+ elements/ })
    .click();
  await expect
    .poll(async () =>
      Number(
        await page.getByTestId('viewport').getAttribute('data-model-objects'),
      ),
    )
    .toBeGreaterThan(10);
  expect((await saved(page)).project.volumes).toHaveLength(1);
  await panel.getByRole('button', { name: 'Keep this alternative' }).click();
  await expect
    .poll(async () => (await saved(page)).project.volumes.length)
    .toBeGreaterThan(10);
  await panel.getByRole('button', { name: 'Views', exact: true }).click();
  await panel.getByRole('button', { name: 'Meeting room Cutaway' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-saved-view',
    'Meeting room',
  );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-projection',
    'OrthographicCamera',
  );
  await expect(page.getByLabel('Camera view')).toHaveValue('orthographic');
  await page.screenshot({ path: 'test-results/meeting-room-cutaway.png' });
  await page.getByRole('button', { name: 'Return to model' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-section',
    'off',
  );
});

test('reference workflow sends an image and chosen scale to the real planning route and applies a validated massing result (provider fixture)', async ({
  page,
}) => {
  let body: any;
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  await page.route('**/api/plan', (r) => {
    body = r.request().postDataJSON();
    return r.fulfill({
      json: {
        intent: 'apply',
        message: 'An editable 20-meter massing study.',
        operations: [
          {
            type: 'create',
            shape: 'box',
            width: 20,
            depth: 8,
            height: 6,
            count: 1,
          },
        ],
      },
    });
  });
  await ready(page);
  const png = await page.getByTestId('viewport').locator('canvas').screenshot();
  await page.getByRole('button', { name: 'Design tools', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: 'Model from a reference', exact: true })
    .click();
  await (
    await chooser
  ).setFiles({ name: 'building.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByAltText('Attached design reference 1')).toBeVisible();
  await page.getByLabel('Reference building width').fill('20');
  await page
    .getByRole('button', { name: 'Create similar massing', exact: true })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
  );
  expect(body.images[0]).toMatch(/^data:image\/jpeg;base64,/);
  expect(body.message).toContain('width of 20 meters');
  expect(body.message).toContain('Estimate other proportions');
  expect((await saved(page)).project.volumes.at(-1).dimensions.width).toBe(20);
});
