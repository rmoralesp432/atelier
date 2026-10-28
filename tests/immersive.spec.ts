import { openTool } from './tools';
import { test, expect } from '@playwright/test';
import type { Operation } from '../src/intelligence/plan';

test('opens a full-size scene, adds shapes without AI, and reuses meshes on selection', async ({
  page,
}) => {
  // This covers a desktop workflow plus a viewport resize and mobile panels.
  // Software WebGL CI runners need more total time; assertions keep 5s limits.
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await expect(page.locator('.objects-panel')).toBeHidden();
  await expect(page.locator('.inspector-panel')).toBeHidden();
  const canvas = await page.locator('canvas').boundingBox();
  expect(canvas!.width).toBeGreaterThan(1400);
  expect(canvas!.height).toBeGreaterThan(900);
  const builds = await page
    .getByTestId('viewport')
    .getAttribute('data-mesh-builds');
  await page.getByRole('button', { name: 'Show objects' }).click();
  await page.locator('.object-row').nth(1).click();
  await expect(page.locator('.selection-summary')).toContainText(
    'Vertical annex',
  );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-mesh-builds',
    builds!,
  );
  await page.getByRole('button', { name: 'Hide objects' }).click();
  await expect(
    page.getByRole('button', { name: 'Add a shape', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Create floors and curtain wall' }),
  ).toBeHidden();
  await page.getByRole('button', { name: 'Show objects' }).click();
  await page.getByText('Manual tools', { exact: true }).click();
  await page.getByLabel('Primitive shape').selectOption('sphere');
  await page.getByRole('button', { name: 'Add shape', exact: true }).click();
  await page.getByRole('button', { name: 'Hide objects' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
  );
  await page.getByRole('button', { name: 'Edit selected dimensions' }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Height', exact: true }),
  ).toHaveValue('8');
  await openTool(page, 'Collapse inspector');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/atelier-immersive.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Show objects' }).click();
  await expect(page.locator('.objects-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Hide objects' }).click();
  await page.getByRole('button', { name: 'Design tools', exact: true }).click();
  await openTool(page, 'Expand inspector');
  await expect(page.locator('.inspector-panel')).toBeVisible();
  await page
    .getByRole('button', { name: 'Close inspector', exact: true })
    .click();
  await page.getByRole('button', { name: 'Design tools', exact: true }).click();
  for (const name of ['Import', 'Export project']) {
    const bounds = await page
      .getByRole('button', { name, exact: true })
      .boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  }
  await page.getByRole('button', { name: 'Design tools', exact: true }).click();
  const send = (await page
    .getByRole('button', { name: 'Send message' })
    .boundingBox())!;
  expect(send.x + send.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: 'test-results/atelier-mobile-layout.png' });
  expect(errors).toEqual([]);
});

test('architectural workflow renders real floors/glass, preserves elevation and restores history (explicit model fixtures)', async ({
  page,
}) => {
  test.setTimeout(60000);
  let turn = 0;
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  await page.route('**/api/plan', (r) => {
    const body = r.request().postDataJSON();
    const upper = body.scene.objects.find(
      (v: any) => v.name === 'Floating pavilion',
    )?.id;
    const steps: Operation[][] = [
      [
        {
          type: 'create_at',
          name: 'Floating pavilion',
          shape: 'box',
          width: 100,
          depth: 20,
          height: 8,
          x: 0,
          y: 4,
          z: 0,
          rotation: 0,
        },
        {
          type: 'offset_base',
          target: '$name:Floating pavilion',
          offset: 3,
          height: 4,
          name: 'Lower pavilion',
        },
      ],
      [{ type: 'rotate', targets: [upper], degrees: 45, relative: true }],
      [
        {
          type: 'building',
          target: upper,
          floors: 2,
          slabThickness: 0.25,
          facade: true,
          panelWidth: 1.5,
          mullionWidth: 0.06,
        },
      ],
    ];
    if (turn === 3) {
      expect(body.pendingReview?.message).toContain('floor slabs');
      return r.fulfill({
        json: {
          intent: 'confirm',
          message: 'Apply the reviewed change.',
          operations: [],
        },
      });
    }
    return r.fulfill({
      json: {
        intent: 'apply',
        message: 'Two floor slabs and a roof, retaining the original envelope.',
        operations: steps[turn++],
      },
    });
  });
  await page.goto('/');
  await page.getByLabel('Import project file').setInputFiles({
    name: 'empty.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ version: 2, volumes: [], selectedId: null }),
    ),
  });
  const say = async (text: string) => {
    await page.getByRole('textbox', { name: 'Message Atelier' }).fill(text);
    await page
      .getByRole('button', { name: 'Send message', exact: true })
      .click();
  };
  await say(
    'Create a 100 by 20 m volume, 8 m tall and raised 4 m, with a base offset outward 3 m on each side.',
  );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await expect(page.locator('.selection-summary')).toContainText('Raised 4 m');
  await say('Rotate it 45 degrees.');
  await expect(page.getByRole('log')).toContainText('45°');
  await say('Make it two floors with curtain walls.');
  await expect(
    page.getByRole('region', { name: 'Review geometry change' }),
  ).toBeVisible();
  await say('Yes, go ahead with those floors and glass.');
  await expect(page.getByRole('log')).toContainText('real glass panels');
  await expect(page.locator('.webgl-error')).toHaveCount(0);
  await page.getByRole('button', { name: 'Frame all', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/atelier-curtain-wall.png' });
  await page.reload();
  await openTool(page, 'Expand inspector');
  await expect(
    page.getByRole('spinbutton', { name: 'Floors', exact: true }),
  ).toHaveValue('2');
  await expect(
    page.getByRole('spinbutton', { name: 'Height', exact: true }),
  ).toHaveValue('8');
  await expect(
    page.getByRole('spinbutton', { name: 'Y', exact: true }),
  ).toHaveValue('4');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Floors', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('spinbutton', { name: 'Height', exact: true }),
  ).toHaveValue('8');
});
