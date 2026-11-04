import { test, expect, type Page } from '@playwright/test';
import type { Assembly } from '../src/intelligence/architectureSchema';

const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
const query = {
  type: 'select_query',
  scope: ['$group:Courtyard gallery'],
  role: 'column',
  level: null,
  material: null,
  nameContains: null,
  visible: null,
};
const member = (
  patch: Partial<Assembly['elements'][number]>,
): Assembly['elements'][number] => ({
  key: 'slabs',
  name: 'Occupied slab',
  shape: 'box',
  dimensions: { width: 14, depth: 8, height: 0.2 },
  position: { x: 0, y: 0, z: 0 },
  rotation: 0,
  role: 'floor',
  level: null,
  material: 'solid',
  color: '#ded6c8',
  host: null,
  repeat: null,
  ...patch,
});

test('editable assembly survives staged checks, scoped column edits, undo and reload without changing neighbors (provider fixture)', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, authenticated: true, voiceConfigured: false },
    }),
  );
  let turn = 0;
  await page.route('**/api/plan', (r) => {
    const body = r.request().postDataJSON();
    turn++;
    if (turn === 1)
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Developing an editable gallery.',
          planning: {
            stage: 'Structure and enclosure',
            next: 'Check the actual members',
            assumptions: ['Framing is conceptual.'],
          },
          operations: [
            {
              type: 'assembly',
              name: 'Courtyard gallery',
              origin: { x: 30, y: 0, z: 0 },
              rotation: 0,
              elements: [
                member({
                  repeat: { x: 1, y: 2, z: 1, step: { x: 0, y: 3.2, z: 0 } },
                }),
                member({
                  key: 'roof',
                  name: 'Roof slab',
                  role: 'roof',
                  position: { x: 0, y: 6.2, z: 0 },
                }),
                member({
                  key: 'columns',
                  name: 'Circular column',
                  role: 'column',
                  shape: 'cylinder',
                  dimensions: { width: 0.3, depth: 0.3, height: 6 },
                  position: { x: -6.8, y: 0.2, z: -3.8 },
                  repeat: { x: 3, y: 1, z: 2, step: { x: 6.8, y: 0, z: 7.6 } },
                }),
                member({
                  key: 'glass',
                  name: 'Glazing',
                  role: 'window',
                  material: 'glass',
                  color: '#b9dce2',
                  dimensions: { width: 14, depth: 0.012, height: 6 },
                  position: { x: 0, y: 0.2, z: -4 },
                  repeat: { x: 1, y: 1, z: 2, step: { x: 0, y: 0, z: 8 } },
                }),
              ],
            },
          ],
        },
      });
    if (turn === 2) {
      expect(body.execution.receipts[0].created).toHaveLength(11);
      expect(
        body.scene.objects.filter((v: any) => v.component?.role === 'column'),
      ).toHaveLength(6);
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Six circular columns checked.',
          planning: null,
          operations: [
            query,
            {
              type: 'verify',
              targets: ['$selected'],
              metric: 'count',
              comparison: 'equal',
              value: 6,
              tolerance: 0,
            },
            {
              type: 'verify',
              targets: ['$selected'],
              metric: 'width',
              comparison: 'equal',
              value: 0.3,
              tolerance: 0.001,
            },
          ],
        },
      });
    }
    return r.fulfill({
      json: {
        intent: 'apply',
        message: 'Only the gallery columns are wider.',
        planning: null,
        operations: [
          query,
          {
            type: 'resize',
            targets: ['$selected'],
            axis: 'width',
            mode: 'set',
            value: 0.45,
          },
          {
            type: 'resize',
            targets: ['$selected'],
            axis: 'depth',
            mode: 'set',
            value: 0.45,
          },
        ],
      },
    });
  });
  await page.goto('/');
  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-model-objects', '2');
  const original = await saved(page);
  const say = async (text: string) => {
    await page.getByRole('textbox', { name: 'Message Atelier' }).fill(text);
    await page
      .getByRole('button', { name: 'Send message', exact: true })
      .click();
  };
  await say(
    'Develop a two-level gallery with independent floors, roof, glazing and round columns.',
  );
  await expect(viewport).toHaveAttribute('data-model-objects', '13');
  await expect(page.getByRole('log')).toContainText(
    'Six circular columns checked.',
  );
  const built = await saved(page);
  expect(built.past).toHaveLength(original.past.length + 1);
  expect(
    built.project.volumes.filter((v: any) => v.component?.role === 'floor'),
  ).toHaveLength(2);
  expect(
    built.project.volumes.filter((v: any) => v.component?.role === 'roof'),
  ).toHaveLength(1);
  expect(
    built.project.volumes.filter((v: any) => v.material === 'glass'),
  ).toHaveLength(2);
  await say('Make only the columns in Courtyard gallery 45 cm in diameter.');
  await expect(page.getByRole('log')).toContainText(
    'Only the gallery columns are wider.',
  );
  const edited = await saved(page);
  for (const v of built.project.volumes) {
    const after = edited.project.volumes.find((next: any) => next.id === v.id);
    if (v.component?.role === 'column') {
      expect(after.dimensions).toEqual({ width: 0.45, depth: 0.45, height: 6 });
      expect(after.geometry.kind).toBe('cylinder');
    } else expect(after).toEqual(v);
  }
  await page.screenshot({ path: 'test-results/editable-gallery-assembly.png' });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project.volumes)
    .toEqual(built.project.volumes);
  await page.reload();
  await expect(viewport).toHaveAttribute('data-model-objects', '13');
  expect((await saved(page)).project.groups).toEqual(built.project.groups);
  expect(errors).toEqual([]);
});
