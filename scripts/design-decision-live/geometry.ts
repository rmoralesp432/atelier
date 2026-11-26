/** External numerical oracle. No expectations are sent to the modeling provider. */
import type { Session } from '../../src/intelligence/engine';
import { isLocked } from '../../src/model';
import { equalData } from '../../src/projects/equalData';
import {
  cloneSolid,
  stats,
  vertical,
  mapSolid,
  sameSolid,
  frame,
  worldToLocal,
} from '../phase3-evaluation/geometry';
export type Binding = {
  turntable: string;
  light: string;
  cube: string;
  puck?: string;
  frame: string[];
};
export async function inventory(s: Session) {
  const rows: any[] = [];
  for (const v of s.project.volumes) {
    const q = await cloneSolid(v);
    try {
      const oriented = worldToLocal(q, frame(q));
      const orientedPlanSize = stats(oriented).size;
      oriented.delete();
      rows.push({
        orientedPlanSize,
        id: v.id,
        name: v.name,
        groupId: v.groupId,
        ...stats(q),
        editable: !isLocked(v, s.project.groups ?? []),
      });
    } finally {
      q.delete();
    }
  }
  return rows;
}
export function bind(rows: any[]): Binding {
  const choose = (name: string, test: (r: any) => boolean, words: RegExp) => {
    const matches = rows.filter(test),
      named = matches.filter((r) => words.test(r.name));
    if (named.length === 1) return named[0].id;
    if (matches.length === 1) return matches[0].id;
    throw Error(
      `Unverified role binding for ${name}: ${matches.map((r) => r.name).join(', ')}`,
    );
  };
  const turntable = choose(
    'turntable',
    (r) =>
      r.size[0] > 0.3 &&
      r.size[2] > 0.3 &&
      r.size[1] < 0.5 &&
      r.bounds.max[1] < 0.5,
    /turntable|rotating|rotary|disc|disk/i,
  );
  const light = choose(
    'light panel',
    (r) =>
      r.size[0] > 0.15 &&
      r.size[2] > 0.15 &&
      r.size[1] < 0.15 &&
      r.bounds.min[1] > 0.3,
    /light|led|diffus|panel/i,
  );
  const cube = choose(
    'storage cube',
    (r) => r.orientedPlanSize.every((n: number) => Math.abs(n - 0.4) < 0.01),
    /storage|cube/i,
  );
  return {
    turntable,
    light,
    cube,
    frame: rows
      .filter((r) => ![turntable, cube].includes(r.id))
      .map((r) => r.id),
  };
}
export async function oracle(
  turn: number,
  before: Session,
  after: Session,
  b: Binding,
  camera: any = {},
) {
  const rows = await inventory(after),
    prev = await inventory(before),
    by = (id: string) => rows.find((r) => r.id === id),
    old = (id: string) => prev.find((r) => r.id === id),
    facts: any[] = [];
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
  const near = (name: string, a: number, e: number, t = 0.001) =>
    check(name, Math.abs(a - e) <= t, e, a);
  const t = by(b.turntable),
    l = by(b.light),
    c = by(b.cube);
  if (!t || !l || !c)
    throw Error('Previously bound component identity missing');
  const top = turn >= 14 ? 0.42 : turn >= 12 ? 0.35 : 0.24,
    gap = turn >= 13 ? 0.18 : 0.32;
  near('Turntable diameter X', t.size[0], 0.7);
  near('Turntable diameter Z', t.size[2], 0.7);
  near('Turntable top', t.bounds.max[1], top);
  near('Sample-loading clearance', l.bounds.min[1] - t.bounds.max[1], gap);
  near('Light underside', l.bounds.min[1], top + gap);
  near('Light centered X', l.center[0], t.center[0]);
  near('Light centered Z', l.center[2], t.center[2]);
  const actual = await cloneSolid(
    after.project.volumes.find((v) => v.id === b.turntable)!,
  );
  const reference = mapSolid(vertical(t.size[1], 0.35), (q) =>
    q.translate([t.center[0], t.bounds.min[1], t.center[2]]),
  );
  try {
    facts.push({
      name: 'Circular occupied turntable solid',
      status: sameSolid(actual, reference, 0.02, 0.001)
        ? 'verified'
        : 'unverified',
      expected:
        'Circular cylindrical platform, allowing tessellation; alternative cutout construction requires visual assessment',
      actual: { volume: t.volume },
    });
  } finally {
    actual.delete();
    reference.delete();
  }
  const sides = [c.orientedPlanSize[0], c.orientedPlanSize[2]].sort(
    (a, b) => a - b,
  );
  const expectedSides = [turn >= 3 ? 0.55 : 0.4, turn >= 4 ? 0.45 : 0.4].sort(
    (a, b) => a - b,
  );
  near(
    'Storage cube first horizontal side (rotation invariant)',
    sides[0],
    expectedSides[0],
  );
  near(
    'Storage cube second horizontal side (rotation invariant)',
    sides[1],
    expectedSides[1],
  );
  near(
    'Storage cube height',
    c.size[1],
    turn >= 10 ? 0.6 : turn >= 2 ? 0.5 : 0.4,
  );

  near('Storage cube remains grounded', c.bounds.min[1], 0);
  if (turn === 1) {
    near(
      'Storage separation',
      Math.hypot(c.center[0] - t.center[0], c.center[2] - t.center[2]),
      2,
    );
    check('Storage lies to the left', c.center[0] < t.center[0]);
  }
  if (turn >= 6) {
    if (!b.puck) {
      const fresh = rows.filter(
        (r) => !before.project.volumes.some((v) => v.id === r.id),
      );
      if (fresh.length !== 1) throw Error('Unverified new sample-puck binding');
      b.puck = fresh[0].id;
    }
    const p = by(b.puck);
    if (!p) throw Error('Puck identity missing');
    near('Puck diameter X', p.size[0], turn >= 8 ? 0.16 : 0.12);
    near('Puck diameter Z', p.size[2], turn >= 8 ? 0.16 : 0.12);
    near(
      'Puck thickness',
      p.size[1],
      turn >= 11 ? 0.04 : turn >= 7 ? 0.05 : 0.03,
    );
    near('Puck grounded', p.bounds.min[1], 0);
  }
  if (turn > 1) {
    for (const v of before.project.volumes)
      check(
        `${v.name}: identity retained`,
        after.project.volumes.some((n) => n.id === v.id),
      );
    const changed =
      turn <= 5 || turn === 10
        ? [b.cube]
        : turn <= 11
          ? [b.puck]
          : turn === 13
            ? b.frame
            : [
                ...before.project.volumes
                  .filter((v) => ![b.cube, b.puck].includes(v.id))
                  .map((v) => v.id),
              ];
    for (const v of before.project.volumes)
      if (!changed.includes(v.id))
        check(
          `${v.name}: unrelated data preserved`,
          equalData(
            v,
            after.project.volumes.find((n) => n.id === v.id),
          ),
        );
    if ([12, 14].includes(turn)) {
      near(
        'Turntable horizontal center X preserved',
        t.center[0],
        old(b.turntable).center[0],
      );
      near(
        'Turntable horizontal center Z preserved',
        t.center[2],
        old(b.turntable).center[2],
      );
    }
    for (const [n, id, d, kind] of [
      [5, b.cube, 0.2, 'left'],
      [9, b.puck, 0.15, 'forward'],
    ] as const)
      if (turn === n) {
        const v = by(id!),
          o = old(id!),
          dx = v.center[0] - o.center[0],
          dz = v.center[2] - o.center[2];
        near('Requested horizontal move distance', Math.hypot(dx, dz), d);
        near('Move preserves base', v.bounds.min[1], o.bounds.min[1]);
        const basis = kind === 'left' ? camera.right : camera.forward;
        const dot = basis ? dx * basis.x + dz * basis.z : 0;
        check(
          'Requested relative direction',
          kind === 'left' ? dx < 0 || dot < 0 : dz < 0 || dot > 0,
          { accepted: 'World or supplied camera-relative convention' },
          [dx, dz],
        );
      }
  }
  for (const r of rows) {
    check(`${r.name}: editable`, r.editable);
    check(`${r.name}: occupied solid`, r.volume > 0);
  }
  // Grounded connectivity of the independent light frame, allowing added feet/brackets.
  const frame = rows.filter(
      (r) => r.id !== b.cube && r.id !== b.puck && r.id !== b.turntable,
    ),
    solids = new Map<string, any>(),
    edges: any[] = [];
  try {
    for (const r of frame)
      solids.set(
        r.id,
        await cloneSolid(after.project.volumes.find((v) => v.id === r.id)!),
      );
    for (let i = 0; i < frame.length; i++)
      for (let j = i + 1; j < frame.length; j++) {
        const distance = solids
          .get(frame[i].id)
          .minGap(solids.get(frame[j].id), 0.01);
        if (distance <= 0.001) edges.push([frame[i].id, frame[j].id, distance]);
      }
    const reachable = new Set([b.light]);
    let count = -1;
    while (count !== reachable.size) {
      count = reachable.size;
      for (const [a, z] of edges) {
        if (reachable.has(a)) reachable.add(z);
        if (reachable.has(z)) reachable.add(a);
      }
    }
    const grounded = frame.filter(
      (r) => Math.abs(r.bounds.min[1]) <= 0.001 && reachable.has(r.id),
    );
    check(
      'Light frame has a connected path to its base',
      grounded.length > 0,
      'At least one actual solid contact path to Y=0',
      { grounded: grounded.map((r) => r.id), edges },
    );
    const posts = frame.filter(
      (r) =>
        r.size[1] > 2 * Math.max(r.size[0], r.size[2]) && reachable.has(r.id),
    );
    facts.push({
      name: 'Two supporting posts',
      status: posts.length >= 2 ? 'verified' : 'unverified',
      actual: posts.map((r) => r.id),
      expected:
        'Two independent upright supports; multipart/nonrectilinear alternatives require visual review',
    });
  } finally {
    for (const q of solids.values()) q.delete();
  }
  return {
    facts,
    solids: rows,
    binding: structuredClone(b),
    correct: !facts.some((f) => f.status === 'incorrect'),
    fullyMeasured: facts.every((f) => f.status === 'verified'),
  };
}
