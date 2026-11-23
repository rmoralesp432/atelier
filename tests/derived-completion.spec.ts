import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { criteria, measure, selector } from './fixtures/completion';
import { calculation } from './fixtures/calculations';
import type { CompletionCriteria } from '../src/intelligence/completionSchema';

const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
const send = async (page: Page, text: string) => {
  await page.getByRole('textbox', { name: 'Message Atelier' }).fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
};
const plan = (operations: unknown[]) => ({
  intent: 'apply',
  message: 'Update the spherical study',
  brief: null,
  planning: { stage: 'Model', assumptions: [], next: null },
  operations,
});

test('derived geometry checks repair a wrong sphere position, commit once, edit from the original model, and retain identities through reload and Undo/Redo', async ({
  page,
}, info) => {
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
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await expect
    .poll(async () => (await saved(page))?.project.volumes.length)
    .toBe(2);
  const before = await saved(page),
    source = before.project.volumes[0];
  const x = source.position.x + 17,
    y = source.position.y + source.dimensions.height + 0.2,
    z = source.position.z - 2;
  const request =
    'Add a separately editable sphere of radius 21 cm, its base 20 cm above the first object’s original top, its center 17 m along +X and 2 m along -Z from that object. Preserve the existing objects.';
  const b = calculation();
  const px = b.op(
    'add',
    b.original(source.id, 'x'),
    b.quantity(17, 'm', '17 m along +X'),
  );
  const py = b.op(
    'add',
    b.original(source.id, 'top'),
    b.quantity(20, 'cm', '20 cm above'),
  );
  const pz = b.op(
    'subtract',
    b.original(source.id, 'z'),
    b.quantity(2, 'm', '2 m along -Z'),
  );
  const d = calculation();
  let checks: CompletionCriteria = criteria(
    [
      measure('count', 'count', 1),
      {
        kind: 'positions',
        id: 'placement',
        label: 'Requested placement',
        selector: selector(),
        points: [{ x: 0, y: 0, z: 0 }],
        tolerance: 0.001,
      },
      {
        kind: 'diameter',
        id: 'roundness',
        label: 'Requested spherical diameter',
        selector: selector(),
        shape: 'sphere',
        value: 1,
        tolerance: 0.001,
      },
      {
        kind: 'editable',
        id: 'editable',
        label: 'Editable sphere',
        selector: selector(),
      },
    ],
    [],
    request,
  );
  checks.checks[1].calculation = b.points(px, py, pz);
  checks.checks[2].calculation = d.value(
    d.op('multiply', d.quantity(21, 'cm', 'radius 21 cm'), d.constant(2)),
  );
  let calls = 0,
    reviews = 0,
    id = '',
    phase = 'create';
  const feedback: unknown[] = [];
  await page.route('**/api/completion-criteria', (r) => {
    reviews++;
    return r.fulfill({ json: checks });
  });
  await page.route('**/api/plan', async (r) => {
    calls++;
    const body = r.request().postDataJSON();
    if (phase === 'create') {
      expect((await saved(page)).project).toEqual(before.project);
      if (calls === 1)
        return r.fulfill({
          json: plan([
            {
              type: 'create_at',
              name: 'Spherical study',
              shape: 'sphere',
              width: 0.42,
              height: 0.42,
              depth: 0.42,
              x,
              y: y + 0.08,
              z,
              rotation: 0,
            },
          ]),
        });
      expect(calls).toBe(2);
      const report = body.validationFeedback.verification;
      feedback.push(report);
      expect(report).toMatchObject({ status: 'incorrect', canCommit: false });
      expect(
        report.checks
          .filter((c: any) => c.outcome === 'incorrect')
          .map((c: any) => c.id),
      ).toEqual(['placement']);
      expect(
        report.checks.find((c: any) => c.id === 'placement').calculation
          .expected,
      ).toEqual([{ x, y, z }]);
      id = body.scene.objects.find((v: any) => v.name === 'Spherical study').id;
      return r.fulfill({
        json: plan([{ type: 'position', targets: [id], x: null, y, z: null }]),
      });
    }
    expect(calls).toBe(3);
    return r.fulfill({
      json: plan([
        {
          type: 'position',
          targets: [id],
          x: x + 0.37 * Math.cos((-23 * Math.PI) / 180),
          y: null,
          z: z + 0.37 * Math.sin((-23 * Math.PI) / 180),
        },
        ...(['width', 'height', 'depth'] as const).map((axis) => ({
          type: 'resize',
          targets: [id],
          axis,
          mode: 'set',
          value: 0.438,
        })),
      ]),
    });
  });
  await send(page, request);
  await expect
    .poll(async () => (await saved(page)).project.volumes.length, {
      timeout: 60000,
    })
    .toBe(3);
  const created = await saved(page);
  expect(reviews).toBe(1);
  expect(calls).toBe(2);
  expect(created.project.volumes.slice(0, 2)).toEqual(before.project.volumes);
  expect(created.project.volumes[2]).toMatchObject({
    id,
    position: { x, y, z },
  });
  expect(created.past).toHaveLength(before.past.length + 1);

  phase = 'edit';
  const edit =
    'Move the spherical study 37 cm in the direction -23 degrees from +X toward +Z. Keep its base level and increase its original diameter by 18 mm. Preserve all other objects.';
  const m = calculation(),
    distance = m.quantity(37, 'cm', '37 cm'),
    angle = m.quantity(-23, 'deg', '-23 degrees from +X toward +Z');
  const mx = m.op(
    'add',
    m.original(id, 'x'),
    m.op('multiply', distance, m.op('cos', angle)),
  );
  const mz = m.op(
    'add',
    m.original(id, 'z'),
    m.op('multiply', distance, m.op('sin', angle)),
  );
  const size = calculation();
  checks = criteria(
    [
      {
        kind: 'positions',
        id: 'edit-position',
        label: 'Requested displacement',
        selector: selector([id]),
        points: [{ x: 0, y: 0, z: 0 }],
        tolerance: 0.001,
      },
      {
        kind: 'diameter',
        id: 'edit-size',
        label: 'Requested enlargement',
        selector: selector([id]),
        shape: 'sphere',
        value: 1,
        tolerance: 0.001,
      },
      {
        kind: 'editable',
        id: 'editable',
        label: 'Editable sphere',
        selector: selector([id]),
      },
    ],
    [id],
    edit,
  );
  checks.checks[0].calculation = m.points(mx, m.original(id, 'y'), mz);
  checks.checks[1].calculation = size.value(
    size.op(
      'add',
      size.original(id, 'width'),
      size.quantity(18, 'mm', '18 mm'),
    ),
  );
  await send(page, edit);
  await expect
    .poll(async () => (await saved(page)).project.volumes[2].dimensions.width, {
      timeout: 60000,
    })
    .toBe(0.438);
  const edited = await saved(page);
  expect(calls).toBe(3);
  expect(reviews).toBe(2);
  expect(edited.project.volumes.slice(0, 2)).toEqual(before.project.volumes);
  expect(edited.project.volumes[2].id).toBe(id);
  expect(edited.past).toHaveLength(created.past.length + 1);
  expect(edited.project.volumes[2].position.x).toBeCloseTo(
    x + 0.37 * Math.cos((-23 * Math.PI) / 180),
    3,
  );
  expect(edited.project.volumes[2].position.z).toBeCloseTo(
    z + 0.37 * Math.sin((-23 * Math.PI) / 180),
    3,
  );
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
  );
  expect((await saved(page)).project).toEqual(edited.project);
  for (const project of [created.project, before.project]) {
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(async () => (await saved(page)).project).toEqual(project);
  }
  for (const project of [created.project, edited.project]) {
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect.poll(async () => (await saved(page)).project).toEqual(project);
  }
  const evidence = JSON.stringify(
    {
      mode: 'offline scripted provider; real Chromium, App and geometry engine',
      calls,
      reviews,
      rejectedCandidate: feedback,
      before: before.project,
      created: created.project,
      edited: edited.project,
      reload: true,
      undo: 2,
      redo: 2,
    },
    null,
    2,
  );
  const path = info.outputPath('derived-verification-browser.json');
  writeFileSync(path, evidence);
  await info.attach('derived-verification-browser', {
    path,
    contentType: 'application/json',
  });
});
