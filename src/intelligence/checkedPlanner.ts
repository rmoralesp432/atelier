import { ModelPlanError, invalidModelPlan } from './planFailure';
import { ZodError } from 'zod';
import {
  applyPlan,
  freezeWorkspaceOperation,
  validateWorkspaceEffects,
  resolveIds,
  type Session,
} from './engine';
import type { CameraContext } from './context';
import { parsePlan, needsConfirmation, type Plan } from './plan';
import type { ExecutionContext } from './executionProtocol';
import { equalData } from '../projects/equalData';
import { bindBrief, checkEditScope, assessBrief } from './designBrief';
import type { DesignBrief, BriefAssessment } from './designBriefSchema';

export type ValidationFeedback = {
  error: string;
  operations: Plan['operations'];
  brief?: DesignBrief;
};
export type PreparedPlan = Awaited<ReturnType<typeof applyPlan>>;
export type CheckedResult = {
  plan: Plan;
  prepared?: PreparedPlan;
  stages: number;
  reviewRequired?: boolean;
  labels?: Record<string, string>;
};
const modeledEdits = new Set([
  'edit_blend',
  'sculpt',
  'smooth_boolean',
  'organic_form',
  'edit_control_points',
  'inset_layout',
  'create',
  'create_at',
  'assembly',
  'profile_solid',
  'revolve',
  'sweep',
  'loft',
  'boolean',
  'hollow',
  'opening',
  'edit_opening',
  'opening_shape',
  'glaze_opening',
  'building',
  'building_components',
  'components',
  'split_levels',
  'bridge',
  'furnish',
  'attach',
  'extrude',
  'footprint',
  'move',
  'position',
  'resize',
  'scale',
  'constrained_resize',
  'stretch',
  'rotate',
  'rotate_group',
  'orient',
  'mirror',
  'duplicate',
  'array_grid',
  'array_polar',
  'progressive_array',
  'delete',
  'color',
  'material',
  'rename',
  'align',
  'place',
  'spread',
  'offset_base',
]);
const constructedSystems = new Set([
  'edit_blend',
  'sculpt',
  'smooth_boolean',
  'organic_form',
  'inset_layout',
  'assembly',
  'profile_solid',
  'revolve',
  'sweep',
  'loft',
  'boolean',
  'hollow',
  'opening',
  'edit_opening',
  'opening_shape',
  'glaze_opening',
  'building',
  'building_components',
  'components',
  'split_levels',
  'bridge',
  'furnish',
  'array_grid',
  'array_polar',
  'progressive_array',
]);
function needsBrief(plan: Plan, session: Session) {
  const edits = plan.operations.filter((op) => modeledEdits.has(op.type));
  if (
    (plan.planning?.next && edits.length > 0) ||
    edits.length > 1 ||
    edits.some((op) => constructedSystems.has(op.type))
  )
    return true;
  return edits.some((op) => {
    if ('count' in op && typeof op.count === 'number' && op.count > 1)
      return true;
    if ('targets' in op) {
      try {
        return resolveIds(op.targets, session).length > 1;
      } catch {
        return false;
      }
    }
    return false;
  });
}

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
  options: { agent?: boolean } = {},
): Promise<CheckedResult> {
  const maxStages = options.agent ? 12 : 5;
  const maxRepairs = options.agent ? 3 : 2;
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
  let brief: DesignBrief | undefined, declaredBrief: DesignBrief | undefined;
  let scopeOriginal = original;
  let historyPrefix: Plan['operations'] = [];
  const leadingHistory = (plan: Plan) => {
    const prefix: Plan['operations'] = [];
    for (const op of plan.operations) {
      if (op.type !== 'undo' && op.type !== 'redo') break;
      prefix.push(op);
    }
    return prefix;
  };
  const sameAgreement = (candidate: DesignBrief) => {
    // New provisional parts were never protected original project objects.
    // Listing them explicitly does not expand permission over the originals.
    const originalIds = new Set(scopeOriginal.project.volumes.map((v) => v.id));
    const provisionalIds = new Set(
      session.project.volumes
        .filter((v) => !originalIds.has(v.id))
        .map((v) => v.id),
    );
    const normalized = {
      ...candidate,
      editable: candidate.editable.filter((id) => !provisionalIds.has(id)),
    };
    return equalData(normalized, declaredBrief) || equalData(normalized, brief);
  };
  let assessment: BriefAssessment[] = [],
    continuationFeedback: ValidationFeedback | undefined;
  const unmet = () => assessment.filter((r) => !r.met);
  const requirementError = () =>
    `Design requirements are not satisfied: ${unmet()
      .map((r) => `${r.label}: ${r.observed}`)
      .join(
        ' ',
      )} Keep the agreed brief; correct the existing provisional model instead of recreating successful stages.`.slice(
      0,
      2000,
    );
  const incompleteDesign = () =>
    new Error(
      `I couldn't satisfy these design requirements: ${unmet()
        .slice(0, 5)
        .map((r) => r.label)
        .join('; ')}. Your project is unchanged.`,
    );
  const checkAbort = () => {
    if (signal?.aborted)
      throw new Error('Stopped. No changes were applied to your project.');
  };
  for (let stage = 0; stage < maxStages; stage++) {
    let feedback: ValidationFeedback | undefined = continuationFeedback;
    continuationFeedback = undefined;
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
      let plan: Plan;
      try {
        plan = parsePlan(await request(session, feedback, execution));
      } catch (error) {
        checkAbort();
        if (!(error instanceof ModelPlanError || error instanceof ZodError))
          throw error;
        if (repairs++ >= maxRepairs) throw error;
        feedback = {
          error:
            error instanceof ModelPlanError
              ? error.message
              : invalidModelPlan(error).message,
          operations: [],
          ...(brief ? { brief } : {}),
        };
        continue;
      }
      checkAbort();
      if (plan.intent === 'finish') {
        if (!stages || plan.planning?.next)
          throw new Error(
            'The model ended before producing a verifiable result. No changes were applied.',
          );
        if (brief && unmet().length) {
          if (repairs++ >= 2) throw incompleteDesign();
          feedback = { error: requirementError(), operations: [] };
          feedback.brief = brief;
          continue;
        }
        if (plan.brief && !sameAgreement(plan.brief))
          throw new Error(
            'The final answer changed the agreed design brief. No changes were applied.',
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
        if (plan.brief) {
          if (brief) {
            if (!sameAgreement(plan.brief))
              throw new Error(
                'The agreed design brief cannot be weakened or replaced during a request. Use execution.brief and correct the geometry.',
              );
          } else {
            if (stages)
              throw new Error(
                'Declare the design brief before creating geometry, not after seeing the result.',
              );
            historyPrefix = leadingHistory(plan);
            scopeOriginal = historyPrefix.length
              ? (
                  await applyPlan(
                    original,
                    {
                      ...plan,
                      operations: historyPrefix,
                      brief: null,
                      planning: null,
                    },
                    camera,
                    true,
                  )
                ).session
              : original;
            brief = bindBrief(plan.brief, scopeOriginal);
            declaredBrief = structuredClone(plan.brief);
          }
        } else if (
          !options.agent &&
          plan.brief === null &&
          !brief &&
          needsBrief(plan, session)
        ) {
          // Older saved/manual plans may omit this field. The live provider's
          // strict schema includes it and complex work must declare its goals.
          throw new Error(
            'This modeling request needs a brief with edit scope and measurable requirements before construction.',
          );
        }
        if (brief && !stages && !equalData(leadingHistory(plan), historyPrefix))
          throw new Error(
            'Keep the agreed Undo/Redo prefix while correcting this request.',
          );
        const result = await applyPlan(session, plan, camera, true);
        if (brief) checkEditScope(brief, scopeOriginal, result.session);
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
        if (brief) assessment = await assessBrief(brief, session);
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
        if (repairs++ >= (options.agent ? maxRepairs : brief ? 2 : 1))
          throw error;
        feedback = {
          error: (error instanceof Error
            ? error.message
            : 'Invalid geometry.'
          ).slice(0, 2000),
          operations: plan.operations,
          ...(brief ? { brief } : {}),
        };
      }
    }
    if (!finalPlan || finalPlan.intent === 'finish') break;
    const finishing = !finalPlan.planning?.next;
    if (finishing && (!brief || !unmet().length)) break;
    if (finishing) {
      if (repairs++ >= 2) throw incompleteDesign();
      continuationFeedback = { error: requirementError(), operations: [] };
      continuationFeedback.brief = brief;
    }
    if (stage === maxStages - 1)
      throw new Error(
        options.agent
          ? `The design did not finish within ${maxStages} checked steps. Nothing was applied.`
          : 'The design did not finish within five checked stages. Nothing was applied; ask for a smaller scope.',
      );
    execution = {
      stage: stage + 2,
      remaining: maxStages - stage - 2,
      next:
        finalPlan.planning?.next ??
        'Correct unmet design requirements, preserving completed geometry.',
      receipts,
      ...(brief ? { brief, assessment } : {}),
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
    brief: brief ?? finalPlan.brief,
    planning: finalPlan.planning ? { ...finalPlan.planning, next: null } : null,
  });
  validateWorkspaceEffects(session, operations);
  if (assumptions.size)
    reports.push(`Design assumptions:\n${[...assumptions].join('\n')}`);
  if (brief) {
    checkEditScope(brief, scopeOriginal, session);
    if (unmet().length) throw incompleteDesign();
    reports.push(
      `Design brief checked: ${brief.objective}`,
      ...assessment.map((r) => `${r.label}: ${r.observed}`),
    );
    session = { ...session, context: { ...session.context, lastBrief: brief } };
  }
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
