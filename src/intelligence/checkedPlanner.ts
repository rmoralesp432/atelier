import {
  applyPlan,
  freezeWorkspaceOperation,
  validateWorkspaceEffects,
  type Session,
} from './engine';
import type { CameraContext } from './context';
import { parsePlan, needsConfirmation, type Plan } from './plan';
import type { ExecutionContext } from './executionProtocol';
import { equalData } from '../projects/equalData';

export type ValidationFeedback = {
  error: string;
  operations: Plan['operations'];
};
export type PreparedPlan = Awaited<ReturnType<typeof applyPlan>>;
export type CheckedResult = {
  plan: Plan;
  prepared?: PreparedPlan;
  stages: number;
  reviewRequired?: boolean;
  labels?: Record<string, string>;
};

/** Private transaction: continuations see real identities and engine receipts.
 * Install the final result once; never replay a validated stage with new IDs. */
export async function stagedPlan(
  original: Session,
  camera: CameraContext,
  request: (
    session: Session,
    feedback?: ValidationFeedback,
    execution?: ExecutionContext,
  ) => Promise<Plan>,
  progress: (stage: string) => void = () => {},
  signal?: AbortSignal,
): Promise<CheckedResult> {
  let session = original,
    execution: ExecutionContext | undefined;
  const operations: Plan['operations'] = [],
    receipts: ExecutionContext['receipts'] = [],
    reports: string[] = [];
  const assumptions = new Set<string>();
  const labels: Record<string, string> = Object.fromEntries(
    original.project.volumes.map((v) => [v.id, v.name]),
  );
  let repairs = 0,
    stages = 0,
    finalPlan: Plan | undefined;
  const checkAbort = () => {
    if (signal?.aborted)
      throw new Error('Stopped. No changes were applied to your project.');
  };
  for (let stage = 0; stage < 5; stage++) {
    let feedback: ValidationFeedback | undefined;
    for (;;) {
      checkAbort();
      progress(
        feedback
          ? 'Correcting the checked geometry…'
          : stage
            ? `Developing the design · stage ${stage + 1}…`
            : 'Considering your idea…',
      );
      // Transport/auth/billing failures are never retried automatically.
      const plan = parsePlan(await request(session, feedback, execution));
      checkAbort();
      if (plan.intent === 'finish') {
        if (!stages || plan.planning?.next)
          throw new Error(
            'The model ended before producing a verifiable result. No changes were applied.',
          );
        finalPlan = plan;
        break;
      }
      if (plan.intent !== 'apply') {
        if (stages && ['confirm', 'cancel'].includes(plan.intent))
          throw new Error(
            'A staged design cannot approve a different pending change. No changes were applied.',
          );
        // Clarification aborts earlier proposals, leaving no half-built design.
        return {
          plan: stages
            ? { ...plan, message: `No changes applied yet. ${plan.message}` }
            : plan,
          stages: 0,
        };
      }
      if (operations.length + plan.operations.length > 64)
        throw new Error(
          'This design exceeded the 64-operation transaction budget. Nothing was applied; split it into smaller design requests.',
        );
      if (
        stage &&
        plan.operations.some((op) => op.type === 'undo' || op.type === 'redo')
      )
        throw new Error(
          'Undo must start a design request. No staged changes were applied.',
        );
      progress(`Checking ${plan.planning?.stage ?? 'the geometry'}…`);
      try {
        const result = await applyPlan(session, plan, camera, true);
        checkAbort();
        const stageOperations = plan.operations.map((op) =>
          freezeWorkspaceOperation(op, result.session),
        );
        const before = new Map(session.project.volumes.map((v) => [v.id, v]));
        const after = new Map(
          result.session.project.volumes.map((v) => [v.id, v]),
        );
        receipts.push({
          stage: plan.planning?.stage ?? `Stage ${stage + 1}`,
          result: result.message.slice(0, 14000),
          created: [...after.keys()].filter((id) => !before.has(id)),
          changed: [...after.keys()].filter(
            (id) => before.has(id) && !equalData(before.get(id), after.get(id)),
          ),
          removed: [...before.keys()].filter((id) => !after.has(id)),
        });
        session = result.session;
        operations.push(...stageOperations);
        session.project.volumes.forEach((v) => {
          labels[v.id] = v.name;
        });
        plan.planning?.assumptions.forEach((note) => assumptions.add(note));
        reports.push(result.message);
        stages++;
        finalPlan = plan;
        break;
      } catch (error) {
        checkAbort();
        if (repairs++ >= 1) throw error;
        feedback = {
          error: (error instanceof Error
            ? error.message
            : 'Invalid geometry.'
          ).slice(0, 2000),
          operations: plan.operations,
        };
      }
    }
    if (
      !finalPlan ||
      finalPlan.intent === 'finish' ||
      !finalPlan.planning?.next
    )
      break;
    if (stage === 4)
      throw new Error(
        'The design did not finish within five checked stages. Nothing was applied; ask for a smaller scope.',
      );
    execution = {
      stage: stage + 2,
      remaining: 3 - stage,
      next: finalPlan.planning.next,
      receipts,
    };
  }
  if (!finalPlan || !operations.length)
    throw new Error('No verified modeling result was produced.');
  // A complete conversation turn is one undo step. Even at the history cap,
  // compare entries, not lengths; simple one-stage undo/redo is unchanged.
  if (
    stages > 1 &&
    (session.past.length !== original.past.length ||
      session.past.at(-1) !== original.past.at(-1))
  ) {
    session = {
      ...session,
      past: [...original.past.slice(-49), original.project],
      future: [],
    };
  }
  const plan = parsePlan({
    ...finalPlan,
    intent: 'apply',
    operations,
    planning: finalPlan.planning ? { ...finalPlan.planning, next: null } : null,
  });
  validateWorkspaceEffects(session, operations);
  if (assumptions.size)
    reports.push(`Design assumptions:\n${[...assumptions].join('\n')}`);
  const after = new Map(session.project.volumes.map((v) => [v.id, v]));
  const reviewRequired =
    needsConfirmation(plan) &&
    original.project.volumes.some((v) => {
      const next = after.get(v.id);
      return (
        !next ||
        !equalData(
          [v.geometry, v.dimensions, v.position, v.rotation],
          [next.geometry, next.dimensions, next.position, next.rotation],
        )
      );
    });
  return {
    plan,
    prepared: { session, message: reports.filter(Boolean).join('\n') },
    stages,
    reviewRequired,
    labels,
  };
}

export async function checkedPlan(
  session: Session,
  camera: CameraContext,
  request: (feedback?: ValidationFeedback) => Promise<Plan>,
  progress: (stage: string) => void = () => {},
) {
  return (
    await stagedPlan(
      session,
      camera,
      (_s, feedback) => request(feedback),
      progress,
    )
  ).plan;
}
