import { expect, test, type Page } from '@playwright/test';
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
async function ready(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
    { timeout: 20000 },
  );
}
test('calm desktop and phone surfaces retain draft, theme, geometry and reachable menu controls', async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  const before = (await saved(page)).project;
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-theme',
    'day',
  );
  await page.screenshot({ path: 'test-results/refined-desktop-day.png' });
  const input = page.getByRole('textbox', { name: 'Message Atelier' });
  await input.fill('A courtyard with a floating roof');
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  await expect(input).toBeHidden();
  await page
    .getByRole('button', { name: 'Open conversation', exact: true })
    .click();
  await expect(input).toHaveValue('A courtyard with a floating roof');
  await page
    .getByRole('button', { name: 'Switch to Night', exact: true })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-theme',
    'night',
  );
  await page.screenshot({ path: 'test-results/refined-desktop-night.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await input.fill('');
  await page
    .getByRole('button', { name: 'Switch to Day', exact: true })
    .click();
  await page.screenshot({ path: 'test-results/refined-phone-composer.png' });
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  await expect(input).toBeHidden();
  await page.screenshot({ path: 'test-results/refined-phone-canvas.png' });
  await page.getByRole('button', { name: 'Design tools', exact: true }).click();
  const menu = page.getByRole('region', { name: 'Design tools menu' });
  await expect(menu.getByText('Inspiration', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/refined-phone-tools.png' });
  const box = (await menu.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  await page.getByRole('button', { name: 'Close tools', exact: true }).click();
  await page
    .getByRole('button', { name: 'Create a 3D shape', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Create and transform', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Explore design', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Create and transform', exact: true }),
  ).toBeHidden();
  await page
    .getByRole('button', { name: 'Close explore', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Open conversation', exact: true })
    .click();
  await expect(input).toBeVisible();
  expect((await saved(page)).project).toEqual(before);
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-theme',
    'day',
  );
});
test('phone hold opens actions, deletion is undoable, double tap focuses, and drags do not open actions', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem(
      'atelier.project.v1',
      JSON.stringify({
        version: 2,
        volumes: [
          {
            id: 'box',
            name: 'Garden pavilion',
            dimensions: { width: 8, depth: 6, height: 4 },
            position: { x: 0, y: 0, z: 0 },
            rotation: 0,
          },
        ],
        selectedId: null,
        selectedIds: [],
      }),
    ),
  );
  await ready(page);
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  });
  const canvas = (await page.locator('canvas').first().boundingBox())!;
  const x = canvas.x + canvas.width / 2,
    y = canvas.y + canvas.height / 2;
  const touch = async (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    points: { x: number; y: number; id: number }[],
  ) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p) => ({
        ...p,
        radiusX: 6,
        radiusY: 6,
        force: 1,
      })),
    });
  const hold = async () => {
    await touch('touchStart', [{ x, y, id: 1 }]);
    await page.waitForTimeout(650);
    await touch('touchEnd', []);
  };
  await hold();
  const actions = page.getByRole('dialog', { name: 'Selected object actions' });
  await expect(actions).toBeVisible();
  await page.screenshot({ path: 'test-results/refined-phone-actions.png' });
  await actions
    .getByRole('button', { name: 'Delete selection', exact: true })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '0',
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '1',
  );
  await page.waitForTimeout(400);
  // Preserve a real double-tap interval even when software WebGL delays CDP replies.
  const timestamp = Date.now() / 1000;
  for (let i = 0; i < 2; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      timestamp: timestamp + i * 0.16,
      touchPoints: [{ x, y, id: 2, radiusX: 6, radiusY: 6, force: 1 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      timestamp: timestamp + i * 0.16 + 0.04,
      touchPoints: [],
    });
  }
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-saved-view',
    'Garden pavilion',
  );
  await expect(actions).toBeHidden();
  const emptyTime = Date.now() / 1000;
  for (let i = 0; i < 2; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      timestamp: emptyTime + i * 0.16,
      touchPoints: [
        {
          x: canvas.x + canvas.width - 12,
          y: canvas.y + canvas.height * 0.3,
          id: 4,
          radiusX: 6,
          radiusY: 6,
          force: 1,
        },
      ],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      timestamp: emptyTime + i * 0.16 + 0.04,
      touchPoints: [],
    });
  }
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-saved-view',
    '',
  );
  await touch('touchStart', [{ x, y, id: 3 }]);
  await touch('touchMove', [{ x: x + 50, y: y + 20, id: 3 }]);
  await page.waitForTimeout(650);
  await touch('touchEnd', []);
  await expect(actions).toBeHidden();
  expect((await saved(page)).project.volumes[0].dimensions).toEqual({
    width: 8,
    depth: 6,
    height: 4,
  });
});
test('exploded assembly guides, axonometric camera, component interaction and reassembly preserve the model', async ({
  page,
}) => {
  test.setTimeout(120000);
  await ready(page);
  await page
    .getByRole('button', { name: 'Explore an editable sample house' })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '134',
    { timeout: 30000 },
  );
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  const original = (await saved(page)).project.volumes;
  await page
    .getByRole('button', { name: 'Explore design', exact: true })
    .click();
  const panel = page.getByRole('region', {
    name: 'Explore design',
    exact: true,
  });
  await panel
    .getByRole('button', { name: 'Separate parts', exact: true })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-exploration-guides',
    'true',
  );
  await panel
    .getByRole('button', { name: 'Axonometric view', exact: true })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-projection',
    'OrthographicCamera',
  );
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-exploration-animating',
    'false',
  );
  await page.screenshot({
    path: 'test-results/refined-exploded-axonometric.png',
  });
  await panel.getByLabel('Assembly guides').uncheck();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-exploration-guides',
    'false',
  );
  await panel.getByRole('button', { name: 'Reassemble', exact: true }).click();
  await panel
    .locator('summary')
    .filter({ hasText: 'Doors & movable parts' })
    .click();
  const door = panel.getByRole('button', { name: /^Open .*door/i }).first();
  await expect(door).toBeVisible();
  const name = (await door.getAttribute('aria-label'))!.slice(5);
  await door.click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-exploration',
    'open',
  );
  await panel
    .getByRole('button', { name: `Close ${name}`, exact: true })
    .click();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-exploration',
    'assembled',
  );
  expect((await saved(page)).project.volumes).toEqual(original);
});
