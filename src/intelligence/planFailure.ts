/** A model-output defect is recoverable; transport/auth/billing failures are not. */
export class ModelPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelPlanError';
  }
}
/** A modeled task can be infeasible or contradictory without a provider outage.
 * It must end this transaction, not enter the invalid-tool-arguments retry loop. */
export class TaskBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskBlockedError';
  }
}

/** Only the presentation boundary hides schema details; the agent still receives
 * full execution diagnostics during autonomous correction. */
export function modelingFailureMessage(error: unknown): string {
  if (error instanceof ModelPlanError)
    return 'I could not turn this request into a valid modeling operation after trying to correct it. Your project is unchanged. Try describing the intended shape or change another way.';
  const message =
    error instanceof Error
      ? error.message
      : 'The modeling request could not be completed.';
  return message.replace(
    /^Step \d+ \([^)]+\):\s*/,
    'I could not complete the edit: ',
  );
}
export function invalidModelPlan(error: unknown): ModelPlanError {
  const issues = (
    error as { issues?: { path: PropertyKey[]; message: string }[] }
  )?.issues;
  return new ModelPlanError(
    issues
      ? issues
          .slice(0, 8)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')
          .slice(0, 1800)
      : 'The model returned incomplete or invalid tool arguments. Use the declared tool fields and types.',
  );
}
