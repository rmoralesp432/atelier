/** External evaluation only. Never imported by ATELIER or shown to the AI. */
import { makeVolume, type Volume } from '../../src/model';
import { newSession, type Session } from '../../src/intelligence/engine';
import { equalData } from '../../src/projects/equalData';
import { solidStats, withSolid, sharedVolume } from '../../src/geometry/kernel';
import { baked, piece } from '../completion-evaluation/cases';

export const order = [
  'building',
  'height-edit',
  'ellipse-repair',
  'recovery-tray',
] as const;
export type CaseId = (typeof order)[number];
export const prompts: Record<CaseId, string> = {
  building:
    'Create a four-level open-frame study with a 19 m by 13 m footprint. Floor-to-floor heights are 4.2, 3.3, 3.7 and 3.3 metres, from lowest to highest. Use separate editable slabs, roof, columns and glazing panels. Make reasonable structural and façade choices. Leave the existing marker unchanged.',
  'height-edit':
    'Increase the lowest floor-to-floor height by 1.1 m. Keep the other storey heights, footprint and existing component identities. Adjust all connected elements, keeping the marker unchanged.',
  'ellipse-repair':
    'Create one independently editable elliptical column, 0.73 m across its long horizontal axis, 0.37 m across its short horizontal axis, and 0.91 m tall. Rotate its long axis 37 degrees about Y from X. Put its base center at X=-6.2 m, Y=0.3 m, Z=6.7 m. Leave all existing objects unchanged.',
  'recovery-tray':
    'Create a freestanding open-top tray, 1.7 m long, 0.95 m wide and 0.24 m high, with 0.04 m wall and base thickness. Keep everything else unchanged.',
};
export const specification = {
  building: {
    footprint: [19, 13],
    heights: [4.2, 3.3, 3.7, 3.3],
    increase: 1.1,
  },
  ellipse: {
    width: 0.73,
    depth: 0.37,
    height: 0.91,
    rotation: 37,
    x: -6.2,
    y: 0.3,
    z: 6.7,
  },
  tray: { width: 1.7, depth: 0.95, height: 0.24, thickness: 0.04 },
  tolerances: {
    linearMeters: 0.015,
    smallSolidMeters: 0.005,
    solidRelativeDifference: 0.015,
    volumeFloor: 1e-6,
  },
  interpretation:
    'Four occupied slab levels plus a roof; any location, horizontal orientation, sensible column spacing and glazing subdivisions. Geometry and contacts substantiate labels. Unknown measurement interpretations are not treated as failed geometry.',
};
export type Fact = {
  name: string;
  status: 'verified' | 'incorrect' | 'unverified';
  expected?: unknown;
  actual?: unknown;
};
export const passed = (facts: Fact[]) =>
  facts.every((f) => f.status === 'verified');
export const incorrect = (facts: Fact[]) =>
  facts.some((f) => f.status === 'incorrect');
const near = (a: number, b: number, t = 0.015) => Math.abs(a - b) <= t;
type Bounds = { min: number[]; max: number[] };
export type Measured = {
  id: string;
  name: string;
  bounds: Bounds;
  volume: number;
  role?: string;
  material?: string;
  height: number;
  width: number;
  depth: number;
};
const dim = (b: Bounds, i: number) => b.max[i] - b.min[i];
const fact = (
  name: string,
  ok: boolean,
  expected?: unknown,
  actual?: unknown,
): Fact => ({ name, status: ok ? 'verified' : 'incorrect', expected, actual });
export function seed() {
  const v = {
    ...makeVolume(),
    id: 'retained-marker',
    name: 'Existing marker',
    geometry: { kind: 'box' as const },
    position: { x: -28, y: 0.4, z: -19 },
    dimensions: { width: 0.82, height: 1.13, depth: 0.61 },
    rotation: 17,
    color: '#925b42',
  };
  return newSession({ volumes: [v], selectedId: null });
}
export async function measurements(
  volumes: Volume[],
  rotation = 0,
): Promise<Measured[]> {
  const result: Measured[] = [];
  for (const v of volumes) {
    const data =
      rotation === 0
        ? await solidStats(v)
        : await withSolid(v, (s) => {
            const r = s.rotate([0, -rotation, 0]);
            try {
              return { bounds: r.boundingBox(), volume: r.volume() };
            } finally {
              r.delete();
            }
          });
    result.push({
      id: v.id,
      name: v.name,
      bounds: data.bounds,
      volume: data.volume,
      role: v.component?.role,
      material: v.material,
      height: dim(data.bounds, 1),
      width: dim(data.bounds, 0),
      depth: dim(data.bounds, 2),
    });
  }
  return result;
}
export function targets(original: Session, candidate: Session) {
  const originalIds = new Set(original.project.volumes.map((v) => v.id));
  return candidate.project.volumes.filter((v) => !originalIds.has(v.id));
}
export function protectedFacts(
  original: Session,
  candidate: Session,
  editable: Set<string> = new Set(),
): Fact[] {
  const map = new Map(candidate.project.volumes.map((v) => [v.id, v]));
  const changed = original.project.volumes
    .filter((v) => !editable.has(v.id) && !equalData(v, map.get(v.id)))
    .map((v) => v.id);
  return [
    fact(
      'Unrelated geometry preserved exactly',
      changed.length === 0,
      [],
      changed,
    ),
    fact(
      'Unique editable identities',
      map.size === candidate.project.volumes.length &&
        candidate.project.volumes.every(
          (v) =>
            !candidate.project.groups?.some(
              (g) => g.id === v.groupId && g.locked,
            ),
        ),
      'Distinct selectable unlocked objects',
    ),
    fact(
      'Existing group metadata retained',
      (original.project.groups ?? []).every((g) =>
        equalData(
          g,
          candidate.project.groups?.find((n) => n.id === g.id),
        ),
      ),
      'Original groups retained',
    ),
  ];
}
// Find a planar frame from the occupied material's convex hull, not labels,
// recipe rotation or world AABB. Rotated/baked rectangular slabs are equivalent.
async function horizontalFrame(parts: Volume[]) {
  const points: number[][] = [];
  for (const v of parts)
    await withSolid(v, (s) => {
      const mesh = s.getMesh();
      for (let i = 0; i < mesh.numVert; i++)
        points.push([
          mesh.vertProperties[i * mesh.numProp],
          mesh.vertProperties[i * mesh.numProp + 2],
        ]);
    });
  const p = [
    ...new Map(
      points.map((q) => [q.map((n) => n.toFixed(6)).join(','), q]),
    ).values(),
  ].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return 0;
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const hull: number[][] = [];
  for (const q of p) {
    while (hull.length > 1 && cross(hull.at(-2)!, hull.at(-1)!, q) <= 0)
      hull.pop();
    hull.push(q);
  }
  const lower = hull.length;
  for (const q of p.slice(0, -1).reverse()) {
    while (hull.length > lower && cross(hull.at(-2)!, hull.at(-1)!, q) <= 0)
      hull.pop();
    hull.push(q);
  }
  hull.pop();
  let best = { area: Infinity, angle: 0 };
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i],
      b = hull[(i + 1) % hull.length],
      angle = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    const x = p.map((q) => q[0] * Math.cos(angle) - q[1] * Math.sin(angle));
    const z = p.map((q) => q[0] * Math.sin(angle) + q[1] * Math.cos(angle));
    const area =
      (Math.max(...x) - Math.min(...x)) * (Math.max(...z) - Math.min(...z));
    if (area < best.area - 1e-5)
      best = { area, angle: (angle * 180) / Math.PI };
  }
  return best.angle;
}
function unionBounds(m: Measured[]): Bounds {
  return {
    min: [0, 1, 2].map((i) => Math.min(...m.map((v) => v.bounds.min[i]))),
    max: [0, 1, 2].map((i) => Math.max(...m.map((v) => v.bounds.max[i]))),
  };
}
export async function buildingData(session: Session) {
  const parts = session.project.volumes.filter(
    (v) => v.id !== 'retained-marker',
  );
  const raw = await measurements(parts);
  const flats = raw.filter(
    (m) =>
      m.height <= 1 &&
      m.width * m.depth >= 8 &&
      m.height < Math.min(m.width, m.depth) / 4,
  );
  const ids = new Set(flats.map((v) => v.id));
  const rotation = await horizontalFrame(parts.filter((v) => ids.has(v.id)));
  const all = await measurements(parts, rotation);
  const levels: Measured[][] = [];
  for (const slab of all
    .filter((m) => ids.has(m.id))
    .sort((a, b) => a.bounds.min[1] - b.bounds.min[1])) {
    const match = levels.find((g) =>
      near(g[0].bounds.min[1], slab.bounds.min[1]),
    );
    if (match) match.push(slab);
    else levels.push([slab]);
  }
  return { rotation, all, levels, parts };
}
export async function buildingOracle(
  original: Session,
  candidate: Session,
  edited = false,
): Promise<Fact[]> {
  const editable = new Set(
    edited
      ? original.project.volumes
          .filter((v) => v.id !== 'retained-marker')
          .map((v) => v.id)
      : [],
  );
  const facts = protectedFacts(original, candidate, editable);
  const data = await buildingData(candidate),
    { levels, all } = data;
  facts.push(
    fact(
      'Four occupied slab levels plus independent roof',
      levels.length === 5,
      5,
      levels.map((g) => ({ y: g[0].bounds.min[1], ids: g.map((m) => m.id) })),
    ),
  );
  facts.push(
    fact(
      'Nonempty valid occupied solids',
      all.length > 0 && all.every((m) => m.volume > 0),
      '>0',
      all.map((m) => ({ id: m.id, volume: m.volume })),
    ),
  );
  if (levels.length !== 5) return facts;
  const heights = specification.building.heights.map(
    (h, i) => h + (edited && i === 0 ? 1.1 : 0),
  );
  for (let i = 0; i < levels.length; i++) {
    const bounds = unionBounds(levels[i]);
    const span = [dim(bounds, 0), dim(bounds, 2)].sort((a, b) => b - a);
    facts.push(
      fact(
        `Slab/roof ${i} footprint`,
        near(span[0], 19) && near(span[1], 13),
        [19, 13],
        span,
      ),
    );
    if (i === 4) continue;
    const bottom = levels[i][0].bounds.min[1],
      top = levels[i + 1][0].bounds.min[1];
    facts.push(
      fact(
        `Floor-to-floor height ${i}`,
        near(top - bottom, heights[i]),
        heights[i],
        top - bottom,
      ),
    );
    const clearBase = Math.max(...levels[i].map((m) => m.bounds.max[1]));
    const columns = all.filter(
      (m) =>
        m.material !== 'glass' &&
        m.height > 1 &&
        Math.max(m.width, m.depth) < 1.6 &&
        m.bounds.min[1] <= clearBase + 0.04 &&
        m.bounds.max[1] >= top - 0.04 &&
        m.bounds.min[0] >= bounds.min[0] - 0.04 &&
        m.bounds.max[0] <= bounds.max[0] + 0.04 &&
        m.bounds.min[2] >= bounds.min[2] - 0.04 &&
        m.bounds.max[2] <= bounds.max[2] + 0.04,
    );
    facts.push(
      fact(
        `Level ${i} independent supports span connected slabs`,
        columns.length >= 2,
        'At least two actual vertical members reaching both slab datums',
        columns.map((c) => ({ id: c.id, bounds: c.bounds })),
      ),
    );
    const glazing = all.filter(
      (m) =>
        m.material === 'glass' &&
        m.height > Math.min(1, (top - clearBase) / 2) &&
        Math.min(m.width, m.depth) < 0.3 &&
        m.bounds.max[1] > clearBase + 0.5 &&
        m.bounds.min[1] < top - 0.5,
    );
    facts.push(
      fact(
        `Level ${i} separate physical glazing`,
        glazing.length > 0,
        'Editable thin glass solids overlapping this storey',
        glazing.map((m) => m.id),
      ),
    );
  }
  if (edited) {
    const before = await buildingData(original),
      old = before.all;
    const after = await measurements(data.parts, before.rotation),
      map = new Map(after.map((v) => [v.id, v]));
    facts.push(
      fact(
        'All component identities retained, no replacement or addition',
        old.length === after.length && old.every((v) => map.has(v.id)),
        old.length,
        after.length,
      ),
    );
    const first = before.levels[1]?.[0]?.bounds.min[1],
      baseTop = Math.max(
        ...(before.levels[0] ?? []).map((m) => m.bounds.max[1]),
      );
    const lowest = new Set((before.levels[0] ?? []).map((m) => m.id));
    for (const m of old) {
      const n = map.get(m.id);
      if (!n) continue;
      let low = m.bounds.min[1],
        high = m.bounds.max[1];
      if (lowest.has(m.id) || high <= baseTop + 0.04) {
        /* preserve base */
      } else if (
        low >= first - 0.04 ||
        (m.height < 0.5 && high >= first - 0.5)
      ) {
        low += 1.1;
        high += 1.1;
      } else if (m.height > 0.5 && high > baseTop + 0.5) {
        high += 1.1;
      } else {
        facts.push({
          name: `Connected element ${m.id}`,
          status: 'unverified',
          actual: m,
          expected: 'No unique anchor classification; inspect independently',
        });
        continue;
      }
      const horizontal = [0, 2].every(
        (k) =>
          near(m.bounds.min[k], n.bounds.min[k]) &&
          near(m.bounds.max[k], n.bounds.max[k]),
      );
      facts.push(
        fact(
          `Connected geometry ${m.id}`,
          horizontal &&
            near(n.bounds.min[1], low) &&
            near(n.bounds.max[1], high),
          { minY: low, maxY: high, unchangedXZ: true },
          n.bounds,
        ),
      );
      const source = original.project.volumes.find((v) => v.id === m.id)!;
      const target = candidate.project.volumes.find((v) => v.id === m.id)!;
      const difference = await withSolid(source, async (s) => {
        const moved = s.translate([0, -m.bounds.min[1], 0]);
        const scaled = moved.scale([1, (high - low) / m.height, 1]);
        const expected = scaled.translate([0, low, 0]);
        try {
          return await withSolid(target, (actual) => {
            const overlap = expected.intersect(actual);
            try {
              return {
                expectedVolume: expected.volume(),
                actualVolume: actual.volume(),
                symmetricDifference: Math.max(
                  0,
                  expected.volume() + actual.volume() - 2 * overlap.volume(),
                ),
              };
            } finally {
              overlap.delete();
            }
          });
        } finally {
          expected.delete();
          scaled.delete();
          moved.delete();
        }
      });
      facts.push(
        fact(
          `Retained occupied shape ${m.id}`,
          difference.symmetricDifference <=
            Math.max(1e-6, difference.expectedVolume * 0.015),
          'Original solid with only the intended vertical stretch/translation',
          difference,
        ),
      );
    }
  }
  return facts;
}
export function ellipse() {
  const s = specification.ellipse;
  return {
    ...piece(
      'Oracle ellipse',
      'cylinder',
      s.width,
      s.depth,
      s.height,
      s.x,
      s.y,
      s.z,
    ),
    rotation: s.rotation,
  };
}
export async function ellipseOracle(
  original: Session,
  candidate: Session,
): Promise<Fact[]> {
  const facts = protectedFacts(original, candidate),
    added = targets(original, candidate);
  facts.push(
    fact(
      'One separately editable elliptical column',
      added.length === 1,
      1,
      added.length,
    ),
  );
  if (added.length !== 1) return facts;
  const expected = ellipse(),
    a = await solidStats(expected),
    b = await solidStats(added[0]);
  const overlap = await sharedVolume(expected, added[0]),
    difference = Math.max(0, a.volume + b.volume - 2 * overlap);
  facts.push(
    fact(
      'Rotated elliptical occupied solid and position',
      difference <= a.volume * 0.015,
      {
        bounds: a.bounds,
        volume: a.volume,
        maxSymmetricDifference: a.volume * 0.015,
      },
      { bounds: b.bounds, volume: b.volume, symmetricDifference: difference },
    ),
  );
  return facts;
}
export async function ellipseControls(original: Session, candidate: Session) {
  const index = candidate.project.volumes.findIndex((v) =>
    targets(original, candidate).some((t) => t.id === v.id),
  );
  const out: {
    name: string;
    expected: 'verified' | 'incorrect';
    session: Session;
  }[] = [];
  let s = structuredClone(candidate);
  s.project.volumes[index] = await baked(s.project.volumes[index]);
  out.push({ name: 'Equivalent mesh', expected: 'verified', session: s });
  s = structuredClone(candidate);
  const v = s.project.volumes[index];
  s.project.volumes[index] = {
    ...v,
    geometry: { kind: 'box' },
    dimensions: { ...ellipse().dimensions },
    position: { ...ellipse().position },
    rotation: 37,
  };
  out.push({
    name: 'Wrong solid with same intrinsic spans',
    expected: 'incorrect',
    session: s,
  });
  s = structuredClone(candidate);
  s.project.volumes[0].position.x += 0.22;
  out.push({
    name: 'Protected marker moved',
    expected: 'incorrect',
    session: s,
  });
  return out;
}
export async function trayOracle(
  original: Session,
  candidate: Session,
): Promise<Fact[]> {
  const facts = protectedFacts(original, candidate),
    added = targets(original, candidate);
  if (!added.length)
    return [
      ...facts,
      fact('Tray exists', false, 'Actual occupied tray geometry', 0),
    ];
  const rotation = await horizontalFrame(added),
    m = await measurements(added, rotation),
    b = unionBounds(m);
  const widths = [dim(b, 0), dim(b, 2)],
    span = [...widths].sort((a, b) => b - a);
  facts.push(
    fact(
      'Tray outer dimensions',
      near(span[0], 1.7, 0.005) &&
        near(span[1], 0.95, 0.005) &&
        near(dim(b, 1), 0.24, 0.005),
      [1.7, 0.95, 0.24],
      [...span, dim(b, 1)],
    ),
  );
  // Check occupied union against a rectangular shell in the measured frame.
  // Multiple independently editable walls and a single Boolean solid are equivalent.
  const { getKernel } = await import('../../src/geometry/kernel');
  const kernel = await getKernel(),
    allocated: any[] = [];
  const keep = (v: any) => {
    allocated.push(v);
    return v;
  };
  try {
    const solids = [];
    for (const v of added)
      solids.push(await withSolid(v, (s) => keep(s.rotate([0, -rotation, 0]))));
    const union = keep(kernel.Manifold.union(solids));
    const outer = keep(
      keep(kernel.Manifold.cube([widths[0], 0.24, widths[1]])).translate(b.min),
    );
    const cavity = keep(
      keep(
        kernel.Manifold.cube([widths[0] - 0.08, 0.3, widths[1] - 0.08]),
      ).translate([b.min[0] + 0.04, b.min[1] + 0.04, b.min[2] + 0.04]),
    );
    const ideal = keep(outer.subtract(cavity)),
      overlap = keep(union.intersect(ideal));
    const difference = Math.max(
      0,
      union.volume() + ideal.volume() - 2 * overlap.volume(),
    );
    facts.push(
      fact(
        'Open cavity, four-centimetre walls and closed base',
        difference <= Math.max(1e-6, ideal.volume() * 0.015),
        { idealVolume: ideal.volume(), maxDifference: ideal.volume() * 0.015 },
        { actualVolume: union.volume(), symmetricDifference: difference },
      ),
    );
  } finally {
    allocated.reverse().forEach((s) => s.delete());
  }
  return facts;
}
export async function oracle(
  id: CaseId,
  original: Session,
  candidate: Session,
) {
  if (id === 'building' || id === 'height-edit')
    return buildingOracle(original, candidate, id === 'height-edit');
  if (id === 'ellipse-repair') return ellipseOracle(original, candidate);
  return trayOracle(original, candidate);
}
