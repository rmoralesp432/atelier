import { readFileSync, writeFileSync } from 'node:fs';
import { completionVerifier } from '../../src/intelligence/completionVerifier';
import { binaryCorrection } from '../../tests/fixtures/workshop-reliability/repair';
import { oracle, pass } from '../workshop-campaign/geometry';
const f = JSON.parse(
  readFileSync('tests/fixtures/workshop-reliability/reflection.json', 'utf8'),
);
const cases = [];
for (const displaced of [false, true]) {
  const candidate = structuredClone(f.candidate);
  if (displaced)
    candidate.project.volumes.find(
      (v: any) => v.id === 'display-1',
    ).position.x += 0.04;
  let calls = 0;
  const report = await completionVerifier(
    f.before,
    'Saved reflection request',
    async (_s, revision) => {
      calls++;
      return revision ? binaryCorrection(f.criteria) : f.criteria;
    },
  )(candidate);
  const facts = await oracle('D-H2', f.before, f.before, candidate, false);
  cases.push({
    displaced,
    readerCalls: calls,
    scriptedCorrection: true,
    externalPass: pass(facts),
    facts,
    report,
  });
}
writeFileSync(
  'docs/evaluations/workshop-reliability/offline-corrected.json',
  JSON.stringify(
    {
      label:
        'Offline saved real-AI geometry plus scripted independent criterion correction. Browser commits are evidenced separately.',
      cases,
    },
    null,
    2,
  ),
);
console.log(
  cases.map((c) => ({
    displaced: c.displaced,
    status: c.report.status,
    canCommit: c.report.canCommit,
    externalPass: c.externalPass,
    readerCalls: c.readerCalls,
  })),
);
