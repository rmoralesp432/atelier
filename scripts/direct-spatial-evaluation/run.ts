/** Evaluation only: serve each frozen App/provider; record without changing plans. */
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
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { chromium, expect } from '@playwright/test';
import { parseSession, serializeSession } from '../../src/intelligence/engine';
import { equalData } from '../../src/projects/equalData';
import {
  modelingActive,
  cancelModeling,
} from '../release-evaluation/browser-state';
import { docs, root, versions, conditions, type Version } from './config';
import {
  tasks,
  referenceOperations,
  negativeOperation,
  oracle,
  pass,
  plan,
  type Task,
} from './fixtures';
import { meter, save, ledger, costs, stopReason } from './budget';

const mode = process.argv[2],
  batch = process.argv[3] ?? (mode === '--offline' ? 'offline-1' : 'live-1');
assert(['--offline', '--freeze', '--live'].includes(mode));
const live = mode === '--live';
const git = (path: string, ...args: string[]) =>
  execFileSync('git', ['-C', path, ...args], { encoding: 'utf8' }).trim();
const hash = (path: string) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const walk = (path: string): string[] =>
  readdirSync(path, { withFileTypes: true }).flatMap((f) =>
    f.isDirectory() ? walk(join(path, f.name)) : [join(path, f.name)],
  );
mkdirSync(root, { recursive: true });
mkdirSync(docs, { recursive: true });
const frozen = () => {
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
      'Frozen application changed',
    );
  return {
    conditions,
    versions,
    files: Object.fromEntries(
      [
        ...walk('scripts/direct-spatial-evaluation'),
        ...Object.values(versions).flatMap((v) => walk(join(v.path, 'dist'))),
        'scripts/completion-evaluation/budget.ts',
        'scripts/phase3-evaluation/geometry.ts',
        'scripts/reliability-evaluation/solidMatch.ts',
        'scripts/release-evaluation/browser-state.ts',
        join(docs, 'fixtures/A.json'),
        join(docs, 'fixtures/B.json'),
        join(docs, 'preflight.json'),
        join(docs, 'calibration.json'),
        join(docs, 'AUTHORIZATION.json'),
      ]
        .sort()
        .map((p) => [p, hash(p)]),
    ),
  };
};
if (mode === '--freeze') {
  assert(
    !existsSync(join(docs, 'LIVE-FREEZE.json')),
    'Do not overwrite frozen conditions',
  );
  assert(
    JSON.parse(readFileSync(join(docs, 'calibration.json'), 'utf8')).passed,
  );
  assert(
    JSON.parse(
      readFileSync(join(docs, 'offline-1/results.json'), 'utf8'),
    ).every(
      (r: any) =>
        r.status === 'PASS' && r.negative.status === 'BLOCKED_MEASURED',
    ),
  );
  assert.equal(
    git(
      process.cwd(),
      'status',
      '--porcelain',
      '--',
      'scripts/direct-spatial-evaluation',
    ),
    '',
    'Commit harness before freeze',
  );
  save(join(docs, 'LIVE-FREEZE.json'), frozen());
  console.log('Conditions frozen; no paid call.');
  process.exit(0);
}
if (live) {
  assert.deepEqual(
    frozen(),
    JSON.parse(readFileSync(join(docs, 'LIVE-FREEZE.json'), 'utf8')),
  );
  assert(process.env.ATELIER_OPENAI_API_KEY);
}
const folder = join(docs, batch);
assert(
  !existsSync(join(folder, 'results.json')),
  'New attempt name required; never overwrite',
);
mkdirSync(folder, { recursive: true });
const results: any[] = [];
const safe = (e: any) => String(e).replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]');
const lock = join(root, 'coordinator.lock'),
  fd = openSync(lock, 'wx');
process.env.ATELIER_AGENT_MODEL = 'gpt-6.1-sol';
function publish() {
  save(join(folder, 'results.json'), results);
  if (live) {
    save(join(folder, 'spending.json'), costs());
    save(join(docs, 'spending.json'), costs());
  }
}
const model = (s: any) => ({
  project: s.project,
  past: s.past,
  future: s.future,
});
const saved = async (page: any) =>
  parseSession(
    await page.evaluate(() => localStorage.getItem('atelier.session.v2')!),
  );
const conversation = async (page: any) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('atelier.conversation.v2') || '[]'),
  );
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
let active: any;
async function trial(task: Task, version: Version) {
  const source = JSON.parse(
    readFileSync(join(docs, `fixtures/${task}.json`), 'utf8'),
  );
  const v = versions[version],
    load = (p: string) => import(pathToFileURL(join(v.path, p)).href);
  const [
    { createApi },
    { createProvider },
    { applyPlan },
    { completionVerifier },
    { TaskBlockedError },
  ] = await Promise.all([
    load('server/app.ts'),
    load('server/provider.ts'),
    load('src/intelligence/engine.ts'),
    load('src/intelligence/completionVerifier.ts'),
    load('src/intelligence/planFailure.ts'),
  ]);
  const entry: any = {
    id: `${task}-${version}`,
    task,
    version,
    commit: v.commit,
    prompt: tasks[task].prompt,
    startingFixtureSHA256: hash(join(docs, `fixtures/${task}.json`)),
    status: 'RUNNING',
    events: [],
    started: new Date().toISOString(),
    negative: {
      status: 'NOT_REACHED',
      reason: 'No independently correct proposal yet',
    },
  };
  active = entry;
  results.push(entry);
  publish();
  let role = 'executor',
    negative = false,
    servedNegative = false;
  let shadow = structuredClone(source.before),
    successfulOperations: any[] = [],
    negativeOperations: any[] = [],
    reviewIndex = 0;
  let lastCorrect:
    { session: any; operations: any[]; event: number } | undefined;
  const persist = () => {
    save(join(folder, `${entry.id}.json`), entry);
    publish();
  };
  const fetcher = meter(
    () => ({ caseId: entry.id, role, version }),
    () => persist(),
  );
  const provider = live
    ? createProvider(process.env.ATELIER_OPENAI_API_KEY, fetcher, {
        agent: true,
        textApi: 'responses',
      })
    : null;
  const sel = (ref: string) => ({
    refs: [ref],
    role: null,
    level: null,
    nameContains: null,
  });
  const offlineCriteria = {
    modeling: true,
    editable: Object.keys(source.moves),
    qualitativeLimits: [],
    checks: [
      ...source.expected.project.volumes.map((p: any, i: number) => ({
        source: 'request',
        evidence: tasks[task].prompt,
        requirement: {
          id: `p${i}`,
          label: 'Offline reference location',
          kind: 'positions',
          selector: sel(p.id),
          points: [p.position],
          tolerance: 0.001,
        },
      })),
      ...source.expected.project.volumes
        .filter((p: any) => source.moves[p.id]?.extend)
        .map((p: any, i: number) => ({
          source: 'request',
          evidence: tasks[task].prompt,
          requirement: {
            id: `h${i}`,
            label: 'Offline reference height',
            kind: 'measure',
            selector: sel(p.id),
            metric: 'height',
            aggregation: 'each',
            comparison: 'equal',
            value: p.dimensions.height,
            tolerance: 0.001,
            relativeTolerance: 0,
          },
        })),
    ],
  };
  const reviews = () =>
    entry.events
      .filter((e: any) => e.kind === 'reviewer' && e.response)
      .map((e: any) => e.response);
  const record = async (kind: string, input: any, signal: any) => {
    role = kind;
    const event: any = { kind, input, started: new Date().toISOString() };
    entry.events.push(event);
    persist();
    try {
      const out = await (kind === 'executor'
        ? provider.plan(input, signal)
        : provider.completionCriteria(input, signal));
      event.response = out;
      if (kind === 'executor' && out.intent === 'apply') {
        try {
          const next = await applyPlan(shadow, out, input.scene?.camera, true);
          shadow = next.session;
          successfulOperations.push(
            ...(next.effectiveOperations ?? out.operations),
          );
          event.replayedProject = shadow.project;
          // This is a replay of the returned operations, not a claimed browser save.
          event.proposalFacts = await oracle(task, source.before, shadow);
          if (pass(event.proposalFacts)) {
            lastCorrect = {
              session: structuredClone(shadow),
              operations: structuredClone(successfulOperations),
              event: entry.events.length - 1,
            };
            entry.correctProposal = {
              event: entry.events.length - 1,
              source:
                'Returned operations replayed with frozen engine; browser save scored separately',
            };
          }
        } catch (e) {
          event.shadowError = safe(e);
        }
      }
      return out;
    } catch (e) {
      event.error = safe(e);
      throw e;
    } finally {
      event.elapsedMs = Date.now() - Date.parse(event.started);
      persist();
    }
  };
  const wrapper = {
    agent: true,
    voice: async () => {
      throw Error('Voice excluded');
    },
    plan: async (input: any, signal: any) => {
      if (negative) {
        if (!servedNegative) {
          servedNegative = true;
          return plan(negativeOperations);
        }
        entry.negative.feedback = input.validationFeedback;
        persist();
        throw new TaskBlockedError(
          'Controlled wrong geometry stopped after verification. No scripted repair.',
        );
      }
      if (!live) return plan(referenceOperations(task));
      return record('executor', input, signal);
    },
    completionCriteria: async (input: any, signal: any) => {
      if (negative) {
        entry.negative.reviewRequests ??= [];
        entry.negative.reviewRequests.push(input);
        const list = live ? reviews() : [offlineCriteria];
        assert(list.length, 'No fresh review exists for control');
        return list[Math.min(reviewIndex++, list.length - 1)];
      }
      if (!live) return offlineCriteria;
      return record('reviewer', input, signal);
    },
  };
  const app = createApi(wrapper);
  app.use(express.static(join(v.path, 'dist')));
  app.get('/', (_q: any, r: any) =>
    r.sendFile(join(v.path, 'dist/index.html')),
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.on('listening', r));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  async function open() {
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
              {
                name: 'atelier.session.v2',
                value: serializeSession(source.before),
              },
              {
                name: 'atelier.conversation.v2',
                value: JSON.stringify(tasks[task].history),
              },
            ],
          },
        ],
      },
    });
    await context.route('**/*', (r: any) =>
      new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
    );
    const p = await context.newPage();
    p.setDefaultTimeout(30000);
    p.on('pageerror', (e: any) => {
      (entry.browserErrors ??= []).push(safe(e));
      persist();
    });
    await p.goto(origin);
    await expect(p.getByTestId('viewport')).toBeVisible({ timeout: 45000 });
    await expect
      .poll(
        async () => equalData(model(await saved(p)), model(source.before)),
        { timeout: 30000 },
      )
      .toBe(true);
    return p;
  }
  async function send(p: any) {
    const count = (await conversation(p)).length;
    await p
      .getByRole('textbox', { name: 'Message Atelier' })
      .fill(tasks[task].prompt);
    await p.getByRole('button', { name: 'Send message', exact: true }).click();
    const deadline = Date.now() + conditions.turnDeadlineMs;
    while (Date.now() < deadline) {
      if (
        (await conversation(p)).length >= count + 2 &&
        !(await modelingActive(p))
      )
        return;
      await new Promise((r) => setTimeout(r, 300));
    }
    throw Error('Turn deadline reached without forcing completion');
  }
  async function persistence(p: any, before: any, after: any) {
    const chat = await conversation(p);
    await p.reload();
    await expect(p.getByTestId('viewport')).toBeVisible({ timeout: 45000 });
    await expect
      .poll(async () => equalData(model(await saved(p)), model(after)))
      .toBe(true);
    assert(equalData(await conversation(p), chat));
    await p.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect
      .poll(async () =>
        equalData((await saved(p)).project.volumes, before.project.volumes),
      )
      .toBe(true);
    assert(equalData((await saved(p)).project.groups, before.project.groups));
    await p.reload();
    await expect(p.getByTestId('viewport')).toBeVisible();
    await p.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect
      .poll(async () => equalData(model(await saved(p)), model(after)))
      .toBe(true);
    assert.equal(after.past.length, before.past.length + 1);
    return {
      reload: true,
      undo: true,
      reloadWhileUndone: true,
      redo: true,
      atomic: true,
      conversation: true,
    };
  }
  async function hostReport(candidate: any) {
    const list = live ? reviews() : [offlineCriteria];
    if (!list.length) return null;
    let i = 0;
    return completionVerifier(
      source.before,
      tasks[task].prompt,
      async () => list[Math.min(i++, list.length - 1)],
    )(candidate);
  }
  let page: any;
  try {
    page = await open();
    await page.screenshot({ path: join(folder, `${entry.id}-before.png`) });
    const before = await saved(page);
    await send(page);
    const after = await saved(page);
    entry.after = after;
    entry.conversation = await conversation(page);
    entry.committed = !equalData(model(before), model(after));
    entry.facts = await oracle(task, before, after);
    entry.savedGeometryCorrect = pass(entry.facts);
    entry.proposal = live ? shadow : after;
    entry.proposalFacts = await oracle(task, before, entry.proposal);
    entry.proposalCorrect = pass(entry.proposalFacts);
    entry.hostReport = await hostReport(entry.proposal);
    entry.changedIds = before.project.volumes
      .filter(
        (p: any) =>
          !equalData(
            p,
            after.project.volumes.find((q: any) => q.id === p.id),
          ),
      )
      .map((p: any) => p.id);
    entry.preservedIds = before.project.volumes
      .filter((p: any) => !entry.changedIds.includes(p.id))
      .map((p: any) => p.id);
    if (entry.committed) {
      entry.transaction = await persistence(page, before, after);
      entry.status = entry.savedGeometryCorrect
        ? 'PASS'
        : 'COMMITTED_INCORRECT';
    } else {
      assert(equalData(model(before), model(after)));
      await page.reload();
      await expect(page.getByTestId('viewport')).toBeVisible();
      await expect
        .poll(async () => equalData(model(await saved(page)), model(before)))
        .toBe(true);
      entry.originalPreserved = true;
      entry.reload = true;
      entry.status = 'NOT_COMMITTED';
    }
    await page.screenshot({ path: join(folder, `${entry.id}-after.png`) });
    await page.context().close();
    page = null;
    persist();
    // A control requires an actually correct proposal, never an invented success.
    const controlSource = entry.proposalCorrect
      ? {
          session: entry.proposal,
          operations: live ? successfulOperations : referenceOperations(task),
          event: 'final',
        }
      : lastCorrect;
    if (!controlSource) {
      entry.negative.reason =
        'No independently correct proposal was produced; dependent control not reached';
      return;
    }
    if (live && !reviews().length) {
      entry.negative.reason =
        'Correct proposal exists but no fresh criteria were returned; dependent control not reached';
      return;
    }
    negative = true;
    negativeOperations = [...controlSource.operations, negativeOperation(task)];
    assert(
      negativeOperations.length <= 64,
      'Control cannot collapse beyond transaction operation limit',
    );
    const wrong = (
      await applyPlan(before, plan(negativeOperations), undefined, true)
    ).session;
    entry.negative = {
      status: 'RUNNING',
      correctSourceEvent: controlSource.event,
      correctSourceFacts: await oracle(task, before, controlSource.session),
      source:
        'Fresh criteria retained; saved executor operations plus deliberate perturbation; no new API call',
      proposal: wrong,
      facts: await oracle(task, before, wrong),
      report: await hostReport(wrong),
    };
    assert(!pass(entry.negative.facts));
    persist();
    page = await open();
    await send(page);
    const rejected = await saved(page);
    entry.negative.committed = !equalData(model(before), model(rejected));
    entry.negative.saved = rejected;
    entry.negative.conversation = await conversation(page);
    await page.reload();
    await expect(page.getByTestId('viewport')).toBeVisible();
    await expect
      .poll(async () => equalData(model(await saved(page)), model(rejected)))
      .toBe(true);
    entry.negative.originalPreserved = equalData(
      model(before),
      model(rejected),
    );
    entry.negative.reload = true;
    entry.negative.status = entry.negative.committed
      ? 'FALSE_ACCEPT'
      : entry.negative.report?.status === 'incorrect'
        ? 'BLOCKED_MEASURED'
        : 'BLOCKED_UNRESOLVED';
    await page.screenshot({ path: join(folder, `${entry.id}-negative.png`) });
    persist();
  } catch (e) {
    entry.error = safe(e);
    entry.status = entry.status === 'RUNNING' ? 'INCOMPLETE' : entry.status;
    if (page) {
      await cancelModeling(page).catch(() => {});
      entry.afterError = await saved(page).catch(() => null);
    }
  } finally {
    if (page) await page.context().close();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    entry.elapsedMs = Date.now() - Date.parse(entry.started);
    entry.cost = live ? costs(entry.id) : { calls: 0 };
    persist();
    console.log(
      JSON.stringify({
        id: entry.id,
        status: entry.status,
        proposalCorrect: entry.proposalCorrect,
        savedGeometryCorrect: entry.savedGeometryCorrect,
        negative: entry.negative.status,
        cost: entry.cost,
        error: entry.error,
      }),
    );
  }
}
try {
  for (const pair of conditions.order) {
    const [task, version] = pair.split('-') as [Task, Version];
    if (
      live &&
      (stopReason() || ledger().calls.length >= 20 || costs().accountedUSD >= 3)
    ) {
      results.push({
        id: pair,
        task,
        version,
        commit: versions[version].commit,
        status: 'NOT_STARTED_LIMIT',
        reason: stopReason() ?? 'Approved accounting/call ceiling',
        negative: { status: 'NOT_REACHED' },
      });
      publish();
      continue;
    }
    await trial(task, version);
  }
} finally {
  await browser.close();
  publish();
  closeSync(fd);
  unlinkSync(lock);
}
