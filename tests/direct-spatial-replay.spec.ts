import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serializeSession } from '../src/intelligence/engine';
import { verifyCompletion } from '../src/intelligence/completion';
import { directCriteria } from './fixtures/direct-spatial/directCriteria';
import { oracle, pass, seed } from '../scripts/reliability-evaluation/geometry';

const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('atelier.session.v2')!));
const model = (s: any) => ({
  volumes: s.project.volumes,
  groups: s.project.groups ?? [],
  past: s.past,
  future: s.future,
});
const fixture = (name: string) =>
  JSON.parse(
    readFileSync(`tests/fixtures/direct-spatial/${name}.json`, 'utf8'),
  );
const output =
  process.env.ATELIER_SPATIAL_EVIDENCE ??
  `.cloud/direct-spatial/${new Date().toISOString().replaceAll(':', '-')}`;

for (const scenario of [
  'shelf',
  'shelf-displaced',
  'shelf-original-criteria',
  'conveyor',
  'conveyor-displaced',
  'conveyor-original-criteria',
  'sculpture',
] as const) {
  test(`offline normal-workspace replay: ${scenario}`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(180000);
    const name = scenario.split('-')[0];
    const f = fixture(name);
    const incorrect = scenario.endsWith('-displaced');
    const oldCriteria = scenario.endsWith('-original-criteria');
    const shouldCommit = !incorrect && !oldCriteria;
    const folder = join(output, scenario);
    mkdirSync(folder, { recursive: true });
    const evidence: any = {
      scenario,
      started: new Date().toISOString(),
      provenance: f.provenance,
      label:
        name === 'sculpture'
          ? 'Saved model AND saved reviewer responses, two turns; no fresh AI.'
          : oldCriteria
            ? 'Saved model and original/revised saved reviewer responses. Historical failure retained, no fresh AI.'
            : 'Saved model responses, scripted direct relational criterion selection; no fresh AI. Negative variant appends a deliberate 20 mm displacement.',
      paidCalls: 0,
      requests: [],
      feedback: [],
      turns: [],
      expectedCommit: shouldCommit,
    };
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
    // No remote traffic or unmocked provider endpoint may reach a provider.
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      return url.origin !== baseURL || url.pathname.startsWith('/api/')
        ? route.abort()
        : route.continue();
    });
    const page = await context.newPage();
    let current = f,
      stageIndex = 0,
      reviews = 0,
      before = f.before;
    let criteria = oldCriteria
      ? current.originalCriteria
      : directCriteria(current.task, current.originalCriteria);
    await page.route('**/api/config', (route) =>
      route.fulfill({
        json: {
          configured: true,
          authenticated: true,
          agentConfigured: true,
          voiceConfigured: false,
        },
      }),
    );
    await page.route('**/api/plan', async (route) => {
      const body = route.request().postDataJSON();
      evidence.requests.push({
        kind: 'executor',
        prompt: body.message,
        repair: !!body.validationFeedback,
      });
      if (body.validationFeedback) {
        evidence.feedback.push(body.validationFeedback);
        return route.fulfill({
          status: 422,
          json: {
            code: 'modeling_blocked',
            error:
              'Controlled incorrect variant blocked. No scripted repair supplied.',
          },
        });
      }
      const plan = structuredClone(current.stages[stageIndex++]);
      if (!plan) {
        evidence.unexpectedContinuation = true;
        return route.fulfill({
          status: 422,
          json: {
            code: 'modeling_blocked',
            error: 'Saved response sequence exhausted.',
          },
        });
      }
      if (incorrect && stageIndex === current.stages.length) {
        const target = before.project.volumes.find((v: any) =>
          v.name.includes(name === 'shelf' ? 'shelf board' : 'Support leg'),
        );
        plan.operations.push({
          type: 'edit_components',
          edits: [
            {
              targets: [target.id],
              where: [],
              translation: {
                x: name === 'shelf' ? 0.02 : 0,
                y: 0,
                z: name === 'conveyor' ? 0.02 : 0,
              },
              resize: null,
            },
          ],
        });
        evidence.injected = {
          id: target.id,
          displacementMeters: 0.02,
          axis: name === 'shelf' ? 'x' : 'z',
        };
      }
      return route.fulfill({ json: plan });
    });
    await page.route('**/api/completion-criteria', async (route) => {
      const body = route.request().postDataJSON();
      reviews++;
      evidence.requests.push({ kind: 'reviewer', revision: !!body.revision });
      // Provisional work must not already be in the saved project.
      expect(model(await saved(page))).toEqual(model(before));
      if (body.revision) {
        evidence.criterionRevision = body.revision;
        expect(oldCriteria).toBe(true);
      }
      return route.fulfill({
        json: body.revision ? current.savedRevision : criteria,
      });
    });
    try {
      await page.goto(baseURL!);
      await expect(page.getByTestId('viewport')).toHaveAttribute(
        'data-model-objects',
        String(before.project.volumes.length),
      );
      for (const turn of name === 'sculpture'
        ? [f, fixture('sculpture-followup')]
        : [f]) {
        current = turn;
        stageIndex = 0;
        reviews = 0;
        criteria = oldCriteria
          ? current.originalCriteria
          : directCriteria(current.task, current.originalCriteria);
        await page
          .getByRole('textbox', { name: 'Message Atelier' })
          .fill(current.prompt);
        await page
          .getByRole('button', { name: 'Send message', exact: true })
          .click();
        if (shouldCommit)
          await expect
            .poll(async () => (await saved(page)).past.length, {
              timeout: 100000,
            })
            .toBe(before.past.length + 1);
        else
          await expect(
            page.getByRole('log', { name: 'Design conversation' }),
          ).toContainText(
            incorrect
              ? 'Controlled incorrect variant blocked'
              : 'proposed changes have not been saved',
            { timeout: 100000 },
          );
        const after = await saved(page);
        const turnEvidence: any = {
          prompt: current.prompt,
          before,
          after,
          committed: shouldCommit,
          reviews,
          models: stageIndex,
        };
        evidence.turns.push(turnEvidence);
        expect(evidence.unexpectedContinuation).not.toBe(true);
        expect(stageIndex).toBe(current.stages.length);
        expect(reviews).toBe(oldCriteria ? 2 : 1);
        if (shouldCommit) {
          turnEvidence.measurements = await oracle(
            f.task,
            seed(f.task),
            before,
            after,
            true,
            current === f ? 'edit' : 'edit2',
          );
          expect(pass(turnEvidence.measurements)).toBe(true);
          turnEvidence.verification = await verifyCompletion(
            criteria,
            before,
            after,
          );
          expect(turnEvidence.verification.canCommit).toBe(true);
          turnEvidence.changedIds = before.project.volumes
            .filter(
              (v: any) =>
                JSON.stringify(v) !==
                JSON.stringify(
                  after.project.volumes.find((a: any) => a.id === v.id),
                ),
            )
            .map((v: any) => v.id);
          turnEvidence.preservedIds = before.project.volumes
            .filter((v: any) => !turnEvidence.changedIds.includes(v.id))
            .map((v: any) => v.id);
          expect(new Set(after.project.volumes.map((v: any) => v.id))).toEqual(
            new Set(before.project.volumes.map((v: any) => v.id)),
          );
          expect(after.project.groups).toEqual(before.project.groups);
        } else {
          expect(model(after)).toEqual(model(before));
          if (incorrect) {
            const failure = evidence.feedback.at(-1).verification;
            expect(failure.canCommit).toBe(false);
            expect(
              failure.checks
                .filter((c: any) => c.outcome === 'incorrect')
                .map((c: any) => c.id),
            ).toEqual(
              name === 'shelf' ? ['bay-left', 'bay-right'] : ['leg-rail'],
            );
          } else expect(evidence.feedback).toEqual([]);
        }
        await page.reload();
        await expect(page.getByTestId('viewport')).toBeVisible();
        await expect
          .poll(async () => model(await saved(page)))
          .toEqual(model(after));
        turnEvidence.reload = true;
        if (shouldCommit) {
          await page.getByRole('button', { name: 'Undo', exact: true }).click();
          await expect
            .poll(async () => (await saved(page)).project.volumes)
            .toEqual(before.project.volumes);
          await expect
            .poll(async () => (await saved(page)).project.groups)
            .toEqual(before.project.groups);
          // Redo itself survives a reload, not just an in-memory round trip.
          await page.reload();
          await page.getByRole('button', { name: 'Redo', exact: true }).click();
          await expect
            .poll(async () => model(await saved(page)))
            .toEqual(model(after));
          turnEvidence.undoRedo = true;
        }
        await page.screenshot({
          path: join(folder, `${evidence.turns.length}.png`),
        });
        before = after;
      }
      evidence.passed = true;
    } catch (error) {
      evidence.passed = false;
      evidence.error = String(error);
      throw error;
    } finally {
      evidence.finished = new Date().toISOString();
      evidence.saved = await saved(page).catch(() => null);
      evidence.conversation = await page
        .getByRole('log', { name: 'Design conversation' })
        .innerText()
        .catch(() => 'unavailable');
      const json = JSON.stringify(evidence, null, 2);
      writeFileSync(join(folder, 'result.json'), json);
      await info.attach('replay-evidence', {
        body: json,
        contentType: 'application/json',
      });
      await context.close();
    }
  });
}
