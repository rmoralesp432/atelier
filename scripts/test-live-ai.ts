// This check calls the actual configured provider. No fixtures or local parser.
import assert from 'node:assert/strict';
import { createProvider } from '../server/provider';
import { applyPlan, newSession } from '../src/intelligence/engine';
import { defaultCamera, sceneContext } from '../src/intelligence/context';
import { solidStats } from '../src/geometry/kernel';
if (!process.env.ATELIER_OPENAI_API_KEY) {
  console.error(
    'NOT RUN: ATELIER_OPENAI_API_KEY is absent. Live language understanding is not verified.',
  );
  process.exit(2);
}
const provider = createProvider(process.env.ATELIER_OPENAI_API_KEY);
let session = newSession({ volumes: [], selectedId: null });
const history: { role: 'user' | 'assistant'; content: string }[] = [];
const steps = [
  'Create two boxes.',
  'Move the second one to the right.',
  'Make it taller.',
  'Now overlap them.',
  'Subtract this one from that one.',
  'Actually, undo that and intersect them instead.',
  'Make the result a little wider.',
];
for (const instruction of steps) {
  const plan = await provider.plan({
    message: instruction,
    scene: sceneContext(session.project, session.context, defaultCamera),
    history: history.slice(-20),
  });
  if (plan.intent === 'clarify') {
    console.log(`CLARIFICATION REQUIRED for "${instruction}": ${plan.message}`);
    console.log(
      'Live sequence needs a user answer; not claiming the complete sequence passed.',
    );
    process.exit(2);
  }
  const result = await applyPlan(session, plan, defaultCamera, true);
  session = result.session;
  history.push(
    { role: 'user', content: instruction },
    { role: 'assistant', content: result.message },
  );
  for (const v of session.project.volumes) {
    const stats = await solidStats(v);
    assert.equal(stats.status, 'NoError');
    assert(stats.volume > 0);
  }
  console.log(`VERIFIED LIVE: ${instruction}\n${result.message}`);
}
assert.equal(session.project.volumes.length, 1);
assert.equal(session.project.volumes[0].geometry?.kind, 'boolean');
console.log(
  'PASS: live text success sequence completed with valid geometry. This does not verify microphone audio or arbitrary language understanding.',
);
