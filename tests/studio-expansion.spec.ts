import { test, expect, type Page } from '@playwright/test';
import { initialProject } from '../src/model';
const saved = (p: Page) =>
  p.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
const ready = async (p: Page) => {
  await p.goto('/');
  await expect(p.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
    { timeout: 20000 },
  );
};
test('solar position, eye-level walkthrough and focus controls operate without changing geometry', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const project = {
    ...initialProject(),
    site: { latitude: 51.5, longitude: 0, bearing: 0 },
  };
  await page.addInitScript(
    (p) =>
      localStorage.setItem(
        'atelier.project.v1',
        JSON.stringify({ version: 2, ...p }),
      ),
    project,
  );
  await ready(page);
  const before = (await saved(page)).project;
  await page.getByRole('button', { name: 'Solar study', exact: true }).click();
  await page.getByLabel('Solar date').fill('2026-03-20');
  await page.getByLabel('Solar UTC offset').fill('0');
  await page.getByLabel('Solar time', { exact: true }).fill('720');
  await page.getByLabel('Solar lighting', { exact: true }).check();
  await expect
    .poll(async () =>
      Number(
        await page.getByTestId('viewport').getAttribute('data-sun-altitude'),
      ),
    )
    .toBeGreaterThan(37);
  await expect
    .poll(async () =>
      Number(
        await page.getByTestId('viewport').getAttribute('data-sun-altitude'),
      ),
    )
    .toBeLessThan(40);
  await page.screenshot({ path: 'test-results/atelier-solar.png' });
  await page.getByLabel('Solar time', { exact: true }).fill('0');
  await expect
    .poll(async () =>
      Number(
        await page.getByTestId('viewport').getAttribute('data-sun-altitude'),
      ),
    )
    .toBeLessThan(0);
  await page.getByLabel('Solar lighting', { exact: true }).uncheck();
  await page
    .getByRole('button', { name: 'Camera settings', exact: true })
    .click();
  await page.getByRole('button', { name: 'Walk inside', exact: true }).click();
  await page.getByLabel('Eye height', { exact: true }).fill('1.8');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-eye-elevation', '1.8');
  await page.getByRole('button', { name: 'Close camera controls' }).click();
  await canvas.click({ position: { x: 800, y: 350 } });
  const from = JSON.parse((await canvas.getAttribute('data-walk-position'))!);
  await page.keyboard.down('w');
  await expect
    .poll(
      async () => {
        const at = JSON.parse(
          (await canvas.getAttribute('data-walk-position'))!,
        );
        return Math.hypot(at[0] - from[0], at[2] - from[2]);
      },
      { timeout: 10000 },
    )
    .toBeGreaterThan(0.05);
  await page.keyboard.up('w');
  const to = JSON.parse((await canvas.getAttribute('data-walk-position'))!);
  expect(Math.hypot(to[0] - from[0], to[2] - from[2])).toBeGreaterThan(0.05);
  expect(to[1]).toBe(1.8);
  await page
    .getByRole('button', { name: 'Camera settings', exact: true })
    .click();
  await page.getByRole('button', { name: 'Orbit', exact: true }).click();
  await page.getByLabel('Field of view', { exact: true }).fill('70');
  await page.getByText('Lens focus', { exact: true }).click();
  await page.getByLabel('Depth blur', { exact: true }).fill('0.35');
  await page.waitForTimeout(500);
  expect((await saved(page)).project).toEqual(before);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/atelier-camera.png' });
});
test('marquee selection, persistent layers, volumetric trees and downloadable OBJ use real geometry', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await page.waitForTimeout(800);
  // Shift-drag is available even when selecting an object activates Move.
  const rect = (await page.locator('canvas').boundingBox())!;
  await page.keyboard.down('Shift');
  await page.mouse.move(rect.x + 120, rect.y + 100);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width - 140, rect.y + rect.height - 70, {
    steps: 8,
  });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect
    .poll(async () => (await saved(page)).project.selectedIds?.length)
    .toBe(2);
  await page
    .getByRole('button', { name: 'Layers and groups', exact: true })
    .click();
  await page.getByLabel('New group name').fill('Pavilions');
  await page.getByRole('button', { name: 'Group selected objects' }).click();
  await page.getByRole('button', { name: 'Hide group Pavilions' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '0',
  );
  await page.getByRole('button', { name: 'Show group Pavilions' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await page.getByRole('button', { name: 'Lock group Pavilions' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-transform-tool',
    'none',
  );
  await page.getByRole('button', { name: 'Unlock group Pavilions' }).click();
  await page.getByRole('button', { name: 'Close layers' }).click();
  await page.getByRole('button', { name: 'Expand inspector' }).click();
  await page
    .getByRole('button', { name: 'Trees around this', exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await saved(page)).project.volumes.filter(
          (v: any) => v.geometry?.kind === 'tree',
        ).length,
    )
    .toBeGreaterThan(4);
  await page.getByRole('button', { name: 'Collapse inspector' }).click();
  await page.getByRole('button', { name: 'More export formats' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export OBJ', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('atelier-model.obj');
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(c);
  const text = Buffer.concat(chunks).toString();
  expect(text).toContain('Units: meters');
  expect(text).toContain('o Tree');
  expect(text).toMatch(/\nf \d+ \d+ \d+/);
  const before = (await saved(page)).project;
  await page.reload();
  await expect.poll(async () => (await saved(page)).project).toEqual(before);
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    String(before.volumes.length),
  );
  await page.screenshot({ path: 'test-results/atelier-trees.png' });
  expect(errors).toEqual([]);
});
test('reference photo is downsampled, sent to the model route and retained for follow-up (explicit provider fixture)', async ({
  page,
}) => {
  test.setTimeout(60000);
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
        intent: 'clarify',
        message: 'How wide should this building be in meters?',
        operations: [],
      },
    });
  });
  await ready(page);
  const before = (await saved(page)).project;
  const png = await page.locator('canvas').screenshot();
  await page.getByLabel('Attach reference image file').setInputFiles({
    name: 'inspiration.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await expect(page.getByAltText('Attached design reference 1')).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Message Atelier' })
    .fill('Develop a pavilion inspired by this photo.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('log')).toContainText(
    'How wide should this building be',
  );
  expect(body.images[0]).toMatch(/^data:image\/jpeg;base64,/);
  expect(body.images[0].length).toBeLessThanOrEqual(1000000);
  expect((await saved(page)).project).toEqual(before);
  await page.reload();
  await expect(page.getByAltText('Design reference 1')).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Message Atelier' })
    .fill('Twenty meters wide.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => body.message).toBe('Twenty meters wide.');
  expect(body.history.some((m: any) => m.images?.length === 1)).toBe(true);
});
