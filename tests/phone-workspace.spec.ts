import { test, expect, type Page } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
async function ready(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
}

test('phone dock creates editable solids, switches sheets, retains drafts and survives rotation, reload and Undo/Redo', async ({
  page,
}) => {
  test.setTimeout(120000);
  await ready(page);
  const starting = await saved(page);
  const message = page.getByRole('textbox', { name: 'Message Atelier' });
  await message.fill('Keep this unsent design idea');
  const dock = page.getByRole('navigation', { name: 'Workspace actions' });
  await dock.getByRole('button', { name: 'Hide chat', exact: true }).tap();
  await dock
    .getByRole('button', { name: 'Create a 3D shape', exact: true })
    .tap();
  const create = page.getByRole('region', {
    name: 'Create and transform',
    exact: true,
  });
  await expect(create).toBeVisible();
  const d = (await dock.boundingBox())!,
    sheet = (await create.boundingBox())!;
  expect(sheet.y + sheet.height).toBeLessThan(d.y);
  await create.getByRole('button', { name: 'Cylinder', exact: true }).tap();
  await create.getByLabel('Solid width').fill('1.2');
  await create.getByLabel('Solid height').fill('2.4');
  await create
    .getByRole('button', { name: 'Create 3D shape', exact: true })
    .tap();
  await expect
    .poll(async () => (await saved(page)).project.volumes.length)
    .toBe(starting.project.volumes.length + 1);
  const edited = await saved(page);
  expect(edited.project.volumes.at(-1).dimensions).toEqual({
    width: 1.2,
    depth: 1.2,
    height: 2.4,
  });
  for (const original of starting.project.volumes)
    expect(
      edited.project.volumes.find((v: any) => v.id === original.id),
    ).toEqual(original);
  await dock.getByRole('button', { name: 'Show objects', exact: true }).tap();
  await expect(create).toBeHidden();
  await expect(
    page.getByRole('heading', { name: /Scene objects/ }),
  ).toBeVisible();
  await dock.getByRole('button', { name: 'Open chat', exact: true }).tap();
  await expect(message).toHaveValue('Keep this unsent design idea');
  await dock.getByRole('button', { name: 'Hide chat', exact: true }).tap();
  await dock.getByRole('button', { name: 'Design tools', exact: true }).tap();
  await expect(
    page.getByRole('region', { name: 'Design tools menu' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close tools', exact: true }).tap();
  for (const size of [
    { width: 844, height: 390 },
    { width: 320, height: 568 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await expect(dock).toBeVisible();
    const bounds = (await dock.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(size.height);
    for (const button of await dock.getByRole('button').all()) {
      const r = (await button.boundingBox())!;
      expect(r.width).toBeGreaterThanOrEqual(44);
      expect(r.height).toBeGreaterThanOrEqual(44);
    }
    expect((await saved(page)).project.volumes).toEqual(edited.project.volumes);
  }
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-rendered',
    'true',
  );
  expect((await saved(page)).project.volumes).toEqual(edited.project.volumes);
  await page
    .getByRole('button', { name: 'Minimize conversation', exact: true })
    .tap();
  await page.getByRole('button', { name: 'Undo', exact: true }).tap();
  await expect
    .poll(async () => (await saved(page)).project.volumes)
    .toEqual(starting.project.volumes);
  await page.getByRole('button', { name: 'Redo', exact: true }).tap();
  await expect
    .poll(async () => (await saved(page)).project.volumes)
    .toEqual(edited.project.volumes);
  await page.screenshot({ path: 'test-results/iphone-dock.png' });
});

test('Safari-style keyboard viewport keeps the composer visible without changing geometry or capture state', async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  const original = await saved(page);
  const message = page.getByRole('textbox', { name: 'Message Atelier' });
  await message.fill('An idea kept while the keyboard changes');
  // Synthetic visual-viewport metrics, not a physical iPhone keyboard test.
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, 'height', {
      configurable: true,
      get: () => 430,
    });
    visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('html')).toHaveAttribute('data-phone-keyboard', '');
  await expect(
    page.getByRole('navigation', { name: 'Workspace actions' }),
  ).toBeHidden();
  const composer = page.locator('.conversation-composer');
  const r = (await composer.boundingBox())!;
  expect(r.y).toBeGreaterThanOrEqual(0);
  expect(r.y + r.height).toBeLessThanOrEqual(430);
  expect((await saved(page)).project).toEqual(original.project);
  await page.screenshot({ path: 'test-results/iphone-keyboard-metrics.png' });
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, 'scale', {
      configurable: true,
      get: () => 1.5,
    });
    visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('html')).not.toHaveAttribute('data-phone-keyboard');
  expect(
    await page
      .locator('html')
      .evaluate((el) => el.style.getPropertyValue('--phone-keyboard-lift')),
  ).toBe('0px');
  await page.evaluate(() => {
    delete (visualViewport as any).height;
    delete (visualViewport as any).scale;
    (document.activeElement as HTMLElement)?.blur();
    visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(
    page.getByRole('navigation', { name: 'Workspace actions' }),
  ).toBeVisible();
  await expect(message).toHaveValue('An idea kept while the keyboard changes');
  expect((await saved(page)).project).toEqual(original.project);
  expect((await saved(page)).past).toEqual(original.past);
});

test('phone entrance and idle glass reflections animate with a still reduced-motion alternative', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.addInitScript(() =>
    localStorage.removeItem('atelier.start-direct'),
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const orb = page.locator('.orb-large');
  await expect(orb).toBeVisible();
  const light = () =>
    orb
      .locator('.orb-reflections')
      .evaluate((el) => getComputedStyle(el).transform);
  const initial = await light();
  await expect.poll(light).not.toBe(initial);
  await expect(orb).toHaveAttribute('data-state', 'idle');
  await page.screenshot({ path: 'test-results/iphone-welcome.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(light).toBe('none');
  await expect
    .poll(() =>
      orb
        .locator('svg.orb-core')
        .evaluate((el) => (el as SVGSVGElement).animationsPaused()),
    )
    .toBe(true);
  await page
    .getByRole('button', { name: 'Continue without AI', exact: true })
    .tap();
  await page.screenshot({ path: 'test-results/iphone-projects.png' });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
