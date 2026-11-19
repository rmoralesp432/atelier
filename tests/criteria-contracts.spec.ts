import { expect, test, type Page } from '@playwright/test';
import { criteria, measure, selector } from './fixtures/completion';
import type { CompletionCriteria } from '../src/intelligence/completionSchema';

const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
const request =
  'Create two independently editable aluminum brackets at x=20 and x=24.6, each 1.6 by 0.8 by 0.4 m, base y=1.2. Leave existing objects unchanged.';
const plan = (operations: unknown[]) => ({
  intent: 'apply',
  message: 'Construct the requested brackets',
  brief: null,
  planning: { stage: 'Model', assumptions: [], next: null },
  operations,
});
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
  await expect
    .poll(async () => (await saved(page))?.project.volumes.length)
    .toBe(2);
}
const send = async (page: Page, text: string) => {
  await page.getByRole('textbox', { name: 'Message Atelier' }).fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
};

test('invalid criteria are independently corrected before model repair; the exact components commit, reload and Undo/Redo together', async ({
  page,
}) => {
  test.setTimeout(120000);
  await ready(page);
  const before = await saved(page);
  let reviews = 0,
    models = 0,
    ids: string[] = [],
    c: CompletionCriteria;
  await page.route('**/api/completion-criteria', async (route) => {
    reviews++;
    const body = route.request().postDataJSON();
    expect((await saved(page)).project).toEqual(before.project);
    if (reviews === 1) {
      ids = body.candidate
        .filter((v: any) => v.name.startsWith('Bracket'))
        .map((v: any) => v.id);
      expect(ids).toHaveLength(2);
      c = criteria(
        [
          measure('first', 'x', 20, selector([ids[0]])),
          measure('second', 'x', 24.6, selector([ids[1]])),
          measure('height', 'height', 0.4),
          {
            kind: 'offset',
            id: 'spacing',
            label: 'Bracket spacing',
            first: selector([ids[1]]),
            second: selector([ids[0]]),
            axis: 'x',
            firstAnchor: 'center',
            secondAnchor: 'center',
            value: 4.6,
            tolerance: 0.001,
          },
          {
            kind: 'property',
            id: 'substance',
            label: 'Aluminum designation',
            selector: selector(),
            property: 'material',
            value: 'aluminum',
          },
        ],
        [],
        request,
      );
      return route.fulfill({ json: c });
    }
    expect(reviews).toBe(2);
    expect(body.revision.issues.map((i: any) => i.checkId)).toEqual([
      'spacing',
      'substance',
    ]);
    expect(
      body.revision.observations.find((v: any) => v.id === 'height').outcome,
    ).toBe('verified');
    const fixed = structuredClone(c);
    (fixed.checks[3].requirement as any).value = -4.6;
    (fixed.checks[4].requirement as any).property = 'materialSpec';
    return route.fulfill({ json: fixed });
  });
  await page.route('**/api/plan', async (route) => {
    models++;
    const body = route.request().postDataJSON();
    if (models === 1)
      return route.fulfill({
        json: plan(
          [20, 24.6].map((x, i) => ({
            type: 'create_at',
            name: `Bracket ${i}`,
            shape: 'box',
            width: 1.6,
            depth: 0.8,
            height: 0.4,
            x,
            y: 1.2,
            z: 0,
            rotation: 0,
          })),
        ),
      });
    expect(models).toBe(2);
    expect(
      body.validationFeedback.verification.checks
        .filter((c: any) => c.outcome === 'incorrect')
        .map((c: any) => c.id),
    ).toEqual(['substance']);
    expect(
      body.scene.objects
        .filter((v: any) => v.name.startsWith('Bracket'))
        .map((v: any) => v.id),
    ).toEqual(ids);
    return route.fulfill({
      json: plan([
        {
          type: 'material',
          targets: ids,
          material: 'solid',
          specification: 'aluminum',
        },
      ]),
    });
  });
  await send(page, request);
  await expect
    .poll(async () => (await saved(page)).project.volumes.length, {
      timeout: 60000,
    })
    .toBe(4);
  const after = await saved(page);
  expect(models).toBe(2);
  expect(reviews).toBe(2);
  expect(after.project.volumes.slice(0, 2)).toEqual(before.project.volumes);
  expect(after.project.volumes.slice(2).map((v: any) => v.id)).toEqual(ids);
  expect(
    after.project.volumes.slice(2).map((v: any) => v.materialSpec),
  ).toEqual(['aluminum', 'aluminum']);
  expect(after.past).toHaveLength(before.past.length + 1);
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '4',
  );
  expect((await saved(page)).project).toEqual(after.project);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project)
    .toEqual(before.project);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project)
    .toEqual(after.project);
});

test('an unresolved unsupported material check commits safe geometry with explicit uncertainty, without repeated modeling repairs', async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  const before = await saved(page);
  let models = 0,
    reviews = 0;
  const c = criteria(
    [
      measure('count', 'count', 1),
      {
        kind: 'property',
        id: 'material',
        label: 'Physical certification',
        selector: selector(),
        property: 'material',
        value: 'certified impact-resistant polymer',
      },
    ],
    [],
    'Create an impact-resistant polymer block',
  );
  await page.route('**/api/completion-criteria', (r) => {
    reviews++;
    return r.fulfill({ json: c });
  });
  await page.route('**/api/plan', (r) => {
    models++;
    return r.fulfill({
      json: plan([
        {
          type: 'create_at',
          name: 'Study block',
          shape: 'box',
          width: 1,
          depth: 1,
          height: 1,
          x: 20,
          y: 0,
          z: 0,
          rotation: 0,
        },
      ]),
    });
  });
  await send(page, 'Create an impact-resistant polymer block');
  await expect
    .poll(async () => (await saved(page)).project.volumes.length, {
      timeout: 60000,
    })
    .toBe(3);
  expect(models).toBe(1);
  expect(reviews).toBe(2);
  expect((await saved(page)).project.volumes.slice(0, 2)).toEqual(
    before.project.volumes,
  );
  const messages = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('atelier.conversation.v2')!),
  );
  expect(messages.at(-1).summary).toContain('incomplete verification');
  expect(messages.at(-1).summary).toContain('Invalid verification criterion');
});
