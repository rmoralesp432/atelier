import { test, expect } from '@playwright/test';
import { openTool } from './tools';
test.use({ storageState: { cookies: [], origins: [] } });
test('start screen preserves projects and offers a quiet manual entry on desktop and phone', async ({
  page,
}) => {
  test.setTimeout(90000);
  let paidCalls = 0;
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: false, authenticated: true, voiceConfigured: false },
    }),
  );
  await page.route('**/api/voice', (r) => {
    paidCalls++;
    return r.abort();
  });
  await page.route('**/api/plan', (r) => {
    paidCalls++;
    return r.abort();
  });
  await page.goto('/');
  await expect(
    page.getByRole('main', { name: 'ATELIER start screen' }),
  ).toBeVisible();
  await expect(page.getByTestId('viewport')).toHaveCount(0);
  await expect(page.locator('.orb-large')).toBeVisible();
  await page.screenshot({ path: 'test-results/atelier-start-desktop.png' });
  await page.getByRole('button', { name: 'Continue without AI' }).click();
  await page.getByLabel('Name your new project').fill('Garden study');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '0',
  );
  await expect(
    page.getByRole('button', { name: 'Projects', exact: true }),
  ).toContainText('Garden study');
  // Return to an inactive project from the lightweight entrance list.
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByLabel('New project name').fill('Other space');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Projects', exact: true }),
  ).toContainText('Other space');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole('button', { name: 'Continue without AI' }).click();
  await expect(
    page.getByRole('button', { name: /Garden study/ }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/atelier-start-phone.png' });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: /Garden study/ }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '0',
  );
  await expect(
    page.getByRole('button', { name: 'Projects', exact: true }),
  ).toContainText('Garden study');
  expect(paidCalls).toBe(0);
});
test('AI entry uses the existing password endpoint and never starts voice automatically', async ({
  page,
}) => {
  let authenticated = false,
    mic = 0;
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated, voiceConfigured: true },
    }),
  );
  await page.route('**/api/login', (r) => {
    authenticated =
      r.request().postDataJSON().password === 'test-workspace-password';
    return r.fulfill({ status: authenticated ? 200 : 401, json: {} });
  });
  await page.route('**/api/voice', (r) => {
    mic++;
    return r.abort();
  });
  await page.goto('/');
  await expect(page.locator('.orb-large')).toBeVisible();
  await page.getByText('AI settings', { exact: true }).click();
  await page.getByLabel('Workspace password').fill('wrong');
  await page.getByRole('button', { name: 'Continue with AI' }).click();
  await expect(page.getByRole('alert')).toContainText('not accepted');
  await page.getByLabel('Workspace password').fill('test-workspace-password');
  await page.getByRole('button', { name: 'Continue with AI' }).click();
  await expect(page.locator('.orb-large')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Your projects.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Talk to Atelier' }),
  ).toBeVisible();
  expect(mic).toBe(0);
  expect(
    await page.evaluate(() =>
      JSON.stringify(localStorage).includes('test-workspace-password'),
    ),
  ).toBe(false);
  await page.screenshot({ path: 'test-results/atelier-ai-welcome.png' });
});

test('AI can be enabled after manual entry and stays enabled when changing projects', async ({
  page,
}) => {
  // Two workspace mounts and a durable save on software-rendered CI.
  test.setTimeout(90000);
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: {
        configured: true,
        authenticated: true,
        voiceConfigured: true,
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue without AI' }).click();
  await page.getByRole('button', { name: 'Continue workspace' }).click();
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  await expect(page.getByLabel('Atelier voice companion')).toHaveAttribute(
    'data-ai-enabled',
    'false',
  );
  await expect(
    page.getByLabel('Atelier voice companion').locator('.audio-orb'),
  ).toBeVisible();
  await openTool(page, 'AI settings');
  await page
    .getByRole('button', { name: 'Enable AI / check connection' })
    .click();
  await page.getByRole('button', { name: 'Close connection settings' }).click();
  await expect(page.getByLabel('Atelier voice companion')).toHaveAttribute(
    'data-ai-enabled',
    'true',
  );
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByLabel('New project name').fill('AI garden');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '0',
  );
  const minimize = page.getByRole('button', { name: 'Minimize conversation' });
  if (await minimize.isVisible()) await minimize.click();
  await expect(page.getByLabel('Atelier voice companion')).toHaveAttribute(
    'data-ai-enabled',
    'true',
  );
});
