import { test, expect } from '@playwright/test';
test('processing feedback follows a real pending request, then geometry formation; no pretend progress changes the project', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/plan', async (r) => {
    await gate;
    await r.fulfill({
      json: {
        intent: 'apply',
        message: 'A new volume.',
        operations: [
          {
            type: 'create',
            shape: 'box',
            width: 10,
            depth: 6,
            height: 8,
            count: 1,
          },
        ],
      },
    });
  });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
  const before = await page.evaluate(() =>
    localStorage.getItem('atelier.session.v2'),
  );
  await page
    .getByRole('textbox', { name: 'Message Atelier' })
    .fill('Create a gallery volume');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.conversation-working')).toBeVisible();
  await expect(page.locator('.process-orb')).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('atelier.session.v2')),
  ).toBe(before);
  await page.screenshot({ path: 'test-results/atelier-processing.png' });
  release();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-construction-active',
    'true',
  );
  await expect(page.getByLabel('Geometry formation')).toBeVisible();
  await expect(page.locator('.spatial-creation-label')).toBeVisible();
  await expect
    .poll(async () =>
      Number(
        await page
          .getByTestId('viewport')
          .getAttribute('data-formation-context'),
      ),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/spatial-volume-formation.png' });
  await expect(page.locator('.conversation-working')).toBeHidden();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-construction-active',
    'false',
    { timeout: 10000 },
  );
  await expect(page.getByLabel('Geometry formation')).toBeHidden();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-formation-context',
    '0',
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('atelier.session.v2')!),
  );
  expect(saved.project.volumes.at(-1).dimensions).toEqual({
    width: 10,
    depth: 6,
    height: 8,
  });
  expect(saved.past).toHaveLength(1);
});
test('edits reveal the actual replacement geometry without changing saved dimensions; reduced motion skips reconstruction', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
  await page.getByRole('button', { name: 'Expand inspector' }).click();
  const width = page.getByRole('spinbutton', { name: 'Width', exact: true });
  await width.fill('22');
  await width.press('Enter');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-construction-kind',
    'reshape',
  );
  await expect(page.getByLabel('Geometry formation')).toContainText(
    'Revealing',
  );
  const immediate = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('atelier.session.v2')!),
  );
  expect(immediate.project.volumes[0].dimensions.width).toBe(22);
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-construction-active',
    'false',
    { timeout: 10000 },
  );
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('atelier.session.v2')!),
    ),
  ).toEqual(immediate);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await width.fill('24');
  await width.press('Enter');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-construction-active',
    'false',
  );
  await expect(page.getByLabel('Geometry formation')).toBeHidden();
});
