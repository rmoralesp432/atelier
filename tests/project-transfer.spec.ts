import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('desktop project file opens as an independent editable copy in a separate phone browser', async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await page.route('**/api/plan', (r) =>
    r.fulfill({
      json: {
        intent: 'apply',
        message: 'Move it east.',
        operations: [
          {
            type: 'move',
            targets: ['$selected'],
            direction: 'east',
            distance: 2,
          },
        ],
      },
    }),
  );
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await page
    .getByRole('textbox', { name: 'Message Atelier' })
    .fill('Move it east two meters');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Moved');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByLabel('Current project name').fill('Desktop courtyard');
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download project copy', exact: true })
    .click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('Desktop courtyard.atelier.json');
  const path = (await download.path())!;
  const exported = JSON.parse(await readFile(path, 'utf8'));
  expect(
    exported.messages.some(
      (m: { content: string }) => m.content === 'Move it east two meters',
    ),
  ).toBe(true);
  expect(exported.past.length).toBeGreaterThan(0);
  const baseURL = new URL(page.url()).origin;
  await page.close();
  const phone = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  try {
    const tab = await phone.newPage();
    await tab.goto('/');
    await expect(tab.getByTestId('viewport')).toHaveAttribute(
      'data-model-objects',
      '2',
      { timeout: 30000 },
    );
    await tab.getByRole('button', { name: 'Projects', exact: true }).click();
    await tab.getByLabel('Current project name').fill('Phone original');
    await tab.getByRole('button', { name: 'Rename', exact: true }).click();
    const chooser = tab.waitForEvent('filechooser');
    await tab
      .getByRole('button', { name: 'Open project copy', exact: true })
      .click();
    await (await chooser).setFiles(path);
    await expect(tab.getByRole('dialog')).toBeHidden();
    await expect(
      tab.getByRole('button', { name: 'Projects', exact: true }),
    ).toContainText('Desktop courtyard');
    await expect
      .poll(() =>
        tab.evaluate(
          () => JSON.parse(localStorage.getItem('atelier.session.v2')!).project,
        ),
      )
      .toEqual(exported.project);
    expect(
      await tab.evaluate(() =>
        JSON.parse(localStorage.getItem('atelier.conversation.v2')!),
      ),
    ).toEqual(exported.messages);
    await tab.reload();
    await expect(
      tab.getByRole('button', { name: 'Projects', exact: true }),
    ).toContainText('Desktop courtyard');
    await tab.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect
      .poll(() =>
        tab.evaluate(
          () =>
            JSON.parse(localStorage.getItem('atelier.session.v2')!).project
              .volumes[0].position.x,
        ),
      )
      .toBe(exported.project.volumes[0].position.x - 2);
    await tab.getByRole('button', { name: 'Projects', exact: true }).click();
    await expect(tab.locator('.project-entry')).toHaveCount(2);
    await expect(
      tab.locator('.project-entry').filter({ hasText: 'Phone original' }),
    ).toBeVisible();
    await tab.getByLabel('Open project copy file').setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"version":99}'),
    });
    await expect(tab.getByRole('alert')).toBeVisible();
    await expect(tab.locator('.project-entry')).toHaveCount(2);
    await tab.screenshot({ path: 'test-results/project-transfer-phone.png' });
  } finally {
    await phone.close();
  }
});
