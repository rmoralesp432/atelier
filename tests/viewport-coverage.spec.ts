import { expect, test, type Page } from '@playwright/test';

test.use({ actionTimeout: 15000 });

async function checkCoverage(page: Page, dpr: number) {
  const viewport = page.getByTestId('viewport');
  await expect
    .poll(() =>
      viewport.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
        const host = canvas.parentElement!.getBoundingClientRect(),
          rect = canvas.getBoundingClientRect();
        const gl = canvas.getContext('webgl2')!;
        return {
          fills:
            Math.abs(rect.width - host.width) < 1 &&
            Math.abs(rect.height - host.height) < 1,
          ratioX: canvas.width / rect.width,
          ratioY: canvas.height / rect.height,
          buffer:
            gl.drawingBufferWidth === canvas.width &&
            gl.drawingBufferHeight === canvas.height,
          scissor: gl.isEnabled(gl.SCISSOR_TEST),
          projectionMatches:
            Math.abs(
              Number(canvas.parentElement!.dataset.projectionAspect) -
                rect.width / rect.height,
            ) < 0.005,
        };
      }),
    )
    .toMatchObject({
      fills: true,
      ratioX: expect.closeTo(Math.min(dpr, 2), 2),
      ratioY: expect.closeTo(Math.min(dpr, 2), 2),
      buffer: true,
      scissor: false,
      projectionMatches: true,
    });
  // Capture the composited output, not a cleared/preserveDrawingBuffer=false WebGL buffer.
  // Geometry/buffer readiness is asserted above. Locator screenshots additionally
  // wait for animation-frame actionability (unnecessary for a read-only capture),
  // which can stall under CI's high-DPR software renderer.
  const clip = await viewport.boundingBox();
  expect(clip).not.toBeNull();
  const screenshot = await page.screenshot({ clip: clip! });
  const blackFraction = await page.evaluate(
    async (data) => {
      const image = new Image();
      image.src = data;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(
        0,
        Math.floor(image.height * 0.65),
        image.width,
        Math.floor(image.height * 0.3),
      ).data;
      let black = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] < 3 && pixels[i + 1] < 3 && pixels[i + 2] < 3) black++;
      return black / (pixels.length / 4);
    },
    `data:image/png;base64,${screenshot.toString('base64')}`,
  );
  expect(blackFraction).toBeLessThan(0.05);
}

test('canvas covers the workspace through desktop zoom-equivalent layouts, DPR-only changes, panels and visual-viewport zoom', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  const cdp = await page.context().newCDPSession(page);
  // Moving between displays changes DPR without changing layout dimensions.
  for (const ratio of [1, 1.5, 2, 1]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: ratio,
      mobile: false,
    });
    await checkCoverage(page, ratio);
  }
  // Browser zoom changes CSS viewport dimensions and pixel ratio together.
  // This emulates its rendering consequences, not the browser's zoom menu.
  for (const zoom of [0.8, 1.25, 2, 1]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: Math.round(1440 / zoom),
      height: Math.round(1000 / zoom),
      deviceScaleFactor: zoom,
      mobile: false,
    });
    await checkCoverage(page, zoom);
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await page.getByRole('button', { name: 'Show objects', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await checkCoverage(page, 1);
  for (const size of [
    { width: 1920, height: 720 },
    { width: 1024, height: 1080 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(size);
    await checkCoverage(page, 1);
  }
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.3 });
  await checkCoverage(page, 1);
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
  await page.screenshot({ path: 'test-results/desktop-viewport-coverage.png' });
});

test('phone panel projection remains sized to the canvas across portrait, landscape and keyboard layouts', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  for (const size of [
    { width: 390, height: 430 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await checkCoverage(page, 1);
  }
  await page.screenshot({ path: 'test-results/phone-panel-coverage.png' });
});
