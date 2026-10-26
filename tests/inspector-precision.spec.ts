import { expect, test } from '@playwright/test';

test('inspector uses millimeter length steps and whole-degree yaw steps', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );

  const width = page.getByRole('spinbutton', { name: 'Width', exact: true });
  await expect(width).toHaveAttribute('step', '0.001');
  await width.press('ArrowUp');
  await width.press('Enter');
  await expect(width).toHaveValue('14.001');

  const yaw = page.getByRole('spinbutton', { name: 'Yaw', exact: true });
  await expect(yaw).toHaveAttribute('step', '1');
  await yaw.press('ArrowUp');
  await yaw.press('Enter');
  await expect(yaw).toHaveValue('1');
});
