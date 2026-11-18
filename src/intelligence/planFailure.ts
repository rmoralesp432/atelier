/** A model-output defect is recoverable; transport/auth/billing failures are not. */
export class ModelPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelPlanError';
  }
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
