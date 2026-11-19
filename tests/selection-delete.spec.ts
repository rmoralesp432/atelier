import { test, expect, type Page } from '@playwright/test';
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
test('drag selection deletes all objects with keyboard or toolbar; one Undo restores everything', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await page.waitForTimeout(800);
  const rect = (await page.locator('canvas').boundingBox())!;
  await page.keyboard.down('Shift');
  await page.mouse.move(rect.x + 120, rect.y + 200);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width - 140, rect.y + rect.height - 70, {
    steps: 8,
  });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect
    .poll(async () => (await saved(page)).project.selectedIds?.length)
    .toBe(2);
  const before = (await saved(page)).project;
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '0',
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  expect((await saved(page)).project).toEqual(before);
  await page
    .getByRole('button', { name: 'Delete selected objects', exact: true })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '0',
  );
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '0',
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  expect((await saved(page)).project).toEqual(before);
});
