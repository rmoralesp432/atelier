import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { seed, referenceScene, oracle, pass, editedFixture } from './geometry';
import { docs } from './config';
const results = [];
for (const id of ['L1', 'L2', 'L3']) {
  const initial = seed(id),
    created = referenceScene(id),
    edited = await editedFixture(id, created),
    second = await editedFixture(id, edited, 'edit2');
  for (const [phase, before, after] of [
    ['create', initial, created],
    ['edit', created, edited],
    ['edit2', edited, second],
  ] as const) {
    const facts = await oracle(
      id,
      initial,
      before,
      after,
      phase !== 'create',
      phase,
    );
    results.push({ id, phase, kind: 'correct', passed: pass(facts), facts });
    const bad = structuredClone(after);
    bad.project.volumes.at(-1)!.position.x += 0.04;
    const wrong = await oracle(
      id,
      initial,
      before,
      bad,
      phase !== 'create',
      phase,
    );
    results.push({
      id,
      phase,
      kind: 'displaced',
      passed: !pass(wrong),
      facts: wrong,
    });
  }
  const collateral = structuredClone(second);
  collateral.project.volumes[0].position.y += 0.02;
  results.push({
    id,
    kind: 'unrelated modification',
    passed: !pass(await oracle(id, initial, edited, collateral, true, 'edit2')),
  });
  const replaced = structuredClone(second);
  replaced.project.volumes.at(-1)!.id = 'new-identity';
  results.push({
    id,
    kind: 'replaced identity',
    passed: !pass(await oracle(id, initial, edited, replaced, true, 'edit2')),
  });
}
mkdirSync(docs, { recursive: true });
writeFileSync(
  docs + '/calibration.json',
  JSON.stringify({ passed: results.every((r) => r.passed), results }, null, 2),
);
console.log(results.map(({ facts, ...r }) => r));
assert(results.every((r) => r.passed));
