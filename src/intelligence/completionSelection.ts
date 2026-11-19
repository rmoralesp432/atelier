import type { Volume } from '../model';
import { resolveIds, type Session } from './engine';
import type { DesignSelector } from './designBriefSchema';

/** Freeze original references, including renamed or removed original objects. */
export function completionSelection(original: Session, candidate: Session) {
  const before = new Set(original.project.volumes.map((v) => v.id));
  const after = new Set(candidate.project.volumes.map((v) => v.id));
  const matches = (v: Volume, s: DesignSelector) =>
    (s.role === null || v.component?.role === s.role) &&
    (s.level === null || v.component?.level === s.level) &&
    (s.nameContains === null ||
      v.name.toLowerCase().includes(s.nameContains.toLowerCase()));
  return (s: DesignSelector, initial = false): Volume[] => {
    const source = initial ? original : candidate;
    const ids = new Set<string>(),
      originalMatches = new Set<string>();
    for (const ref of s.refs.length ? s.refs : ['$all']) {
      if (ref === '$original')
        original.project.volumes
          .filter((v) => matches(v, s))
          .forEach((v) => {
            ids.add(v.id);
            originalMatches.add(v.id);
          });
      else if (ref === '$all')
        source.project.volumes.forEach((v) => ids.add(v.id));
      else if (ref === '$new')
        candidate.project.volumes
          .filter((v) => !before.has(v.id))
          .forEach((v) => ids.add(v.id));
      else if (before.has(ref) || after.has(ref)) ids.add(ref);
      else {
        const bound = ['$selected', '$focus', '$created', '$operands'].includes(
          ref,
        )
          ? original
          : source;
        // Group IDs and explicit group references denote the same membership.
        const normalized = bound.project.groups?.some((g) => g.id === ref)
          ? `$group:${ref}`
          : ref;
        resolveIds([normalized], bound).forEach((id) => ids.add(id));
      }
    }
    return source.project.volumes.filter(
      (v) => ids.has(v.id) && (originalMatches.has(v.id) || matches(v, s)),
    );
  };
}
