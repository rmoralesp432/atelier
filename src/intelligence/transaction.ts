import type { Project } from '../model';
import { equalData } from '../projects/equalData';
import type { Session } from './engine';

/** Model objects are immutable. Copy the mutable history/context containers so
 * UI selection and Undo cannot change a request's inputs while it awaits AI. */
export function captureTransaction(session: Session): Session {
  return {
    project: {
      ...session.project,
      selectedIds: session.project.selectedIds?.slice(),
    },
    past: session.past.slice(),
    future: session.future.slice(),
    context: structuredClone(session.context),
  };
}

function model(project: Project) {
  const {
    selectedId: _selectedId,
    selectedIds: _selectedIds,
    ...persistent
  } = project;
  return persistent;
}
function sameModel(a: Project, b: Project) {
  return a === b || equalData(model(a), model(b));
}
function sameHistory(a: Project[], b: Project[]) {
  return (
    a.length === b.length && a.every((project, i) => sameModel(project, b[i]))
  );
}
export class TransactionConflictError extends Error {
  constructor() {
    super(
      'Your project or Undo history changed during modeling. Your latest edits were kept; the completed result was not applied.',
    );
    this.name = 'TransactionConflictError';
  }
}

/** Geometry, identity, visibility, grouping, locks, site/design data and both
 * history stacks are protected. Selection/focus are workspace activity, not an
 * edit conflict. Camera, preview and autosave never enter this comparison. */
export function assertTransactionCurrent(original: Session, live: Session) {
  if (
    !sameModel(original.project, live.project) ||
    !sameHistory(original.past, live.past) ||
    !sameHistory(original.future, live.future)
  )
    throw new TransactionConflictError();
}

/** Install the already-verified candidate, never replay its operations or IDs.
 * Explicit selection made while waiting wins over the agent's incidental focus. */
export function reconcileTransaction(
  original: Session,
  candidate: Session,
  live: Session,
): Session {
  assertTransactionCurrent(original, live);
  const selectionChanged = !equalData(
    [original.project.selectedId, original.project.selectedIds],
    [live.project.selectedId, live.project.selectedIds],
  );
  const focusChanged = !equalData(
    original.context.focusIds,
    live.context.focusIds,
  );
  if (!selectionChanged && !focusChanged) return candidate;
  const ids = new Set(candidate.project.volumes.map((v) => v.id));
  return {
    ...candidate,
    project: selectionChanged
      ? {
          ...candidate.project,
          selectedId:
            live.project.selectedId && ids.has(live.project.selectedId)
              ? live.project.selectedId
              : null,
          selectedIds: live.project.selectedIds?.filter((id) => ids.has(id)),
        }
      : candidate.project,
    context: focusChanged
      ? {
          ...candidate.context,
          focusIds: live.context.focusIds.filter((id) => ids.has(id)),
        }
      : candidate.context,
  };
}
