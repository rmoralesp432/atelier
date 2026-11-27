/** Offline causal replay of recorded reviewer criteria, never a live commit or app change. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifyCompletion } from '/workspace/atelier-derived-verification/src/intelligence/completion.ts';
import { oracle, pass } from './workshop-campaign/geometry';
const folder = '.cloud/workshop-campaign/verifier-repeat',
  id = 'verifier-repeat-verifier-D-H2-create';
const row = JSON.parse(readFileSync(join(folder, 'results.json'), 'utf8')).find(
  (r: any) => r.id === id,
);
const criteria = row.events.find((e: any) => e.kind === 'reviewer').response;
const before = JSON.parse(
  readFileSync(join(folder, id + '-before.json'), 'utf8'),
);
const after = JSON.parse(
  readFileSync(join(folder, id + '-after.json'), 'utf8'),
);
const wrong = structuredClone(after);
wrong.project.volumes.find((v: any) => v.id === 'display-1').position.x += 0.04;
const normalized = structuredClone(criteria);
for (const c of normalized.checks) {
  if (!c.calculation) continue;
  const old = c.calculation,
    nodes: any[] = [],
    map: number[] = [];
  old.nodes.forEach((n: any, i: number) => {
    const next = structuredClone(n);
    if (n.kind === 'operation') next.args = n.args.map((j: number) => map[j]);
    if (
      n.kind === 'operation' &&
      ['add', 'multiply'].includes(n.op) &&
      next.args.length > 2
    ) {
      let left = next.args[0];
      for (const right of next.args.slice(1)) {
        nodes.push({ kind: 'operation', op: n.op, args: [left, right] });
        left = nodes.length - 1;
      }
      map[i] = left;
    } else {
      nodes.push(next);
      map[i] = nodes.length - 1;
    }
  });
  c.calculation = {
    ...old,
    nodes,
    output: {
      ...old.output,
      x: map[old.output.x],
      y: map[old.output.y],
      z: map[old.output.z],
    },
  };
}
const cases: any[] = [];
for (const [label, cr, scene] of [
  ['recorded criteria / actual correct result', criteria, after],
  ['recorded criteria / deliberately displaced result', criteria, wrong],
  [
    'analysis-only binary normalization / actual correct result',
    normalized,
    after,
  ],
  [
    'analysis-only binary normalization / deliberately displaced result',
    normalized,
    wrong,
  ],
] as const) {
  const geometry = await oracle('D-H2', before, before, scene, false);
  const report = await verifyCompletion(cr, before, scene);
  cases.push({ label, externalPass: pass(geometry), geometry, report });
}
const result = {
  label:
    'Saved fresh-AI reviewer trace, offline evaluation of actual solids. No new API request, browser commit, or application change. Binary normalization is a counterfactual, not an implemented fix.',
  displacement: { object: 'display-1', axis: 'world X', meters: 0.04 },
  cases,
};
writeFileSync(
  'docs/evaluations/workshop-campaign/calculation-arity-audit.json',
  JSON.stringify(result, null, 2),
);
for (const c of cases)
  console.log(
    JSON.stringify({
      label: c.label,
      externalPass: c.externalPass,
      hostStatus: c.report.status,
      canCommit: c.report.canCommit,
    }),
  );
