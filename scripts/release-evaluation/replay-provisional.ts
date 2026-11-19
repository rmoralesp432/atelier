/** Offline diagnostic. Never substitutes for a real-AI finish or browser commit. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyPlan,
  serializeSession,
  type Session,
} from '../../src/intelligence/engine';
import { sceneContext, defaultCamera } from '../../src/intelligence/context';
import { save } from '../completion-evaluation/budget';
import { oracle, measurements } from './cases';
import { replayResponse } from './replay';

const folder = process.argv[2];
assert(folder && !process.argv[3]);
const trace = JSON.parse(readFileSync(`${folder}/results.json`, 'utf8'));
const building = trace.results.find((r: any) => r.id === 'building');
const original: Session = JSON.parse(
  readFileSync(`${folder}/building-original.json`, 'utf8'),
);
let provisional = structuredClone(original);
let steps = 0;
for (const event of building.events) {
  if (!event.response) break;
  assert.equal(event.kind, 'executor');
  assert.equal(event.response.intent, 'apply');
  const input = {
    ...event.input,
    scene: sceneContext(
      provisional.project,
      provisional.context,
      defaultCamera,
    ),
  };
  const plan = replayResponse(event.input, input, event.response);
  provisional = (await applyPlan(provisional, plan)).session;
  steps++;
}
const facts = await oracle('building', original, provisional);
save(`${folder}/offline-provisional-measurements.json`, {
  status: 'OFFLINE_DIAGNOSTIC_ONLY',
  source:
    'Unmodified saved real-AI operations reexecuted by the actual geometry engine; IDs regenerated and scene equivalence checked before every replay.',
  realAiFinish: false,
  browserCommitVerified: false,
  steps,
  components: provisional.project.volumes.length,
  facts,
  measurements: await measurements(provisional.project.volumes),
});
save(
  `${folder}/offline-provisional.atelier.json`,
  JSON.parse(serializeSession(provisional)),
);
console.log(
  JSON.stringify({
    steps,
    components: provisional.project.volumes.length,
    verified: facts.filter((f) => f.status === 'verified').length,
    remaining: facts.filter((f) => f.status !== 'verified'),
  }),
);
