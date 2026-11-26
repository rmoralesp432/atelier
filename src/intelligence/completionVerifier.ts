import type { Session } from './engine';
import type { CompletionCriteria, CriteriaRevision } from './completionSchema';
import { verifyCompletion, unavailableCompletionCriteria } from './completion';
import { acceptCriteriaRevision } from './criteriaAudit';
import { completionSelection } from './completionSelection';

/** Task-local independent verification. At most one criterion correction; all
 * geometry repairs still use the existing agent/transaction machinery. */
export function completionVerifier(
  original: Session,
  message: string,
  read: (
    candidate: Session,
    revision?: CriteriaRevision,
  ) => Promise<CompletionCriteria>,
  signal?: AbortSignal,
) {
  let criteria: CompletionCriteria | undefined;
  let revisionAttempted = false;
  return async (candidate: Session) => {
    if (!criteria) {
      try {
        criteria = await read(candidate);
      } catch (error) {
        if (signal?.aborted) throw error;
        criteria = unavailableCompletionCriteria(
          error instanceof Error
            ? error.message
            : 'Independent review could not finish.',
          message,
        );
      }
    }
    let report = await verifyCompletion(criteria, original, candidate, signal);
    if (report.criterionIssues?.length && !revisionAttempted) {
      revisionAttempted = true;
      try {
        const next = await read(candidate, {
          criteria,
          issues: report.criterionIssues,
          observations: report.checks.map(({ id, outcome, observed }) => ({
            id,
            outcome,
            observed,
          })),
        });
        criteria = acceptCriteriaRevision(
          criteria,
          next,
          report.criterionIssues,
          completionSelection(original, candidate),
        );
        report = await verifyCompletion(criteria, original, candidate, signal);
      } catch (error) {
        if (signal?.aborted) throw error;
        // Keep every original check and its uncertainty/failure. No geometry
        // repair is requested merely because the check compiler failed.
        report.qualitativeLimits = [
          ...report.qualitativeLimits.slice(0, 7),
          `Independent criterion correction did not resolve the issue: ${error instanceof Error ? error.message : 'review unavailable'}`.slice(
            0,
            300,
          ),
        ];
      }
    }
    return report;
  };
}
