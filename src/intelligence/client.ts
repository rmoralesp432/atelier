import { readLanguage } from '../conversation/language';
import type { SceneObservation } from './observation';
import { ModelPlanError, TaskBlockedError } from './planFailure';
import type { ExecutionContext } from './executionProtocol';
import type { ValidationFeedback } from './checkedPlanner';
import { parsePlan, type Operation } from './plan';
import { sceneContext, type CameraContext } from './context';
import type { Session } from './engine';
import {
  completionCriteriaSchema,
  type CriteriaRevision,
} from './completionSchema';
export type Message = {
  role: 'user' | 'assistant';
  content: string;
  summary?: string;
  images?: string[];
  outcome?: 'failed';
};
export type Connection = {
  configured: boolean;
  authenticated: boolean;
  voiceConfigured: boolean;
  agentConfigured?: boolean;
};
export function conversationHistory(history: Message[], images?: string[]) {
  const lastImage = [...history].reverse().find((m) => m.images?.length);
  return history.slice(-20).map((m) => ({
    role: m.role,
    content:
      `${m.outcome === 'failed' ? '[Previous request failed; no proposed changes were committed. This is not pending work. Follow the latest instruction and the current scene.]\n' : ''}${m.role === 'assistant' && m.summary ? m.summary : m.content}`.slice(
        0,
        4000,
      ),
    ...(m.role === 'user' && m === lastImage && !images?.length
      ? { images: m.images }
      : {}),
  }));
}
export async function requestCompletionCriteria(
  message: string,
  original: Session,
  candidate: Session,
  camera: CameraContext,
  history: Message[],
  images: string[],
  signal?: AbortSignal,
  revision?: CriteriaRevision,
) {
  const response = await fetch('/api/completion-criteria', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      message,
      images,
      history: conversationHistory(history, images),
      scene: sceneContext(original.project, original.context, camera),
      candidate: candidate.project.volumes.map((v) => ({
        id: v.id,
        name: v.name,
        groupId: v.groupId ?? null,
        role: v.component?.role ?? null,
        level: v.component?.level ?? null,
      })),
      ...(revision ? { revision } : {}),
    }),
  });
  const data = await response.json().catch(() => {
    throw new Error('Independent completion verification is unavailable.');
  });
  if (!response.ok)
    throw new Error(
      data.error || 'Independent completion verification could not finish.',
    );
  return completionCriteriaSchema.parse(data);
}
export async function connection(): Promise<Connection> {
  try {
    const r = await fetch('/api/config');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { configured: false, authenticated: true, voiceConfigured: false };
  }
}
export async function requestPlan(
  message: string,
  session: Session,
  camera: CameraContext,
  history: Message[],
  signal?: AbortSignal,
  pendingReview?: {
    message: string;
    operations: Operation[];
    outcome: string;
  } | null,
  workspace?: {
    solar?: import('../studio/solar').SolarStudy;
    solarPlaying?: boolean;
    mapVisible: boolean;
    arActive?: boolean;
    mapConfigured: boolean;
    view: 'perspective' | 'orthographic' | 'top';
    theme: 'day' | 'night';
    renderMode: 'studio' | 'wireframe' | 'hidden-line';
    section?: import('../studio/section').SectionView;
  },
  validationFeedback?: ValidationFeedback,
  images?: string[],
  execution?: ExecutionContext,
  observation?: SceneObservation,
) {
  const r = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      language: readLanguage(),
      execution,
      observation,
      validationFeedback,
      images,
      pendingReview,
      workspace,
      historyAvailability: {
        undo: session.past.length,
        redo: session.future.length,
      },
      scene: sceneContext(session.project, session.context, camera),
      history: conversationHistory(history, images),
    }),
    signal,
  }).catch((error: unknown) => {
    if (signal?.aborted) throw error;
    throw new Error(
      'The connection to ATELIER was interrupted. Your committed project is unchanged. Check your connection before sending another instruction.',
    );
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw new Error(
      'The AI backend is unavailable. Open ATELIER through its configured application server.',
    );
  }
  if (!r.ok && data.code === 'invalid_plan')
    throw new ModelPlanError(data.error);
  if (!r.ok && data.code === 'modeling_blocked')
    throw new TaskBlockedError(data.error);
  if (!r.ok)
    throw new Error(
      data.error || 'The AI request failed. No geometry was changed.',
    );
  return parsePlan(data);
}
export { VoiceConnection } from '../conversation/VoiceConnection';
