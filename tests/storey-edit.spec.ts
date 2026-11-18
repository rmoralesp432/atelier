import { expect, test, type Page } from '@playwright/test';
import {
  buildingWithNeighbors,
  expectedStoreyEdit,
  storeyEdit,
} from './fixtures/storey-building';
import { newSession, serializeSession } from '../src/intelligence/engine';
import type { Project } from '../src/model';

const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));

test('244-part storey edit updates connected geometry, persists identities, rolls back failure and restores the entire building with Undo (offline provider)', async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: {
        configured: true,
        authenticated: true,
        voiceConfigured: false,
        agentConfigured: true,
      },
    }),
  );
  const original = newSession(buildingWithNeighbors());
  let calls = 0;
  let failedCalls = 0;
  let fail = false;
  await page.route('**/api/plan', async (r) => {
    const b = r.request().postDataJSON();
    expect(b.scene.objects).toHaveLength(245);
    expect(b.observation.status).toBe('ready');
    expect(b.observation.objectIds).toHaveLength(245);
    const next = {
      stage: 'Coordinate components',
      assumptions: [],
      next: 'Inspect the complete building',
    };
    if (fail) {
      failedCalls++;
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Check failure recovery',
          brief: null,
          planning: next,
          operations:
            failedCalls === 1
              ? [
                  {
                    type: 'move',
                    targets: ['$group:building'],
                    direction: 'up',
                    distance: 2,
                  },
                ]
              : [
                  {
                    type: 'edit_components',
                    edits: [
                      {
                        targets: ['column-0-0'],
                        where: [],
                        translation: null,
                        resize: {
                          axis: 'height',
                          mode: 'add',
                          value: -400,
                          anchor: 0,
                        },
                      },
                    ],
                  },
                ],
        },
      });
    }
    calls++;
    if (calls === 1)
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Adjust the ground-floor height and connected parts',
          brief: null,
          planning: next,
          operations: [
            storeyEdit(original.project),
            {
              type: 'verify',
              targets: ['$group:building'],
              metric: 'count',
              comparison: 'equal',
              value: 244,
              tolerance: 0,
            },
            {
              type: 'verify',
              targets: ['floor-1'],
              metric: 'base',
              comparison: 'equal',
              value: 4.5,
              tolerance: 0.00001,
            },
            {
              type: 'verify',
              targets: ['roof'],
              metric: 'base',
              comparison: 'equal',
              value: 11.5,
              tolerance: 0.00001,
            },
          ],
        },
      });
    expect(b.execution.remainingOperations).toBe(60);
    expect(b.execution.receipts[0].changed).toHaveLength(227);
    expect(b.execution.receipts[0].created).toEqual([]);
    expect(b.execution.receipts[0].removed).toEqual([]);
    // The rendered preview and actual agent context have changed, saved state has not.
    expect(
      b.scene.objects.find((v: any) => v.id === 'floor-1').position.y,
    ).toBe(4.5);
    expect((await saved(page)).project).toEqual(original.project);
    return r.fulfill({
      json: {
        intent: 'finish',
        message:
          'Ground floor is now 4.5 m. The rest of the building is preserved.',
        operations: [],
        brief: null,
        planning: null,
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByLabel('Open project copy file').setInputFiles({
    name: 'Storey regression.atelier.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeSession(original)),
  });
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '245',
  );
  const input = page.getByRole('textbox', { name: 'Message Atelier' });
  await input.fill(
    'Increase the ground-floor height from 3.5 m to 4.5 m, updating its connected components and preserving the rest of the building.',
  );
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).past.length, { timeout: 60000 })
    .toBe(1);
  expect(calls).toBe(2);
  const edited = await saved(page);
  const expected = expectedStoreyEdit(original.project);
  expect(edited.project.volumes.map((v: any) => v.id)).toEqual(
    original.project.volumes.map((v) => v.id),
  );
  for (const [i, v] of (edited.project as Project).volumes.entries()) {
    const wanted = expected.volumes[i];
    expect({ ...v, position: null, dimensions: null }).toEqual({
      ...wanted,
      position: null,
      dimensions: null,
    });
    for (const axis of ['x', 'y', 'z'] as const)
      expect(v.position[axis]).toBeCloseTo(wanted.position[axis], 9);
    for (const axis of ['width', 'height', 'depth'] as const)
      expect(v.dimensions[axis]).toBeCloseTo(wanted.dimensions[axis], 9);
  }
  expect(edited.project.volumes.at(-1)).toEqual(
    original.project.volumes.at(-1),
  );

  fail = true;
  await input.fill('Try an edit that cannot produce valid geometry.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Dimensions must be', {
    timeout: 60000,
  });
  expect(failedCalls).toBe(5); // one provisional step, failed step + three repairs
  expect((await saved(page)).project).toEqual(edited.project);
  expect((await saved(page)).past).toEqual(edited.past);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project)
    .toEqual(original.project);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project)
    .toEqual(edited.project);
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '245',
  );
  expect((await saved(page)).project).toEqual(edited.project);
});
