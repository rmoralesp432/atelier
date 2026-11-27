import { isVisible, type Volume } from '../model';
import { equalData } from '../projects/equalData';
import { solidStats } from '../geometry/kernel';
import { isFlat } from '../geometry/spatial';
import { assessRequirements, preservedValue } from './designBrief';
import { completionSelection } from './completionSelection';
import { preservedOffsets } from './preservedOffsets';
import { auditCriteria } from './criteriaAudit';
import { compileCalculations } from './completionCalculations';
import { resolveIds, type Session } from './engine';
import { physicalChecks, flatPhysicalBounds } from './completionGeometry';
import {
  completionCriteriaSchema,
  type CompletionCriteria,
  type CompletionReport,
} from './completionSchema';

/** Criteria are task-local and supplied by a separate request reader, never by
 * the executing agent. Evaluate every completion attempt against fresh solids. */
export async function verifyCompletion(
  raw: CompletionCriteria,
  original: Session,
  candidate: Session,
  signal?: AbortSignal,
): Promise<CompletionReport> {
  const {
    criteria,
    traces,
    issues: calculationIssues,
  } = await compileCalculations(
    completionCriteriaSchema.parse(raw),
    original,
    signal,
  );
  // Share expensive solid-volume measurements within this immutable candidate;
  // every repair/completion attempt gets a fresh cache.
  const volumes = new Map<string, Promise<number>>();
  const physical = physicalChecks();
  const offsets = preservedOffsets();
  const select = completionSelection(original, candidate);
  // Exclude malformed expressions from semantic audits: their literal numeric
  // placeholders are not independent desired measurements.
  const criterionIssues = [
    ...calculationIssues,
    ...auditCriteria(
      {
        ...criteria,
        checks: criteria.checks.filter(
          (c) => !calculationIssues.some((i) => i.checkId === c.requirement.id),
        ),
      },
      select,
    ),
  ];
  const before = new Map(original.project.volumes.map((v) => [v.id, v]));
  const after = new Map(candidate.project.volumes.map((v) => [v.id, v]));
  const report: CompletionReport = {
    modeling: criteria.modeling,
    passed: false,
    status: 'unverified',
    canCommit: false,
    ...(criterionIssues.length ? { criterionIssues } : {}),
    checks: [],
    qualitativeLimits: criteria.qualitativeLimits,
  };
  let currentCriterionId: string | undefined;
  const add = (
    id: string,
    label: string,
    met: boolean,
    observed: string,
    ids: string[] = [],
    unavailable = false,
  ) => {
    // Reviewer criteria cannot relabel host-owned authorization/preservation
    // checks, even if a saved/custom provider reused a reserved check ID.
    const issue =
      currentCriterionId === id
        ? criterionIssues.find((i) => i.checkId === id)
        : undefined;
    report.checks.push({
      id,
      label,
      met: issue ? false : met,
      outcome:
        unavailable || issue ? 'unverified' : met ? 'verified' : 'incorrect',
      observed: (issue
        ? `Invalid verification criterion: ${issue.detail}${observed && observed !== issue.detail ? ` Observation (not a verdict): ${observed}` : ''}`
        : observed
      ).slice(0, 800),
      ids: ids.slice(0, 16),
      ...(traces.has(id) && currentCriterionId === id
        ? { calculation: traces.get(id) }
        : {}),
    });
  };
  const abort = () => {
    if (signal?.aborted)
      throw new Error('Stopped. No changes were applied to your project.');
  };
  const unchanged = (v: Volume, next: Volume | undefined) =>
    !!next &&
    equalData(v, next) &&
    isVisible(v, original.project) === isVisible(next, candidate.project);
  const changed = original.project.volumes.filter(
    (v) => !unchanged(v, after.get(v.id)),
  );
  if (
    !criteria.modeling &&
    (changed.length || candidate.project.volumes.some((v) => !before.has(v.id)))
  )
    add(
      'coverage',
      'Modeling request coverage',
      false,
      'Geometry changed but the independent review supplied no modeling requirements. Completion is unverified.',
      [],
      true,
    );
  if (criteria.modeling && !criteria.checks.length)
    add(
      'coverage',
      'Modeling request coverage',
      false,
      'No measurable requirement was supplied. Successful tools alone cannot verify completion.',
      [],
      true,
    );
  if (
    new Set(criteria.checks.map((c) => c.requirement.id)).size !==
    criteria.checks.length
  )
    throw new Error(
      'Independent checks must have distinct IDs. Your project is unchanged.',
    );

  // Scope comes from the user's request, not from whatever the agent touched.
  let scopeKnown = criteria.scopeKnown !== false;
  const editable = new Set<string>();
  try {
    if (criteria.editable.length)
      resolveIds(
        criteria.editable.map((ref) =>
          original.project.groups?.some((g) => g.id === ref)
            ? `$group:${ref}`
            : ref,
        ),
        original,
      ).forEach((id) => editable.add(id));
  } catch {
    scopeKnown = false;
    add(
      'edit-scope',
      'Permitted edit scope',
      false,
      'The independent review could not resolve the original objects authorized to change. This is uncertain authorization, not evidence of incorrect geometry.',
      [],
      true,
    );
  }
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const v of original.project.volumes)
      if (
        v.component?.hostId &&
        editable.has(v.component.hostId) &&
        !editable.has(v.id)
      ) {
        editable.add(v.id);
        expanded = true;
      }
  }
  const collateral = changed.filter((v) => !editable.has(v.id));
  const changedGroups = (original.project.groups ?? []).filter(
    (g) =>
      !equalData(
        g,
        candidate.project.groups?.find((next) => next.id === g.id),
      ),
  );
  const collateralGroups = changedGroups.filter((g) => {
    const explicit = criteria.editable.some((ref) =>
      [g.id, `$group:${g.id}`, `$group:${g.name}`].includes(ref),
    );
    const members = original.project.volumes.filter((v) => v.groupId === g.id);
    return (
      !explicit &&
      !(members.length > 0 && members.every((v) => editable.has(v.id)))
    );
  });
  const placement = (v: Volume | undefined, scene: Session) =>
    v
      ? `position(${v.position.x},${v.position.y},${v.position.z}), size(${v.dimensions.width},${v.dimensions.depth},${v.dimensions.height}), rotation ${v.rotation}, visible ${isVisible(v, scene.project)}`
      : 'missing';
  add(
    'preserved-scope',
    'Unrelated existing geometry',
    !collateral.length && !collateralGroups.length,
    !scopeKnown && (collateral.length || collateralGroups.length)
      ? 'Existing objects or groups changed, but the independent review could not determine the permitted edit scope. Keep the original project until that scope can be established.'
      : collateralGroups.length
        ? `Unrelated groups changed: ${collateralGroups
            .map((g) => {
              const next = candidate.project.groups?.find((n) => n.id === g.id);
              return `${g.name}: expected visible ${g.visible}, locked ${g.locked}; observed ${next ? `visible ${next.visible}, locked ${next.locked}, name ${next.name}` : 'removed'}`;
            })
            .join('; ')}. Restore their original properties.`
        : collateral.length
          ? `Restore unauthorized edits: ${collateral
              .slice(0, 4)
              .map(
                (v) =>
                  `${v.name} (${v.id}): expected ${placement(v, original)}; observed ${placement(after.get(v.id), candidate)}`,
              )
              .join('; ')}. Preserve original identities and geometry.`
          : `${before.size - editable.size} existing objects outside the requested edit scope are unchanged.`,
    collateral.map((v) => v.id),
    !scopeKnown && (collateral.length > 0 || collateralGroups.length > 0),
  );

  for (const { requirement: r } of criteria.checks) {
    currentCriterionId = r.id;
    abort();
    let ids: string[] = [];
    try {
      const invalid = criterionIssues.find((i) => i.checkId === r.id);
      if (invalid) {
        add(r.id, r.label, false, invalid.detail, [], true);
        continue;
      }
      if (r.kind === 'unavailable') {
        add(r.id, r.label, false, `Unverified: ${r.reason}`, [], true);
        continue;
      }
      if (r.kind === 'preserve') {
        const originals = select(r.selector, true);
        ids = originals.map((v) => v.id);
        if (!originals.length)
          throw new Error(
            'No original objects match this preservation requirement.',
          );
        const violations = originals.flatMap((v) => {
          const next = after.get(v.id);
          if (!next) return [`${v.name} (${v.id}) was removed/replaced`];
          const fields = r.properties.filter((p) =>
            p === 'identity'
              ? false
              : p === 'all'
                ? !unchanged(v, next)
                : p === 'visible'
                  ? isVisible(v, original.project) !==
                    isVisible(next, candidate.project)
                  : !equalData(preservedValue(v, p), preservedValue(next, p)),
          );
          return fields.length
            ? [`${v.name} (${v.id}): ${fields.join(', ')}`]
            : [];
        });
        add(
          r.id,
          r.label,
          !violations.length,
          violations.length
            ? `Preserved properties changed: ${violations.slice(0, 8).join('; ')}.`
            : `${originals.length} original identities retain ${r.properties.join(', ')}.`,
          ids,
        );
      } else if (r.kind === 'preserve_offsets') {
        const result = await offsets(
          r,
          select(r.first, true),
          select(r.second, true),
          after,
          abort,
        );
        ids = result.ids;
        add(r.id, r.label, result.met, result.observed, ids);
        report.checks[report.checks.length - 1].offsets = result.trace;
      } else if (r.kind === 'offset') {
        const a = select(r.first),
          b = select(r.second);
        ids = [...a, ...b].map((v) => v.id);
        if (a.length !== 1 || b.length !== 1 || a[0].id === b[0].id)
          throw new Error(
            'Offset checks need two distinct individual objects.',
          );
        const anchor = async (v: Volume, point: 'min' | 'center' | 'max') => {
          const axis = { x: 0, y: 1, z: 2 }[r.axis];
          const bounds = isFlat(v)
            ? flatPhysicalBounds(v)
            : (await solidStats(v)).bounds;
          const coord = (edge: 'min' | 'max') =>
            Array.isArray(bounds[edge])
              ? (bounds[edge] as number[])[axis]
              : (bounds[edge] as any)[r.axis];
          return point === 'center'
            ? (coord('min') + coord('max')) / 2
            : coord(point);
        };
        const value =
          (await anchor(b[0], r.secondAnchor)) -
          (await anchor(a[0], r.firstAnchor));
        add(
          r.id,
          r.label,
          Number.isFinite(value) &&
            Math.abs(value - r.value) <= r.tolerance + 1e-8,
          `Measured world-bounds ${r.axis} offset (${r.secondAnchor} of ${b[0].id} minus ${r.firstAnchor} of ${a[0].id}): ${value} m; expected ${r.value} ± ${r.tolerance} m. This is an axis/bounds check, not proof of surface connectivity.`,
          ids,
        );
      } else {
        ids = (
          r.kind === 'relation' || r.kind === 'relationship'
            ? [...select(r.first), ...select(r.second)]
            : select(r.selector)
        ).map((v) => v.id);
        if (
          r.kind === 'measure' &&
          r.metric === 'count' &&
          (!Number.isInteger(r.value) ||
            r.tolerance !== 0 ||
            r.relativeTolerance !== 0)
        )
          throw new Error(
            'Object counts require an integer and zero tolerance.',
          );
        if (
          r.kind === 'measure' &&
          r.metric !== 'volume' &&
          r.relativeTolerance !== 0
        )
          throw new Error(
            'Relative tolerance is only meaningful for tessellated solid volume.',
          );
        const measured = await physical(r, (s) => select(s), candidate);
        if (measured) {
          add(
            r.id,
            r.label,
            measured.met,
            measured.observed,
            ids,
            measured.unavailable,
          );
          continue;
        }
        // The remaining predicates belong to the legacy general measurement
        // library; errors are unknown evidence, not proof of bad geometry.
        let unavailable = false;
        const [result] = await assessRequirements(
          [r as Parameters<typeof assessRequirements>[0][number]],
          candidate,
          (s) => select(s),
          volumes,
          () => {
            unavailable = true;
          },
        );
        add(
          result.id,
          result.label,
          result.met,
          result.observed,
          ids,
          unavailable || (r.kind === 'shape' && !result.met),
        );
      }
    } catch (error) {
      abort();
      add(
        r.id,
        r.label,
        false,
        error instanceof Error
          ? error.message
          : 'The geometry check could not be evaluated.',
        ids,
        true,
      );
    }
  }
  abort();
  report.status = report.checks.some((c) => c.outcome === 'incorrect')
    ? 'incorrect'
    : report.checks.some((c) => c.outcome === 'unverified') ||
        criteria.qualitativeLimits.length > 0
      ? 'unverified'
      : 'verified';
  report.passed = report.status === 'verified';
  // Unknown design qualities do not veto safe, undoable work. An unknown
  // authorization scope must never permit changes to existing objects.
  const unresolvedRequired = report.checks.some((check) => {
    if (check.outcome !== 'unverified') return false;
    const r = raw.checks.find(
      (c) => c.requirement.id === check.id,
    )?.requirement;
    return (
      criterionIssues.some(
        (i) => i.checkId === check.id && i.code !== 'unsupported_property',
      ) ||
      (r &&
        ([
          'positions',
          'offset',
          'preserve_offsets',
          'radial',
          'layout',
          'relation',
          'relationship',
          'group',
          'editable',
        ].includes(r.kind) ||
          (r.kind === 'measure' &&
            ['x', 'y', 'z', 'base', 'top'].includes(r.metric)) ||
          (r.kind === 'unavailable' && r.required === true)))
    );
  });
  report.canCommit =
    !unresolvedRequired &&
    report.status !== 'incorrect' &&
    !(!scopeKnown && (changed.length > 0 || changedGroups.length > 0));
  return report;
}

export function completionFeedback(report: CompletionReport) {
  return `Measured geometry checks failed. Repair only checks marked incorrect; unverified checks are observation limitations, not instructions to alter geometry. Repair the existing provisional model; do not recreate successful parts or weaken the requirements. ${report.checks
    .filter((c) => c.outcome === 'incorrect')
    .map(
      (c) => `${c.id} (${c.label}): ${c.observed} Targets: ${c.ids.join(', ')}`,
    )
    .join(' ')}`.slice(0, 2000);
}
export function completionSummary(report: CompletionReport) {
  const limits = report.qualitativeLimits.length
    ? [
        `Qualitative goals remain unverified: ${report.qualitativeLimits.join('; ').slice(0, 650)}.`,
      ]
    : [];
  return [
    report.status === 'verified'
      ? 'Completed; measurable checks passed.'
      : 'Changes applied with incomplete verification. I cannot yet confirm every requirement.',
    ...report.checks
      .filter((c) => c.outcome === 'unverified')
      .map((c) => `${c.label}: ${c.observed}`),
    ...limits,
    ...report.checks
      .filter((c) => c.outcome === 'verified')
      .slice(0, 6)
      .map((c) => `${c.label}: ${c.observed}`.slice(0, 210)),
  ]
    .join('\n')
    .slice(0, 2000);
}

export function unavailableCompletionCriteria(
  reason: string,
  request: string,
): CompletionCriteria {
  return {
    modeling: true,
    scopeKnown: false,
    editable: [],
    qualitativeLimits: [],
    checks: [
      {
        source: 'request',
        evidence: request.slice(0, 400),
        requirement: {
          kind: 'unavailable',
          id: 'review-unavailable',
          label: 'Independent review',
          required: true,
          reason: reason.slice(0, 400),
        },
      },
    ],
  };
}
