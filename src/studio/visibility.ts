import { isVisible, type Project } from '../model';

/** Visibility is a reversible presentation edit, including for locked objects. */
export function setObjectVisibility(
  project: Project,
  targets: string[] | 'all',
  visible: boolean,
): Project {
  const ids = new Set(
    targets === 'all' ? project.volumes.map((v) => v.id) : targets,
  );
  const revealGroups = new Set(
    visible
      ? project.volumes.filter((v) => ids.has(v.id)).map((v) => v.groupId)
      : [],
  );
  const next: Project = {
    ...project,
    groups: project.groups?.map((g) =>
      visible && (targets === 'all' || revealGroups.has(g.id))
        ? { ...g, visible: true }
        : g,
    ),
    volumes: project.volumes.map((v) => {
      if (ids.has(v.id)) return { ...v, visible };
      // Revealing one item in a hidden layer must not reveal its siblings.
      if (visible && revealGroups.has(v.groupId) && !isVisible(v, project))
        return { ...v, visible: false };
      return v;
    }),
  };
  const selected = (
    next.selectedIds ?? (next.selectedId ? [next.selectedId] : [])
  ).filter((id) => next.volumes.some((v) => v.id === id && isVisible(v, next)));
  next.selectedIds = selected;
  next.selectedId = selected.includes(next.selectedId ?? '')
    ? next.selectedId
    : (selected[0] ?? null);
  return next;
}
