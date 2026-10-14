import { expect, test, type Page } from '@playwright/test';
async function command(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Geometry command' }).fill(text);
  await page.getByRole('button', { name: 'Run command', exact: true }).click();
}
async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
  await expect(page.locator('canvas')).toBeVisible();
}
test('renders a real 3D model, orbits, frames and changes view without runtime errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ready(page);
  await expect(
    page.getByRole('spinbutton', { name: 'Width', exact: true }),
  ).toHaveValue('14');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/atelier-desktop.png' });
  const canvas = page.locator('canvas');
  const before = await canvas.screenshot();
  const rect = (await canvas.boundingBox())!;
  await page.mouse.move(rect.x + rect.width * 0.65, rect.y + rect.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 0.8, rect.y + rect.height * 0.6, {
    steps: 12,
  });
  await page.mouse.up();
  await page.waitForTimeout(600);
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  await page.getByRole('button', { name: 'Frame all', exact: true }).click();
  await page.getByRole('button', { name: 'Perspective', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Top view', exact: true }),
  ).toBeVisible();
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  expect(errors).toEqual([]);
});
test('commands create, modify, duplicate, undo, redo and persist exact geometry', async ({
  page,
}) => {
  await ready(page);
  await command(page, 'create volume width 12.25 depth 8 height 6');
  await expect(
    page.getByRole('spinbutton', { name: 'Width', exact: true }),
  ).toHaveValue('12.25');
  await command(page, 'move selected x 20 y 2 z -3');
  await expect(
    page.getByRole('spinbutton', { name: 'X', exact: true }),
  ).toHaveValue('20');
  await command(page, 'resize selected width 10 depth 5 height 3');
  await expect(page.getByTestId('volume-stat')).toHaveText('150 m³');
  await command(page, 'rotate selected 45');
  await expect(
    page.getByRole('spinbutton', { name: 'Yaw', exact: true }),
  ).toHaveValue('45');
  await command(page, 'duplicate selected');
  await expect(
    page.getByRole('spinbutton', { name: 'X', exact: true }),
  ).toHaveValue('22');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'X', exact: true }),
  ).toHaveValue('20');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'X', exact: true }),
  ).toHaveValue('22');
  await page.reload();
  await expect(
    page.getByRole('spinbutton', { name: 'Yaw', exact: true }),
  ).toHaveValue('45');
  await expect(page.locator('.object-row')).toHaveCount(4);
  await command(page, 'delete selected');
  await expect(page.locator('.object-row')).toHaveCount(3);
  await expect(page.getByText('Make a selection')).toBeVisible();
});
test('inspector edits, validation, scene selection, shortcuts and command guide', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: /Vertical annex/ }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Height', exact: true }),
  ).toHaveValue('9');
  const width = page.getByRole('spinbutton', { name: 'Width', exact: true });
  await width.fill('7.125');
  await width.press('Enter');
  await expect(width).toHaveValue('7.125');
  await width.fill('-1');
  await width.press('Enter');
  await expect(page.getByRole('alert')).toContainText(
    'Dimensions must be between',
  );
  await expect(width).toHaveValue('7.125');
  await page
    .getByRole('textbox', { name: 'Geometry command' })
    .fill('not a command');
  await page.getByRole('button', { name: 'Run command', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Command not recognized');
  await expect(page.locator('.object-row')).toHaveCount(2);
  await page
    .getByRole('button', { name: 'Command guide', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByRole('button', {
      name: 'create volume width 12 depth 8 height 6',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('textbox', { name: 'Geometry command' }),
  ).toHaveValue('create volume width 12 depth 8 height 6');
  await page.getByRole('textbox', { name: 'Geometry command' }).press('Enter');
  await expect(page.locator('.object-row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await page.keyboard.press('r');
  await expect(
    page.getByRole('button', { name: 'Rotate', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
test('exports and imports a project and rejects invalid files', async ({
  page,
}) => {
  await ready(page);
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export project', exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('atelier-project.json');
  const path = (await download.path())!;
  await command(page, 'delete selected');
  await page.getByLabel('Import project file').setInputFiles(path);
  await expect(page.locator('.object-row')).toHaveCount(2);
  await page.getByLabel('Import project file').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":9000}'),
  });
  await expect(page.getByRole('alert')).toContainText('Unsupported project');
  await expect(page.locator('.object-row')).toHaveCount(2);
});
test('canvas raycasting selects volumes and background clears selection', async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole('button', { name: 'Clear selection', exact: true })
    .click();
  const canvas = page.locator('canvas');
  const rect = (await canvas.boundingBox())!;
  // The framed sample model is centered in the camera target.
  await canvas.click({ position: { x: rect.width / 2, y: rect.height / 2 } });
  await expect(
    page.getByRole('textbox', { name: 'Object name', exact: true }),
  ).toBeVisible();
  await canvas.click({ position: { x: rect.width - 30, y: rect.height - 90 } });
  await expect(page.getByText('Make a selection')).toBeVisible();
});
test('translation handle moves the actual model with snapping and undo', async ({
  page,
}) => {
  await ready(page);
  await command(page, 'delete selected');
  await page.getByRole('button', { name: /Vertical annex/ }).click();
  await command(page, 'delete selected');
  await command(page, 'create box 4 x 4 x 4');
  await page.getByRole('button', { name: 'Perspective', exact: true }).click();
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await page.waitForTimeout(700);
  const canvas = page.locator('canvas');
  const r = (await canvas.boundingBox())!;
  await page.screenshot({ path: 'test-results/atelier-handles.png' });
  await page.mouse.move(r.x + r.width / 2 + 45, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + 125, r.y + r.height / 2, {
    steps: 15,
  });
  await page.mouse.up();
  const x = page.getByRole('spinbutton', { name: 'X', exact: true });
  await expect(x).not.toHaveValue('0');
  const moved = Number(await x.inputValue());
  expect(moved % 0.5).toBe(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(x).toHaveValue('0');
});
