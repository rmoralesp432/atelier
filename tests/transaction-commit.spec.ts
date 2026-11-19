import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  newSession,
  serializeSession,
  parseSession,
} from '../src/intelligence/engine';
import {
  buildingWithNeighbors,
  expectedStoreyEdit,
  storeyEdit,
} from './fixtures/storey-building';
import { criteria, measure, selector } from './fixtures/completion';

test.use({ actionTimeout: 15000 });

const coordinates = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_key, v) =>
      typeof v === 'number' ? Math.round(v * 1e9) / 1e9 : v,
    ),
  );
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));

for (const conflict of [false, true])
  test(`multistage 244-component edit with concurrent ${conflict ? 'model edit retains both results' : 'selection commits atomically'}`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const original = newSession(buildingWithNeighbors(1.2, 23));
    const expected = expectedStoreyEdit(original.project, 1.3);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let waiting = false,
      calls = 0;
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
    await page.route('**/api/completion-criteria', (r) =>
      r.fulfill({
        json: criteria(
          [
            measure(
              'count',
              'count',
              244,
              selector(
                original.project.volumes
                  .filter((v) => v.groupId === 'building')
                  .map((v) => v.id),
              ),
            ),
            measure('roof', 'y', 13, selector(['roof'])),
          ],
          original.project.volumes
            .filter((v) => v.groupId === 'building')
            .map((v) => v.id),
          r.request().postDataJSON().message,
        ),
      }),
    );
    await page.route('**/api/plan', async (r) => {
      calls++;
      if (calls === 1)
        return r.fulfill({
          json: {
            intent: 'apply',
            message: 'Coordinate the components',
            planning: { stage: 'Edit', assumptions: [], next: 'Inspect' },
            operations: [storeyEdit(original.project, 1.3)],
          },
        });
      expect(r.request().postDataJSON().scene.objects).toHaveLength(245);
      waiting = true;
      await gate;
      return r.fulfill({
        json: { intent: 'finish', message: 'Finished', operations: [] },
      });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Open project copy', exact: true }),
    ).toBeEnabled();
    await page.getByLabel('Open project copy file').setInputFiles({
      name: 'Concurrent study.atelier.json',
      mimeType: 'application/json',
      buffer: Buffer.from(serializeSession(original)),
    });
    await expect(page.getByRole('dialog')).toBeHidden();
    await page
      .getByRole('textbox', { name: 'Message Atelier' })
      .fill(
        'Increase the lowest storey by 1.3 m and preserve the other storeys and neighboring object.',
      );
    await page
      .getByRole('button', { name: 'Send message', exact: true })
      .click();
    await expect.poll(() => waiting, { timeout: 60000 }).toBe(true);
    expect((await saved(page)).project.volumes).toEqual(
      original.project.volumes,
    );
    await page
      .getByRole('button', { name: 'Show objects', exact: true })
      .click();
    await page
      .getByRole('searchbox', { name: 'Find objects' })
      .fill('Neighbor');
    await page.locator('.object-row').filter({ hasText: 'Neighbor' }).click();
    await expect
      .poll(async () => (await saved(page)).project.selectedId)
      .toBe('neighbor');
    if (conflict) {
      await page
        .getByRole('button', { name: 'Hide object Neighbor', exact: true })
        .click();
      await expect.poll(async () => (await saved(page)).past.length).toBe(1);
    } else {
      // Exercise layout/autosave while the model is provisional, not a fixed sleep.
      await page.setViewportSize({ width: 1180, height: 760 });
      await page.getByRole('button', { name: 'Minimize conversation' }).click();
    }
    release();
    await expect(
      page.getByRole('button', { name: 'Stop and discard working preview' }),
    ).toBeHidden({ timeout: 60000 });
    if (conflict) {
      const active = await saved(page);
      expect(active.project.volumes.slice(0, 244)).toEqual(
        original.project.volumes.slice(0, 244),
      );
      expect(active.project.volumes.at(-1).visible).toBe(false);
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Save completed result' }).click();
      const copy = parseSession(
        await readFile((await (await download).path())!, 'utf8'),
      );
      expect(coordinates(copy.project.volumes)).toEqual(
        coordinates(expected.volumes),
      );
      expect(copy.past).toHaveLength(1);
    } else {
      await expect.poll(async () => (await saved(page)).past.length).toBe(1);
      const active = await saved(page);
      expect(coordinates(active.project.volumes)).toEqual(
        coordinates(expected.volumes),
      );
      expect(active.project.volumes.at(-1)).toEqual(
        original.project.volumes.at(-1),
      );
      expect(active.project.selectedId).toBe('neighbor');
      expect(active.context.focusIds).toEqual(['neighbor']);
      expect(active.past[0].volumes).toEqual(original.project.volumes);
      await page.reload();
      await expect(page.getByTestId('viewport')).toHaveAttribute(
        'data-model-objects',
        '245',
      );
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await expect
        .poll(async () => (await saved(page)).project.volumes)
        .toEqual(original.project.volumes);
      await page.getByRole('button', { name: 'Redo', exact: true }).click();
      await expect
        .poll(async () => coordinates((await saved(page)).project.volumes))
        .toEqual(coordinates(expected.volumes));
    }
    expect(calls).toBe(2);
  });
