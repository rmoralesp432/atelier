import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { applyPlan } from '../../src/intelligence/engine';
import { verifyCompletion } from '../../src/intelligence/completion';
import {
  validateSeed,
  startFrame,
  prompts,
  sidePlan,
  sideCriteria,
  connectedPlan,
  connectedCriteria,
  inspectSolids,
} from './case';
const result: any = {
  label: 'Offline numerical and scripted-operation calibration only',
  paidCalls: 0,
  turns: [],
};
let s = (await validateSeed()).session;
try {
  for (let turn = 2; turn <= 13; turn++) {
    const before = s,
      plan = turn < 12 ? sidePlan(turn, s) : connectedPlan(turn as 12 | 13, s),
      checks =
        turn < 12
          ? sideCriteria(turn, s, startFrame)
          : connectedCriteria(turn as 12 | 13, s);
    s = (
      await applyPlan(s, plan, startFrame, true, {
        id: `offline-calibration-${turn}`,
        text: prompts[turn - 1],
      })
    ).session;
    const host = await verifyCompletion(checks, before, s),
      measurements = await inspectSolids(turn, before, s, startFrame);
    result.turns.push({ turn, host, measurements });
    assert(
      host.canCommit && measurements.fullyMeasured,
      `Calibration turn ${turn}`,
    );
  }
  result.status = 'PASS';
} catch (error) {
  result.status = 'FAIL';
  result.error = String(error);
  process.exitCode = 1;
}
writeFileSync(
  process.argv[2] ?? '.cloud/seeded-decision/calibration.json',
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify({
    status: result.status,
    error: result.error,
    turns: result.turns.map((t: any) => ({
      turn: t.turn,
      canCommit: t.host.canCommit,
      correct: t.measurements.fullyMeasured,
    })),
    paidCalls: 0,
  }),
);
