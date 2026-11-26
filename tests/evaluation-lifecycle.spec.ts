import { expect, test } from '@playwright/test';
import { criteria, measure } from './fixtures/completion';
import {
  waitForModelingStart,
  modelingActive,
} from '../scripts/release-evaluation/browser-state';

test('evaluation waits through initial reasoning, absent previews and minimized chat, then checks a committed request', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: {
        configured: true,
        authenticated: true,
        agentConfigured: true,
        voiceConfigured: false,
      },
    }),
  );
  let firstRelease!: () => void,
    finishRelease!: () => void,
    calls = 0;
  const first = new Promise<void>((r) => (firstRelease = r)),
    finish = new Promise<void>((r) => (finishRelease = r));
  await page.route('**/api/plan', async (r) => {
    calls++;
    if (calls === 1) {
      await first;
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Create the test solid',
          planning: { stage: 'Model', assumptions: [], next: 'Inspect' },
          operations: [
            {
              type: 'create_at',
              name: 'Lifecycle solid',
              shape: 'box',
              width: 0.7,
              depth: 0.9,
              height: 1.2,
              x: 18,
              y: 0,
              z: 12,
              rotation: 0,
            },
          ],
        },
      });
    }
    await finish;
    return r.fulfill({
      json: { intent: 'finish', message: 'Complete', operations: [] },
    });
  });
  await page.route('**/api/completion-criteria', (r) =>
    r.fulfill({
      json: criteria(
        [measure('count', 'count', 1), measure('height', 'height', 1.2)],
        [],
        r.request().postDataJSON().message,
      ),
    }),
  );
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  const saved = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem('atelier.session.v2')!),
    );
  const original = await saved();
  await page
    .getByRole('textbox', { name: 'Message Atelier' })
    .fill(
      'Create one independent box 1.2 m high. Preserve the existing scene.',
    );
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await waitForModelingStart(page);
  await expect.poll(() => calls).toBe(1);
  await expect(
    page.getByRole('button', { name: 'Stop and discard working preview' }),
  ).toHaveCount(0);
  // Reproduce the prior harness's 20-second failure window without an API call.
  await page.waitForTimeout(21_000);
  expect(await modelingActive(page)).toBe(true);
  expect((await saved()).project).toEqual(original.project);
  firstRelease();
  await expect.poll(() => calls, { timeout: 30_000 }).toBe(2);
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
  );
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  await expect(
    page.locator('button[aria-label="Stop design request"]'),
  ).toBeHidden();
  expect(await modelingActive(page)).toBe(true);
  expect((await saved()).project).toEqual(original.project);
  finishRelease();
  await expect
    .poll(() => modelingActive(page), { timeout: 30_000 })
    .toBe(false);
  await expect.poll(async () => (await saved()).project.volumes.length).toBe(3);
  const committed = await saved();
  expect(committed.past.length).toBe(original.past.length + 1);
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
  );
  expect((await saved()).project.volumes).toEqual(committed.project.volumes);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => (await saved()).project.volumes)
    .toEqual(original.project.volumes);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect
    .poll(async () => (await saved()).project.volumes)
    .toEqual(committed.project.volumes);
  expect(calls).toBe(2);
});
