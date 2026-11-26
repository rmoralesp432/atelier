/** Public deployment smoke test. Fresh browser storage; no API generation calls. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium, expect as playwrightExpect } from '@playwright/test';
// Standalone scripts do not inherit playwright.config.ts. Cold WASM and
// production asset loading need a bounded readiness wait, with exact assertions.
const expect = playwrightExpect.configure({ timeout: 30000 });

const origin =
  process.env.ATELIER_SMOKE_ORIGIN || 'https://atelier-emxi.onrender.com';
assert(
  origin === 'https://atelier-emxi.onrender.com' ||
    /^http:\/\/127\.0\.0\.1:\d+$/.test(origin),
);
const expected = [
  ...readFileSync('dist/index.html', 'utf8').matchAll(
    /(?:src|href)="([^"]+\/assets\/[^"]+)"/g,
  ),
].map((m) => m[1]);
assert(expected.length > 0);
mkdirSync('test-results/render-smoke', { recursive: true });
const deadline =
  Date.now() + (process.env.ATELIER_SMOKE_ORIGIN ? 20000 : 15 * 60000);
let deployed = false;
while (Date.now() < deadline) {
  try {
    const r = await fetch(origin, { signal: AbortSignal.timeout(20000) });
    const html = await r.text();
    if (r.ok && expected.every((asset) => html.includes(asset))) {
      deployed = true;
      break;
    }
  } catch {
    /* Render may be restarting. Keep a bounded readiness wait. */
  }
  await new Promise((r) => setTimeout(r, 10000));
}
assert(
  deployed,
  'Production did not serve the expected application bundle before the deadline.',
);
const health = await fetch(`${origin}/healthz`);
assert.equal(health.status, 200);
const config = await (await fetch(`${origin}/api/config`)).json();
if (!process.env.ATELIER_SMOKE_ORIGIN) {
  assert.equal(config.configured, true);
  assert.equal(config.agentConfigured, true);
}
const browser = await chromium.launch({
  executablePath: existsSync('/usr/bin/chromium')
    ? '/usr/bin/chromium'
    : undefined,
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 },
    reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', (r) =>
    r.request().method() === 'GET' ? r.continue() : r.abort(),
  );
  await page.addInitScript(() =>
    localStorage.setItem('atelier.start-direct', 'true'),
  );
  await page.goto(origin);
  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-model-objects', '2');
  const saved = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')));
  await expect
    .poll(async () => (await saved())?.project.volumes.length)
    .toBe(2);
  const before = (await saved()).project.volumes;
  await page
    .getByRole('button', { name: 'Create a 3D shape', exact: true })
    .click();
  const panel = page.getByRole('region', {
    name: 'Create and transform',
    exact: true,
  });
  await panel.getByRole('button', { name: 'Cylinder', exact: true }).click();
  await panel.getByLabel('Solid width').fill('4');
  await panel.getByLabel('Solid height').fill('12');
  await panel
    .getByRole('button', { name: 'Create 3D shape', exact: true })
    .click();
  await expect(viewport).toHaveAttribute('data-model-objects', '3');
  await expect.poll(async () => (await saved()).project.volumes.length).toBe(3);
  const after = (await saved()).project.volumes;
  assert.deepEqual(after.at(-1).dimensions, { width: 4, depth: 4, height: 12 });
  assert.deepEqual(after.slice(0, 2), before);
  await page.reload();
  await expect(viewport).toHaveAttribute('data-model-objects', '3');
  assert.deepEqual((await saved()).project.volumes, after);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => (await saved()).project.volumes)
    .toEqual(before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(async () => (await saved()).project.volumes).toEqual(after);
  await page.screenshot({ path: 'test-results/render-smoke/production.png' });
  assert.deepEqual(errors, []);
  const result = {
    status: 'PASS',
    origin,
    sourceCommit: process.env.GITHUB_SHA,
    expectedAssets: expected,
    health: true,
    config,
    manualGeometry: true,
    reload: true,
    undo: true,
    redo: true,
    paidCalls: 0,
    liveAIGenerationTestedHere: false,
  };
  writeFileSync(
    'test-results/render-smoke/result.json',
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  if (process.env.GITHUB_ACTIONS)
    console.log(
      '::notice title=Render production smoke::PASS: expected bundle, healthy configured agent, real editable geometry, persistence, reload and Undo/Redo. No paid calls.',
    );
} finally {
  await browser.close();
}
