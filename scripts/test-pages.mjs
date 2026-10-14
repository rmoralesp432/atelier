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
  page.on('requestfailed', (r) => errors.push(`Failed request: ${r.url()}`));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  const response = await page.goto(
    `http://127.0.0.1:${server.address().port}/atelier/`,
  );
  assert.equal(response.status(), 200);
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
    .getByRole('textbox', { name: 'Geometry command' })
    .fill('create box 7 x 5 x 3');
  await page.getByRole('button', { name: 'Run command', exact: true }).click();
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
  assert.deepEqual(errors, []);
  console.log(
    'PASS: production app loads at /atelier/ with valid asset paths, WebGL, geometry commands, and reload persistence.',
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
