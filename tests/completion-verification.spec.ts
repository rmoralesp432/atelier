import { expect, test, type Page } from '@playwright/test';
import { criteria, measure, selector } from './fixtures/completion';

const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
const box = (name: string, x = 12, height = 2) => ({
  type: 'create_at',
  name,
  shape: 'box',
  width: 2,
  depth: 2,
  height,
  x,
  y: 0,
  z: 0,
  rotation: 0,
});
const apply = (operations: unknown[]) => ({
  intent: 'apply',
  message: 'Model the requested parts',
  brief: null,
  planning: { stage: 'Model', assumptions: [], next: 'Inspect' },
  operations,
});
const finish = {
  intent: 'finish',
  message: 'All 999 parts are perfect.',
  operations: [],
  brief: null,
  planning: null,
};
async function ready(page: Page) {
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
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
}
async function send(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Message Atelier' }).fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
}

test('independent completion rejects a valid but incomplete model, repairs the same geometry and commits with one Undo (offline providers)', async ({
  page,
}) => {
  test.setTimeout(120000);
  await ready(page);
  const before = await saved(page);
  let planCalls = 0,
    reviewCalls = 0,
    firstId = '';
  await page.route('**/api/completion-criteria', async (r) => {
    reviewCalls++;
    const b = r.request().postDataJSON();
    expect(b.scene.objects).toHaveLength(2);
    expect(b.candidate).toHaveLength(3);
    expect(b.candidate[2]).not.toHaveProperty('dimensions');
    expect(b).not.toHaveProperty('execution');
    expect((await saved(page)).project).toEqual(before.project);
    return r.fulfill({
      json: criteria(
        [
          measure('count', 'count', 3),
          measure('height', 'height', 2),
          {
            kind: 'layout',
            id: 'layout',
            label: 'Three spaced cubes',
            selector: selector(),
            origin: { x: 12, y: 0, z: 0 },
            counts: { x: 3, y: 1, z: 1 },
            step: { x: 4, y: 0, z: 0 },
            rotation: 0,
            tolerance: 0.00001,
          },
        ],
        [],
        'three cubes',
      ),
    });
  });
  await page.route('**/api/plan', async (r) => {
    const b = r.request().postDataJSON();
    planCalls++;
    if (planCalls === 1)
      return r.fulfill({ json: apply([box('Requested cube', 12, 1)]) });
    const created = b.scene.objects.filter((o: any) =>
      o.name.startsWith('Requested'),
    );
    if (planCalls === 2) {
      firstId = created[0].id;
      return r.fulfill({ json: finish });
    }
    if (planCalls === 3) {
      expect(b.validationFeedback.verification.passed).toBe(false);
      expect(
        b.validationFeedback.verification.checks
          .filter((c: any) => !c.met)
          .map((c: any) => c.id),
      ).toEqual(['count', 'height', 'layout']);
      expect((await saved(page)).project).toEqual(before.project);
      expect(created[0].id).toBe(firstId);
      return r.fulfill({
        json: apply([
          {
            type: 'resize',
            targets: [firstId],
            axis: 'height',
            mode: 'set',
            value: 2,
          },
          box('Requested cube 2', 16),
          box('Requested cube 3', 20),
        ]),
      });
    }
    return r.fulfill({ json: finish });
  });
  await send(
    page,
    'Create three cubes with two-metre sides, starting at x=12, with four-metre spacing. Keep existing objects unchanged.',
  );
  await expect
    .poll(async () => (await saved(page)).project.volumes.length, {
      timeout: 60000,
    })
    .toBe(5);
  const after = await saved(page);
  expect(planCalls).toBe(4);
  expect(reviewCalls).toBe(1);
  expect(after.project.volumes.slice(0, 2)).toEqual(before.project.volumes);
  expect(after.project.volumes[2].id).toBe(firstId);
  expect(after.project.volumes.slice(2).map((v: any) => v.position.x)).toEqual([
    12, 16, 20,
  ]);
  for (const v of after.project.volumes.slice(2))
    expect(v.dimensions).toEqual({ width: 2, depth: 2, height: 2 });
  expect(after.past).toHaveLength(before.past.length + 1);
  const history = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('atelier.conversation.v2') || '[]'),
  );
  expect(history.at(-1).summary).toContain('count (each): 3');
  expect(JSON.stringify(history)).not.toContain('999');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project)
    .toEqual(before.project);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project)
    .toEqual(after.project);
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '5',
  );
  expect((await saved(page)).project).toEqual(after.project);
});

test('a failed request followed by reload does not poison an unrelated new modeling instruction (offline providers)', async ({
  page,
}) => {
  test.setTimeout(120000);
  await ready(page);
  const before = await saved(page);
  let failing = true,
    calls = 0,
    reviewCalls = 0;
  await page.route('**/api/completion-criteria', (r) => {
    reviewCalls++;
    return r.fulfill({
      json: criteria(
        [
          measure('count', 'count', failing ? 4 : 1),
          measure('height', 'height', 2),
        ],
        [],
        r.request().postDataJSON().message,
      ),
    });
  });
  await page.route('**/api/plan', (r) => {
    const b = r.request().postDataJSON();
    calls++;
    if (!b.execution.receipts.length) {
      expect(b.scene.objects).toHaveLength(2);
      expect(b.validationFeedback).toBeUndefined();
      expect(b.execution.remainingOperations).toBe(64);
      if (!failing)
        expect(
          b.history.some((m: any) => m.content.includes('not pending work')),
        ).toBe(true);
      return r.fulfill({
        json: apply([
          box(failing ? 'Discarded attempt' : 'Fresh independent cube'),
        ]),
      });
    }
    return r.fulfill({
      json: failing
        ? apply([
            {
              type: 'move',
              targets: ['missing-after-success'],
              direction: 'up',
              distance: 1,
            },
          ])
        : finish,
    });
  });
  await send(page, 'Create four separate two-metre cubes.');
  await expect(
    page.getByText(/Target "missing-after-success"/).first(),
  ).toBeVisible({ timeout: 60000 });
  expect(calls).toBe(5);
  expect(reviewCalls).toBe(0);
  expect(await saved(page)).toEqual(before);
  failing = false;
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await send(page, 'New task: add one two-metre cube at x=12.');
  await expect
    .poll(async () => (await saved(page)).project.volumes.length, {
      timeout: 60000,
    })
    .toBe(3);
  expect(reviewCalls).toBe(1);
  const after = await saved(page);
  expect(after.project.volumes.map((v: any) => v.name)).not.toContain(
    'Discarded attempt',
  );
  expect(after.project.volumes.slice(0, 2)).toEqual(before.project.volumes);
  expect(after.past).toHaveLength(before.past.length + 1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project)
    .toEqual(before.project);
});
