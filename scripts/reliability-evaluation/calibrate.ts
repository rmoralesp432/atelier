import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { seed, referenceScene, oracle, pass, editedFixture } from './geometry';
import { placedSolid } from './solidMatch';
import { box, vertical } from '../phase3-evaluation/geometry';
import { docs } from './config';
const results = [];
for (const id of ['L1', 'L2', 'L3', 'L4']) {
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
// Fresh calibration of the measurement contract, independent of AI labels.
for (const [name, shape] of [
  ['thin cylinder', vertical(1.73, 0.023)],
  ['rotated thin panel', box(0.027, 1.11, 0.48).rotate([0, 23, 0])],
] as const) {
  for (const offset of [0.0015, 0.003]) {
    const moved = shape.translate([offset, 0, 0]);
    results.push({
      id: name,
      kind: `placement ${offset}m`,
      passed: placedSolid(moved, shape) === offset <= 0.002,
    });
    moved.delete();
  }
  const deformed = shape.scale([1.2, 1, 1]);
  results.push({
    id: name,
    kind: 'wrong shape',
    passed: !placedSolid(deformed, shape),
  });
  deformed.delete();
  shape.delete();
}
const rounded = referenceScene('L4');
rounded.project.volumes
  .filter((v) => !v.id.startsWith('reference-'))
  .forEach((v) => {
    for (const k of ['x', 'y', 'z'] as const)
      v.position[k] = Math.round(v.position[k] * 1000) / 1000;
  });
const roundingFacts = await oracle('L4', seed('L4'), seed('L4'), rounded);
results.push({
  id: 'L4',
  kind: 'millimeter-rounded positions within 2mm',
  passed: pass(roundingFacts),
  facts: roundingFacts,
});
mkdirSync(docs, { recursive: true });
writeFileSync(
  docs + '/calibration.json',
  JSON.stringify({ passed: results.every((r) => r.passed), results }, null, 2),
);
console.log(results.map(({ facts, ...r }) => r));
assert(results.every((r) => r.passed));
