/** Normal production-build browser with offline-only providers. */
import assert from 'node:assert/strict';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import express from 'express';
import { chromium, expect } from '@playwright/test';
import { createApi } from '../../server/app';
import { readCompletionCriteria } from '../../server/completion';
import { compactCompletionCriteria } from '../../server/completionWire';
import { completionRequestSchema } from '../../server/provider';
import { TaskBlockedError } from '../../src/intelligence/planFailure';
import {
  parseSession,
  serializeSession,
  type Session,
} from '../../src/intelligence/engine';
import { equalData } from '../../src/projects/equalData';
import { projectFile } from '../../src/projects/transfer';
import { modelingActive } from '../release-evaluation/browser-state';

export const save = (p: string, data: unknown) =>
  writeFileSync(p, JSON.stringify(data, null, 2));
export const state = (s: Session) => ({
  project: s.project,
  past: s.past,
  future: s.future,
  context: s.context,
});
export async function openBrowser(
  folder: string,
  initial: Session,
  messages: any[],
  plan: (input: any, event: number) => any,
  criteria: (input: any) => any,
) {
  assert(!existsSync(join(folder, 'result.json')), 'Do not replace evidence');
  mkdirSync(folder, { recursive: true });
  const result: any = {
    label: 'Offline saved/scripted browser replay; not fresh AI',
    paidCalls: 0,
    events: [],
    browserErrors: [],
    status: 'RUNNING',
  };
  let turn = 'opening';
  const publish = () => save(join(folder, 'result.json'), result);
  publish();
  const app = createApi({
    agent: true,
    voice: async () => {
      throw Error('Voice excluded');
    },
    plan: async (input) => {
      const e: any = { kind: 'executor', turn, input };
      result.events.push(e);
      publish();
      try {
        e.response = await plan(
          input,
          result.events.filter(
            (x: any) => x.kind === 'executor' && x.turn === turn,
          ).length - 1,
        );
        return e.response;
      } catch (error) {
        e.error = String(error);
        throw error;
      } finally {
        publish();
      }
    },
    completionCriteria: async (input) => {
      const e: any = { kind: 'reviewer', turn, input };
      result.events.push(e);
      publish();
      try {
        const prescribed = criteria(input);
        const client: any = {
          responses: {
            create: async (request: any) => {
              e.offlineWireRequest = request;
              return {
                status: 'completed',
                output_text: JSON.stringify(
                  compactCompletionCriteria(prescribed),
                ),
              };
            },
          },
        };
        e.response = await readCompletionCriteria(
          client,
          completionRequestSchema.parse(input),
          {
            model: 'OFFLINE-NO-API',
            textApi: 'responses',
            maxOutputTokens: 6000,
          },
        );
        return e.response;
      } catch (error) {
        e.error = String(error);
        throw error;
      } finally {
        publish();
      }
    },
  });
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
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
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
  await context.route('**/*', (r) =>
    new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => {
    result.browserErrors.push(String(error));
    publish();
  });
  const saved = async () =>
    parseSession(
      await page.evaluate(() => localStorage.getItem('atelier.session.v2')!),
    );
  const chat = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem('atelier.conversation.v2') ?? '[]'),
    );
  const durable = async (s: Session) => {
    await expect
      .poll(
        async () => {
          const records = await page.evaluate(
            () =>
              new Promise<any[]>((res, rej) => {
                const q = indexedDB.open('atelier-projects', 1);
                q.onerror = () => rej(q.error);
                q.onsuccess = () => {
                  const db = q.result,
                    r = db
                      .transaction('projects', 'readonly')
                      .objectStore('projects')
                      .getAll();
                  r.onerror = () => rej(r.error);
                  r.onsuccess = () => {
                    db.close();
                    res(r.result);
                  };
                };
              }),
          );
          return records.some((r) =>
            equalData(state(parseSession(r.session)), state(s)),
          );
        },
        { timeout: 30000 },
      )
      .toBe(true);
  };
  const reload = async (s: Session, clear = true) => {
    const prior = await chat();
    await durable(s);
    if (clear)
      await page.evaluate(() => {
        localStorage.removeItem('atelier.session.v2');
        localStorage.removeItem('atelier.conversation.v2');
        localStorage.removeItem('atelier.project.checkpoint');
      });
    await page.reload();
    await expect(page.getByTestId('viewport')).toBeVisible({ timeout: 45000 });
    await expect
      .poll(async () => equalData(state(await saved()), state(s)), {
        timeout: 30000,
      })
      .toBe(true);
    assert.deepEqual(await chat(), prior);
    return {
      project: true,
      notes: true,
      history: true,
      conversation: true,
      indexedDBOnly: clear,
    };
  };
  const history = async (before: Session, after: Session, label: string) => {
    await reload(after);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect
      .poll(async () => equalData((await saved()).project, before.project), {
        timeout: 30000,
      })
      .toBe(true);
    const undone = await saved();
    save(join(folder, `${label}-undone.json`), undone);
    await reload(undone);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect
      .poll(async () => equalData(state(await saved()), state(after)), {
        timeout: 30000,
      })
      .toBe(true);
    assert.equal(after.past.length, before.past.length + 1);
    return {
      undo: true,
      redo: true,
      reloadWhileUndone: true,
      oneAtomicEntry: true,
      notesAndGeometryRestored: true,
    };
  };
  const send = async (label: string, prompt: string) => {
    turn = label;
    const before = await saved(),
      prior = await chat();
    save(join(folder, `${label}-before.json`), before);
    save(join(folder, `${label}-history-before.json`), prior);
    const input = page.getByRole('textbox', { name: 'Message Atelier' });
    if (!(await input.isVisible()))
      await page
        .getByRole('button', { name: 'Voice orb', exact: true })
        .dblclick();
    await input.fill(prompt);
    await page
      .getByRole('button', { name: 'Send message', exact: true })
      .click();
    await expect
      .poll(
        async () =>
          !(await modelingActive(page)) &&
          (await chat()).length >= prior.length + 2,
        { timeout: 120000 },
      )
      .toBe(true);
    const after = await saved();
    await durable(after);
    save(join(folder, `${label}-after.json`), after);
    save(join(folder, `${label}-history-after.json`), await chat());
    await page.screenshot({ path: join(folder, `${label}.png`) });
    return {
      before,
      after,
      committed: !equalData(state(before), state(after)),
    };
  };
  const exportProject = async (label: string) => {
    const s = await saved(),
      messages = await chat();
    await durable(s);
    const f = projectFile({ session: serializeSession(s), messages }, label);
    save(join(folder, `${label}.atelier.json`), JSON.parse(await f.text()));
    await context.storageState({
      path: join(folder, `${label}-browser-state.json`),
    });
    return { session: s, messages };
  };
  const close = async () => {
    publish();
    await browser.close();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  };
  try {
    await page.goto(origin);
    await expect(page.getByTestId('viewport')).toBeVisible({ timeout: 45000 });
    assert(equalData(state(await saved()), state(initial)));
  } catch (error) {
    result.status = 'OPEN_FAILED';
    result.error = String(error);
    await close();
    throw error;
  }
  return {
    result,
    page,
    context,
    saved,
    chat,
    send,
    reload,
    history,
    exportProject,
    publish,
    close,
  };
}
export function stopOnFeedback(input: any) {
  if (input.validationFeedback)
    throw new TaskBlockedError(
      'Offline control ends after measured host feedback. No scripted repair or paid call.',
    );
}
