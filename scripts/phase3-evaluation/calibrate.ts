import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { assembled, seed, fixture, lantern, openingProbe } from './fixtures';
import { oracle, passed, incorrect } from './oracles';
import {
  asVolume,
  box,
  cloneSolid,
  mapSolid,
  subtract,
  vertical,
  worldToLocal,
  localToWorld,
} from './geometry';
import {
  serializeSession,
  parseSession,
  type Session,
} from '../../src/intelligence/engine';

const output = '.cloud/phase3-baseline';
mkdirSync(output, { recursive: true });
const results: any[] = [];
async function check(
  name: string,
  id: string,
  before: Session,
  after: Session,
  expect: 'pass' | 'incorrect',
) {
  const facts = await oracle(id, seed(id[0]), before, after),
    ok = expect === 'pass' ? passed(facts) : incorrect(facts);
  results.push({ name, id, expected: expect, passed: ok, facts });
  writeFileSync(
    `${output}/calibration.json`,
    JSON.stringify({ paidCalls: 0, results }, null, 2),
  );
  assert(
    ok,
    `${name}: ${JSON.stringify(facts.filter((f) => f.status !== 'verified'))}`,
  );
}
for (const e of ['A', 'B', 'C', 'D', 'E', 'F'])
  for (const n of [1, 2]) {
    const id = e + n,
      b = n === 1 || e === 'F' ? seed(e) : assembled(e + '1'),
      a = id === 'F1' ? seed(e) : assembled(id);
    assert.deepEqual(parseSession(serializeSession(a)).project, a.project);
    await check(`valid ${id}`, id, b, a, 'pass');
    const wrong = structuredClone(a);
    wrong.project.volumes[0].position.x += 0.1;
    await check(`protected neighbor ${id}`, id, b, wrong, 'incorrect');
    if (id !== 'F1') {
      const missing = structuredClone(a);
      missing.project.volumes.pop();
      await check(`missing component ${id}`, id, b, missing, 'incorrect');
      const duplicate = structuredClone(a);
      duplicate.project.volumes.push(
        structuredClone(a.project.volumes.at(-1)!),
      );
      await check(`duplicated identity ${id}`, id, b, duplicate, 'incorrect');
      const equivalent = structuredClone(a),
        equivalentBefore = structuredClone(b);
      for (const v of [
        ...equivalent.project.volumes,
        ...equivalentBefore.project.volumes,
      ].filter((v) => !seed(e).project.volumes.some((o) => o.id === v.id))) {
        if (v.geometry?.kind !== 'mesh')
          throw new Error('Expected mesh fixture');
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
      await check(
        `equivalent local frame ${id}`,
        id,
        equivalentBefore,
        equivalent,
        'pass',
      );
    }
  }
for (const e of ['A', 'B']) {
  const rotate = async (s: Session) => {
    for (let i = 2; i < s.project.volumes.length; i++) {
      const old = s.project.volumes[i];
      s.project.volumes[i] = {
        ...asVolume(
          mapSolid(await cloneSolid(old), (p) =>
            localToWorld(p, { x: -3, z: 2, angle: 47 }),
          ),
          old.id,
          old.name,
        ),
        material: old.material,
        materialSpec: old.materialSpec,
      };
    }
    return s;
  };
  await check(
    `rotated and translated ${e}1`,
    e + '1',
    seed(e),
    await rotate(assembled(e + '1')),
    'pass',
  );
  await check(
    `rotated connected edit ${e}2`,
    e + '2',
    await rotate(assembled(e + '1')),
    await rotate(assembled(e + '2')),
    'pass',
  );
}
{
  const a = assembled('A1'),
    index = a.project.volumes.findIndex((v) => v.name === 'Side glazing -2.4'),
    v = a.project.volumes[index];
  const h = v.dimensions.height;
  a.project.volumes.splice(
    index,
    1,
    ...[-0.8, 0.8].map((z, i) => ({
      ...asVolume(box(0.012, h, 1.6, -2.4, 0.18, z), `${v.id}-${i}`, v.name),
      material: 'glass' as const,
    })),
  );
  await check('split glazing is equivalent', 'A1', seed('A'), a, 'pass');
  const wrong = assembled('A2');
  wrong.project.volumes.find((v) => v.name === 'Roof')!.position.y += 0.1;
  await check('roof disconnected', 'A2', assembled('A1'), wrong, 'incorrect');
  const closed = assembled('A1');
  closed.project.volumes.push({
    ...asVolume(
      box(4.8, 2.7, 0.012, 0, 0.18, -1.6),
      'extra-front',
      'Front glass',
    ),
    material: 'glass',
  });
  await check('front must stay open', 'A1', seed('A'), closed, 'incorrect');
}
{
  const a = assembled('B2');
  a.project.volumes.find((v) => v.name.startsWith('Apron'))!.dimensions.width -=
    0.4;
  await check(
    'bench rail detached after widening',
    'B2',
    assembled('B1'),
    a,
    'incorrect',
  );
  const b = assembled('B1');
  b.project.volumes.find((v) => v.name === 'Top')!.materialSpec = undefined;
  await check(
    'label or color is not material designation',
    'B1',
    seed('B'),
    b,
    'incorrect',
  );
  const c = assembled('B1');
  for (const v of c.project.volumes.filter((v) => v.name.startsWith('Apron')))
    v.dimensions.width += 0.08;
  await check('joinery may overlap leg faces', 'B1', seed('B'), c, 'pass');
}
{
  const a = assembled('C1');
  a.project.volumes.find((v) => v.name === 'Shaft')!.position.z += 0.02;
  await check('noncoaxial shaft', 'C1', seed('C'), a, 'incorrect');
  const b = assembled('C2');
  b.project.volumes.find((v) => v.name === 'Shaft')!.dimensions.width -= 0.1;
  await check(
    'wrong overhang after contextual mechanical edit',
    'C2',
    assembled('C1'),
    b,
    'incorrect',
  );
}
{
  const a = assembled('D1'),
    v = a.project.volumes.at(-1)!;
  a.project.volumes[a.project.volumes.length - 1] = {
    ...asVolume(
      box(v.dimensions.width, 1.4, v.dimensions.depth, v.position.x),
      v.id,
      v.name,
    ),
  };
  await check('filled lantern', 'D1', seed('D'), a, 'incorrect');
  const b = assembled('D2'),
    old = b.project.volumes.at(-1)!;
  const through = mapSolid(openingProbe(), (s) => s.scale([1, 1, 3]));
  b.project.volumes[b.project.volumes.length - 1] = asVolume(
    subtract(lantern(), through),
    old.id,
    old.name,
  );
  await check(
    'opening must not cut back wall',
    'D2',
    assembled('D1'),
    b,
    'incorrect',
  );
}
{
  const a = assembled('E1');
  a.project.volumes[2].position.x += 0.19;
  await check('controlled displaced prism', 'E1', seed('E'), a, 'incorrect');
  const b = assembled('E1'),
    v = b.project.volumes[2];
  b.project.volumes[2] = asVolume(
    mapSolid(vertical(0.46, 0.15), (s) =>
      s.translate([v.position.x, 0, v.position.z]),
    ),
    v.id,
    v.name,
  );
  await check(
    'circle does not satisfy regular hexagon',
    'E1',
    seed('E'),
    b,
    'incorrect',
  );
}
console.log(
  JSON.stringify({
    calibrationCases: results.length,
    passed: results.every((r) => r.passed),
    paidCalls: 0,
  }),
);
