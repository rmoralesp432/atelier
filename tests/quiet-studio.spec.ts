import { test, expect } from '@playwright/test';
import { initialProject } from '../src/model';
import { openTool } from './tools';
test('idle orbs visibly animate without AI or microphone, on the minimal entrance and minimized phone workspace', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() =>
    localStorage.removeItem('atelier.start-direct'),
  );
  let paid = 0;
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: false, authenticated: true, voiceConfigured: false },
    }),
  );
  for (const path of ['plan', 'voice'])
    await page.route('**/api/' + path, (r) => {
      paid++;
      return r.abort();
    });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Space for your ideas.' }),
  ).toBeVisible();
  await expect(page.locator('.start-wordmark svg')).toBeVisible();
  const core = page.locator('.orb-large .orb-core');
  const first = await core.evaluate((e) => getComputedStyle(e).transform);
  await expect
    .poll(() => core.evaluate((e) => getComputedStyle(e).transform))
    .not.toBe(first);
  await page.screenshot({ path: 'test-results/quiet-welcome-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/quiet-welcome-phone.png' });
  await page.getByRole('button', { name: 'Continue without AI' }).click();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '0',
  );
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  const dock = page.getByLabel('Atelier voice companion');
  await expect(dock.locator('.audio-orb')).toBeVisible();
  await expect(page.locator('.conversation-launcher')).toHaveCount(0);
  expect(await dock.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
    'rgba(0, 0, 0, 0)',
  );
  const before = await dock
    .locator('.orb-core')
    .evaluate((e) => getComputedStyle(e).transform);
  await expect
    .poll(() =>
      dock.locator('.orb-core').evaluate((e) => getComputedStyle(e).transform),
    )
    .not.toBe(before);
  await expect(dock.locator('.audio-orb')).toHaveAttribute(
    'data-audio-level',
    '0.00',
  );
  await page.screenshot({ path: 'test-results/quiet-orb-phone.png' });
  await dock.getByRole('button', { name: 'Voice orb' }).dblclick();
  await expect(
    page.getByRole('textbox', { name: 'Message Atelier' }),
  ).toBeVisible();
  expect(paid).toBe(0);
});
test('sun study plays in the viewport with its panel closed, pauses, reopens and stops without editing geometry', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(
    (p) =>
      localStorage.setItem(
        'atelier.project.v1',
        JSON.stringify({ version: 2, ...p }),
      ),
    {
      ...initialProject(),
      site: { latitude: 51.5, longitude: 0, bearing: 30 },
    },
  );
  await page.goto('/');
  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-model-objects', '2');
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('atelier.session.v2')!).project,
  );
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  await openTool(page, 'Solar study');
  await page.getByLabel('Solar time', { exact: true }).fill('600');
  await page.getByRole('button', { name: 'Watch in viewport' }).click();
  const player = page.getByRole('region', { name: 'Sun study playback' });
  await expect(
    page.getByRole('region', { name: 'Solar study controls' }),
  ).toHaveCount(0);
  await expect(player).toBeVisible();
  const minute = await player.getAttribute('data-minutes');
  const altitude = await viewport.getAttribute('data-sun-altitude');
  await expect.poll(() => player.getAttribute('data-minutes')).not.toBe(minute);
  await expect
    .poll(() => viewport.getAttribute('data-sun-altitude'))
    .not.toBe(altitude);
  await player.getByRole('button', { name: 'Pause solar animation' }).click();
  const paused = await player.getAttribute('data-minutes');
  await page.waitForTimeout(800);
  await expect(player).toHaveAttribute('data-minutes', paused!);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => {
      const controls = await player.boundingBox();
      const selection = await page.locator('.selection-chip').boundingBox();
      return (
        !!controls &&
        !!selection &&
        controls.y >= selection.y + selection.height
      );
    })
    .toBe(true);
  await page.screenshot({ path: 'test-results/quiet-sun-phone.png' });
  await player.getByRole('button', { name: 'Open sun settings' }).click();
  await expect(page.getByLabel('Solar time', { exact: true })).toHaveValue(
    paused!,
  );
  await page.getByRole('button', { name: 'Play solar animation' }).click();
  await page.getByRole('button', { name: 'Close solar study' }).click();
  await expect(
    player.getByRole('button', { name: 'Pause solar animation' }),
  ).toBeVisible();
  await player.getByRole('button', { name: 'Stop sun study' }).click();
  await expect(player).toHaveCount(0);
  await expect(viewport).not.toHaveAttribute('data-sun-altitude', /.+/);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('atelier.session.v2')!).project,
    ),
  ).toEqual(before);
});
