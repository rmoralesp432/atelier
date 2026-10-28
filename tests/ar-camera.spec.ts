import { openTool } from './tools';
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
  await openTool(page, 'Camera settings');
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
    .getByRole('button', { name: 'Open camera preview (untracked)' })
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
    .getByRole('button', { name: 'Open camera preview (untracked)' })
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

test('manual preview hands size and rotation to a fresh native AR launch, not a simulated room anchor', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    const supports = DOMTokenList.prototype.supports;
    DOMTokenList.prototype.supports = function (token: string) {
      return token === 'ar' || supports.call(this, token);
    };
  });
  await open(page);
  const before = await page.evaluate(() =>
    localStorage.getItem('atelier.session.v2'),
  );
  await page
    .getByRole('button', { name: 'Prepare life-size AR', exact: true })
    .click();
  const native = page.getByRole('link', { name: 'Open real AR', exact: true });
  await expect(native).toBeVisible({ timeout: 30000 });
  await expect(page.getByLabel('AR viewing scale')).toHaveValue('1');
  await expect(native).not.toHaveAttribute('href', /allowsContentScaling=0/);
  await page
    .getByRole('button', { name: 'Open camera preview (untracked)' })
    .click();
  const overlay = page.locator('.ar-overlay.active');
  await expect(overlay).toHaveAttribute('data-camera-scale', '1');
  await expect(
    overlay.getByText('Camera preview · not anchored', { exact: true }),
  ).toBeVisible();
  expect(
    (await overlay.locator('.ar-controls').boundingBox())!.height,
  ).toBeLessThan(160);
  await page.evaluate(() => {
    (window as any).__handoffTracks = (
      (document.querySelector('.ar-camera-feed') as HTMLVideoElement)
        .srcObject as MediaStream
    ).getTracks();
  });
  await overlay.getByRole('button', { name: 'Placement', exact: true }).click();
  await overlay.getByLabel('AR move increment').selectOption('5');
  await overlay.getByRole('button', { name: 'Farther', exact: true }).click();
  await overlay.getByRole('button', { name: 'Raise', exact: true }).click();
  await overlay.getByText('Size & placement', { exact: false }).click();
  await overlay
    .getByRole('button', { name: 'Rotate AR 90 degrees', exact: true })
    .click();
  await expect(overlay).toHaveAttribute('data-camera-rotation', '90');
  await overlay.getByRole('button', { name: 'Placement', exact: true }).click();
  await page.screenshot({
    path: 'test-results/camera-preview-native-path.png',
  });
  await overlay
    .getByRole('button', { name: 'Continue in real AR', exact: true })
    .click();
  await expect(overlay).toBeHidden();
  const guide = page.getByRole('region', {
    name: 'Continue in real AR',
    exact: true,
  });
  await expect(guide).toContainText('Position starts fresh');
  await expect(native).toBeVisible({ timeout: 30000 });
  await expect(native).toHaveAttribute('rel', 'ar');
  expect(
    await page.evaluate(() =>
      (window as any).__handoffTracks.every(
        (t: MediaStreamTrack) => t.readyState === 'ended',
      ),
    ),
  ).toBe(true);
  // Actual USDZ output, not mocked geometry. Translation from the untracked
  // preview must not be baked in; orientation and life-size units are retained.
  const text = await native.evaluate(async (a: HTMLAnchorElement) =>
    new TextDecoder().decode(await (await fetch(a.href)).arrayBuffer()),
  );
  expect(text).toContain('metersPerUnit = 1');
  const matrices = [
    ...text.matchAll(/matrix4d xformOp:transform = \(([^\n]+)\)/g),
  ].map((match) => match[1].replace(/[()]/g, '').split(',').map(Number));
  const rotated = matrices.find(
    (m) => Math.abs(m[2] + 1) < 1e-6 && Math.abs(m[8] - 1) < 1e-6,
  );
  expect(rotated).toBeDefined();
  expect(rotated!.slice(12, 15)).toEqual([0, 0, 0]);
  expect(rotated![5]).toBeCloseTo(1);
  await expect(native).not.toHaveAttribute('href', /allowsContentScaling=0/);
  // A separate real tap initiates the native handoff; Chromium cannot run Apple's viewer.
  await native.evaluate((a) =>
    a.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        (window as any).__nativeTap = e.isTrusted;
      },
      { once: true },
    ),
  );
  await native.click();
  expect(await page.evaluate(() => (window as any).__nativeTap)).toBe(true);
  await page.screenshot({ path: 'test-results/native-ar-handoff-phone.png' });
  expect(
    await page.evaluate(() => localStorage.getItem('atelier.session.v2')),
  ).toBe(before);
});
