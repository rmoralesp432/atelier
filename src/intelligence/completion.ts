import { isVisible, type Volume } from '../model';
import { equalData } from '../projects/equalData';
import { solidStats } from '../geometry/kernel';
import { isFlat, envelopeBounds } from '../geometry/spatial';
import { assessRequirements, preservedValue } from './designBrief';
import type { DesignSelector } from './designBriefSchema';
import { resolveIds, type Session } from './engine';
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
  const criteria = completionCriteriaSchema.parse(raw);
  // Share expensive solid-volume measurements within this immutable candidate;
  // every repair/completion attempt gets a fresh cache.
  const volumes = new Map<string, Promise<number>>();
  const before = new Map(original.project.volumes.map((v) => [v.id, v]));
  const after = new Map(candidate.project.volumes.map((v) => [v.id, v]));
  const report: CompletionReport = {
    modeling: criteria.modeling,
    passed: false,
    checks: [],
    qualitativeLimits: criteria.qualitativeLimits,
  };
  const add = (
    id: string,
    label: string,
    met: boolean,
    observed: string,
    ids: string[] = [],
  ) =>
    report.checks.push({
      id,
      label,
      met,
      observed: observed.slice(0, 800),
      ids: ids.slice(0, 16),
    });
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
    );
  if (criteria.modeling && !criteria.checks.length)
    add(
      'coverage',
      'Modeling request coverage',
      false,
      'No measurable requirement was supplied. Successful tools alone cannot verify completion.',
    );
  if (
    new Set(criteria.checks.map((c) => c.requirement.id)).size !==
    criteria.checks.length
  )
    throw new Error(
      'Independent checks must have distinct IDs. Your project is unchanged.',
    );

  const matches = (v: Volume, s: DesignSelector) =>
    (s.role === null || v.component?.role === s.role) &&
    (s.level === null || v.component?.level === s.level) &&
    (s.nameContains === null ||
      v.name.toLowerCase().includes(s.nameContains.toLowerCase()));
  // Original selectors match the original roster: renaming/removing an object
  // cannot make a preservation rule disappear. $new covers ALL provisional
  // creations in this turn, not just the most recent execute_step.
  const select = (s: DesignSelector, initial = false): Volume[] => {
    const source = initial ? original : candidate;
    const ids = new Set<string>();
    const originalMatches = new Set<string>();
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
        resolveIds([ref], bound).forEach((id) => ids.add(id));
      }
    }
    return source.project.volumes.filter(
      (v) => ids.has(v.id) && (originalMatches.has(v.id) || matches(v, s)),
    );
  };
  // Scope comes from the user's request, not from whatever the agent touched.
  const editable = new Set(
    criteria.editable.length ? resolveIds(criteria.editable, original) : [],
  );
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
  const placement = (v: Volume | undefined, scene: Session) =>
    v
      ? `position(${v.position.x},${v.position.y},${v.position.z}), size(${v.dimensions.width},${v.dimensions.depth},${v.dimensions.height}), rotation ${v.rotation}, visible ${isVisible(v, scene.project)}`
      : 'missing';
  add(
    'preserved-scope',
    'Unrelated existing geometry',
    !collateral.length,
    collateral.length
      ? `Restore unauthorized edits: ${collateral
          .slice(0, 4)
          .map(
            (v) =>
              `${v.name} (${v.id}): expected ${placement(v, original)}; observed ${placement(after.get(v.id), candidate)}`,
          )
          .join('; ')}. Preserve original identities and geometry.`
      : `${before.size - editable.size} existing objects outside the requested edit scope are unchanged.`,
    collateral.map((v) => v.id),
  );

  for (const { requirement: r } of criteria.checks) {
    abort();
    let ids: string[] = [];
    try {
      if (r.kind === 'unavailable') {
        add(r.id, r.label, false, `Unverified: ${r.reason}`);
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
            ? envelopeBounds(v)
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
          r.kind === 'relation'
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
        const [result] = await assessRequirements(
          [r],
          candidate,
          (s) => select(s),
          volumes,
        );
        add(result.id, result.label, result.met, result.observed, ids);
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
      );
    }
  }
  abort();
  report.passed = report.checks.every((c) => c.met);
  return report;
}

export function completionFeedback(report: CompletionReport) {
  return `Independent completion checks failed. Tools ran, but the request is not complete. Repair the existing provisional model; do not recreate successful parts or weaken the requirements. ${report.checks
    .filter((c) => !c.met)
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
    'Completed; measurable checks passed.',
    ...limits,
    ...report.checks
      .slice(0, 6)
      .map((c) => `${c.label}: ${c.observed}`.slice(0, 210)),
  ]
    .join('\n')
    .slice(0, 2000);
}
