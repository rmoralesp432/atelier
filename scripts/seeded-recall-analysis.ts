/** Post-trial offline controls using captured fresh criteria, never paid calls. */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { applyPlan } from '../src/intelligence/engine';
import { equalData } from '../src/projects/equalData';
import {
  openBrowser,
  save,
  state,
  stopOnFeedback,
} from './seeded-decision-diagnostic/browser';
import { circularOccupancy } from './seeded-decision-diagnostic/case';
import { cloneSolid } from './phase3-evaluation/geometry';
import { oracle } from './design-decision-live/geometry';
const root = resolve('.cloud/seeded-recall-live');
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const trial = read(join(root, 'live-1/results.json'));
assert(trial.status !== 'RUNNING', 'Fresh run must finish before analysis');
const folder = join(root, 'offline-controls');
assert(!existsSync(join(folder, 'summary.json')), 'Preserve all attempts');
mkdirSync(folder, { recursive: true });
const fixture = 'docs/evaluations/design-decisions/seeded/fixture';
const binding = read(join(fixture, 'role-bindings.json'));
const seed = read(join(fixture, 'starting-session.json'));
const pedestalId = seed.project.volumes.find(
  (v: any) => v.name === 'Turntable pedestal',
).id;
const results: any = {
  label:
    'Offline controls using unchanged criteria captured from fresh seeded trial; not further AI trials',
  paidCalls: 0,
  turns: [],
  status: 'RUNNING',
};
try {
  for (const turn of [1, 2]) {
    const t = trial.turns.find((t: any) => t.turn === turn);
    if (!t?.committed || !t.measurements?.correct) {
      results.turns.push({ turn, status: 'NOT_REACHED' });
      continue;
    }
    const before = read(join(root, `live-1/turn-${turn}-before.json`));
    const after = read(join(root, `live-1/turn-${turn}-after.json`));
    const messages = read(
      join(root, `live-1/turn-${turn}-history-before.json`),
    );
    const criteria = t.events
      .filter((e: any) => e.kind === 'reviewer' && e.response)
      .at(-1).response;
    const coverage = await circularOccupancy(
      after,
      0.35,
      turn === 1 ? 0.32 : 0.18,
    );
    const pedestal = await cloneSolid(
      after.project.volumes.find((v: any) => v.id === pedestalId),
    );
    const platter = await cloneSolid(
      after.project.volumes.find((v: any) => v.id === binding.turntable),
    );
    const supportGap = pedestal.minGap(platter, 0.02);
    pedestal.delete();
    platter.delete();
    const note = after.project.design.notes.find((n: any) => n.decision);
    const controls: any = {
      turn,
      freshGeometry: {
        circularOccupancy: coverage,
        pedestalContactGap: supportGap,
      },
      freshSavedNote: note,
      criteriaUsedUnchanged: criteria,
    };
    assert(coverage.occupiedM3 < 1e-8 && supportGap <= 0.001);
    const operations =
      turn === 1
        ? [
            {
              type: 'edit_components',
              edits: [
                {
                  targets: [binding.turntable],
                  where: [],
                  translation: { x: 0, y: 0.11, z: 0 },
                  resize: null,
                },
                {
                  targets: [pedestalId],
                  where: [],
                  translation: null,
                  resize: {
                    axis: 'height',
                    mode: 'add',
                    value: 0.11,
                    anchor: 0,
                  },
                },
              ],
            },
          ]
        : [
            {
              type: 'design_note',
              topic: note.topic,
              text: note.text,
              source: 'user',
              capture: {
                quote: t.prompt,
                revises: before.project.design.notes.find(
                  (n: any) => n.decision,
                ).decision.id,
              },
            },
          ];
    const plan: any = {
      intent: 'apply',
      message: 'Offline deliberately wrong geometry control',
      operations,
    };
    const candidate = (
      await applyPlan(before, plan, undefined, true, {
        id: 'offline-negative-control',
        text: t.prompt,
      })
    ).session;
    controls.independentMeasurements = await oracle(
      turn + 11,
      before,
      candidate,
      binding,
    );
    assert(!controls.independentMeasurements.correct);
    save(join(folder, `turn-${turn}-wrong-proposal.json`), candidate);
    const h = await openBrowser(
      join(folder, `turn-${turn}`),
      before,
      messages,
      (input) => {
        stopOnFeedback(input);
        return plan;
      },
      () => criteria,
    );
    try {
      const response = await h.send(`wrong-${turn}`, t.prompt);
      controls.committed = response.committed;
      controls.originalIntact = equalData(
        state(response.before),
        state(response.after),
      );
      const feedback = h.result.events.find(
        (e: any) => e.input.validationFeedback,
      )?.input.validationFeedback;
      controls.feedback = feedback;
      const measured =
        feedback?.verification?.checks.filter(
          (c: any) => c.outcome === 'incorrect',
        ) ?? [];
      controls.status = response.committed
        ? 'WRONG_GEOMETRY_SAVED'
        : measured.length
          ? 'BLOCKED_MEASURED'
          : 'BLOCKED_UNRESOLVED';
      controls.measuredRejections = measured;
      assert(!response.committed && controls.originalIntact);
      controls.reload = await h.reload(response.after);
      h.result.status = controls.status;
      await h.page.screenshot({
        path: join(folder, `turn-${turn}-blocked.png`),
      });
    } finally {
      await h.close();
    }
    results.turns.push(controls);
    save(join(folder, 'summary.json'), results);
  }
  results.status = 'COMPLETE';
} catch (e) {
  results.status = 'ANALYSIS_FAILURE';
  results.error = String(e);
  throw e;
} finally {
  save(join(folder, 'summary.json'), results);
  console.log(
    JSON.stringify({
      status: results.status,
      turns: results.turns.map((t: any) => ({
        turn: t.turn,
        status: t.status,
        originalIntact: t.originalIntact,
      })),
    }),
  );
}
