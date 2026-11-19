import { expect, test } from '@playwright/test';
import { criteria, measure, selector } from './fixtures/completion';

test('selection during planning cannot retarget a destructive edit or mislabel its review', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: {
        configured: true,
        authenticated: true,
        agentConfigured: false,
        voiceConfigured: false,
      },
    }),
  );
  let release!: () => void,
    waiting = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/plan', async (r) => {
    waiting = true;
    await gate;
    return r.fulfill({
      json: {
        intent: 'apply',
        message: 'Remove the originally selected object.',
        operations: [{ type: 'delete', targets: ['$selected'] }],
      },
    });
  });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await page.getByRole('button', { name: 'Show objects', exact: true }).click();
  await page.locator('.object-row').first().click();
  const saved = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem('atelier.session.v2')!),
    );
  await expect
    .poll(async () => (await saved()).project.selectedId)
    .toBeTruthy();
  const original = await saved(),
    [first, other] = original.project.volumes;
  await page.route('**/api/completion-criteria', (r) =>
    r.fulfill({
      json: criteria(
        [measure('survivor', 'count', 1, selector([other.id]))],
        [first.id],
        r.request().postDataJSON().message,
      ),
    }),
  );
  await page
    .getByRole('textbox', { name: 'Message Atelier' })
    .fill('Delete the selected object.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => waiting).toBe(true);
  await page.locator('.object-row').last().click();
  await expect
    .poll(async () => (await saved()).project.selectedId)
    .toBe(other.id);
  release();
  const review = page.getByRole('region', { name: 'Review geometry change' });
  await expect(review).toBeVisible();
  await expect(review).toContainText(`Remove ${first.name}.`);
  expect((await saved()).project.volumes).toEqual(original.project.volumes);
  await page.getByRole('button', { name: 'Apply change', exact: true }).click();
  await expect
    .poll(async () => (await saved()).project.volumes)
    .toEqual([other]);
  expect((await saved()).project.selectedId).toBe(other.id);
});
