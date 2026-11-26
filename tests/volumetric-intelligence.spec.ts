import { test, expect, type Page } from '@playwright/test';

// These exercise the real application and Manifold worker with provider
// fixtures. They are NOT evidence of live language/vision understanding.
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
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

test('staged circular opening and glazing render, persist, and undo as one proposal (provider fixtures)', async ({
  page,
}) => {
  test.setTimeout(120000);
  let turn = 0,
    wallId = '';
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/plan', async (r) => {
    const body = r.request().postDataJSON();
    turn++;
    if (turn === 1)
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Create a wall',
          operations: [
            {
              type: 'create_at',
              name: 'Round-window wall',
              shape: 'box',
              width: 10,
              depth: 0.3,
              height: 5,
              x: 20,
              y: 0,
              z: 0,
              rotation: 20,
            },
          ],
          planning: {
            stage: 'Wall',
            next: 'Opening and glazing',
            assumptions: [],
          },
        },
      });
    wallId = body.scene.objects.find(
      (v: any) => v.name === 'Round-window wall',
    ).id;
    return r.fulfill({
      json: {
        intent: 'apply',
        message: 'Circular opening and fitted glazing checked.',
        operations: [
          {
            type: 'opening',
            target: wallId,
            width: 2,
            height: 2,
            sill: 1,
            offset: 0,
          },
          { type: 'opening_shape', target: wallId, shape: 'ellipse' },
          {
            type: 'glaze_opening',
            target: wallId,
            frameWidth: 0.1,
            frameDepth: 0.12,
            paneThickness: 0.012,
          },
        ],
        planning: { stage: 'Opening system', next: null, assumptions: [] },
      },
    });
  });
  await ready(page);
  const original = await stored(page);
  await say(page, 'Make a circular window with glazing in a new wall.');
  await expect(page.getByRole('log')).toContainText(
    'Circular opening and fitted glazing checked.',
    { timeout: 60000 },
  );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '5',
  );
  const result = await stored(page);
  expect(result.past.length).toBe(original.past.length + 1);
  expect(
    result.project.volumes.filter((v: any) => v.component?.hostId === wallId),
  ).toHaveLength(2);
  expect(
    result.project.volumes.find((v: any) => v.id === wallId).geometry
      .operands[1].geometry.definition.shape,
  ).toBe('ellipse');
  await page.screenshot({ path: 'test-results/volumetric-round-window.png' });
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '5',
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  expect(errors).toEqual([]);
});

test('new I-section and radial shell tools execute in the viewport and remain editable (provider fixtures)', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.route('**/api/plan', (r) =>
    r.fulfill({
      json: {
        intent: 'apply',
        message: 'Section and shell generated.',
        operations: [
          {
            type: 'profile_solid',
            targets: [],
            name: 'Editable I-section',
            position: { x: 20, y: 0, z: 0 },
            dimensions: { width: 0.9, depth: 0.6, height: 4 },
            axis: 'y',
            shape: 'i_section',
            web: 0.03,
            flange: 0.05,
            points: null,
          },
          {
            type: 'revolve',
            target: null,
            name: 'Radial shell',
            position: { x: 25, y: 0, z: 0 },
            degrees: 360,
            profile: [
              { radius: 2, height: 0 },
              { radius: 3, height: 0 },
              { radius: 3, height: 3 },
              { radius: 2, height: 3 },
            ],
          },
        ],
        planning: null,
      },
    }),
  );
  await ready(page);
  await say(page, 'Create a profiled support and a hollow radial shell.');
  await expect(page.getByRole('log')).toContainText(
    'Section and shell generated.',
    { timeout: 60000 },
  );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '4',
  );
  const result = await stored(page);
  const forms = result.project.volumes.filter(
    (v: any) => v.geometry?.kind === 'form',
  );
  expect(forms.map((v: any) => v.geometry.definition.method)).toEqual([
    'profile',
    'revolve',
  ]);
  expect(forms[0].dimensions.height).toBe(4);
  await page.screenshot({
    path: 'test-results/volumetric-profile-and-shell.png',
  });
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '4',
  );
  expect((await stored(page)).project.volumes.map((v: any) => v.id)).toEqual(
    result.project.volumes.map((v: any) => v.id),
  );
});
