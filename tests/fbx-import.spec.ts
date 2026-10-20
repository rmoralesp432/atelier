import { expect, test, type Page } from '@playwright/test';
import { asciiAssembly } from './fixtures/fbx/assembly';
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));

test('real Revit FBX imports separate walls in meters, edits, reloads and undoes as one import', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  const before = (await saved(page)).project;
  await page
    .getByLabel('Import project file')
    .setInputFiles('tests/fixtures/fbx/revit-wall.fbx');
  const dialog = page.getByRole('dialog', { name: 'Import 3D element' });
  await expect(dialog).toContainText('6 editable elements · 4 closed solids');
  await expect(dialog).toContainText('8.855 × 5.29 × 12.4 m');
  await expect(dialog.getByLabel('File units')).toHaveValue('source');
  await dialog.getByRole('button', { name: 'Add to workspace' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '8',
  );
  const added = await saved(page);
  expect(added.project.volumes.slice(0, 2)).toEqual(before.volumes);
  expect(added.project.groups).toHaveLength(1);
  expect(added.project.selectedIds).toHaveLength(6);
  expect(added.project.volumes[2].name).toContain('[320878]');
  expect(added.project.volumes[2].dimensions.height).toBeCloseTo(8);
  await page.getByRole('button', { name: 'Show objects', exact: true }).click();
  await page.locator('.object-row').filter({ hasText: '[320878]' }).click();
  await page.getByRole('button', { name: 'Edit selected dimensions' }).click();
  const height = page.getByRole('spinbutton', { name: 'Height', exact: true });
  await height.fill('9');
  await height.press('Enter');
  await expect
    .poll(async () => (await saved(page)).project.volumes[2].dimensions.height)
    .toBe(9);
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '8',
  );
  await expect(height).toHaveValue('9');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project.volumes[2].dimensions.height)
    .toBeCloseTo(8);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  expect((await saved(page)).project).toEqual(before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '8',
  );
  await page.screenshot({ path: 'test-results/atelier-revit-fbx.png' });
  expect(errors).toEqual([]);
});

test('mobile FBX preview preserves colors and lets users combine an assembly without requesting textures', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  const requested: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('example.invalid')) requested.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await page.getByLabel('Import project file').setInputFiles({
    name: 'Colored assembly.fbx',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(asciiAssembly()),
  });
  const dialog = page.getByRole('dialog', { name: 'Import 3D element' });
  await expect(dialog).toContainText('2 editable elements');
  await expect(dialog).toContainText('4 × 8 × 6 m');
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await dialog.getByLabel('Keep elements separate and grouped').uncheck();
  await expect(dialog).toContainText('Closed solid');
  await dialog.getByLabel('Keep elements separate and grouped').check();
  await expect(dialog).toContainText('2 editable elements');
  await dialog.getByRole('button', { name: 'Add to workspace' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '4',
  );
  const state = await saved(page);
  expect(state.project.volumes.slice(2).map((v: any) => v.color)).toEqual([
    '#ff0000',
    '#0000ff',
  ]);
  expect(
    state.project.volumes[3].position.y - state.project.volumes[2].position.y,
  ).toBeCloseTo(3);
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '4',
  );
  expect((await saved(page)).project).toEqual(state.project);
  expect(requested).toEqual([]);
});

test('a file above 10 MB and 20,000 triangles imports, renders, saves and reopens', async ({
  page,
}) => {
  test.setTimeout(120000);
  const size = 105,
    rows: string[] = [];
  for (let z = 0; z <= size; z++)
    for (let x = 0; x <= size; x++) rows.push(`v ${x} 0 ${z}`);
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) {
      const i = z * (size + 1) + x + 1;
      rows.push(
        `f ${i} ${i + 1} ${i + size + 2}`,
        `f ${i} ${i + size + 2} ${i + size + 1}`,
      );
    }
  // The comment padding tests the independent file-byte gate. The real tiled
  // facade itself exceeds the previous geometry gate (22,050 triangles).
  const buffer = Buffer.from(
    rows.join('\n') + '\n#' + '.'.repeat(10_100_000) + '\n',
  );
  expect(buffer.byteLength).toBeGreaterThan(10_000_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await page.getByLabel('Import project file').setInputFiles({
    name: 'Large facade.obj',
    mimeType: 'text/plain',
    buffer,
  });
  const dialog = page.getByRole('dialog', { name: 'Import 3D element' });
  await expect(dialog).toContainText('22,050 triangles');
  await expect(dialog).toContainText('Reference surface');
  await dialog.getByRole('button', { name: 'Add to workspace' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
    { timeout: 30000 },
  );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
  const before = await saved(page);
  expect(before.project.volumes[2].geometry.indices).toHaveLength(66150);
  expect(before.project.volumes[2].dimensions.width).toBe(105);
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
    { timeout: 30000 },
  );
  expect((await saved(page)).project).toEqual(before.project);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
});
