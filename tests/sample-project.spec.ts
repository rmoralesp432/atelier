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
    '134',
    { timeout: 30000 },
  );
  await expect(
    page.getByRole('button', { name: 'Projects', exact: true }),
  ).toContainText('Glass pavilion');
  const house = await saved(page);
  expect(house.project.groups).toHaveLength(6);
  await page.getByRole('button', { name: 'Edit selected dimensions' }).click();
  const width = page.getByRole('spinbutton', { name: 'Width', exact: true });
  await width.fill('14');
  await width.press('Enter');
  await expect(width).toHaveValue('14');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(width).toHaveValue('16.68');
  await page
    .getByRole('button', { name: 'Close inspector', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Atelier Close conversation' })
    .click();
  await page.getByRole('button', { name: 'Frame all', exact: true }).click();
  const canvas = (await page.locator('canvas').first().boundingBox())!;
  await page.mouse.move(
    canvas.x + canvas.width * 0.7,
    canvas.y + canvas.height * 0.4,
  );
  await page.mouse.wheel(0, -250);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'test-results/atelier-sample-house.png' });
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '134',
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
    '134',
    { timeout: 30000 },
  );
  expect((await saved(page)).project.volumes[0].id).not.toBe(
    house.project.volumes[0].id,
  );
  expect(errors).toEqual([]);
});

test('phone sample exposes searchable editable windows without replacing the original workspace', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Explore an editable sample house' })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '134',
    { timeout: 30000 },
  );
  await page.getByRole('button', { name: 'Show objects', exact: true }).click();
  await page
    .getByRole('searchbox', { name: 'Find objects' })
    .fill('North · window 1');
  await expect(page.locator('.object-row:visible')).toHaveCount(1);
  await page.locator('.object-row:visible').click();
  await page
    .getByRole('button', { name: 'Close objects', exact: true })
    .click();
  await page.getByRole('button', { name: 'Edit selected dimensions' }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Width', exact: true }),
  ).toHaveValue('2.94');
  const depth = page.getByRole('spinbutton', { name: 'Depth', exact: true });
  await expect(depth).toHaveValue('0.025');
  const state = await saved(page);
  expect(
    state.project.volumes.find(
      (v: { id: string }) => v.id === state.project.selectedId,
    ).material,
  ).toBe('glass');
  await page.screenshot({ path: 'test-results/atelier-sample-phone.png' });
  await page
    .getByRole('button', { name: 'Close inspector', exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
