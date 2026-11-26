/** Offline transport/authority probes. The mocked SDK never creates a network client. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { conversationHistory } from '../../src/intelligence/client';
import { sceneContext, defaultCamera } from '../../src/intelligence/context';
import { sceneReference } from '../../src/intelligence/sceneReference';
import { inspectScene } from '../../server/sceneInspection';
import { compactScene } from '../../server/agent';
import { readCompletionCriteria } from '../../server/completion';
import { compactCompletionCriteria } from '../../server/completionWire';
import { completionVerifier } from '../../src/intelligence/completionVerifier';
import {
  applyPlan,
  parseSession,
  serializeSession,
} from '../../src/intelligence/engine';
import { equalData } from '../../src/projects/equalData';
import { criteria, decision, revision, prompts, plan } from './session';

const folder = 'docs/evaluations/design-intent';
const result = JSON.parse(
  readFileSync(`${folder}/offline-1/result.json`, 'utf8'),
);
assert(result.turns.slice(0, 6).every((r: any) => r.status === 'PASS'));
const t = result.turns[5];
const original = t.before,
  candidate = t.after,
  history = t.messagesBefore;
const scene = sceneContext(original.project, original.context, defaultCamera);
const currentHistory = conversationHistory(history);
const padding = Array.from({ length: 12 }, (_, i) => [
  {
    role: 'user',
    content: `OFFLINE WINDOW CAPACITY PROBE ${i + 1}; not a real modeled turn.`,
  },
  { role: 'assistant', content: 'Probe acknowledgment.' },
]).flat() as any[];
const longHistory = [...history, ...padding],
  clipped = conversationHistory(longHistory);
assert(
  history.some((m: any) => m.role === 'user' && m.content.includes(decision)),
);
assert(currentHistory.some((m) => m.content.includes(decision)));
assert(!clipped.some((m) => m.content.includes(decision)));
assert(longHistory.length < 80);
const persisted = parseSession(serializeSession(original));
assert(equalData(persisted, original));
assert(
  persisted.project.design?.notes?.some(
    (n) => n.source === 'user' && n.text === decision,
  ),
);
assert(
  compactScene({ ...({} as any), ...scene }).design?.notes?.some(
    (n) => n.text === decision,
  ),
);

// Same correct proposal and same dimension criterion, varying only retained history.
const check = criteria(5, original).checks.find(
  (c) => c.requirement.kind === 'offset',
)!;
const one = {
  modeling: true,
  editable: criteria(5, original).editable,
  checks: [check],
  qualitativeLimits: [],
};
const wire = compactCompletionCriteria(one);
const sdkRequests: any[] = [];
const client: any = {
  responses: {
    create: async (body: any) => {
      sdkRequests.push(body);
      return {
        status: 'completed',
        output_text: JSON.stringify(wire),
        usage: { input_tokens: 0, output_tokens: 0 },
      };
    },
  },
};
const input = (h: any[]) => ({
  message: prompts[5],
  history: h,
  scene,
  candidate: candidate.project.volumes.map((v: any) => ({
    id: v.id,
    name: v.name,
    groupId: v.groupId ?? null,
    role: v.component?.role ?? null,
    level: null,
  })),
});
const settings = {
  model: 'OFFLINE-MOCK-NO-API',
  textApi: 'responses' as const,
  maxOutputTokens: 6000,
  effort: 'low' as const,
};
const visible = await readCompletionCriteria(
  client,
  input(currentHistory) as any,
  settings,
);
assert.equal(visible.checks.length, 1);
let clippedError = '';
try {
  await readCompletionCriteria(client, input(clipped) as any, settings);
} catch (e) {
  clippedError = String(e);
}
assert(clippedError.startsWith('ModelPlanError:'), clippedError);
const blocked = await completionVerifier(original, prompts[5], () =>
  readCompletionCriteria(client, input(clipped) as any, settings),
)(candidate);
assert.equal(blocked.canCommit, false);
assert.equal(blocked.status, 'unverified');
const request: any = {
  ...input(clipped),
  sceneReference: sceneReference(original, scene, defaultCamera),
};
const inspection = inspectScene(request, {
  ids: ['Tabletop', 'Display panel'],
  role: null,
  snapshot: 'before',
  relativeTo: 'Tabletop',
});
assert(inspection.available);
assert.equal((inspection as any).source, 'request_start');
assert(!JSON.stringify(inspection).includes(decision));
const intentPresentInScene = JSON.stringify(
  compactScene(scene as any),
).includes(decision);
assert(intentPresentInScene);

// Source labels are model-authored metadata today, not validated quotations.
const fabricated = (
  await applyPlan(
    original,
    plan([
      {
        type: 'design_note',
        topic: 'Provenance diagnostic',
        text: 'A user decision that was never said in this test conversation.',
        source: 'user',
      },
    ]),
  )
).session;
assert(
  fabricated.project.design?.notes?.some(
    (n) => n.topic === 'Provenance diagnostic' && n.source === 'user',
  ),
);
// A new topic does not supersede an earlier one automatically.
const parallel = (
  await applyPlan(
    original,
    plan([
      {
        type: 'design_note',
        topic: 'Revised cable access',
        text: revision,
        source: 'user',
      },
    ]),
  )
).session;
assert(parallel.project.design?.notes?.some((n) => n.text === decision));
assert(parallel.project.design?.notes?.some((n) => n.text === revision));
const all = {
  label:
    'Offline inspection and real provider-validation probes with a mock SDK, no paid calls. Synthetic history padding is a capacity diagnostic, not a new user session.',
  paidCalls: 0,
  history: {
    savedMessages: history.length,
    transmittedMessages: currentHistory.length,
    originalDecisionAvailable: true,
    paddedStoredMessages: longHistory.length,
    paddedTransmittedMessages: clipped.length,
    paddedDecisionInSavedTranscript: true,
    paddedDecisionInWireHistory: false,
    maxStored: 80,
    maxTransmitted: 20,
    maxCharactersPerMessage: 4000,
  },
  designNotes: {
    roundTrip: true,
    userAndAssumptionDistinct: true,
    notesInExecutorScene: intentPresentInScene,
    notesInReviewerScene: true,
    labelsHaveNoValidatedSourceMessage: true,
    sameTopicReplacement: result.turns[6]?.after?.project.design?.notes,
    parallelTopicsCanConflict: parallel.project.design?.notes,
  },
  inspector: {
    source: (inspection as any).source,
    canRecoverGeometry: true,
    canRecoverReasonFromObjectFacts: false,
    output: inspection,
  },
  reviewer: {
    withUserQuote: 'ACCEPTED',
    withoutUserQuoteDespiteSavedNote: clippedError,
    hostAfterCitationFailure: {
      status: blocked.status,
      canCommit: blocked.canCommit,
      checks: blocked.checks,
    },
  },
  undo: {
    notesTravelWithProject: true,
    conversationTravelsWithProject: false,
    evidence:
      'Browser turns 6–8 use geometry/project Undo and reload while the conversation remains an audit transcript.',
  },
  mockSDKRequests: sdkRequests,
};
writeFileSync(`${folder}/context-probes.json`, JSON.stringify(all, null, 2));
console.log(
  JSON.stringify({
    history: all.history,
    noteCitationFailureReproduced: true,
    host: all.reviewer.hostAfterCitationFailure.status,
    paidCalls: 0,
  }),
);
