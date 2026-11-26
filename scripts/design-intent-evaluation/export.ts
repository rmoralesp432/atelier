/** Offline export and viewport review of the actual saved rehearsal, never fresh AI. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import express from 'express';
import { chromium, expect } from '@playwright/test';
import { projectFile, readProjectCopy } from '../../src/projects/transfer';
import { parseSession, serializeSession } from '../../src/intelligence/engine';
import { equalData } from '../../src/projects/equalData';

const root = 'docs/evaluations/design-intent';
const replay = JSON.parse(
  readFileSync(join(root, 'offline-1/result.json'), 'utf8'),
);
const out = join(root, 'models');
mkdirSync(out, { recursive: true });
const app = express();
app.use(express.static(resolve('dist')));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((r) => server.on('listening', r));
const origin = `http://127.0.0.1:${(server.address() as any).port}`;
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const records: any[] = [];
try {
  for (const turn of [1, 5, 6, 7, 8]) {
    const saved = replay.turns[turn - 1];
    assert.equal(saved.status, 'PASS');
    const file = projectFile(
      { session: serializeSession(saved.after), messages: saved.messagesAfter },
      `Design-intent-turn-${turn}`,
    );
    const text = await file.text();
    const copy = readProjectCopy(text);
    const restored = parseSession(copy.session);
    for (const key of ['project', 'past', 'future', 'context'] as const)
      assert(equalData(restored[key], saved.after[key]), key);
    assert(equalData(copy.messages, saved.messagesAfter));
    writeFileSync(join(out, file.name), text);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
      storageState: {
        cookies: [],
        origins: [
          {
            origin,
            localStorage: [
              { name: 'atelier.start-direct', value: 'true' },
              { name: 'atelier.session.v2', value: copy.session },
              {
                name: 'atelier.conversation.v2',
                value: JSON.stringify(copy.messages),
              },
            ],
          },
        ],
      },
    });
    await context.route('**/*', (r) =>
      new URL(r.request().url()).origin === origin &&
      !new URL(r.request().url()).pathname.startsWith('/api/')
        ? r.continue()
        : r.abort(),
    );
    const page = await context.newPage();
    await page.route('**/api/config', (r) =>
      r.fulfill({
        json: {
          configured: false,
          authenticated: false,
          voiceConfigured: false,
        },
      }),
    );
    await page.goto(origin);
    await expect(page.getByTestId('viewport')).toBeVisible({ timeout: 45000 });
    const minimize = page.getByRole('button', {
      name: 'Minimize conversation',
      exact: true,
    });
    if (await minimize.isVisible()) await minimize.click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Frame all', exact: true }).click();
    await page.waitForTimeout(1400);
    await page.screenshot({ path: join(out, `turn-${turn}-framed.png`) });
    const current = parseSession(
      await page.evaluate(() => localStorage.getItem('atelier.session.v2')!),
    );
    for (const key of ['volumes', 'groups', 'design'] as const)
      assert(equalData(current.project[key], saved.after.project[key]), key);
    assert(equalData(current.past, saved.after.past));
    records.push({
      turn,
      export: file.name,
      objects: current.project.volumes.length,
      undoEntries: current.past.length,
      exactProjectHistoryAndConversationRoundTrip: true,
      framedViewportPreservedGeometryAndHistory: true,
    });
    await context.close();
  }
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
}
writeFileSync(
  join(out, 'export-validation.json'),
  JSON.stringify(
    {
      label: 'Offline views of committed scripted results; camera framing only',
      paidCalls: 0,
      records,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(records, null, 2));
