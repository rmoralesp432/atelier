// No network or model calls. Re-evaluate the exact saved real-AI criteria/solids.
import { readFileSync, writeFileSync } from 'node:fs';
import { parseSession } from '../../../src/intelligence/engine';
import { verifyCompletion } from '../../../src/intelligence/completion';
import { completionCriteriaSchema } from '../../../src/intelligence/completionSchema';
const root = new URL(
  '../2026-11-18-completion-final-5usd/evidence/',
  import.meta.url,
);
const read = (file: string) =>
  JSON.parse(readFileSync(new URL(file, root), 'utf8'));
const session = (file: string) =>
  parseSession(JSON.stringify({ version: 2, ...read(file) }));
const criteria = completionCriteriaSchema.parse(read('channel-criteria.json'));
const original = session('channel-original.json');
const results = [];
for (const [label, file, expected] of [
  [
    'correct live-generated assembly',
    'channel-last-candidate.json',
    'verified',
  ],
  ['wrong height', 'channel-wrong-ball-height.json', 'incorrect'],
  ['wrong depth', 'channel-wrong-ball-depth.json', 'incorrect'],
] as const) {
  const start = performance.now();
  const report = await verifyCompletion(criteria, original, session(file));
  results.push({
    label,
    expected,
    status: report.status,
    canCommit: report.canCommit,
    milliseconds: performance.now() - start,
    coldKernel: results.length === 0,
    checks: report.checks,
  });
  if (report.status !== expected)
    throw Error(`Unexpected ${label}: ${report.status}`);
}
writeFileSync(
  new URL('./saved-trace-replay.json', import.meta.url),
  JSON.stringify(
    {
      applicationCommit: 'cac373ac63a96222568123ed0a8ee1812648ec07',
      apiCalls: 0,
      estimatedCostUSD: 0,
      results,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify(
    results.map(({ label, status, canCommit, milliseconds }) => ({
      label,
      status,
      canCommit,
      milliseconds,
    })),
    null,
    2,
  ),
);
