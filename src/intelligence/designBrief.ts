import { semanticShape } from './geometryFacts';
import type {
  DesignBrief,
  DesignSelector,
  BriefAssessment,
} from './designBriefSchema';
import { resolveIds, type Session } from './engine';
import { equalData } from '../projects/equalData';
import { isFlat, groupBounds } from '../geometry/spatial';
import { solidStats, sharedVolume } from '../geometry/kernel';
import { round, isVisible, type Volume } from '../model';

const transient = new Set(['$selected', '$focus', '$created', '$operands']);
/** Bind pronouns to the original user context, never a later model selection. */
export function bindBrief(raw: DesignBrief, original: Session): DesignBrief {
  const brief = structuredClone(raw);
  if (
    new Set(brief.requirements.map((r) => r.id)).size !==
    brief.requirements.length
  )
    throw new Error('Design requirements need distinct IDs.');
  brief.editable = brief.editable.length
    ? resolveIds(brief.editable, original)
    : [];
  // Moving a host may carry its children. Still honor explicit preserved sizes.
  const editable = new Set(brief.editable);
  let changed = true;
  while (changed) {
    changed = false;
    for (const v of original.project.volumes)
      if (
        v.component?.hostId &&
        editable.has(v.component.hostId) &&
        !editable.has(v.id)
      ) {
        editable.add(v.id);
        changed = true;
      }
  }
  brief.editable = [...editable];
  brief.preserve.forEach((p) => {
    p.targets = resolveIds(p.targets, original);
  });
  const bind = (s: DesignSelector) => {
    s.refs = s.refs.flatMap((ref) =>
      transient.has(ref) ? resolveIds([ref], original) : [ref],
    );
  };
  brief.requirements.forEach((r) => {
    if (
      r.kind === 'property' &&
      r.property === 'hostId' &&
      typeof r.value === 'string' &&
      transient.has(r.value)
    ) {
      const ids = resolveIds([r.value], original);
      if (ids.length !== 1)
        throw new Error(
          'A preserved host reference must identify one element.',
        );
      r.value = ids[0];
    }
    if (
      r.kind === 'property' &&
      ((r.property === 'visible' && typeof r.value !== 'boolean') ||
        (r.property !== 'visible' && typeof r.value === 'boolean'))
    )
      throw new Error(
        'Use a boolean for visibility and a string or null for the other property checks.',
      );
    if (
      r.kind === 'layout' &&
      (r.counts.x * r.counts.y * r.counts.z > 200 ||
        (['x', 'y', 'z'] as const).some(
          (a) => r.counts[a] > 1 && Math.abs(r.step[a]) <= r.tolerance * 2,
        ))
    )
      throw new Error(
        'Layout checks need at most 200 distinct expected positions, spaced farther apart than twice the tolerance.',
      );
    if (
      r.kind === 'measure' &&
      r.metric !== 'volume' &&
      r.relativeTolerance !== 0
    )
      throw new Error(
        'Relative tolerance is only available for tessellated solid-volume checks; use absolute precision for dimensions and counts.',
      );
    if (r.kind === 'relation') {
      bind(r.first);
      bind(r.second);
    } else bind(r.selector);
    if (
      r.kind === 'measure' &&
      r.aggregation === 'envelope' &&
      ['volume', 'count'].includes(r.metric)
    )
      throw new Error(
        'Envelope checks measure bounds, not solid volume or count.',
      );
  });
  return brief;
}

export function checkEditScope(
  brief: DesignBrief,
  original: Session,
  candidate: Session,
) {
  const after = new Map(candidate.project.volumes.map((v) => [v.id, v]));
  const editable = new Set(brief.editable);
  const unrelated = original.project.volumes.filter(
    (v) => !editable.has(v.id) && !equalData(v, after.get(v.id)),
  );
  if (unrelated.length)
    throw new Error(
      `Outside the agreed edit scope: ${unrelated
        .slice(0, 8)
        .map((v) => `${v.name} (${v.id})`)
        .join(
          ', ',
        )}. Keep these objects unchanged; do not widen the brief to justify this edit.`,
    );
  for (const rule of brief.preserve)
    for (const id of rule.targets) {
      const before = original.project.volumes.find((v) => v.id === id)!,
        next = after.get(id);
      if (!next) throw new Error(`Preserved element removed: ${before.name}.`);
      const changed = rule.properties.filter(
        (p) => !equalData(before[p], next[p]),
      );
      if (changed.length)
        throw new Error(
          `Preserved properties changed on ${before.name}: ${changed.join(', ')}. Correct the edit without weakening the design brief.`,
        );
    }
}

function select(s: DesignSelector, session: Session): Volume[] {
  // Empty scenes and not-yet-created named groups are an unmet requirement,
  // never a reason to broaden the selection to unrelated objects.
  const ids = s.refs.length ? new Set(resolveIds(s.refs, session)) : null;
  return session.project.volumes.filter(
    (v) =>
      (!ids || ids.has(v.id)) &&
      (s.role === null || v.component?.role === s.role) &&
      (s.level === null || v.component?.level === s.level) &&
      (s.nameContains === null ||
        v.name
          .toLocaleLowerCase()
          .includes(s.nameContains.toLocaleLowerCase())),
  );
}

/** The model declares desired outcomes; only the geometry engine marks them met. */
export async function assessBrief(
  brief: DesignBrief,
  session: Session,
): Promise<BriefAssessment[]> {
  const volumes = new Map<string, Promise<number>>();
  const volume = (v: Volume) => {
    if (isFlat(v)) return Promise.resolve(0);
    if (!volumes.has(v.id))
      volumes.set(
        v.id,
        solidStats(v).then((s) => s.volume),
      );
    return volumes.get(v.id)!;
  };
  const result: BriefAssessment[] = [];
  for (const r of brief.requirements) {
    let met = false,
      observed = '';
    try {
      if (r.kind === 'relation') {
        const a = select(r.first, session),
          b = select(r.second, session);
        if (a.length !== 1 || b.length !== 1 || a[0].id === b[0].id)
          throw new Error(
            'Relationship requirements must identify two distinct individual solids.',
          );
        const shared = await sharedVolume(a[0], b[0]);
        met =
          r.relation === 'disjoint'
            ? shared <= r.tolerance
            : r.relation === 'intersects'
              ? shared > r.tolerance
              : Math.abs((await volume(a[0])) - shared) <= r.tolerance;
        observed = `Shared volume ${round(shared)} m³; expected ${r.relation}.`;
      } else {
        const vs = select(r.selector, session);
        if (r.kind === 'property') {
          let expected = r.value;
          if (
            r.property === 'hostId' &&
            typeof expected === 'string' &&
            expected.startsWith('$')
          ) {
            const ids = resolveIds([expected], session);
            if (ids.length !== 1)
              throw new Error('The expected host must identify one element.');
            expected = ids[0];
          }
          const values = vs.map((v) =>
            r.property === 'role'
              ? (v.component?.role ?? 'element')
              : r.property === 'level'
                ? (v.component?.level ?? null)
                : r.property === 'hostId'
                  ? (v.component?.hostId ?? null)
                  : r.property === 'material'
                    ? (v.material ?? 'solid')
                    : r.property === 'visible'
                      ? isVisible(v, session.project)
                      : (v.color ?? '#e2e7e6'),
          );
          const normalized = (v: unknown) =>
            r.property === 'color' && typeof v === 'string'
              ? v.toLowerCase()
              : v;
          met =
            vs.length > 0 &&
            values.every((v) => normalized(v) === normalized(expected));
          observed = `${r.property}: ${[...new Set(values)].map((v) => String(v)).join(', ') || 'no matches'}; expected ${String(expected)}. ${vs.length} element(s).`;
        } else if (r.kind === 'layout') {
          const expected = r.counts.x * r.counts.y * r.counts.z,
            remaining = new Set(vs.map((v) => v.id));
          if (expected > 200)
            throw new Error('The expected layout exceeds 200 positions.');
          let matched = 0;
          const a = (r.rotation * Math.PI) / 180;
          for (let y = 0; y < r.counts.y; y++)
            for (let z = 0; z < r.counts.z; z++)
              for (let x = 0; x < r.counts.x; x++) {
                const px =
                    r.origin.x +
                    x * r.step.x * Math.cos(a) +
                    z * r.step.z * Math.sin(a),
                  py = r.origin.y + y * r.step.y,
                  pz =
                    r.origin.z -
                    x * r.step.x * Math.sin(a) +
                    z * r.step.z * Math.cos(a);
                const found = vs.find(
                  (v) =>
                    remaining.has(v.id) &&
                    Math.hypot(
                      v.position.x - px,
                      v.position.y - py,
                      v.position.z - pz,
                    ) <=
                      r.tolerance + 1e-8,
                );
                if (found) {
                  remaining.delete(found.id);
                  matched++;
                }
              }
          met = matched === expected && vs.length === expected;
          observed = `${matched}/${expected} required base-center positions occupied; ${vs.length} selected element(s), ${remaining.size} unmatched. Expected spacing (${r.step.x}, ${r.step.y}, ${r.step.z}) m at ${r.rotation}°.`;
        } else if (r.kind === 'shape') {
          met = vs.length > 0 && vs.every((v) => semanticShape(v) === r.shape);
          observed = `${vs.length} matching element(s); shapes: ${[...new Set(vs.map(semanticShape))].join(', ') || 'none'}; expected ${r.shape}.`;
        } else {
          if (!vs.length && r.metric !== 'count')
            throw new Error('No matching elements exist for this requirement.');
          let values: number[];
          if (r.metric === 'count') values = [vs.length];
          else if (r.aggregation === 'envelope') {
            const b = groupBounds(vs);
            values = [
              r.metric === 'base'
                ? b.min.y
                : r.metric === 'top'
                  ? b.max.y
                  : r.metric === 'width'
                    ? b.max.x - b.min.x
                    : r.metric === 'depth'
                      ? b.max.z - b.min.z
                      : b.max.y - b.min.y,
            ];
          } else {
            const metric = r.metric;
            values = await Promise.all(
              vs.map(async (v) =>
                metric === 'volume'
                  ? volume(v)
                  : metric === 'base'
                    ? v.position.y
                    : metric === 'top'
                      ? v.position.y + (isFlat(v) ? 0 : v.dimensions.height)
                      : metric === 'height' && isFlat(v)
                        ? 0
                        : v.dimensions[metric],
              ),
            );
            if (r.aggregation === 'sum')
              values = [values.reduce((a, b) => a + b, 0)];
            if (r.aggregation === 'min') values = [Math.min(...values)];
            if (r.aggregation === 'max') values = [Math.max(...values)];
          }
          const tolerance = Math.max(
            r.tolerance,
            Math.abs(r.value) * r.relativeTolerance,
          );
          met = values.every(
            (n) =>
              Number.isFinite(n) &&
              (r.comparison === 'equal'
                ? Math.abs(n - r.value) <= tolerance + 1e-8
                : r.comparison === 'at_least'
                  ? n >= r.value - tolerance
                  : n <= r.value + tolerance),
          );
          observed = `${r.metric} (${r.aggregation}): ${values.slice(0, 20).map(round).join(', ')}${values.length > 20 ? '…' : ''}; expected ${r.comparison} ${r.value}, tolerance ${tolerance}. ${vs.length} element(s).`;
        }
      }
    } catch (error) {
      observed =
        error instanceof Error
          ? error.message
          : 'Could not evaluate requirement.';
    }
    result.push({
      id: r.id,
      label: r.label,
      met,
      observed: observed.slice(0, 800),
    });
  }
  return result;
}
