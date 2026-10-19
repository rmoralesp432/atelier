import { test, expect } from '@playwright/test';
test('section cut and visible plane toggle independently; a draggable plane retains position without changing geometry', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
  const saved = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem('atelier.session.v2')!),
    );
  const before = (await saved()).project;
  await page.getByRole('button', { name: 'Section view', exact: true }).click();
  await expect(page.getByLabel('Section cut', { exact: true })).toBeChecked();
  await expect(
    page.getByLabel('Show section plane', { exact: true }),
  ).toBeChecked();
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-section-plane-visible', 'true');
  const initial = Number(
    await page.getByLabel('Exact section position').inputValue(),
  );
  await expect(canvas).toHaveAttribute('data-section-handle', /x/);
  const handle = JSON.parse(
    (await canvas.getAttribute('data-section-handle'))!,
  );
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x, handle.y - 50, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number(await page.getByLabel('Exact section position').inputValue()),
    )
    .not.toBe(initial);
  const moved = await page.getByLabel('Exact section position').inputValue();
  await page.getByLabel('Show section plane', { exact: true }).uncheck();
  await expect(canvas).toHaveAttribute('data-section-plane-visible', 'false');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-section',
    'y',
  );
  await expect
    .poll(async () =>
      Number(
        await page
          .getByTestId('viewport')
          .getAttribute('data-section-cap-triangles'),
      ),
    )
    .toBeGreaterThan(0);
  await page.getByLabel('Section cut', { exact: true }).uncheck();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-section',
    'off',
  );
  await page.getByLabel('Show section plane', { exact: true }).check();
  await expect(canvas).toHaveAttribute('data-section-plane-visible', 'true');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-section',
    'off',
  );
  await page.getByRole('button', { name: 'Close section controls' }).click();
  await page.getByRole('button', { name: 'Section view', exact: true }).click();
  await expect(
    page.getByLabel('Section cut', { exact: true }),
  ).not.toBeChecked();
  await expect(page.getByLabel('Exact section position')).toHaveValue(moved);
  await page.getByLabel('Section cut', { exact: true }).check();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-section',
    'y',
  );
  expect((await saved()).project).toEqual(before);
  await page.screenshot({ path: 'test-results/refined-section-plane.png' });
});
test('model-fixture workspace actions toggle the plane independently through the shared planner contract', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  const actions = [
    'section_on',
    'section_plane_on',
    'section_plane_off',
    'section_off',
  ];
  let turn = 0;
  await page.route('**/api/plan', (r) =>
    r.fulfill({
      json: {
        intent: 'apply',
        message: 'View updated.',
        operations: [{ type: 'workspace', action: actions[turn++] }],
      },
    }),
  );
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Message Atelier' });
  for (const [text, plane, cut] of [
    ['Turn on the cut', 'false', 'y'],
    ['Show its plane', 'true', 'y'],
    ['Hide the plane', 'false', 'y'],
    ['Turn off the cut', 'false', 'off'],
  ]) {
    await input.fill(text);
    await input.press('Enter');
    await expect(page.locator('canvas')).toHaveAttribute(
      'data-section-plane-visible',
      plane,
    );
    await expect(page.getByTestId('viewport')).toHaveAttribute(
      'data-section',
      cut,
    );
  }
});
