import assert from 'node:assert/strict';
import { fixture, oracle } from './recovery';
import { seed, pass, wrong } from './geometry';
import {
  fixture as transferFixture,
  oracle as transferOracle,
} from './transfer';
import { save } from './budget';
const initial = seed('D-R1'),
  before = fixture(),
  after = fixture(true),
  rows: any[] = [];
const record = async (
  name: string,
  s: any,
  edit: boolean,
  positive: boolean,
) => {
  const facts = await oracle(initial, edit ? before : initial, s, edit);
  rows.push({ name, passed: positive ? pass(facts) : wrong(facts), facts });
};
await record('New sphere after preserved failure', before, false, true);
await record('Follow-up uses reference top', after, true, true);
let bad = structuredClone(before);
bad.project.volumes[2].dimensions.height *= 1.2;
await record('Ellipsoid blocked', bad, false, false);
bad = structuredClone(after);
bad.project.volumes[2].position.y += 0.04;
await record('Displaced edit blocked', bad, true, false);
bad = structuredClone(after);
bad.project.volumes[0].position.x += 0.03;
await record('Unrelated edit blocked', bad, true, false);
const native = transferFixture('W6');
for (const [i, v] of native.project.volumes.slice(2, 5).entries()) {
  delete v.geometry;
  v.shape = 'box';
  v.dimensions = { width: 0.8, height: [0.25, 0.55, 0.85][i], depth: 1.2 };
  v.position = { x: [-2, 0, 2][i], y: 0, z: 0 };
  v.rotation = 0;
}
const facts = await transferOracle('W6', seed('W6'), seed('W6'), native);
rows.push({
  name: 'Native box representation equivalent to mesh fixture',
  passed: pass(facts),
  facts,
});
save('.cloud/workshop-campaign/recovery-calibration.json', { rows });
console.log(
  JSON.stringify(
    rows.map((r) => ({
      name: r.name,
      passed: r.passed,
      failed: r.facts.filter((f: any) => f.status !== 'verified'),
    })),
    null,
    2,
  ),
);
assert(rows.every((r) => r.passed));
