import type { Volume } from '../model';
import { solidStats } from '../geometry/kernel';
import { isFlat } from '../geometry/spatial';
import { flatPhysicalBounds } from './completionGeometry';
import type {
  CompletionCriteria,
  OffsetPreservationTrace,
} from './completionSchema';

type Requirement = Extract<
  CompletionCriteria['checks'][number]['requirement'],
  { kind: 'preserve_offsets' }
>;
type Bounds = { min: number[]; max: number[] };

/** Bind identities AND expected offsets before looking at any candidate solid.
 * This preserves a measurable relationship, not a claim of physical contact.
 * Cache immutable Volume instances only within one verification attempt. */
export function preservedOffsets() {
  const cache = new Map<Volume, Promise<Bounds>>();
  const bounds = (v: Volume) => {
    if (!cache.has(v))
      cache.set(
        v,
        isFlat(v)
          ? Promise.resolve(flatPhysicalBounds(v))
          : solidStats(v).then((s) => s.bounds),
      );
    return cache.get(v)!;
  };
  return async (
    r: Requirement,
    first: Volume[],
    second: Volume[],
    after: Map<string, Volume>,
    abort: () => void,
  ) => {
    if (!first.length || !second.length)
      throw new Error(
        'Preserved offsets need nonempty original selections. No original relationship could be established.',
      );
    if (first.length * second.length > 4096)
      throw new Error(
        'Preserved-offset matching exceeds 4096 original pairs. Narrow the selections.',
      );
    const axis = { x: 0, y: 1, z: 2 }[r.axis];
    const point = async (v: Volume, anchor: Requirement['firstAnchor']) => {
      abort();
      const b = await bounds(v);
      const p = b.min.map((min, i) =>
        i === axis && anchor !== 'center' ? b[anchor][i] : (min + b.max[i]) / 2,
      );
      if (p.length !== 3 || !p.every(Number.isFinite))
        throw new Error(`Could not measure world-bounds anchors for ${v.id}.`);
      return p;
    };
    const partners = await Promise.all(
      second.map(async (v) => ({
        id: v.id,
        point: await point(v, r.secondAnchor),
      })),
    );
    // Complete original binding before candidate measurements. Never re-pair
    // because another object was moved closer, renamed, deleted or replaced.
    const pairs = [];
    for (const v of first) {
      const p = await point(v, r.firstAnchor);
      const ranked = partners
        .filter((q) => q.id !== v.id)
        .map((q) => ({
          ...q,
          distance: Math.hypot(...p.map((n, i) => n - q.point[i])),
        }))
        .sort((a, b) => a.distance - b.distance);
      if (
        !ranked.length ||
        (ranked[1] && Math.abs(ranked[1].distance - ranked[0].distance) <= 1e-8)
      )
        throw new Error(
          `Original partner for ${v.id} is missing or ambiguous. Narrow the selections; no candidate-based pairing is permitted.`,
        );
      const q = ranked[0];
      pairs.push({
        first: v.id,
        second: q.id,
        originalFirst: p[axis],
        originalSecond: q.point[axis],
        expected: q.point[axis] - p[axis],
      });
    }
    const measurements: OffsetPreservationTrace['samples'] = [];
    for (const pair of pairs) {
      abort();
      const a = after.get(pair.first),
        b = after.get(pair.second);
      measurements.push({
        ...pair,
        measured:
          a && b
            ? (await point(b, r.secondAnchor))[axis] -
              (await point(a, r.firstAnchor))[axis]
            : null,
      });
    }
    const error = (p: (typeof measurements)[number]) =>
      p.measured === null ? Infinity : Math.abs(p.measured - p.expected);
    const failed = measurements.filter((p) => error(p) > r.tolerance + 1e-8);
    const maximum = Math.max(...measurements.map(error));
    const samples = [
      ...failed,
      ...measurements.filter((p) => !failed.includes(p)),
    ].slice(0, 16);
    const trace: OffsetPreservationTrace = {
      source: 'original',
      frame: 'world_xyz_y_up',
      unit: 'm',
      axis: r.axis,
      firstAnchor: r.firstAnchor,
      secondAnchor: r.secondAnchor,
      formula: 'second - first',
      binding: 'nearest_original_anchor_points',
      pairs: pairs.length,
      maxError: Number.isFinite(maximum) ? maximum : null,
      samples,
    };
    return {
      met: !failed.length,
      ids: [...new Set(pairs.flatMap((p) => [p.first, p.second]))],
      trace,
      observed: `${pairs.length} original identity pairs; ${failed.length} changed/missing. Preserve world ${r.axis} ${r.secondAnchor}(second) - ${r.firstAnchor}(first), tolerance ${r.tolerance} m. ${samples
        .slice(0, 3)
        .map(
          (p) =>
            `${p.first} → ${p.second}: original ${p.originalSecond} - ${p.originalFirst} = ${p.expected} m; now ${p.measured === null ? 'identity removed/replaced' : `${p.measured} m`}`,
        )
        .join('; ')}. Bounds offsets do not establish surface contact.`,
    };
  };
}
