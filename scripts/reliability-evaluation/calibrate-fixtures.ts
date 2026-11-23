/** Offline validation of actual saved starting models, independent of live edits. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { oracle, seed, pass } from './geometry';
import { docs } from './config';
const results = [];
for (const id of ['L1', 'L2', 'L4']) {
  const model = JSON.parse(
    readFileSync(`scripts/reliability-evaluation/fixtures/${id}.json`, 'utf8'),
  );
  const facts = await oracle(id, seed(id), seed(id), model);
  results.push({
    id,
    source: 'Actual saved baseline creation; diagnostic starting model',
    passed: pass(facts),
    facts,
  });
}
writeFileSync(
  docs + '/starting-models.json',
  JSON.stringify({ passed: results.every((r) => r.passed), results }, null, 2),
);
console.log(results.map(({ facts, ...r }) => r));
assert(results.every((r) => r.passed));
