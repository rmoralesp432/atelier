/** Offline normal-browser rehearsal. Every provider response is explicitly scripted. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import express from 'express';
import { chromium, expect } from '@playwright/test';
import {
  parseSession,
  serializeSession,
  type Session,
} from '../../src/intelligence/engine';
import { verifyCompletion } from '../../src/intelligence/completion';
import { requestSchema, completionRequestSchema } from '../../server/provider';
import { readCompletionCriteria } from '../../server/completion';
import { compactCompletionCriteria } from '../../server/completionWire';
import { conversationHistory } from '../../src/intelligence/client';
import { inspectScene } from '../../server/sceneInspection';
import { equalData } from '../../src/projects/equalData';
import { modelingActive } from '../release-evaluation/browser-state';
import {
  empty,
  plan,
  sequence,
  stepOperations,
  stepFacts,
  stepCriteria,
  decision,
  revision,
  label,
} from './session';

const folder = resolve(
  process.argv[2] ?? 'docs/evaluations/design-decisions/offline-1',
);
assert(!existsSync(join(folder, 'result.json')), 'Never overwrite an attempt');
mkdirSync(folder, { recursive: true });
const result: any = {
  label,
  paidCalls: 0,
  started: new Date().toISOString(),
  turns: [],
  negativeControls: [],
  requests: [],
  browserErrors: [],
};
const save = () =>
  writeFileSync(join(folder, 'result.json'), JSON.stringify(result, null, 2));
const app = express();
app.use(express.static(resolve('dist')));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((r) => server.on('listening', r));
const origin = `http://127.0.0.1:${(server.address() as any).port}`;
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
let step = 0,
  negative = false,
  served = false,
  before = empty(),
  negativeOps: any[] = [];
const model = (s: Session) => ({
  project: s.project,
  past: s.past,
  future: s.future,
  context: s.context,
});
const saved = async (p: any) =>
  parseSession(
    await p.evaluate(() => localStorage.getItem('atelier.session.v2')!),
  );
const chat = async (p: any) =>
  p.evaluate(() =>
    JSON.parse(localStorage.getItem('atelier.conversation.v2') ?? '[]'),
  );
async function open(initial = empty(), messages: any[] = []) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    storageState: {
      cookies: [],
      origins: [
        {
          origin,
          localStorage: [
            { name: 'atelier.start-direct', value: 'true' },
            { name: 'atelier.session.v2', value: serializeSession(initial) },
            {
              name: 'atelier.conversation.v2',
              value: JSON.stringify(messages),
            },
          ],
        },
      ],
    },
  });
  await context.route('**/*', (r: any) =>
    new URL(r.request().url()).origin === origin &&
    !new URL(r.request().url()).pathname.startsWith('/api/')
      ? r.continue()
      : r.abort(),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e: any) => {
    result.browserErrors.push(String(e));
    save();
  });
  await page.route('**/api/config', (r: any) =>
    r.fulfill({
      json: {
        configured: true,
        authenticated: true,
        agentConfigured: true,
        voiceConfigured: false,
      },
    }),
  );
  await page.route('**/api/plan', async (r: any) => {
    const body = r.request().postDataJSON();
    const record: any = { turn: step + 1, negative, kind: 'executor', body };
    result.requests.push(record);
    save();
    if (negative && served)
      return r.fulfill({
        status: 422,
        json: {
          code: 'modeling_blocked',
          error:
            'Offline negative control: stop after the host reports the measured failure; no scripted repair.',
        },
      });
    if (body.validationFeedback)
      return r.fulfill({
        status: 422,
        json: {
          code: 'modeling_blocked',
          error:
            'Offline rehearsal encountered unexpected host feedback; preserve this failure.',
        },
      });
    record.inspectionProbe = {
      label:
        'Harness invocation of existing inspector, not an autonomous AI tool call',
      result: inspectScene(requestSchema.parse(body), {
        ids: [],
        role: null,
        snapshot: 'before',
        relativeTo: step === 0 ? null : 'Tabletop',
      }),
    };
    served = true;
    record.scriptedResponse = plan(
      negative ? negativeOps : stepOperations(step, before),
    );
    save();
    await r.fulfill({ json: record.scriptedResponse });
  });
  await page.route('**/api/completion-criteria', async (r: any) => {
    const body = r.request().postDataJSON();
    const scripted = stepCriteria(step, before);
    // Real request validation and independent-review citation parser; only the
    // model's structured response is scripted. No network-capable SDK is used.
    const sdk: any = {
      responses: {
        create: async () => ({
          status: 'completed',
          output_text: JSON.stringify(compactCompletionCriteria(scripted)),
        }),
      },
    };
    const response = await readCompletionCriteria(
      sdk,
      completionRequestSchema.parse(body),
      { model: 'OFFLINE-NO-API', textApi: 'responses', maxOutputTokens: 6000 },
    );
    result.requests.push({
      turn: step + 1,
      negative,
      kind: 'reviewer',
      body,
      scriptedResponse: response,
    });
    save();
    await r.fulfill({ json: response });
  });
  await page.goto(origin);
  await expect(page.getByTestId('viewport')).toBeVisible({ timeout: 45000 });
  await expect
    .poll(async () => equalData(model(await saved(page)), model(initial)), {
      timeout: 20000,
    })
    .toBe(true);
  return page;
}
async function send(page: any) {
  const count = (await chat(page)).length;
  await page
    .getByRole('textbox', { name: 'Message Atelier' })
    .fill(sequence[step].prompt);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await chat(page)).length >= count + 2 && !(await modelingActive(page)),
      { timeout: 90000 },
    )
    .toBe(true);
}
async function durable(page: any, expected: Session) {
  const records = async () =>
    page.evaluate(
      () =>
        new Promise<any[]>((resolve, reject) => {
          const q = indexedDB.open('atelier-projects', 1);
          q.onerror = () => reject(q.error);
          q.onsuccess = () => {
            const db = q.result;
            const r = db
              .transaction('projects', 'readonly')
              .objectStore('projects')
              .getAll();
            r.onerror = () => reject(r.error);
            r.onsuccess = () => {
              db.close();
              resolve(r.result);
            };
          };
        }),
    );
  await expect
    .poll(
      async () => {
        const r = await records();
        return r.some((r: any) =>
          equalData(model(parseSession(r.session)), model(expected)),
        );
      },
      { timeout: 20000 },
    )
    .toBe(true);
  return await records();
}
async function reload(page: any, expected: Session, clearCheckpoint = false) {
  const history = await chat(page);
  const stored = await durable(page, expected);
  if (clearCheckpoint)
    await page.evaluate(() => {
      localStorage.removeItem('atelier.session.v2');
      localStorage.removeItem('atelier.conversation.v2');
      localStorage.removeItem('atelier.project.checkpoint');
    });
  await page.reload();
  await expect(page.getByTestId('viewport')).toBeVisible();
  await expect
    .poll(async () => equalData(model(await saved(page)), model(expected)))
    .toBe(true);
  assert(equalData(history, await chat(page)));
  return {
    project: true,
    history: true,
    conversation: true,
    context: true,
    viaIndexedDB: clearCheckpoint,
    storedProjectIds: stored.map((p: any) => p.id),
  };
}
let page: any;
try {
  page = await open();
  result.emptyProjectVerified =
    (await saved(page)).project.volumes.length === 0;
  for (step = 0; step < sequence.length; step++) {
    before = await saved(page);
    const messagesBefore = await chat(page);
    const turn: any = {
      turn: step + 1,
      prompt: sequence[step].prompt,
      originalSessionStep: sequence[step].base,
      before,
      messagesBefore,
    };
    result.turns.push(turn);
    save();
    if (sequence[step].base === 5 || sequence[step].base === 7)
      turn.preEditReload = await reload(page, before, true);
    served = false;
    await send(page);
    const after = await saved(page);
    turn.after = after;
    turn.messagesAfter = await chat(page);
    turn.facts = await stepFacts(after, step, before);
    turn.host = await verifyCompletion(
      stepCriteria(step, before),
      before,
      after,
    );
    assert(
      turn.facts.every((x: any) => x.passed),
      JSON.stringify(turn.facts.filter((x: any) => !x.passed)),
    );
    assert(turn.host.canCommit);
    assert.equal(after.past.length, before.past.length + 1);
    turn.durable = await durable(page, after);
    const active = after.project.design?.notes?.find(
      (n) => n.decision,
    )?.decision;
    assert(active);
    assert.equal(
      active.quote,
      sequence[step].base === 6 ||
        sequence[step].base === 7 ||
        step > sequence.findIndex((s) => s.base === 6)
        ? revision
        : decision,
    );
    const sourceMessage = turn.messagesAfter.find(
      (m: any) => m.id === active.origin.id,
    );
    assert(
      sourceMessage?.role === 'user' &&
        sourceMessage.content === active.origin.text,
    );
    turn.provenance = {
      id: active.id,
      revision: active.revision,
      quote: active.quote,
      sourceMessageId: active.origin.id,
    };
    if (sequence[step].base === 5 || sequence[step].base === 7) {
      const recent = conversationHistory(messagesBefore);
      assert(
        !recent.some((m) => m.content.includes(active.quote)),
        'The decision must actually leave recent history.',
      );
      const transported = result.requests.filter(
        (r: any) => r.turn === step + 1 && !r.negative,
      );
      assert(transported.some((r: any) => r.kind === 'executor'));
      assert(transported.some((r: any) => r.kind === 'reviewer'));
      for (const r of transported) {
        assert(
          !r.body.history.some((m: any) => m.content.includes(active.quote)),
        );
        assert(
          r.body.scene.design.notes.some(
            (n: any) => n.decision?.quote === active.quote,
          ),
        );
      }
      turn.recoversBeyondWindow = true;
    }
    turn.status = 'PASS';
    save();
    if ([0, 5, 6, 7].includes(sequence[step].base!))
      await page.screenshot({ path: join(folder, `turn-${step + 1}.png`) });
    if ([5, 6, 7].includes(sequence[step].base!)) {
      turn.reload = await reload(page, after);
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await expect
        .poll(async () =>
          equalData((await saved(page)).project, before.project),
        )
        .toBe(true);
      const undone = await saved(page);
      turn.undoDecision = undone.project.design?.notes;
      await reload(page, undone, true);
      await page.getByRole('button', { name: 'Redo', exact: true }).click();
      await expect
        .poll(async () => equalData(model(await saved(page)), model(after)))
        .toBe(true);
      turn.redoDecision = (await saved(page)).project.design?.notes;
      turn.undoRedo = true;
      save();
    }
  }
  result.final = await saved(page);
  result.finalMessages = await chat(page);
  await page.context().close();
  page = null;
  // Same session's dependent controls, with no scripted repair or fresh reasoning.
  for (const base of [5, 6]) {
    const n = sequence.findIndex((s) => s.base === base);
    step = n;
    negative = true;
    served = false;
    before = result.turns[n].before;
    negativeOps =
      base === 5
        ? stepOperations(n, before).slice(0, -1)
        : stepOperations(n, before).filter(
            (op: any) => op.type === 'design_note',
          );
    const control: any = {
      turn: n + 1,
      label:
        base === 5
          ? 'Panel left behind when table grows'
          : 'Obsolete 30 cm gap retained after explicit 15 cm revision',
    };
    result.negativeControls.push(control);
    save();
    page = await open(before, result.turns[n].messagesBefore);
    await send(page);
    control.after = await saved(page);
    control.originalIntact = equalData(model(before), model(control.after));
    assert(control.originalIntact);
    control.feedback = result.requests
      .filter(
        (r: any) => r.negative && r.turn === n + 1 && r.body.validationFeedback,
      )
      .at(-1)?.body.validationFeedback;
    assert.equal(control.feedback?.verification?.status, 'incorrect');
    control.reload = await reload(page, before, true);
    control.status = 'BLOCKED_MEASURED';
    save();
    await page.context().close();
    page = null;
  }
  result.status = 'PASS';
} catch (e) {
  result.status = 'FAILED';
  result.error = String(e);
  if (page) result.lastSaved = await saved(page).catch(() => null);
  throw e;
} finally {
  if (page) await page.context().close();
  await browser.close();
  server.close();
  result.finished = new Date().toISOString();
  save();
  console.log(
    JSON.stringify({
      status: result.status,
      turns: result.turns.map((t: any) => ({ turn: t.turn, status: t.status })),
      controls: result.negativeControls.map((c: any) => c.status),
      error: result.error,
    }),
  );
}
