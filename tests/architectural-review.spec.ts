import { expect, test } from '@playwright/test';
import type { Operation } from '../src/intelligence/plan';

test('cylinder intersection and architectural conversion use conversational review with cancellation and undo (model fixtures)', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let turn = 0;
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  await page.route('**/api/plan', (r) => {
    const body = r.request().postDataJSON();
    const index = turn++;
    if ([1, 3, 5, 6].includes(index)) {
      expect(Boolean(body.pendingReview)).toBe(index !== 6);
      return r.fulfill({
        json: {
          intent: index === 1 ? 'cancel' : 'confirm',
          message: 'Review response',
          operations: [],
        },
      });
    }
    const operations: Operation[] =
      index === 4
        ? [
            {
              type: 'building',
              target: 'upper',
              floors: 2,
              slabThickness: 0.25,
              facade: true,
              panelWidth: 1.5,
              mullionWidth: 0.06,
            },
          ]
        : [
            {
              type: 'create_at',
              name: 'Central cylinder',
              shape: 'cylinder',
              width: 8,
              depth: 8,
              height: 12,
              x: 0,
              y: 0,
              z: 0,
              rotation: 0,
            },
            {
              type: 'center_on',
              target: '$name:Central cylinder',
              reference: 'upper',
              vertical: 'center',
              gap: 0,
            },
            {
              type: 'boolean',
              operation: 'intersect',
              targets: ['upper', '$name:Central cylinder'],
            },
          ];
    return r.fulfill({
      json: {
        intent: 'apply',
        message:
          index === 4
            ? 'Create two floor slabs plus a roof within the intersection.'
            : 'Keep only the shared solid of the pavilion and central cylinder.',
        operations,
      },
    });
  });
  await page.goto('/');
  await page.getByLabel('Import project file').setInputFiles({
    name: 'raised-pavilion.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: 2,
        selectedId: 'upper',
        selectedIds: ['upper'],
        volumes: [
          {
            id: 'upper',
            name: 'Raised pavilion',
            dimensions: { width: 100, depth: 20, height: 8 },
            position: { x: 0, y: 4, z: 0 },
            rotation: 45,
          },
          {
            id: 'lower',
            name: 'Offset base',
            dimensions: { width: 106, depth: 26, height: 4 },
            position: { x: 0, y: 0, z: 0 },
            rotation: 0,
          },
        ],
      }),
    ),
  });
  const state = () =>
    page.evaluate(
      () => JSON.parse(localStorage.getItem('atelier.session.v2')!).project,
    );
  const say = async (text: string) => {
    await page.getByRole('textbox', { name: 'Message Atelier' }).fill(text);
    await page
      .getByRole('button', { name: 'Send message', exact: true })
      .click();
  };
  const review = page.getByRole('region', { name: 'Review geometry change' });
  await say(
    'Intersect this with a centered cylinder, 12 meters high and radius 4. Keep only the shared solid.',
  );
  await expect(review).toBeVisible({ timeout: 20000 });
  await expect(review).toContainText('Central cylinder');
  const before = await state();
  await say('Actually, cancel that.');
  await expect(review).toBeHidden();
  expect(await state()).toEqual(before);
  await say('Go back to that cylinder intersection.');
  await expect(review).toBeVisible({ timeout: 20000 });
  await say('Yes, keep only the intersection.');
  await expect(page.getByRole('log')).toContainText('intersect');
  await expect
    .poll(async () => (await state()).volumes[0].geometry?.kind)
    .toBe('boolean');
  const intersection = (await state()).volumes[0];
  expect(intersection.id).toBe('upper');
  expect(intersection.position.y).toBe(4);
  expect(intersection.dimensions).toEqual({ width: 8, depth: 8, height: 8 });
  await say('Make this two floors with curtain walls, keeping its height.');
  await expect(review).toBeVisible({ timeout: 20000 });
  await say('Yes, apply that.');
  await expect(page.getByRole('log')).toContainText('real glass panels');
  await expect
    .poll(async () => (await state()).volumes[0].geometry?.kind)
    .toBe('building');
  const building = (await state()).volumes[0];
  expect(building.geometry.source.geometry.kind).toBe('boolean');
  expect(building.position.y).toBe(4);
  expect(building.dimensions.height).toBe(8);
  await expect(page.locator('.webgl-error')).toHaveCount(0);
  await say('Yes, do it again.');
  await expect(page.getByRole('alert')).toContainText(
    'no unchanged pending operation',
  );
  expect((await state()).volumes[0]).toEqual(building);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => (await state()).volumes[0].geometry.kind)
    .toBe('boolean');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await state()).volumes[0].rotation).toBe(45);
  expect((await state()).volumes[0].dimensions).toEqual({
    width: 100,
    depth: 20,
    height: 8,
  });
  expect(errors).toEqual([]);
});
