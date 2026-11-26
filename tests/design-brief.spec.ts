import { test, expect, type Page } from '@playwright/test';
const state = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
const create = (name: string, x: number) => ({
  type: 'create_at',
  name,
  shape: 'box',
  width: 4,
  depth: 3,
  height: 5,
  x,
  y: 0,
  z: 15,
  rotation: 0,
});
const brief = {
  objective:
    'Two five-meter-high study volumes, leaving the existing project untouched.',
  editable: [],
  preserve: [],
  evidence: [
    { source: 'user', statement: 'Two separate volumes, five meters high.' },
  ],
  requirements: [
    {
      kind: 'measure',
      id: 'count',
      label: 'Two study volumes',
      selector: {
        refs: [],
        role: null,
        level: null,
        nameContains: 'Study block',
      },
      metric: 'count',
      aggregation: 'each',
      comparison: 'equal',
      value: 2,
      tolerance: 0,
      relativeTolerance: 0,
    },
    {
      kind: 'measure',
      id: 'height',
      label: 'Five-meter height',
      selector: {
        refs: [],
        role: null,
        level: null,
        nameContains: 'Study block',
      },
      metric: 'height',
      aggregation: 'each',
      comparison: 'equal',
      value: 5,
      tolerance: 0.001,
      relativeTolerance: 0,
    },
  ],
};
async function ready(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
}
async function say(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Message Atelier' }).fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
}

test('a valid but incomplete proposal is corrected before commit, with the checked brief retained (offline provider)', async ({
  page,
}) => {
  test.setTimeout(120000);
  let calls = 0,
    firstId = '';
  let release!: () => Promise<void>;
  await page.route('**/api/plan', async (r) => {
    const body = r.request().postDataJSON();
    calls++;
    if (calls === 1)
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Both volumes are ready.',
          brief,
          planning: null,
          operations: [create('Study block A', 20)],
        },
      });
    expect(body.validationFeedback.error).toContain('Two study volumes');
    expect(
      body.execution.assessment.find((r: any) => r.id === 'count').met,
    ).toBe(false);
    expect(
      body.execution.assessment.find((r: any) => r.id === 'height').met,
    ).toBe(true);
    expect(body.execution.brief.objective).toBe(brief.objective);
    const first = body.scene.objects.find(
      (v: any) => v.name === 'Study block A',
    );
    firstId = first.id;
    expect(body.scene.understanding.inventory.length).toBeGreaterThan(0);
    release = () =>
      r.fulfill({
        json: {
          intent: 'apply',
          message: 'Two five-meter study volumes checked.',
          brief: null,
          planning: null,
          operations: [create('Study block B', 28)],
        },
      });
  });
  await ready(page);
  const before = await state(page);
  await say(
    page,
    'Create two five-meter-high study blocks. Keep my other buildings.',
  );
  await expect.poll(() => calls).toBe(2);
  expect((await state(page)).project).toEqual(before.project);
  await expect(page.getByRole('log')).not.toContainText(
    'Both volumes are ready.',
  );
  await release();
  await expect(page.getByRole('log')).toContainText(
    'Two five-meter study volumes checked.',
    { timeout: 60000 },
  );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '4',
  );
  const after = await state(page);
  expect(
    after.project.volumes.find((v: any) => v.name === 'Study block A').id,
  ).toBe(firstId);
  expect(after.past.length).toBe(before.past.length + 1);
  expect(after.context.lastBrief.objective).toBe(brief.objective);
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '4',
  );
  expect((await state(page)).context.lastBrief.requirements).toHaveLength(2);
  await page.screenshot({ path: 'test-results/checked-design-brief.png' });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
});

test('a model cannot claim completion while requirements remain unmet (offline provider)', async ({
  page,
}) => {
  test.setTimeout(90000);
  let calls = 0;
  await page.route('**/api/plan', (r) => {
    calls++;
    return r.fulfill({
      json:
        calls === 1
          ? {
              intent: 'apply',
              message: 'Done',
              brief,
              planning: null,
              operations: [create('Study block A', 20)],
            }
          : {
              intent: 'finish',
              message: 'Everything is finished',
              brief: null,
              planning: null,
              operations: [],
            },
    });
  });
  await ready(page);
  const before = await state(page);
  await say(page, 'Create two study volumes.');
  await expect(page.getByRole('log')).toContainText(
    "couldn't satisfy these design requirements",
    { timeout: 60000 },
  );
  expect(calls).toBe(3);
  expect((await state(page)).project).toEqual(before.project);
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await expect(page.getByRole('log')).not.toContainText(
    'Everything is finished',
  );
});
