import { expect, test, type Page } from '@playwright/test';
import { criteria, measure } from './fixtures/completion';
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
async function ready(page: Page) {
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
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
  );
  await expect
    .poll(async () => (await saved(page))?.project?.volumes?.length)
    .toBe(2);
}
async function send(page: Page, text: string) {
  await page.getByRole('textbox', { name: 'Message Atelier' }).fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
}
const create = {
  intent: 'apply',
  message: 'Create the requested block',
  brief: null,
  planning: { stage: 'Model', assumptions: [], next: 'Inspect' },
  operations: [
    {
      type: 'create_at',
      shape: 'box',
      name: 'Travel study',
      width: 1.3,
      depth: 0.9,
      height: 1.7,
      x: 8,
      y: 0,
      z: 2,
      rotation: 0,
    },
  ],
};
const finish = {
  intent: 'finish',
  message: 'Done',
  operations: [],
  brief: null,
  planning: null,
};

test.describe('mobile workspace lifecycle with real geometry and offline provider', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test('orientation, keyboard-size changes and conversation controls preserve an executing transaction and camera', async ({
    page,
  }) => {
    test.setTimeout(90000);
    await ready(page);
    await page.waitForTimeout(600);
    const before = await saved(page),
      viewport = page.getByTestId('viewport');

    await viewport.locator('canvas').evaluate((c) => {
      (c as any).identityMarker = 'original-canvas';
    });
    let release!: () => void,
      pending = false;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/plan', async (r) => {
      if (!r.request().postDataJSON().execution?.receipts.length) {
        pending = true;
        await gate;
        return r.fulfill({ json: create });
      }
      return r.fulfill({ json: finish });
    });
    await page.route('**/api/completion-criteria', (r) =>
      r.fulfill({
        json: criteria([
          measure('count', 'count', 1),
          measure('height', 'height', 1.7),
        ]),
      }),
    );
    await send(
      page,
      'Create a small block and keep existing objects unchanged.',
    );
    await expect.poll(() => pending).toBe(true);
    let lastPose: string | null = null,
      stable = 0;
    await expect
      .poll(
        async () => {
          const next = await viewport.getAttribute('data-camera-position');
          stable = next === lastPose ? stable + 1 : 0;
          lastPose = next;
          return stable >= 3;
        },
        { intervals: [150, 200, 300] },
      )
      .toBe(true);
    const camera = lastPose;
    await page
      .getByRole('link', { name: 'ATELIER home' })
      .dispatchEvent('click');
    await expect(viewport).toBeVisible();
    for (const size of [
      { width: 844, height: 390 },
      { width: 390, height: 430 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await page.evaluate(() =>
        window.dispatchEvent(new Event('orientationchange')),
      );
      await expect(viewport).toBeVisible();
      await expect(viewport).toHaveAttribute('data-camera-position', camera!);
    }
    await page.getByRole('button', { name: 'Minimize conversation' }).click();
    await page.getByRole('button', { name: 'Voice orb' }).dblclick();
    expect(
      await viewport
        .locator('canvas')
        .evaluate((c) => (c as any).identityMarker),
    ).toBe('original-canvas');
    expect((await saved(page)).project).toEqual(before.project);
    release();
    await expect
      .poll(async () => (await saved(page)).project.volumes.length)
      .toBe(3);
    const after = await saved(page);
    expect(after.project.volumes.slice(0, 2)).toEqual(before.project.volumes);
    expect(after.past).toHaveLength(before.past.length + 1);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect
      .poll(async () => (await saved(page)).project)
      .toEqual(before.project);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect
      .poll(async () => (await saved(page)).project)
      .toEqual(after.project);
  });
  test('an interrupted request reloads into the same workspace, preserves conversation/history and accepts a new request', async ({
    page,
  }) => {
    test.setTimeout(90000);
    await ready(page);
    // The default welcome preference must not override an open tab's recovery.
    await page.evaluate(() => localStorage.removeItem('atelier.start-direct'));
    const before = await saved(page);
    let requested = false;
    await page.route('**/api/plan', async (r) => {
      requested = true;
      await new Promise<void>((resolve) => setTimeout(resolve, 1200));
      await r.abort().catch(() => {});
    });
    await send(page, 'Create a long-running study.');
    await expect.poll(() => requested).toBe(true);
    await page.reload();
    await expect(page.getByTestId('viewport')).toHaveAttribute(
      'data-model-objects',
      '2',
    );
    expect((await saved(page)).project).toEqual(before.project);
    const messages = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('atelier.conversation.v2') || '[]'),
    );
    expect(
      messages.some((m: any) => m.content.includes('long-running study')),
    ).toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem('atelier.conversation.v2')),
      )
      .toContain('previous request was interrupted');
    await page.unroute('**/api/plan');
    await page.route('**/api/plan', (r) =>
      r.fulfill({
        json: r.request().postDataJSON().execution?.receipts.length
          ? finish
          : create,
      }),
    );
    await page.route('**/api/completion-criteria', (r) =>
      r.fulfill({ json: criteria([measure('count', 'count', 1)]) }),
    );
    await send(page, 'Create a fresh small block.');
    await expect
      .poll(async () => (await saved(page)).project.volumes.length)
      .toBe(3);
    expect((await saved(page)).past).toHaveLength(before.past.length + 1);
    await page.screenshot({
      path: 'test-results/mobile-workspace-recovered.png',
    });
  });
});

test('desktop graphics recover in place, and zero-size / wide viewport transitions retain complete buffers', async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  const viewport = page.getByTestId('viewport'),
    before = await saved(page);
  await page.waitForTimeout(600);
  const position = await viewport.getAttribute('data-camera-position');
  for (const size of [
    { width: 1800, height: 750 },
    { width: 1024, height: 1000 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(size);
    await expect(viewport).toHaveAttribute('data-camera-position', position!);
    await expect
      .poll(() =>
        viewport.locator('canvas').evaluate((c: HTMLCanvasElement) => {
          const r = c.getBoundingClientRect(),
            gl = c.getContext('webgl2')!;
          return (
            c.width === Math.round(r.width * Math.min(devicePixelRatio, 2)) &&
            c.height === Math.round(r.height * Math.min(devicePixelRatio, 2)) &&
            gl.drawingBufferWidth === c.width &&
            gl.drawingBufferHeight === c.height
          );
        }),
      )
      .toBe(true);
  }
  await viewport.evaluate((v) => {
    v.style.display = 'none';
  });
  await page.waitForTimeout(100);
  await viewport.evaluate((v) => {
    v.style.display = '';
  });
  await expect(viewport).toHaveAttribute('data-camera-position', position!);
  const supported = await viewport
    .locator('canvas')
    .evaluate((c: HTMLCanvasElement) => {
      const ext = c.getContext('webgl2')?.getExtension('WEBGL_lose_context');
      if (!ext) return false;
      (window as any).graphicsExtension = ext;
      ext.loseContext();
      return true;
    });
  expect(supported).toBe(true);
  await expect(viewport).toHaveAttribute('data-graphics-state', 'lost');
  await page.evaluate(() => (window as any).graphicsExtension.restoreContext());
  await expect(viewport).toHaveAttribute('data-graphics-state', 'ready');
  await expect(viewport).toHaveAttribute('data-model-objects', '2');
  expect((await saved(page)).project).toEqual(before.project);
  await page.screenshot({
    path: 'test-results/desktop-graphics-recovered.png',
  });
});

test('conversation language defaults to English and persists only explicit preference changes', async ({
  page,
}) => {
  // Four complete turns plus a cold WebGL startup and reload. Each individual
  // readiness assertion keeps its normal bound; do not race the whole sequence
  // against the default single-interaction timeout on software-rendered CI.
  test.setTimeout(90000);
  await ready(page);
  const seen: string[] = [];
  await page.route('**/api/plan', (r) => {
    seen.push(r.request().postDataJSON().language);
    return r.fulfill({
      json: {
        intent: 'clarify',
        message: 'Discussing your design.',
        operations: [],
      },
    });
  });
  for (const [text, language] of [
    ['Try doble altura at the entry.', 'en'],
    ['Please respond in Spanish.', 'es'],
    ['Now discuss the facade.', 'es'],
    ['Please switch to English.', 'en'],
  ]) {
    const previousTurns = seen.length;
    await send(page, text);
    await expect.poll(() => seen.length).toBe(previousTurns + 1);
    await expect.poll(() => seen.at(-1)).toBe(language);
    await expect(
      page.getByRole('button', { name: 'Stop design request', exact: true }),
    ).not.toBeVisible();
  }
  await page.reload();
  await expect(page.getByLabel('Conversation language')).toHaveValue('en');
});

test('a verified modeling reply respects Spanish while keeping the geometric evidence', async ({
  page,
}) => {
  test.setTimeout(60000);
  await ready(page);
  await page.getByLabel('Conversation language').selectOption('es');
  await page.route('**/api/plan', (r) => {
    expect(r.request().postDataJSON().language).toBe('es');
    return r.fulfill({
      json: r.request().postDataJSON().execution?.receipts.length
        ? finish
        : create,
    });
  });
  await page.route('**/api/completion-criteria', (r) =>
    r.fulfill({ json: criteria([measure('count', 'count', 1)]) }),
  );
  await send(page, 'Create a small block.');
  await expect
    .poll(async () => (await saved(page)).project.volumes.length)
    .toBe(3);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('atelier.conversation.v2')!).at(-1)
            .summary,
      ),
    )
    .toContain('Completado');
});
