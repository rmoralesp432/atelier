import { equivalentCalculation } from './calculationEquivalence';
import { equalData } from '../projects/equalData';
import { renderMaterials } from '../materials';
import { componentRoles } from '../design/schema';
import type { Volume } from '../model';
import type { DesignSelector } from './designBriefSchema';
import type { CompletionCriteria, CriterionIssue } from './completionSchema';

type Requirement = CompletionCriteria['checks'][number]['requirement'];
type Offset = Extract<Requirement, { kind: 'offset' }>;
type Select = (s: DesignSelector) => Volume[];
type Edge = { from: string; to: string; bound: number; check: string };
const origin = '$world-origin';
const anchor = (id: string, axis: string, datum: string) =>
  JSON.stringify([id, axis, datum]);
const one = (s: DesignSelector, select: Select) => {
  try {
    const vs = select(s);
    return vs.length === 1 ? vs[0].id : undefined;
  } catch {
    return undefined;
  }
};
function endpoints(r: Offset, select: Select) {
  const a = one(r.first, select),
    b = one(r.second, select);
  return a && b && a !== b
    ? [anchor(a, r.axis, r.firstAnchor), anchor(b, r.axis, r.secondAnchor)]
    : undefined;
}

/** Expected-coordinate constraints only. NEVER infer intent from the candidate's
 * dimensions/positions. Selectors bind identities; all numbers come from criteria.
 * Difference constraints carry tolerances and preserve world axes and datums. */
function constraints(criteria: CompletionCriteria, select: Select): Edge[] {
  const edges: Edge[] = [];
  const interval = (
    from: string,
    to: string,
    lo: number,
    hi: number,
    check: string,
  ) => {
    if (Number.isFinite(hi)) edges.push({ from, to, bound: hi, check });
    if (Number.isFinite(lo))
      edges.push({ from: to, to: from, bound: -lo, check });
  };
  for (const { requirement: r } of criteria.checks) {
    if (r.kind === 'offset') {
      const p = endpoints(r, select);
      if (p)
        interval(
          p[0],
          p[1],
          r.value - r.tolerance,
          r.value + r.tolerance,
          r.id,
        );
    } else if (r.kind === 'measure' && r.relativeTolerance === 0) {
      const id = one(r.selector, select);
      if (!id || r.aggregation === 'range') continue;
      const axis = ['x', 'width'].includes(r.metric)
        ? 'x'
        : ['z', 'depth'].includes(r.metric)
          ? 'z'
          : 'y';
      const lo = r.comparison === 'at_most' ? -Infinity : r.value - r.tolerance;
      const hi = r.comparison === 'at_least' ? Infinity : r.value + r.tolerance;
      if (['x', 'y', 'z', 'base', 'top'].includes(r.metric)) {
        const datum =
          r.metric === 'top'
            ? 'max'
            : ['y', 'base'].includes(r.metric)
              ? 'min'
              : 'center';
        interval(origin, anchor(id, axis, datum), lo, hi, r.id);
      } else if (['width', 'height', 'depth'].includes(r.metric)) {
        interval(
          anchor(id, axis, 'min'),
          anchor(id, axis, 'max'),
          lo,
          hi,
          r.id,
        );
        interval(
          anchor(id, axis, 'min'),
          anchor(id, axis, 'center'),
          lo / 2,
          hi / 2,
          r.id,
        );
        interval(
          anchor(id, axis, 'center'),
          anchor(id, axis, 'max'),
          lo / 2,
          hi / 2,
          r.id,
        );
      }
    } else if (r.kind === 'positions' && r.points.length === 1) {
      const id = one(r.selector, select);
      if (id)
        for (const axis of ['x', 'y', 'z'] as const)
          interval(
            origin,
            anchor(id, axis, axis === 'y' ? 'min' : 'center'),
            r.points[0][axis] - r.tolerance,
            r.points[0][axis] + r.tolerance,
            r.id,
          );
    }
  }
  return edges;
}

function shortest(edges: Edge[], start: string, end: string) {
  const nodes = new Set(edges.flatMap((e) => [e.from, e.to]));
  const distances = new Map<string, number>([[start, 0]]);
  const paths = new Map<string, string[]>([[start, []]]);
  // At most 32 checks; this remains bounded even for very large scenes.
  for (let i = 0; i < nodes.size; i++) {
    let changed = false;
    for (const e of edges) {
      const next = (distances.get(e.from) ?? Infinity) + e.bound;
      if (next < (distances.get(e.to) ?? Infinity) - 1e-8) {
        if (i === nodes.size - 1) return undefined; // inconsistent supporting constraints
        distances.set(e.to, next);
        paths.set(e.to, [...new Set([...(paths.get(e.from) ?? []), e.check])]);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return {
    value: distances.get(end) ?? Infinity,
    checks: paths.get(end) ?? [],
  };
}

export function impliedOffset(
  criteria: CompletionCriteria,
  r: Offset,
  select: Select,
) {
  const p = endpoints(r, select);
  if (!p) return undefined;
  const edges = constraints(criteria, select).filter((e) => e.check !== r.id);
  const offsetIds = new Set(
    criteria.checks
      .filter((c) => c.requirement.kind === 'offset')
      .map((c) => c.requirement.id),
  );
  // Independent absolute measurements take precedence as evidence. Other
  // contradictory relative checks must not hide a sign error between datums.
  for (const support of [edges.filter((e) => !offsetIds.has(e.check)), edges]) {
    const high = shortest(support, p[0], p[1]),
      low = shortest(support, p[1], p[0]);
    if (
      high &&
      low &&
      (Number.isFinite(high.value) || Number.isFinite(low.value))
    )
      return {
        min: -low.value,
        max: high.value,
        related: [...new Set([...low.checks, ...high.checks])],
      };
  }
  return undefined;
}

export function auditCriteria(
  criteria: CompletionCriteria,
  select: Select,
): CriterionIssue[] {
  const issues: CriterionIssue[] = [];
  const offsetIds = new Set(
    criteria.checks
      .filter((c) => c.requirement.kind === 'offset')
      .map((c) => c.requirement.id),
  );
  const absoluteEdges = constraints(criteria, select).filter(
    (e) => !offsetIds.has(e.check),
  );
  for (const { requirement: r } of criteria.checks) {
    const add = (
      code: CriterionIssue['code'],
      detail: string,
      related: string[] = [],
    ) =>
      issues.push({
        checkId: r.id,
        code,
        detail: detail.slice(0, 1000),
        related,
      });
    if (r.kind === 'property') {
      if (
        r.property === 'material' &&
        !renderMaterials.includes(r.value as any)
      )
        add(
          'unsupported_property',
          `material stores only rendering categories (${renderMaterials.join(', ')}), not ${JSON.stringify(r.value)}. A materialSpec designation can be explicitly assigned and checked as metadata; color/name do not certify substance or physical performance.`,
        );
      else if (
        r.property === 'materialSpec' &&
        r.value !== null &&
        (typeof r.value !== 'string' || !r.value.trim())
      )
        add(
          'invalid_contract',
          'A material designation must be a nonempty string or null.',
        );
      else if (r.property === 'visible' && typeof r.value !== 'boolean')
        add('invalid_contract', 'Visibility requires a boolean.');
      else if (
        r.property === 'role' &&
        !componentRoles.includes(r.value as any)
      )
        add(
          'unsupported_property',
          'The requested role is not representable by the component role field.',
        );
      else if (
        r.property === 'color' &&
        (typeof r.value !== 'string' || !/^#[0-9a-f]{6}$/i.test(r.value))
      )
        add(
          'invalid_contract',
          'Color comparison requires a six-digit hexadecimal value.',
        );
    } else if (r.kind === 'offset') {
      const implied = impliedOffset(criteria, r, select);
      if (
        implied &&
        (r.value + r.tolerance < implied.min - 1e-8 ||
          r.value - r.tolerance > implied.max + 1e-8)
      )
        add(
          'contradiction',
          `The requested check says second.${r.secondAnchor} minus first.${r.firstAnchor} on world ${r.axis} = ${r.value} ± ${r.tolerance} m, but independent criteria ${implied.related.join(', ')} imply [${implied.min}, ${implied.max}] m for those same identities and datums. These criteria cannot all hold. Do not move geometry to repair a contradictory check.`,
          implied.related,
        );
    } else if (r.kind === 'measure') {
      if (
        r.metric === 'count' &&
        (!Number.isInteger(r.value) ||
          r.value < 0 ||
          r.tolerance !== 0 ||
          r.relativeTolerance !== 0)
      )
        add(
          'invalid_contract',
          'Counts must be nonnegative integers with zero tolerance.',
        );
      else if (r.metric !== 'volume' && r.relativeTolerance !== 0)
        add(
          'invalid_contract',
          'Relative tolerance is supported only for tessellated volume.',
        );
      else {
        const other = absoluteEdges.filter((e) => e.check !== r.id);
        for (const e of absoluteEdges.filter((e) => e.check === r.id)) {
          const reverse = shortest(other, e.to, e.from);
          if (reverse && e.bound + reverse.value < -1e-8) {
            add(
              'contradiction',
              `Independent absolute-datum/dimension criteria ${r.id}, ${reverse.checks.join(', ')} impose incompatible intervals on the same world anchors. Neither geometry nor request intent can satisfy all of these compiled checks.`,
              reverse.checks,
            );
            break;
          }
        }
      }
    }
  }
  return issues;
}

/** A separate reader may correct only proven-invalid checks, once. It cannot
 * expand edit scope, remove requirements, raise tolerances or pardon a valid
 * measured failure. Offset changes require independent mathematical support. */
export function acceptCriteriaRevision(
  previous: CompletionCriteria,
  next: CompletionCriteria,
  issues: CriterionIssue[],
  select: Select,
): CompletionCriteria {
  const allowed = new Set(issues.map((i) => i.checkId));
  if (
    !equalData({ ...previous, checks: [] }, { ...next, checks: [] }) ||
    previous.checks.length !== next.checks.length
  )
    throw new Error(
      'Criterion correction changed requirements or authorized edit scope.',
    );
  for (let i = 0; i < previous.checks.length; i++) {
    const old = previous.checks[i],
      fresh = next.checks[i];
    if (equalData(old, fresh)) continue;
    const a = old.requirement,
      b = fresh.requirement;
    if (
      !allowed.has(a.id) ||
      a.id !== b.id ||
      old.source !== fresh.source ||
      old.evidence !== fresh.evidence
    )
      throw new Error(
        'Criterion correction changed an independently valid requirement or its evidence.',
      );
    if (!equalData(old.calculation, fresh.calculation)) {
      if (
        issues.some(
          (issue) =>
            issue.checkId === a.id && issue.code === 'invalid_calculation',
        ) &&
        old.calculation &&
        fresh.calculation &&
        equalData(a, b) &&
        equivalentCalculation(old.calculation, fresh.calculation)
      )
        continue;
      throw Error(
        'Calculation correction must preserve the original expression, sources, units and predicate.',
      );
    }
    if (
      a.kind === 'property' &&
      b.kind === 'property' &&
      a.property === 'material' &&
      b.property === 'materialSpec' &&
      typeof a.value === 'string' &&
      equalData({ ...a, property: 'materialSpec', label: b.label }, b)
    )
      continue;
    if (
      a.kind === 'offset' &&
      b.kind === 'offset' &&
      a.axis === b.axis &&
      a.tolerance === b.tolerance
    ) {
      const oldIds = [one(a.first, select), one(a.second, select)].sort(),
        newIds = [one(b.first, select), one(b.second, select)].sort();
      const support = impliedOffset(previous, b, select);
      if (
        equalData(oldIds, newIds) &&
        support &&
        b.value >= support.min - 1e-8 &&
        b.value <= support.max + 1e-8
      )
        continue;
    }
    throw new Error(
      'Criterion correction is not supported by the original requirements; it remains unverified.',
    );
  }
  return next;
}
