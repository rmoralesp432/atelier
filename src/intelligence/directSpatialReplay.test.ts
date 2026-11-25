import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { applyPlan, type Session } from './engine';
import { verifyCompletion } from './completion';
import { directCriteria } from '../../tests/fixtures/direct-spatial/directCriteria';
import {
  oracle,
  pass,
  seed,
} from '../../scripts/reliability-evaluation/geometry';

for (const name of ['shelf', 'conveyor']) {
  it(`saved ${name}: retains old failure, verifies direct relationships, blocks a 20 mm displacement`, async () => {
    const f = JSON.parse(
      readFileSync(`tests/fixtures/direct-spatial/${name}.json`, 'utf8'),
    );
    const before = f.before as Session;
    let candidate = before;
    for (const response of f.stages)
      candidate = (await applyPlan(candidate, response)).session;
    const original = await verifyCompletion(
      f.originalCriteria,
      before,
      candidate,
    );
    expect(original.canCommit).toBe(false);
    expect(
      original.criterionIssues?.some((i) => i.code === 'invalid_calculation'),
    ).toBe(true);
    const c = directCriteria(f.task, f.originalCriteria);
    const correct = await verifyCompletion(c, before, candidate);
    expect(
      correct.canCommit,
      JSON.stringify(correct.checks.filter((v) => !v.met)),
    ).toBe(true);
    expect(correct.status).toBe('verified');
    expect(
      pass(await oracle(f.task, seed(f.task), before, candidate, true)),
    ).toBe(true);
    const wrong = structuredClone(candidate);
    const target = wrong.project.volumes.find((v) =>
      v.name.includes(name === 'shelf' ? 'shelf board' : 'Support leg'),
    )!;
    target.position[name === 'shelf' ? 'x' : 'z'] += 0.02;
    const rejected = await verifyCompletion(c, before, wrong);
    expect(rejected.canCommit).toBe(false);
    expect(
      rejected.checks.filter((v) => v.outcome === 'incorrect').map((v) => v.id),
    ).toEqual(name === 'shelf' ? ['bay-left', 'bay-right'] : ['leg-rail']);
    expect(pass(await oracle(f.task, seed(f.task), before, wrong, true))).toBe(
      false,
    );
    // In particular: an off-center leg still touches its wide rail. Contact
    // alone is insufficient; the new original-offset measurement catches it.
    if (name === 'conveyor')
      expect(rejected.checks.find((v) => v.id === 'check-11')!.met).toBe(true);
  }, 30000);
}
