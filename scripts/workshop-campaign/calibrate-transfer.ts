import assert from 'node:assert/strict';
import { fixture, oracle } from './transfer';
import { seed, pass, wrong } from './geometry';
import { save } from './budget';
const results: any[] = [];
for (const id of ['W5', 'W6']) {
  const initial = seed(id),
    before = fixture(id),
    after = fixture(id, true);
  const add = async (
    name: string,
    candidate: any,
    edit: boolean,
    expected: boolean,
  ) => {
    const facts = await oracle(
      id,
      initial,
      edit ? before : initial,
      candidate,
      edit,
    );
    results.push({
      name: id + ' ' + name,
      passed: expected ? pass(facts) : wrong(facts),
      facts,
    });
  };
  await add('correct creation', before, false, true);
  await add('connected edit', after, true, true);
  const wrongPosition = structuredClone(after);
  wrongPosition.project.volumes[2].position.x += 0.05;
  await add('displaced part blocked', wrongPosition, true, false);
  const unrelated = structuredClone(after);
  unrelated.project.volumes[0].position.y += 0.03;
  await add('unrelated change blocked', unrelated, true, false);
  const missing = structuredClone(before);
  missing.project.volumes.pop();
  await add('missing object blocked', missing, false, false);
  const equivalent = structuredClone(before);
  for (const v of equivalent.project.volumes.filter(
    (v: any) => !v.id.startsWith('reference-'),
  )) {
    v.dimensions.width *= 2;
    v.dimensions.depth *= 2;
    v.dimensions.height *= 2;
    v.geometry.positions = v.geometry.positions.map((x: number) => x / 2);
    v.name = 'Arbitrary';
  }
  await add('equivalent mesh accepted', equivalent, false, true);
}
save('.cloud/workshop-campaign/transfer-calibration.json', { results });
console.log(
  JSON.stringify(
    results.map((r) => ({
      name: r.name,
      passed: r.passed,
      failed: r.facts.filter((f: any) => f.status !== 'verified'),
    })),
    null,
    2,
  ),
);
assert(results.every((r) => r.passed));
