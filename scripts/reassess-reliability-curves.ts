/** Offline measurement-method reassessment; does not modify original results or application. */
import { readFileSync, writeFileSync } from 'node:fs';
import { oracle, pass, seed } from './reliability-evaluation/geometry';
const root = '/workspace/atelier-campaign/.cloud/workshop-campaign',
  batch = 'reliability-recovery-1';
const oldRoot = 'docs/evaluations/workshop-reliability/recovery/live';
const rows = JSON.parse(readFileSync(`${root}/${batch}/results.json`, 'utf8'));
const results = [];
for (const arm of ['baseline', 'reliability']) {
  const id = `${batch}-${arm}-L4-create`,
    old = rows.find((r: any) => r.id === id);
  const proposal =
    arm === 'reliability'
      ? JSON.parse(readFileSync(`${oldRoot}/replays/${id}.json`, 'utf8'))
      : null;
  const model =
    proposal?.candidate ??
    JSON.parse(readFileSync(`${root}/${batch}/${id}-after.json`, 'utf8'));
  const facts = await oracle('L4', seed('L4'), seed('L4'), model);
  const measured = facts.filter(
    (f) =>
      f.name.startsWith('Expected occupied component') &&
      f.status === 'verified',
  );
  let maxPositionErrorM = 0,
    maxDimensionErrorM = 0;
  for (const f of measured) {
    const a = (f.actual as any).bounds,
      e = (f.expected as any).bounds;
    maxPositionErrorM = Math.max(
      maxPositionErrorM,
      Math.hypot(
        ...a.min.map(
          (v: number, i: number) => (v + a.max[i] - e.min[i] - e.max[i]) / 2,
        ),
      ),
    );
    maxDimensionErrorM = Math.max(
      maxDimensionErrorM,
      ...a.min.map((v: number, i: number) =>
        Math.abs(a.max[i] - v - e.max[i] + e.min[i]),
      ),
    );
  }
  results.push({
    id,
    label:
      arm === 'baseline'
        ? 'Actual saved browser result'
        : 'Offline replay of uncommitted proposal; NOT a browser commit',
    originalStatus: old.status,
    originalFacts: proposal?.facts ?? old.facts,
    reassessedPass: pass(facts),
    maxPositionErrorM,
    maxDimensionErrorM,
    facts,
  });
}
writeFileSync(
  'docs/evaluations/workshop-reliability/recovery/spatial-metrics/curved-reassessment.json',
  JSON.stringify(
    {
      label:
        'Separate calibrated measurement-method diagnosis; original raw scores retained. No fresh API calls.',
      results,
    },
    null,
    2,
  ),
);
console.log(results.map(({ facts, originalFacts, ...r }) => r));
