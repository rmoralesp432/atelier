import { test, expect, type Page } from '@playwright/test';
import * as THREE from 'three';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { sampleGlb } from './fixtures/mesh';

const cube = () => new THREE.Mesh(new THREE.BoxGeometry(2, 3, 4));
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
async function upload(page: Page, name: string, buffer: Buffer) {
  await page
    .getByLabel('Import project file')
    .setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
  return page.getByRole('dialog', { name: 'Import 3D element' });
}

test('OBJ adds a closed solid beside existing objects; import, scale, save and undo preserve projects', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  const before = (await saved(page)).project.volumes;
  const dialog = await upload(
    page,
    'Pavilion.obj',
    Buffer.from(new OBJExporter().parse(cube())),
  );
  await expect(dialog).toContainText('Closed solid');
  await expect(dialog).toContainText('2 × 4 × 3 m');
  await page.screenshot({ path: 'test-results/atelier-import.png' });
  await dialog.getByRole('button', { name: 'Add to workspace' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
  );
  const next = (await saved(page)).project.volumes;
  expect(next.slice(0, 2)).toEqual(before);
  expect(next[2].position.x - next[2].dimensions.width / 2).toBeGreaterThan(9);
  await page.getByRole('button', { name: 'Expand inspector' }).click();
  await expect(page.getByTestId('volume-stat')).toHaveText('24 m³');
  const width = page.getByRole('spinbutton', { name: 'Width', exact: true });
  await width.fill('4');
  await width.press('Enter');
  await expect(page.getByTestId('volume-stat')).toHaveText('48 m³');
  await page.reload();
  await expect(width).toHaveValue('4');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-construction-active',
    'false',
    { timeout: 20000 },
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(width).toHaveValue('2');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  expect((await saved(page)).project.volumes).toEqual(before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByTestId('volume-stat')).toHaveText('24 m³');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-construction-active',
    'false',
    { timeout: 20000 },
  );
  expect(errors).toEqual([]);
});

test('binary STL units and GLB geometry load in the real browser; bad files are atomic', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  const bytes = new STLExporter().parse(cube(), { binary: true });
  let dialog = await upload(page, 'Model.stl', Buffer.from(bytes.buffer));
  await dialog.getByLabel('File units').selectOption('cm');
  await expect(dialog).toContainText('0.02 × 0.03 × 0.04 m');
  await dialog.getByRole('button', { name: 'Add to workspace' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
  );
  dialog = await upload(page, 'Library.glb', Buffer.from(sampleGlb()));
  await expect(dialog).toContainText('Closed solid');
  await dialog.getByRole('button', { name: 'Add to workspace' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '4',
  );
  const original = (await saved(page)).project;
  await upload(page, 'external.glb', Buffer.from(sampleGlb(true)));
  await expect(page.getByRole('alert')).toContainText('self-contained');
  expect((await saved(page)).project).toEqual(original);
  await upload(page, 'bad.obj', Buffer.from('# no triangles'));
  await expect(page.getByRole('alert')).toContainText('No triangle surfaces');
  expect((await saved(page)).project).toEqual(original);
});

test('open meshes are honest reference surfaces, and import is accessible on narrow screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const dialog = await upload(
    page,
    'Panel.obj',
    Buffer.from('v 0 0 0\nv 2 0 0\nv 0 3 0\nf 1 2 3\n'),
  );
  await expect(dialog).toContainText('Reference surface');
  const bounds = (await dialog.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await dialog.getByRole('button', { name: 'Add to workspace' }).click();
  await page.getByRole('button', { name: 'Design tools', exact: true }).click();
  await page.getByRole('button', { name: 'Expand inspector' }).click();
  await expect(page.getByTestId('volume-stat')).toHaveText('Reference');
  const x = page.getByRole('spinbutton', { name: 'X', exact: true });
  await x.fill('15');
  await x.press('Enter');
  await page.reload();
  await expect(x).toHaveValue('15');
  await expect(page.locator('.webgl-error')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Cut opening', exact: true }),
  ).toHaveCount(0);
});

test('construction is visual only; footprint rises, settles, and never replays on undo or reload', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Show objects' }).click();
  await page.getByText('Manual tools', { exact: true }).click();
  // Observe every animation frame; no arbitrary screenshot timing assertion.
  await page.evaluate(() => {
    const phases: string[] = [];
    (window as any).observedPhases = phases;
    const host = document.querySelector('[data-testid="viewport"]')!;
    new MutationObserver(() => {
      const phase = host.getAttribute('data-construction-phase');
      if (phase && !phases.includes(phase)) phases.push(phase);
    }).observe(host, {
      attributes: true,
      attributeFilter: ['data-construction-phase'],
    });
  });
  await page
    .getByRole('button', { name: 'Create volume', exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).observedPhases), {
      timeout: 20000,
    })
    .toContain('extruding');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-construction-active',
    'false',
    { timeout: 20000 },
  );
  const phases = await page.evaluate(() => (window as any).observedPhases);
  expect(phases).toContain('footprint');
  expect(phases).toContain('complete');
  const finished = await saved(page);
  expect(finished.project.volumes.at(-1).dimensions.height).toBe(6);
  expect(finished.past).toHaveLength(1);
  await page.getByRole('button', { name: 'Hide objects' }).click();
  const brightness = () =>
    page.evaluate(
      () =>
        new Promise<number>((resolve) =>
          requestAnimationFrame(() => {
            const source = document.querySelector('canvas')!;
            const sample = document.createElement('canvas');
            sample.width = sample.height = 100;
            const ctx = sample.getContext('2d')!;
            ctx.drawImage(
              source,
              source.width / 2 - 50,
              source.height / 2 - 50,
              100,
              100,
              0,
              0,
              100,
              100,
            );
            const pixels = ctx.getImageData(0, 0, 100, 100).data;
            let total = 0;
            for (let i = 0; i < pixels.length; i += 4)
              total += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
            resolve(total / 10000);
          }),
        ),
    );
  const studioBrightness = await brightness();
  expect(studioBrightness).toBeGreaterThan(100);
  await page
    .getByRole('button', { name: 'Studio appearance and location' })
    .click();
  await page.getByRole('button', { name: 'Wireframe', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Wireframe', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect((await saved(page)).project).toEqual(finished.project);
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-render-mode',
    'wireframe',
  );
  await page.waitForTimeout(500);
  expect(await brightness()).toBeLessThan(studioBrightness * 0.6);
  await page.screenshot({ path: 'test-results/atelier-outline.png' });
  await page.getByRole('button', { name: 'Solid', exact: true }).click();
  await page.getByRole('button', { name: 'Close studio settings' }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-construction-active',
    'false',
    { timeout: 20000 },
  );
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-construction-active',
    'false',
    { timeout: 20000 },
  );
  await page.screenshot({ path: 'test-results/atelier-studio.png' });
});

test('reduced motion shows the final geometry immediately and dropping files opens import', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Show objects' }).click();
  await page.getByText('Manual tools', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Create volume', exact: true })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
  );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-construction-active',
    'false',
    { timeout: 20000 },
  );
  await page.evaluate(() => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File(['v 0 0 0\nv 2 0 0\nv 0 3 0\nf 1 2 3\n'], 'Drop.obj'),
    );
    document
      .querySelector('.app-shell')!
      .dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }));
  });
  await expect(
    page.getByRole('dialog', { name: 'Import 3D element' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel import' }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '3',
  );
});

test('import refuses an oversized history-bearing save without changing the existing session', async ({
  page,
}) => {
  const volume = {
    id: 'kept',
    name: 'Existing pavilion',
    dimensions: { width: 8, depth: 6, height: 4 },
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
  };
  const project = { volumes: [volume], selectedId: 'kept' };
  const previous = {
    volumes: Array.from({ length: 200 }, (_, i) => ({
      ...volume,
      id: `previous-${i}-`.padEnd(80, 'x'),
      name: 'A'.repeat(70),
    })),
    selectedId: null,
  };
  const session = {
    version: 2,
    project,
    past: [] as (typeof previous)[],
    future: [],
    context: {
      focusIds: [],
      lastCreatedIds: [],
      lastOperands: [],
      lastOperation: null,
    },
  };
  while (JSON.stringify(session).length < 2_010_000)
    session.past.push(previous);
  expect(session.past.length).toBeLessThanOrEqual(50);
  await page.addInitScript(
    (data) => localStorage.setItem('atelier.session.v2', data),
    JSON.stringify(session),
  );
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '1',
  );
  const before = await saved(page);
  const dialog = await upload(
    page,
    'Too much.obj',
    Buffer.from(new OBJExporter().parse(cube())),
  );
  await expect(dialog).toContainText('Closed solid');
  await dialog.getByRole('button', { name: 'Add to workspace' }).click();
  await expect(dialog.getByRole('alert')).toContainText('safe browser storage');
  expect(await saved(page)).toEqual(before);
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '1',
  );
});
