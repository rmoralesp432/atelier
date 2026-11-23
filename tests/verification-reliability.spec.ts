import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { serializeSession } from '../src/intelligence/engine';
import { binaryCorrection } from './fixtures/workshop-reliability/repair';
import { oracle, pass } from '../scripts/workshop-campaign/geometry';
import { equalData } from '../src/projects/equalData';
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
const model = (s: any) => ({
  volumes: s.project.volumes,
  groups: s.project.groups ?? [],
  past: s.past,
  future: s.future,
});
for (const scenario of [
  'group',
  'reflection',
  'displaced',
  'unresolved',
] as const) {
  test(`saved real-AI ${scenario} replay through browser commits and storage`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(120000);
    const f = JSON.parse(
      readFileSync(
        `tests/fixtures/workshop-reliability/${scenario === 'group' ? 'group' : 'reflection'}.json`,
        'utf8',
      ),
    );
    const context = await browser.newContext({
      storageState: {
        cookies: [],
        origins: [
          {
            origin: baseURL!,
            localStorage: [
              { name: 'atelier.start-direct', value: 'true' },
              { name: 'atelier.session.v2', value: serializeSession(f.before) },
            ],
          },
        ],
      },
    });
    const page = await context.newPage();
    let reviews = 0,
      models = 0;
    const mapping = new Map<string, string>();
    const remap = (value: any): any =>
      typeof value === 'string'
        ? (mapping.get(value) ??
          (value.startsWith('$group:')
            ? `$group:${mapping.get(value.slice(7)) ?? value.slice(7)}`
            : value))
        : Array.isArray(value)
          ? value.map(remap)
          : value && typeof value === 'object'
            ? Object.fromEntries(
                Object.entries(value).map(([k, v]) => [k, remap(v)]),
              )
            : value;
    await page.route('**/api/config', (r) =>
      r.fulfill({
        json: {
          configured: true,
          authenticated: true,
          agentConfigured: true,
          voiceConfigured: false,
        },
      }),
    );
    await page.route('**/api/plan', async (r) => {
      const body = r.request().postDataJSON(),
        stage = f.stages[models++];
      if (body.validationFeedback) {
        expect(scenario).toBe('displaced');
        expect(
          body.validationFeedback.verification.checks
            .filter((c: any) => c.outcome === 'incorrect')
            .map((c: any) => c.id),
        ).toEqual(['check-2']);
        return r.fulfill({
          status: 422,
          json: {
            code: 'modeling_blocked',
            error:
              'Controlled negative result rejected. No scripted geometry repair.',
          },
        });
      }
      for (const original of stage?.scene.objects ?? []) {
        const found = body.scene.objects.filter(
          (o: any) => o.name === original.name,
        );
        if (found.length === 1) mapping.set(original.id, found[0].id);
      }
      const plan = stage
        ? remap(stage.response)
        : {
            intent: 'finish',
            message: 'Saved-response replay completed',
            operations: [],
          };
      if (scenario === 'displaced' && models === 1)
        plan.operations.find(
          (op: any) => op.type === 'position' && op.targets[0] === 'display-1',
        ).x += 0.04;
      await r.fulfill({ json: plan });
    });
    await page.route('**/api/completion-criteria', async (r) => {
      reviews++;
      const body = r.request().postDataJSON();
      for (const original of f.candidate.project.volumes) {
        const found = body.candidate.filter(
          (o: any) => o.name === original.name,
        );
        if (found.length === 1) {
          mapping.set(original.id, found[0].id);
          if (original.groupId && found[0].groupId)
            mapping.set(original.groupId, found[0].groupId);
        }
      }
      expect(model(await saved(page))).toEqual(model(f.before));
      const c = remap(f.criteria);
      if (body.revision) {
        expect(reviews).toBe(2);
        expect(
          body.revision.issues.every(
            (i: any) => i.code === 'invalid_calculation',
          ),
        ).toBe(true);
      }
      return r.fulfill({
        json:
          body.revision && scenario !== 'unresolved' ? binaryCorrection(c) : c,
      });
    });
    await page.goto(baseURL!);
    await expect(page.getByTestId('viewport')).toHaveAttribute(
      'data-model-objects',
      String(f.before.project.volumes.length),
    );
    await expect
      .poll(async () => model(await saved(page)))
      .toEqual(model(f.before));
    await page.getByRole('textbox', { name: 'Message Atelier' }).fill(f.prompt);
    await page
      .getByRole('button', { name: 'Send message', exact: true })
      .click();
    const commits = ['group', 'reflection'].includes(scenario);
    if (commits)
      await expect
        .poll(async () => (await saved(page)).past.length, { timeout: 80000 })
        .toBe(f.before.past.length + 1);
    else {
      await expect(
        page.getByRole('log', { name: 'Design conversation' }),
      ).toContainText(
        scenario === 'displaced'
          ? 'Controlled negative result rejected'
          : 'proposed changes have not been saved',
        { timeout: 80000 },
      );
    }
    const after = await saved(page);
    expect(
      after.project.volumes.filter((v: any) => v.id.startsWith('reference-')),
    ).toEqual(
      f.before.project.volumes.filter((v: any) =>
        v.id.startsWith('reference-'),
      ),
    );
    let facts: any[] = [];
    if (commits) {
      facts = await oracle(
        scenario === 'group' ? 'W3' : 'D-H2',
        f.before,
        f.before,
        after,
        false,
      );
      expect(pass(facts)).toBe(true);
      await page.reload();
      await expect(page.getByTestId('viewport')).toBeVisible();
      await expect
        .poll(async () => model(await saved(page)))
        .toEqual(model(after));
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await expect
        .poll(async () => (await saved(page)).project.volumes)
        .toEqual(f.before.project.volumes);
      await page.getByRole('button', { name: 'Redo', exact: true }).click();
      await expect
        .poll(async () => (await saved(page)).project.volumes)
        .toEqual(after.project.volumes);
    } else {
      expect(model(after)).toEqual(model(f.before));
      await page.reload();
      await expect(page.getByTestId('viewport')).toBeVisible();
      await expect
        .poll(async () => model(await saved(page)))
        .toEqual(model(f.before));
    }
    expect(reviews).toBe(scenario === 'group' ? 1 : 2);
    expect(models).toBe(
      scenario === 'group' ? f.stages.length : scenario === 'displaced' ? 2 : 1,
    );
    const report = {
      scenario,
      provenance: f.provenance,
      label:
        'Offline saved model responses and scripted reviewer correction through normal browser. No fresh AI.',
      committed: commits,
      models,
      reviews,
      facts,
      unrelatedPreserved: true,
      reload: true,
      undoRedo: commits,
      after,
    };
    await info.attach('result', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });
    mkdirSync('docs/evaluations/workshop-reliability/browser', {
      recursive: true,
    });
    writeFileSync(
      `docs/evaluations/workshop-reliability/browser/${scenario}.json`,
      JSON.stringify(report, null, 2),
    );
    await page.screenshot({
      path: `docs/evaluations/workshop-reliability/browser/${scenario}.png`,
    });
    await context.close();
  });
}
