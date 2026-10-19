import { expect, test } from '@playwright/test';
const saved = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
test('sample house opens from the first-screen invitation, stays editable and preserves the previous project', async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
    { timeout: 20000 },
  );
  const original = await saved(page);
  await page
    .getByRole('button', { name: 'Explore an editable sample house' })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '24',
    { timeout: 30000 },
  );
  await expect(
    page.getByRole('button', { name: 'Projects', exact: true }),
  ).toContainText('Glass pavilion');
  const house = await saved(page);
  expect(house.project.groups).toHaveLength(5);
  await page.getByRole('button', { name: 'Edit selected dimensions' }).click();
  const width = page.getByRole('spinbutton', { name: 'Width', exact: true });
  await width.fill('14');
  await width.press('Enter');
  await expect(width).toHaveValue('14');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(width).toHaveValue('12');
  await page
    .getByRole('button', { name: 'Close inspector', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Atelier Close conversation' })
    .click();
  await page.getByRole('button', { name: 'Frame all', exact: true }).click();
  await page.screenshot({ path: 'test-results/atelier-sample-house.png' });
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '24',
    { timeout: 30000 },
  );
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page
    .locator('.project-entry')
    .filter({ hasText: 'Untitled study' })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
    { timeout: 20000 },
  );
  expect((await saved(page)).project).toEqual(original.project);
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page
    .getByRole('button', { name: 'Open sample house', exact: false })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '24',
    { timeout: 30000 },
  );
  expect((await saved(page)).project.volumes[0].id).not.toBe(
    house.project.volumes[0].id,
  );
  expect(errors).toEqual([]);
});
