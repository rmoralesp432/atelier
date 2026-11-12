import { test, expect } from '@playwright/test';

test('agent keeps provisional arrays private, recovers invalid arguments, verifies, then supports follow-up edits (offline provider)', async ({
  page,
}) => {
  test.setTimeout(120000);
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
  let calls = 0;
  const ids: string[] = [];
  await page.route('**/api/plan', async (r) => {
    const b = r.request().postDataJSON();
    calls++;
    if (calls === 1)
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Construct repeated volumes',
          brief: null,
          planning: { stage: 'Array', assumptions: [], next: 'Inspect' },
          operations: [
            {
              type: 'create_at',
              name: 'Array study',
              shape: 'box',
              width: 3,
              depth: 3,
              height: 3,
              x: 20,
              y: 0,
              z: 20,
              rotation: 0,
            },
            {
              type: 'array_grid',
              targets: ['$created'],
              rows: 12,
              columns: 12,
              spacingX: 6,
              spacingZ: 6,
            },
          ],
        },
      });
    const parts = b.scene.objects.filter((o: any) =>
      o.name.startsWith('Array study'),
    );
    expect(parts).toHaveLength(144);
    if (calls === 2) {
      ids.push(...parts.map((o: any) => o.id));
      return r.fulfill({
        status: 422,
        json: {
          code: 'invalid_plan',
          error: 'operations.0.targets: expected actual scene IDs',
        },
      });
    }
    if (calls === 3) {
      expect(b.validationFeedback.error).toContain('targets');
      expect(parts.map((o: any) => o.id)).toEqual(ids);
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Measure the array',
          brief: null,
          planning: { stage: 'Verification', assumptions: [], next: 'Inspect' },
          operations: [
            {
              type: 'verify',
              targets: ids,
              metric: 'count',
              comparison: 'equal',
              value: 144,
              tolerance: 0,
            },
          ],
        },
      });
    }
    if (calls === 5)
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Raise the array',
          brief: null,
          planning: { stage: 'Raise', assumptions: [], next: 'Inspect' },
          operations: [
            { type: 'move', targets: ids, direction: 'up', distance: 2 },
          ],
        },
      });
    if (calls === 6)
      expect(parts.every((o: any) => o.position.y === 2)).toBe(true);
    return r.fulfill({
      json: {
        intent: 'finish',
        message: 'Measured result complete',
        operations: [],
        brief: null,
        planning: null,
      },
    });
  });
  await page.goto('/');
  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-model-objects', '2');
  const input = page.getByRole('textbox', { name: 'Message Atelier' });
  await input.fill(
    'Create a twelve by twelve arrangement of three-metre cubes.',
  );
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(viewport).toHaveAttribute('data-model-objects', '146', {
    timeout: 60000,
  });
  expect(calls).toBe(4);
  await input.fill('Raise that whole arrangement two metres.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => calls).toBe(6);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('atelier.session.v2')!);
        return s.project.volumes.filter(
          (v: any) => v.name.startsWith('Array study') && v.position.y === 2,
        ).length;
      }),
    )
    .toBe(144);
  await page.screenshot({ path: 'test-results/agent-array-verified.png' });
});
