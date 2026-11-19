// Local, offline before/after browser probe. Start baseline/current on 4281/4282.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const results = [];
try {
  for (const [version, port] of [
    ['baseline-a2fd752', 4281],
    ['candidate', 4282],
  ]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    });
    await context.addInitScript(() => {
      if (!sessionStorage.getItem('comparison-entered')) {
        localStorage.setItem('atelier.start-direct', 'true');
        sessionStorage.setItem('comparison-entered', 'true');
      }
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
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}`);
    const view = page.getByTestId('viewport');
    await view.waitFor();
    async function settled() {
      let last,
        same = 0;
      for (let n = 0; n < 80; n++) {
        const value = await view.getAttribute('data-camera-position');
        const frames = Number(await view.getAttribute('data-render-frames'));
        same = value && value === last && frames > 5 ? same + 1 : 0;
        last = value;
        if (same > 3) return value;
        await page.waitForTimeout(200);
      }
      throw Error(`${version}: camera did not settle`);
    }
    const before = await settled();
    await page.setViewportSize({ width: 844, height: 390 });
    const after = await settled();
    await page.evaluate(() => localStorage.removeItem('atelier.start-direct'));
    await page.reload();
    await page.waitForTimeout(1500);
    results.push({
      version,
      beforeResize: before,
      afterResize: after,
      cameraPreserved: before === after,
      reloadShowsWelcome: await page
        .getByRole('main', { name: 'ATELIER start screen' })
        .isVisible(),
      reloadShowsWorkspace: await view.isVisible(),
    });
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  new URL('./browser-comparison.json', import.meta.url),
  JSON.stringify(results, null, 2) + '\n',
);
console.log(JSON.stringify(results, null, 2));
