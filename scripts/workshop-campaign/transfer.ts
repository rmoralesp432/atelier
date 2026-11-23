/** Fresh transfer cases, external to the frozen applications and earlier scoring. */
import { seed, pass, wrong, type Fact } from './geometry';
import {
  K,
  box,
  vertical,
  mapSolid,
  asVolume,
  cloneSolid,
  stats,
  sameSolid,
  rad,
} from '../phase3-evaluation/geometry';
import { equalData } from '../../src/projects/equalData';
import { isLocked } from '../../src/model';
export const wedge = (a: number, b: number, ha: number, hb: number, d = 1.2) =>
  K.Manifold.hull([
    ...[a, b].flatMap((x) => [-d / 2, d / 2].map((z) => [x, 0, z])),
    ...[[-d / 2], [d / 2]].flatMap(([z]) => [
      [a, ha, z],
      [b, hb, z],
    ]),
  ]);
export function fixture(id: string, edited = false) {
  const s = seed(id),
    h = edited ? 1.05 : 0.82;
  const add = (solid: any, name: string) => {
    const v = asVolume(
      solid,
      `transfer-${id}-${s.project.volumes.length - 2}`,
      name,
    );
    v.groupId = `transfer-${id}`;
    s.project.volumes.push(v);
  };
  if (id === 'W5') {
    add(
      mapSolid(box(1.45, 0.06, 0.72, 0, h), (s) => s.rotate([0, -31, 0])),
      'Workbench top',
    );
    for (const x of [-0.55, 0.55])
      for (const z of [-0.24, 0.24])
        add(
          mapSolid(vertical(h, 0.05, 0.03), (s) =>
            mapSolid(s.translate([x, 0, z]), (t) => t.rotate([0, -31, 0])),
          ),
          'Tapered leg',
        );
  } else {
    for (const [x, y] of [
      [-2, 0.25],
      [0, edited ? 0.73 : 0.55],
      [2, 0.85],
    ])
      add(box(0.8, y, 1.2, x, 0), 'Platform');
    add(wedge(-1.6, -0.4, 0.25, edited ? 0.73 : 0.55), 'Left ramp');
    add(wedge(0.4, 1.6, edited ? 0.73 : 0.55, 0.85), 'Right ramp');
  }
  s.project.groups!.push({
    id: `transfer-${id}`,
    name: `${id} assembly`,
    visible: true,
    locked: false,
  });
  return s;
}
export async function oracle(
  id: string,
  initial: any,
  before: any,
  after: any,
  edit = false,
): Promise<Fact[]> {
  const facts: Fact[] = [],
    owned: any[] = [];
  const keep = (s: any) => {
    owned.push(s);
    return s;
  };
  const check = (name: string, ok: boolean, expected?: any, actual?: any) =>
    facts.push({
      name,
      status: ok ? 'verified' : 'incorrect',
      expected,
      actual,
    });
  const near = (name: string, a: number, b: number) =>
    check(name, Math.abs(a - b) <= 0.002, b, a);
  const close = (name: string, a: any, b: any, t = 0.001) => {
    keep(b);
    check(
      name,
      sameSolid(a, b, t),
      { bounds: b.boundingBox(), volume: b.volume(), relativeTolerance: t },
      { bounds: a.boundingBox(), volume: a.volume() },
    );
  };
  const target = (s: any) =>
    s.project.volumes.filter((v: any) => !v.id.startsWith('reference-'));
  try {
    for (const p of initial.project.volumes.filter((v: any) =>
      v.id.startsWith('reference-'),
    ))
      check(
        'Unrelated ' + p.id,
        equalData(
          p,
          after.project.volumes.find((v: any) => v.id === p.id),
        ),
      );
    check(
      'Unrelated group',
      equalData(
        initial.project.groups[0],
        after.project.groups.find((g: any) => g.id === 'campaign-markers'),
      ),
    );
    check(
      'Five editable parts',
      target(after).length === 5 &&
        target(after).every((v: any) => !isLocked(v, after.project)),
      5,
      target(after).length,
    );
    check(
      'Distinct identities',
      new Set(after.project.volumes.map((v: any) => v.id)).size ===
        after.project.volumes.length,
    );
    if (edit) {
      check(
        'Same identity roster',
        before.project.volumes.length === after.project.volumes.length &&
          before.project.volumes.every((v: any) =>
            after.project.volumes.some((w: any) => w.id === v.id),
          ),
      );
      check(
        'Groups preserved',
        equalData(before.project.groups, after.project.groups),
      );
      for (const v of before.project.volumes) {
        const n = after.project.volumes.find((w: any) => w.id === v.id);
        const props = (p: any) =>
          p && {
            name: p.name,
            material: p.material,
            materialSpec: p.materialSpec,
            color: p.color,
            groupId: p.groupId,
            visible: p.visible,
          };
        check('Component properties ' + v.id, equalData(props(v), props(n)));
      }
    }
    const load = async (v: any) => {
      const solid = keep(await cloneSolid(v));
      return { v, solid, b: stats(solid) };
    };
    const ps = await Promise.all(target(after).map(load));
    for (const p of ps)
      check(
        'Closed solid ' + p.v.id,
        p.solid.status() === 'NoError' &&
          p.b.volume > 0 &&
          Math.abs(p.b.volume - p.b.triangleVolume) < 1e-7,
      );
    if (!edit) {
      const ideals = await Promise.all(target(fixture(id)).map(load)),
        remaining = new Set(ps);
      for (const p of ideals) {
        const q = [...remaining].sort(
          (a, b) =>
            Math.hypot(
              ...a.b.center.map((v: number, i: number) => v - p.b.center[i]),
            ) -
            Math.hypot(
              ...b.b.center.map((v: number, i: number) => v - p.b.center[i]),
            ),
        )[0];
        if (!q) {
          check('Required part ' + p.v.name, false);
          continue;
        }
        remaining.delete(q);
        for (let i = 0; i < 3; i++)
          near('Placement ' + p.v.name + ' ' + i, q.b.center[i], p.b.center[i]);
        close(
          'Occupied geometry ' + p.v.name,
          q.solid,
          p.solid.translate([0, 0, 0]),
          id === 'W5' && p.b.size[1] > 0.5 ? 0.02 : 0.001,
        );
      }
      check(
        'Grouped assembly',
        new Set(ps.map((p) => p.v.groupId)).size === 1 &&
          !!ps[0]?.v.groupId &&
          ps[0]?.v.groupId !== 'campaign-markers',
      );
      return facts;
    }
    for (const p of await Promise.all(target(before).map(load))) {
      const q = ps.find((q) => q.v.id === p.v.id);
      if (!q) {
        check('Surviving part ' + p.v.id, false);
        continue;
      }
      if (id === 'W5') {
        const isTop = p.b.size[1] < 0.2;
        const ideal = isTop
          ? p.solid.translate([0, 0.23, 0])
          : mapSolid(p.solid.translate([0, -p.b.bounds.min[1], 0]), (s) =>
              mapSolid(
                s.scale([1, (p.b.size[1] + 0.23) / p.b.size[1], 1]),
                (t) => t.translate([0, p.b.bounds.min[1], 0]),
              ),
            );
        close('Expected occupied edit ' + p.v.id, q.solid, ideal);
      } else if (p.b.size[0] < 1) {
        close(
          'Platform edit ' + p.v.id,
          q.solid,
          Math.abs(p.b.center[0]) < 0.1
            ? p.solid.scale([1, (p.b.size[1] + 0.18) / p.b.size[1], 1])
            : p.solid.translate([0, 0, 0]),
        );
      } else {
        const m = p.solid.getMesh(),
          a = p.b.bounds.min[0],
          b = p.b.bounds.max[0],
          heights = (x: number) => {
            let y = 0;
            for (let i = 0; i < m.numVert; i++)
              if (Math.abs(m.vertProperties[i * m.numProp] - x) < 0.001)
                y = Math.max(y, m.vertProperties[i * m.numProp + 1]);
            return y;
          };
        const ha = heights(a) + (p.b.center[0] > 0 ? 0.18 : 0),
          hb = heights(b) + (p.b.center[0] < 0 ? 0.18 : 0);
        close(
          'Continuous ramp edit ' + p.v.id,
          q.solid,
          wedge(a, b, ha, hb, p.b.size[2]),
        );
      }
    }
    return facts;
  } catch (e) {
    facts.push({
      name: 'Independent measurement available',
      status: 'unverified',
      actual: String(e),
    });
    return facts;
  } finally {
    owned.reverse().forEach((s) => s.delete());
  }
}
