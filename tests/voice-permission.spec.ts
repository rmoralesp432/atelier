import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';

// A browser-provided synthetic device lets us test real permission denial,
// rather than the runner's unrelated absence of physical audio hardware.
test.use({
  launchOptions: {
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: [
      '--no-sandbox',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--use-fake-device-for-media-stream',
    ],
  },
});

test('browser microphone denial leaves voice stopped and the mobile workspace usable', async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: {
        configured: true,
        authenticated: true,
        agentConfigured: true,
        voiceConfigured: true,
      },
    }),
  );
  let voiceCalls = 0;
  await page.route('**/api/voice', (r) => {
    voiceCalls++;
    return r.abort();
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Browser.setPermission', {
    permission: { name: 'microphone' },
    setting: 'denied',
    origin: 'http://127.0.0.1:4173',
  });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  const orb = page.getByRole('button', { name: 'Voice orb' });
  await orb.click();
  await expect(page.getByRole('alert')).toContainText(/permission|denied/i);
  await expect(orb).toHaveAttribute('aria-pressed', 'false');
  expect(voiceCalls).toBe(0);
  expect(
    await page.evaluate(
      async () =>
        (
          await navigator.permissions.query({
            name: 'microphone' as PermissionName,
          })
        ).state,
    ),
  ).toBe('denied');
  await orb.dblclick();
  await expect(
    page.getByRole('textbox', { name: 'Message Atelier' }),
  ).toBeVisible();
  await expect(page.getByLabel('Conversation language')).toHaveValue('en');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
});
