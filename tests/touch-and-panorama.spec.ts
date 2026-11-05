import { openTool } from './tools';
import { expect, test, type Page, type CDPSession } from '@playwright/test';
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
async function touch(
  cdp: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  points: { x: number; y: number; id: number }[],
) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((p) => ({
      ...p,
      radiusX: 8,
      radiusY: 8,
      force: 1,
    })),
  });
}
async function ready(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
    { timeout: 30000 },
  );
}
async function openPanoramas(page: Page) {
  await page.getByRole('button', { name: 'Design tools', exact: true }).click();
  await openTool(page, 'Open panoramas');
  await expect(
    page.getByRole('dialog', { name: 'Panorama viewer' }),
  ).toBeVisible();
}
async function photo(page: Page) {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const context = canvas.getContext('2d')!;
    ['#c65c40', '#9bc8a9', '#304c6e', '#eedcb2'].forEach((color, i) => {
      context.fillStyle = color;
      context.fillRect(i * 512, 0, 512, 1024);
    });
    context.fillStyle = '#fff';
    context.font = '80px sans-serif';
    context.fillText('PANORAMA TEST', 720, 500);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return {
    name: 'Lobby.png',
    mimeType: 'image/png',
    buffer: Buffer.from(data, 'base64'),
  };
}

test('iPhone touch orbit, one-finger pan and two-finger pinch move the real camera without editing or changing selection', async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  });
  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-touch-navigation', 'orbit');
  const before = await saved(page);
  const position = await viewport.getAttribute('data-camera-position');
  await touch(cdp, 'touchStart', [{ x: 180, y: 430, id: 1 }]);
  for (let i = 1; i <= 6; i++)
    await touch(cdp, 'touchMove', [{ x: 180 + i * 12, y: 430 + i * 3, id: 1 }]);
  await touch(cdp, 'touchEnd', []);
  await expect(viewport).not.toHaveAttribute('data-camera-position', position!);
  expect(await saved(page)).toEqual(before);
  await page.getByRole('button', { name: 'Touch pan', exact: true }).click();
  const target = await viewport.getAttribute('data-camera-target');
  await touch(cdp, 'touchStart', [{ x: 180, y: 430, id: 1 }]);
  for (let i = 1; i <= 6; i++)
    await touch(cdp, 'touchMove', [{ x: 180 + i * 10, y: 430, id: 1 }]);
  await touch(cdp, 'touchEnd', []);
  await expect(viewport).not.toHaveAttribute('data-camera-target', target!);
  const distance = Number(await viewport.getAttribute('data-camera-distance'));
  await touch(cdp, 'touchStart', [
    { x: 150, y: 410, id: 1 },
    { x: 250, y: 410, id: 2 },
  ]);
  for (let i = 1; i <= 5; i++)
    await touch(cdp, 'touchMove', [
      { x: 150 - i * 8, y: 410, id: 1 },
      { x: 250 + i * 8, y: 410, id: 2 },
    ]);
  await touch(cdp, 'touchEnd', []);
  await expect
    .poll(async () =>
      Number(await viewport.getAttribute('data-camera-distance')),
    )
    .toBeLessThan(distance * 0.85);
  expect(await saved(page)).toEqual(before);
  await expect(page.locator('.selection-marquee')).toBeHidden();
  await page.getByRole('button', { name: 'Touch edit', exact: true }).click();
  await expect(viewport).toHaveAttribute('data-touch-navigation', 'edit');
  await expect(
    page.getByRole('button', { name: 'Move', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/atelier-phone-touch-navigation.png',
  });
});

test('panorama image renders, touch pans and pinches, persists, exports and remains isolated from model edits', async ({
  page,
}) => {
  test.setTimeout(150000);
  await ready(page);
  const before = await saved(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  });
  await openPanoramas(page);
  await page.getByLabel('Panorama image file').setInputFiles(await photo(page));
  const viewer = page.getByTestId('panorama-viewport');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(page.getByLabel('Current panorama')).toContainText('Lobby');
  await touch(cdp, 'touchStart', [{ x: 180, y: 400, id: 1 }]);
  for (let i = 1; i <= 6; i++)
    await touch(cdp, 'touchMove', [{ x: 180 + i * 10, y: 400, id: 1 }]);
  await touch(cdp, 'touchEnd', []);
  await expect
    .poll(async () => Math.abs(Number(await viewer.getAttribute('data-yaw'))))
    .toBeGreaterThan(5);
  const fov = Number(await viewer.getAttribute('data-fov'));
  await touch(cdp, 'touchStart', [
    { x: 150, y: 410, id: 1 },
    { x: 250, y: 410, id: 2 },
  ]);
  for (let i = 1; i <= 5; i++)
    await touch(cdp, 'touchMove', [
      { x: 150 - i * 8, y: 410, id: 1 },
      { x: 250 + i * 8, y: 410, id: 2 },
    ]);
  await touch(cdp, 'touchEnd', []);
  await expect
    .poll(async () => Number(await viewer.getAttribute('data-fov')))
    .toBeLessThan(fov);
  await page.getByRole('button', { name: 'Reset panorama view' }).click();
  await expect
    .poll(async () => Math.abs(Number(await viewer.getAttribute('data-yaw'))))
    .toBeLessThan(0.1);
  await page.screenshot({ path: 'test-results/atelier-panorama-phone.png' });
  expect(await saved(page)).toEqual(before);
  await page
    .getByRole('button', { name: 'Back to model', exact: true })
    .click();
  await page.reload();
  await openPanoramas(page);
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await page.getByText('360° panorama · Settings', { exact: true }).click();
  await page.getByLabel('Panorama coverage').selectOption('180');
  await expect(
    page.getByText('Partial panorama · 180° · Settings', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Remove panorama', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Keep panorama', exact: true })
    .click();
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await page
    .getByRole('button', { name: 'Back to model', exact: true })
    .click();
  await page.getByRole('button', { name: 'Design tools', exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export project', exact: true }).click(),
  ]);
  const stream = await download.createReadStream();
  let bytes = Buffer.alloc(0);
  for await (const chunk of stream!) bytes = Buffer.concat([bytes, chunk]);
  const backup = JSON.parse(bytes.toString());
  expect(backup.panoramas.items[0].name).toBe('Lobby');
  expect(backup.panoramas.items[0].horizontalAngle).toBe(180);
  expect(backup.project).toEqual(before.project);
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByLabel('New project name').fill('Separate panorama study');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await openPanoramas(page);
  await expect(page.getByLabel('Current panorama')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Back to model', exact: true })
    .click();
  await page.getByLabel('Import project file').setInputFiles({
    name: 'photo-backup.json',
    mimeType: 'application/json',
    buffer: bytes,
  });
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await openPanoramas(page);
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  await expect(page.getByLabel('Current panorama')).toContainText('Lobby');
  await page.screenshot({ path: 'test-results/atelier-panorama-partial.png' });
  await page
    .getByText('Partial panorama · 180° · Settings', { exact: true })
    .click();
  await page.getByLabel('Panorama coverage').selectOption('60');
  await page.setViewportSize({ width: 844, height: 390 });
  // The visible horizontal field must stay inside a narrow partial photograph.
  await expect
    .poll(async () => {
      const fov =
        (Number(await viewer.getAttribute('data-fov')) * Math.PI) / 180;
      return (2 * Math.atan((Math.tan(fov / 2) * 844) / 390) * 180) / Math.PI;
    })
    .toBeLessThanOrEqual(60.01);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole('button', { name: 'Remove panorama', exact: true })
    .click();
  await page.getByRole('button', { name: 'Remove photo', exact: true }).click();
  await expect(page.getByLabel('Current panorama')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Back to model', exact: true })
    .click();
  await page.reload();
  await openPanoramas(page);
  await expect(page.getByLabel('Current panorama')).toHaveCount(0);
});

test('explicit motion permission fixtures exercise denial, sensor-driven view changes and stopping sensors', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    (window as any).__permission = 'denied';
    (window as any).__requests = 0;
    Object.defineProperty(DeviceOrientationEvent, 'requestPermission', {
      configurable: true,
      value: async () => {
        (window as any).__requests++;
        return (window as any).__permission;
      },
    });
  });
  await ready(page);
  await openPanoramas(page);
  await page.getByLabel('Panorama image file').setInputFiles(await photo(page));
  const viewer = page.getByTestId('panorama-viewport');
  await expect(viewer).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(() => (window as any).__requests)).toBe(0);
  await page.getByRole('button', { name: 'Look around with phone' }).click();
  await expect(page.getByRole('alert')).toContainText('declined');
  await expect(viewer).toHaveAttribute('data-motion', 'off');
  await page.evaluate(() => {
    (window as any).__permission = 'granted';
  });
  await page.getByRole('button', { name: 'Look around with phone' }).click();
  await page.evaluate(() =>
    window.dispatchEvent(
      new DeviceOrientationEvent('deviceorientation', {
        alpha: 0,
        beta: 90,
        gamma: 0,
      }),
    ),
  );
  await expect(viewer).toHaveAttribute('data-motion', 'active');
  await page.evaluate(() =>
    window.dispatchEvent(
      new DeviceOrientationEvent('deviceorientation', {
        alpha: 35,
        beta: 90,
        gamma: 0,
      }),
    ),
  );
  await expect
    .poll(async () => Number(await viewer.getAttribute('data-yaw')))
    .toBeGreaterThan(30);
  await page.getByRole('button', { name: 'Look around with phone' }).click();
  const yaw = await viewer.getAttribute('data-yaw');
  await page.evaluate(() =>
    window.dispatchEvent(
      new DeviceOrientationEvent('deviceorientation', {
        alpha: 85,
        beta: 90,
        gamma: 0,
      }),
    ),
  );
  await expect(viewer).toHaveAttribute('data-yaw', yaw!);
  await page
    .getByRole('button', { name: 'Back to model', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Panorama viewer' }),
  ).toHaveCount(0);
});

test('two fingers twist and pan together, transition to one finger, and never select after a drag', async ({
  page,
}) => {
  test.setTimeout(60000);
  await ready(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  });
  const view = page.getByTestId('viewport');
  await page.waitForTimeout(500);
  const before = await saved(page);
  const pos = await view.getAttribute('data-camera-position');
  const target = await view.getAttribute('data-camera-target');
  await touch(cdp, 'touchStart', [
    { x: 130, y: 380, id: 1 },
    { x: 240, y: 380, id: 2 },
  ]);
  for (let i = 1; i <= 6; i++)
    await touch(cdp, 'touchMove', [
      { x: 130 + i * 5, y: 380 - i * 5, id: 1 },
      { x: 240 + i * 3, y: 380 + i * 5, id: 2 },
    ]);
  await touch(cdp, 'touchEnd', [{ x: 160, y: 350, id: 1 }]);
  await touch(cdp, 'touchMove', [{ x: 185, y: 365, id: 1 }]);
  await touch(cdp, 'touchEnd', []);
  await expect(view).not.toHaveAttribute('data-camera-position', pos!);
  await expect(view).not.toHaveAttribute('data-camera-target', target!);
  expect(await saved(page)).toEqual(before);
  const after = await view.getAttribute('data-camera-position');
  await touch(cdp, 'touchStart', [{ x: 180, y: 380, id: 3 }]);
  await touch(cdp, 'touchMove', [{ x: 220, y: 400, id: 3 }]);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  });
  await touch(cdp, 'touchStart', [{ x: 160, y: 380, id: 4 }]);
  await touch(cdp, 'touchMove', [{ x: 190, y: 410, id: 4 }]);
  await touch(cdp, 'touchEnd', []);
  await expect(view).not.toHaveAttribute('data-camera-position', after!);
  expect(await saved(page)).toEqual(before);
});
