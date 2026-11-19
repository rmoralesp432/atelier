import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluationOutcome } from './outcome';
import type { CompletionReport } from '../../src/intelligence/completionSchema';
test('honest unknown status cannot replace independent geometric evidence or authorized scope', () => {
  const report: CompletionReport = {
    modeling: true,
    passed: false,
    status: 'unverified',
    canCommit: true,
    checks: [],
    qualitativeLimits: [],
  };
  const facts = [
    { name: 'All required occupied geometry', status: 'verified' as const },
  ];
  assert.equal(
    evaluationOutcome(facts, report, true, true),
    'PASS_WITH_DISCLOSED_LIMITS',
  );
  assert.equal(report.status, 'unverified');
  assert.equal(
    evaluationOutcome(facts, report, true, false),
    'GEOMETRY_OR_COMPLETION_UNVERIFIED',
  );
  for (const state of ['incorrect', 'unverified'] as const)
    assert.equal(
      evaluationOutcome([{ ...facts[0], status: state }], report, true, true),
      'GEOMETRY_OR_COMPLETION_UNVERIFIED',
    );
  assert.equal(
    evaluationOutcome(facts, report, false, true),
    'GEOMETRY_OR_COMPLETION_UNVERIFIED',
  );
  assert.equal(
    evaluationOutcome(facts, { ...report, canCommit: false }, true, true),
    'GEOMETRY_OR_COMPLETION_UNVERIFIED',
  );
  assert.equal(
    evaluationOutcome(facts, { ...report, modeling: false }, true, true),
    'GEOMETRY_OR_COMPLETION_UNVERIFIED',
  );
  assert.equal(
    evaluationOutcome([], report, true, true),
    'GEOMETRY_OR_COMPLETION_UNVERIFIED',
  );
});
