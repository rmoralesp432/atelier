import { expect, test } from '@playwright/test';
import { criteria, measure } from './fixtures/completion';

test.use({ actionTimeout: 15000 });

test('blocked design, invalid arguments and transport errors preserve the project and do not poison a new modeling turn', async ({
  page,
}) => {
  test.setTimeout(120000);
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
  const create = {
    intent: 'apply',
    message: 'Create a small solid',
    planning: { stage: 'Model', assumptions: [], next: 'Inspect' },
    operations: [
      {
        type: 'create_at',
        shape: 'cylinder',
        name: 'New independent study',
        width: 0.7,
        depth: 0.7,
        height: 1.8,
        x: 11,
        y: 0,
        z: -4,
        rotation: 0,
      },
    ],
  };
  let mode = 'blocked',
    calls = 0;
  await page.route('**/api/plan', (r) => {
    calls++;
    const b = r.request().postDataJSON();
    if (mode === 'blocked')
      return r.fulfill(
        b.execution?.receipts.length
          ? {
              status: 422,
              json: {
                code: 'modeling_blocked',
                error:
                  'The same solid cannot have two different heights at once. Choose the intended height. No changes were applied to your project.',
              },
            }
          : { json: create },
      );
    if (mode === 'arguments')
      return r.fulfill({
        status: 422,
        json: {
          code: 'invalid_plan',
          error: 'operations.0.targets: invalid type',
        },
      });
    if (mode === 'transport') return r.abort('connectionreset');
    if (mode === 'provider')
      return r.fulfill({
        status: 502,
        json: {
          code: 'provider_error',
          error:
            'The AI service is temporarily unavailable. Your project is unchanged.',
        },
      });
    expect(b.history.at(-1)?.content ?? '').not.toContain('operations.0');
    return r.fulfill({
      json: b.execution?.receipts.length
        ? { intent: 'finish', message: 'Ready', operations: [] }
        : create,
    });
  });
  await page.route('**/api/completion-criteria', (r) =>
    r.fulfill({
      json: criteria(
        [measure('count', 'count', 1), measure('height', 'height', 1.8)],
        [],
        r.request().postDataJSON().message,
      ),
    }),
  );
  await page.goto('/');
  const saved = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem('atelier.session.v2')!),
    );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await expect
    .poll(async () => (await saved())?.project?.volumes.length)
    .toBe(2);
  const original = await saved();
  const send = async (text: string) => {
    await page.getByRole('textbox', { name: 'Message Atelier' }).fill(text);
    await page
      .getByRole('button', { name: 'Send message', exact: true })
      .click();
  };
  for (const [kind, message] of [
    ['blocked', 'cannot have two different heights'],
    [
      'arguments',
      'could not turn this request into a valid modeling operation',
    ],
    ['transport', 'connection to ATELIER was interrupted'],
    ['provider', 'AI service is temporarily unavailable'],
  ]) {
    mode = kind;
    await send(`Attempt the ${kind} request.`);
    await expect(
      page.getByRole('log', { name: 'Design conversation' }),
    ).toContainText(message, { timeout: 45000 });
    expect((await saved()).project).toEqual(original.project);
    expect((await saved()).past).toEqual(original.past);
    await expect(page.getByRole('log')).not.toContainText('operations.0');
  }
  const beforeNew = calls;
  mode = 'success';
  await send('Start a new study: make a cylinder 0.7 m across and 1.8 m tall.');
  await expect
    .poll(async () => (await saved()).project.volumes.length, {
      timeout: 45000,
    })
    .toBe(3);
  expect(calls - beforeNew).toBe(2);
  expect((await saved()).past).toHaveLength(original.past.length + 1);
  expect((await saved()).project.volumes.slice(0, 2)).toEqual(
    original.project.volumes,
  );
});
