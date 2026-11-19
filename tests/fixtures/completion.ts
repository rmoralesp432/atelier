import type { CompletionCriteria } from '../../src/intelligence/completionSchema';
import type {
  DesignRequirement,
  DesignSelector,
} from '../../src/intelligence/designBriefSchema';

export const selector = (
  refs: string[] = ['$new'],
  nameContains: string | null = null,
): DesignSelector => ({ refs, nameContains, role: null, level: null });
export function measure(
  id: string,
  metric: 'count' | 'width' | 'depth' | 'height' | 'x' | 'y' | 'z' | 'volume',
  value: number,
  selection = selector(),
): Extract<DesignRequirement, { kind: 'measure' }> {
  return {
    id,
    label: `${metric} requirement`,
    kind: 'measure',
    selector: selection,
    metric,
    aggregation: 'each',
    comparison: 'equal',
    value,
    tolerance: metric === 'count' ? 0 : 0.00001,
    relativeTolerance: 0,
  };
}
export function criteria(
  requirements: CompletionCriteria['checks'][number]['requirement'][],
  editable: string[] = [],
  evidence = 'Create the requested model',
): CompletionCriteria {
  return {
    modeling: true,
    editable,
    checks: requirements.map((requirement) => ({
      source: 'request',
      evidence,
      requirement,
    })),
    qualitativeLimits: [],
  };
}
