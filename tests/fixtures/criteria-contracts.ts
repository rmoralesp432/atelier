import {
  applyPlan,
  directPlan,
  newSession,
} from '../../src/intelligence/engine';
import { criteria, measure, selector } from './completion';
import type { CompletionCriteria } from '../../src/intelligence/completionSchema';

export const incidentRequest = `Create a three-story contemporary office building with a 12 × 10 meter footprint and 3.5 meter floor-to-floor heights.

Include separate exposed-concrete floor slabs, a flat roof, a regular structural grid of circular concrete columns, and floor-to-ceiling glazing on all four façades.

Use reasonable architectural dimensions, consistent column spacing, and realistic slab thicknesses.

Keep all components independently editable and organized by level and material.

Build the model directly without asking unnecessary questions. Inspect the resulting geometry and verify the dimensions and alignment.`;

/** Minimal causal reproduction from the supplied screenshot and exact request.
 * This is not a recovered provider trace or a reconstruction of every component. */
export async function reportedCriteriaIncident() {
  const original = newSession({ volumes: [], selectedId: null });
  const ops = [0, 3.5, 7, 10.5].map((y, i) => ({
    type: 'create_at' as const,
    name: `Concrete ${i === 3 ? 'roof' : `slab ${i + 1}`}`,
    shape: 'box' as const,
    width: 12,
    depth: 10,
    height: 0.25,
    x: 0,
    y,
    z: 0,
    rotation: 0,
  }));
  const candidate = (
    await applyPlan(original, { ...directPlan(ops[0]), operations: ops })
  ).session;
  const checks: CompletionCriteria['checks'][number]['requirement'][] =
    candidate.project.volumes.map((v, i) =>
      measure(`datum-${i}`, 'y', i * 3.5, selector([v.id])),
    );
  const [a, b] = candidate.project.volumes;
  checks.push({
    kind: 'offset',
    id: 'reversed-offset',
    label: 'Relative elevation',
    first: selector([b.id]),
    second: selector([a.id]),
    axis: 'y',
    firstAnchor: 'min',
    secondAnchor: 'min',
    value: 3.5,
    tolerance: 0.001,
  });
  checks.push({
    kind: 'property',
    id: 'substance',
    label: 'Concrete designation',
    selector: selector(),
    property: 'material',
    value: 'concrete',
  });
  return {
    original,
    candidate,
    request: incidentRequest,
    criteria: criteria(checks, [], '3.5 meter floor-to-floor heights'),
  };
}
