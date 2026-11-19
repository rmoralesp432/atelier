import { type Volume, type Vec3 } from '../model';
import { shapeEvidence } from './shapeEvidence';
import {
  solidStats,
  sharedVolume,
  withSolid,
  getKernel,
} from '../geometry/kernel';
import { MAX_SCENE_OBJECTS } from '../limits';
import { isFlat } from '../geometry/spatial';
import type { Session } from './engine';
import type { CompletionCriteria } from './completionSchema';
import type { DesignSelector } from './designBriefSchema';

type Requirement = CompletionCriteria['checks'][number]['requirement'];
export type GeometricEvidence = {
  met: boolean;
  observed: string;
  unavailable?: boolean;
};
type Bounds = { min: number[]; max: number[] };
/** Bounds of actual rendered flat profiles, not a rotated enclosing rectangle. */
export function flatPhysicalBounds(v: Volume): Bounds {
  const g = v.geometry;
  const points =
    g?.kind === 'polygon'
      ? g.points
      : g?.kind === 'circle'
        ? Array.from({ length: 64 }, (_, i) => ({
            x: Math.cos((i * Math.PI) / 32) / 2,
            z: Math.sin((i * Math.PI) / 32) / 2,
          }))
        : [
            { x: -0.5, z: -0.5 },
            { x: 0.5, z: -0.5 },
            { x: 0.5, z: 0.5 },
            { x: -0.5, z: 0.5 },
          ];
  const a = (v.rotation * Math.PI) / 180;
  const world = points.map((p) => ({
    x:
      v.position.x +
      p.x * v.dimensions.width * Math.cos(a) +
      p.z * v.dimensions.depth * Math.sin(a),
    z:
      v.position.z -
      p.x * v.dimensions.width * Math.sin(a) +
      p.z * v.dimensions.depth * Math.cos(a),
  }));
  return {
    min: [
      Math.min(...world.map((p) => p.x)),
      v.position.y,
      Math.min(...world.map((p) => p.z)),
    ],
    max: [
      Math.max(...world.map((p) => p.x)),
      v.position.y,
      Math.max(...world.map((p) => p.z)),
    ],
  };
}
export function physicalChecks() {
  const cache = new Map<
    Volume,
    Promise<Awaited<ReturnType<typeof solidStats>>>
  >();
  const stats = (v: Volume) => {
    if (!cache.has(v)) cache.set(v, solidStats(v));
    return cache.get(v)!;
  };
  const bounds = async (v: Volume): Promise<Bounds> => {
    if (!isFlat(v)) return (await stats(v)).bounds;
    return flatPhysicalBounds(v);
  };
  const base = async (v: Volume): Promise<Vec3> => {
    const b = await bounds(v);
    return {
      x: (b.min[0] + b.max[0]) / 2,
      y: b.min[1],
      z: (b.min[2] + b.max[2]) / 2,
    };
  };
  // Match unordered multisets, including coincident elements, without depending
  // on labels or greedy ordering. Every expected point needs a distinct object.
  const positions = async (
    vs: Volume[],
    expected: Vec3[],
    tolerance: number,
  ) => {
    const actual = await Promise.all(vs.map(base));
    const edges = expected.map((p) =>
      actual.flatMap((q, i) =>
        Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) <= tolerance + 1e-8
          ? [i]
          : [],
      ),
    );
    const matched = new Map<number, number>();
    const assign = (i: number, seen: Set<number>): boolean => {
      for (const j of edges[i]) {
        if (seen.has(j)) continue;
        seen.add(j);
        if (!matched.has(j) || assign(matched.get(j)!, seen)) {
          matched.set(j, i);
          return true;
        }
      }
      return false;
    };
    expected.forEach((_, i) => assign(i, new Set()));
    return matched.size;
  };
  return async function check(
    r: Requirement,
    select: (s: DesignSelector) => Volume[],
    session: Session,
  ): Promise<GeometricEvidence | undefined> {
    if (r.kind === 'positions' || r.kind === 'radial' || r.kind === 'layout') {
      const vs = select(r.selector);
      let expected: Vec3[];
      if (r.kind === 'positions') expected = r.points;
      else if (r.kind === 'radial') {
        const axes = { xy: ['x', 'y'], xz: ['x', 'z'], yz: ['y', 'z'] }[
          r.plane
        ] as (keyof Vec3)[];
        expected = Array.from({ length: r.count }, (_, i) => {
          const p = { ...r.center },
            a = ((r.start + i * r.step) * Math.PI) / 180;
          p[axes[0]] += r.radius * Math.cos(a);
          p[axes[1]] += r.radius * Math.sin(a);
          return p;
        });
      } else {
        if (
          (['x', 'y', 'z'] as const).some(
            (axis) =>
              r.counts[axis] > 1 && Math.abs(r.step[axis]) <= r.tolerance * 2,
          )
        )
          throw new Error(
            'Layout positions must be distinct, farther apart than twice the tolerance.',
          );
        if (r.counts.x * r.counts.y * r.counts.z > MAX_SCENE_OBJECTS)
          throw new Error(
            'Spatial comparison exceeds the bounded point-set capacity.',
          );
        expected = [];
        const a = (r.rotation * Math.PI) / 180;
        for (let y = 0; y < r.counts.y; y++)
          for (let z = 0; z < r.counts.z; z++)
            for (let x = 0; x < r.counts.x; x++)
              expected.push({
                x:
                  r.origin.x +
                  x * r.step.x * Math.cos(a) +
                  z * r.step.z * Math.sin(a),
                y: r.origin.y + y * r.step.y,
                z:
                  r.origin.z -
                  x * r.step.x * Math.sin(a) +
                  z * r.step.z * Math.cos(a),
              });
      }
      const matched = await positions(vs, expected, r.tolerance);
      return {
        met: vs.length === expected.length && matched === expected.length,
        observed: `${matched}/${expected.length} required world base-center positions occupied; ${vs.length} objects, tolerance ${r.tolerance} m.`,
      };
    }
    if (r.kind === 'editable' || r.kind === 'group') {
      const vs = select(r.selector);
      if (r.kind === 'editable') {
        const locked = new Set(
          session.project.groups?.filter((g) => g.locked).map((g) => g.id),
        );
        return {
          met:
            vs.length > 0 &&
            new Set(vs.map((v) => v.id)).size === vs.length &&
            vs.every((v) => !v.groupId || !locked.has(v.groupId)),
          observed: `${vs.length} separate scene objects; ${vs.filter((v) => v.groupId && locked.has(v.groupId)).length} in locked groups. Independent editability means distinct selectable model objects, not editable internal faces.`,
        };
      }
      const groups =
        session.project.groups?.filter((g) => g.name === r.name) ?? [];
      // A name need not be globally unique. Membership identifies the actual
      // assembly; an unrelated same-named group cannot invalidate it.
      const group = groups.find(
        (g) => vs.length > 0 && vs.every((v) => v.groupId === g.id),
      );
      const members = group
        ? session.project.volumes.filter((v) => v.groupId === group.id)
        : [];
      return {
        met:
          !!group &&
          vs.length > 0 &&
          vs.every((v) => v.groupId === group.id) &&
          (!r.exclusive || members.length === vs.length),
        observed: `Group ${r.name}: ${members.length} members; ${vs.filter((v) => group && v.groupId === group.id).length}/${vs.length} requested objects belong to it.`,
      };
    }
    if (r.kind === 'relationship' || r.kind === 'relation') {
      const a = select(r.first),
        b = select(r.second);
      if (r.kind === 'relation' && (a.length !== 1 || b.length !== 1))
        throw new Error(
          'Legacy relation requires two individual solids. Use relationship with an explicit quantifier for sets.',
        );
      const quantifier = r.kind === 'relationship' ? r.quantifier : 'all';
      const distance = r.kind === 'relationship' ? r.distance : 0;
      if (a.length * b.length > 4096)
        throw new Error(
          'Relationship comparison exceeds the bounded pair capacity.',
        );
      const rows: boolean[][] = [];
      for (const first of a) {
        const row: boolean[] = [];
        for (const second of b) {
          if (first.id === second.id) continue;
          const shared = await sharedVolume(first, second),
            epsilon = Math.max(1e-9, r.tolerance ** 3);
          if (r.relation === 'intersects') row.push(shared > epsilon);
          else if (r.relation === 'disjoint') row.push(shared <= epsilon);
          else if (r.relation === 'contained')
            row.push(Math.abs((await stats(first)).volume - shared) <= epsilon);
          else {
            const gap = await withSolid(first, (sa) =>
              withSolid(second, (sb) =>
                sa.minGap(sb, distance + r.tolerance + 0.001),
              ),
            );
            row.push(
              r.relation === 'touching'
                ? shared <= epsilon && gap <= r.tolerance + 1e-8
                : Math.abs(gap - distance) <= r.tolerance + 1e-8,
            );
          }
        }
        rows.push(row);
      }
      const met =
        rows.length > 0 &&
        (quantifier === 'each'
          ? rows.every((row) => row.some(Boolean))
          : quantifier === 'all'
            ? rows.every((row) => row.length > 0 && row.every(Boolean))
            : rows.some((row) => row.some(Boolean)));
      return {
        met,
        observed: `${r.relation}: ${rows.flat().filter(Boolean).length}/${rows.flat().length} distinct solid pairs satisfy ${quantifier}; tolerance ${r.tolerance} m.`,
      };
    }
    if (r.kind === 'region') {
      if (Object.values(r.size).some((n) => n <= 0))
        throw new Error('Region dimensions must be positive.');
      const vs = select(r.selector);
      // A query region is not a project object: it may cross ground level or
      // be smaller than the editor's minimum primitive dimensions.
      const m = await getKernel();
      const cube = m.Manifold.cube([r.size.x, r.size.y, r.size.z], true);
      const rotated = cube.rotate([0, r.rotation, 0]);
      const solid = rotated.translate([r.center.x, r.center.y, r.center.z]);
      const occupied = await (async () => {
        let remaining = solid.translate([0, 0, 0]);
        try {
          for (const v of vs)
            await withSolid(v, (s) => {
              const next = remaining.subtract(s);
              remaining.delete();
              remaining = next;
              if (remaining.status() !== 'NoError')
                throw new Error('Region comparison could not be evaluated.');
            });
          return { full: solid.volume(), empty: remaining.volume() };
        } finally {
          remaining.delete();
          solid.delete();
          rotated.delete();
          cube.delete();
        }
      })();
      const error =
        r.occupancy === 'empty'
          ? occupied.full - occupied.empty
          : occupied.empty;
      return {
        met: vs.length > 0 && error <= Math.max(1e-9, r.tolerance ** 3),
        observed: `Region ${r.occupancy}: ${Math.max(0, error)} m³ inconsistent material; selected ${vs.length} objects.`,
      };
    }
    if (r.kind === 'diameter') {
      const vs = select(r.selector);
      const evidence = [];
      for (const v of vs) evidence.push(await shapeEvidence(v, r.shape));
      const incorrect = evidence.some(
        (e) =>
          e.met === false ||
          (e.diameter !== undefined &&
            Math.abs(e.diameter - r.value) > r.tolerance + 1e-6),
      );
      return {
        met:
          vs.length > 0 &&
          !incorrect &&
          evidence.every((e) => e.met === true && e.diameter !== undefined),
        unavailable:
          !incorrect &&
          evidence.some((e) => e.met === undefined || e.diameter === undefined),
        observed: `True ${r.shape} diameter: ${evidence.map((e) => e.diameter ?? (e.met === false ? 'not the required round shape' : 'unverified')).join(', ')}; expected ${r.value} ± ${r.tolerance} m across ${vs.length} objects. Diameter is intrinsic, independent of world orientation.`,
      };
    }
    if (r.kind === 'shape') {
      if (
        ![
          'box',
          'cylinder',
          'sphere',
          'ellipsoid',
          'elliptic_cylinder',
        ].includes(r.shape)
      )
        return {
          met: false,
          unavailable: true,
          observed: `No occupied-geometry classifier for ${r.shape}. A construction label does not establish the requested geometric property.`,
        };
      const vs = select(r.selector);
      if (!vs.length)
        return { met: false, observed: 'No objects match the required shape.' };
      const matches = [];
      for (const v of vs) matches.push((await shapeEvidence(v, r.shape)).met);
      return {
        met: matches.every(Boolean),
        unavailable: !matches.includes(false) && matches.includes(undefined),
        observed: `Evaluated solid shape ${r.shape}: ${matches.filter(Boolean).length}/${vs.length} match occupied geometry, independent of recipe type.${matches.includes(undefined) ? ' A different internal frame or representation prevents classification of the remaining solids; they are unverified.' : ''}`,
      };
    }
    if (r.kind === 'measure' && r.metric === 'thickness')
      return {
        met: false,
        unavailable: true,
        observed:
          'Wall/shell thickness needs surface-to-surface evidence. A bounding-box minimum or recipe value does not prove material thickness.',
      };
    if (
      r.kind === 'measure' &&
      ['width', 'depth', 'height', 'x', 'y', 'z', 'base', 'top'].includes(
        r.metric,
      )
    ) {
      const vs = select(r.selector);
      if (!vs.length)
        return {
          met: false,
          observed: 'No objects match the measurable requirement.',
        };
      let boxes = await Promise.all(vs.map(bounds));
      if (r.aggregation === 'envelope')
        boxes = [
          {
            min: [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b.min[i]))),
            max: [0, 1, 2].map((i) => Math.max(...boxes.map((b) => b.max[i]))),
          },
        ];
      const axis = ['width', 'x'].includes(r.metric)
        ? 0
        : ['depth', 'z'].includes(r.metric)
          ? 2
          : 1;
      let values = boxes.map((b) =>
        ['width', 'depth', 'height'].includes(r.metric)
          ? b.max[axis] - b.min[axis]
          : ['y', 'base'].includes(r.metric)
            ? b.min[1]
            : r.metric === 'top'
              ? b.max[1]
              : (b.min[axis] + b.max[axis]) / 2,
      );
      if (r.aggregation === 'sum') values = [values.reduce((a, b) => a + b, 0)];
      if (r.aggregation === 'min') values = [Math.min(...values)];
      if (r.aggregation === 'max') values = [Math.max(...values)];
      if (r.aggregation === 'range')
        values = [Math.max(...values) - Math.min(...values)];
      return {
        met: values.every(
          (n) =>
            Number.isFinite(n) &&
            (r.comparison === 'equal'
              ? Math.abs(n - r.value) <= r.tolerance + 1e-8
              : r.comparison === 'at_least'
                ? n >= r.value - r.tolerance
                : n <= r.value + r.tolerance),
        ),
        observed: `${r.metric} (${r.aggregation}, world solids): ${values.slice(0, 16).join(', ')}; expected ${r.comparison} ${r.value} ± ${r.tolerance} m.`,
      };
    }
    return undefined;
  };
}
