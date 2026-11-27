import { readFileSync, writeFileSync } from 'node:fs';
import { verifyCompletion } from '../../src/intelligence/completion';
const results = [];
for (const name of ['group', 'reflection']) {
  const { before, candidate, criteria, provenance } = JSON.parse(
    readFileSync(`tests/fixtures/workshop-reliability/${name}.json`, 'utf8'),
  );
  for (const wrong of name === 'reflection' ? [false, true] : [false]) {
    const scene = structuredClone(candidate);
    if (wrong)
      scene.project.volumes.find((v: any) => v.id === 'display-1').position.x +=
        0.04;
    const report = await verifyCompletion(criteria, before, scene);
    results.push({ name, wrong, provenance, report });
    console.log(
      JSON.stringify({
        name,
        wrong,
        status: report.status,
        canCommit: report.canCommit,
        issues: report.criterionIssues,
        checks: report.checks
          .filter((c) => c.outcome !== 'verified')
          .map((c) => ({ id: c.id, outcome: c.outcome, observed: c.observed })),
      }),
    );
  }
}
writeFileSync(
  process.argv[2] ??
    'docs/evaluations/workshop-reliability/offline-before.json',
  JSON.stringify(results, null, 2) + '\n',
);
