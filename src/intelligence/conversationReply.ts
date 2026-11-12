import type { Plan } from './plan';

/** Query answers come from execution, never from a proposed natural-language
 * number. Modeling turns can keep a concise summary above their full receipts. */
export function displaySummary(plan: Plan, agent = false): string | undefined {
  const isMeasurement = plan.operations.some(
    (op) => op.type === 'measure' || op.type === 'solar_study',
  );
  if (!agent) return isMeasurement ? undefined : plan.message;
  const queryOnly = plan.operations.every((op) =>
    [
      'measure',
      'verify',
      'verify_relation',
      'solar_study',
      'select',
      'select_query',
    ].includes(op.type),
  );
  return queryOnly ? undefined : plan.message;
}
