/** Offline evidence replay. No provider imports, credentials or network calls. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { savedRepair } from '../tests/fixtures/saved-repair';
import { verifyCompletion } from '../src/intelligence/completion';
import { stagedPlan } from '../src/intelligence/checkedPlanner';
import {
  applyPlan,
  directPlan,
  serializeSession,
  parseSession,
} from '../src/intelligence/engine';
import { defaultCamera } from '../src/intelligence/context';
import { oracle, passed } from './phase3-evaluation/oracles';
import { cloneSolid, stats, vertices } from './phase3-evaluation/geometry';
import type { Volume } from '../src/model';

const fixture = savedRepair();
const {
  original,
  injected,
  repaired,
  correctBefore,
  legacy,
  derived,
  creationPlan,
} = fixture;
const legacyReport = await verifyCompletion(legacy, original, repaired);
const correctedReport = await verifyCompletion(derived, original, repaired);
const displacedReport = await verifyCompletion(derived, original, injected);
assert.equal(legacyReport.canCommit, false);
assert.equal(correctedReport.canCommit, true);
assert.equal(correctedReport.status, 'unverified');
assert.equal(
  correctedReport.checks.find((c) => c.id === 'check-5')!.outcome,
  'verified',
);
assert.equal(displacedReport.canCommit, false);
const external = {
  before: await oracle('E1', original, original, correctBefore),
  displaced: await oracle('E1', original, original, injected),
  repaired: await oracle('E1', original, original, repaired),
};
assert(passed(external.before));
assert(!passed(external.displaced));
assert(passed(external.repaired));
let calls = 0;
const result = await stagedPlan(
  original,
  defaultCamera,
  async () =>
    ++calls === 1
      ? creationPlan
      : { intent: 'finish', message: 'Finished', operations: [] },
  undefined,
  undefined,
  {
    agent: true,
    verifyCompletion: (candidate) =>
      verifyCompletion(derived, original, candidate),
  },
);
assert(result.prepared);
const committed = result.prepared.session;
// Persistence omits undefined optional properties; compare all defined values
// exactly, without rounding coordinates or discarding geometry/identity fields.
const persisted = (value: unknown) => JSON.parse(JSON.stringify(value));
assert.equal(committed.project.volumes.length, 12);
assert.equal(committed.past.length, original.past.length + 1);
assert.deepEqual(
  persisted(committed.project.volumes.slice(0, 2)),
  persisted(original.project.volumes),
);
const reloaded = parseSession(serializeSession(committed));
assert.deepEqual(persisted(reloaded.project), persisted(committed.project));
const undone = (
  await applyPlan(reloaded, directPlan({ type: 'undo', count: 1 }))
).session;
assert.deepEqual(persisted(undone.project), persisted(original.project));
const redone = (await applyPlan(undone, directPlan({ type: 'redo', count: 1 })))
  .session;
assert.deepEqual(persisted(redone.project), persisted(committed.project));
const expected = correctedReport.checks.find((c) => c.id === 'check-5')!
  .calculation!.expected as { x: number; y: number; z: number }[];
const oldPoints = (legacy.checks[4].requirement as { points: { z: number }[] })
  .points;
const dir = 'docs/evaluations/derived-completion/evidence';
mkdirSync(dir, { recursive: true });
// Separate numerical oracle for the browser case: no calculation-evaluator or
// host predicate outputs are used as expected values.
const browser = JSON.parse(readFileSync(`${dir}/browser.json`, 'utf8'));
const reference = await cloneSolid(browser.before.volumes[0]);
const rb = reference.boundingBox();
reference.delete();
const initial = [
  (rb.min[0] + rb.max[0]) / 2 + 17,
  rb.max[1] + 0.2,
  (rb.min[2] + rb.max[2]) / 2 - 2,
];
const final = [
  initial[0] + 0.37 * Math.cos((-23 * Math.PI) / 180),
  initial[1],
  initial[2] + 0.37 * Math.sin((-23 * Math.PI) / 180),
];
const sphereMeasurements = [];
for (const [key, expectedPosition, diameter] of [
  ['created', initial, 0.42],
  ['edited', final, 0.438],
] as const) {
  const parts: Volume[] = browser[key].volumes;
  assert.deepEqual(parts.slice(0, 2), browser.before.volumes);
  assert.equal(parts[2].id, browser.created.volumes[2].id);
  const solid = await cloneSolid(parts[2]);
  try {
    const b = solid.boundingBox(),
      data = stats(solid);
    const actualPosition = [
      (b.min[0] + b.max[0]) / 2,
      b.min[1],
      (b.min[2] + b.max[2]) / 2,
    ];
    const positionErrorMeters = Math.hypot(
      ...actualPosition.map((v, i) => v - expectedPosition[i]),
    );
    const center = [
      actualPosition[0],
      actualPosition[1] + diameter / 2,
      actualPosition[2],
    ];
    const radialErrorMeters = Math.max(
      ...vertices(solid).map((p) =>
        Math.abs(Math.hypot(...p.map((v, i) => v - center[i])) - diameter / 2),
      ),
    );
    const expectedVolume = (4 * Math.PI * Math.pow(diameter / 2, 3)) / 3;
    const volumeErrorRatio =
      Math.abs(solid.volume() - expectedVolume) / expectedVolume;
    assert.equal(solid.status(), 'NoError');
    assert(positionErrorMeters <= 0.001);
    assert(radialErrorMeters <= 0.001);
    assert(volumeErrorRatio <= 0.02);
    sphereMeasurements.push({
      stage: key,
      expectedPosition,
      actualPosition,
      diameter,
      positionErrorMeters,
      radialErrorMeters,
      volumeErrorRatio,
      solidVolume: solid.volume(),
      meshStats: data,
      identityPreserved: true,
      unrelatedObjectsExact: true,
    });
  } finally {
    solid.delete();
  }
}
writeFileSync(
  `${dir}/browser-measurements.json`,
  JSON.stringify(
    {
      mode: 'Independent math and actual solids from offline Chromium exports',
      frame: 'world_xyz_y_up',
      lengthUnit: 'm',
      positionTolerance: 0.001,
      radialTolerance: 0.001,
      volumeRelativeTolerance: 0.02,
      measurements: sphereMeasurements,
    },
    null,
    2,
  ) + '\n',
);
const report = {
  mode: 'Offline replay of archived real-AI geometry and responses; manually authored independent calculation; no new AI reasoning',
  newPaidCalls: 0,
  sourceHashes: fixture.hashes,
  prompt: fixture.prompt,
  preservedOriginalCriteria: legacy,
  suppliedCalculation: derived.checks[4].calculation,
  toleranceMeters: 0.001,
  arithmetic: {
    legacyMiddleZ: oldPoints[2].z,
    calculatedMiddleZ: expected[2].z,
    errorMeters: Math.abs(oldPoints[2].z - expected[2].z),
    formula:
      'u = pitch*(column - (count-1)/2) + rowSign*pitch/4; v = rowSign*separation/2; x=u*cos(angle)-v*sin(angle); z=u*sin(angle)+v*cos(angle); y=0',
  },
  legacyReport,
  correctedReport,
  displacedReport,
  external,
  transactionReplay: {
    scriptedResponses: calls,
    objects: committed.project.volumes.length,
    singleHistoryEntry: true,
    originalObjectsUnchanged: true,
    reloadExact: true,
    undoExact: true,
    redoExact: true,
    verification: result.verification,
  },
};
writeFileSync(
  `${dir}/saved-repair.json`,
  JSON.stringify(report, null, 2) + '\n',
);
writeFileSync(
  `${dir}/replayed.atelier.json`,
  serializeSession(committed) + '\n',
);
console.log(
  JSON.stringify(
    {
      legacyBlocked: !legacyReport.canCommit,
      repairedPositionsVerified: true,
      displacedBlocked: !displacedReport.canCommit,
      externalFacts: external.repaired.length,
      hostStatus: correctedReport.status,
      transactionReplay: report.transactionReplay,
      newPaidCalls: 0,
    },
    (_key, value) => (_key === 'verification' ? undefined : value),
    2,
  ),
);
