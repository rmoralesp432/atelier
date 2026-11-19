import { test, expect } from '@playwright/test';
import { openTool } from './tools';
test('manual slabs and windows are discoverable, independent, and transparent in solid and hidden line', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page
    .getByRole('toolbar', { name: 'Shape selected objects' })
    .getByRole('button', { name: 'Slabs & windows', exact: true })
    .click();
  await page.getByLabel('Occupied floors').fill('2');
  await page
    .getByRole('button', { name: 'Create editable slabs & windows' })
    .click();
  await page.getByRole('button', { name: 'Apply change' }).click();
  const viewport = page.getByTestId('viewport');
  await expect
    .poll(async () => Number(await viewport.getAttribute('data-glass-parts')))
    .toBeGreaterThan(8);
  await expect(viewport).toHaveAttribute('data-opaque-glass', '0');
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Appearance settings' }),
  ).toBeVisible();
  await expect(page.getByLabel('Latitude', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Hidden line', exact: true }).click();
  await expect(viewport).toHaveAttribute('data-render-mode', 'hidden-line');
  await expect(viewport).toHaveAttribute('data-opaque-glass', '0');
  await page.screenshot({ path: 'test-results/transparent-hidden-line.png' });
  await openTool(page, 'Change map location');
  await expect(
    page.getByRole('region', { name: 'Location settings' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Hidden line', exact: true }),
  ).toHaveCount(0);
});
