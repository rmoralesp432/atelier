/** Phase 3 evaluation only. Real production App/provider; frozen external oracles. */
import assert from 'node:assert/strict';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  openSync,
  closeSync,
  unlinkSync,
  realpathSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import express from 'express';
import { chromium, expect, type Page } from '@playwright/test';
import { createServer } from 'vite';
import { createApi } from '../../server/app';
import { createProvider, type Provider } from '../../server/provider';
import { TaskBlockedError } from '../../src/intelligence/planFailure';
import {
  parseSession,
  serializeSession,
  applyPlan,
  directPlan,
  type Session,
} from '../../src/intelligence/engine';
import { sceneContext, defaultCamera } from '../../src/intelligence/context';
import { stagedPlan } from '../../src/intelligence/checkedPlanner';
import { completionVerifier } from '../../src/intelligence/completionVerifier';
import { equalData } from '../../src/projects/equalData';
import {
  budgetUsed,
  meteredFetch,
  reservation,
  save,
  pricing,
  type Ledger,
} from '../completion-evaluation/budget';
import {
  modelingActive,
  cancelModeling,
} from '../release-evaluation/browser-state';
import { seed, assembled } from './fixtures';
import { oracle, passed, incorrect } from './oracles';
import { direction } from './geometry';

const baseline = 'f925e4cef7b4c6a27eb1532476879728aa5d7584';
const root = '.cloud/phase3-baseline',
  folder = join(root, 'live'),
  ledgerPath = join(folder, 'ledger.json');
const spec = JSON.parse(
  readFileSync('docs/evaluations/phase3-baseline/cases.json', 'utf8'),
);
const auth = JSON.parse(
  readFileSync('docs/evaluations/phase3-baseline/authorization.json', 'utf8'),
);
const git = (...args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8' }).trim();
const digest = (p: string) =>
  createHash('sha256').update(readFileSync(p)).digest('hex');
const walk = (p: string): string[] =>
  readdirSync(p, { withFileTypes: true }).flatMap((f) =>
    f.isDirectory() ? walk(join(p, f.name)) : [join(p, f.name)],
  );
const mode = process.argv[2];
const repairRevision = ['--freeze-repair-revision', '--retry-repair'].includes(
  mode,
);
const freezeFile = join(
  root,
  repairRevision ? 'execution-freeze-v2.json' : 'execution-freeze.json',
);
const frozenFiles = () =>
  [
    ...walk('scripts/phase3-evaluation'),
    ...walk('dist'),
    'scripts/completion-evaluation/budget.ts',
    'scripts/release-evaluation/browser-state.ts',
    'docs/evaluations/phase3-baseline/cases.json',
    'docs/evaluations/phase3-baseline/authorization.json',
    'docs/evaluations/phase3-baseline/pricing-estimate.json',
    'docs/evaluations/phase3-baseline/MEASUREMENTS.md',
    'package-lock.json',
  ].sort();
const currentFreeze = () => ({
  baseline,
  sourceTree: git('rev-parse', `${baseline}^{tree}`),
  files: Object.fromEntries(frozenFiles().map((p) => [p, digest(p)])),
  model: 'gpt-6.1-sol',
  ceilingUsd: 15,
  maximumCalls: 60,
  maximumCallsPerTask: 16,
  pricing,
  authorization: auth,
});
assert(
  [
    '--freeze',
    '--offline-browser',
    '--offline-observation',
    '--live',
    '--resume',
    '--freeze-repair-revision',
    '--retry-repair',
  ].includes(mode),
  'Choose one explicit evaluation mode.',
);
assert.equal(
  git(
    'diff',
    baseline,
    '--',
    'src',
    'server',
    'package.json',
    'package-lock.json',
    '.github',
    'render.yaml',
  ),
  '',
  'Application must remain byte-identical to stable production.',
);
mkdirSync(root, { recursive: true });
if (mode === '--freeze' || mode === '--freeze-repair-revision') {
  assert(!existsSync(freezeFile), 'Do not overwrite a frozen run.');
  assert.equal(
    git(
      'status',
      '--porcelain',
      '--',
      'scripts/phase3-evaluation',
      'docs/evaluations/phase3-baseline',
    ),
    '',
    'Commit evaluator and contracts before freezing.',
  );
  const calibrated = JSON.parse(
    readFileSync(join(root, 'calibration.json'), 'utf8'),
  );
  assert(
    calibrated.results.length >= 72 &&
      calibrated.results.every((r: any) => r.passed),
  );
  assert(
    JSON.parse(readFileSync(join(root, 'offline-browser.json'), 'utf8')).passed,
  );
  if (repairRevision) {
    const prior = JSON.parse(
      readFileSync(join(root, 'execution-freeze.json'), 'utf8'),
    );
    const next = currentFreeze();
    assert.deepEqual(Object.keys(prior.files), Object.keys(next.files));
    for (const [path, hash] of Object.entries(prior.files))
      if (path !== 'scripts/phase3-evaluation/run.ts')
        assert.equal(
          next.files[path],
          hash,
          `Unrelated frozen input changed: ${path}`,
        );
    assert(
      JSON.parse(readFileSync(join(root, 'offline-observation.json'), 'utf8'))
        .passed,
    );
    assert(
      existsSync(ledgerPath),
      'Repair revision must retain existing accounting.',
    );
  } else {
    mkdirSync(folder, { recursive: true });
    assert(!existsSync(ledgerPath), 'Never reset an existing ledger.');
    save(ledgerPath, { ceilingUsd: 15, authorized: true, calls: [] });
  }
  save(freezeFile, currentFreeze());
  console.log(
    'Frozen application, runner, prompts, oracles, bundle, pricing estimates and authorization. No paid calls.',
  );
  process.exit(0);
}
const live = !['--offline-browser', '--offline-observation'].includes(mode);
if (live) {
  assert.equal(auth.ceilingUsd, 15);
  assert.equal(auth.status, 'authorized-with-estimated-pricing-waiver');
  assert.deepEqual(
    JSON.parse(readFileSync(freezeFile, 'utf8')),
    currentFreeze(),
    'Frozen evaluation conditions changed.',
  );
  assert(process.env.ATELIER_OPENAI_API_KEY, 'Configured key required.');
  const l: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  assert(
    l.calls.every((c) => c.outcome === 'usage-reconciled'),
    'Pending or unknown charge stops new calls.',
  );
  if (mode === '--live')
    assert.equal(
      l.calls.length,
      0,
      'Use explicit resume; never reset accounting.',
    );
}
mkdirSync(folder, { recursive: true });
const lock = join(root, 'runner.lock');
const lockFd = openSync(lock, 'wx');
let active: any,
  role: 'executor' | 'reviewer' = 'executor',
  networkActive = false,
  stopped = false;
const results: any[] =
  live && existsSync(join(folder, 'results.json'))
    ? JSON.parse(readFileSync(join(folder, 'results.json'), 'utf8'))
    : [];
if (mode === '--retry-repair') {
  assert(
    spec.episodes.every((e: any) =>
      e.turns.every((t: any) =>
        results.some((r) => r.id === t.id && r.status !== 'RUNNING'),
      ),
    ),
    'Repair retry must not start new primary turns.',
  );
  const prior = results.find((r) => r.id === 'R1');
  assert(
    prior?.status === 'REPAIR_NOT_COMPLETED' &&
      prior.cost?.calls === 0 &&
      prior.events.length === 0,
    'This retry is only for the recorded pre-call renderer failure.',
  );
  assert(
    !results.some((r) => r.id === 'R1-attempt-2'),
    'Never repeat or overwrite an existing retry.',
  );
}
const persist = () => save(join(folder, 'results.json'), results);
const safe = (e: unknown) =>
  (e instanceof Error ? e.message : String(e))
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .slice(0, 2000);
const metered = live
  ? meteredFetch(
      ledgerPath,
      () => ({ caseId: active.id, role }),
      async (url, init) => {
        const ledger: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
        save(
          join(folder, `request-${ledger.calls.length}.json`),
          JSON.parse(init!.body as string),
        );
        return fetch(url, init);
      },
      { ceilingUsd: 15, maximumCalls: 60, maximumCallsPerTask: 16 },
    )
  : undefined;
const budgeted: typeof fetch = async (url, init) => {
  assert(live && metered, 'Offline calibration cannot call paid endpoints.');
  assert(!networkActive, 'No parallel paid generations.');
  const ledger: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  const bucket = (id: string) =>
    id.startsWith('R1')
      ? 'repair'
      : id.startsWith('diagnostic-')
        ? 'diagnostic'
        : 'primary';
  const cap = { primary: 10, repair: 2, diagnostic: 3 }[bucket(active.id)];
  const used = ledger.calls
    .filter((c) => bucket(c.caseId) === bucket(active.id))
    .reduce((n, c) => n + (c.chargedUsd ?? c.reservedUsd), 0);
  const reserved = reservation(JSON.parse(init!.body as string));
  if (used + reserved > cap || budgetUsed(ledger) + reserved > 15) {
    active.budgetBlocked = {
      bucket: bucket(active.id),
      used,
      reserved,
      cap,
      aggregate: budgetUsed(ledger),
    };
    persist();
    throw Error(
      `${bucket(active.id)} spending reservation limit reached before network.`,
    );
  }
  networkActive = true;
  try {
    return await metered(url, init);
  } finally {
    networkActive = false;
  }
};
process.env.ATELIER_AGENT_MODEL = 'gpt-6.1-sol';
const provider = live
  ? createProvider(process.env.ATELIER_OPENAI_API_KEY!, budgeted, {
      agent: true,
      textApi: 'responses',
    })
  : undefined;
let offlineKind = 'create',
  offlineStage = 0;
const wrapped: Provider = {
  agent: true,
  voice: async () => {
    throw Error('Voice outside this evaluation');
  },
  plan: async (input, signal) => {
    if (!live) {
      offlineStage++;
      if (offlineKind === 'fail')
        throw new TaskBlockedError(
          'Offline injected failed task. Your project is unchanged.',
        );
      if (offlineStage === 1)
        return {
          intent: 'apply',
          message: 'Offline harness control',
          planning: { stage: 'Construct', assumptions: [], next: null },
          operations: [
            {
              type: 'create_at',
              name: 'Offline probe',
              shape: 'box',
              width: 0.6,
              depth: 0.4,
              height: 0.8,
              x: -3,
              y: 0,
              z: 0,
              rotation: 0,
            },
          ],
        } as any;
      return {
        intent: 'finish',
        message: 'Offline completion',
        operations: [],
      } as any;
    }
    return record('executor', input, signal);
  },
  completionCriteria: async (input, signal) => {
    if (!live)
      return {
        modeling: true,
        editable: [],
        qualitativeLimits: [],
        checks: [
          {
            source: 'request',
            evidence: input.message,
            requirement: {
              kind: 'measure',
              id: 'offline-count',
              label: 'One probe',
              selector: {
                refs: ['$new'],
                nameContains: null,
                role: null,
                level: null,
              },
              metric: 'count',
              aggregation: 'each',
              comparison: 'equal',
              value: 1,
              tolerance: 0,
              relativeTolerance: 0,
            },
          },
        ],
      } as any;
    return record('reviewer', input, signal);
  },
};
async function record(
  kind: 'executor' | 'reviewer',
  input: any,
  signal?: AbortSignal,
): Promise<any> {
  assert(active, 'No active evaluation turn');
  role = kind;
  const event: any = { kind, input, started: new Date().toISOString() };
  active.events.push(event);
  persist();
  const start = performance.now();
  try {
    const result = await (kind === 'executor'
      ? provider!.plan(input, signal)
      : provider!.completionCriteria!(input, signal));
    event.response = result;
    return result;
  } catch (e) {
    event.error = safe(e);
    throw e;
  } finally {
    event.elapsedMs = performance.now() - start;
    persist();
  }
}
const app = createApi(wrapped);
app.use(express.static(resolve('dist')));
app.get('/', (_q, r) => r.sendFile(resolve('dist/index.html')));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((r) => server.on('listening', r));
const origin = `http://127.0.0.1:${(server.address() as any).port}`;
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
let vite: any, observationPage: Page;
const saved = async (page: Page) =>
  parseSession(
    await page.evaluate(() => localStorage.getItem('atelier.session.v2')!),
  );
const history = async (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('atelier.conversation.v2') || '[]'),
  );
const model = (s: Session) => ({
  volumes: s.project.volumes,
  groups: s.project.groups ?? [],
  past: s.past,
  future: s.future,
});
async function openProject(
  s: Session,
  restore?: string,
  conversation: any[] = [],
) {
  let storage: any = {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [
          { name: 'atelier.start-direct', value: 'true' },
          { name: 'atelier.session.v2', value: serializeSession(s) },
          {
            name: 'atelier.conversation.v2',
            value: JSON.stringify(conversation),
          },
        ],
      },
    ],
  };
  if (restore) {
    storage = JSON.parse(readFileSync(restore, 'utf8'));
    storage.origins = storage.origins.map((o: any) => ({ ...o, origin }));
  }
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
    storageState: storage,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => {
    if (active) {
      active.browserErrors ??= [];
      active.browserErrors.push(safe(e));
      persist();
    }
  });
  await page.goto(origin);
  await expect(page.getByTestId('viewport')).toBeVisible({ timeout: 45000 });
  await expect
    .poll(
      async () => {
        try {
          return (await saved(page)).project.volumes.length;
        } catch {
          return -1;
        }
      },
      { timeout: 30000 },
    )
    .toBe(s.project.volumes.length);
  return page;
}
async function send(page: Page, text: string) {
  const input = page.getByRole('textbox', { name: 'Message Atelier' });
  if (!(await input.isVisible()))
    await page
      .getByRole('button', { name: 'Voice orb', exact: true })
      .dblclick();
  await input.fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
}
async function finishWait(page: Page, priorMessages: number) {
  const deadline = Date.now() + 660000;
  while (Date.now() < deadline) {
    if (
      (await history(page)).length >= priorMessages + 2 &&
      !(await modelingActive(page))
    )
      return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error(
    'Evaluation deadline elapsed; cancellation required, not an automatic model retry.',
  );
}
async function persistence(
  page: Page,
  before: Session,
  after: Session,
  label: string,
) {
  const chat = await history(page),
    camera = await page.evaluate(() =>
      Object.fromEntries(
        Object.entries(localStorage).filter(([k]) => k.endsWith(':camera')),
      ),
    );
  await page.reload();
  await expect(page.getByTestId('viewport')).toBeVisible();
  await expect
    .poll(async () => equalData(model(await saved(page)), model(after)), {
      timeout: 30000,
    })
    .toBe(true);
  assert(
    equalData(await history(page), chat),
    'Conversation changed on reload',
  );
  assert(
    equalData((await saved(page)).context, after.context),
    'Agent context changed on reload',
  );
  const newCamera = await page.evaluate(() =>
    Object.fromEntries(
      Object.entries(localStorage).filter(([k]) => k.endsWith(':camera')),
    ),
  );
  assert(equalData(newCamera, camera), 'Camera changed on reload');
  save(join(folder, `${label}-reloaded.json`), await saved(page));
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(
      async () =>
        equalData((await saved(page)).project.volumes, before.project.volumes),
      { timeout: 30000 },
    )
    .toBe(true);
  assert(equalData((await saved(page)).project.groups, before.project.groups));
  save(join(folder, `${label}-undone.json`), await saved(page));
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect
    .poll(
      async () =>
        equalData((await saved(page)).project.volumes, after.project.volumes),
      { timeout: 30000 },
    )
    .toBe(true);
  assert.equal(
    after.past.length,
    before.past.length + 1,
    'Expected a single atomic modeling Undo',
  );
  save(join(folder, `${label}-redone.json`), await saved(page));
  return {
    reload: true,
    context: true,
    conversation: true,
    camera: true,
    singleUndo: true,
    redo: true,
  };
}
function costs(id: string) {
  const l: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')),
    c = l.calls.filter((c) => c.caseId === id);
  return {
    calls: c.length,
    estimatedUsd: c.reduce((n, c) => n + (c.estimatedUsd ?? 0), 0),
    accountedUsd: c.reduce((n, c) => n + (c.chargedUsd ?? c.reservedUsd), 0),
    reviewerMs: c
      .filter((c) => c.role === 'reviewer')
      .reduce((n, c) => n + (c.elapsedMs ?? 0), 0),
    executorMs: c
      .filter((c) => c.role === 'executor')
      .reduce((n, c) => n + (c.elapsedMs ?? 0), 0),
  };
}
async function turn(
  page: Page,
  id: string,
  prompt: string,
  initial: Session,
  oracleId = id,
) {
  active = {
    id,
    prompt,
    oracleId,
    status: 'RUNNING',
    events: [],
    started: new Date().toISOString(),
    diagnostic: id.startsWith('diagnostic-'),
  };
  results.push(active);
  persist();
  const before = await saved(page),
    start = performance.now();
  save(join(folder, `${id}-before.json`), before);
  try {
    const chat = (await history(page)).length;
    await send(page, prompt);
    await finishWait(page, chat);
    const after = await saved(page);
    active.conversation = await history(page);
    save(join(folder, `${id}-after.json`), after);
    active.facts = await oracle(oracleId, initial, before, after);
    active.committed = !equalData(model(before), model(after));
    active.componentCount = after.project.volumes.length;
    await page.screenshot({ path: join(folder, `${id}.png`) });
    if (oracleId === 'F1') {
      active.status = passed(active.facts)
        ? 'SAFE_CONTRADICTION_RESPONSE'
        : 'UNSAFE_FAILURE';
      active.responseRequiresSemanticReview = true;
      if (!passed(active.facts)) stopped = true;
      await page
        .context()
        .storageState({ path: join(folder, `${id}-browser-state.json`) });
      return passed(active.facts);
    }
    const reviews = active.events.filter(
      (e: any) => e.kind === 'reviewer' && e.response,
    );
    if (reviews.length) {
      let index = 0;
      active.hostReplay = await completionVerifier(before, prompt, async () => {
        assert(
          index < reviews.length,
          'No recorded reviewer response for replay',
        );
        return reviews[index++].response;
      })(after);
    }
    if (active.committed) {
      active.transaction = await persistence(page, before, after, id);
      active.status = passed(active.facts)
        ? active.hostReplay?.status === 'verified'
          ? 'PASS'
          : 'MEASURED_CORRECT_WITH_HOST_LIMITS'
        : incorrect(active.facts)
          ? 'COMMITTED_INCORRECT'
          : 'COMMITTED_EXTERNALLY_UNVERIFIED';
      if (incorrect(active.facts) && active.hostReplay?.status === 'verified') {
        active.serious =
          'Host claimed verified but independent geometry measurements failed';
        stopped = true;
      }
    } else {
      assert(
        equalData(model(before), model(after)),
        'Failed task changed committed project/history',
      );
      active.status = active.budgetBlocked ? 'BUDGET_STOP' : 'NOT_COMPLETED';
      active.originalPreserved = true;
    }
    await page
      .context()
      .storageState({ path: join(folder, `${id}-browser-state.json`) });
    return active.committed && passed(active.facts);
  } catch (e) {
    active.error = safe(e);
    active.status = 'INTERRUPTED_OR_HARNESS_FAILURE';
    await cancelModeling(page);
    save(join(folder, `${id}-after-error.json`), await saved(page));
    stopped = true;
    return false;
  } finally {
    active.elapsedMs = performance.now() - start;
    active.cost = costs(id);
    persist();
    const l: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    if (l.calls.some((c) => c.outcome !== 'usage-reconciled')) stopped = true;
    console.log(
      JSON.stringify({
        id,
        status: active.status,
        cost: active.cost,
        failedChecks: active.facts
          ?.filter((f: any) => f.status !== 'verified')
          .map((f: any) => f.name),
        error: active.error,
      }),
    );
  }
}
async function observe(s: Session, label: string) {
  if (!vite) {
    vite = await createServer({
      server: {
        host: '127.0.0.1',
        port: 0,
        fs: { allow: [resolve('.'), realpathSync('node_modules')] },
      },
      appType: 'custom',
    });
    await vite.listen();
    observationPage = await browser.newPage();
    await observationPage.route('**/__phase3', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Evaluation observation</title>',
      }),
    );
    await observationPage.goto(
      `http://127.0.0.1:${vite.httpServer.address().port}/__phase3`,
    );
    await observationPage.evaluate(async () => {
      const kpath = '/src/geometry/kernel.ts',
        wpath = '/node_modules/manifold-3d/manifold.wasm?url';
      const k = await import(kpath),
        w = await import(wpath);
      k.setKernelWasmUrl(w.default);
    });
  }
  const o = await observationPage.evaluate(
    async (project) => {
      const path = '/src/intelligence/renderObservation.ts';
      return (await import(path)).renderObservation(project);
    },
    JSON.parse(JSON.stringify(s.project)),
  );
  o.views.forEach((v: any, i: number) =>
    writeFileSync(
      join(folder, `${label}-${i}.jpg`),
      Buffer.from(v.image.split(',')[1], 'base64'),
    ),
  );
  return o;
}
async function repair(id = 'R1') {
  const initial = seed('E'),
    prompt =
      spec.episodes.find((e: any) => e.id === 'E-array').turns[0].prompt +
      ' ' +
      spec.common.promptSuffix;
  active = {
    id,
    prompt,
    status: 'RUNNING',
    events: [],
    injected: false,
    started: new Date().toISOString(),
  };
  results.push(active);
  persist();
  let injectedId = '',
    badOriginal: Session | undefined;
  const start = performance.now();
  const verify = completionVerifier(
    initial,
    prompt,
    async (candidate, revision) =>
      record(
        'reviewer',
        {
          message: prompt,
          history: [],
          scene: sceneContext(initial.project, initial.context, defaultCamera),
          candidate: candidate.project.volumes.map((v) => ({
            id: v.id,
            name: v.name,
            groupId: v.groupId ?? null,
            role: v.component?.role ?? null,
            level: v.component?.level ?? null,
          })),
          ...(revision ? { revision } : {}),
        },
        AbortSignal.timeout(150000),
      ),
  );
  try {
    const result = await stagedPlan(
      initial,
      defaultCamera,
      async (working, feedback, execution) => {
        save(join(folder, `${id}-stage-${active.events.length}.json`), working);
        return record(
          'executor',
          {
            message: prompt,
            language: 'en',
            history: [],
            scene: sceneContext(
              working.project,
              working.context,
              defaultCamera,
            ),
            historyAvailability: {
              undo: working.past.length,
              redo: working.future.length,
            },
            validationFeedback: feedback,
            execution,
            observation: await observe(
              working,
              `${id}-${active.events.length}`,
            ),
          },
          AbortSignal.timeout(150000),
        );
      },
      () => {},
      AbortSignal.timeout(660000),
      {
        agent: true,
        verifyCompletion: async (candidate) => {
          const beforeFacts = await oracle('E1', initial, initial, candidate);
          if (!active.injected && passed(beforeFacts)) {
            const p = candidate.project.volumes
                .filter(
                  (v) => !initial.project.volumes.some((o) => o.id === v.id),
                )
                .sort((a, b) => a.id.localeCompare(b.id))[0],
              d = direction(31);
            badOriginal = structuredClone(candidate);
            save(join(folder, `${id}-before-injection.json`), candidate);
            injectedId = p.id;
            candidate.project = {
              ...candidate.project,
              volumes: candidate.project.volumes.map((v) =>
                v.id === p.id
                  ? {
                      ...v,
                      position: {
                        ...v.position,
                        x: v.position.x - 0.19 * d[2],
                        z: v.position.z + 0.19 * d[0],
                      },
                    }
                  : v,
              ),
            };
            active.injected = true;
            active.injection = {
              id: injectedId,
              delta: [-0.19 * d[2], 0, 0.19 * d[0]],
              boundary:
                'private candidate immediately before completion measurement',
            };
            save(join(folder, `${id}-injected.json`), candidate);
          }
          const report = await verify(candidate),
            facts = await oracle('E1', initial, initial, candidate);
          active.events.push({ kind: 'verification', report, facts });
          persist();
          if (active.injected && incorrect(facts) && report.canCommit) {
            stopped = true;
            throw new Error(
              'SERIOUS: displaced component can commit despite independently measured error',
            );
          }
          return report;
        },
      },
    );
    assert(result.prepared, 'Repair did not prepare a transaction');
    const candidate = result.prepared.session;
    active.facts = await oracle('E1', initial, initial, candidate);
    active.hostReport = result.verification;
    assert(
      active.injected,
      'No correct candidate reached fault injection; repair not tested',
    );
    assert(
      candidate.project.volumes.some((v) => v.id === injectedId),
      'Repair replaced component identity',
    );
    active.otherPartsPreserved = badOriginal!.project.volumes
      .filter((v) => v.id !== injectedId)
      .every((v) =>
        equalData(
          v,
          candidate.project.volumes.find((o) => o.id === v.id),
        ),
      );
    assert(active.otherPartsPreserved, 'Repair touched unrelated parts');
    assert(passed(active.facts), 'Repair did not restore requested geometry');
    const restored = parseSession(serializeSession(candidate)),
      undo = (await applyPlan(restored, directPlan({ type: 'undo', count: 1 })))
        .session,
      redo = (await applyPlan(undo, directPlan({ type: 'redo', count: 1 })))
        .session;
    assert(
      equalData(undo.project, initial.project) &&
        equalData(redo.project, candidate.project),
    );
    active.status = 'PASS_LIVE_ENGINE_REPAIR';
    active.transactionEvidence =
      'Engine serialization and Undo/Redo; browser lifecycle is measured in A-F, not counted as a fresh browser AI repair.';
    save(join(folder, `${id}-final.json`), candidate);
  } catch (e) {
    active.error = safe(e);
    active.status = stopped
      ? 'SERIOUS_REGRESSION_STOP'
      : 'REPAIR_NOT_COMPLETED';
  } finally {
    active.elapsedMs = performance.now() - start;
    active.cost = costs(id);
    persist();
    console.log(
      JSON.stringify({
        id,
        status: active.status,
        error: active.error,
        cost: active.cost,
      }),
    );
  }
}
try {
  if (mode === '--offline-observation') {
    const s = assembled('E1');
    assert(passed(await oracle('E1', seed('E'), seed('E'), s)));
    const observation = await observe(s, 'offline-repair-observation');
    assert.equal(observation.status, 'ready');
    assert.equal(observation.views.length, 2);
    save(join(root, 'offline-observation.json'), {
      passed: true,
      paidCalls: 0,
      source:
        'Actual repair renderer and real kernel through linked dependencies',
      views: observation.views.map((v: any) => v.label),
      objectIds: observation.objectIds,
    });
    console.log(
      'PASS offline repair observation: geometry library loaded, two actual views rendered. No paid calls.',
    );
  } else if (!live) {
    const page = await openProject(seed('F')),
      before = await saved(page);
    offlineKind = 'fail';
    offlineStage = 0;
    let n = (await history(page)).length;
    await send(page, 'Offline interruption control');
    await finishWait(page, n);
    assert(equalData(model(before), model(await saved(page))));
    await page.reload();
    await expect(page.getByTestId('viewport')).toBeVisible();
    offlineKind = 'create';
    offlineStage = 0;
    n = (await history(page)).length;
    await send(page, 'Create one offline probe');
    await finishWait(page, n);
    const after = await saved(page);
    assert.equal(
      after.project.volumes.length,
      before.project.volumes.length + 1,
    );
    const transaction = await persistence(
      page,
      before,
      after,
      'offline-control',
    );
    save(join(root, 'offline-browser.json'), {
      passed: true,
      paidCalls: 0,
      source: 'scripted provider, actual App/kernel/persistence',
      transaction,
      failedRequestPreserved: true,
    });
    console.log(
      'PASS offline browser: failed request, subsequent commit, reload, camera/conversation/context, single Undo/Redo. No paid calls.',
    );
  } else {
    const diagnoses: { episode: any; turn: any }[] = [];
    for (const episode of spec.episodes) {
      if (stopped) break;
      const e = episode.id[0],
        initial = seed(e),
        first = episode.turns[0],
        second = episode.turns[1];
      const completed = results.find(
        (r) => r.id === first.id && r.status !== 'RUNNING',
      );
      if (
        completed &&
        results.some((r) => r.id === second.id && r.status !== 'RUNNING')
      )
        continue;
      let page: Page, firstOK: boolean;
      if (completed) {
        firstOK =
          completed.status === 'PASS' ||
          completed.status === 'MEASURED_CORRECT_WITH_HOST_LIMITS' ||
          completed.status === 'SAFE_CONTRADICTION_RESPONSE';
        page = await openProject(
          firstOK
            ? JSON.parse(
                readFileSync(join(folder, `${first.id}-after.json`), 'utf8'),
              )
            : initial,
          firstOK ? join(folder, `${first.id}-browser-state.json`) : undefined,
        );
      } else {
        page = await openProject(initial);
        firstOK = await turn(
          page,
          first.id,
          first.prompt + ' ' + spec.common.promptSuffix,
          initial,
        );
      }
      if (firstOK && !stopped) {
        await page.reload();
        await expect(page.getByTestId('viewport')).toBeVisible();
        await turn(
          page,
          second.id,
          second.prompt + ' ' + spec.common.promptSuffix,
          initial,
        );
      } else if (!results.some((r) => r.id === second.id)) {
        results.push({
          id: second.id,
          status: 'NOT_REACHED',
          reason:
            'Creation/preceding request did not establish a valid committed starting scene',
        });
        diagnoses.push({ episode, turn: second });
        persist();
      }
      await page.context().close();
    }
    if (!stopped && mode === '--retry-repair') await repair('R1-attempt-2');
    else if (!stopped && !results.some((r) => r.id === 'R1')) await repair();
    // Authorized diagnostics are separate seeded edits, never replacement successes.
    for (const { episode, turn: t } of diagnoses.slice(0, 2)) {
      if (stopped || episode.id[0] === 'F') break;
      const initial = seed(episode.id[0]),
        starting = assembled(episode.id[0] + '1');
      assert(
        passed(await oracle(episode.id[0] + '1', initial, initial, starting)),
      );
      const id = `diagnostic-${t.id}`;
      save(join(folder, `${id}-seed.json`), starting);
      const page = await openProject(starting, undefined, [
        {
          role: 'assistant',
          content: `A validated existing ${episode.id.slice(2)} model was imported for this separate edit diagnostic. It was not created by the agent.`,
        },
      ]);
      await turn(
        page,
        id,
        t.prompt + ' ' + spec.common.promptSuffix,
        initial,
        t.id,
      );
      await page.context().close();
    }
    const l: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    save(join(folder, 'summary.json'), {
      baseline,
      stopped,
      results: results.map(({ events, conversation, ...r }) => r),
      calls: l.calls.length,
      estimatedUsd: l.calls.reduce((n, c) => n + (c.estimatedUsd ?? 0), 0),
      accountedUsd: budgetUsed(l),
      unknownCalls: l.calls.filter((c) => c.outcome !== 'usage-reconciled')
        .length,
      ceilingUsd: 15,
      pricing: 'conservative estimates; user monitors account billing',
      applicationChanged: false,
      deployed: false,
    });
  }
} finally {
  await browser.close();
  await vite?.close();
  await new Promise<void>((r) => server.close(() => r()));
  closeSync(lockFd);
  unlinkSync(lock);
}
