import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  fixture,
  reference,
  oracle,
  pass,
  negativeOperation,
  plan,
  tasks,
  type Task,
} from './fixtures';
import {
  applyPlan,
  serializeSession,
  parseSession,
} from '../../src/intelligence/engine';
import { validateVolume } from '../../src/model';
import { authorizeNext, accounted } from './budget';
import { docs, versions } from './config';
mkdirSync(`${docs}/fixtures`, { recursive: true });
const checks: any[] = [];
const l = { ceilingUSD: 3, maximumCalls: 20, calls: [] as any[] };
authorizeNext(l, 0.2, 'test');
l.calls.push({ reservedUsd: 2.8, outcome: 'interrupted-reservation-retained' });
assert.equal(accounted(l), 2.8);
assert.throws(() => authorizeNext(l, 0.201, 'test'));
authorizeNext(l, 0.19, 'test');
l.calls = Array.from({ length: 20 }, () => ({ reservedUsd: 0.001 }));
assert.throws(() => authorizeNext(l, 0.001, 'test'));
checks.push({
  name: 'Aggregate accounting and call limit before send, unknown reservations retained',
  passed: true,
});
for (const v of Object.values(versions))
  assert.equal(
    execFileSync(
      'git',
      [
        '-C',
        v.path,
        'diff',
        v.commit,
        '--',
        'src',
        'server',
        'package.json',
        'package-lock.json',
      ],
      { encoding: 'utf8' },
    ),
    '',
  );
assert(
  JSON.parse(readFileSync(`${docs}/preflight.json`, 'utf8')).pricing.unchanged,
);
for (const task of ['A', 'B'] as Task[]) {
  const { session, moves, relations } = fixture(task);
  session.project.volumes.forEach((v) => validateVolume(v));
  const text = serializeSession(session);
  assert.deepEqual(parseSession(text).project, session.project);
  const beforeFacts = await oracle(task, session, session, false);
  const after = await reference(task, session);
  const facts = await oracle(task, session, after);
  const wrong = (
    await applyPlan(after, plan([negativeOperation(task)]), undefined, true)
  ).session;
  const wrongFacts = await oracle(task, session, wrong);
  const body = {
    task,
    prompt: tasks[task].prompt,
    history: tasks[task].history,
    before: session,
    expected: after,
    wrong,
    moves,
    relations,
    beforeFacts,
    facts,
    wrongFacts,
  };
  writeFileSync(
    `${docs}/fixtures/${task}.json`,
    JSON.stringify(body, null, 2) + '\n',
  );
  assert(
    pass(beforeFacts),
    JSON.stringify(beforeFacts.filter((f) => f.status !== 'verified')),
  );
  assert(
    pass(facts),
    JSON.stringify(facts.filter((f) => f.status !== 'verified')),
  );
  assert(!pass(wrongFacts));
  checks.push({
    name: task,
    passed: true,
    components: session.project.volumes.length,
    positiveChecks: facts.length,
    negativeFailures: wrongFacts
      .filter((f) => f.status !== 'verified')
      .map((f) => f.name),
    sha256: createHash('sha256')
      .update(readFileSync(`${docs}/fixtures/${task}.json`))
      .digest('hex'),
  });
}
writeFileSync(
  `${docs}/calibration.json`,
  JSON.stringify(
    { passed: true, at: new Date().toISOString(), paidCalls: 0, checks },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(checks, null, 2));
