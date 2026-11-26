/** Fresh normal-browser trial; offline mode is explicitly scripted and cannot spend. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  openSync,
  closeSync,
  unlinkSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import express from 'express';
import { chromium, expect } from '@playwright/test';
import { createApi } from '../../server/app';
import { createProvider } from '../../server/provider';
import { TaskBlockedError } from '../../src/intelligence/planFailure';
import {
  parseSession,
  serializeSession,
  type Session,
} from '../../src/intelligence/engine';
import { equalData } from '../../src/projects/equalData';
import { completionVerifier } from '../../src/intelligence/completionVerifier';
import {
  modelingActive,
  cancelModeling,
} from '../release-evaluation/browser-state';
import { projectFile } from '../../src/projects/transfer';
import {
  root,
  docs,
  protocol,
  appCommit,
  conditions,
  prompts,
  originalQuote,
} from './config';
import { TrialBudget, save, safe } from './budget';
import { bind, inventory, oracle, type Binding } from './geometry';
import { empty, offlinePlan, checks } from './calibration';
const mode = process.argv[2],
  batch = process.argv[3] ?? (mode === '--live' ? 'live-1' : 'offline-1');
assert(['--freeze', '--offline', '--live'].includes(mode));
mkdirSync(root, { recursive: true });
mkdirSync(docs, { recursive: true });
const git = (...a: string[]) =>
  execFileSync('git', a, { encoding: 'utf8' }).trim();
assert.equal(
  git(
    'diff',
    appCommit,
    '--',
    'src',
    'server',
    'package.json',
    'package-lock.json',
  ),
  '',
  'Frozen application differs',
);
const walk = (p: string): string[] =>
  readdirSync(p, { withFileTypes: true }).flatMap((f) =>
    f.isDirectory() ? walk(join(p, f.name)) : [join(p, f.name)],
  );
const hash = (p: string) =>
  createHash('sha256').update(readFileSync(p)).digest('hex');
const freeze = () => ({
  appCommit,
  conditions,
  files: Object.fromEntries(
    [
      ...walk('scripts/design-decision-live'),
      ...walk('src'),
      ...walk('server'),
      ...walk('dist'),
      protocol,
      'scripts/completion-evaluation/budget.ts',
      join(root, 'authorization.json'),
      join(root, 'preflight/model.json'),
      join(root, 'preflight/documented-pricing.json'),
    ]
      .sort()
      .map((p) => [p, hash(p)]),
  ),
});
const frozen = join(root, 'FREEZE.json');
if (mode === '--freeze') {
  assert(!existsSync(frozen), 'Never overwrite frozen conditions');
  assert(
    JSON.parse(readFileSync(join(root, 'calibration.json'), 'utf8'))
      .wrongPanelBlocked,
  );
  assert.equal(
    JSON.parse(readFileSync(join(root, 'offline-2/results.json'), 'utf8'))
      .status,
    'OFFLINE_PASS',
  );
  assert.equal(
    git('status', '--porcelain', '--', 'scripts/design-decision-live'),
    '',
    'Commit evaluation harness before freezing',
  );
  save(frozen, freeze());
  save(join(docs, 'FREEZE.json'), {
    ...freeze(),
    evaluatorCommit: git('rev-parse', 'HEAD'),
    frozenAt: new Date().toISOString(),
  });
  console.log('Frozen; zero paid calls');
  process.exit(0);
}
const live = mode === '--live';
if (live) {
  assert.deepEqual(
    freeze(),
    JSON.parse(readFileSync(frozen, 'utf8')),
    'Frozen evaluation changed',
  );
  assert(process.env.ATELIER_OPENAI_API_KEY);
}
const folder = join(root, batch);
assert(!existsSync(join(folder, 'results.json')), 'Never overwrite an attempt');
mkdirSync(folder, { recursive: true });
const lock = join(root, 'coordinator.lock'),
  fd = openSync(lock, 'wx');
const budget = new TrialBudget(root),
  scope = new AsyncLocalStorage<{
    turn: number;
    role: string;
    event: number;
  }>();
const result: any = {
  label: live
    ? 'Fresh GPT-6.1-sol; unmodified browser application; independent kernel measurements'
    : 'Scripted calibration only; no fresh AI',
  appCommit,
  batch,
  started: new Date().toISOString(),
  turns: [],
  status: 'RUNNING',
};
let active: any,
  before = empty(),
  stage = 0,
  binding: Binding | undefined;
const publish = () => {
  save(join(folder, 'results.json'), result);
  save(join(folder, 'spending.json'), budget.costs());
  save(join(docs, batch + '-progress.json'), {
    label: result.label,
    appCommit,
    status: result.status,
    stopReason: result.stopReason,
    turns: result.turns.map((t: any) => ({
      turn: t.turn,
      status: t.status,
      committed: t.committed,
      objects: t.objects,
      elapsedMs: t.elapsedMs,
      error: t.error,
      decision: t.decision,
      recall: t.recall,
      wrong: t.measurements?.facts.filter((f: any) => f.status !== 'verified'),
    })),
    costs: budget.costs(),
  });
};
process.env.ATELIER_AGENT_MODEL = 'gpt-6.1-sol';
const provider = live
  ? createProvider(
      process.env.ATELIER_OPENAI_API_KEY!,
      ((url, init) => {
        const s = scope.getStore();
        assert(s, 'Paid call outside recorded event');
        return budget.call(s, url, init);
      }) as typeof fetch,
      { agent: true, textApi: 'responses' },
    )
  : null;
const record = async (kind: string, input: any, signal: any) => {
  const event: any = { kind, input, started: new Date().toISOString() },
    index = active.events.length;
  active.events.push(event);
  publish();
  try {
    event.response = await scope.run(
      { turn: active.turn, role: kind, event: index },
      () =>
        kind === 'executor'
          ? provider!.plan(input, signal)
          : provider!.completionCriteria!(input, signal),
    );
    return event.response;
  } catch (e) {
    event.error = safe(e);
    throw e;
  } finally {
    event.elapsedMs = Date.now() - Date.parse(event.started);
    publish();
  }
};
const app = createApi({
  agent: true,
  voice: async () => {
    throw Error('Voice excluded');
  },
  plan: async (input, signal) => {
    stage++;
    if (!live) {
      if (input.validationFeedback)
        throw new TaskBlockedError(
          'Unexpected calibration feedback; stop without scripted repair.',
        );
      return offlinePlan(active.turn, before) as any;
    }
    return record('executor', input, signal);
  },
  completionCriteria: async (input, signal) => {
    if (!live) {
      const out = checks(active.turn, before);
      active.events.push({
        kind: 'reviewer',
        input,
        response: out,
        scripted: true,
      });
      publish();
      return out;
    }
    return record('reviewer', input, signal);
  },
});
app.use(express.static(resolve('dist')));
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
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
  storageState: {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [
          { name: 'atelier.start-direct', value: 'true' },
          { name: 'atelier.session.v2', value: serializeSession(empty()) },
          { name: 'atelier.conversation.v2', value: '[]' },
        ],
      },
    ],
  },
});
await context.route('**/*', (r) =>
  new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
);
const page = await context.newPage();
page.setDefaultTimeout(30000);
page.on('pageerror', (e) => {
  if (active) {
    (active.browserErrors ??= []).push(safe(e));
    publish();
  }
});
const saved = async () =>
  parseSession(
    await page.evaluate(() => localStorage.getItem('atelier.session.v2')!),
  );
const messages = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('atelier.conversation.v2') ?? '[]'),
  );
const state = (s: Session) => ({
  project: s.project,
  past: s.past,
  future: s.future,
  context: s.context,
});
async function durable(s: Session) {
  let count = 0;
  await expect
    .poll(
      async () => {
        const records = await page.evaluate(
          () =>
            new Promise<any[]>((res, rej) => {
              const q = indexedDB.open('atelier-projects', 1);
              q.onerror = () => rej(q.error);
              q.onsuccess = () => {
                const db = q.result,
                  r = db
                    .transaction('projects', 'readonly')
                    .objectStore('projects')
                    .getAll();
                r.onerror = () => rej(r.error);
                r.onsuccess = () => {
                  db.close();
                  res(r.result);
                };
              };
            }),
        );
        count = records.length;
        return records.some((r) =>
          equalData(state(parseSession(r.session)), state(s)),
        );
      },
      { timeout: 25000 },
    )
    .toBe(true);
  return { matchingIndexedDBProject: true, projectCount: count };
}
async function reload(s: Session, clear = false) {
  const chat = await messages();
  await durable(s);
  if (clear)
    await page.evaluate(() => {
      localStorage.removeItem('atelier.session.v2');
      localStorage.removeItem('atelier.conversation.v2');
      localStorage.removeItem('atelier.project.checkpoint');
    });
  await page.reload();
  await expect(page.getByTestId('viewport')).toBeVisible({ timeout: 45000 });
  await expect
    .poll(async () => equalData(state(await saved()), state(s)), {
      timeout: 30000,
    })
    .toBe(true);
  assert(equalData(await messages(), chat));
  return {
    project: true,
    notes: true,
    history: true,
    conversation: true,
    context: true,
    indexedDBOnly: clear,
  };
}
async function historyCheck(previous: Session, after: Session) {
  await reload(after);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(async () => equalData((await saved()).project, previous.project), {
      timeout: 30000,
    })
    .toBe(true);
  const undone = await saved();
  save(join(folder, `turn-${active.turn}-undone.json`), undone);
  await reload(undone, true);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect
    .poll(async () => equalData(state(await saved()), state(after)), {
      timeout: 30000,
    })
    .toBe(true);
  assert.equal(after.past.length, previous.past.length + 1);
  return {
    reload: true,
    undo: true,
    reloadWhileUndone: true,
    redo: true,
    decisionVersionsRestored: true,
    oneAtomicUndo: true,
  };
}
try {
  await page.goto(origin);
  await expect(page.getByTestId('viewport')).toBeVisible({ timeout: 45000 });
  assert.equal((await saved()).project.volumes.length, 0);
  for (let turn = 1; turn <= 14; turn++) {
    if (budget.blocked) {
      result.stopReason = budget.blocked;
      break;
    }
    before = await saved();
    stage = 0;
    active = {
      turn,
      prompt: prompts[turn - 1],
      started: new Date().toISOString(),
      status: 'RUNNING',
      events: [],
    };
    result.turns.push(active);
    publish();
    save(join(folder, `turn-${turn}-before.json`), before);
    save(join(folder, `turn-${turn}-history-before.json`), await messages());
    try {
      if ([12, 14].includes(turn))
        active.preEditReload = await reload(before, true);
      const prior = (await messages()).length,
        input = page.getByRole('textbox', { name: 'Message Atelier' });
      if (!(await input.isVisible()))
        await page
          .getByRole('button', { name: 'Voice orb', exact: true })
          .dblclick();
      await input.fill(active.prompt);
      await page
        .getByRole('button', { name: 'Send message', exact: true })
        .click();
      const deadline = Date.now() + conditions.turnDeadlineMs;
      while (Date.now() < deadline) {
        if (
          (await messages()).length >= prior + 2 &&
          !(await modelingActive(page))
        )
          break;
        await page.waitForTimeout(350);
      }
      assert(
        !(await modelingActive(page)) && (await messages()).length >= prior + 2,
        'Trial deadline; not a forced completion',
      );
      const after = await saved(),
        chat = await messages();
      save(join(folder, `turn-${turn}-after.json`), after);
      save(join(folder, `turn-${turn}-history-after.json`), chat);
      await context.storageState({
        path: join(folder, `turn-${turn}-browser.json`),
      });
      const file = projectFile(
        { session: serializeSession(after), messages: chat },
        `Decision-trial-turn-${turn}`,
      );
      save(
        join(folder, `turn-${turn}-export.json`),
        JSON.parse(await file.text()),
      );
      active.committed = !equalData(state(before), state(after));
      active.objects = after.project.volumes.length;
      active.changedIds = before.project.volumes
        .filter(
          (v) =>
            !equalData(
              v,
              after.project.volumes.find((n) => n.id === v.id),
            ),
        )
        .map((v) => v.id);
      active.preservedIds = before.project.volumes
        .filter((v) =>
          equalData(
            v,
            after.project.volumes.find((n) => n.id === v.id),
          ),
        )
        .map((v) => v.id);
      active.notes = after.project.design?.notes ?? [];
      active.decision = active.notes
        .filter((n: any) => n.decision)
        .map((n: any) => ({ topic: n.topic, ...n.decision }));
      const requests = active.events.filter((e: any) => e.input);
      if (turn === 12) {
        const h =
          requests.find((e: any) => e.kind === 'executor')?.input.history ?? [];
        active.recall = {
          originalInstructionInRecentHistory: h.some((m: any) =>
            m.content.includes('Leave exactly 32 cm'),
          ),
          potentialAssistantReminders: h.filter(
            (m: any) =>
              m.role === 'assistant' &&
              /32\s*(?:cm|centimet)|0\.32|bulky samples|sample.loading|clearance/i.test(
                m.content,
              ),
          ),
          recentHistory: h,
          decisionInOriginalNotes: before.project.design?.notes ?? [],
          source:
            'Requires human semantic review; pre-edit geometry itself also reveals the gap',
        };
      }
      const reviews = active.events.filter(
        (e: any) => e.kind === 'reviewer' && e.response,
      );
      active.reviewerCitations = reviews.map((e: any) => ({
        checks: e.response.checks,
        qualitativeLimits: e.response.qualitativeLimits,
        editable: e.response.editable,
      }));
      if (active.committed) {
        binding ??= bind(await inventory(after));
        active.measurements = await oracle(
          turn,
          before,
          after,
          binding,
          requests.find((e: any) => e.kind === 'executor')?.input.scene.camera,
        );
        if (reviews.length) {
          let i = 0;
          active.hostReplay = await completionVerifier(
            before,
            active.prompt,
            async () => {
              assert(i < reviews.length, 'Missing captured reviewer response');
              return reviews[i++].response;
            },
          )(after);
        }
        active.durable = await durable(after);
        assert.equal(
          after.past.length,
          before.past.length + 1,
          'Non-atomic saved transaction',
        );
        if ([1, 12, 13, 14].includes(turn))
          active.historyCheck = await historyCheck(before, after);
        active.status = active.measurements.correct
          ? active.measurements.fullyMeasured
            ? 'PASS'
            : 'SAVED_WITH_UNVERIFIED_EXTERNAL_PROPERTY'
          : 'COMMITTED_INCORRECT';
      } else {
        assert(
          equalData(state(before), state(after)),
          'Uncommitted request changed the project',
        );
        active.originalPreserved = true;
        active.status = 'NOT_COMMITTED';
        active.reload = await reload(before, true);
      }
      await page.screenshot({ path: join(folder, `turn-${turn}.png`) });
      if ([1, 12, 13, 14].includes(turn) && active.committed) {
        const close = page.getByRole('button', {
          name: 'Minimize conversation',
          exact: true,
        });
        if (await close.isVisible()) await close.click();
        await page
          .getByRole('button', { name: 'Frame all', exact: true })
          .click();
        await page.waitForTimeout(900);
        await page.screenshot({
          path: join(folder, `turn-${turn}-framed.png`),
        });
      }
    } catch (e) {
      active.error = safe(e);
      active.status = 'INCOMPLETE_OR_HARNESS_FAILURE';
      await cancelModeling(page).catch(() => {});
      save(join(folder, `turn-${turn}-after-error.json`), await saved());
    }
    active.elapsedMs = Date.now() - Date.parse(active.started);
    active.costs = budget.costs();
    publish();
    console.log(
      JSON.stringify({
        turn,
        status: active.status,
        objects: active.objects,
        wrong: active.measurements?.facts.filter(
          (f: any) => f.status !== 'verified',
        ),
        costs: budget.costs(),
        error: active.error,
      }),
    );
    if (
      !['PASS', 'SAVED_WITH_UNVERIFIED_EXTERNAL_PROPERTY'].includes(
        active.status,
      )
    ) {
      result.stopReason = `Turn ${turn}: ${active.status}`;
      break;
    }
  }
  result.status =
    result.turns.length === 14 &&
    result.turns.every((t: any) =>
      ['PASS', 'SAVED_WITH_UNVERIFIED_EXTERNAL_PROPERTY'].includes(t.status),
    )
      ? live
        ? 'FRESH_SESSION_COMPLETED'
        : 'OFFLINE_PASS'
      : 'INCOMPLETE';
  result.notReached = prompts
    .map((p, i) => ({ turn: i + 1, prompt: p }))
    .slice(result.turns.length);
  result.finished = new Date().toISOString();
  publish();
} catch (e) {
  result.status = 'HARNESS_INTERRUPTED';
  result.error = safe(e);
  publish();
  throw e;
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  closeSync(fd);
  unlinkSync(lock);
  publish();
}
