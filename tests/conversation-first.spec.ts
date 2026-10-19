import { expect, test } from '@playwright/test';

// These explicit provider fixtures test dialogue flow, not live interpretation.
test('design question, free-form answer and correction work without choosing primitives or selecting tools', async ({
  page,
}) => {
  test.setTimeout(90000);
  let turn = 0;
  let answerQuestion!: () => Promise<void>;
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  await page.route('**/api/plan', async (r) => {
    const body = r.request().postDataJSON();
    if (turn++ === 0) {
      expect(body.message).toBe(
        'I want a long floating gallery.\nAround 80 meters long and 15 deep.',
      );
      answerQuestion = async () =>
        r.fulfill({
          json: {
            intent: 'clarify',
            message:
              'How far above the ground should the gallery sit, and how tall should it be?',
            operations: [],
          },
        });
      return;
    }
    if (turn === 2) {
      expect(body.history.at(-1).content).toContain('How far above the ground');
      expect(body.history[0].content).toContain('80 meters');
      return r.fulfill({
        json: {
          intent: 'apply',
          message:
            'An 80-meter gallery raised four meters, with an eight-meter-high interior envelope.',
          operations: [
            {
              type: 'create_at',
              name: 'Floating gallery',
              shape: 'box',
              width: 80,
              depth: 15,
              height: 8,
              x: 0,
              y: 4,
              z: 0,
              rotation: 0,
            },
          ],
        },
      });
    }
    expect(body.scene.conversation.focusIds).toEqual([
      body.scene.selectedIds[0],
    ]);
    expect(body.history.at(-1).content).toContain('80 × 15 × 8');
    expect(
      body.history.every(
        (m: any) => Object.keys(m).sort().join(',') === 'content,role',
      ),
    ).toBe(true);
    return r.fulfill({
      json: {
        intent: 'apply',
        message:
          'A wider gallery, keeping its length, height and raised position.',
        operations: [
          {
            type: 'resize',
            targets: ['$focus'],
            axis: 'depth',
            mode: 'set',
            value: 20,
          },
        ],
      },
    });
  });
  await page.goto('/');
  const input = page.getByRole('textbox', { name: 'Message Atelier' });
  await expect(
    page.getByText('Space for your next idea.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Primitive shape')).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Create floors and curtain wall' }),
  ).toBeHidden();
  const initial = await page.evaluate(() =>
    localStorage.getItem('atelier.session.v2'),
  );
  await input.fill('I want a long floating gallery.');
  await input.press('Shift+Enter');
  await input.pressSequentially('Around 80 meters long and 15 deep.');
  await input.press('Enter');
  await expect(page.locator('.process-stage')).toContainText(
    'Considering your idea…',
  );
  await input.fill('Keep this draft while you think.');
  await input.press('Enter');
  await expect(input).toHaveValue('Keep this draft while you think.');
  expect(turn).toBe(1);
  await answerQuestion();
  await expect(page.getByRole('log')).toContainText('How far above the ground');
  expect(
    await page.evaluate(() => localStorage.getItem('atelier.session.v2')),
  ).toBe(initial);
  await expect(input).toBeFocused();
  await input.fill('About four meters off the ground, and eight meters tall.');
  await input.press('Enter');
  await expect(
    page
      .getByRole('log')
      .getByText(
        'An 80-meter gallery raised four meters, with an eight-meter-high interior envelope.',
        { exact: true },
      ),
  ).toBeVisible();
  const details = page.locator('.conversation-measurements').last();
  await expect(details.locator('p')).toBeHidden();
  await details.locator('summary').click();
  await expect(details.locator('p')).toContainText('80 × 15 × 8');
  await input.fill('Actually, give it twenty meters of depth. Keep the rest.');
  await input.press('Enter');
  await expect(page.getByRole('log')).toContainText('A wider gallery');
  const project = await page.evaluate(
    () => JSON.parse(localStorage.getItem('atelier.session.v2')!).project,
  );
  expect(project.volumes).toHaveLength(3);
  expect(project.volumes[2].dimensions).toEqual({
    width: 80,
    depth: 20,
    height: 8,
  });
  expect(project.volumes[2].position.y).toBe(4);
  await expect(page.locator('.objects-panel')).toBeHidden();
  await expect(page.locator('.inspector-panel')).toBeHidden();
  await page.screenshot({
    path: 'test-results/atelier-conversation-first.png',
  });
  await page.reload();
  await expect(
    page
      .getByRole('log')
      .getByText(
        'A wider gallery, keeping its length, height and raised position.',
        { exact: true },
      ),
  ).toBeVisible();
});
