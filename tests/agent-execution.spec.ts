import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('opens the retained live-generated chair as editable geometry and frames its actual scale', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Open project copy', exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel('Open project copy file')
    .setInputFiles(
      'docs/evaluations/2026-11-12-agent/Reading-chair.atelier.json',
    );
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 30000 });
  const view = page.getByTestId('viewport');
  await expect(view).toHaveAttribute('data-model-objects', '4', {
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Frame all', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await view.getAttribute('data-camera-goal-distance')),
    )
    .toBeLessThan(4);
  await expect
    .poll(async () => Number(await view.getAttribute('data-camera-distance')))
    .toBeLessThan(4);
  const project = await page.evaluate(
    () => JSON.parse(localStorage.getItem('atelier.session.v2')!).project,
  );
  expect(project.volumes).toHaveLength(4);
  expect(new Set(project.volumes.map((v: any) => v.id)).size).toBe(4);
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  await page.screenshot({ path: 'test-results/agent-chair-workspace.png' });
});

test('agent keeps provisional arrays private, recovers invalid arguments, verifies, then supports follow-up edits (offline provider)', async ({
  page,
}) => {
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
  let calls = 0;
  const ids: string[] = [];
  let initialImage = '';
  let arrayImage = '';
  await page.route('**/api/plan', async (r) => {
    const b = r.request().postDataJSON();
    calls++;
    expect(b.observation.status).toBe('ready');
    expect(b.observation.views).toHaveLength(2);
    expect(b.observation.objectIds.length).toBe(b.scene.objects.length);
    const image = b.observation.views[0].image;
    expect(image).toMatch(/^data:image\/jpeg;base64,/);
    if (calls === 1) initialImage = image;
    if (calls === 2) {
      arrayImage = image;
      expect(image).not.toBe(initialImage);
      writeFileSync(
        'test-results/agent-observation.jpg',
        Buffer.from(image.split(',')[1], 'base64'),
      );
      await expect(page.getByTestId('viewport')).toHaveAttribute(
        'data-model-objects',
        '146',
      );
      expect(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('atelier.session.v2')!).project
              .volumes.length,
        ),
      ).toBe(2);
    }
    if (calls === 3 || calls === 4) expect(image).toBe(arrayImage);
    if (calls === 1)
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Construct repeated volumes',
          brief: null,
          planning: { stage: 'Array', assumptions: [], next: 'Inspect' },
          operations: [
            {
              type: 'create_at',
              name: 'Array study',
              shape: 'box',
              width: 3,
              depth: 3,
              height: 3,
              x: 20,
              y: 0,
              z: 20,
              rotation: 0,
            },
            {
              type: 'array_grid',
              targets: ['$created'],
              rows: 12,
              columns: 12,
              spacingX: 6,
              spacingZ: 6,
            },
          ],
        },
      });
    const parts = b.scene.objects.filter((o: any) =>
      o.name.startsWith('Array study'),
    );
    expect(parts).toHaveLength(144);
    if (calls === 2) {
      ids.push(...parts.map((o: any) => o.id));
      return r.fulfill({
        status: 422,
        json: {
          code: 'invalid_plan',
          error: 'operations.0.targets: expected actual scene IDs',
        },
      });
    }
    if (calls === 3) {
      expect(b.validationFeedback.error).toContain('targets');
      expect(parts.map((o: any) => o.id)).toEqual(ids);
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Measure the array',
          brief: null,
          planning: { stage: 'Verification', assumptions: [], next: 'Inspect' },
          operations: [
            {
              type: 'verify',
              targets: ids,
              metric: 'count',
              comparison: 'equal',
              value: 144,
              tolerance: 0,
            },
          ],
        },
      });
    }
    if (calls === 5)
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Raise the array',
          brief: null,
          planning: { stage: 'Raise', assumptions: [], next: 'Inspect' },
          operations: [
            { type: 'move', targets: ids, direction: 'up', distance: 2 },
          ],
        },
      });
    if (calls === 6)
      expect(parts.every((o: any) => o.position.y === 2)).toBe(true);
    return r.fulfill({
      json: {
        intent: 'finish',
        message: 'Measured result complete',
        operations: [],
        brief: null,
        planning: null,
      },
    });
  });
  await page.goto('/');
  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-model-objects', '2');
  const input = page.getByRole('textbox', { name: 'Message Atelier' });
  await input.fill(
    'Create a twelve by twelve arrangement of three-metre cubes.',
  );
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(viewport).toHaveAttribute('data-model-objects', '146', {
    timeout: 60000,
  });
  await expect.poll(() => calls, { timeout: 30000 }).toBe(4);
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('atelier.session.v2')!).project
              .volumes.length,
        ),
      { timeout: 30000 },
    )
    .toBe(146);
  await input.fill('Raise that whole arrangement two metres.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => calls, { timeout: 30000 }).toBe(6);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('atelier.session.v2')!);
        return s.project.volumes.filter(
          (v: any) => v.name.startsWith('Array study') && v.position.y === 2,
        ).length;
      }),
    )
    .toBe(144);
  await page.screenshot({ path: 'test-results/agent-array-verified.png' });
});

test('shows provisional geometry while working and restores the saved design on Stop', async ({
  page,
}) => {
  test.setTimeout(90000);
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
  let calls = 0;
  let pending: import('@playwright/test').Route | undefined;
  await page.route('**/api/plan', (r) => {
    if (++calls > 1) {
      pending = r;
      return;
    }
    return r.fulfill({
      json: {
        intent: 'apply',
        message: 'Building the study',
        brief: null,
        planning: { stage: 'First piece', assumptions: [], next: 'Inspect' },
        operations: [
          {
            type: 'create_at',
            name: 'Working piece',
            shape: 'box',
            width: 4,
            depth: 5,
            height: 6,
            x: 12,
            y: 0,
            z: 0,
            rotation: 0,
          },
        ],
      },
    });
  });
  await page.goto('/');
  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-model-objects', '2');
  const original = await page.evaluate(() =>
    localStorage.getItem('atelier.session.v2'),
  );
  await page
    .getByRole('textbox', { name: 'Message Atelier' })
    .fill('Develop a new study beside the existing design.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => calls, { timeout: 30000 }).toBe(2);
  await expect(viewport).toHaveAttribute('data-model-objects', '3');
  expect(
    await page.evaluate(() => localStorage.getItem('atelier.session.v2')),
  ).toBe(original);
  await page
    .getByRole('button', { name: 'Stop and discard working preview' })
    .click();
  await expect(viewport).toHaveAttribute('data-model-objects', '2');
  expect(
    await page.evaluate(() => localStorage.getItem('atelier.session.v2')),
  ).toBe(original);
  await pending?.abort().catch(() => {});
  await expect(
    page.getByRole('button', { name: 'Stop and discard working preview' }),
  ).toHaveCount(0);
});

test('agent camera and solar actions drive the real workspace and report playback state on follow-up', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() =>
    localStorage.setItem(
      'atelier.project.v1',
      JSON.stringify({
        version: 2,
        volumes: [
          {
            id: 'study',
            name: 'Study',
            dimensions: { width: 10, height: 8, depth: 6 },
            position: { x: 0, y: 0, z: 0 },
            rotation: 0,
          },
        ],
        selectedId: 'study',
        site: { latitude: 51.5, longitude: 0, bearing: 0 },
      }),
    ),
  );
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
  let calls = 0;
  await page.route('**/api/plan', (r) => {
    const input = r.request().postDataJSON();
    calls++;
    if (calls === 1)
      return r.fulfill({
        json: {
          intent: 'apply',
          message: 'Set the view and sunlight',
          brief: null,
          planning: { stage: 'View study', assumptions: [], next: 'Inspect' },
          operations: [
            {
              type: 'camera_view',
              targets: [],
              projection: 'orthographic',
              bearing: 45,
              elevation: 45,
              distance: null,
              target: null,
            },
            { type: 'workspace', action: 'solar_play' },
          ],
        },
      });
    if (calls === 2)
      return r.fulfill({
        json: {
          intent: 'finish',
          message: 'The view is ready and the sun study is playing.',
          operations: [],
          brief: null,
          planning: null,
        },
      });
    expect(input.workspace.solarPlaying).toBe(true);
    return r.fulfill({
      json: {
        intent: 'apply',
        message: 'Sun study paused.',
        operations: [{ type: 'workspace', action: 'solar_pause' }],
        brief: null,
        planning: null,
      },
    });
  });
  await page.goto('/');
  const viewport = page.getByTestId('viewport');
  await expect(viewport).toHaveAttribute('data-model-objects', '1');
  const input = page.getByRole('textbox', { name: 'Message Atelier' });
  await input.fill(
    'Show the study from northeast at 45 degrees and play the sun study.',
  );
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(viewport).toHaveAttribute(
    'data-projection',
    'OrthographicCamera',
  );
  await expect
    .poll(
      async () => {
        const position = (await viewport.getAttribute('data-camera-position'))!
          .split(',')
          .map(Number);
        const target = (await viewport.getAttribute('data-camera-target'))!
          .split(',')
          .map(Number);
        const [x, y, z] = position.map((n, i) => n - target[i]);
        return (
          Math.round((Math.atan2(x, -z) * 180) / Math.PI) === 45 &&
          Math.round((Math.atan2(y, Math.hypot(x, z)) * 180) / Math.PI) === 45
        );
      },
      { timeout: 20000 },
    )
    .toBe(true);
  const azimuth = await viewport.getAttribute('data-sun-azimuth');
  const cameraPosition = await viewport.getAttribute('data-camera-position');
  const cameraTarget = await viewport.getAttribute('data-camera-target');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => viewport.getAttribute('data-sun-azimuth'))
    .not.toBe(azimuth);
  await expect(viewport).toHaveAttribute(
    'data-camera-position',
    cameraPosition!,
  );
  await expect(viewport).toHaveAttribute('data-camera-target', cameraTarget!);
  await input.fill('Pause the sun study.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => calls).toBe(3);
  await expect(
    page.getByRole('button', { name: 'Stop design request' }),
  ).toHaveCount(0);
  const paused = await viewport.getAttribute('data-sun-azimuth');
  await page.waitForTimeout(800);
  expect(await viewport.getAttribute('data-sun-azimuth')).toBe(paused);
});
