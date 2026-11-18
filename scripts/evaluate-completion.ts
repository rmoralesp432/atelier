/** Opt-in evaluation of PR #22. Default mode is offline preparation.
 * Live execution requires a separately approved $3 budget and explicit flags.
 * No production changes, deployments, scripted AI answers, or runtime templates.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  unlinkSync,
} from 'node:fs';
import { createServer } from 'vite';
import { chromium, type Page } from '@playwright/test';
import { createProvider } from '../server/provider';
import { stagedPlan } from '../src/intelligence/checkedPlanner';
import {
  applyPlan,
  directPlan,
  newSession,
  serializeSession,
  type Session,
} from '../src/intelligence/engine';
import { defaultCamera, sceneContext } from '../src/intelligence/context';
import { conversationHistory, type Message } from '../src/intelligence/client';
import { verifyCompletion } from '../src/intelligence/completion';
import type { CompletionCriteria } from '../src/intelligence/completionSchema';
import type { SceneObservation } from '../src/intelligence/observation';
import {
  prompts,
  specification,
  initialSession,
  standPieces,
  ringPieces,
  platePiece,
  oracle,
  controls,
  type CaseId,
} from './completion-evaluation/cases';
import {
  ceilingUsd,
  model,
  pricing,
  meteredFetch,
  budgetUsed,
  save,
  type Ledger,
} from './completion-evaluation/budget';

const folder = '.cloud/completion-live-evaluation';
mkdirSync(folder, { recursive: true });
const manifestPath = `${folder}/manifest.json`,
  ledgerPath = `${folder}/ledger.json`;
const hash = (v: unknown) =>
  createHash('sha256').update(JSON.stringify(v)).digest('hex');
const source = () => ({
  src: execFileSync('git', ['rev-parse', 'HEAD:src'], {
    encoding: 'utf8',
  }).trim(),
  server: execFileSync('git', ['rev-parse', 'HEAD:server'], {
    encoding: 'utf8',
  }).trim(),
});
const harnessHash = hash(
  [
    'scripts/evaluate-completion.ts',
    'scripts/completion-evaluation/cases.ts',
    'scripts/completion-evaluation/budget.ts',
    'package-lock.json',
  ].map((p) => readFileSync(p, 'utf8')),
);
const manifest = {
  productionCommit: '6b480a5002e1f6e332c76d06035a1c51ab67c6ce',
  source: source(),
  harnessHash,
  model,
  transport: 'responses',
  reasoning: 'high',
  maxOutputTokens: 6000,
  ceilingUsd,
  maximumCalls: 24,
  perTurnCalls: 8,
  prompts,
  specification,
  pricing,
};
const live = process.argv.includes('--live');
assert(
  process.argv
    .slice(2)
    .every((a) =>
      ['--prepare', '--live', '--approved-budget-usd=3'].includes(a),
    ),
  'Unknown evaluation flag.',
);
assert(
  !(live && process.argv.includes('--prepare')),
  'Choose preparation or live evaluation.',
);
if (live) {
  assert(
    process.argv.includes('--approved-budget-usd=3'),
    'User approval of the proposed $3 ceiling is required before paid generation.',
  );
  assert(
    existsSync(manifestPath) && existsSync(ledgerPath),
    'Run offline preparation first; never silently reset a missing spend ledger.',
  );
  assert.equal(
    hash(JSON.parse(readFileSync(manifestPath, 'utf8'))),
    hash(manifest),
    'Production source, prompts or budget changed after preparation. Review the change before spending.',
  );
  assert.equal(
    execFileSync('git', ['diff', '--', 'src', 'server'], {
      encoding: 'utf8',
    }).trim(),
    '',
    'Uncommitted production edits are not evaluated.',
  );
  assert.equal(
    execFileSync('git', ['diff', '--cached', '--', 'src', 'server'], {
      encoding: 'utf8',
    }).trim(),
    '',
    'Staged production edits are not evaluated.',
  );
  assert(
    process.env.ATELIER_OPENAI_API_KEY,
    'Configure the API key securely; never pass it on the command line.',
  );
  // Public, non-generating preflight. A price change invalidates the proposal.
  const response = await fetch(pricing.source, {
    signal: AbortSignal.timeout(20000),
  });
  assert(
    response.ok,
    'Pricing reference unavailable; no generation permitted.',
  );
  const rate = (await response.json())[model];
  assert.equal(
    rate?.input_cost_per_token * 1e6,
    pricing.inputPerMillion,
    'Published input price changed.',
  );
  assert.equal(
    rate?.output_cost_per_token * 1e6,
    pricing.outputPerMillion,
    'Published output price changed.',
  );
} else {
  if (existsSync(ledgerPath)) {
    const ledger: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    assert(
      ledger.calls.length === 0 && !ledger.authorized,
      'Preparation cannot reset an authorized or used ledger.',
    );
  }
  save(manifestPath, manifest);
  save(ledgerPath, {
    ceilingUsd,
    authorized: false,
    calls: [],
  } satisfies Ledger);
}
const lock = live
  ? openSync(`${folder}/paid-run.lock`, 'wx', 0o600)
  : undefined;
const vite = await createServer({
  server: { host: '127.0.0.1', port: 0 },
  appType: 'custom',
});
await vite.listen();
const port = (vite.httpServer!.address() as { port: number }).port;
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
const page: Page = await browser.newPage();
await page.route('**/__completion-eval', (r) =>
  r.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Completion evaluation</title>',
  }),
);
await page.goto(`http://127.0.0.1:${port}/__completion-eval`);
await page.evaluate(async () => {
  // Browser module URLs, resolved by Vite rather than Node.
  const kernelPath: string = '/src/geometry/kernel.ts';
  const wasmPath: string = '/node_modules/manifold-3d/manifold.wasm?url';
  const { setKernelWasmUrl } = await import(kernelPath);
  const wasm = await import(wasmPath);
  setKernelWasmUrl(wasm.default);
});
async function observe(
  session: Session,
  label: string,
): Promise<SceneObservation> {
  const observation = await page.evaluate(
    async (project) => {
      const modulePath: string = '/src/intelligence/renderObservation.ts';
      const { renderObservation } = await import(modulePath);
      return renderObservation(project);
    },
    JSON.parse(JSON.stringify(session.project)),
  );
  observation.views.forEach((v: any, i: number) =>
    writeFileSync(
      `${folder}/${label}-${i}.jpg`,
      Buffer.from(v.image.split(',')[1], 'base64'),
    ),
  );
  return observation;
}
const passed = (e: { passed: boolean }[]) => e.every((c) => c.passed);
try {
  if (!live) {
    const original = initialSession();
    const results = [];
    for (const id of ['stand', 'ring', 'plate'] as const) {
      const parts =
        id === 'stand'
          ? standPieces()
          : id === 'ring'
            ? ringPieces()
            : [await platePiece()];
      if (id === 'stand')
        parts.forEach((v) => (v.groupId = 'evaluation-stand'));
      const candidate = newSession({
        ...original.project,
        volumes: [...original.project.volumes, ...parts],
        groups:
          id === 'stand'
            ? [
                {
                  id: 'evaluation-stand',
                  name: 'Display stand',
                  visible: true,
                  locked: false,
                },
              ]
            : [],
      });
      const evidence = await oracle(id, original, candidate);
      assert(
        passed(evidence),
        `Correct ${id} fixture failed its external oracle: ${JSON.stringify(evidence.filter((c) => !c.passed))}`,
      );
      const probes = [];
      for (const control of await controls(id, original, candidate)) {
        const facts = await oracle(id, original, control.session);
        assert.equal(
          passed(facts),
          control.expectedPass,
          `${id}: oracle does not distinguish ${control.name}`,
        );
        probes.push({
          name: control.name,
          expectedPass: control.expectedPass,
          oracle: facts,
        });
      }
      if (id === 'stand') {
        const edited = structuredClone(candidate);
        edited.project.volumes
          .filter((v) => v.position.x > 3)
          .forEach((v) => {
            if (v.dimensions.height > 1)
              v.dimensions.height += specification.stand.raise;
            else if (v.position.y > 1)
              v.position.y += specification.stand.raise;
          });
        assert(
          passed(await oracle('edit', candidate, edited)),
          'Correct edit fixture failed.',
        );
        for (const control of await controls('edit', candidate, edited))
          assert.equal(
            passed(await oracle('edit', candidate, control.session)),
            control.expectedPass,
            `edit: ${control.name}`,
          );
        save(`${folder}/edit-valid.json`, edited);
      }
      const observation = await observe(candidate, `prepare-${id}`);
      assert.equal(
        observation.status,
        'ready',
        'Real geometry observations must work before paid evaluation.',
      );
      save(`${folder}/${id}-original.json`, original);
      save(`${folder}/${id}-valid.json`, candidate);
      results.push({
        id,
        evidence,
        controls: probes,
        observation: {
          status: observation.status,
          objectIds: observation.objectIds,
          views: observation.views.length,
        },
      });
    }
    // Measure/reserve the real SDK payload without sending it anywhere.
    let payload: any;
    const offline = createProvider(
      'offline-preflight',
      async (_url, init) => {
        payload = JSON.parse(init!.body as string);
        throw new Error('Offline capture; network intentionally disabled.');
      },
      { agent: true, textApi: 'responses', maxOutputTokens: 6000 },
    );
    process.env.ATELIER_AGENT_MODEL = model;
    await offline
      .plan({
        message: prompts.stand,
        scene: sceneContext(original.project, original.context, defaultCamera),
        history: [],
      })
      .catch(() => {});
    assert(payload, 'SDK payload capture did not run.');
    const { reservation } = await import('./completion-evaluation/budget');
    save(`${folder}/preparation.json`, {
      status: 'OFFLINE_PREPARATION_PASSED',
      paidCalls: 0,
      manifestHash: hash(manifest),
      exampleExecutorReservationUsd: reservation(payload),
      fixtureChecks: results,
      note: 'Fixtures validate the harness only. Live reasoning, requirement coverage, costs and latency remain untested.',
    });
    console.log(
      'OFFLINE PREPARATION PASSED. No model generations. Live evaluation still requires approval of the $3 ceiling.',
    );
  } else {
    const ledger: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    assert(
      ledger.calls.length === 0,
      'This initial evaluation is single-run; a used ledger requires a reviewed resume plan, not repetition.',
    );
    ledger.authorized = true;
    save(ledgerPath, ledger);
    process.env.ATELIER_AGENT_MODEL = model;
    let role: 'executor' | 'reviewer' = 'executor',
      caseId: CaseId = 'stand';
    const provider = createProvider(
      process.env.ATELIER_OPENAI_API_KEY!,
      meteredFetch(ledgerPath, () => ({ role, caseId })),
      { agent: true, textApi: 'responses', maxOutputTokens: 6000 },
    );
    const results: any[] = [];
    let stop = false;
    async function turn(id: CaseId, original: Session, history: Message[]) {
      if (stop) {
        results.push({ id, status: 'NOT_RUN_AFTER_STOP' });
        return { session: original, history, success: false };
      }
      caseId = id;
      const started = performance.now(),
        committedBefore = serializeSession(original);
      const record: any = {
        id,
        prompt: prompts[id],
        status: 'RUNNING',
        attempts: [],
        observationsMs: 0,
        reviewerMs: 0,
        hostChecksMs: 0,
      };
      results.push(record);
      save(`${folder}/${id}-original.json`, original);
      let criteria: CompletionCriteria | undefined,
        revision = '',
        observation: SceneObservation | undefined;
      let injected = false,
        survivingIds: string[] = [];
      const updatedHistory: Message[] = [
        ...history,
        { role: 'user', content: prompts[id] },
      ];
      try {
        const checked = await stagedPlan(
          original,
          defaultCamera,
          async (working, validationFeedback, execution) => {
            const nextRevision = hash(working.project);
            if (nextRevision !== revision) {
              const t = performance.now();
              observation = await observe(
                working,
                `${id}-stage-${execution?.stage ?? 0}-${record.attempts.length}`,
              );
              record.observationsMs += performance.now() - t;
              revision = nextRevision;
            }
            role = 'executor';
            const input = {
              message: prompts[id],
              history: conversationHistory(history),
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
            };
            const plan = await provider.plan(
              input,
              AbortSignal.timeout(150000),
            );
            record.attempts.push({
              kind: 'executor',
              scene: input.scene,
              validationFeedback,
              execution,
              plan,
              atMs: performance.now() - started,
            });
            save(`${folder}/${id}-trace.json`, record);
            return plan;
          },
          () => {},
          AbortSignal.timeout(600000),
          {
            agent: true,
            verifyCompletion: async (candidate) => {
              record.firstCompletionAttemptMs ??= performance.now() - started;
              record.firstCompletionApiCalls ??= (
                JSON.parse(readFileSync(ledgerPath, 'utf8')) as Ledger
              ).calls.filter((c) => c.caseId === id).length;
              const beforeFault = await oracle(id, original, candidate);
              if (id === 'ring' && !injected && passed(beforeFault)) {
                const created = candidate.project.volumes.filter(
                  (v) => !original.project.volumes.some((o) => o.id === v.id),
                );
                const removed = created[created.length - 1];
                survivingIds = created.slice(0, -1).map((v) => v.id);
                save(`${folder}/ring-before-injected-omission.json`, candidate);
                candidate.project = {
                  ...candidate.project,
                  volumes: candidate.project.volumes.filter(
                    (v) => v.id !== removed.id,
                  ),
                };
                record.injectedFault = {
                  removedId: removed.id,
                  survivingIds,
                  beforeFault,
                };
                injected = true;
              }
              if (!criteria) {
                role = 'reviewer';
                const t = performance.now();
                criteria = await provider.completionCriteria!(
                  {
                    message: prompts[id],
                    history: conversationHistory(history),
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
                );
                record.reviewerMs += performance.now() - t;
                save(`${folder}/${id}-criteria.json`, criteria);
              }
              const t = performance.now(),
                report = await verifyCompletion(criteria, original, candidate);
              record.hostChecksMs += performance.now() - t;
              const truth = await oracle(id, original, candidate);
              record.attempts.push({
                kind: 'completion',
                report,
                externalOracle: truth,
                falseAcceptance: report.passed && !passed(truth),
                falseRejection: !report.passed && passed(truth),
                atMs: performance.now() - started,
              });
              save(`${folder}/${id}-provisional.json`, candidate);
              save(`${folder}/${id}-trace.json`, record);
              return report; // Never feed the external oracle, fixture plan or a handmade repair to the AI.
            },
          },
        );
        assert(checked.prepared, `No completed model: ${checked.plan.intent}`);
        record.reviewRequired = checked.reviewRequired ?? false;
        assert(
          !checked.reviewRequired,
          'Unexpected manual confirmation; the evaluation never auto-approves a pending change.',
        );
        const result = checked.prepared.session;
        record.totalMs = performance.now() - started;
        record.afterFirstCompletionAttemptMs =
          record.totalMs - record.firstCompletionAttemptMs;
        record.finalOracle = await oracle(id, original, result);
        record.hostAccepted = checked.verification?.passed;
        assert(
          passed(record.finalOracle),
          'Host accepted a result that fails the external geometry oracle.',
        );
        assert.equal(
          serializeSession(original),
          committedBefore,
          'Original project mutated during private execution.',
        );
        assert.equal(
          result.past.length,
          original.past.length + 1,
          'Expected one Undo entry.',
        );
        const undone = (
          await applyPlan(result, directPlan({ type: 'undo', count: 1 }))
        ).session;
        assert.deepEqual(undone.project, original.project);
        assert.deepEqual(
          (await applyPlan(undone, directPlan({ type: 'redo', count: 1 })))
            .session.project,
          result.project,
        );
        if (id === 'ring') {
          assert(injected, 'Recovery was not exercised.');
          assert(
            survivingIds.every((id) =>
              result.project.volumes.some((v) => v.id === id),
            ),
            'Repair replaced previously correct parts.',
          );
        }
        record.controls = [];
        for (const control of await controls(id, original, result)) {
          const truth = await oracle(id, original, control.session);
          assert.equal(
            passed(truth),
            control.expectedPass,
            'Invalid external test control.',
          );
          let observed: any;
          try {
            observed = await verifyCompletion(
              criteria!,
              original,
              control.session,
            );
          } catch (e) {
            observed = { passed: false, error: (e as Error).message };
          }
          record.controls.push({
            name: control.name,
            expectedPass: control.expectedPass,
            report: observed,
            agrees: observed.passed === control.expectedPass,
          });
        }
        record.status =
          record.controls.every((c: any) => c.agrees) &&
          !record.attempts.some(
            (a: any) => a.falseAcceptance || a.falseRejection,
          )
            ? 'PASS'
            : 'VERIFICATION_DEFECT';
        save(`${folder}/${id}-session.json`, result);
        updatedHistory.push({
          role: 'assistant',
          content: checked.plan.message,
        });
        if (
          record.controls.some((c: any) => !c.expectedPass && c.report.passed)
        )
          stop = true;
        return { session: result, history: updatedHistory, success: true };
      } catch (error) {
        assert.equal(
          serializeSession(original),
          committedBefore,
          'Failed turn changed original.',
        );
        record.totalMs = performance.now() - started;
        record.status = 'FAILED_OR_BLOCKED';
        const e = error as { name?: string; status?: number; message?: string };
        record.error = e.status
          ? `Provider HTTP ${e.status}`
          : e.name?.startsWith('API')
            ? e.name
            : e.message;
        const budget: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
        if (
          budget.calls.some((c) => c.outcome !== 'usage-reconciled') ||
          record.hostAccepted ||
          budget.calls.length >= 24 ||
          budgetUsed(budget) >= ceilingUsd
        )
          stop = true;
        updatedHistory.push({
          role: 'assistant',
          content: 'The request failed. No changes were committed.',
          outcome: 'failed',
        });
        return { session: original, history: updatedHistory, success: false };
      } finally {
        const ledger: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
        const calls = ledger.calls.filter((c) => c.caseId === id);
        const added =
          record.firstCompletionApiCalls === undefined
            ? []
            : calls.slice(record.firstCompletionApiCalls);
        record.cost = {
          calls: calls.length,
          estimatedUsd: calls.reduce((n, c) => n + (c.estimatedUsd ?? 0), 0),
          unresolvedReservationsUsd: calls
            .filter((c) => c.chargedUsd === undefined)
            .reduce((n, c) => n + c.reservedUsd, 0),
          reviewerUsd: calls
            .filter((c) => c.role === 'reviewer')
            .reduce((n, c) => n + (c.estimatedUsd ?? 0), 0),
          addedAfterFirstCompletionAttemptUsd: added.reduce(
            (n, c) => n + (c.estimatedUsd ?? 0),
            0,
          ),
          addedRepairCalls: added.filter((c) => c.role === 'executor').length,
          addedRepairApiMs: added
            .filter((c) => c.role === 'executor')
            .reduce((n, c) => n + (c.elapsedMs ?? 0), 0),
        };
        save(`${folder}/${id}-trace.json`, record);
        save(`${folder}/results.json`, {
          manifest,
          results,
          ledger: JSON.parse(readFileSync(ledgerPath, 'utf8')),
          recommendation:
            'Human review required; never deploy from this runner.',
        });
        console.log(`${id}: ${record.status}`);
      }
    }
    const stand = await turn('stand', initialSession(), []);
    if (stand.success) await turn('edit', stand.session, stand.history);
    else results.push({ id: 'edit', status: 'NOT_RUN_CREATION_FAILED' });
    const ring = await turn('ring', initialSession(), []);
    await turn('plate', ring.session, ring.history);
  }
} finally {
  await browser.close();
  await vite.close();
  if (lock !== undefined) {
    closeSync(lock);
    unlinkSync(`${folder}/paid-run.lock`);
  }
}
