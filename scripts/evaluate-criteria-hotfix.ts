/** One opt-in, $2-max hotfix evaluation. Uses the real App, engine and model.
 * No deployed changes. Existing ledgers remain untouched. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { createProvider } from '../server/provider';
import { sceneContext, defaultCamera } from '../src/intelligence/context';
import { parseSession, type Session } from '../src/intelligence/engine';
import { solidStats } from '../src/geometry/kernel';
import { verifyCompletion } from '../src/intelligence/completion';
import { completionVerifier } from '../src/intelligence/completionVerifier';
import { criteria, measure, selector } from '../tests/fixtures/completion';
import {
  meteredFetch,
  budgetUsed,
  model,
  pricing,
  save,
  type Ledger,
} from './completion-evaluation/budget';

const folder = '.cloud/criteria-hotfix/live';
mkdirSync(folder, { recursive: true });
const ledgerPath = `${folder}/ledger.json`,
  manifestPath = `${folder}/manifest.json`;
const command = (...args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8' }).trim();
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const prompt =
  'Create an editable offset gauge from three separate POM blocks, each 0.8 m wide (X), 0.5 m deep (Z), and 0.3 m high (Y). Name them Datum, East, and Return. Their base centers must be (18, 0.8, -6), (19.7, 1.4, -6), and (17.4, 2.1, -6) respectively. East is 1.7 m to the right and 0.6 m above Datum; Return is 0.6 m to the left and 1.3 m above Datum. Group the blocks as Offset gauge, keep them independently editable, and assign POM as their material designation. Preserve all existing objects. Build, inspect and finish without asking routine questions.';
const manifest = {
  prompt,
  model,
  ceilingUsd: 2,
  maximumCalls: 8,
  pricing,
  source: {
    src: command('rev-parse', 'HEAD:src'),
    server: command('rev-parse', 'HEAD:server'),
  },
  harness: hash(readFileSync('scripts/evaluate-criteria-hotfix.ts', 'utf8')),
  policy:
    'One normal live creation plus one read-only injected invalid-criterion correction on the same geometry. No fabricated modeling or reviewer answers.',
};
assert.equal(
  command('diff', '--', 'src', 'server'),
  '',
  'Commit the application before evaluation.',
);
assert.equal(
  command('diff', '--cached', '--', 'src', 'server'),
  '',
  'Do not evaluate staged application edits.',
);
const live = process.argv.includes('--live');
assert(
  process.argv
    .slice(2)
    .every((a) =>
      ['--prepare', '--live', '--approved-budget-usd=2'].includes(a),
    ),
);
if (!live) {
  assert(process.argv.includes('--prepare'));
  assert(!existsSync(ledgerPath), 'Never reset an existing evaluation ledger.');
  save(manifestPath, manifest);
  save(ledgerPath, { ceilingUsd: 2, authorized: false, calls: [] });
  console.log(
    'Prepared $2 maximum, eight-call bounded evaluation. No API calls.',
  );
  process.exit(0);
}
assert(process.argv.includes('--approved-budget-usd=2'));
assert.deepEqual(JSON.parse(readFileSync(manifestPath, 'utf8')), manifest);
let ledger: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
assert.equal(
  ledger.calls.length,
  0,
  'This run already has paid evidence; resume/review explicitly, never silently repeat it.',
);
assert(process.env.ATELIER_OPENAI_API_KEY);
ledger.authorized = true;
save(ledgerPath, ledger);
process.env.ATELIER_AGENT_MODEL = model;
let role: 'executor' | 'reviewer' = 'executor',
  sequence = 0;
const send = meteredFetch(
  ledgerPath,
  () => ({ caseId: 'offset-gauge', role }),
  async (url, init) => {
    sequence++;
    save(
      `${folder}/request-${sequence}.json`,
      JSON.parse(init!.body as string),
    );
    return fetch(url, init);
  },
  { ceilingUsd: 2, maximumCalls: 8, maximumCallsPerTask: 8 },
);
const provider = createProvider(process.env.ATELIER_OPENAI_API_KEY!, send, {
  agent: true,
  textApi: 'responses',
});
const browser = await chromium.launch({
  executablePath: existsSync('/usr/bin/chromium')
    ? '/usr/bin/chromium'
    : undefined,
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage({
  viewport: { width: 1200, height: 850 },
  reducedMotion: 'reduce',
});
page.setDefaultTimeout(30000);
const errors: string[] = [],
  reviewResults: any[] = [],
  modelResults: any[] = [];
page.on('pageerror', (e) => errors.push(e.message));
const saved = () =>
  page.evaluate(() => localStorage.getItem('atelier.session.v2')!);
const read = async () => parseSession(await saved());
const started = Date.now();
try {
  await page.addInitScript(() =>
    localStorage.setItem('atelier.start-direct', 'true'),
  );
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
  await page.route('**/api/plan', async (route) => {
    const input = route.request().postDataJSON();
    role = 'executor';
    try {
      const result = await provider.plan(input);
      modelResults.push({ input, result });
      save(`${folder}/model-results.json`, modelResults);
      await route.fulfill({ json: result });
    } catch (e) {
      await route.fulfill({
        status: 500,
        json: {
          error: e instanceof Error ? e.message : 'Evaluation call failed',
        },
      });
    }
  });
  await page.route('**/api/completion-criteria', async (route) => {
    const input = route.request().postDataJSON();
    role = 'reviewer';
    try {
      const result = await provider.completionCriteria!(input);
      reviewResults.push({ input, result });
      save(`${folder}/review-results.json`, reviewResults);
      await route.fulfill({ json: result });
    } catch (e) {
      await route.fulfill({
        status: 500,
        json: {
          error: e instanceof Error ? e.message : 'Evaluation call failed',
        },
      });
    }
  });
  await page.goto('http://127.0.0.1:4173');
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '2',
    { timeout: 30000 },
  );
  await expect
    .poll(
      async () => {
        try {
          return (await read()).project.volumes.length;
        } catch {
          return 0;
        }
      },
      { timeout: 30000 },
    )
    .toBe(2);
  const original = await read();
  save(`${folder}/original.json`, original);
  await page.getByRole('textbox', { name: 'Message Atelier' }).fill(prompt);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect
    .poll(async () => (await read()).project.volumes.length, {
      timeout: 240000,
      intervals: [500],
    })
    .toBe(5);
  const candidate = await read();
  save(`${folder}/committed.json`, candidate);
  assert(reviewResults.length > 0, 'A real independent review must have run.');
  const normalVerification = await verifyCompletion(
    reviewResults.at(-1).result,
    original,
    candidate,
  );
  save(`${folder}/normal-verification.json`, normalVerification);
  assert.notEqual(
    normalVerification.status,
    'incorrect',
    'Do not accept a genuine verification failure.',
  );
  assert.equal(candidate.past.length, original.past.length + 1);
  assert.deepEqual(
    candidate.project.volumes.slice(0, 2),
    original.project.volumes,
  );
  const expected = [
    ['Datum', 18, 0.8, -6],
    ['East', 19.7, 1.4, -6],
    ['Return', 17.4, 2.1, -6],
  ] as const;
  const additions = candidate.project.volumes.filter(
    (v) => !original.project.volumes.some((o) => o.id === v.id),
  );
  const measures: any[] = [];
  const close = (actual: number, target: number) =>
    assert(Math.abs(actual - target) < 0.0001, `${actual} != ${target}`);
  for (const [name, x, y, z] of expected) {
    const matches = additions.filter((v) =>
      v.name.toLowerCase().includes(name.toLowerCase()),
    );
    assert.equal(matches.length, 1, `Expected distinct ${name}`);
    const v = matches[0],
      { bounds, volume } = await solidStats(v);
    close((bounds.min[0] + bounds.max[0]) / 2, x);
    close(bounds.min[1], y);
    close((bounds.min[2] + bounds.max[2]) / 2, z);
    close(bounds.max[0] - bounds.min[0], 0.8);
    close(bounds.max[1] - bounds.min[1], 0.3);
    close(bounds.max[2] - bounds.min[2], 0.5);
    close(volume, 0.8 * 0.5 * 0.3);
    assert.equal(v.materialSpec?.toLowerCase(), 'pom');
    measures.push({
      id: v.id,
      name,
      bounds,
      volume,
      designation: v.materialSpec,
    });
  }
  const group = candidate.project.groups?.find(
    (g) => g.name.toLowerCase() === 'offset gauge',
  );
  assert(group && additions.every((v) => v.groupId === group.id));
  save(`${folder}/independent-measurements.json`, {
    status:
      normalVerification.status === 'verified'
        ? 'PASS'
        : 'PASS_WITH_DISCLOSED_LIMITS',
    normalVerificationStatus: normalVerification.status,
    objects: measures,
    unrelatedObjectsUnchanged: true,
    distinctIds: new Set(additions.map((v) => v.id)).size === 3,
    group,
  });
  await page.reload();
  await expect(page.getByTestId('viewport')).toHaveAttribute(
    'data-model-objects',
    '5',
    { timeout: 30000 },
  );
  assert.deepEqual((await read()).project, candidate.project);
  save(`${folder}/reloaded.json`, await read());
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => (await read()).project, { timeout: 30000 })
    .toEqual(original.project);
  save(`${folder}/undone.json`, await read());
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect
    .poll(async () => (await read()).project, { timeout: 30000 })
    .toEqual(candidate.project);
  save(`${folder}/redone.json`, await read());
  await page.screenshot({ path: `${folder}/result.png` });
  // Controlled fault injection in criteria ONLY, not an altered AI response.
  // This separately tests whether a real independent reader repairs malformed
  // checks without moving the already-correct model. Original live traces stay intact.
  const datum = additions.find((v) => v.name.toLowerCase().includes('datum'))!,
    east = additions.find((v) => v.name.toLowerCase().includes('east'))!;
  const injected = criteria(
    [
      measure('datum', 'y', 0.8, selector([datum.id])),
      measure('east', 'y', 1.4, selector([east.id])),
      {
        kind: 'offset',
        id: 'bad-direction',
        label: 'East above Datum',
        first: selector([east.id]),
        second: selector([datum.id]),
        axis: 'y',
        firstAnchor: 'min',
        secondAnchor: 'min',
        value: 0.6,
        tolerance: 0.001,
      },
      {
        kind: 'property',
        id: 'bad-material-field',
        label: 'POM designation',
        selector: selector(),
        property: 'material',
        value: 'POM',
      },
    ],
    [],
    prompt.slice(0, 400),
  );
  let revisionCalls = 0;
  const verify = completionVerifier(
    original,
    prompt,
    async (_candidate, revision) => {
      if (!revision) return injected;
      revisionCalls++;
      role = 'reviewer';
      const input = {
        message: prompt,
        history: [],
        scene: sceneContext(original.project, original.context, defaultCamera),
        candidate: candidate.project.volumes.map((v) => ({
          id: v.id,
          name: v.name,
          groupId: v.groupId ?? null,
          role: v.component?.role ?? null,
          level: v.component?.level ?? null,
        })),
        revision,
      };
      const result = await provider.completionCriteria!(input);
      save(`${folder}/injected-criteria-correction.json`, {
        provenance:
          'Deliberately malformed test criteria; independent correction uses real model reasoning. Not a spontaneous failure in the normal task.',
        input,
        result,
      });
      return result;
    },
  );
  const correctedReport = await verify(candidate);
  save(`${folder}/corrected-verification.json`, correctedReport);
  assert.equal(revisionCalls, 1);
  assert.equal(correctedReport.status, 'verified');
  const shifted = structuredClone(candidate);
  shifted.project.volumes.find((v) => v.id === east.id)!.position.y += 0.2;
  const negativeControl = await verify(shifted);
  save(`${folder}/incorrect-geometry-control.json`, negativeControl);
  assert.equal(negativeControl.status, 'incorrect');
  assert.equal(negativeControl.canCommit, false);
  assert.equal(revisionCalls, 1);
  assert.deepEqual((await read()).project, candidate.project);
  assert.deepEqual(errors, []);
  ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  save(`${folder}/result.json`, {
    status: 'PASS',
    elapsedMs: Date.now() - started,
    commit: command('rev-parse', 'HEAD'),
    normalReviewerCalls: reviewResults.length,
    modelCalls: modelResults.length,
    independentMeasurements: measures,
    criterionCorrectionCalls: revisionCalls,
    negativeControlRejected: true,
    reload: true,
    undoRedo: true,
    costEstimateUsd: ledger.calls.reduce(
      (s, c) => s + (c.estimatedUsd ?? 0),
      0,
    ),
    conservativeBudgetUsd: budgetUsed(ledger),
    ceilingUsd: 2,
    errors,
  });
  console.log(readFileSync(`${folder}/result.json`, 'utf8'));
} catch (error) {
  await page.screenshot({ path: `${folder}/failure.png` }).catch(() => {});
  save(`${folder}/failure.json`, {
    error: error instanceof Error ? error.message : String(error),
    elapsedMs: Date.now() - started,
    errors,
    body: await page
      .locator('body')
      .innerText()
      .catch(() => ''),
    paidCalls: JSON.parse(readFileSync(ledgerPath, 'utf8')).calls.length,
  });
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
