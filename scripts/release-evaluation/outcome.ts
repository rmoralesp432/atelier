/** An evaluation outcome is distinct from the app's verification status. */
import type { CompletionReport } from '../../src/intelligence/completionSchema';
import { passed, type Fact } from './cases';
export function evaluationOutcome(
  facts: Fact[],
  report: CompletionReport | undefined,
  disclosed: boolean,
  allowDisclosedLimits = false,
) {
  if (facts.length && passed(facts) && report?.modeling && report.canCommit) {
    if (report.status === 'verified') return 'PASS';
    if (allowDisclosedLimits && report.status === 'unverified' && disclosed)
      return 'PASS_WITH_DISCLOSED_LIMITS';
  }
  return 'GEOMETRY_OR_COMPLETION_UNVERIFIED';
}
