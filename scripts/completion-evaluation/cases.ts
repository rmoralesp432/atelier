// Evaluation data only. Never imported by the application or supplied as
// implementation examples or repair instructions to the model.
import { randomUUID } from 'node:crypto';
import { makeVolume, type Volume } from '../../src/model';
import { newSession, type Session } from '../../src/intelligence/engine';
import {
  booleanVolume,
  meshData,
  sharedVolume,
  solidStats,
} from '../../src/geometry/kernel';
import { equalData } from '../../src/projects/equalData';

export const order = [
  'channel',
  'widen',
  'zigzag',
  'interrupted',
  'vessel',
  'uncertain',
] as const;
export type CaseId = (typeof order)[number];
export const specification = {
  channel: {
    x: 4.4,
    z: 1.7,
    width: 3.6,
    depth: 1.4,
    base: 0.18,
    wall: 0.16,
    wallHeight: 0.95,
    ball: 0.38,
    widen: 0.7,
    raise: 0.25,
  },
  zigzag: {
    size: 0.42,
    points: [
      [-3, 0, 4],
      [-2.05, 0.2, 5.15],
      [-1.1, 0.4, 4],
      [-0.15, 0.6, 5.15],
      [0.8, 0.8, 4],
    ],
    faultZ: 0.31,
  },
  vessel: {
    x: -5,
    z: -3.4,
    diameter: 0.96,
    height: 0.66,
    wall: 0.09,
    bottom: 0.12,
  },
  uncertain: {
    x: -3.8,
    y: 0.24,
    z: -4.6,
    width: 0.84,
    depth: 0.58,
    height: 0.36,
  },
};
export const prompts: Record<CaseId, string> = {
  channel:
    'Create a four-part open channel assembly in a new group named Channel: a horizontal rectangular base 3.6 m along X, 1.4 m along Z and 18 cm thick, centered at x=4.4 m, z=1.7 m with its bottom on the ground. Put a rectangular upright wall at each X end. Each wall is 16 cm thick along X, spans the full 1.4 m depth, and rises 95 cm above the top of the base. Their outer faces are flush with the two ends of the base. Add one 38 cm diameter ball resting on the base at its center. Keep all four parts separately editable and leave every existing object and group unchanged.',
  widen:
    'Widen the Channel assembly by 70 cm along X, equally at both ends. Extend its base and move the two end walls outward so their outer faces stay flush. Keep all heights, wall thicknesses and depth unchanged. Keep the ball exactly where it is. Preserve every existing component identity and all unrelated objects.',
  zigzag:
    'Add five separate 42 cm cubes in a rising zigzag. Their base centers, in meters as (X,Y,Z), should be (-3,0,4), (-2.05,0.2,5.15), (-1.10,0.4,4), (-0.15,0.6,5.15), and (0.80,0.8,4). Keep them individually editable, with faces parallel to the world axes. Leave all existing geometry alone.',
  interrupted:
    'Increase the heights of both Channel end walls by 25 cm, keeping their bottoms, thicknesses and positions fixed. Keep the base, ball, identities and everything else unchanged.',
  vessel:
    'New task: create one hollow cylindrical vessel, open at the top, with an outside diameter of 96 cm, overall height 66 cm, 9 cm thick side walls and a 12 cm thick closed bottom. Put its bottom on the ground, centered at x=-5 m, z=-3.4 m. It must be one editable object with an actual empty cavity and no leftover cutter. Preserve everything already in the scene.',
  uncertain:
    'Create a single smooth ellipsoidal token, 84 cm along X, 58 cm along Z and 36 cm high. Center it at x=-3.8 m, z=-4.6 m with its base at y=24 cm. Give it a tranquil, welcoming character. Preserve every existing object.',
};

export function piece(
  name: string,
  shape: 'box' | 'sphere' | 'cylinder',
  width: number,
  depth: number,
  height: number,
  x: number,
  y: number,
  z: number,
): Volume {
  return {
    ...makeVolume(),
    id: randomUUID(),
    name,
    geometry: { kind: shape },
    dimensions: { width, depth, height },
    position: { x, y, z },
    rotation: 0,
  };
}
export function initialSession() {
  const a = piece('Channel wall study', 'sphere', 0.42, 0.42, 0.42, -9, 0, 4);
  const b = piece('Existing prop', 'box', 0.9, 0.6, 1.1, -8, 0.2, 3);
  const group = {
    id: randomUUID(),
    name: 'Existing props',
    visible: true,
    locked: false,
  };
  a.groupId = b.groupId = group.id;
  return newSession({ volumes: [a, b], selectedId: null, groups: [group] });
}
export function channelPieces(widened = false, raised = false) {
  const s = specification.channel,
    w = s.width + (widened ? s.widen : 0);
  return [
    piece('Channel base', 'box', w, s.depth, s.base, s.x, 0, s.z),
    ...[-1, 1].map((sign) =>
      piece(
        `Channel ${sign < 0 ? 'left' : 'right'} wall`,
        'box',
        s.wall,
        s.depth,
        s.wallHeight + (raised ? s.raise : 0),
        s.x + (sign * (w - s.wall)) / 2,
        s.base,
        s.z,
      ),
    ),
    piece('Channel ball', 'sphere', s.ball, s.ball, s.ball, s.x, s.base, s.z),
  ];
}
export async function expectedPieces(id: CaseId) {
  if (['channel', 'widen', 'interrupted'].includes(id))
    return channelPieces(id !== 'channel', id === 'interrupted');
  if (id === 'zigzag')
    return specification.zigzag.points.map(([x, y, z], i) =>
      piece(
        `Zigzag ${i + 1}`,
        'box',
        ...(Array(3).fill(specification.zigzag.size) as [
          number,
          number,
          number,
        ]),
        x,
        y,
        z,
      ),
    );
  if (id === 'uncertain') {
    const s = specification.uncertain;
    return [
      piece('Token', 'sphere', s.width, s.depth, s.height, s.x, s.y, s.z),
    ];
  }
  const s = specification.vessel;
  const outer = piece(
    'Vessel',
    'cylinder',
    s.diameter,
    s.diameter,
    s.height,
    s.x,
    0,
    s.z,
  );
  return [await booleanVolume(outer, vesselCavity(), 'subtract')];
}
export function vesselCavity() {
  const s = specification.vessel;
  return piece(
    'Cavity measurement',
    'cylinder',
    s.diameter - 2 * s.wall,
    s.diameter - 2 * s.wall,
    s.height - s.bottom,
    s.x,
    s.bottom,
    s.z,
  );
}
export async function fixture(id: CaseId, original: Session) {
  if (id === 'widen' || id === 'interrupted') {
    const s = structuredClone(original);
    for (const v of s.project.volumes.filter(
      (v) => v.groupId === channelGroup(original)?.id,
    )) {
      if (v.dimensions.height < 0.2 && id === 'widen')
        v.dimensions.width += specification.channel.widen;
      else if (v.dimensions.height > 0.8) {
        if (id === 'widen')
          v.position.x +=
            (Math.sign(v.position.x - specification.channel.x) *
              specification.channel.widen) /
            2;
        else v.dimensions.height += specification.channel.raise;
      }
    }
    return s;
  }
  const parts = await expectedPieces(id);
  const group = {
    id: randomUUID(),
    name: 'Channel',
    visible: true,
    locked: false,
  };
  if (id === 'channel') parts.forEach((v) => (v.groupId = group.id));
  return newSession({
    ...structuredClone(original.project),
    volumes: [...original.project.volumes, ...parts],
    groups: [
      ...(original.project.groups ?? []),
      ...(id === 'channel' ? [group] : []),
    ],
  });
}
function channelGroup(s: Session) {
  return s.project.groups?.find((g) => g.name === 'Channel');
}
export function targetIds(id: CaseId, original: Session, candidate: Session) {
  const before = new Set(original.project.volumes.map((v) => v.id));
  return candidate.project.volumes
    .filter((v) =>
      id === 'widen' || id === 'interrupted'
        ? v.groupId === channelGroup(original)?.id
        : !before.has(v.id),
    )
    .map((v) => v.id);
}
export type Evidence = {
  name: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
};
export const passed = (facts: Evidence[]) => facts.every((f) => f.passed);
export async function oracle(
  id: CaseId,
  original: Session,
  candidate: Session,
): Promise<Evidence[]> {
  const result: Evidence[] = [],
    add = (name: string, pass: boolean, expected?: unknown, actual?: unknown) =>
      result.push({ name, passed: pass, expected, actual });
  const ids = new Set(targetIds(id, original, candidate));
  const targets = candidate.project.volumes.filter((v) => ids.has(v.id));
  const after = new Map(candidate.project.volumes.map((v) => [v.id, v]));
  const editing = id === 'widen' || id === 'interrupted';
  const permitted = new Set(editing ? targetIds(id, original, original) : []);
  const collateral = original.project.volumes.filter(
    (v) => !permitted.has(v.id) && !equalData(v, after.get(v.id)),
  );
  add(
    'unrelated-geometry',
    !collateral.length,
    'Unchanged original objects',
    collateral.map((v) => v.id),
  );
  add(
    'unrelated-groups',
    (original.project.groups ?? []).every((g) =>
      equalData(
        g,
        candidate.project.groups?.find((n) => n.id === g.id),
      ),
    ),
    'All original group metadata preserved',
  );
  if (editing) {
    add(
      'identity',
      permitted.size === ids.size && [...permitted].every((v) => ids.has(v)),
      [...permitted],
      [...ids],
    );
    const ball = original.project.volumes.find(
      (v) =>
        permitted.has(v.id) &&
        Math.abs(v.dimensions.height - specification.channel.ball) < 0.001,
    );
    add(
      'unchanged-ball',
      !!ball &&
        equalData(ball.position, after.get(ball.id)?.position) &&
        equalData(ball.dimensions, after.get(ball.id)?.dimensions),
      'The ball retains its location and dimensions (physical shape is checked separately)',
    );
    for (const v of original.project.volumes.filter((v) =>
      permitted.has(v.id),
    )) {
      const n = after.get(v.id);
      add(
        `retained-properties-${v.id}`,
        !!n &&
          v.name === n.name &&
          v.groupId === n.groupId &&
          v.rotation === n.rotation &&
          v.color === n.color &&
          v.material === n.material &&
          equalData(v.component, n.component),
        'Identity, name, group, rotation, material, component metadata retained',
      );
    }
  }
  const expected = await expectedPieces(id);
  add(
    'count',
    targets.length === expected.length,
    expected.length,
    targets.length,
  );
  add(
    'editable',
    new Set(targets.map((v) => v.id)).size === targets.length &&
      targets.every(
        (v) =>
          !candidate.project.groups?.some(
            (g) => g.id === v.groupId && g.locked,
          ),
      ),
    'Distinct unlocked objects',
  );
  const measurements = await Promise.all(
    targets.map(async (v) => ({ v, stats: await solidStats(v) })),
  );
  const used = new Set<string>();
  for (let i = 0; i < expected.length; i++) {
    const ideal = await solidStats(expected[i]);
    const match = measurements.find(
      ({ v, stats }) =>
        !used.has(v.id) &&
        (['min', 'max'] as const).every((edge) =>
          stats.bounds[edge].every(
            (n, j) => Math.abs(n - ideal.bounds[edge][j]) <= 0.005,
          ),
        ),
    );
    add(
      `bounds-${i}`,
      !!match,
      ideal.bounds,
      match?.stats.bounds ??
        measurements.map((m) => ({ id: m.v.id, bounds: m.stats.bounds })),
    );
    if (!match) continue;
    used.add(match.v.id);
    const intersection = await sharedVolume(expected[i], match.v);
    const difference = Math.max(
      0,
      match.stats.volume + ideal.volume - 2 * intersection,
    );
    add(
      `occupied-solid-${i}`,
      match.stats.status === 'NoError' &&
        match.stats.volume > 0 &&
        difference <= Math.max(1e-6, ideal.volume * 0.015),
      { volume: ideal.volume, maxDifference: ideal.volume * 0.015 },
      {
        id: match.v.id,
        volume: match.stats.volume,
        symmetricDifference: difference,
      },
    );
  }
  if (id === 'channel') {
    const groups = new Set(targets.map((v) => v.groupId));
    const g = candidate.project.groups?.find(
      (g) => g.id === targets[0]?.groupId,
    );
    add(
      'new-editable-assembly',
      groups.size === 1 &&
        !!g &&
        g.name === 'Channel' &&
        !g.locked &&
        !original.project.groups?.some((o) => o.id === g.id),
      'Four parts in one new unlocked Channel group',
      { group: g, ids: [...groups] },
    );
  }
  if (id === 'vessel' && targets.length === 1) {
    const inside = await sharedVolume(targets[0], vesselCavity());
    add('empty-cavity', inside <= 1e-6, 0, inside);
  }
  return result;
}
export async function baked(v: Volume) {
  const mesh = await meshData(v),
    scale = [v.dimensions.width, v.dimensions.height, v.dimensions.depth];
  return {
    ...v,
    geometry: {
      kind: 'mesh' as const,
      positions: Array.from(mesh.positions, (n, i) => n / scale[i % 3]),
      indices: Array.from(mesh.indices),
      solid: true,
      source: 'Equivalent evaluated solid',
    },
  };
}
export async function controls(
  id: CaseId,
  original: Session,
  candidate: Session,
) {
  const variants: { name: string; expectedPass: boolean; session: Session }[] =
    [];
  const ids = new Set(targetIds(id, original, candidate));
  const index = candidate.project.volumes.findIndex((v) => ids.has(v.id));
  if (index < 0) return variants;
  const copy = () => structuredClone(candidate);
  let s = copy();
  s.project.volumes.splice(index, 1);
  variants.push({ name: 'missing-part', expectedPass: false, session: s });
  s = copy();
  s.project.volumes[index].position = {
    ...s.project.volumes[index].position,
    z: s.project.volumes[index].position.z + 0.23,
  };
  variants.push({ name: 'wrong-position', expectedPass: false, session: s });
  s = copy();
  s.project.volumes[index].dimensions = {
    ...s.project.volumes[index].dimensions,
    height: s.project.volumes[index].dimensions.height + 0.19,
  };
  variants.push({ name: 'wrong-size', expectedPass: false, session: s });
  s = copy();
  s.project.volumes[0].position = {
    ...s.project.volumes[0].position,
    x: s.project.volumes[0].position.x + 0.51,
  };
  variants.push({ name: 'collateral-change', expectedPass: false, session: s });
  if (id === 'widen') {
    s = copy();
    s.project.volumes[index].id = randomUUID();
    variants.push({
      name: 'replaced-identity',
      expectedPass: false,
      session: s,
    });
  }
  if (id === 'vessel') {
    s = copy();
    s.project.volumes[index].geometry = { kind: 'cylinder' };
    variants.push({ name: 'filled-cavity', expectedPass: false, session: s });
  }
  if (id !== 'widen' && id !== 'interrupted') {
    s = copy();
    for (let i = 0; i < s.project.volumes.length; i++)
      if (ids.has(s.project.volumes[i].id))
        s.project.volumes[i] = await baked(s.project.volumes[i]);
    variants.push({ name: 'equivalent-mesh', expectedPass: true, session: s });
    s = structuredClone(s);
    for (const v of s.project.volumes.filter((v) => ids.has(v.id))) {
      if (v.geometry?.kind !== 'mesh')
        throw new Error('Invalid equivalent control.');
      const p = v.geometry.positions;
      v.geometry.positions = p.map((n, i) =>
        i % 3 === 0 ? -p[i + 2] : i % 3 === 2 ? p[i - 2] : n,
      );
      v.dimensions = {
        ...v.dimensions,
        width: v.dimensions.depth,
        depth: v.dimensions.width,
      };
      v.rotation += 90;
    }
    variants.push({
      name: 'equivalent-local-frame',
      expectedPass: true,
      session: s,
    });
  }
  return variants;
}
