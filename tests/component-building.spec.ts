import { test, expect } from '@playwright/test';
test('AI building construction yields independent parts, checked by the brief and saved with one Undo (provider fixture)', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  await page.route('**/api/plan', (r) =>
    r.fulfill({
      json: {
        intent: 'apply',
        message:
          'Four occupied floors, a roof and independently editable glazing.',
        planning: null,
        brief: {
          objective: 'Four-story editable building',
          editable: [],
          preserve: [],
          evidence: [],
          requirements: [
            {
              kind: 'measure',
              id: 'floors',
              label: 'Four occupied floor slabs',
              selector: {
                refs: ['$group:Study'],
                role: 'floor',
                level: null,
                nameContains: null,
              },
              metric: 'count',
              aggregation: 'each',
              comparison: 'equal',
              value: 4,
              tolerance: 0,
              relativeTolerance: 0,
            },
          ],
        },
        operations: [
          {
            type: 'create_at',
            name: 'Study',
            shape: 'box',
            width: 12,
            depth: 8,
            height: 16,
            x: 25,
            y: 0,
            z: 0,
            rotation: 0,
          },
          {
            type: 'building_components',
            target: '$name:Study',
            floors: 4,
            slabThickness: 0.25,
            facade: true,
            panelWidth: 4,
            mullionWidth: 0.06,
          },
        ],
      },
    }),
  );
  await page.goto('/');
  const read = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem('atelier.session.v2')!),
    );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  const before = await read();
  await page
    .getByRole('textbox', { name: 'Message Atelier' })
    .fill(
      'Create a four-story building with glass and separate editable parts.',
    );
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Four occupied floors', {
    timeout: 60000,
  });
  const after = await read(),
    parts = after.project.volumes.filter((v: any) =>
      v.name.startsWith('Study'),
    );
  expect(parts.filter((v: any) => v.component?.role === 'floor')).toHaveLength(
    4,
  );
  expect(
    parts.filter((v: any) => v.material === 'glass').length,
  ).toBeGreaterThan(8);
  expect(parts.every((v: any) => v.geometry?.kind !== 'building')).toBe(true);
  expect(after.past.length).toBe(before.past.length + 1);
  await page.screenshot({
    path: 'test-results/editable-four-story-building.png',
  });
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    String(after.project.volumes.length),
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await read()).project.volumes.length).toBe(2);
});
