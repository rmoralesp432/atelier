import { expect, test } from '@playwright/test';
const saved = (page: import('@playwright/test').Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
test('building components can be reviewed, edited individually, persisted and restored', async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const source = {
    id: 'building',
    name: 'Test pavilion',
    dimensions: { width: 8, depth: 6, height: 4 },
    position: { x: 0, y: 1, z: 0 },
    rotation: 25,
  };
  const building = {
    ...source,
    geometry: {
      kind: 'building',
      source: { ...source, position: { x: 0, y: 0, z: 0 }, rotation: 0 },
      base: source.dimensions,
      floors: 1,
      slabThickness: 0.25,
      facade: true,
      panelWidth: 3,
      mullionWidth: 0.06,
    },
  };
  await page.getByLabel('Import project file').setInputFiles({
    name: 'building.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: 2,
        volumes: [building],
        selectedId: 'building',
      }),
    ),
  });
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '1',
  );
  await page.getByRole('button', { name: 'Edit selected dimensions' }).click();
  await page
    .getByRole('button', { name: 'Edit individual components' })
    .click();
  const review = page.getByRole('region', { name: 'Review geometry change' });
  await expect(review).toContainText('editable windows');
  expect((await saved(page)).project.volumes).toHaveLength(1);
  await page.getByRole('button', { name: 'Apply change', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).project.volumes.length)
    .toBeGreaterThan(10);
  const parts = (await saved(page)).project.volumes;
  const pane = parts.find((v: { material: string }) => v.material === 'glass');
  await page.getByRole('button', { name: 'Show objects', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Find objects' }).fill(pane.name);
  await page
    .getByRole('button', { name: new RegExp(pane.name + '\\s') })
    .click();
  const width = page.getByRole('spinbutton', { name: 'Width', exact: true });
  await width.fill(String(pane.dimensions.width + 0.2));
  await width.press('Enter');
  await expect
    .poll(
      async () =>
        (await saved(page)).project.volumes.find(
          (v: { id: string }) => v.id === pane.id,
        ).dimensions.width,
    )
    .toBeCloseTo(pane.dimensions.width + 0.2);
  expect(
    (await saved(page)).project.volumes.filter(
      (v: { id: string }) => v.id !== pane.id,
    ),
  ).toEqual(parts.filter((v: { id: string }) => v.id !== pane.id));
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    String(parts.length),
  );
  expect(
    (await saved(page)).project.volumes.find(
      (v: { id: string }) => v.id === pane.id,
    ).material,
  ).toBe('glass');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await saved(page)).project.volumes).toEqual([building]);
  expect(errors).toEqual([]);
});
