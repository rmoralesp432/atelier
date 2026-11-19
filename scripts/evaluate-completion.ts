/** Opt-in evaluation of PR #22. Default mode is offline preparation.
 * Live execution requires a separately approved $5 budget and explicit flags.
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
  parseSession,
  type Session,
} from '../src/intelligence/engine';
import { defaultCamera, sceneContext } from '../src/intelligence/context';
import { conversationHistory, type Message } from '../src/intelligence/client';
import {
  verifyCompletion,
  unavailableCompletionCriteria,
} from '../src/intelligence/completion';
import type { CompletionCriteria } from '../src/intelligence/completionSchema';
import type { SceneObservation } from '../src/intelligence/observation';
import {
  prompts,
  specification,
  initialSession,
  fixture,
  targetIds,
  order,
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

const folder = '.cloud/completion-final-5usd';
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
  productionCommit: 'a2fd752693c4b98bc322cbeae8f7ec0ebc15c866',
  source: source(),
  harnessHash,
  model,
  transport: 'responses',
  reasoning: { executor: 'high', textReviewer: 'low', imageReviewer: 'high' },
  maxOutputTokens: 6000,
  ceilingUsd,
  maximumCalls: 48,
  perTurnCalls: 8,
  executionOrder: order,
  prompts,
  specification,
  pricing,
};
const live = process.argv.includes('--live');
assert.equal(
  execFileSync(
    'git',
    [
      'diff',
      manifest.productionCommit,
      'HEAD',
      '--',
      'src',
      'server',
      'package-lock.json',
    ],
    { encoding: 'utf8' },
  ).trim(),
  '',
  'The application under evaluation must remain exactly PR #22 at the frozen commit.',
);
assert(
  process.argv
    .slice(2)
    .every((a) =>
      ['--prepare', '--live', '--approved-budget-usd=5'].includes(a),
    ),
  'Unknown evaluation flag.',
);
assert(
  !(live && process.argv.includes('--prepare')),
  'Choose preparation or live evaluation.',
);
if (live) {
  assert(
    process.argv.includes('--approved-budget-usd=5'),
    'User approval of the $5 ceiling is required before paid generation.',
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
class SeriousRegression extends Error {}
try {
  if (!live) {
    let original = initialSession();
    const results = [];
    for (const id of order) {
      const candidate = await fixture(id, original);
      const evidence = await oracle(id, original, candidate);
      assert(
        passed(evidence),
        `Correct ${id} fixture failed: ${JSON.stringify(evidence.filter((c) => !c.passed))}`,
      );
      const probes = [];
      for (const control of await controls(id, original, candidate)) {
        const facts = await oracle(id, original, control.session);
        assert.equal(
          passed(facts),
          control.expectedPass,
          `${id}: invalid oracle control ${control.name}`,
        );
        probes.push({
          name: control.name,
          expectedPass: control.expectedPass,
          oracle: facts,
        });
      }
      const observation = await observe(candidate, `prepare-${id}`);
      assert.equal(observation.status, 'ready');
      save(`${folder}/${id}-fixture.json`, candidate);
      results.push({
        id,
        evidence,
        controls: probes,
        observation: {
          status: observation.status,
          views: observation.views.length,
        },
      });
      if (id !== 'interrupted') original = candidate;
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
        message: prompts.channel,
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
      'OFFLINE PREPARATION PASSED. No model generations. Live mode enforces the approved $5 ceiling.',
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
      caseId: CaseId = 'channel';
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
      let lastCandidate: Session | undefined;
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
              lastCandidate = structuredClone(candidate);
              const beforeFault = await oracle(id, original, candidate);
              if (id === 'zigzag' && !injected && passed(beforeFault)) {
                const ids = targetIds(id, original, candidate);
                const sorted = candidate.project.volumes
                  .filter((v) => ids.includes(v.id))
                  .sort((a, b) => a.position.x - b.position.x);
                const displaced = sorted[2];
                survivingIds = ids;
                save(`${folder}/zigzag-before-fault.json`, candidate);
                candidate.project = {
                  ...candidate.project,
                  volumes: candidate.project.volumes.map((v) =>
                    v.id === displaced.id
                      ? {
                          ...v,
                          position: {
                            ...v.position,
                            z: v.position.z + specification.zigzag.faultZ,
                          },
                        }
                      : v,
                  ),
                };
                record.injectedFault = {
                  type: 'displaced-component',
                  id: displaced.id,
                  before: displaced.position,
                  deltaZ: specification.zigzag.faultZ,
                  survivingIds,
                  beforeFault,
                };
                injected = true;
              }
              // Simulate a lost independent-review response exactly at the App
              // fallback boundary. The executor still uses real reasoning;
              // no AI review is fabricated or billed for this controlled fault.
              if (id === 'interrupted' && !criteria) {
                record.injectedFault = {
                  type: 'independent-review-transport-unavailable',
                  beforeFault,
                };
                assert(
                  candidate.project.volumes.some((v) =>
                    original.project.volumes.some(
                      (o) =>
                        o.id === v.id &&
                        JSON.stringify(o) !== JSON.stringify(v),
                    ),
                  ),
                  'The interrupted turn did not exercise an edit.',
                );
                criteria = unavailableCompletionCriteria(
                  'Evaluation-injected independent review transport interruption.',
                  prompts[id],
                );
                save(`${folder}/${id}-criteria.json`, criteria);
              }
              if (!criteria) {
                role = 'reviewer';
                const t = performance.now();
                try {
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
                } catch (error) {
                  const ledger: Ledger = JSON.parse(
                    readFileSync(ledgerPath, 'utf8'),
                  );
                  if (
                    ledger.calls.some(
                      (c) => c.outcome !== 'usage-reconciled',
                    ) ||
                    (error as any).cause?.code === 'ERR_ASSERTION'
                  )
                    throw error;
                  record.readerError = (error as Error).name;
                  criteria = unavailableCompletionCriteria(
                    'Independent review could not be interpreted. Its requirements remain unverified.',
                    prompts[id],
                  );
                } finally {
                  record.reviewerMs += performance.now() - t;
                }
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
                falseAcceptance:
                  id !== 'interrupted' &&
                  report.status === 'verified' &&
                  !passed(truth),
                falseRejection:
                  id !== 'interrupted' &&
                  report.status === 'incorrect' &&
                  passed(truth),
                acceptedIncorrect:
                  id !== 'interrupted' && report.canCommit && !passed(truth),
                atMs: performance.now() - started,
              });
              lastCandidate = structuredClone(candidate);
              save(`${folder}/${id}-provisional.json`, candidate);
              save(`${folder}/${id}-trace.json`, record);
              if (
                id !== 'interrupted' &&
                ((report.canCommit && !passed(truth)) ||
                  (report.status === 'incorrect' && passed(truth)))
              )
                throw new SeriousRegression(
                  'Independent verification contradicted the external geometry oracle.',
                );
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
        record.hostAccepted = checked.verification?.canCommit;
        record.verification = checked.verification;
        record.message = checked.plan.message;
        if (id === 'interrupted')
          throw new SeriousRegression(
            'An edit was accepted despite the injected unknown authorization scope.',
          );
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
        const restored = parseSession(serializeSession(result));
        assert.deepEqual(
          restored.project,
          result.project,
          'Persistence changed geometry.',
        );
        const undone = (
          await applyPlan(restored, directPlan({ type: 'undo', count: 1 }))
        ).session;
        assert.deepEqual(undone.project, original.project);
        assert.deepEqual(
          (await applyPlan(undone, directPlan({ type: 'redo', count: 1 })))
            .session.project,
          result.project,
        );
        if (id === 'zigzag') {
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
            observed = {
              passed: false,
              status: 'error',
              canCommit: false,
              error: (e as Error).message,
            };
          }
          record.controls.push({
            name: control.name,
            expectedPass: control.expectedPass,
            report: observed,
            oracle: truth,
            agrees: control.expectedPass
              ? observed.canCommit === true && observed.status !== 'incorrect'
              : observed.status === 'incorrect' && observed.canCommit === false,
          });
        }
        record.qualitativeHandling =
          id !== 'uncertain' ||
          (checked.verification?.status === 'unverified' &&
            /incomplete verification/i.test(checked.plan.message));
        if (!record.qualitativeHandling)
          throw new SeriousRegression(
            'Subjective completion was not acknowledged as unverified.',
          );
        record.status =
          record.controls.every((c: any) => c.agrees) &&
          !record.attempts.some(
            (a: any) => a.falseAcceptance || a.falseRejection,
          )
            ? id === 'uncertain' || checked.verification?.status === 'verified'
              ? 'PASS'
              : 'UNVERIFIED_MEASURABLE_RESULT'
            : 'VERIFICATION_DEFECT';
        save(`${folder}/${id}-session.json`, result);
        updatedHistory.push({
          role: 'assistant',
          content: checked.plan.message,
        });
        if (record.controls.some((c: any) => !c.agrees)) stop = true;
        save(`${folder}/${id}-history.json`, updatedHistory);
        record.transaction = {
          originalUnchanged: true,
          persistedRoundTrip: true,
          singleUndo: true,
          redoExact: true,
        };
        return { session: restored, history: updatedHistory, success: true };
      } catch (error) {
        assert.equal(
          serializeSession(original),
          committedBefore,
          'Failed turn changed original.',
        );
        record.totalMs = performance.now() - started;
        record.status =
          id === 'interrupted' &&
          (error as Error).message.includes('permitted edit scope')
            ? 'EXPECTED_SAFE_FAILURE'
            : 'FAILED_OR_BLOCKED';
        if (error instanceof SeriousRegression) {
          record.status = 'SERIOUS_REGRESSION_STOP';
          stop = true;
        }
        if (lastCandidate)
          save(`${folder}/${id}-last-candidate.json`, lastCandidate);
        const e = error as { name?: string; status?: number; message?: string };
        record.error = e.status
          ? `Provider HTTP ${e.status}`
          : e.name?.startsWith('API')
            ? e.name
            : e.message;
        if ((error as any).cause?.code === 'ERR_ASSERTION')
          record.guardReason = (error as any).cause.message;
        const budget: Ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
        if (
          budget.calls.some((c) => c.outcome !== 'usage-reconciled') ||
          /dollar ceiling/.test(record.guardReason ?? '') ||
          record.hostAccepted ||
          budget.calls.length >= 48 ||
          budgetUsed(budget) >= ceilingUsd
        )
          stop = true;
        updatedHistory.push({
          role: 'assistant',
          content: 'The request failed. No changes were committed.',
          outcome: 'failed',
        });
        save(`${folder}/${id}-history.json`, updatedHistory);
        const persisted = parseSession(serializeSession(original));
        assert.deepEqual(
          persisted,
          original,
          'Failed-turn persistence changed state.',
        );
        record.failedTransactionPreserved = true;
        return {
          session: persisted,
          history: JSON.parse(
            readFileSync(`${folder}/${id}-history.json`, 'utf8'),
          ) as Message[],
          success: false,
        };
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
    let current = {
      session: initialSession(),
      history: [] as Message[],
      success: true,
    };
    let haveChannel = false,
      expectedFailure = false;
    for (const id of order) {
      if ((id === 'widen' || id === 'interrupted') && !haveChannel) {
        results.push({ id, status: 'NOT_RUN_DEPENDENCY_FAILED' });
        continue;
      }
      if (id === 'vessel' && !expectedFailure && !stop) {
        results.push({ id, status: 'NOT_RUN_FAILURE_NOT_EXERCISED' });
        continue;
      }
      current = await turn(id, current.session, current.history);
      if (id === 'channel') haveChannel = current.success;
      if (id === 'interrupted')
        expectedFailure = results.at(-1)?.status === 'EXPECTED_SAFE_FAILURE';
    }
    save(`${folder}/results.json`, {
      manifest,
      results,
      ledger: JSON.parse(readFileSync(ledgerPath, 'utf8')),
      recommendation: 'Human review required; never deploy from this runner.',
    });
  }
} finally {
  await browser.close();
  await vite.close();
  if (lock !== undefined) {
    closeSync(lock);
    unlinkSync(`${folder}/paid-run.lock`);
  }
}
