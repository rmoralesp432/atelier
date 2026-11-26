import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { applyPlan } from '../../src/intelligence/engine';
import { equalData } from '../../src/projects/equalData';
import { conversationHistory } from '../../src/intelligence/client';
import { decisionCitation } from '../../src/design/decisions';
import { openBrowser, save, state, stopOnFeedback } from './browser';
import {
  validateSeed,
  seedMessages,
  sidePlan,
  sideCriteria,
  connectedPlan,
  connectedCriteria,
  inspectSolids,
  prompts,
  originalQuote,
  frozen,
  read,
  bindings,
} from './case';

const folder = resolve(process.argv[2] ?? '.cloud/seeded-decision/recall-1');
assert(!existsSync(join(folder, 'summary.json')), 'Preserve every attempt');
mkdirSync(folder, { recursive: true });
const result: any = {
  label:
    'SEEDED recall-and-revision diagnostic: offline preparation only; responses and criteria scripted',
  application: frozen,
  paidCalls: 0,
  status: 'RUNNING',
  turns: [],
  negativeControls: [],
};
const publish = () => save(join(folder, 'summary.json'), result);
publish();
let turn = 2,
  before: any;
const prepared = process.argv[3];
const gapCheck = (c: any) =>
  c.requirement.kind === 'offset' && c.requirement.axis === 'y';
try {
  const validated = await validateSeed();
  save(join(folder, 'seed-validation.json'), validated);
  before = prepared
    ? read(join(prepared, 'seeded-start-session.json'))
    : validated.session;
  const initialMessages = prepared
    ? read(join(prepared, 'seeded-start-history.json'))
    : seedMessages(before);
  if (prepared) {
    const measurements = await inspectSolids(11, before, before);
    assert(measurements.fullyMeasured);
    result.reusedValidatedFixture = {
      source: prepared,
      label:
        'Reuse successful intervening browser edits; retain failed post-processing attempt separately',
      measurements,
    };
  }
  const h = await openBrowser(
    join(folder, 'browser'),
    before,
    initialMessages,
    (input) => {
      stopOnFeedback(input);
      return turn < 12
        ? sidePlan(turn, before)
        : connectedPlan(turn as 12 | 13, before);
    },
    (input) =>
      turn < 12
        ? sideCriteria(turn, before, input.scene.camera)
        : connectedCriteria(turn as 12 | 13, before),
  );
  let fixture: any, raised: any, firstCriteria: any, revisionCriteria: any;
  try {
    // Genuine ordinary browser turns age the source out. No trimming, rewriting
    // or deletion of conversation to manufacture a recall opportunity.
    for (turn = 2; !prepared && turn <= 11; turn++) {
      before = await h.saved();
      const t = await h.send(`intervening-${turn}`, prompts[turn - 1]);
      assert(t.committed);
      const frame = h.result.events.find(
        (e: any) => e.turn === `intervening-${turn}` && e.kind === 'executor',
      ).input.scene.camera;
      const m = await inspectSolids(turn, before, t.after, frame);
      assert(m.fullyMeasured);
      result.turns.push({
        turn,
        kind: 'scripted intervening work',
        committed: true,
        geometryCorrect: true,
      });
      publish();
    }
    before = await h.saved();
    const fullHistory = await h.chat(),
      recent = conversationHistory(fullHistory);
    assert.equal(fullHistory.length, 22);
    assert.equal(recent.length, 20);
    assert(
      fullHistory.some(
        (m: any) => m.role === 'user' && m.content === prompts[0],
      ),
    );
    assert(
      !recent.some(
        (m: any) =>
          m.content.includes('bulky samples') ||
          m.content.includes(originalQuote),
      ),
    );
    assert(
      !recent.some((m: any) =>
        /32\s*(?:cm|centimet)|0\.32|sample.loading|clearance|bulky samples/i.test(
          m.content,
        ),
      ),
    );
    const decision = before.project.design!.notes![0].decision;
    assert(decision?.quote.includes(originalQuote));
    result.seed = {
      source:
        'Validated reconstruction of rejected saved proposal; source-linked user quote retained; provisional creation history intentionally removed',
      objects: before.project.volumes.length,
      decision,
      fullHistoryCount: fullHistory.length,
      recentCount: recent.length,
      originalUserRetainedInFullHistory: true,
      originalAbsentFromActualRecentWindow: true,
      recentAssistantSemanticReminders: [],
      reload: await h.reload(before),
    };
    fixture = await h.exportProject('seeded-recall-start');
    save(join(folder, 'seeded-start-session.json'), fixture.session);
    save(join(folder, 'seeded-start-history.json'), fixture.messages);
    save(join(folder, 'role-bindings.json'), bindings(fixture.session));
    save(join(folder, 'recent-window.json'), recent);
    await h.page.screenshot({ path: join(folder, 'seeded-start.png') });
    publish();
    for (turn = 12; turn <= 13; turn++) {
      before = await h.saved();
      const label = turn === 12 ? 'recall' : 'revision';
      const t = await h.send(label, prompts[turn - 1]);
      assert(t.committed);
      const ev = h.result.events.filter((e: any) => e.turn === label),
        exec = ev.find((e: any) => e.kind === 'executor'),
        review = ev.find((e: any) => e.kind === 'reviewer');
      assert(exec && review);
      assert.deepEqual(exec.input.scene.camera, review.input.scene.camera);
      const originalDecision = before.project.design!.notes![0].decision!;
      assert.equal(
        exec.input.scene.design.notes[0].decision.id,
        originalDecision.id,
      );
      assert.equal(
        review.input.scene.design.notes[0].decision.id,
        originalDecision.id,
      );
      if (turn === 12) {
        assert.equal(exec.input.history.length, 20);
        assert.equal(review.input.history.length, 20);
        for (const event of [exec, review])
          assert(
            !event.input.history.some((m: any) =>
              /32\s*(?:cm|centimet)|0\.32|sample.loading|clearance|bulky samples/i.test(
                m.content,
              ),
            ),
          );
        assert(
          review.response.checks.some(
            (c: any) => c.source === 'decision' && c.evidence === originalQuote,
          ),
        );
        firstCriteria = review.response;
        raised = { session: t.after, messages: await h.chat() };
      } else {
        revisionCriteria = review.response;
        const d = t.after.project.design!.notes![0].decision!;
        assert.equal(d.id, originalDecision.id);
        assert.equal(d.revision, originalDecision.revision + 1);
        assert.equal(d.quote, prompts[12]);
        assert(review.response.checks.find(gapCheck).source === 'request');
        assert.throws(() =>
          decisionCitation(t.after.project.design!.notes!, originalQuote),
        );
        assert.equal(
          decisionCitation(t.after.project.design!.notes!, prompts[12]).id,
          d.id,
        );
      }
      const m = await inspectSolids(
        turn,
        t.before,
        t.after,
        exec.input.scene.camera,
      );
      assert(m.fullyMeasured);
      save(join(folder, `${label}-measurements.json`), m);
      save(join(folder, `${label}-criteria.json`), review.response);
      const r = {
        turn,
        label,
        scripted: true,
        recallReasoning: 'NOT_TESTED_FRESH_AI',
        reviewerSelection: 'SCRIPTED_NOT_INDEPENDENT_AI',
        reviewerCitation: review.response.checks.filter(
          (c: any) => c.source === 'decision' || gapCheck(c),
        ),
        geometryCorrect: true,
        committed: true,
        changedIds: t.before.project.volumes
          .filter(
            (v: any) =>
              !equalData(
                v,
                t.after.project.volumes.find((n: any) => n.id === v.id),
              ),
          )
          .map((v: any) => ({ id: v.id, name: v.name })),
        preservedIds: t.before.project.volumes
          .filter((v: any) =>
            equalData(
              v,
              t.after.project.volumes.find((n: any) => n.id === v.id),
            ),
          )
          .map((v: any) => ({ id: v.id, name: v.name })),
        allIdsPreserved: t.before.project.volumes.every((v: any) =>
          t.after.project.volumes.some((n: any) => n.id === v.id),
        ),
        history: await h.history(t.before, t.after, label),
        reload: await h.reload(t.after),
      };
      result.turns.push(r);
      await h.exportProject(`seeded-${label}-offline`);
      publish();
    }
    h.result.status = 'PASS';
  } catch (error) {
    h.result.status = 'FAIL';
    h.result.error = String(error);
    throw error;
  } finally {
    await h.close();
  }
  for (const step of [12, 13] as const) {
    const start = step === 12 ? fixture : raised,
      c = step === 12 ? firstCriteria : revisionCriteria;
    const label =
      step === 12 ? 'wrong-raised-table-only' : 'wrong-obsolete-clearance';
    const wrong = connectedPlan(step, start.session, true),
      k = await openBrowser(
        join(folder, label),
        start.session,
        start.messages,
        (input) => {
          stopOnFeedback(input);
          return wrong;
        },
        () => c,
      );
    try {
      const t = await k.send(label, prompts[step - 1]);
      assert(!t.committed);
      assert(equalData(state(t.after), state(t.before)));
      const feedback = k.result.events.find(
        (e: any) => e.input.validationFeedback,
      )?.input.validationFeedback;
      assert(
        feedback?.verification?.checks.some(
          (x: any) =>
            x.id === c.checks.find(gapCheck).requirement.id &&
            x.outcome === 'incorrect',
        ),
      );
      k.result.feedback = feedback;
      k.result.originalIntact = true;
      k.result.reload = await k.reload(t.after);
      // Evaluate actual wrong solids independently from the unchanged scene.
      const origin = {
        id: 'offline-negative-request',
        text: prompts[step - 1],
      };
      const candidate = (
        await applyPlan(start.session, wrong, undefined, true, origin)
      ).session;
      k.result.independentWrongGeometry = await inspectSolids(
        step,
        start.session,
        candidate,
      );
      assert(!k.result.independentWrongGeometry.correct);
      k.result.status = 'BLOCKED_MEASURED';
      result.negativeControls.push({
        step,
        status: 'BLOCKED_MEASURED',
        saved: false,
        originalProjectNotesAndHistoryIntact: true,
        reload: true,
      });
    } catch (error) {
      k.result.status = 'FAIL';
      k.result.error = String(error);
      throw error;
    } finally {
      await k.close();
      publish();
    }
  }
  result.status = 'OFFLINE_READY';
  result.freshScores = {
    recall: 'NOT_RUN',
    reviewerCitation: 'NOT_RUN',
    geometry: 'NOT_RUN',
    browserSave: 'NOT_RUN',
    capture: 'EXCLUDED_SEEDED_FIXTURE',
  };
} catch (error) {
  result.status = 'FAIL';
  result.error = String(error);
  process.exitCode = 1;
} finally {
  publish();
  console.log(
    JSON.stringify({
      status: result.status,
      turns: result.turns.map((t: any) => ({
        turn: t.turn,
        committed: t.committed,
        geometryCorrect: t.geometryCorrect,
      })),
      controls: result.negativeControls,
      error: result.error,
      paidCalls: 0,
    }),
  );
}
