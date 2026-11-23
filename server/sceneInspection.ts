import { resolveObjectReference } from '../src/intelligence/objectReferences';
import type { ModelRequest } from './provider';
import { equalData } from '../src/projects/equalData';

type ObjectInfo = ModelRequest['scene']['objects'][number];
export type InspectionQuery = {
  ids: string[];
  role: string | null;
  snapshot: 'current' | 'before' | 'compare';
  relativeTo: string | null;
};

export function referenceSummary(input: ModelRequest) {
  const ref = input.sceneReference;
  if (!ref) return { available: false };
  const original = new Set(ref.ids),
    current = new Set(input.scene.objects.map((o) => o.id));
  return {
    available: true,
    source: ref.source,
    created: input.scene.objects
      .filter((o) => !original.has(o.id))
      .map((o) => o.id),
    removed: ref.ids.filter((id) => !current.has(id)),
    changed: ref.replacements.filter((o) => current.has(o.id)).map((o) => o.id),
  };
}

/** Envelope evidence, not an assertion of contact, support, or edit permission.
 * Keep unrounded source values; positive separation means a gap on that axis.
 * This also works for rotated objects, but their world AABBs are not surfaces. */
function relation(
  first: ObjectInfo | undefined,
  second: ObjectInfo | undefined,
) {
  const a = first?.spatial?.envelopeBounds,
    b = second?.spatial?.envelopeBounds;
  if (!a || !b) return null;
  const axes = ['x', 'y', 'z'] as const;
  const vector = (fn: (axis: (typeof axes)[number]) => number) =>
    Object.fromEntries(axes.map((axis) => [axis, fn(axis)]));
  return {
    first: first!.id,
    second: second!.id,
    firstBounds: a,
    secondBounds: b,
    centerDelta: vector(
      (axis) => (b.min[axis] + b.max[axis] - a.min[axis] - a.max[axis]) / 2,
    ),
    forwardGap: vector((axis) => b.min[axis] - a.max[axis]),
    reverseGap: vector((axis) => a.min[axis] - b.max[axis]),
    projectedOverlap: vector(
      (axis) =>
        Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]),
    ),
  };
}

export function inspectScene(input: ModelRequest, query: InspectionQuery) {
  const current = new Map(input.scene.objects.map((o) => [o.id, o]));
  const ref = input.sceneReference;
  const replacements = new Map(ref?.replacements.map((o) => [o.id, o]));
  const originalIds = new Set(ref?.ids);
  // Missing reference is unknown, never silently replaced by the current model.
  const before = new Map(
    ref?.ids.map((id) => [id, replacements.get(id) ?? current.get(id)]),
  );
  const invalid =
    !!ref &&
    (before.size !== ref.ids.length ||
      [...before.values()].some((o) => !o) ||
      replacements.size !== ref.replacements.length ||
      [...replacements.keys()].some((id) => !originalIds.has(id)));
  if (query.snapshot !== 'current' && (!ref || invalid))
    return {
      available: false,
      reason:
        'The request-start reference is unavailable or incomplete. Do not infer original dimensions from the edited scene.',
    };
  const roster =
    query.snapshot === 'before'
      ? [...before.keys()]
      : query.snapshot === 'compare'
        ? [...new Set([...before.keys(), ...current.keys()])]
        : [...current.keys()];
  const resolve = (reference: string, which: 'before' | 'current') =>
    resolveObjectReference(
      reference,
      [...(which === 'before' ? before : current).values()].filter(
        (o): o is ObjectInfo => !!o,
      ),
      (which === 'before' ? ref?.groups : input.scene.groups) ?? [],
    );
  let selected: Set<string>,
    relativeBefore: string | undefined,
    relativeCurrent: string | undefined;
  const missingIds: string[] = [];
  try {
    selected = new Set(
      query.ids.flatMap((reference) => {
        const found = [
          ...new Set([
            ...(query.snapshot !== 'current'
              ? resolve(reference, 'before')
              : []),
            ...(query.snapshot !== 'before'
              ? resolve(reference, 'current')
              : []),
          ]),
        ];
        if (!found.length) missingIds.push(reference);
        return found;
      }),
    );
    if (query.relativeTo !== null) {
      const old =
        query.snapshot !== 'current' ? resolve(query.relativeTo, 'before') : [];
      const now =
        query.snapshot !== 'before' ? resolve(query.relativeTo, 'current') : [];
      if (old.length > 1 || now.length > 1)
        throw Error(
          'The relative reference must identify one object, not a multi-object group.',
        );
      relativeBefore = old[0];
      relativeCurrent = now[0];
      if (
        relativeBefore &&
        relativeCurrent &&
        relativeBefore !== relativeCurrent
      )
        throw Error(
          'The relative reference changed identity. Use the original object ID.',
        );
    }
  } catch (error) {
    return {
      available: false,
      reason:
        error instanceof Error
          ? error.message
          : 'The reference could not be resolved.',
    };
  }
  const eligible = roster.filter(
    (id) =>
      (!query.ids.length || selected.has(id)) &&
      (!query.role ||
        (query.snapshot !== 'current' &&
          before.get(id)?.component?.role === query.role) ||
        (query.snapshot !== 'before' &&
          current.get(id)?.component?.role === query.role)),
  );
  // Preserve the existing current-only construction inspection. Comparisons
  // duplicate object details, so their bounded output explicitly reports omissions.
  const ids =
    query.snapshot === 'current' && !query.relativeTo
      ? eligible
      : eligible.slice(0, 200);
  const fields = [
    'name',
    'groupId',
    'dimensions',
    'position',
    'rotation',
    'shape',
    'material',
    'materialSpec',
    'color',
    'component',
    'construction',
    'formDefinition',
    'formFrame',
    'architecture',
    'spatial',
    'display',
    'visible',
  ] as const;
  return {
    available: true,
    snapshot: query.snapshot,
    source:
      query.snapshot === 'compare'
        ? 'request_start_and_current_transaction'
        : query.snapshot === 'current'
          ? 'current_transaction'
          : 'request_start',
    units: 'meters',
    frame: 'world XYZ; Y up; north -Z',
    measurementContract:
      'World bounding envelopes only, not physical contact or structural attachment. centerDelta = second center - first center; forwardGap = second min - first max; reverseGap = first min - second max; projectedOverlap = min(maxima) - max(minima). Dimensions are local modeling dimensions. Relationships never grant edit permission.',
    matched: eligible.length,
    omitted: eligible.length - ids.length,
    missingIds,
    referenceFound:
      query.relativeTo === null
        ? null
        : {
            before: !!relativeBefore,
            current: !!relativeCurrent,
          },
    objects: ids.map((id) => {
      const old = before.get(id),
        now = current.get(id);
      if (query.snapshot !== 'compare')
        return query.snapshot === 'before' ? old : now;
      return {
        id,
        before: old ?? null,
        current: now ?? null,
        state: !old
          ? 'created'
          : !now
            ? 'removed'
            : fields.some((key) => !equalData(old[key], now[key]))
              ? 'changed'
              : 'unchanged',
        changedFields:
          old && now
            ? fields.filter((key) => !equalData(old[key], now[key]))
            : [],
      };
    }),
    relations:
      query.relativeTo === null
        ? []
        : ids
            .filter((id) => id !== relativeBefore && id !== relativeCurrent)
            .map((id) => ({
              id,
              ...(query.snapshot !== 'current'
                ? {
                    before: relation(
                      before.get(relativeBefore!),
                      before.get(id),
                    ),
                  }
                : {}),
              ...(query.snapshot !== 'before'
                ? {
                    current: relation(
                      current.get(relativeCurrent!),
                      current.get(id),
                    ),
                  }
                : {}),
            })),
    groups:
      query.snapshot === 'compare'
        ? { before: ref?.groups ?? [], current: input.scene.groups ?? [] }
        : query.snapshot === 'before'
          ? (ref?.groups ?? [])
          : (input.scene.groups ?? []),
    execution: input.execution ?? null,
  };
}
