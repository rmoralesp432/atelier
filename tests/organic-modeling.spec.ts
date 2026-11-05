import { test, expect } from '@playwright/test';
// Provider fixtures exercise the actual planner, geometry worker and renderer.
// They do not establish live model interpretation of these sentences.
test('curved roof and twisted ribbon render with checked briefs, editable controls, persistence and undo', async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  let turn = 0;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const selector = (name: string) => ({
    refs: [],
    role: null,
    level: null,
    nameContains: name,
  });
  const brief = (editable: string[]) => ({
    objective:
      'Editable curved roof and twisted ribbon with retained controls.',
    editable,
    preserve: [],
    evidence: [
      { source: 'user', statement: 'Sculptural roof and a twisted ribbon.' },
    ],
    requirements: [
      {
        kind: 'shape',
        id: 'roof',
        label: 'Rational roof surface',
        selector: selector('Organic roof'),
        shape: 'nurbs',
      },
      {
        kind: 'shape',
        id: 'ribbon',
        label: 'Variable-section ribbon',
        selector: selector('Organic ribbon'),
        shape: 'organic_sweep',
      },
    ],
  });
  await page.route('**/api/plan', (r) => {
    const body = r.request().postDataJSON();
    turn++;
    if (turn === 1)
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Curved roof and twisted ribbon checked.',
          operations: [
            {
              type: 'organic_form',
              target: null,
              name: 'Organic roof',
              position: { x: 17, y: 6, z: 0 },
              definition: {
                method: 'nurbs',
                degreeU: 3,
                degreeV: 3,
                points: Array.from({ length: 4 }, (_, i) =>
                  Array.from({ length: 4 }, (_, j) => ({
                    x: i * 4 - 6,
                    y: (i === 1 || i === 2) && (j === 1 || j === 2) ? 5 : 0,
                    z: j * 3 - 4.5,
                    weight: 1,
                  })),
                ),
                thickness: 0.2,
                samples: 24,
              },
            },
            {
              type: 'organic_form',
              target: null,
              name: 'Organic ribbon',
              position: { x: 27, y: 0, z: 0 },
              definition: {
                method: 'organic_sweep',
                path: [
                  { x: 0, y: 0, z: 0 },
                  { x: 0, y: 12, z: 0 },
                ],
                profile: 'rectangle',
                stations: [
                  { at: 0, width: 2, depth: 0.2, twist: 0 },
                  { at: 1, width: 2, depth: 0.2, twist: 90 },
                ],
                samples: 48,
              },
            },
          ],
          brief: brief([]),
          planning: {
            stage: 'Organic shells',
            next: null,
            assumptions: [
              'Conceptual surfaces, not engineering documentation.',
            ],
          },
        },
      });
    const roof = body.scene.objects.find((v: any) => v.name === 'Organic roof');
    expect(JSON.parse(roof.formDefinition).method).toBe('nurbs');
    expect(roof.formFrame.base).toBeTruthy();
    return r.fulfill({
      json: {
        intent: 'apply',
        message: 'Raised the existing roof control.',
        operations: [
          {
            type: 'edit_control_points',
            target: roof.id,
            changes: [
              { index: 5, point: { x: -2, y: 9, z: -1.5 }, weight: 1.2 },
            ],
          },
        ],
        brief: brief([roof.id]),
        planning: {
          stage: 'Refine roof',
          next: null,
          assumptions: [],
        },
      },
    });
  });
  await page.goto('/');
  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-model-objects', '2');
  const say = async (text: string) => {
    await page.getByRole('textbox', { name: 'Message Atelier' }).fill(text);
    await page
      .getByRole('button', { name: 'Send message', exact: true })
      .click();
  };
  const stored = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem('atelier.session.v2')!),
    );
  await say('Create a flowing roof and a ribbon that twists 90 degrees.');
  await expect(page.getByRole('log')).toContainText(
    'Curved roof and twisted ribbon checked.',
    { timeout: 60000 },
  );
  await expect(viewport).toHaveAttribute('data-model-objects', '4');
  const first = await stored();
  const roof = first.project.volumes.find(
    (v: any) => v.name === 'Organic roof',
  );
  expect(roof.geometry.mesh.indices.length).toBeGreaterThan(500);
  await say('Lift that inner roof control higher, keeping the edge in place.');
  await expect(page.getByRole('log')).toContainText(
    'Raised the existing roof control.',
    { timeout: 60000 },
  );
  const next = await stored();
  const revised = next.project.volumes.find((v: any) => v.id === roof.id);
  expect(revised.dimensions.height).toBeGreaterThan(roof.dimensions.height);
  expect(revised.geometry.definition.points[1][1].y).toBe(9);
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  await page.getByRole('button', { name: 'Frame all', exact: true }).click();
  await page.screenshot({ path: 'test-results/organic-roof-and-ribbon.png' });
  await page.reload();
  await expect(viewport).toHaveAttribute('data-model-objects', '4');
  expect((await stored()).project).toEqual(next.project);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await stored()).project.volumes.find((v: any) => v.id === roof.id)
          .dimensions.height,
    )
    .toBe(roof.dimensions.height);
  expect(errors).toEqual([]);
});
