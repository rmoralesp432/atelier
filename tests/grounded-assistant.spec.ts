import { expect, test } from '@playwright/test';
import type { Operation } from '../src/intelligence/plan';

// Explicit provider outputs exercise the real browser/Manifold engine. They
// do not establish that a live model interprets these sentences correctly.
test('custom footprint conversation, measured answers, checked review and correction preserve the project', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let turn = 0;
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  await page.route('**/api/plan', (r) => {
    const body = r.request().postDataJSON();
    if (body.validationFeedback) {
      expect(body.validationFeedback.error).toContain('opening must fit');
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Same invalid opening.',
          operations: body.validationFeedback.operations,
        },
      });
    }
    const index = turn++;
    if (index === 5) {
      expect(body.pendingReview.operations[0].type).toBe('building');
      expect(body.pendingReview.outcome).toContain('2 floor slabs plus a roof');
      expect(body.scene.objects.at(-1).shape).toBe('polygon'); // preview has not replaced original
      return r.fulfill({
        json: { intent: 'confirm', message: 'Apply it.', operations: [] },
      });
    }
    const operations: Operation[] =
      index === 0
        ? [
            {
              type: 'footprint',
              name: 'Library',
              points: [
                { x: 0, z: 0 },
                { x: 10, z: 0 },
                { x: 10, z: 3 },
                { x: 4, z: 3 },
                { x: 4, z: 8 },
                { x: 0, z: 8 },
              ],
              height: 5,
              extruded: false,
              x: 0,
              y: 0,
              z: 0,
              rotation: 0,
            },
          ]
        : index === 1
          ? [{ type: 'extrude', target: '$focus', height: 5 }]
          : index === 2
            ? [{ type: 'measure', targets: ['$focus'], metric: 'properties' }]
            : index === 3
              ? [
                  {
                    type: 'opening',
                    target: '$focus',
                    width: 30,
                    height: 2,
                    sill: 0,
                    offset: 0,
                  },
                ]
              : index === 4
                ? [
                    {
                      type: 'building',
                      target: '$focus',
                      floors: 2,
                      slabThickness: 0.25,
                      facade: false,
                      panelWidth: 1.5,
                      mullionWidth: 0.06,
                    },
                  ]
                : index === 6
                  ? [{ type: 'undo', count: 1 }]
                  : [
                      {
                        type: 'measure',
                        targets: ['$focus'],
                        metric: 'properties',
                      },
                    ];
    if (index === 4)
      expect(body.history.at(-1).content).toContain('opening must fit');
    if (index === 7) expect(body.historyAvailability.redo).toBe(1);
    return r.fulfill({
      json: {
        intent: 'apply',
        message:
          index === 2 || index === 7
            ? 'Unsupported invented measurement: 9999 cubic meters.'
            : 'Your library design.',
        operations,
      },
    });
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem('atelier.project.v1'))
      localStorage.setItem(
        'atelier.project.v1',
        JSON.stringify({ version: 1, volumes: [], selectedId: null }),
      );
  });
  await page.goto('/');
  const say = async (text: string) => {
    await page.getByRole('textbox', { name: 'Message Atelier' }).fill(text);
    await page
      .getByRole('button', { name: 'Send message', exact: true })
      .click();
  };
  const state = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem('atelier.session.v2')!),
    );
  await say('Sketch an L-shaped library with two wings.');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '1',
  );
  await expect
    .poll(async () => (await state()).project.volumes.at(-1).geometry.kind)
    .toBe('polygon');
  expect((await state()).project.volumes.at(-1).geometry.extruded).toBe(false);
  await say('Give it five meters of height.');
  await expect
    .poll(async () => (await state()).project.volumes.at(-1).geometry.extruded)
    .toBe(true);
  const beforeMeasurement = await state();
  await say('How much solid material is there?');
  await expect(page.getByRole('log')).toContainText('Material volume 250 m³');
  await expect(page.getByRole('log')).not.toContainText('9999');
  expect(await state()).toEqual(beforeMeasurement);
  await say('Cut a thirty-meter-wide opening.');
  await expect(page.getByRole('alert')).toContainText('opening must fit');
  const review = page.getByRole('region', { name: 'Review geometry change' });
  await expect(review).toBeHidden();
  expect(await state()).toEqual(beforeMeasurement);
  await say('Instead, make two floor slabs and a roof.');
  await expect(review).toBeVisible();
  await review
    .getByText('Checked result · not applied yet', { exact: true })
    .click();
  await expect(review).toContainText('2 floor slabs plus a roof');
  expect(await state()).toEqual(beforeMeasurement);
  await say('Yes, do that.');
  await expect(review).toBeHidden();
  await expect
    .poll(async () => (await state()).project.volumes.at(-1).geometry.kind)
    .toBe('building');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-mesh-builds',
    '3',
  );
  await page.getByRole('button', { name: 'Frame all', exact: true }).click();
  await page.waitForTimeout(550); // Wait for the documented 500 ms framing transition.
  await page.screenshot({
    path: 'test-results/atelier-grounded-assistant.png',
  });
  await say('Undo that.');
  await expect
    .poll(async () => (await state()).project.volumes.at(-1).geometry.kind)
    .toBe('polygon');
  const undone = await state();
  await say('And what is its volume now?');
  await expect
    .poll(async () =>
      page
        .getByRole('log')
        .getByText(/Material volume 250 m³/)
        .count(),
    )
    .toBe(2);
  expect(await state()).toEqual(undone);
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '1',
  );
  expect((await state()).project).toEqual(undone.project);
  expect(errors).toEqual([]);
  await expect(page.locator('.webgl-error')).toHaveCount(0);
});
