// Actual browser pose recovery, with provider endpoints disabled.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  await context.route('**/api/**', (r) =>
    r.request().url().endsWith('/api/config')
      ? r.fulfill({
          json: {
            configured: false,
            authenticated: true,
            voiceConfigured: false,
          },
        })
      : r.abort(),
  );
  await context.addInitScript(() =>
    localStorage.setItem('atelier.start-direct', 'true'),
  );
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4282');
  const view = page.getByTestId('viewport');
  async function settled() {
    let last,
      equal = 0;
    for (let i = 0; i < 100; i++) {
      const pose = await view.evaluate((v) => ({
        position: v.dataset.cameraPosition,
        target: v.dataset.cameraTarget,
        projection: v.dataset.projection,
      }));
      const serialized = JSON.stringify(pose);
      equal = serialized === last && pose.position ? equal + 1 : 0;
      last = serialized;
      if (equal >= 4) return pose;
      await page.waitForTimeout(200);
    }
    throw Error('Pose did not settle');
  }
  await view.waitFor();
  const initial = await settled();
  await page.mouse.move(300, 380);
  await page.mouse.wheel(0, 400);
  const before = await settled();
  if (JSON.stringify(initial) === JSON.stringify(before))
    throw Error('Probe did not change the camera');
  await page.reload();
  await view.waitFor();
  const after = await settled();
  const preserved = JSON.stringify(before) === JSON.stringify(after);
  await writeFile(
    new URL('./camera-recovery.json', import.meta.url),
    JSON.stringify(
      { initial, before, after, preserved, apiCalls: 0 },
      null,
      2,
    ) + '\n',
  );
  if (!preserved) throw Error('Custom camera changed across reload');
  console.log(JSON.stringify({ initial, before, after, preserved }));
} finally {
  await browser.close();
}
