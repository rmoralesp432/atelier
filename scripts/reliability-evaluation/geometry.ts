/** Independent solids and transforms: no app verification predicates or agent labels. */
import { placedSolid } from './solidMatch';
import type { Session } from '../../src/intelligence/engine';
import { newSession } from '../../src/intelligence/engine';
import { isLocked } from '../../src/model';
import { equalData } from '../../src/projects/equalData';
import {
  K,
  box,
  vertical,
  mapSolid,
  asVolume,
  cloneSolid,
  stats,
  sameSolid,
} from '../phase3-evaluation/geometry';
import { seed, pass, wrong, type Fact } from '../workshop-campaign/geometry';
export { seed, pass, wrong };
export const arcPoints = () => [];
export function expectedParts(id: string) {
  const parts: any[] = [];
  const add = (solid: any) => parts.push(solid);
  if (id === 'L1') {
    const width = 4.9,
      t = 0.04,
      clear = (width - 7 * t) / 6,
      pitch = clear + t;
    for (let i = 0; i < 7; i++)
      add(box(t, 1.85, 0.4, -width / 2 + t / 2 + i * pitch));
    for (let i = 0; i < 6; i++)
      for (const top of [0.25, 0.7, 1.15, 1.6])
        add(
          box(
            clear,
            0.035,
            0.4,
            -width / 2 + t + clear / 2 + i * pitch,
            top - 0.035,
          ),
        );
  } else if (id === 'L2') {
    for (let i = 0; i < 24; i++)
      add(
        mapSolid(K.Manifold.cylinder(0.9, 0.08, 0.08, 128, true), (s) =>
          s.translate([-2.3 + i * 0.2, 0.85, 0]),
        ),
      );
    for (const z of [-0.52, 0.52]) {
      add(box(5.2, 0.2, 0.14, 0, 0.65, z));
      for (const x of [-2.4, -0.8, 0.8, 2.4])
        add(box(0.08, 0.65, 0.08, x, 0, z));
    }
  } else if (id === 'L3') {
    add(box(6, 0.18, 3.2));
    add(box(5.8, 0.16, 3, 0, 2.7));
    for (const z of [-1.2, 1.2])
      for (let i = 0; i < 5; i++)
        add(
          mapSolid(vertical(2.52, 0.06), (s) =>
            s.translate([-2.6 + i * 1.3, 0.18, z]),
          ),
        );
    for (let i = 0; i < 21; i++)
      add(box(0.08, 2.52, 0.18, -2.6 + i * 0.26, 0.18, -1.35));
  } else if (id === 'L4') {
    add(vertical(0.12, 1.6));
    for (let i = 0; i < 32; i++) {
      const a = (i * 2 * Math.PI) / 32,
        x = 1.35 * Math.cos(a),
        z = 1.35 * Math.sin(a);
      add(
        mapSolid(K.Manifold.sphere(0.09, 128), (q) => q.translate([x, 1.6, z])),
      );
      add(mapSolid(vertical(1.39, 0.03), (q) => q.translate([x, 0.12, z])));
    }
  } else throw Error('Unknown external task');
  return parts;
}
export function referenceScene(id: string) {
  const s = seed(id),
    gid = `fixture-${id}`;
  s.project.groups!.push({
    id: gid,
    name: 'Validated starting assembly',
    visible: true,
    locked: false,
  });
  s.project.volumes.push(
    ...expectedParts(id).map((solid, i) => ({
      ...asVolume(solid, `${gid}-${i}`, `Editable part ${i + 1}`),
      groupId: gid,
    })),
  );
  return s;
}
// External expectations for edits derive from the actual before solids; names do not select the parts.
function transformed(
  id: string,
  phase: string,
  s: any,
  frame = { centerX: 0, width: 4.9, panel: 0.04, centerZ: 0 },
) {
  const b = stats(s),
    [w, h, d] = b.size,
    [x, , z] = b.center,
    y = b.bounds.min[1];
  let e: any;
  if (id === 'L1' && phase === 'edit') {
    const upright = h > 1; // architecture of starting fixture, not application logic
    const pitch = (frame.width - frame.panel) / 6,
      delta = 0.9 / 6;
    const nx = frame.centerX + (x - frame.centerX) * ((pitch + delta) / pitch);
    e = mapSolid(s.translate([-x, 0, 0]), (a) =>
      mapSolid(a.scale([upright ? 1 : (w + delta) / w, 1, 1]), (q) =>
        q.translate([nx, 0, 0]),
      ),
    );
  } else if (id === 'L1')
    e = s.translate([
      0,
      h < 0.1 && Math.abs(b.bounds.max[1] - 0.7) < 0.003 ? 0.12 : 0,
      0,
    ]);
  else if (id === 'L2' && phase === 'edit') {
    const roller = d > 0.5 && w < 0.3;
    e = roller
      ? mapSolid(s.translate([0, 0, -z]), (a) =>
          mapSolid(a.scale([1, 1, (d + 0.3) / d]), (q) =>
            q.translate([0, 0, z]),
          ),
        )
      : s.translate([0, 0, Math.sign(z) * 0.15]);
  } else if (id === 'L2')
    e = y < 0.002 ? s.scale([1, (h + 0.2) / h, 1]) : s.translate([0, 0.2, 0]);
  else if (id === 'L3' && phase === 'edit')
    e =
      h < 0.3
        ? y < 0.002
          ? s.translate([0, 0, 0])
          : s.translate([0, -0.35, 0])
        : mapSolid(s.translate([0, -y, 0]), (a) =>
            mapSolid(a.scale([1, (h - 0.35) / h, 1]), (q) =>
              q.translate([0, y, 0]),
            ),
          );
  else if (id === 'L3')
    e = mapSolid(s.translate([-frame.centerX, 0, -frame.centerZ]), (a) =>
      mapSolid(a.rotate([0, -20, 0]), (q) =>
        q.translate([frame.centerX, 0, frame.centerZ]),
      ),
    );
  else if (id === 'L4') {
    const plinth = w > 3,
      ball = w > 0.1;
    e = plinth
      ? s.translate([0, 0, 0])
      : phase === 'edit'
        ? ball
          ? s.translate([0, 0.2, 0])
          : mapSolid(s.translate([0, -y, 0]), (a) =>
              mapSolid(a.scale([1, (h + 0.2) / h, 1]), (q) =>
                q.translate([0, y, 0]),
              ),
            )
        : ball
          ? mapSolid(s.translate([-x, -b.center[1], -z]), (a) =>
              mapSolid(
                a.scale([(w + 0.06) / w, (h + 0.06) / h, (d + 0.06) / d]),
                (q) => q.translate([x, b.center[1], z]),
              ),
            )
          : mapSolid(s.translate([0, -y, 0]), (a) =>
              mapSolid(a.scale([1, (h - 0.03) / h, 1]), (q) =>
                q.translate([0, y, 0]),
              ),
            );
  } else throw Error('Unknown external edit');
  return e;
}
async function startingFrame(before: Session) {
  const bs = [];
  for (const v of before.project.volumes.filter(
    (v) => !v.id.startsWith('reference-'),
  )) {
    const s = await cloneSolid(v);
    try {
      bs.push(stats(s));
    } finally {
      s.delete();
    }
  }
  const lo = Math.min(...bs.map((b) => b.bounds.min[0])),
    hi = Math.max(...bs.map((b) => b.bounds.max[0]));
  const zlo = Math.min(...bs.map((b) => b.bounds.min[2])),
    zhi = Math.max(...bs.map((b) => b.bounds.max[2]));
  const panels = bs.filter((b) => b.size[1] > 1 && b.size[0] < 0.1);
  return {
    centerX: (lo + hi) / 2,
    width: hi - lo,
    panel: panels.length
      ? panels.reduce((n, b) => n + b.size[0], 0) / panels.length
      : 0.04,
    centerZ: (zlo + zhi) / 2,
  };
}
export async function oracle(
  id: string,
  initial: Session,
  before: Session,
  after: Session,
  edit = false,
  phase = edit ? 'edit' : 'create',
): Promise<Fact[]> {
  const facts: Fact[] = [];
  const check = (
    name: string,
    ok: boolean,
    expected?: unknown,
    actual?: unknown,
  ) =>
    facts.push({
      name,
      status: ok ? 'verified' : 'incorrect',
      expected,
      actual,
    });
  const protectedIds = new Set(initial.project.volumes.map((v) => v.id));
  const targets = after.project.volumes.filter((v) => !protectedIds.has(v.id));
  for (const v of initial.project.volumes)
    check(
      `Preserve unrelated ${v.id}`,
      equalData(
        v,
        after.project.volumes.find((o) => o.id === v.id),
      ),
    );
  for (const g of initial.project.groups ?? [])
    check(
      `Preserve unrelated group ${g.id}`,
      equalData(
        g,
        after.project.groups?.find((o) => o.id === g.id),
      ),
    );
  check(
    'Expected component count',
    targets.length === ({ L1: 31, L2: 34, L3: 33, L4: 65 } as any)[id],
    ({ L1: 31, L2: 34, L3: 33, L4: 65 } as any)[id],
    targets.length,
  );
  check(
    'Independent unlocked identities',
    new Set(after.project.volumes.map((v) => v.id)).size ===
      after.project.volumes.length &&
      targets.every((v) => !isLocked(v, after.project)),
  );
  check(
    'Assembly grouping',
    targets.length > 0 &&
      targets.every(
        (v) =>
          v.groupId && after.project.groups?.some((g) => g.id === v.groupId),
      ) &&
      new Set(targets.map((v) => v.groupId)).size === 1,
  );
  if (edit) {
    check(
      'Preserve original component roster',
      before.project.volumes.length === after.project.volumes.length &&
        before.project.volumes.every((v) =>
          after.project.volumes.some((o) => o.id === v.id),
        ),
    );
    check(
      'Preserve group identities',
      equalData(before.project.groups, after.project.groups),
    );
  }
  const frame = edit ? await startingFrame(before) : undefined;
  const held: any[] = [];
  const keep = (s: any) => {
    held.push(s);
    return s;
  };
  try {
    const actual = await Promise.all(
      targets.map(async (v) => {
        const s = keep(await cloneSolid(v));
        const b = stats(s);
        check(
          `Closed occupied solid ${v.id}`,
          s.status() === 'NoError' &&
            b.volume > 0 &&
            Math.abs(b.volume - b.triangleVolume) <=
              Math.max(1e-7, b.volume * 0.0001),
          b.volume,
          b.triangleVolume,
        );
        return { v, s, b };
      }),
    );
    if (!edit) {
      const expected = expectedParts(id).map(keep),
        remaining = new Set(actual);
      for (const [i, e] of expected.entries()) {
        const b = stats(e);
        const ranked = [...remaining].sort(
          (a, c) =>
            Math.hypot(
              ...a.b.center.map((x: number, j: number) => x - b.center[j]),
            ) -
            Math.hypot(
              ...c.b.center.map((x: number, j: number) => x - b.center[j]),
            ),
        );
        const match = ranked.find((a) => placedSolid(a.s, e, 0.02, 0.002));
        check(
          `Expected occupied component ${i + 1}`,
          !!match,
          { bounds: b.bounds, volume: b.volume },
          match
            ? { id: match.v.id, bounds: match.b.bounds, volume: match.b.volume }
            : ranked.slice(0, 2).map((a) => ({
                id: a.v.id,
                bounds: a.b.bounds,
                volume: a.b.volume,
              })),
        );
        if (match) remaining.delete(match);
      }
    } else {
      for (const v of before.project.volumes.filter(
        (v) => !protectedIds.has(v.id),
      )) {
        const s = keep(await cloneSolid(v)),
          expected = keep(transformed(id, phase, s, frame)),
          a = actual.find((a) => a.v.id === v.id);
        const b = stats(expected);
        check(
          `Connected edit of original ${v.id}`,
          !!a && placedSolid(a.s, expected, 0.02, 0.002),
          { bounds: b.bounds, volume: b.volume },
          a ? { bounds: a.b.bounds, volume: a.b.volume } : null,
        );
        const shouldStay = sameSolid(s, expected, 1e-7, 1e-7);
        if (shouldStay)
          check(`Unchanged assembly part ${v.id}`, equalData(v, a?.v));
        if (a)
          check(
            `Preserve material and membership ${v.id}`,
            equalData(
              [v.material, v.materialSpec, v.color, v.groupId],
              [a.v.material, a.v.materialSpec, a.v.color, a.v.groupId],
            ),
          );
      }
    }
  } catch (e) {
    facts.push({
      name: 'External solid measurement available',
      status: 'unverified',
      actual: String(e),
    });
  } finally {
    held.forEach((s) => s.delete());
  }
  return facts;
}
export async function editedFixture(
  id: string,
  before: Session,
  phase = 'edit',
) {
  const after = structuredClone(before),
    frame = await startingFrame(before);
  for (let i = 0; i < after.project.volumes.length; i++) {
    const v = before.project.volumes[i];
    if (v.id.startsWith('reference-')) continue;
    const s = await cloneSolid(v);
    try {
      const expected = transformed(id, phase, s, frame);
      if (sameSolid(s, expected, 1e-7, 1e-7)) {
        expected.delete();
        continue;
      }
      after.project.volumes[i] = {
        ...asVolume(expected, v.id, v.name),
        groupId: v.groupId,
        material: v.material,
        materialSpec: v.materialSpec,
        color: v.color,
      };
    } finally {
      s.delete();
    }
  }
  return after;
}
