/** Evaluation coordinator only. Every live primary turn uses the unmodified App and provider. */
import assert from 'node:assert/strict';
import {
  readFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  openSync,
  closeSync,
  unlinkSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { chromium, expect } from '@playwright/test';
import { parseSession, serializeSession } from '../../src/intelligence/engine';
import { equalData } from '../../src/projects/equalData';
import {
  modelingActive,
  cancelModeling,
} from '../release-evaluation/browser-state';
import { root, docs, versions, conditions, type Version } from './config';
import { specs, type Spec } from './specs';
import {
  seed,
  referenceScene,
  arcPoints,
  oracle,
  pass,
  wrong,
} from './geometry';
import { meter, save, costs, ledger, stopReason } from './budget';

const mode = process.argv[2],
  batch = process.argv[3] ?? 'preflight',
  ids = (process.argv[4] ?? 'W1,W2,W3,W4').split(',');
assert(['--offline', '--freeze', '--live', '--summary'].includes(mode));
mkdirSync(root, { recursive: true });
mkdirSync(docs, { recursive: true });
const safe = (e: any) => String(e).replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]');
const git = (path: string, ...args: string[]) =>
  execFileSync('git', ['-C', path, ...args], { encoding: 'utf8' }).trim();
const walk = (p: string): string[] =>
  readdirSync(p, { withFileTypes: true }).flatMap((f) =>
    f.isDirectory() ? walk(join(p, f.name)) : [join(p, f.name)],
  );
const digest = (p: string) =>
  createHash('sha256').update(readFileSync(p)).digest('hex');
const freeze = () => {
  for (const v of Object.values(versions))
    assert.equal(
      git(
        v.path,
        'diff',
        v.commit,
        '--',
        'src',
        'server',
        'package.json',
        'package-lock.json',
      ),
      '',
      'Application changed',
    );
  return {
    conditions,
    versions,
    files: Object.fromEntries(
      [
        ...walk('scripts/workshop-campaign'),
        ...Object.values(versions).flatMap((v) => walk(join(v.path, 'dist'))),
        'scripts/phase3-evaluation/geometry.ts',
        'scripts/completion-evaluation/budget.ts',
        'scripts/release-evaluation/browser-state.ts',
        join(docs, 'AUTHORIZATION.json'),
        join(docs, 'pricing.json'),
      ]
        .sort()
        .map((p) => [p, digest(p)]),
    ),
  };
};
const freezePath = join(root, 'freeze.json');
if (mode === '--freeze') {
  assert(!existsSync(freezePath), 'Never overwrite frozen conditions');
  assert(
    JSON.parse(
      readFileSync(join(root, 'calibration.json'), 'utf8'),
    ).results.every((r: any) => r.passed),
  );
  assert(JSON.parse(readFileSync(join(root, 'offline.json'), 'utf8')).passed);
  assert.equal(
    git(
      process.cwd(),
      'status',
      '--porcelain',
      '--',
      'scripts/workshop-campaign',
    ),
    '',
    'Commit harness before freeze',
  );
  save(freezePath, freeze());
  save(join(docs, 'FREEZE.json'), {
    ...freeze(),
    evaluatorCommit: git(process.cwd(), 'rev-parse', 'HEAD'),
    frozenAt: new Date().toISOString(),
  });
  console.log('Frozen; no paid calls');
  process.exit(0);
}
const live = mode === '--live';
if (live) {
  assert.deepEqual(
    freeze(),
    JSON.parse(readFileSync(freezePath, 'utf8')),
    'Frozen conditions changed',
  );
  assert(process.env.ATELIER_OPENAI_API_KEY);
}
const folder = join(root, batch);
mkdirSync(folder, { recursive: true });
const resultPath = join(folder, 'results.json');
const results: any[] = existsSync(resultPath)
  ? JSON.parse(readFileSync(resultPath, 'utf8'))
  : [];
function publish() {
  save(resultPath, results);
  save(join(folder, 'costs.json'), costs());
  const slim = results.map(({ events, ...r }) => ({
    ...r,
    eventCount: events?.length,
  }));
  save(join(docs, batch + '-results.json'), slim);
  save(join(docs, 'spending.json'), {
    at: new Date().toISOString(),
    ...costs(),
    pricingBasis:
      'Authorized estimated prices, not an invoice; all reservations retained until usage is known.',
  });
}
if (mode === '--summary') {
  publish();
  console.log(
    JSON.stringify(
      {
        results: results.map((r) => ({ id: r.id, status: r.status })),
        costs: costs(),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
const lock = join(root, 'coordinator.lock');
const lockFd = openSync(lock, 'wx');
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
process.env.ATELIER_AGENT_MODEL = 'gpt-6.1-sol';
const saved = async (page: any) =>
  parseSession(
    await page.evaluate(() => localStorage.getItem('atelier.session.v2')!),
  );
const chat = async (page: any) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('atelier.conversation.v2') || '[]'),
  );
const model = (s: any) => ({
  volumes: s.project.volumes,
  groups: s.project.groups ?? [],
  past: s.past,
  future: s.future,
});
async function persistence(page: any, before: any, after: any, label: string) {
  const history = await chat(page),
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
    equalData(await chat(page), history),
    'Conversation changed on reload',
  );
  assert(
    equalData((await saved(page)).context, after.context),
    'Agent context lost on reload',
  );
  assert(
    equalData(
      await page.evaluate(() =>
        Object.fromEntries(
          Object.entries(localStorage).filter(([k]) => k.endsWith(':camera')),
        ),
      ),
      camera,
    ),
    'Camera changed on reload',
  );
  save(join(folder, label + '-reloaded.json'), await saved(page));
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(
      async () =>
        equalData((await saved(page)).project.volumes, before.project.volumes),
      { timeout: 30000 },
    )
    .toBe(true);
  assert(equalData((await saved(page)).project.groups, before.project.groups));
  save(join(folder, label + '-undone.json'), await saved(page));
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect
    .poll(
      async () =>
        equalData((await saved(page)).project.volumes, after.project.volumes),
      { timeout: 30000 },
    )
    .toBe(true);
  assert(equalData((await saved(page)).project.groups, after.project.groups));
  assert.equal(
    after.past.length,
    before.past.length + 1,
    'Not one atomic Undo',
  );
  save(join(folder, label + '-redone.json'), await saved(page));
  return {
    reload: true,
    conversation: true,
    context: true,
    camera: true,
    undo: true,
    redo: true,
    atomic: true,
  };
}
async function lane(version: Version, list: Spec[]) {
  const v = versions[version],
    load = (p: string) => import(pathToFileURL(join(v.path, p)).href);
  const [
    { createApi },
    { createProvider },
    { completionVerifier },
    { TaskBlockedError },
  ] = await Promise.all([
    load('server/app.ts'),
    load('server/provider.ts'),
    load('src/intelligence/completionVerifier.ts'),
    load('src/intelligence/planFailure.ts'),
  ]);
  let active: any,
    role = 'executor',
    stages = 0,
    offlineFail = false;
  const persist = () => {
    if (active) {
      save(join(folder, active.id + '-trace.json'), active);
      publish();
    }
  };
  const fetcher = meter(
    () => ({ caseId: active.id, role, version }),
    (body) => {
      active.requestCount = (active.requestCount ?? 0) + 1;
      persist();
    },
  );
  const provider = live
    ? createProvider(process.env.ATELIER_OPENAI_API_KEY, fetcher, {
        agent: true,
        textApi: 'responses',
      })
    : null;
  async function record(kind: string, input: any, signal: any) {
    assert(active);
    role = kind;
    const event: any = { kind, input, started: new Date().toISOString() };
    active.events.push(event);
    persist();
    try {
      const out = await (kind === 'executor'
        ? provider.plan(input, signal)
        : provider.completionCriteria(input, signal));
      event.response = out;
      return out;
    } catch (e) {
      event.error = safe(e);
      throw e;
    } finally {
      event.elapsedMs = Date.now() - Date.parse(event.started);
      persist();
    }
  }
  const wrapped = {
    agent: true,
    voice: async () => {
      throw Error('Voice not part of this evaluation');
    },
    plan: async (input: any, signal: any) => {
      stages++;
      if (!live) {
        if (offlineFail)
          throw new TaskBlockedError(
            'Deliberate offline failure; project unchanged.',
          );
        if (stages === 1)
          return {
            intent: 'apply',
            message: 'Offline calibration only',
            planning: { stage: 'Construct', assumptions: [], next: null },
            operations: [
              {
                type: 'create_at',
                name: 'Offline probe',
                shape: 'box',
                width: 0.6,
                height: 0.8,
                depth: 0.4,
                x: -3,
                y: 0,
                z: 0,
                rotation: 0,
              },
            ],
          };
        return {
          intent: 'finish',
          message: 'Offline complete',
          operations: [],
        };
      }
      if (active.negative) {
        if (stages === 1) {
          const operations = arcPoints().map((p, i) => {
            const a = ((37 - 24 * i) * Math.PI) / 180;
            return {
              type: 'create_at',
              name: `Arc sample ${i + 1}`,
              shape: 'cylinder',
              width: 0.14,
              depth: 0.14,
              height: 0.48,
              x: p[0] + (i === 2 ? 0.04 * Math.cos(a) : 0),
              y: p[1],
              z: p[2] + (i === 2 ? 0.04 * Math.sin(a) : 0),
              rotation: 0,
            };
          });
          return {
            intent: 'apply',
            message: 'Negative control: deliberately displaced component',
            planning: { stage: 'Construct', assumptions: [], next: null },
            operations,
          };
        }
        if (stages === 2)
          return {
            intent: 'finish',
            message: 'Controlled candidate submitted for independent review',
            operations: [],
          };
        active.negativeFeedback = input;
        persist();
        throw new TaskBlockedError(
          'Negative control ends after independent rejection; no scripted repair.',
        );
      }
      return record('executor', input, signal);
    },
    completionCriteria: async (input: any, signal: any) => {
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
        };
      return record('reviewer', input, signal);
    },
  };
  const app = createApi(wrapped);
  app.use(express.static(join(v.path, 'dist')));
  app.get('/', (_q: any, r: any) =>
    r.sendFile(join(v.path, 'dist/index.html')),
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.on('listening', r));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  async function open(s: any) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: 'reduce',
      storageState: {
        cookies: [],
        origins: [
          {
            origin,
            localStorage: [
              { name: 'atelier.start-direct', value: 'true' },
              { name: 'atelier.session.v2', value: serializeSession(s) },
              { name: 'atelier.conversation.v2', value: '[]' },
            ],
          },
        ],
      },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', (e: any) => {
      if (active) {
        (active.browserErrors ??= []).push(safe(e));
        persist();
      }
    });
    await page.goto(origin);
    await expect(page.getByTestId('viewport')).toBeVisible({ timeout: 45000 });
    await expect
      .poll(async () => (await saved(page)).project.volumes.length)
      .toBe(s.project.volumes.length);
    return page;
  }
  async function turn(
    page: any,
    spec: Spec,
    prompt: string,
    initial: any,
    edit = false,
    diagnostic = false,
  ) {
    const id = `${batch}-${version}-${spec.id}-${diagnostic ? 'diagnostic-' : ''}${edit ? 'edit' : 'create'}`;
    assert(
      !results.some((r) => r.id === id),
      'Use a new batch name; never overwrite an attempt',
    );
    active = {
      id,
      version,
      commit: v.commit,
      task: spec.id,
      prompt,
      edit,
      diagnostic,
      negative: spec.mode === 'negative',
      status: 'RUNNING',
      events: [],
      started: new Date().toISOString(),
    };
    results.push(active);
    stages = 0;
    persist();
    const before = await saved(page);
    save(join(folder, id + '-before.json'), before);
    let ok = false;
    try {
      const prior = (await chat(page)).length,
        input = page.getByRole('textbox', { name: 'Message Atelier' });
      if (!(await input.isVisible()))
        await page
          .getByRole('button', { name: 'Voice orb', exact: true })
          .dblclick();
      await input.fill(prompt);
      await page
        .getByRole('button', { name: 'Send message', exact: true })
        .click();
      const deadline = Date.now() + conditions.turnDeadlineMs;
      while (Date.now() < deadline) {
        if (
          (await chat(page)).length >= prior + 2 &&
          !(await modelingActive(page))
        )
          break;
        await new Promise((r) => setTimeout(r, 300));
      }
      assert(
        !(await modelingActive(page)) && (await chat(page)).length >= prior + 2,
        'Evaluation turn deadline; not a forced completion',
      );
      const after = await saved(page);
      save(join(folder, id + '-after.json'), after);
      active.conversation = await chat(page);
      active.committed = !equalData(model(before), model(after));
      active.componentCount = after.project.volumes.length;
      active.changedIds = before.project.volumes
        .filter(
          (p: any) =>
            !equalData(
              p,
              after.project.volumes.find((q: any) => q.id === p.id),
            ),
        )
        .map((p: any) => p.id);
      active.preservedIds = before.project.volumes
        .filter((p: any) =>
          equalData(
            p,
            after.project.volumes.find((q: any) => q.id === p.id),
          ),
        )
        .map((p: any) => p.id);
      await page.screenshot({ path: join(folder, id + '.png') });
      if (live) {
        active.facts = await oracle(spec.id, initial, before, after, edit);
        const reviews = active.events.filter(
          (e: any) => e.kind === 'reviewer' && e.response,
        );
        if (reviews.length && active.committed) {
          let i = 0;
          active.hostReplay = await completionVerifier(
            before,
            prompt,
            async () => {
              assert(i < reviews.length);
              return reviews[i++].response;
            },
          )(after);
        }
      }
      if (active.committed) {
        active.transaction = await persistence(page, before, after, id);
        active.status = live
          ? pass(active.facts)
            ? 'PASS'
            : wrong(active.facts)
              ? 'COMMITTED_INCORRECT'
              : 'COMMITTED_UNVERIFIED'
          : 'OFFLINE_COMMIT_PASS';
        ok = !live || pass(active.facts);
      } else {
        active.originalPreserved = equalData(model(before), model(after));
        assert(active.originalPreserved);
        active.status =
          spec.mode === 'negative'
            ? 'NEGATIVE_BLOCKED'
            : offlineFail
              ? 'OFFLINE_FAILURE_PRESERVED'
              : 'NOT_COMMITTED';
      }
      if (active.negative && active.committed)
        active.status = 'NEGATIVE_FALSE_ACCEPT';
      await page
        .context()
        .storageState({ path: join(folder, id + '-browser.json') });
    } catch (e) {
      active.error = safe(e);
      active.status = 'INTERRUPTED_OR_HARNESS_FAILURE';
      await cancelModeling(page).catch(() => {});
      save(join(folder, id + '-after-error.json'), await saved(page));
    } finally {
      active.elapsedMs = Date.now() - Date.parse(active.started);
      active.cost = costs(id);
      persist();
      console.log(
        JSON.stringify({
          id,
          status: active.status,
          cost: active.cost,
          failed: active.facts
            ?.filter((f: any) => f.status !== 'verified')
            .map((f: any) => f.name),
          error: active.error,
        }),
      );
    }
    return ok;
  }
  try {
    for (const spec of list) {
      if (stopReason()) break;
      const initial = seed(spec.id),
        page = await open(initial);
      const made = await turn(page, spec, spec.create, initial);
      if (spec.edit && made) await turn(page, spec, spec.edit, initial, true);
      await page.context().close();
      if (spec.edit && !made && live && !stopReason()) {
        const fixture = referenceScene(spec.id);
        assert(
          pass(await oracle(spec.id, initial, initial, fixture)),
          'Diagnostic must start from externally validated model',
        );
        const p = await open(fixture);
        await turn(p, spec, spec.edit, initial, true, true);
        await p.context().close();
      }
      if (!live) {
        const p = await open(initial);
        offlineFail = true;
        await turn(
          p,
          { ...spec, id: 'offline-failure' },
          'Do the deliberately failing calibration.',
          initial,
        );
        offlineFail = false;
        await turn(
          p,
          { ...spec, id: 'offline-recovery' },
          'Create one probe.',
          initial,
        );
        await p.context().close();
      }
    }
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}
try {
  const chosen = specs.filter((s) => ids.includes(s.id));
  assert(chosen.length > 0);
  const arms: Version[] = live
    ? chosen.every((s) => s.domain === 'verifier')
      ? ['baseline', 'verifier']
      : ['baseline', 'workshop']
    : ['baseline', 'workshop', 'verifier'];
  if (!live) {
    for (const v of arms)
      await lane(v, [
        { id: 'offline', domain: 'calibration', create: 'Create one probe.' },
      ]);
    save(join(root, 'offline.json'), {
      passed:
        results.length === 9 &&
        results.every((r) =>
          ['OFFLINE_COMMIT_PASS', 'OFFLINE_FAILURE_PRESERVED'].includes(
            r.status,
          ),
        ),
      results: results.map((r) => ({ id: r.id, status: r.status })),
    });
  } else
    await Promise.allSettled(arms.map((v) => lane(v, chosen))).then((r) => {
      for (const x of r) if (x.status === 'rejected') throw x.reason;
    });
} finally {
  publish();
  await browser.close();
  closeSync(lockFd);
  unlinkSync(lock);
}
