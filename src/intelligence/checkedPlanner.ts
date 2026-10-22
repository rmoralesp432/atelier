import { applyPlan, type Session } from './engine';
import type { CameraContext } from './context';
import { parsePlan, type Plan } from './plan';
export type ValidationFeedback = {
  error: string;
  operations: Plan['operations'];
};
// No changes escape this transaction. At most one additional model request is
// allowed, and only for geometry validation failures (never auth/billing errors).
export async function checkedPlan(
  session: Session,
  camera: CameraContext,
  request: (feedback?: ValidationFeedback) => Promise<Plan>,
  progress: (stage: string) => void = () => {},
): Promise<Plan> {
  let feedback: ValidationFeedback | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    progress(attempt ? 'Adjusting the geometry…' : 'Considering your idea…');
    const plan = parsePlan(await request(feedback));
    if (plan.intent !== 'apply') return plan;
    progress('Checking the geometry…');
    try {
      await applyPlan(session, plan, camera, true);
      return plan;
    } catch (error) {
      if (attempt) throw error;
      feedback = {
        error: (error instanceof Error
          ? error.message
          : 'Invalid geometry.'
        ).slice(0, 2000),
        operations: plan.operations,
      };
    }
  }
  throw new Error(
    'The proposed geometry could not be validated. Your project was preserved.',
  );
}
