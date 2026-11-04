import { test, expect } from '@playwright/test';
import { initialProject } from '../src/model';
import { openTool } from './tools';

test('seasonal sun studies update actual paths, civil times and shadows, with text settings sharing the same controls', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    (project) =>
      localStorage.setItem(
        'atelier.project.v1',
        JSON.stringify({ version: 2, ...project }),
      ),
    {
      ...initialProject(),
      site: { latitude: 51.5, longitude: 0, bearing: 30 },
    },
  );
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  await page.route('**/api/plan', (r) => {
    const body = r.request().postDataJSON();
    expect(body.scene.site).toEqual({
      latitude: 51.5,
      longitude: 0,
      bearing: 30,
    });
    expect(body.workspace.solar.seasonal).toBe(true);
    return r.fulfill({
      json: {
        intent: 'apply',
        message: 'Evening solar study.',
        operations: [
          {
            type: 'solar_study',
            enabled: true,
            date: '2026-06-21',
            minutes: 1080,
            utcOffset: 1,
            path: true,
            seasonal: true,
            targets: ['$selected'],
          },
        ],
      },
    });
  });
  await page.goto('/');
  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-model-objects', '2');
  const original = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('atelier.session.v2')!),
  );
  await openTool(page, 'Solar study');
  await page.getByLabel('Solar date').fill('2026-03-20');
  await page.getByLabel('Solar UTC offset').fill('0');
  await page.getByLabel('Solar time', { exact: true }).fill('720');
  await page.getByLabel('Solar lighting', { exact: true }).check();
  await page.getByLabel('Compare solstices & equinoxes').check();
  await expect(viewport).toHaveAttribute('data-sun-paths', '5');
  await expect(page.locator('.solar-daylight')).toContainText('Sunrise');
  await page
    .getByRole('button', { name: 'June solstice', exact: true })
    .click();
  await expect(page.getByLabel('Solar date')).toHaveValue('2026-06-21');
  await expect(
    page.getByRole('button', { name: 'June solstice', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  // The selected preset must remain readable under the pointer. Generic panel
  // hover styles previously made its label white on an almost-white surface.
  await expect
    .poll(async () =>
      page
        .getByRole('button', { name: 'June solstice', exact: true })
        .evaluate((el) => {
          const style = getComputedStyle(el);
          const luminance = (color: string) => {
            const rgb = color
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number)
              .map((c) => {
                const n = c / 255;
                return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
              });
            return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
          };
          const a = luminance(style.color),
            b = luminance(style.backgroundColor);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        }),
    )
    .toBeGreaterThanOrEqual(4.5);
  await expect
    .poll(async () => Number(await viewport.getAttribute('data-sun-altitude')))
    .toBeGreaterThan(60);
  await page.screenshot({
    path: 'test-results/seasonal-solar-study.png',
    animations: 'disabled',
  });
  await page
    .getByRole('button', { name: 'Switch to Night', exact: true })
    .click();
  await expect(viewport).toHaveAttribute('data-theme', 'night');
  await expect(viewport).toHaveAttribute('data-sun-paths', '5');
  await page.screenshot({
    path: 'test-results/seasonal-solar-night.png',
    animations: 'disabled',
  });
  await page
    .getByRole('button', { name: 'Switch to Day', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Message Atelier' })
    .fill(
      'Show June 21 at six in the evening, British summer time, and explain the shadow.',
    );
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByLabel('Solar time', { exact: true })).toHaveValue(
    '1080',
  );
  await expect(page.getByLabel('Solar UTC offset')).toHaveValue('1');
  await expect(page.getByRole('log')).toContainText('Top-point shadow');
  await expect
    .poll(async () => Number(await viewport.getAttribute('data-sun-altitude')))
    .toBeLessThan(40);
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('atelier.session.v2')!),
  );
  expect(after.project).toEqual(original.project);
  expect(after.past).toEqual(original.past);
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = page.getByRole('region', { name: 'Solar study controls' });
  await expect(panel).toBeVisible();
  const bounds = await panel.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/solar-phone.png' });
  expect(errors).toEqual([]);
});
