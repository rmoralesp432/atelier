import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  seed,
  referenceScene,
  oracle,
  pass,
  wrong,
  cloneSolid,
  asVolume,
  stats,
  arcPoints,
  K,
} from './geometry';
import { root } from './config';
import { mapSolid, rad, box } from '../phase3-evaluation/geometry';
const results: any[] = [];
const record = (name: string, ok: boolean, facts: any) => {
  results.push({ name, passed: ok, facts });
};
export async function expectedEdit(id: string, before: any) {
  const after = structuredClone(before);
  const vs = after.project.volumes.filter(
    (v: any) => !v.id.startsWith('reference-'),
  );
  for (const v of vs) {
    const s = await cloneSolid(v);
    const b = stats(s);
    let n;
    if (id === 'W1')
      n =
        v.name === 'Side'
          ? s.translate([Math.sign(b.center[0]) * 0.21, 0, 0])
          : mapSolid(s.translate([-b.center[0], 0, 0]), (x) =>
              x
                .scale([(b.size[0] + 0.42) / b.size[0], 1, 1])
                .translate([b.center[0], 0, 0]),
            );
    else if (id === 'W2')
      n =
        v.name === 'Floor'
          ? s.translate([0, 0.38, 0])
          : v.name === 'Roof'
            ? s.translate([0, 0, 0])
            : mapSolid(s.translate([0, -b.bounds.max[1], 0]), (x) =>
                x
                  .scale([1, (b.size[1] - 0.38) / b.size[1], 1])
                  .translate([0, b.bounds.max[1], 0]),
              );
    else if (id === 'W3')
      n =
        v.name === 'Bearing'
          ? s.translate([Math.sign(b.center[0]) * 0.2, 0, 0])
          : s.scale([(b.size[0] + 0.4) / b.size[0], 1, 1]);
    else if (id === 'W4')
      n =
        v.name === 'Halo'
          ? s.translate([0, 0.28, 0])
          : v.name === 'Plinth'
            ? s.translate([0, 0, 0])
            : mapSolid(s.translate([0, -0.18, 0]), (x) =>
                x
                  .scale([1, (b.size[1] + 0.28) / b.size[1], 1])
                  .translate([0, 0.18, 0]),
              );
    else {
      const a = rad(34),
        t = [Math.cos(a), Math.sin(a)],
        r = [b.center[0] - 1.1, b.center[2] + 0.8],
        dot = r[0] * t[0] + r[1] * t[1],
        x = 1.1 + 2 * t[0] * dot - r[0],
        z = -0.8 + 2 * t[1] * dot - r[1];
      n = s.translate([x - b.center[0], 0, z - b.center[2]]);
    }
    s.delete();
    const replacement = asVolume(n, v.id, v.name);
    Object.assign(v, {
      dimensions: replacement.dimensions,
      position: replacement.position,
      rotation: replacement.rotation,
      geometry: replacement.geometry,
    });
  }
  return after;
}
for (const id of ['W1', 'W2', 'W3', 'W4', 'D-H1']) {
  const initial = seed(id),
    good = referenceScene(id);
  let facts = await oracle(id, initial, initial, good);
  record(id + ' correct creation', pass(facts), facts);
  const missing = structuredClone(good);
  missing.project.volumes.pop();
  facts = await oracle(id, initial, initial, missing);
  record(id + ' missing part rejected', wrong(facts), facts);
  const changed = structuredClone(good);
  changed.project.volumes[0].position.x += 0.05;
  facts = await oracle(id, initial, initial, changed);
  record(id + ' unrelated edit rejected', wrong(facts), facts);
  const equivalent = structuredClone(good);
  for (const v of equivalent.project.volumes.filter(
    (v: any) => !v.id.startsWith('reference-'),
  )) {
    v.dimensions.width *= 2;
    v.dimensions.height *= 2;
    v.dimensions.depth *= 2;
    if (v.geometry.kind === 'mesh')
      v.geometry.positions = v.geometry.positions.map((x: number) => x / 2);
    v.name = 'Uninformative object';
  }
  facts = await oracle(id, initial, initial, equivalent);
  record(id + ' equivalent reparameterization accepted', pass(facts), facts);
  if (id.startsWith('W')) {
    const edited = await expectedEdit(id, good);
    facts = await oracle(id, initial, good, edited, true);
    record(id + ' correct contextual edit', pass(facts), facts);
    const displaced = structuredClone(edited);
    displaced.project.volumes[2].position.z += 0.04;
    facts = await oracle(id, initial, good, displaced, true);
    record(id + ' displaced edit blocked', wrong(facts), facts);
  }
}
const initial = seed('D-H2'),
  reflected = await expectedEdit('D-H2', initial);
let facts = await oracle('D-H2', initial, initial, reflected);
record('D-H2 reflection correct', pass(facts), facts);
const bad = structuredClone(reflected);
bad.project.volumes[2].rotation = 90;
facts = await oracle('D-H2', initial, initial, bad);
record('D-H2 wrong orientation rejected', wrong(facts), facts);
facts = await oracle(
  'D-N1',
  seed('D-N1'),
  seed('D-N1'),
  referenceScene('D-N1'),
);
record('D-N1 wrong radial distance rejected', wrong(facts), facts);
mkdirSync(root, { recursive: true });
writeFileSync(
  join(root, 'calibration.json'),
  JSON.stringify({ at: new Date().toISOString(), results }, null, 2),
);
console.log(
  JSON.stringify(
    {
      passed: results.filter((x) => x.passed).length,
      total: results.length,
      failures: results
        .filter((x) => !x.passed)
        .map((x) => ({
          name: x.name,
          checks: x.facts.filter((f: any) => f.status !== 'verified'),
        })),
    },
    null,
    2,
  ),
);
assert(
  results.every((x) => x.passed),
  'Offline oracle calibration failed',
);
