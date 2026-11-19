/** Frozen acceptance harness. Changes only tests/evidence, never production code. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  openSync,
  closeSync,
  unlinkSync,
} from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { createServer } from 'vite';
import { chromium, expect, type Page } from '@playwright/test';
import { createApi } from '../server/app';
import { createProvider, type Provider } from '../server/provider';
import { TaskBlockedError } from '../src/intelligence/planFailure';
import {
  applyPlan,
  directPlan,
  newSession,
  parseSession,
  serializeSession,
  type Session,
} from '../src/intelligence/engine';
import { stagedPlan } from '../src/intelligence/checkedPlanner';
import { defaultCamera, sceneContext } from '../src/intelligence/context';
import { verifyCompletion } from '../src/intelligence/completion';
import type { CompletionCriteria } from '../src/intelligence/completionSchema';
import { equalData } from '../src/projects/equalData';
import {
  save,
  pricing,
  model,
  ceilingUsd as originalCeilingUsd,
  budgetUsed,
  type Ledger,
} from './completion-evaluation/budget';
import { piece } from './completion-evaluation/cases';
import {
  order,
  prompts,
  specification,
  seed,
  oracle,
  passed,
  incorrect,
  ellipse,
  ellipseControls,
  measurements,
  targets,
  type CaseId,
} from './release-evaluation/cases';
import {
  waitForModelingStart,
  modelingActive,
  cancelModeling,
} from './release-evaluation/browser-state';
import {
  continuationFetch,
  digest,
  originalCalls,
  settledCalls,
} from './release-evaluation/continuation-budget';
import { assertReplayScene, replayResponse } from './release-evaluation/replay';
import {
  aggregateFetch,
  priorAccounting,
  type AggregateAuthorization,
} from './release-evaluation/aggregate-budget';
import { evaluationOutcome } from './release-evaluation/outcome';

const release20 = process.argv.includes('--release20');
const focusedBuilding = process.argv.includes('--focused-building');
assert(
  !focusedBuilding || release20,
  'Focused sequence requires aggregate accounting.',
);
const evaluationOrder: readonly CaseId[] = focusedBuilding
  ? ['building', 'height-edit']
  : order;
const candidateArg = process.argv.find((a) =>
  /^--candidate=[a-f0-9]{40}$/.test(a),
);
const attemptArg = process.argv.find((a) => /^--attempt=[1-9]$/.test(a));
const releaseAttempt = Number(attemptArg?.split('=')[1] ?? 1);
if (release20)
  assert(candidateArg, 'Pin the application candidate before evaluation.');
const applicationCommit = release20
  ? candidateArg!.split('=')[1]
  : 'e9e3aae86e559ed9131609e2a2f3eb3e75299fba';
const ceilingUsd = release20 ? 20 : originalCeilingUsd;
const maximumCalls = release20 ? 60 : 32;
const resumingInspection = process.argv.includes('--resume-inspection');
const resumingBuilding =
  process.argv.includes('--resume-building') || resumingInspection;
const previousFolder = resumingInspection
  ? '.cloud/pr22-release-resumed-building'
  : '.cloud/pr22-release-continuation-438';
assert(
  !release20 || !resumingBuilding,
  'Fresh live evaluation; do not substitute previous model responses.',
);
const folder = release20
  ? `.cloud/pr22-release20-final-${releaseAttempt}`
  : resumingInspection
    ? '.cloud/pr22-release-resumed-inspection'
    : resumingBuilding
      ? '.cloud/pr22-release-resumed-building'
      : previousFolder;
const carryForward = {
  authorized: true,
  actualUsage: 'unknown' as const,
  allowanceUsd: 0.62,
  maximumAdditionalUsd: 4.38,
  originalLedgerPath: '.cloud/pr22-release-final-5usd/ledger.json',
  originalLedgerSha256: digest('.cloud/pr22-release-final-5usd/ledger.json'),
  ...(resumingBuilding
    ? {
        settledLedgers: [
          ...(resumingInspection
            ? [
                {
                  path: '.cloud/pr22-release-continuation-438/ledger.json',
                  sha256: digest(
                    '.cloud/pr22-release-continuation-438/ledger.json',
                  ),
                },
              ]
            : []),
          {
            path: `${previousFolder}/ledger.json`,
            sha256: digest(`${previousFolder}/ledger.json`),
          },
        ],
      }
    : {}),
};
const aggregateAuthorization: AggregateAuthorization | undefined = release20
  ? {
      approved: true,
      ceilingUsd: 20,
      unknownAllowanceUsd: 0.62,
      unknownLedger: {
        path: carryForward.originalLedgerPath,
        sha256: carryForward.originalLedgerSha256,
      },
      settledLedgers: [
        '.cloud/pr22-release-continuation-438',
        '.cloud/pr22-release-resumed-building',
        '.cloud/pr22-release-resumed-inspection',
      ].map((p) => ({
        path: `${p}/ledger.json`,
        sha256: digest(`${p}/ledger.json`),
      })),
      interruptedLedgers: Array.from({ length: releaseAttempt - 1 }, (_, i) => {
        const path = `.cloud/pr22-release20-final-${i + 1}/ledger.json`;
        return { path, sha256: digest(path) };
      }),
      maximumCalls: 60,
      maximumCallsPerTask: focusedBuilding ? 24 : 16,
    }
  : undefined;
const interruptedCalls = originalCalls(carryForward);
const settledPriorCalls = aggregateAuthorization
  ? priorAccounting(aggregateAuthorization).calls.slice(1)
  : settledCalls(carryForward);
const priorCalls = [...interruptedCalls, ...settledPriorCalls];
const priorKnownUsd = settledPriorCalls.reduce(
  (n, c) => n + (c.estimatedUsd ?? 0),
  0,
);
const priorAccountedUsd = settledPriorCalls.reduce(
  (n, c) => n + (c.chargedUsd ?? c.reservedUsd),
  0,
);
const previousResults = resumingBuilding
  ? JSON.parse(readFileSync(`${previousFolder}/results.json`, 'utf8')).results
  : [];
const buildingEvents = resumingBuilding
  ? previousResults.find((r: any) => r.id === 'building').events
  : [];
const replayCount = resumingBuilding
  ? buildingEvents.findIndex((e: any) => !e.response)
  : 0;
if (resumingBuilding)
  assert(
    replayCount > 0 &&
      buildingEvents
        .slice(0, replayCount)
        .every(
          (e: any) => e.kind === 'executor' && e.response.intent === 'apply',
        ),
  );
let replayIndex = 0;
mkdirSync(folder, { recursive: true });
const ledgerPath = `${folder}/ledger.json`,
  manifestPath = `${folder}/manifest.json`;
const hash = (x: unknown) =>
  createHash('sha256')
    .update(typeof x === 'string' ? x : JSON.stringify(x))
    .digest('hex');
const git = (...args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8' }).trim();
const harnessFiles = [
  'scripts/evaluate-release.ts',
  'scripts/release-evaluation/cases.ts',
  'scripts/release-evaluation/browser-state.ts',
  'scripts/release-evaluation/continuation-budget.ts',
  'scripts/release-evaluation/replay.ts',
  'scripts/release-evaluation/aggregate-budget.ts',
  'scripts/release-evaluation/outcome.ts',
  'scripts/completion-evaluation/budget.ts',
  'scripts/completion-evaluation/cases.ts',
  'package-lock.json',
];
const manifest = {
  applicationCommit,
  source: {
    src: git('rev-parse', 'HEAD:src'),
    server: git('rev-parse', 'HEAD:server'),
  },
  harnessHash: hash(harnessFiles.map((p) => readFileSync(p, 'utf8'))),
  distHash: hash(readFileSync('dist/index.html', 'utf8')),
  model,
  transport: 'responses',
  reasoning: { executor: 'high', reviewer: 'low' },
  maximumOutputTokens: 6000,
  maximumCalls,
  maximumCallsPerTask: aggregateAuthorization?.maximumCallsPerTask ?? 8,
  ceilingUsd,
  carryForward: aggregateAuthorization ?? carryForward,
  ...(release20
    ? {
        outcomeContract: {
          geometricRequirements:
            'All pre-existing external numeric and occupied-solid oracles must pass unchanged.',
          transactions:
            'Actual App commit, reload, context retention and one Undo/Redo; identities and unrelated geometry preserved.',
          hostVerification:
            'Incorrect or unsafe scope cannot commit. Verified stays verified. Unsupported properties stay explicitly unverified, never relabeled correct. External geometry evidence and honest unverified reporting are evaluated separately.',
          strictHistoricalOutcomes:
            'Earlier unverified outcomes and failures remain immutable. A new PASS_WITH_DISCLOSED_LIMITS records the passing external evaluation and incomplete built-in coverage separately; it does not certify unknown properties.',
          correction: focusedBuilding
            ? 'Prior correction evidence is preserved. This user-authorized sequence only reruns building creation and connected editing.'
            : 'Injected wrong geometry must be detected and repaired by real AI; controls and preservation requirements are unchanged.',
        },
      }
    : {}),
  ...(resumingBuilding
    ? {
        resumption: {
          sourceResultsSha256: digest(`${previousFolder}/results.json`),
          priorManifestSha256: digest(`${previousFolder}/manifest.json`),
          replayPaidResponses: Array.from(
            { length: replayCount },
            (_, i) => i + 1,
          ),
          strategy:
            'Reexecute exact saved real-AI responses in the actual App after checking equivalent scene context; continue with live reasoning at the unsent request. Preserve all previous costs and outcomes.',
          rerunTasks: ['building', 'height-edit'],
          retainedTasks: ['ellipse-repair', 'recovery-tray'],
        },
      }
    : {}),
  order: evaluationOrder,
  focusedBuilding,
  prompts,
  specification,
  pricing,
  authorization: release20
    ? 'User explicitly replaced the ceiling with US$20 AGGREGATE including all prior spending/reservations and US$0.62 unknown-call allowance. Focused application/harness fixes and reasonable bounded call-limit adjustments authorized. Merge/deploy only after all release gates pass.'
    : 'User approved continuing under the original US$5 aggregate including US$0.62 unknown-cost allowance; all calls count toward existing limits. Routine harness fixes and retries authorized. Merge/deploy only after every release condition passes.',
};
const live = process.argv.includes('--live');
assert(
  process.argv
    .slice(2)
    .every(
      (a) =>
        [
          '--prepare',
          '--live',
          '--approved-budget-usd=5',
          '--approved-continuation-usd=4.38',
          '--resume-building',
          '--resume-inspection',
          '--release20',
          '--focused-building',
          '--approved-aggregate-usd=20',
        ].includes(a) ||
        (release20 && (a === candidateArg || a === attemptArg)),
    ),
);
assert.equal(
  git(
    'diff',
    applicationCommit,
    'HEAD',
    '--',
    'src',
    'server',
    'package-lock.json',
  ),
  '',
  'Production candidate differs.',
);
assert.equal(
  git('diff', '--', 'src', 'server', 'package-lock.json'),
  '',
  'Uncommitted production edits.',
);
assert.equal(
  git('diff', '--cached', '--', 'src', 'server', 'package-lock.json'),
  '',
  'Staged production edits.',
);
if (live) {
  if (release20) assert(process.argv.includes('--approved-aggregate-usd=20'));
  else {
    assert(process.argv.includes('--approved-budget-usd=5'));
    assert(process.argv.includes('--approved-continuation-usd=4.38'));
  }
  assert(
    existsSync(ledgerPath) && existsSync(manifestPath),
    'Prepare before paid execution.',
  );
  assert.equal(
    hash(JSON.parse(readFileSync(manifestPath, 'utf8'))),
    hash(manifest),
    'Evaluation changed after freezing.',
  );
  const ledger: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  assert(
    !ledger.authorized && ledger.calls.length === 0,
    'Cannot reset or replay a used live ledger.',
  );
  assert(process.env.ATELIER_OPENAI_API_KEY, 'Missing configured credential.');
} else {
  if (existsSync(ledgerPath)) {
    const l: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    assert(!l.authorized && l.calls.length === 0);
  }
  save(manifestPath, manifest);
  save(`${folder}/carry-forward.json`, aggregateAuthorization ?? carryForward);
  save(ledgerPath, { authorized: false, ceilingUsd, calls: [] });
}
const lockPath = release20
  ? '.cloud/pr22-release20-paid-run.lock'
  : `${folder}/paid-run.lock`;
const lock = live ? openSync(lockPath, 'wx', 0o600) : undefined;
let caseId: CaseId = 'building',
  role: 'executor' | 'reviewer' = 'executor',
  active: any;
const results: any[] = [];
let stopped = false,
  offlineFailure = false,
  offlineFailureCalls = 0;
let gate:
  | {
      pending: boolean;
      performed: boolean;
      release: () => void;
      promise: Promise<void>;
    }
  | undefined;
function makeGate() {
  let release!: () => void;
  const promise = new Promise<void>((r) => (release = r));
  return { pending: false, performed: false, release, promise };
}
function persist() {
  save(`${folder}/results.json`, {
    applicationCommit,
    manifestHash: hash(manifest),
    results,
    stopped,
    ledger: JSON.parse(readFileSync(ledgerPath, 'utf8')),
  });
}
function safeError(e: any) {
  return e?.cause?.code === 'ERR_ASSERTION'
    ? String(e.cause.message)
    : e?.status
      ? `Provider HTTP ${e.status}`
      : e?.name?.startsWith('API')
        ? e.name
        : String(e?.message ?? e).replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]');
}
const scope = () => ({
  caseId,
  role,
});
const metered = aggregateAuthorization
  ? aggregateFetch(ledgerPath, aggregateAuthorization, scope)
  : continuationFetch(ledgerPath, carryForward, scope);
const guarded: typeof fetch = async (url, init) => {
  assert(live, 'Offline preparation cannot contact paid endpoints.');
  assert(evaluationOrder.includes(caseId));
  const ledger: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  assert(
    ledger.calls.length + priorCalls.length < maximumCalls,
    'Aggregate overall call limit reached.',
  );
  const payload = JSON.parse(init!.body as string);
  const attemptId = `${ledger.calls.length + 1}-${Date.now()}`;
  save(`${folder}/request-${attemptId}.json`, payload);
  console.log(
    `REQUEST ATTEMPT ${caseId} ${role} call ${ledger.calls.length + priorCalls.length + 1}; known cumulative estimate $${(priorKnownUsd + ledger.calls.reduce((n, c) => n + (c.estimatedUsd ?? 0), 0)).toFixed(4)}; sending only if spending guards pass`,
  );
  try {
    const response = await metered(url, init);
    save(`${folder}/request-${attemptId}.status.json`, {
      outcome: 'sent-and-reconciled',
    });
    return response;
  } catch (error) {
    const after: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    save(`${folder}/request-${attemptId}.status.json`, {
      outcome:
        after.calls.length === ledger.calls.length
          ? 'blocked-before-network'
          : 'sent-see-ledger',
      error: safeError(error),
    });
    throw error;
  }
};
process.env.ATELIER_AGENT_MODEL = model;
const provider = createProvider(
  live ? process.env.ATELIER_OPENAI_API_KEY! : 'offline',
  guarded,
  { agent: true, textApi: 'responses', maxOutputTokens: 6000 },
);
async function recordCall(
  kind: 'executor' | 'reviewer',
  input: any,
  signal?: AbortSignal,
) {
  role = kind;
  const event: any = { kind, started: new Date().toISOString(), input };
  active.events.push(event);
  persist();
  try {
    const start = performance.now();
    let replay: any;
    let replayed = false;
    if (
      resumingBuilding &&
      caseId === 'building' &&
      kind === 'executor' &&
      replayIndex <= replayCount
    ) {
      const savedEvent = buildingEvents[replayIndex];
      assertReplayScene(savedEvent.input, input);
      if (replayIndex < replayCount) {
        replay = replayResponse(savedEvent.input, input, savedEvent.response);
        replayed = true;
        event.replayedPaidCall = savedEvent.replayedPaidCall ?? {
          source: previousFolder,
          index: replayIndex + 1,
          originalElapsedMs: savedEvent.elapsedMs,
        };
      }
      replayIndex++;
      if (!live && !replayed) {
        event.offlineReplayValidated = true;
        throw new TaskBlockedError(
          'Offline replay validated. No new model call was made.',
        );
      }
    }
    const response = replayed
      ? replay
      : kind === 'executor'
        ? await provider.plan(input, signal)
        : await provider.completionCriteria!(input, signal);
    event.elapsedMs = performance.now() - start;
    event.response = response;
    if (kind === 'reviewer') active.criteria = response;
    if (
      (kind === 'reviewer' ||
        (kind === 'executor' && (response as any).intent === 'finish')) &&
      gate &&
      !gate.performed
    ) {
      gate.pending = true;
      const held = performance.now();
      await gate.promise;
      active.evaluationUiPauseMs =
        (active.evaluationUiPauseMs ?? 0) + performance.now() - held;
    }
    return response;
  } catch (e) {
    event.error = safeError(e);
    throw e;
  } finally {
    persist();
  }
}
const wrapped: Provider = {
  agent: true,
  voice: async () => {
    throw new Error('Paid voice is outside this evaluation.');
  },
  plan: async (input, signal) => {
    if (offlineFailure) {
      offlineFailureCalls++;
      if (offlineFailureCalls > 1)
        throw new TaskBlockedError(
          'Evaluation-injected blocked request. The provisional change was discarded. Your project is unchanged.',
        );
      return {
        intent: 'apply',
        message: 'Offline interruption control',
        planning: { stage: 'Provisional', assumptions: [], next: 'Stop' },
        operations: [
          {
            type: 'create_at',
            shape: 'box',
            name: 'Provisional interruption control',
            width: 0.6,
            height: 0.5,
            depth: 0.4,
            x: 35,
            y: 0,
            z: 35,
            rotation: 0,
          },
        ],
      };
    }
    return recordCall('executor', input, signal) as any;
  },
  completionCriteria: (input, signal) =>
    recordCall('reviewer', input, signal) as any,
};
// Serve the unchanged production build and actual API handlers on loopback only.
const app = createApi(wrapped);
app.use(express.static(resolve('dist')));
app.get('/', (_req, res) => res.sendFile(resolve('dist/index.html')));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((r) => server.on('listening', r));
const origin = `http://127.0.0.1:${(server.address() as any).port}`;
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
          { name: 'atelier.session.v2', value: serializeSession(seed()) },
        ],
      },
    ],
  },
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const browserErrors: string[] = [];
page.on('pageerror', (e) => browserErrors.push(e.message));
const vite = await createServer({
  server: { host: '127.0.0.1', port: 0 },
  appType: 'custom',
});
await vite.listen();
const observationPage = await browser.newPage();
await observationPage.route('**/__release-evaluation', (r) =>
  r.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Isolated evaluation observation</title>',
  }),
);
await observationPage.goto(
  `http://127.0.0.1:${(vite.httpServer!.address() as any).port}/__release-evaluation`,
);
await observationPage.evaluate(async () => {
  const path: string = '/src/geometry/kernel.ts',
    wasmPath: string = '/node_modules/manifold-3d/manifold.wasm?url';
  const k = await import(path),
    w = await import(wasmPath);
  k.setKernelWasmUrl(w.default);
});
async function observe(session: Session, label: string) {
  const start = performance.now();
  const observation = await observationPage.evaluate(
    async (project) => {
      const path: string = '/src/intelligence/renderObservation.ts';
      return (await import(path)).renderObservation(project);
    },
    JSON.parse(JSON.stringify(session.project)),
  );
  observation.views.forEach((v: any, i: number) =>
    writeFileSync(
      `${folder}/${label}-${i}.jpg`,
      Buffer.from(v.image.split(',')[1], 'base64'),
    ),
  );
  if (active)
    active.observationMs =
      (active.observationMs ?? 0) + performance.now() - start;
  return observation;
}
const saved = async () =>
  parseSession(
    await page.evaluate(() => localStorage.getItem('atelier.session.v2')!),
  );
const chat = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('atelier.conversation.v2') || '[]'),
  );
const stateModel = (s: Session) => {
  const { selectedId: _, selectedIds: __, ...p } = s.project;
  return { ...s, project: p, context: undefined };
};
async function ready() {
  await expect(page.getByTestId('viewport')).toBeVisible({ timeout: 45000 });
}
async function ensureChat() {
  const input = page.getByRole('textbox', { name: 'Message Atelier' });
  if (!(await input.isVisible())) {
    await page
      .getByRole('button', { name: 'Voice orb', exact: true })
      .dblclick();
  }
  await expect(input).toBeVisible();
  return input;
}
async function send(text: string) {
  await (await ensureChat()).fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
}
async function harmlessActivity(original: Session) {
  assert(
    equalData(stateModel(await saved()), stateModel(original)),
    'Provisional work already committed.',
  );
  await expect(
    page.getByText('Working preview · not saved yet', { exact: true }),
  ).toBeVisible();
  if (
    !(await page.getByRole('searchbox', { name: 'Find objects' }).isVisible())
  )
    await page
      .getByRole('button', { name: 'Show objects', exact: true })
      .click();
  await page
    .getByRole('searchbox', { name: 'Find objects' })
    .fill('Existing marker');
  await page
    .locator('.object-row')
    .filter({ hasText: 'Existing marker' })
    .click();
  await expect
    .poll(async () => (await saved()).project.selectedId)
    .toBe('retained-marker');
  await page.setViewportSize({ width: 1180, height: 760 });
  await page.getByRole('button', { name: 'Minimize conversation' }).click();
  assert(
    equalData(stateModel(await saved()), stateModel(original)),
    'UI action changed modeled project/history.',
  );
  active.harmlessUi = {
    selection: 'retained-marker',
    viewport: [1180, 760],
    chatMinimized: true,
    provisionalNotPersisted: true,
  };
  await page.screenshot({ path: `${folder}/${caseId}-working-preview.png` });
}
async function persistUndo(
  original: Session,
  committed: Session,
  label: string,
) {
  save(`${folder}/${label}-committed.json`, committed);
  const history = await chat();
  save(`${folder}/${label}-conversation.json`, history);
  const camera = await page.evaluate(() =>
    Object.fromEntries(
      Object.entries(localStorage).filter(([key]) => key.endsWith(':camera')),
    ),
  );
  await page.reload();
  await ready();
  await expect
    .poll(async () => equalData((await saved()).project, committed.project), {
      timeout: 20000,
    })
    .toBe(true);
  const restored = await saved();
  assert(
    equalData(restored.context, committed.context),
    'Context lost on reload.',
  );
  assert(equalData(await chat(), history), 'Conversation lost on reload.');
  save(`${folder}/${label}-reloaded.json`, restored);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(
      async () =>
        equalData((await saved()).project.volumes, original.project.volumes),
      { timeout: 20000 },
    )
    .toBe(true);
  const undone = await saved();
  save(`${folder}/${label}-undone.json`, undone);
  assert(
    equalData(undone.project.groups, original.project.groups),
    'Undo did not restore groups.',
  );
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect
    .poll(
      async () =>
        equalData((await saved()).project.volumes, committed.project.volumes),
      { timeout: 20000 },
    )
    .toBe(true);
  const redone = await saved();
  save(`${folder}/${label}-redone.json`, redone);
  assert.equal(
    committed.past.length,
    original.past.length + 1,
    'Expected whole-request Undo.',
  );
  active.transaction = {
    committed: true,
    reloadExact: true,
    contextRetained: true,
    conversationRetained: true,
    singleUndo: true,
    redoExact: true,
    cameraBeforeReload: camera,
  };
}
async function browserTurn(id: CaseId) {
  caseId = id;
  active = {
    id,
    prompt: prompts[id],
    status: 'RUNNING',
    events: [],
    started: new Date().toISOString(),
  };
  results.push(active);
  if (id === 'height-edit') {
    if (
      !(await page.getByRole('searchbox', { name: 'Find objects' }).isVisible())
    )
      await page
        .getByRole('button', { name: 'Show objects', exact: true })
        .click();
    await page.getByRole('searchbox', { name: 'Find objects' }).fill('');
    await page
      .locator('.object-row')
      .filter({ hasNotText: 'Existing marker' })
      .first()
      .click();
    await expect
      .poll(async () => (await saved()).project.selectedId)
      .not.toBe('retained-marker');
  }
  const original = await saved();
  save(`${folder}/${id}-original.json`, original);
  gate = id === 'recovery-tray' ? undefined : makeGate();
  const start = performance.now();
  try {
    await send(prompts[id]);
    await waitForModelingStart(page);
    const deadline = Date.now() + 660000;
    while (await modelingActive(page)) {
      if (Date.now() > deadline)
        throw new Error('Browser modeling exceeded evaluation deadline.');
      if (gate?.pending && !gate.performed) {
        await harmlessActivity(original);
        gate.performed = true;
        gate.release();
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    active.totalMs = performance.now() - start;
    const candidate = await saved();
    save(`${folder}/${id}-final.json`, candidate);
    active.conversation = await chat();
    await page.screenshot({ path: `${folder}/${id}-result.png` });
    active.finalOracle = await oracle(id, original, candidate);
    active.componentCount = candidate.project.volumes.length;
    save(
      `${folder}/${id}-measurements.json`,
      await measurements(candidate.project.volumes),
    );
    const committed = !equalData(stateModel(candidate), stateModel(original));
    active.committed = committed;
    if (active.criteria && committed) {
      const t = performance.now();
      active.replayedVerification = await verifyCompletion(
        active.criteria,
        original,
        candidate,
      );
      active.deterministicReplayMs = performance.now() - t;
    }
    if (committed && incorrect(active.finalOracle))
      throw new SeriousRegression(
        'Application committed geometry that fails independent measurements.',
      );
    if (!committed) {
      active.status = 'NOT_COMPLETED';
      active.projectPreserved = equalData(
        stateModel(candidate),
        stateModel(original),
      );
      if (!active.projectPreserved)
        throw new SeriousRegression('Failed request changed original project.');
      return false;
    }
    assert(
      gate?.performed || id === 'recovery-tray',
      'Harmless UI conflict scenario was not exercised.',
    );
    await persistUndo(original, candidate, id);
    active.hostVerificationStatus = active.replayedVerification?.status;
    active.verificationLimitsDisclosed = JSON.stringify(
      active.conversation,
    ).includes('Changes applied with incomplete verification');
    active.status = evaluationOutcome(
      active.finalOracle,
      active.replayedVerification,
      active.verificationLimitsDisclosed,
      release20,
    );
    return passed(active.finalOracle);
  } catch (e) {
    active.error = safeError(e);
    active.status =
      e instanceof SeriousRegression ? 'SERIOUS_REGRESSION_STOP' : 'FAILED';
    stopped = true;
    await cancelModeling(page);
    await page
      .screenshot({ path: `${folder}/${id}-failure.png` })
      .catch(() => {});
    return false;
  } finally {
    gate?.release();
    gate = undefined;
    active.totalMs ??= performance.now() - start;
    const l: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    active.cost = cost(l, id);
    if (l.calls.some((c) => c.outcome !== 'usage-reconciled')) stopped = true;
    persist();
  }
}
function cost(ledger: Ledger, id: CaseId) {
  const current = ledger.calls.filter((c) => c.caseId === id);
  const calls = [...settledPriorCalls, ...ledger.calls].filter(
    (c) => c.caseId === id,
  );
  return {
    thisAttempt: {
      calls: current.length,
      estimatedUsd: current.reduce((n, c) => n + (c.estimatedUsd ?? 0), 0),
      reviewerMs: current
        .filter((c) => c.role === 'reviewer')
        .reduce((n, c) => n + (c.elapsedMs ?? 0), 0),
      executorMs: current
        .filter((c) => c.role === 'executor')
        .reduce((n, c) => n + (c.elapsedMs ?? 0), 0),
    },
    calls: calls.length,
    estimatedUsd: calls.reduce((n, c) => n + (c.estimatedUsd ?? 0), 0),
    reservedOrChargedUsd: calls.reduce(
      (n, c) => n + (c.chargedUsd ?? c.reservedUsd),
      0,
    ),
    priorInterruptedCalls: interruptedCalls.filter((c) => c.caseId === id)
      .length,
    callsIncludingInterrupted:
      calls.length + interruptedCalls.filter((c) => c.caseId === id).length,
    reviewerMs: calls
      .filter((c) => c.role === 'reviewer')
      .reduce((n, c) => n + (c.elapsedMs ?? 0), 0),
    executorMs: calls
      .filter((c) => c.role === 'executor')
      .reduce((n, c) => n + (c.elapsedMs ?? 0), 0),
    reviewerCalls: calls.filter((c) => c.role === 'reviewer').length,
  };
}
class SeriousRegression extends Error {}
async function repairTurn() {
  caseId = 'ellipse-repair';
  active = {
    id: caseId,
    prompt: prompts[caseId],
    status: 'RUNNING',
    events: [],
    started: new Date().toISOString(),
  };
  results.push(active);
  gate = undefined;
  const original = seed(),
    pristine = serializeSession(original);
  save(`${folder}/${caseId}-original.json`, original);
  let criteria: CompletionCriteria | undefined,
    injected = false,
    injectedId: string | undefined;
  const start = performance.now();
  try {
    const result = await stagedPlan(
      original,
      defaultCamera,
      async (working, validationFeedback, execution) => {
        save(`${folder}/${caseId}-stage-${active.events.length}.json`, working);
        const observation = await observe(
          working,
          `${caseId}-observation-${active.events.length}`,
        );
        return recordCall(
          'executor',
          {
            message: prompts[caseId],
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
            validationFeedback,
            execution,
            observation,
          },
          AbortSignal.timeout(150000),
        ) as any;
      },
      () => {},
      AbortSignal.timeout(660000),
      {
        agent: true,
        verifyCompletion: async (candidate) => {
          const before = await oracle(caseId, original, candidate);
          if (!injected && passed(before)) {
            save(`${folder}/${caseId}-before-injection.json`, candidate);
            const target = targets(original, candidate)[0],
              ideal = ellipse();
            injectedId = target.id;
            candidate.project = {
              ...candidate.project,
              volumes: candidate.project.volumes.map((v) =>
                v.id === target.id
                  ? {
                      ...v,
                      geometry: { kind: 'cylinder' },
                      dimensions: {
                        ...ideal.dimensions,
                        depth: ideal.dimensions.width,
                      },
                      rotation: ideal.rotation,
                      position: { ...ideal.position },
                    }
                  : v,
              ),
            };
            injected = true;
            active.injection = {
              id: injectedId,
              kind: 'Circular cross-section substituted for correct ellipse',
              beforeOracle: before,
            };
            save(`${folder}/${caseId}-injected.json`, candidate);
          }
          if (!criteria)
            criteria = (await recordCall(
              'reviewer',
              {
                message: prompts[caseId],
                history: [],
                scene: sceneContext(
                  original.project,
                  original.context,
                  defaultCamera,
                ),
                candidate: candidate.project.volumes.map((v) => ({
                  id: v.id,
                  name: v.name,
                  groupId: v.groupId ?? null,
                  role: v.component?.role ?? null,
                  level: v.component?.level ?? null,
                })),
              },
              AbortSignal.timeout(150000),
            )) as CompletionCriteria;
          const t = performance.now(),
            report = await verifyCompletion(criteria, original, candidate),
            elapsedMs = performance.now() - t;
          const facts = await oracle(caseId, original, candidate);
          active.events.push({
            kind: 'verification',
            report,
            oracle: facts,
            elapsedMs,
          });
          persist();
          save(
            `${folder}/${caseId}-candidate-${active.events.length}.json`,
            candidate,
          );
          if (
            (report.canCommit && incorrect(facts)) ||
            (report.status === 'incorrect' && passed(facts))
          )
            throw new SeriousRegression(
              'Independent verification contradicted measured geometry.',
            );
          return report;
        },
      },
    );
    assert(
      result.prepared && !result.reviewRequired,
      'No completed autonomous result.',
    );
    const candidate = result.prepared.session;
    active.finalOracle = await oracle(caseId, original, candidate);
    active.verification = result.verification;
    assert(
      injected,
      'Correct initial geometry was not produced; repair untested.',
    );
    if (!candidate.project.volumes.some((v) => v.id === injectedId))
      throw new SeriousRegression('Repair replaced component identity.');
    active.controls = [];
    for (const control of await ellipseControls(original, candidate)) {
      const facts = await oracle(caseId, original, control.session),
        report = await verifyCompletion(criteria!, original, control.session);
      active.controls.push({
        name: control.name,
        expected: control.expected,
        oracle: facts,
        report,
      });
      save(
        `${folder}/${caseId}-control-${active.controls.length}.json`,
        control.session,
      );
      if (
        (report.canCommit && incorrect(facts)) ||
        (report.status === 'incorrect' && passed(facts))
      )
        throw new SeriousRegression(
          'False acceptance/rejection in representation or preservation control.',
        );
    }
    assert.equal(serializeSession(original), pristine);
    const restored = parseSession(serializeSession(candidate));
    assert(equalData(restored, candidate));
    const undo = (
      await applyPlan(restored, directPlan({ type: 'undo', count: 1 }))
    ).session;
    assert(equalData(undo.project, original.project));
    const redo = (await applyPlan(undo, directPlan({ type: 'redo', count: 1 })))
      .session;
    assert(equalData(redo.project, candidate.project));
    active.transaction = {
      originalPreserved: true,
      identityRetained: true,
      reloadExact: true,
      undoExact: true,
      redoExact: true,
    };
    active.hostVerificationStatus = result.verification?.status;
    active.verificationLimitsDisclosed = result.plan.message.includes(
      'Changes applied with incomplete verification',
    );
    active.status = evaluationOutcome(
      active.finalOracle,
      result.verification,
      active.verificationLimitsDisclosed,
      release20,
    );
    save(`${folder}/${caseId}-committed.json`, candidate);
  } catch (e) {
    active.error = safeError(e);
    active.status =
      e instanceof SeriousRegression ? 'SERIOUS_REGRESSION_STOP' : 'FAILED';
    if (e instanceof SeriousRegression) stopped = true;
  } finally {
    active.totalMs = performance.now() - start;
    const l: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    active.cost = cost(l, caseId);
    if (l.calls.some((c) => c.outcome !== 'usage-reconciled')) stopped = true;
    persist();
  }
}
async function failedTurnControl() {
  const before = await saved();
  save(`${folder}/blocked-original.json`, before);
  const callsBefore = (JSON.parse(readFileSync(ledgerPath, 'utf8')) as Ledger)
    .calls.length;
  offlineFailure = true;
  offlineFailureCalls = 0;
  await send(
    'Offline acceptance control: begin a temporary solid, then block this request.',
  );
  await expect(
    page.getByRole('log', { name: 'Design conversation' }),
  ).toContainText('Evaluation-injected blocked request', { timeout: 60000 });
  await expect(
    page.getByRole('button', { name: 'Stop and discard working preview' }),
  ).toBeHidden();
  assert(
    equalData(await saved(), before),
    'Blocked request changed project or context.',
  );
  save(`${folder}/blocked-conversation.json`, await chat());
  await page.reload();
  await ready();
  assert(
    equalData(await saved(), before),
    'Blocked turn reload changed project.',
  );
  save(`${folder}/blocked-reloaded.json`, await saved());
  assert.equal(
    (JSON.parse(readFileSync(ledgerPath, 'utf8')) as Ledger).calls.length,
    callsBefore,
  );
  offlineFailure = false;
  save(`${folder}/blocked-control.json`, {
    status: 'EXPECTED_SAFE_FAILURE',
    paidCalls: 0,
    provisionalStages: 1,
    projectContextAndHistoryPreserved: true,
    reloadExact: true,
  });
}
async function prepareFixtures() {
  const original = seed(),
    s = structuredClone(original);
  const heights = [0, 4.2, 7.5, 11.2, 14.5];
  for (let level = 0; level < 5; level++) {
    const slab = piece(
      `Fixture slab ${level}`,
      'box',
      19,
      13,
      0.22,
      0,
      heights[level],
      0,
    );
    s.project.volumes.push(slab);
    if (level === 4) continue;
    for (const x of [-8, 0, 8])
      for (const z of [-5, 0, 5])
        s.project.volumes.push(
          piece(
            'Fixture support',
            'box',
            0.32,
            0.32,
            heights[level + 1] - heights[level] - 0.22,
            x,
            heights[level] + 0.22,
            z,
          ),
        );
    for (const x of [-6, 0, 6])
      s.project.volumes.push({
        ...piece(
          'Fixture pane',
          'box',
          5.6,
          0.04,
          heights[level + 1] - heights[level] - 0.3,
          x,
          heights[level] + 0.25,
          -6.45,
        ),
        material: 'glass',
        component: {
          role: 'window',
          level: String(level),
          hostId: null,
          motion: 'none',
          travel: 1,
        },
      });
  }
  assert(
    passed(await oracle('building', original, s)),
    'Building oracle rejects correct geometry.',
  );
  const wrong = structuredClone(s);
  wrong.project.volumes.find((v) => v.name === 'Fixture slab 2')!.position.y +=
    0.23;
  assert(
    incorrect(await oracle('building', original, wrong)),
    'Building oracle fails to detect incorrect level.',
  );
  const edited = structuredClone(s);
  for (const v of edited.project.volumes.slice(1)) {
    if (v.position.y >= 4.2) v.position.y += 1.1;
    else if (v.position.y > 0) v.dimensions.height += 1.1;
  }
  assert(
    passed(await oracle('height-edit', s, edited)),
    'Connected-edit oracle rejects correct geometry.',
  );
  if (focusedBuilding) {
    assert.equal((await observe(s, 'preparation-building')).status, 'ready');
    await page.goto(origin);
    await ready();
    assert.equal((await saved()).project.volumes.length, 1);
    save(`${folder}/preparation.json`, {
      status: 'OFFLINE_PREPARATION_PASSED',
      manifestHash: hash(manifest),
      paidCalls: 0,
      oracleControls: [
        'Correct multilevel assembly',
        'Wrong level',
        'Correct connected modification',
      ],
      productionBrowserLoads: true,
    });
    return;
  }
  const e = structuredClone(original);
  e.project.volumes.push(ellipse());
  assert(passed(await oracle('ellipse-repair', original, e)));
  for (const c of await ellipseControls(original, e))
    assert.equal(
      passed(await oracle('ellipse-repair', original, c.session)),
      c.expected === 'verified',
    );
  const tray = structuredClone(original),
    x = 4,
    z = 4;
  tray.project.volumes.push({
    ...piece('Base', 'box', 1.7, 0.95, 0.04, x, 0, z),
    component: {
      role: 'floor',
      level: 'Base',
      hostId: null,
      motion: 'none',
      travel: 1,
    },
  });
  for (const sign of [-1, 1]) {
    tray.project.volumes.push({
      ...piece('End', 'box', 0.04, 0.95, 0.2, x + sign * 0.83, 0.04, z),
      component: {
        role: 'wall',
        level: 'Base',
        hostId: null,
        motion: 'none',
        travel: 1,
      },
    });
    tray.project.volumes.push({
      ...piece('Side', 'box', 1.62, 0.04, 0.2, x, 0.04, z + sign * 0.455),
      component: {
        role: 'wall',
        level: 'Base',
        hostId: null,
        motion: 'none',
        travel: 1,
      },
    });
  }
  assert(
    passed(await oracle('recovery-tray', original, tray)),
    'Tray oracle rejects correct separated components.',
  );
  const filled = structuredClone(tray);
  filled.project.volumes.push(
    piece('Wrong fill', 'box', 1.5, 0.7, 0.18, x, 0.04, z),
  );
  assert(
    incorrect(await oracle('recovery-tray', original, filled)),
    'Tray oracle missed blocked cavity.',
  );
  const observation = await observe(s, 'preparation-building');
  assert.equal(observation.status, 'ready');
  await page.goto(origin);
  await ready();
  assert.equal(
    (await saved()).project.volumes.length,
    1,
    'Browser did not load seeded project.',
  );
  await failedTurnControl();
  save(`${folder}/preparation.json`, {
    status: 'OFFLINE_PREPARATION_PASSED',
    manifestHash: hash(manifest),
    paidCalls: 0,
    oracleControls: [
      'Correct multilevel assembly',
      'Wrong level',
      'Correct connected modification',
      'Correct rotated ellipse',
      'Equivalent mesh',
      'Wrong equal-span solid',
      'Protected marker movement',
      'Separate tray components',
      'Filled tray cavity',
    ],
    productionBrowserLoads: true,
    blockedRequestReload: true,
  });
}
try {
  if (!live) {
    await prepareFixtures();
    if (resumingBuilding) {
      await browserTurn('building');
      assert.equal(
        replayIndex,
        replayCount + 1,
        'All saved responses and the blocked scene must be replayed.',
      );
      assert.equal(active.projectPreserved, true);
      assert.equal(active.events[replayCount].offlineReplayValidated, true);
      assert.equal(
        (JSON.parse(readFileSync(ledgerPath, 'utf8')) as Ledger).calls.length,
        0,
      );
      save(`${folder}/replay-preparation.json`, {
        status: 'OFFLINE_BROWSER_REPLAY_PASSED',
        replayedPaidResponses: replayCount,
        identicalSceneBeforeContinuation: true,
        provisionalComponentCount:
          active.events[replayCount].input.scene.objects.length,
        failedPreviewDiscarded: active.projectPreserved,
        newPaidCalls: 0,
      });
    }
    console.log('OFFLINE PREPARATION PASSED: no paid calls.');
  } else {
    const p = await fetch(pricing.source, {
      signal: AbortSignal.timeout(20000),
    });
    assert(p.ok);
    const rate = (await p.json())[model];
    assert.equal(rate?.input_cost_per_token * 1e6, pricing.inputPerMillion);
    assert.equal(rate?.output_cost_per_token * 1e6, pricing.outputPerMillion);
    assert.equal(
      rate?.input_cost_per_token_above_272k_tokens * 1e6,
      pricing.reserveInputPerMillion,
    );
    assert.equal(
      rate?.output_cost_per_token_above_272k_tokens * 1e6,
      pricing.reserveOutputPerMillion,
    );
    assert.equal(rate?.max_input_tokens, pricing.maximumInputTokens);
    save(`${folder}/pricing-check.json`, {
      at: new Date().toISOString(),
      source: pricing.source,
      model,
      inputPerMillion: rate.input_cost_per_token * 1e6,
      outputPerMillion: rate.output_cost_per_token * 1e6,
      longContextThreshold: pricing.longContextThreshold,
      longInputPerMillion: rate.input_cost_per_token_above_272k_tokens * 1e6,
      longOutputPerMillion: rate.output_cost_per_token_above_272k_tokens * 1e6,
      maximumInputTokens: rate.max_input_tokens,
    });
    const l: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    l.authorized = true;
    save(ledgerPath, l);
    await page.goto(origin);
    await ready();
    const built = await browserTurn('building');
    if (!stopped && built) await browserTurn('height-edit');
    else
      results.push({
        id: 'height-edit',
        status: 'NOT_RUN',
        reason: stopped
          ? 'Stop rule'
          : 'Creation did not pass; no substitute handmade model',
      });
    if (focusedBuilding) {
      // The user requested only creation -> connected edit -> reload/Undo/Redo.
      // Existing repair and recovery evidence remains preserved, not rerun.
    } else if (resumingBuilding) {
      for (const id of ['ellipse-repair', 'recovery-tray'])
        results.push({
          ...previousResults.find((r: any) => r.id === id),
          evidenceOrigin: previousFolder,
          rerunInThisAttempt: false,
        });
    } else {
      if (!stopped) await repairTurn();
      else results.push({ id: 'ellipse-repair', status: 'NOT_RUN_AFTER_STOP' });
      if (!stopped) {
        await failedTurnControl();
        await browserTurn('recovery-tray');
      } else
        results.push({ id: 'recovery-tray', status: 'NOT_RUN_AFTER_STOP' });
    }
  }
} catch (e) {
  stopped = true;
  save(`${folder}/harness-error.json`, {
    error: safeError(e),
    caseId,
    paidCalls: (JSON.parse(readFileSync(ledgerPath, 'utf8')) as Ledger).calls
      .length,
  });
  console.error(safeError(e));
  process.exitCode = 1;
} finally {
  gate?.release();
  if (live) {
    save(`${folder}/browser-errors.json`, browserErrors);
    persist();
    const ledger: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    save(`${folder}/summary.json`, {
      applicationCommit,
      results: results.map(({ id, status, error, cost, transaction }) => ({
        id,
        status,
        error,
        cost,
        transaction,
      })),
      stopped,
      estimatedUsd:
        priorKnownUsd +
        ledger.calls.reduce((n, c) => n + (c.estimatedUsd ?? 0), 0),
      estimatedUsdScope:
        'All reconciled prior and new usage estimates; interrupted usage remains unknown and reserved separately',
      priorRetainedReservations: settledPriorCalls.filter(
        (c) => c.outcome !== 'usage-reconciled',
      ),
      priorUnknownUsageAllowanceUsd: carryForward.allowanceUsd,
      originalActualUsage: 'unknown',
      newBudgetAccountedUsd: priorAccountedUsd + budgetUsed(ledger),
      budgetAccountedUsd:
        carryForward.allowanceUsd + priorAccountedUsd + budgetUsed(ledger),
      ceilingUsd,
      paidCalls: settledPriorCalls.length + ledger.calls.length,
      callsThisAttempt: ledger.calls.length,
      callsIncludingInterrupted: ledger.calls.length + priorCalls.length,
    });
    if (
      !process.exitCode &&
      results.some(
        (r) =>
          r.status !== 'PASS' &&
          !(release20 && r.status === 'PASS_WITH_DISCLOSED_LIMITS'),
      )
    )
      process.exitCode = 2;
  }
  await context.close();
  await browser.close();
  await vite.close();
  await new Promise<void>((r) => server.close(() => r()));
  if (lock !== undefined) {
    closeSync(lock);
    unlinkSync(lockPath);
  }
}
