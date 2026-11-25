import {
  completionCriteriaSchema,
  type CompletionCriteria,
} from '../../../src/intelligence/completionSchema';

/** OFFLINE criterion selection for the saved trace, NOT an application repair
 * or evidence that a fresh reviewer chooses these checks. No candidate values.
 * Keep all other requirements, authorization, citations and tolerances intact. */
export function directCriteria(task: string, raw: unknown): CompletionCriteria {
  const c = completionCriteriaSchema.parse(raw);
  const get = (id: string) => c.checks.find((v) => v.requirement.id === id)!;
  const selection = (id: string) => {
    const r = get(id).requirement;
    if (!('selector' in r)) throw Error('Saved selector missing');
    return r.selector;
  };
  const relational = (
    oldId: string,
    id: string,
    first: string,
    second: string,
    axis: 'x' | 'z',
    firstAnchor: 'min' | 'max' | 'center',
    secondAnchor: 'min' | 'max' | 'center',
  ) => {
    const old = get(oldId),
      r = old.requirement;
    if (!('tolerance' in r)) throw Error('Original tolerance missing');
    return {
      source: old.source,
      evidence: old.evidence,
      requirement: {
        kind: 'preserve_offsets' as const,
        id,
        label: `Preserve original ${axis} ${firstAnchor}/${secondAnchor} offsets`,
        first: selection(first),
        second: selection(second),
        axis,
        firstAnchor,
        secondAnchor,
        tolerance: r.tolerance,
      },
    };
  };
  c.checks = c.checks.flatMap((check) => {
    const id = check.requirement.id;
    if (task === 'L1' && id === 'check-7')
      return [
        relational(id, 'bay-left', 'check-4', 'check-3', 'x', 'min', 'max'),
        relational(id, 'bay-right', 'check-4', 'check-3', 'x', 'max', 'min'),
      ];
    if (task === 'L2' && id === 'check-7')
      return [
        relational(id, 'end-negative', 'check-3', 'check-6', 'z', 'min', 'max'),
        relational(id, 'end-positive', 'check-3', 'check-6', 'z', 'max', 'min'),
      ];
    if (task === 'L2' && id === 'check-9')
      return [
        relational(
          id,
          'leg-rail',
          'check-8',
          'check-6',
          'z',
          'center',
          'center',
        ),
      ];
    return [check];
  });
  return completionCriteriaSchema.parse(c);
}
