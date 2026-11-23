/** Fresh-AI recovery immediately after a controlled failed browser transaction. */
import {
  K,
  mapSolid,
  asVolume,
  cloneSolid,
  stats,
  sameSolid,
} from '../phase3-evaluation/geometry';
import { seed, type Fact } from './geometry';
import { equalData } from '../../src/projects/equalData';
import { isLocked } from '../../src/model';
export const recoverySpec = {
  id: 'D-R1',
  domain: 'verifier-recovery',
  create:
    'Never mind that arrangement. Create one separately editable sphere, 30 cm in diameter, centered at X=0.9 m and Z=-1.2 m, with its bottom 22 cm above the ground. Leave the existing reference objects untouched.',
  edit: 'Now set the sphere’s bottom at the same height as the top of the taller existing reference sample. Keep the sphere’s size, shape and plan position, and leave both samples untouched.',
};
export function fixture(edited = false) {
  const s = seed('D-R1');
  s.project.volumes.push(
    asVolume(
      mapSolid(K.Manifold.sphere(0.15, 96), (s) =>
        s.translate([0.9, (edited ? 0.44 : 0.22) + 0.15, -1.2]),
      ),
      'recovery-sphere',
      'Recovery sphere',
    ),
  );
  return s;
}
export async function oracle(
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
  try {
    for (const v of initial.project.volumes)
      check(
        'Reference intact ' + v.id,
        equalData(
          v,
          after.project.volumes.find((w: any) => w.id === v.id),
        ),
      );
    check(
      'Groups unchanged',
      initial.project.groups.every((g: any) =>
        equalData(
          g,
          after.project.groups.find((h: any) => h.id === g.id),
        ),
      ),
    );
    const ps = after.project.volumes.filter(
      (v: any) => !v.id.startsWith('reference-'),
    );
    check(
      'Exactly one new editable solid',
      ps.length === 1 && ps.every((v: any) => !isLocked(v, after.project)),
      1,
      ps.length,
    );
    if (ps.length !== 1) return facts;
    const solid = keep(await cloneSolid(ps[0]));
    let y = 0.22;
    if (edit) {
      const old = before.project.volumes.filter(
        (v: any) => !v.id.startsWith('reference-'),
      );
      check(
        'Sphere identity retained',
        old.length === 1 && old[0].id === ps[0].id,
      );
      const bounds = await Promise.all(
        initial.project.volumes.map(
          async (v: any) => stats(keep(await cloneSolid(v))).bounds.max[1],
        ),
      );
      y = Math.max(...bounds);
    }
    const ideal = keep(
        mapSolid(K.Manifold.sphere(0.15, 96), (s) =>
          s.translate([0.9, y + 0.15, -1.2]),
        ),
      ),
      b = stats(solid);
    check(
      'True occupied sphere',
      solid.status() === 'NoError' && sameSolid(solid, ideal, 0.02),
      { diameter: 0.3, base: y },
      b,
    );
    check(
      'Required base position',
      Math.abs(b.bounds.min[1] - y) <= 0.001,
      y,
      b.bounds.min[1],
    );
    check(
      'Plan position retained',
      Math.abs(b.center[0] - 0.9) <= 0.001 &&
        Math.abs(b.center[2] + 1.2) <= 0.001,
      [0.9, -1.2],
      [b.center[0], b.center[2]],
    );
    return facts;
  } catch (e) {
    facts.push({
      name: 'Recovery measurement available',
      status: 'unverified',
      actual: String(e),
    });
    return facts;
  } finally {
    owned.reverse().forEach((s) => s.delete());
  }
}
