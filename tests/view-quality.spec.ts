import { openTool } from './tools';
import { test, expect } from '@playwright/test';

test('smooth viewing keeps selection, wireframe, and persistent quality controls', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-rendered', 'true');
  await page
    .getByRole('button', { name: 'Studio appearance and location' })
    .click();
  await page.getByLabel('Viewing quality').selectOption('responsive');
  await expect(viewport).toHaveAttribute('data-view-quality', 'responsive');
  await page.getByRole('button', { name: 'Wireframe', exact: true }).click();
  await expect(viewport).toHaveAttribute('data-render-mode', 'wireframe');
  await page.getByRole('button', { name: 'Solid', exact: true }).click();
  await page.getByRole('button', { name: 'Close studio settings' }).click();
  await page.getByRole('button', { name: 'Show objects', exact: true }).click();
  await page.locator('.object-row').first().click();
  await expect(viewport).toHaveAttribute('data-transform-tool', 'translate');
  await openTool(page, 'Section view');
  await page.getByLabel('Show section plane', { exact: true }).uncheck();
  await expect
    .poll(async () =>
      Number(await viewport.getAttribute('data-section-cap-triangles')),
    )
    .toBeGreaterThan(0);
  await page.getByLabel('Section cut', { exact: true }).uncheck();
  await expect(viewport).toHaveAttribute('data-section', 'off');
  await page.getByRole('button', { name: 'Close section controls' }).click();
  await page.reload();
  await expect(viewport).toHaveAttribute('data-view-quality', 'responsive');
  await page
    .getByRole('button', { name: 'Studio appearance and location' })
    .click();
  await expect(page.getByLabel('Viewing quality')).toHaveValue('responsive');
  await page.getByLabel('Viewing quality').selectOption('detail');
  await expect(viewport).toHaveAttribute('data-view-quality', 'detail');
  expect(errors).toEqual([]);
});
