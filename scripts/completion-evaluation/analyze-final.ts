import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { verifyCompletion } from '../../src/intelligence/completion';
import {
  parseSession,
  serializeSession,
  applyPlan,
  directPlan,
} from '../../src/intelligence/engine';
import { equalData } from '../../src/projects/equalData';
import { oracle, controls, passed } from './cases';
const folder =
  process.argv[2] ??
  'docs/evaluations/2026-11-18-completion-final-5usd/evidence';
const get = (n: string) =>
  JSON.parse(readFileSync(`${folder}/${n}.json`, 'utf8'));
const original = get('channel-original'),
  candidate = get('channel-provisional'),
  criteria = get('channel-criteria');
const restored = parseSession(serializeSession(candidate));
assert(equalData(restored, candidate));
assert.equal(candidate.past.length, 1);
assert(equalData(candidate.past[0], original.project));
assert(passed(await oracle('channel', original, restored)));
const undo = (await applyPlan(restored, directPlan({ type: 'undo', count: 1 })))
  .session;
assert(equalData(undo.project, original.project));
const redo = (await applyPlan(undo, directPlan({ type: 'redo', count: 1 })))
  .session;
assert(equalData(redo.project, candidate.project));
const output: any = {
  liveGeometryAndIdentityPreserved: true,
  persistencePassed: true,
  undoPassed: true,
  redoPassed: true,
  controls: [],
  coverageAudit: [],
};
for (const c of await controls('channel', original, candidate)) {
  const truth = await oracle('channel', original, c.session);
  assert.equal(passed(truth), c.expectedPass);
  const report = await verifyCompletion(criteria, original, c.session);
  output.controls.push({
    name: c.name,
    expectedPass: c.expectedPass,
    report,
    oracle: truth,
  });
}
// Additional free coverage audit prompted by the actual independent criteria:
// the reader requested ball width but omitted its other two diameters.
for (const axis of ['height', 'depth'] as const) {
  const s = structuredClone(candidate);
  const v = s.project.volumes.find(
    (v: any) => v.name === 'Channel center ball',
  );
  assert(v);
  v.dimensions = { ...v.dimensions, [axis]: v.dimensions[axis] + 0.19 };
  const truth = await oracle('channel', original, s),
    report = await verifyCompletion(criteria, original, s);
  output.coverageAudit.push({
    name: `wrong-ball-${axis}`,
    report,
    oracle: truth,
    falseAcceptance: report.status === 'verified' && !passed(truth),
  });
  writeFileSync(
    `${folder}/channel-wrong-ball-${axis}.json`,
    JSON.stringify(s, null, 2),
  );
}
writeFileSync(
  `${folder}/checkpoint-investigation.json`,
  JSON.stringify(output, null, 2),
);
console.log(
  JSON.stringify({
    ...output,
    controls: output.controls.map((c: any) => ({
      name: c.name,
      expectedPass: c.expectedPass,
      status: c.report.status,
      canCommit: c.report.canCommit,
    })),
    coverageAudit: output.coverageAudit.map((c: any) => ({
      name: c.name,
      status: c.report.status,
      canCommit: c.report.canCommit,
      falseAcceptance: c.falseAcceptance,
      failedChecks: c.oracle
        .filter((v: any) => !v.passed)
        .map((v: any) => v.name),
    })),
  }),
);
