import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';

// Serve the actual dist artifact at the GitHub project-site prefix, without
// Vite's development middleware or SPA fallbacks masking broken asset URLs.
const root = resolve('dist');
assert(existsSync(resolve(root, 'index.html')), 'Run npm run build first.');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, 'http://localhost').pathname,
    );
    if (!pathname.startsWith('/atelier/')) {
      res.writeHead(404).end();
      return;
    }
    const path = resolve(
      root,
      pathname.slice('/atelier/'.length) || 'index.html',
    );
    if (!path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const body = await readFile(path);
    res.writeHead(200, {
      'Content-Type': types[extname(path)] || 'application/octet-stream',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({
    executablePath,
    args: [
      '--no-sandbox',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // A static Pages site has no API; only that expected unavailable endpoint is excluded.
  page.on('requestfailed', (r) => {
    if (!r.url().endsWith('/api/config'))
      errors.push(`Failed request: ${r.url()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().endsWith('/api/config'))
      errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  const response = await page.goto(
    `http://127.0.0.1:${server.address().port}/atelier/`,
  );
  assert.equal(response.status(), 200);
  await page.getByRole('button', { name: 'Expand inspector' }).click();
  await page.getByRole('button', { name: 'Show objects' }).click();
  await page.getByText('Manual tools', { exact: true }).click();
  await page.getByTestId('viewport').locator('canvas').waitFor();
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="viewport"]')
        ?.getAttribute('data-rendered') === 'true',
  );
  assert.equal(
    await page
      .getByRole('spinbutton', { name: 'Width', exact: true })
      .inputValue(),
    '14',
  );
  await page
    .getByRole('button', { name: 'Create volume', exact: true })
    .click();
  for (const [label, value] of [
    ['Width', '7'],
    ['Depth', '5'],
    ['Height', '3'],
  ]) {
    const field = page.getByRole('spinbutton', { name: label, exact: true });
    await field.fill(value);
    await field.press('Enter');
  }
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="volume-stat"]')?.textContent ===
      '105 m³',
  );
  assert.equal(
    await page
      .getByRole('spinbutton', { name: 'Width', exact: true })
      .inputValue(),
    '7',
  );
  await page.reload();
  await page.getByRole('spinbutton', { name: 'Width', exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole('spinbutton', { name: 'Width', exact: true })
      .inputValue(),
    '7',
  );
  assert.equal(
    await page
      .getByRole('button', { name: 'Connect AI', exact: true })
      .isVisible(),
    true,
  );
  assert.equal(
    await page
      .getByRole('button', { name: 'Start voice conversation' })
      .isDisabled(),
    true,
  );
  // Verify lazy map-picker JS/CSS also resolve under the project subpath.
  await page.route('https://tile.openstreetmap.org/**', (r) =>
    r.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.getByRole('button', { name: 'Toggle site map' }).click();
  await page
    .getByRole('region', { name: 'Choose a site on the map' })
    .waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll('.leaflet-tile-loaded').length > 0,
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS: production app loads at /atelier/ with valid JS/CSS/WASM paths, actual solid rendering, direct editing, and reload persistence. Static Pages has no AI backend.',
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
