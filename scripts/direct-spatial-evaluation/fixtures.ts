/** Evaluation fixtures only. Never imported by either application. */
import { createHash } from 'node:crypto';
import { makeVolume, type Volume, isLocked } from '../../src/model';
import {
  newSession,
  type Session,
  applyPlan,
} from '../../src/intelligence/engine';
import { equalData } from '../../src/projects/equalData';
import {
  K,
  asVolume,
  cloneSolid,
  stats,
  box,
  vertical,
  mapSolid,
} from '../phase3-evaluation/geometry';
import { placedSolid } from '../reliability-evaluation/solidMatch';

export const tasks = {
  A: {
    prompt:
      'Raise the canopy by 28 cm, keeping the pendants where they are. Adjust their existing suspensions so the connections are maintained. Keep the same pieces and leave the two objects beside it alone.',
    history: [
      {
        role: 'user',
        content:
          'This project contains a suspended kinetic assembly with a canopy, individual suspensions and ellipsoidal pendants. There are two separate sample objects beside it.',
      },
    ],
  },
  B: {
    prompt:
      'Open the gap between the yokes by 46 cm, equally on both sides. Take their shields and adjustment knobs with them, keeping the existing offsets. Keep the base and the two sample objects where they are.',
    history: [
      {
        role: 'user',
        content:
          'This project contains an adjustable jig: two opposing yokes, their protective shields and adjustment knobs, on a fixed base. Two sample objects stand nearby.',
      },
    ],
  },
} as const;
export type Task = keyof typeof tasks;
export const id = (name: string) =>
  createHash('sha256')
    .update(`direct-spatial-fixture-v1:${name}`)
    .digest('hex')
    .slice(0, 32);
const part = (
  name: string,
  kind: 'box' | 'sphere' | 'cylinder',
  size: number[],
  at: number[],
  group: string,
  color: string,
): Volume => ({
  ...makeVolume(),
  id: id(name),
  name,
  groupId: group,
  geometry: { kind },
  dimensions: { width: size[0], height: size[1], depth: size[2] },
  position: { x: at[0], y: at[1], z: at[2] },
  rotation: 0,
  color,
  material: 'solid',
  component: {
    role: 'element',
    hostId: null,
    level: null,
    motion: 'none',
    travel: 0,
  },
});
export function fixture(task: Task) {
  const group = id(`Assembly ${task}`),
    sampleGroup = id(`Samples ${task}`);
  const volumes: Volume[] = [
    part(
      'Sample A',
      'box',
      [0.28, 0.42, 0.25],
      [-2.6, 0, -1.4],
      sampleGroup,
      '#b1c2c9',
    ),
    part(
      'Sample B',
      'sphere',
      [0.32, 0.32, 0.32],
      [2.6, 0, 1.3],
      sampleGroup,
      '#b8ac96',
    ),
  ];
  const relations: { dependent: string; partner: string; fixed?: string }[] =
    [];
  const moves: Record<
    string,
    { axis: 'x' | 'y'; delta: number; extend?: boolean }
  > = {};
  if (task === 'A') {
    const canopy = part(
      'Canopy',
      'box',
      [3.35, 0.12, 2.4],
      [0, 2.75, 0],
      group,
      '#d6d3cb',
    );
    volumes.push(canopy);
    moves[canopy.id] = { axis: 'y', delta: 0.28 };
    const points = [
      [-1.2, -0.7, 0.92],
      [-0.62, -0.5, 1.13],
      [0.2, -0.85, 0.85],
      [1, -0.42, 1.3],
      [-1, 0.65, 1.05],
      [-0.25, 0.35, 0.8],
      [0.55, 0.72, 1.21],
      [1.25, 0.55, 0.98],
    ];
    for (const [i, [x, z, y]] of points.entries()) {
      const h = [0.26, 0.32, 0.24, 0.3, 0.28, 0.34, 0.22, 0.27][i];
      const pendant = part(
        `Pendant ${i + 1}`,
        'sphere',
        [0.22 + i * 0.006, h, 0.18 + i * 0.004],
        [x, y - h / 2, z],
        group,
        '#b19b70',
      );
      const rod = part(
        `Suspension ${i + 1}`,
        'cylinder',
        [0.018, 2.75 - (y + h / 2), 0.018],
        [x, y + h / 2, z],
        group,
        '#6e7477',
      );
      volumes.push(pendant, rod);
      relations.push({
        dependent: rod.id,
        partner: canopy.id,
        fixed: pendant.id,
      });
      moves[rod.id] = { axis: 'y', delta: 0.28, extend: true };
    }
  } else {
    volumes.push(
      part('Fixed base', 'box', [3.6, 0.12, 1.6], [0, 0, 0], group, '#999b9b'),
    );
    for (const [i, side] of [-1, 1].entries()) {
      const yoke = part(
        `Yoke ${i + 1}`,
        'box',
        [0.18, 0.92, 0.8],
        [side * 0.72, 0.12, 0],
        group,
        '#6d8490',
      );
      volumes.push(yoke);
      moves[yoke.id] = { axis: 'x', delta: side * 0.23 };
      const outer = vertical(0.7, 0.38),
        inner = vertical(0.7, 0.31);
      const tube = outer.subtract(inner);
      outer.delete();
      inner.delete();
      const cut = box(0.4, 0.9, 0.9, 0.2, -0.1, 0),
        half = tube.intersect(cut);
      tube.delete();
      cut.delete();
      const shield = asVolume(
        mapSolid(half, (s) =>
          mapSolid(s.rotate([0, i === 0 ? 180 : 0, 0]), (q) =>
            q.translate([side * 1.02, 0.28, 0.045]),
          ),
        ),
        id(`Shield ${i + 1}`),
        `Shield ${i + 1}`,
      );
      shield.groupId = group;
      shield.material = 'solid';
      shield.color = '#a2b0b5';
      volumes.push(shield);
      moves[shield.id] = { axis: 'x', delta: side * 0.23 };
      relations.push({ dependent: shield.id, partner: yoke.id });
      for (let j = 0; j < 3; j++) {
        const knob = part(
          `Adjustment knob ${i * 3 + j + 1}`,
          'sphere',
          [0.14, 0.11, 0.12],
          [
            side * (0.82 + j * 0.02),
            [0.34, 0.62, 0.87][j],
            [-0.21, 0.13, -0.08][j],
          ],
          group,
          '#b29c73',
        );
        volumes.push(knob);
        moves[knob.id] = { axis: 'x', delta: side * 0.23 };
        relations.push({ dependent: knob.id, partner: yoke.id });
      }
    }
  }
  const session = newSession({
    volumes,
    selectedId: null,
    groups: [
      {
        id: group,
        name: task === 'A' ? 'Kinetic assembly' : 'Adjustable jig',
        visible: true,
        locked: false,
      },
      {
        id: sampleGroup,
        name: 'Unrelated samples',
        visible: true,
        locked: false,
      },
    ],
  });
  return { session, moves, relations };
}
export function referenceOperations(task: Task) {
  return [
    {
      type: 'edit_components',
      edits: Object.entries(fixture(task).moves).map(([target, m]) => ({
        targets: [target],
        where: [],
        translation: m.extend
          ? null
          : {
              x: m.axis === 'x' ? m.delta : 0,
              y: m.axis === 'y' ? m.delta : 0,
              z: 0,
            },
        resize: m.extend
          ? { axis: 'height', mode: 'add', value: m.delta, anchor: 0 }
          : null,
      })),
    },
  ];
}
export function negativeOperation(task: Task) {
  return {
    type: 'edit_components',
    edits: [
      {
        targets: [id(task === 'A' ? 'Suspension 3' : 'Adjustment knob 2')],
        where: [],
        translation: task === 'B' ? { x: -0.02, y: 0, z: 0 } : null,
        resize:
          task === 'A'
            ? { axis: 'height', mode: 'add', value: -0.015, anchor: 0 }
            : null,
      },
    ],
  };
}
export const plan = (operations: any[]) => ({
  intent: 'apply',
  message: 'Offline calibration',
  brief: null,
  planning: { stage: 'Offline calibration', assumptions: [], next: null },
  operations,
});
export async function reference(task: Task, before: Session) {
  return (
    await applyPlan(before, plan(referenceOperations(task)), undefined, true)
  ).session;
}
export const pass = (facts: any[]) =>
  facts.length > 0 && facts.every((f) => f.status === 'verified');

/** Numerical oracle, separate from host completion predicates. Expected solids
 * come from original solids + user delta; candidate is only a measurement. */
export async function oracle(
  task: Task,
  before: Session,
  candidate: Session,
  edited = true,
) {
  const { moves, relations } = fixture(task),
    facts: any[] = [];
  const check = (name: string, ok: boolean, expected?: any, actual?: any) =>
    facts.push({
      name,
      status: ok ? 'verified' : 'incorrect',
      expected,
      actual,
    });
  check(
    'Original ID roster',
    equalData(
      before.project.volumes.map((v) => v.id).sort(),
      candidate.project.volumes.map((v) => v.id).sort(),
    ),
  );
  check(
    'Groups preserved',
    equalData(before.project.groups, candidate.project.groups),
  );
  const solids = new Map<string, any>(),
    oldSolids = new Map<string, any>();
  try {
    for (const v of before.project.volumes) {
      const next = candidate.project.volumes.find((p) => p.id === v.id),
        move = edited ? moves[v.id] : undefined;
      if (!next) {
        check(`Identity ${v.id}`, false);
        continue;
      }
      check(`Editable ${v.id}`, !isLocked(next, candidate.project));
      if (!move) check(`Preserve fixed ${v.id}`, equalData(v, next));
      const old = await cloneSolid(v),
        actual = await cloneSolid(next);
      oldSolids.set(v.id, old);
      solids.set(v.id, actual);
      const b = stats(old),
        a = stats(actual);
      check(
        `Closed solid ${v.id}`,
        actual.status() === 'NoError' &&
          a.volume > 0 &&
          Math.abs(a.volume - a.triangleVolume) <=
            Math.max(1e-8, a.volume * 0.0001),
      );
      const expected = move?.extend
        ? mapSolid(old.translate([0, -b.bounds.min[1], 0]), (s) =>
            mapSolid(
              s.scale([1, (b.size[1] + move.delta) / b.size[1], 1]),
              (q) => q.translate([0, b.bounds.min[1], 0]),
            ),
          )
        : old.translate([
            move?.axis === 'x' ? move.delta : 0,
            move?.axis === 'y' ? move.delta : 0,
            0,
          ]);
      try {
        const e = stats(expected);
        check(
          `Requested occupied solid ${v.id}`,
          placedSolid(actual, expected, 0.02, 0.001),
          { bounds: e.bounds, volume: e.volume },
          { bounds: a.bounds, volume: a.volume },
        );
      } finally {
        expected.delete();
      }
    }
    for (const r of relations) {
      if (!solids.has(r.dependent) || !solids.has(r.partner)) continue;
      const a = stats(solids.get(r.dependent)),
        b = stats(solids.get(r.partner));
      const oa = stats(oldSolids.get(r.dependent)),
        ob = stats(oldSolids.get(r.partner));
      if (task === 'A') {
        check(
          `Upper connection ${r.dependent}`,
          Math.abs(b.bounds.min[1] - a.bounds.max[1]) <= 0.001,
          0,
          b.bounds.min[1] - a.bounds.max[1],
        );
        const p = stats(solids.get(r.fixed!));
        check(
          `Lower connection ${r.dependent}`,
          Math.abs(a.bounds.min[1] - p.bounds.max[1]) <= 0.001,
          0,
          a.bounds.min[1] - p.bounds.max[1],
        );
        // True surface distance, independently using occupied solids.
        check(
          `Upper surface contact ${r.dependent}`,
          solids.get(r.dependent).minGap(solids.get(r.partner), 0.05) <= 0.001,
        );
        check(
          `Lower surface contact ${r.dependent}`,
          solids.get(r.dependent).minGap(solids.get(r.fixed!), 0.05) <= 0.001,
        );
      } else {
        const want = oa.center.map((x: number, i: number) => x - ob.center[i]),
          got = a.center.map((x: number, i: number) => x - b.center[i]);
        check(
          `Original paired XYZ offset ${r.dependent}`,
          want.every((x: number, i: number) => Math.abs(x - got[i]) <= 0.001),
          want,
          got,
        );
      }
    }
    if (task === 'B') {
      const a = stats(solids.get(id('Yoke 1'))),
        b = stats(solids.get(id('Yoke 2')));
      const oa = stats(oldSolids.get(id('Yoke 1'))),
        ob = stats(oldSolids.get(id('Yoke 2')));
      const want = ob.bounds.min[0] - oa.bounds.max[0] + (edited ? 0.46 : 0),
        got = b.bounds.min[0] - a.bounds.max[0];
      check('Requested yoke opening', Math.abs(want - got) <= 0.001, want, got);
      check(
        'Symmetric opening midpoint',
        Math.abs(a.center[0] + b.center[0] - (oa.center[0] + ob.center[0])) <=
          0.002,
      );
    }
  } catch (e) {
    facts.push({
      name: 'External measurement available',
      status: 'unverified',
      actual: String(e),
    });
  } finally {
    for (const s of [...solids.values(), ...oldSolids.values()]) s.delete();
  }
  return facts;
}
