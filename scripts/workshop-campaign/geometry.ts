/** External campaign fixtures/oracles. Never imported by any application version. */
import type { Session } from '../../src/intelligence/engine';
import { newSession } from '../../src/intelligence/engine';
import { isLocked, type Volume } from '../../src/model';
import { equalData } from '../../src/projects/equalData';
import {
  K,
  asVolume,
  box,
  vertical,
  mapSolid,
  subtract,
  cloneSolid,
  stats,
  sameSolid,
  rad,
  axial,
  type V3,
} from '../phase3-evaluation/geometry';
export { K, cloneSolid, stats, asVolume };
export type Fact = {
  name: string;
  status: 'verified' | 'incorrect' | 'unverified';
  expected?: unknown;
  actual?: unknown;
};
export const pass = (fs: Fact[]) =>
  fs.length > 0 && fs.every((f) => f.status === 'verified');
export const wrong = (fs: Fact[]) => fs.some((f) => f.status === 'incorrect');
const group = {
  id: 'campaign-markers',
  name: 'Existing unrelated samples',
  visible: true,
  locked: false,
};
export function seed(id: string): Session {
  const m = [
    asVolume(
      box(0.22, 0.31, 0.18, -4, 0, 2),
      'reference-block',
      'Existing ceramic sample',
    ),
    asVolume(
      mapSolid(vertical(0.44, 0.07), (s) => s.translate([3.5, 0, -2])),
      'reference-round',
      'Independent round sample',
    ),
  ];
  m.forEach((v) => {
    v.groupId = group.id;
    v.materialSpec = 'ceramic';
  });
  const s = newSession({ volumes: m, groups: [group], selectedId: null });
  if (id === 'D-H2') {
    const tri = K.Manifold.hull([
      [-0.4, 0, -0.25],
      [0.45, 0, -0.25],
      [-0.1, 0, 0.42],
      [-0.4, 0.53, -0.25],
      [0.45, 0.53, -0.25],
      [-0.1, 0.53, 0.42],
    ]);
    const solids = [
      mapSolid(box(0.82, 0.31, 0.46), (x) =>
        x.rotate([0, 19, 0]).translate([-1.7, 0.45, -0.4]),
      ),
      mapSolid(vertical(0.76, 0.5), (x) =>
        x
          .scale([0.58, 1, 0.34])
          .rotate([0, -28, 0])
          .translate([0.2, 1.15, 2.1]),
      ),
      mapSolid(tri, (x) => x.rotate([0, 43, 0]).translate([2.4, 0.8, -1.6])),
    ];
    const pieces = solids.map((x, i) =>
      asVolume(
        x,
        `display-${i}`,
        ['Oblique block', 'Elliptical sample', 'Triangular piece'][i],
      ),
    );
    pieces.forEach((v) => (v.groupId = 'display-pieces'));
    s.project.volumes.push(...pieces);
    s.project.groups!.push({
      id: 'display-pieces',
      name: 'Display pieces',
      visible: true,
      locked: false,
    });
  }
  return s;
}
export function arcPoints(): V3[] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = rad(37 - 24 * i);
    return [-0.9 + 1.7 * Math.cos(a), 0.6 + 0.11 * i, 1.3 + 1.7 * Math.sin(a)];
  });
}
const ellipse = (w: number, h: number, depth: number, y: number) =>
  mapSolid(K.Manifold.cylinder(depth, 0.5, 0.5, 128), (s) =>
    s.scale([w, h, 1]).translate([0, y, -depth / 2]),
  );
export const halo = () =>
  subtract(ellipse(1.5, 2, 0.12, 1.3), ellipse(1.24, 1.74, 0.14, 1.3));
export function referenceParts(id: string): Volume[] {
  const vs: Volume[] = [];
  const add = (s: any, name: string, mat: 'solid' | 'glass' = 'solid') => {
    const v = asVolume(s, `fixture-${id}-${vs.length}`, name);
    v.groupId = `fixture-${id}`;
    v.material = mat;
    vs.push(v);
    return v;
  };
  if (id === 'W1') {
    add(box(1.9, 0.045, 0.58, 0, 0.795), 'Top');
    for (const x of [-0.83, 0.83]) add(box(0.04, 0.795, 0.46, x, 0), 'Side');
    add(box(1.62, 0.12, 0.04, 0, 0.18, 0.21), 'Back stretcher');
  } else if (id === 'W2') {
    add(box(3.6, 0.12, 2.8), 'Floor');
    add(box(3.6, 0.15, 2.8, 0, 2.72), 'Roof');
    for (const x of [-1.65, 1.65])
      for (const z of [-1.25, 1.25])
        add(box(0.1, 2.6, 0.1, x, 0.12, z), 'Post');
    for (const x of [-1.74, 1.74])
      add(box(0.02, 2.6, 2.8, x, 0.12), 'Side glazing', 'glass');
    add(box(3.6, 2.6, 0.1, 0, 0.12, -1.35), 'Back wall');
  } else if (id === 'W3') {
    add(box(1.8, 0.12, 0.7), 'Base');
    add(
      subtract(
        axial(1, 0.25, 0, [0, 0.8, 0]),
        axial(1.02, 0.07, 0, [0, 0.8, 0]),
      ),
      'Hollow roller',
    );
    add(axial(1.8, 0.05, 0, [0, 0.8, 0]), 'Shaft');
    for (const x of [-0.64, 0.64])
      add(
        subtract(
          box(0.12, 1, 0.42, x, 0.12),
          axial(0.14, 0.07, 0, [x, 0.8, 0]),
        ),
        'Bearing',
      );
  } else if (id === 'W4') {
    add(box(1.8, 0.18, 0.45), 'Plinth');
    add(halo(), 'Halo');
    for (const x of [-0.32, 0.32])
      add(
        mapSolid(vertical(0.27, 0.035), (s) => s.translate([x, 0.18, 0])),
        'Support',
      );
  } else if (id === 'D-H1' || id === 'D-N1') {
    for (const [i, p] of arcPoints().entries())
      add(
        mapSolid(vertical(0.48, 0.07), (s) => s.translate(p)),
        `Arc sample ${i + 1}`,
      );
    if (id === 'D-N1') {
      const p = vs[2];
      const a = rad(37 - 24 * 2);
      p.position.x += 0.04 * Math.cos(a);
      p.position.z += 0.04 * Math.sin(a);
    }
  }
  return vs;
}
export function referenceScene(id: string): Session {
  const s = seed(id);
  const ps = referenceParts(id);
  s.project.volumes.push(...ps);
  if (ps.length)
    s.project.groups!.push({
      id: `fixture-${id}`,
      name: `${id} assembly`,
      visible: true,
      locked: false,
    });
  return s;
}
type Part = { v: Volume; s: any; b: ReturnType<typeof stats> };
function classify(id: string, parts: Part[]) {
  const pick = (fn: (p: Part) => boolean) => parts.filter(fn);
  if (id === 'W1') {
    const top = pick(
      (p) => p.b.size[1] < 0.2 && p.b.size[0] > 1.3 && p.b.size[2] > 0.4,
    );
    const supports = pick((p) => p.b.size[1] > 0.4 && p.b.size[0] < 0.2);
    return {
      top,
      supports,
      stretcher: parts.filter((p) => !top.includes(p) && !supports.includes(p)),
    };
  }
  if (id === 'W2') {
    const plates = pick(
      (p) => p.b.size[1] < 0.4 && p.b.size[0] * p.b.size[2] > 5,
    ).sort((a, b) => a.b.bounds.min[1] - b.b.bounds.min[1]);
    return {
      floor: plates.slice(0, 1),
      roof: plates.slice(1, 2),
      uprights: parts.filter((p) => !plates.includes(p)),
    };
  }
  if (id === 'W3')
    return {
      base: pick(
        (p) => p.b.size[1] < 0.2 && p.b.size[0] > 1.2 && p.b.size[2] > 0.4,
      ),
      shaft: pick(
        (p) => p.b.size[0] > 1.3 && p.b.size[1] < 0.2 && p.b.size[2] < 0.2,
      ),
      roller: pick(
        (p) => p.b.size[0] > 0.7 && p.b.size[1] > 0.4 && p.b.size[1] < 0.7,
      ),
      bearings: pick((p) => p.b.size[0] < 0.3 && p.b.size[1] > 0.6),
    };
  if (id === 'W4')
    return {
      halo: pick((p) => p.b.size[1] > 1.5),
      plinth: pick((p) => p.b.size[1] < 0.25 && p.b.size[0] > 1.5),
      supports: pick((p) => p.b.size[0] < 0.2 && p.b.size[2] < 0.2),
    };
  return {};
}
export async function oracle(
  id: string,
  initial: Session,
  before: Session,
  after: Session,
  edit = false,
): Promise<Fact[]> {
  const fs: Fact[] = [];
  const owned: any[] = [];
  const keep = (s: any) => {
    owned.push(s);
    return s;
  };
  const check = (
    name: string,
    ok: boolean,
    expected?: unknown,
    actual?: unknown,
  ) =>
    fs.push({ name, status: ok ? 'verified' : 'incorrect', expected, actual });
  const near = (name: string, a: number, b: number, t = 0.002) =>
    check(name, Math.abs(a - b) <= t, b, a);
  const close = (name: string, a: any, b: any, t = 0.02) => {
    keep(b);
    check(
      name,
      sameSolid(a, b, t),
      { volume: b.volume(), bounds: b.boundingBox(), relativeTolerance: t },
      { volume: a.volume(), bounds: a.boundingBox() },
    );
  };
  const protectedIds = new Set(
    initial.project.volumes
      .filter((v) => v.id.startsWith('reference-'))
      .map((v) => v.id),
  );
  for (const old of initial.project.volumes.filter((v) =>
    protectedIds.has(v.id),
  ))
    check(
      `Protected object ${old.id}`,
      equalData(
        old,
        after.project.volumes.find((v) => v.id === old.id),
      ),
    );
  check(
    'Protected groups',
    initial.project
      .groups!.filter((g) => g.id === 'campaign-markers')
      .every((g) =>
        equalData(
          g,
          after.project.groups?.find((h) => h.id === g.id),
        ),
      ),
  );
  const targets = after.project.volumes.filter((v) => !protectedIds.has(v.id));
  check(
    'Unique selectable editable identities',
    targets.length > 0 &&
      new Set(after.project.volumes.map((v) => v.id)).size ===
        after.project.volumes.length &&
      targets.every((v) => !isLocked(v, after.project)),
  );
  if (edit || id === 'D-H2') {
    check(
      'Original object roster retained',
      after.project.volumes.length === before.project.volumes.length &&
        before.project.volumes.every((v) =>
          after.project.volumes.some((w) => w.id === v.id),
        ),
    );
    for (const v of before.project.volumes) {
      const n = after.project.volumes.find((w) => w.id === v.id);
      check(
        `Retain properties ${v.id}`,
        !!n &&
          equalData(
            {
              name: v.name,
              material: v.material,
              materialSpec: v.materialSpec,
              color: v.color,
              groupId: v.groupId,
              visible: v.visible,
            },
            {
              name: n?.name,
              material: n?.material,
              materialSpec: n?.materialSpec,
              color: n?.color,
              groupId: n?.groupId,
              visible: n?.visible,
            },
          ),
      );
    }
    check(
      'Assembly group metadata retained',
      equalData(before.project.groups, after.project.groups),
    );
  }
  try {
    const load = async (v: Volume): Promise<Part> => {
      const s = keep(await cloneSolid(v));
      return { v, s, b: stats(s) };
    };
    const ps = await Promise.all(targets.map(load));
    for (const p of ps)
      check(
        `Closed occupied solid ${p.v.id}`,
        p.s.status() === 'NoError' &&
          p.b.volume > 0 &&
          Math.abs(p.b.volume - p.b.triangleVolume) <
            Math.max(1e-8, p.b.volume * 0.00001),
        p.b.volume,
        p.b.triangleVolume,
      );
    if (id.startsWith('D-H1') || id === 'D-N1') {
      check('Six sample objects', ps.length === 6, 6, ps.length);
      const remaining = new Set(ps);
      for (const [i, p] of arcPoints().entries()) {
        const sorted = [...remaining].sort(
          (a, b) =>
            Math.hypot(
              a.b.center[0] - p[0],
              a.b.bounds.min[1] - p[1],
              a.b.center[2] - p[2],
            ) -
            Math.hypot(
              b.b.center[0] - p[0],
              b.b.bounds.min[1] - p[1],
              b.b.center[2] - p[2],
            ),
        );
        const a = sorted[0];
        if (!a) {
          check(`Sample ${i} exists`, false);
          continue;
        }
        remaining.delete(a);
        near(`Sample ${i} X`, a.b.center[0], p[0], 0.001);
        near(`Sample ${i} base`, a.b.bounds.min[1], p[1], 0.001);
        near(`Sample ${i} Z`, a.b.center[2], p[2], 0.001);
        close(
          `Sample ${i} circular solid`,
          a.s,
          mapSolid(vertical(0.48, 0.07), (s) => s.translate(p)),
        );
      }
      return fs;
    }
    if (id === 'D-H2') {
      check('Three pieces remain', ps.length === 3, 3, ps.length);
      const a = rad(34),
        t = [Math.cos(a), Math.sin(a)],
        c = [1.1, -0.8];
      for (const old of before.project.volumes.filter(
        (v) => !protectedIds.has(v.id),
      )) {
        const p = await load(old),
          q = ps.find((x) => x.v.id === old.id);
        if (!q) {
          check(`Piece ${old.id} survives`, false);
          continue;
        }
        const r = [p.b.center[0] - c[0], p.b.center[2] - c[1]],
          dot = r[0] * t[0] + r[1] * t[1];
        const x = c[0] + 2 * t[0] * dot - r[0],
          z = c[1] + 2 * t[1] * dot - r[1];
        near(`Reflected X ${old.id}`, q.b.center[0], x, 0.001);
        near(`Reflected Z ${old.id}`, q.b.center[2], z, 0.001);
        near(
          `Base preserved ${old.id}`,
          q.b.bounds.min[1],
          p.b.bounds.min[1],
          0.001,
        );
        close(
          `Occupied geometry only translated ${old.id}`,
          q.s,
          p.s.translate([x - p.b.center[0], 0, z - p.b.center[2]]),
          0.00001,
        );
      }
      return fs;
    }
    const count = { W1: 4, W2: 9, W3: 5, W4: 4 }[id as 'W1'];
    check(
      'Requested distinct component count',
      ps.length === count,
      count,
      ps.length,
    );
    const oldParts = edit
      ? await Promise.all(
          before.project.volumes
            .filter((v) => !protectedIds.has(v.id))
            .map(load),
        )
      : ps;
    const r = classify(id, oldParts) as Record<string, Part[]>;
    const expectedCounts: Record<string, number> =
      id === 'W1'
        ? { top: 1, supports: 2, stretcher: 1 }
        : id === 'W2'
          ? { floor: 1, roof: 1, uprights: 7 }
          : id === 'W3'
            ? { base: 1, shaft: 1, roller: 1, bearings: 2 }
            : { halo: 1, plinth: 1, supports: 2 };
    for (const [k, n] of Object.entries(expectedCounts))
      check(
        `Measured component identification: ${k}`,
        r[k]?.length === n,
        n,
        r[k]?.length,
      );
    if (Object.entries(expectedCounts).some(([k, n]) => r[k]?.length !== n))
      return fs;
    const shapeTransform = (
      old: Part,
      scale: V3 = [1, 1, 1],
      shift: V3 = [0, 0, 0],
      pivot: V3 = [0, 0, 0],
    ) => {
      const q = ps.find((x) => x.v.id === old.v.id);
      if (!q) {
        check(`Component ${old.v.id}`, false);
        return;
      }
      const ideal = mapSolid(old.s.translate(pivot.map((v) => -v) as V3), (s) =>
        mapSolid(s.scale(scale), (t) =>
          t.translate(pivot.map((v, i) => v + shift[i]) as V3),
        ),
      );
      close(`Expected occupied geometry ${old.v.id}`, q.s, ideal, 0.001);
    };
    if (edit) {
      if (id === 'W1') {
        const top = r.top[0],
          cx = top.b.center[0];
        shapeTransform(
          top,
          [(top.b.size[0] + 0.42) / top.b.size[0], 1, 1],
          [0, 0, 0],
          [cx, 0, 0],
        );
        for (const p of r.supports)
          shapeTransform(
            p,
            [1, 1, 1],
            [Math.sign(p.b.center[0] - cx) * 0.21, 0, 0],
          );
        const b = r.stretcher[0];
        shapeTransform(
          b,
          [(b.b.size[0] + 0.42) / b.b.size[0], 1, 1],
          [0, 0, 0],
          [b.b.center[0], 0, 0],
        );
      } else if (id === 'W2') {
        shapeTransform(r.floor[0], [1, 1, 1], [0, 0.38, 0]);
        shapeTransform(r.roof[0]);
        for (const p of r.uprights)
          shapeTransform(
            p,
            [1, (p.b.size[1] - 0.38) / p.b.size[1], 1],
            [0, 0, 0],
            [0, p.b.bounds.max[1], 0],
          );
      } else if (id === 'W3') {
        for (const p of [...r.base, ...r.shaft, ...r.roller])
          shapeTransform(
            p,
            [(p.b.size[0] + 0.4) / p.b.size[0], 1, 1],
            [0, 0, 0],
            [p.b.center[0], 0, 0],
          );
        for (const p of r.bearings)
          shapeTransform(
            p,
            [1, 1, 1],
            [Math.sign(p.b.center[0] - r.roller[0].b.center[0]) * 0.2, 0, 0],
          );
      } else if (id === 'W4') {
        shapeTransform(r.halo[0], [1, 1, 1], [0, 0.28, 0]);
        shapeTransform(r.plinth[0]);
        for (const p of r.supports)
          shapeTransform(
            p,
            [1, (p.b.size[1] + 0.28) / p.b.size[1], 1],
            [0, 0, 0],
            [0, p.b.bounds.min[1], 0],
          );
      }
      return fs;
    }
    if (id === 'W1') {
      close(
        'Specified top',
        r.top[0].s,
        box(1.9, 0.045, 0.58, 0, 0.795),
        0.0001,
      );
      for (const p of r.supports) {
        near('Support rests on ground', p.b.bounds.min[1], 0);
        near('Support reaches top', p.b.bounds.max[1], 0.795);
        near(
          'Specified end overhang',
          0.95 -
            Math.max(Math.abs(p.b.bounds.min[0]), Math.abs(p.b.bounds.max[0])),
          0.1,
        );
        check(
          'Slab-like side support',
          p.b.size[0] >= 0.015 &&
            p.b.size[0] <= 0.15 &&
            p.b.size[2] >= 0.3 &&
            p.b.size[2] <= 0.58,
        );
      }
      const b = r.stretcher[0];
      check(
        'Low back stretcher',
        b.b.bounds.max[1] < 0.55 && Math.abs(b.b.center[2]) >= 0.1,
      );
      for (const p of r.supports)
        near('Stretcher connects support', b.s.minGap(p.s, 2), 0);
    } else if (id === 'W2') {
      close('Floor slab', r.floor[0].s, box(3.6, 0.12, 2.8), 0.0001);
      close('Roof slab', r.roof[0].s, box(3.6, 0.15, 2.8, 0, 2.72), 0.0001);
      const posts = r.uprights.filter(
        (p) => p.b.size[0] < 0.4 && p.b.size[2] < 0.4,
      );
      const panels = r.uprights.filter((p) => !posts.includes(p));
      check('Four corner posts', posts.length === 4);
      check(
        'Two side glazing panels',
        panels.filter((p) => p.v.material === 'glass' && p.b.size[2] > 2)
          .length === 2,
      );
      check(
        'One back wall',
        panels.filter(
          (p) =>
            p.v.material !== 'glass' && p.b.size[0] > 3 && p.b.center[2] < 0,
        ).length === 1,
      );
      for (const p of r.uprights) {
        near('Upright starts at floor', p.b.bounds.min[1], 0.12);
        near('Upright meets roof', p.b.bounds.max[1], 2.72);
        check(
          'Footprint contained',
          p.b.bounds.min[0] >= -1.802 &&
            p.b.bounds.max[0] <= 1.802 &&
            p.b.bounds.min[2] >= -1.402 &&
            p.b.bounds.max[2] <= 1.402,
        );
      }
      check(
        'Posts cover all four corners',
        new Set(
          posts.map(
            (p) => `${Math.sign(p.b.center[0])},${Math.sign(p.b.center[2])}`,
          ),
        ).size === 4 &&
          posts.every(
            (p) =>
              Math.abs(p.b.center[0]) > 1.2 && Math.abs(p.b.center[2]) > 0.9,
          ),
      );
    } else if (id === 'W3') {
      close('Specified base', r.base[0].s, box(1.8, 0.12, 0.7), 0.0001);
      close('Specified shaft', r.shaft[0].s, axial(1.8, 0.05, 0, [0, 0.8, 0]));
      close(
        'Actual hollow roller and bore',
        r.roller[0].s,
        subtract(
          axial(1, 0.25, 0, [0, 0.8, 0]),
          axial(1.02, 0.07, 0, [0, 0.8, 0]),
        ),
      );
      for (const p of r.bearings) {
        const x = Math.sign(p.b.center[0]) * 0.64;
        close(
          'Bearing with actual through-hole',
          p.s,
          subtract(
            box(0.12, 1, 0.42, x, 0.12),
            axial(0.14, 0.07, 0, [x, 0.8, 0]),
          ),
        );
      }
    } else if (id === 'W4') {
      close('Elliptical occupied rim and clear opening', r.halo[0].s, halo());
      close('Specified plinth', r.plinth[0].s, box(1.8, 0.18, 0.45), 0.0001);
      for (const p of r.supports) {
        near('Support foot stays on plinth', p.b.bounds.min[1], 0.18);
        near('Support X', Math.abs(p.b.center[0]), 0.32);
        near('Support centered through depth', p.b.center[2], 0);
        near('Round support diameters', p.b.size[0], p.b.size[2]);
        close(
          'Round occupied support',
          p.s,
          mapSolid(vertical(p.b.size[1], p.b.size[0] / 2), (s) =>
            s.translate([p.b.center[0], 0.18, 0]),
          ),
        );
        near('Support meets halo', p.s.minGap(r.halo[0].s, 2), 0);
        const opening = keep(ellipse(1.236, 1.736, 0.14, 1.3));
        const intrusion = keep(p.s.intersect(opening));
        check(
          'Support remains outside opening',
          intrusion.volume() < 1e-7,
          0,
          intrusion.volume(),
        );
      }
    }
    if (id !== 'W4')
      check(
        'Assembly grouping',
        new Set(targets.map((v) => v.groupId)).size === 1 &&
          !!targets[0]?.groupId &&
          targets[0].groupId !== group.id,
      );
    return fs;
  } catch (e) {
    fs.push({
      name: 'External geometry measurement available',
      status: 'unverified',
      actual: String(e),
    });
    return fs;
  } finally {
    owned.reverse().forEach((s) => s.delete());
  }
}
