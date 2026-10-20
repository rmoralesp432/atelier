import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  permissions: ['camera'],
  launchOptions: {
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: [
      '--no-sandbox',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  },
});

async function open(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Design tools', exact: true }).click();
  await page
    .getByRole('button', { name: 'Camera settings', exact: true })
    .click();
  await page.getByRole('button', { name: 'View in your space · AR' }).click();
  await page
    .getByRole('button', { name: 'Prepare AR model', exact: true })
    .click();
  await expect(
    page.getByRole('link', { name: 'Download AR model (.usdz)' }),
  ).toBeVisible({ timeout: 30000 });
  await page
    .getByRole('button', { name: 'Confirm scale', exact: false })
    .click();
}

test('real camera-overlay renderer supports life-size positioning, turning, see-through and stops camera on exit', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Chromium's simulated camera supplies frames; no ARKit or physical tracking is simulated.
  await open(page);
  const saved = await page.evaluate(() =>
    localStorage.getItem('atelier.session.v2'),
  );
  await page
    .getByRole('button', { name: 'Open camera with manual controls' })
    .click();
  const overlay = page.locator('.ar-overlay.active');
  await expect(overlay).toHaveAttribute('data-camera-scale', '0.01', {
    timeout: 30000,
  });
  await expect(overlay.locator('.ar-controls')).toHaveAttribute(
    'data-expanded',
    'false',
  );
  expect(
    (await overlay.locator('.ar-controls').boundingBox())!.height,
  ).toBeLessThan(120);
  await expect(
    overlay.getByRole('textbox', { name: 'Message Atelier' }),
  ).toBeHidden();
  await overlay.getByRole('button', { name: 'Placement', exact: true }).click();
  await expect(
    overlay.getByText('Manual camera overlay ·', { exact: false }),
  ).toBeVisible();
  expect(
    await overlay
      .locator('video')
      .evaluate((v: HTMLVideoElement) => v.videoWidth),
  ).toBeGreaterThan(0);
  await page.evaluate(() => {
    (window as any).__cameraTracks =
      (document.querySelector('.ar-camera-feed') as HTMLVideoElement)
        .srcObject instanceof MediaStream
        ? (
            (document.querySelector('.ar-camera-feed') as HTMLVideoElement)
              .srcObject as MediaStream
          ).getTracks()
        : [];
  });
  await overlay.getByText('Size & placement', { exact: false }).click();
  await overlay
    .getByRole('button', { name: 'Change scale', exact: true })
    .click();
  await overlay.getByLabel('Live AR scale').selectOption('1');
  await overlay
    .getByRole('button', { name: 'Confirm scale', exact: false })
    .click();
  await overlay
    .getByRole('button', { name: 'Rotate AR 90 degrees', exact: true })
    .click();
  await expect(overlay).toHaveAttribute('data-camera-rotation', '90');
  await overlay.getByText('Size & placement', { exact: false }).click();
  await overlay.getByRole('button', { name: 'Bring in front of me' }).click();
  await overlay.getByLabel('AR move increment').selectOption('5');
  const initial = (await overlay.getAttribute('data-camera-position'))!
    .split(',')
    .map(Number);
  await overlay.getByRole('button', { name: 'Farther', exact: true }).click();
  await overlay.getByRole('button', { name: 'Raise', exact: true }).click();
  const moved = (await overlay.getAttribute('data-camera-position'))!
    .split(',')
    .map(Number);
  expect(moved[2]).toBeCloseTo(initial[2] - 5);
  expect(moved[1]).toBeCloseTo(initial[1] + 5);
  await overlay.getByRole('button', { name: 'Lower', exact: true }).click();
  await overlay.getByLabel('See-through model').check();
  await expect(overlay).toHaveAttribute('data-camera-transparent', 'true');
  await overlay.getByLabel('See-through model').uncheck();
  await expect(overlay).toHaveAttribute('data-camera-transparent', 'false');
  await overlay.getByRole('button', { name: 'Placement', exact: true }).click();
  await page.mouse.move(160, 550);
  await page.mouse.down();
  await page.mouse.move(210, 570, { steps: 4 });
  await page.mouse.up();
  expect(
    (await overlay.getAttribute('data-camera-position'))!
      .split(',')
      .map(Number)[0],
  ).not.toBe(initial[0]);
  await overlay.getByRole('button', { name: 'Fit model', exact: true }).click();
  await expect(overlay).toHaveAttribute('data-camera-scale', '1');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 160, y: 550, id: 1 },
      { x: 240, y: 550, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 170, y: 520, id: 1 },
      { x: 230, y: 580, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(overlay).not.toHaveAttribute('data-camera-rotation', '90');
  await expect(overlay).toHaveAttribute('data-camera-scale', '1');
  const depthBefore = Number(
    (await overlay.getAttribute('data-camera-position'))!.split(',')[2],
  );
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 100, y: 400, id: 1 },
      { x: 290, y: 400, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 140, y: 400, id: 1 },
      { x: 250, y: 400, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  expect(
    Number((await overlay.getAttribute('data-camera-position'))!.split(',')[2]),
  ).toBeLessThan(depthBefore);
  await expect(overlay).toHaveAttribute('data-camera-scale', '1');
  await overlay.getByRole('button', { name: 'Chat', exact: true }).click();
  await overlay.getByRole('textbox', { name: 'Message Atelier' }).click();
  await overlay
    .getByRole('textbox', { name: 'Message Atelier' })
    .fill('Compare this with the room');
  await page.screenshot({ path: 'test-results/atelier-camera-placement.png' });
  expect(
    await page.evaluate(() => localStorage.getItem('atelier.session.v2')),
  ).toBe(saved);
  await overlay.getByRole('button', { name: 'Exit AR', exact: true }).click();
  await expect(overlay).toBeHidden();
  expect(
    await page.evaluate(() =>
      (window as any).__cameraTracks.every(
        (t: MediaStreamTrack) => t.readyState === 'ended',
      ),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('camera rejection returns to the project with an actionable error', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException(
        'Camera permission was denied. Allow camera access in browser settings and retry.',
        'NotAllowedError',
      );
    };
  });
  await open(page);
  await page
    .getByRole('button', { name: 'Open camera with manual controls' })
    .click();
  await expect(
    page.getByRole('region', { name: 'View in your space' }).getByRole('alert'),
  ).toContainText('Camera permission was denied');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await expect(page.locator('.ar-overlay.active')).toHaveCount(0);
});
