/** Free post-run analysis of saved real-AI outputs. Never calls a provider. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { verifyCompletion } from '../../src/intelligence/completion';
import { applyPlan } from '../../src/intelligence/engine';
import { defaultCamera } from '../../src/intelligence/context';
import { equalData } from '../../src/projects/equalData';
import { controls, oracle, type CaseId } from './cases';
import { budgetUsed, save, type Ledger } from './budget';

const folder = '.cloud/completion-live-evaluation';
assert(
  !existsSync(`${folder}/paid-run.lock`),
  'Wait for live execution to finish.',
);
const read = (name: string) =>
  JSON.parse(readFileSync(`${folder}/${name}.json`, 'utf8'));
const run = read('results');
const ledger: Ledger = read('ledger');
const results = [];
for (const entry of run.results) {
  const id: CaseId = entry.id;
  if (!existsSync(`${folder}/${id}-trace.json`)) {
    results.push({ id, status: entry.status, paidCalls: 0 });
    continue;
  }
  const trace = read(`${id}-trace`);
  const original = read(`${id}-original`);
  const snapshot = existsSync(`${folder}/${id}-session.json`)
    ? `${id}-session`
    : existsSync(`${folder}/${id}-provisional.json`)
      ? `${id}-provisional`
      : null;
  const criteria = existsSync(`${folder}/${id}-criteria.json`)
    ? read(`${id}-criteria`)
    : null;
  const candidate = snapshot ? read(snapshot) : null;
  const evidence = candidate ? await oracle(id, original, candidate) : [];
  // If review aborts before the live snapshot is persisted, do not count an
  // empty evidence list as a pass. Keep a geometry-only replay clearly separate.
  let geometryReplay = null;
  if (id === 'plate' && !candidate) {
    const plans = trace.attempts.filter((a: any) => a.plan?.intent === 'apply');
    assert(plans.length === 2);
    assert(
      plans[1].plan.operations.every((o: any) =>
        ['measure', 'verify', 'select_query'].includes(o.type),
      ),
    );
    // Match stagedPlan's private transaction call; this never commits to a UI
    // project and does not bypass the live completion/review decision.
    const replay = (
      await applyPlan(original, plans[0].plan, defaultCamera, true)
    ).session;
    const replayEvidence = await oracle(id, original, replay);
    save(`${folder}/${id}-geometry-replay.json`, replay);
    geometryReplay = {
      source:
        'Free replay of the actual recorded AI geometry plan; not a live completion pass. Later recorded operations only inspected/selected objects.',
      evidence: replayEvidence,
      passed: replayEvidence.every((c) => c.passed),
    };
  }
  const probes = [];
  if (candidate && criteria && evidence.every((c) => c.passed)) {
    for (const control of await controls(id, original, candidate)) {
      const facts = await oracle(id, original, control.session);
      assert.equal(
        facts.every((c) => c.passed),
        control.expectedPass,
      );
      const report = await verifyCompletion(
        criteria,
        original,
        control.session,
      );
      probes.push({
        name: control.name,
        expectedPass: control.expectedPass,
        passed: report.passed,
        failedChecks: report.checks.filter((c) => !c.met),
      });
    }
  }
  const calls = ledger.calls.filter((c) => c.caseId === id);
  const originalMap = new Map(
    original.project.volumes.map((v: any) => [v.id, v]),
  );
  const retainedIds = trace.injectedFault?.survivingIds ?? [];
  results.push({
    id,
    status: trace.status,
    error: trace.error,
    paidCalls: calls.length,
    cost: trace.cost,
    totalMs: trace.totalMs,
    firstCompletionAttemptMs: trace.firstCompletionAttemptMs,
    afterFirstCompletionAttemptMs:
      trace.firstCompletionAttemptMs === undefined
        ? null
        : trace.totalMs - trace.firstCompletionAttemptMs,
    reviewerMs: calls
      .filter((c) => c.role === 'reviewer')
      .reduce((n, c) => n + (c.elapsedMs ?? 0), 0),
    hostChecksMs: trace.hostChecksMs,
    observationsMs: trace.observationsMs,
    candidateSnapshot: snapshot,
    candidateEvidence: evidence,
    geometryReplay,
    existingGeometryPreserved:
      candidate &&
      [...originalMap.entries()].every(([key, value]) =>
        equalData(
          value,
          candidate.project.volumes.find((v: any) => v.id === key),
        ),
      ),
    survivingRepairIdsRetained: retainedIds.length
      ? retainedIds.every((key: string) =>
          candidate?.project.volumes.some((v: any) => v.id === key),
        )
      : null,
    completionAttempts: trace.attempts
      .filter((a: any) => a.kind === 'completion')
      .map((a: any) => ({
        atMs: a.atMs,
        passed: a.report.passed,
        geometryCorrect: a.externalOracle.every((c: any) => c.passed),
        failedChecks: a.report.checks.filter((c: any) => !c.met),
      })),
    localProbes: probes,
  });
}
const summary = {
  model: run.manifest.model,
  productionCommit: run.manifest.productionCommit,
  ceilingUsd: ledger.ceilingUsd,
  calls: ledger.calls.length,
  estimatedUsd: ledger.calls.reduce((n, c) => n + (c.estimatedUsd ?? 0), 0),
  reservedOrChargedWithMarginUsd: budgetUsed(ledger),
  unresolvedCalls: ledger.calls.filter((c) => c.outcome !== 'usage-reconciled')
    .length,
  results,
  note: 'Post-run probes reuse actual AI criteria; no criteria, model geometry, or AI feedback is changed to pass a test. A correct provisional model is not a successful committed request.',
};
save(`${folder}/analysis.json`, summary);
console.log(
  JSON.stringify(
    {
      ...summary,
      results: results.map((r) => ({
        id: r.id,
        status: r.status,
        paidCalls: r.paidCalls,
        geometryCorrect: r.candidateSnapshot
          ? r.candidateEvidence?.every((c) => c.passed)
          : null,
        geometryReplayPassed: r.geometryReplay?.passed,
        cost: r.cost,
        totalMs: r.totalMs,
      })),
    },
    null,
    2,
  ),
);
