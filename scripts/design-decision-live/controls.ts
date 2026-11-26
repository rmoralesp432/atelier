/** Offline deliberate wrong candidates against the captured fresh criteria. No SDK or paid path. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import express from 'express';
import { chromium, expect } from '@playwright/test';
import { createApi } from '../../server/app';
import { TaskBlockedError } from '../../src/intelligence/planFailure';
import { parseSession, serializeSession } from '../../src/intelligence/engine';
import { equalData } from '../../src/projects/equalData';
import { modelingActive } from '../release-evaluation/browser-state';
import { root, prompts } from './config';
import { save } from './budget';
const batch = process.argv[2] ?? 'live-1',
  folder = join(root, batch),
  output = join(folder, 'negative-controls.json');
assert(!existsSync(output), 'Preserve existing controls');
const source = JSON.parse(readFileSync(join(folder, 'results.json'), 'utf8')),
  controls: any[] = [];
const state = (s: any) => ({
  project: s.project,
  past: s.past,
  future: s.future,
  context: s.context,
});
for (const turn of [12, 13]) {
  const primary = source.turns.find((t: any) => t.turn === turn);
  if (!primary?.committed || !primary.measurements?.correct) {
    controls.push({
      turn,
      status: 'NOT_REACHED',
      reason: 'No independently correct committed proposal',
    });
    continue;
  }
  const before = JSON.parse(
    readFileSync(join(folder, `turn-${turn}-before.json`), 'utf8'),
  );
  const history = JSON.parse(
    readFileSync(join(folder, `turn-${turn}-history-before.json`), 'utf8'),
  );
  const reviews = primary.events
    .filter((e: any) => e.kind === 'reviewer' && e.response)
    .map((e: any) => e.response);
  if (!reviews.length) {
    controls.push({
      turn,
      status: 'NOT_REACHED',
      reason: 'No captured independent criteria',
    });
    continue;
  }
  const binding = primary.measurements.binding;
  const originalDecision = before.project.design?.notes?.find((n: any) =>
    n.decision?.quote.includes('32 cm'),
  )?.decision;
  if (turn === 13 && !originalDecision) {
    controls.push({
      turn,
      status: 'NOT_REACHED',
      reason: 'No captured original decision to revise',
    });
    continue;
  }
  const target = before.project.volumes.find(
    (v: any) => v.id === binding.turntable,
  );
  const operations =
    turn === 12
      ? [
          {
            type: 'edit_components',
            edits: [
              {
                targets: [target.id],
                where: [],
                translation: null,
                resize: { axis: 'height', mode: 'add', value: 0.11, anchor: 0 },
              },
            ],
          },
        ]
      : [
          {
            type: 'design_note',
            topic: 'Sample loading',
            text: prompts[12],
            source: 'user',
            capture: { quote: prompts[12], revises: originalDecision.id },
          },
        ];
  const c: any = {
    turn,
    label:
      turn === 12
        ? 'Raise turntable only, leaving the light frame at its pre-edit height'
        : 'Record revised decision but retain obsolete clearance geometry',
    paidCalls: 0,
    events: [],
  };
  controls.push(c);
  let served = false,
    review = 0;
  const app = createApi({
    agent: true,
    voice: async () => {
      throw Error('Excluded');
    },
    plan: async (input) => {
      c.events.push({ kind: 'executor', input });
      if (served)
        throw new TaskBlockedError(
          'Offline negative control ends after host feedback.',
        );
      served = true;
      return {
        intent: 'apply',
        message: 'Deliberately wrong offline control.',
        planning: { stage: 'Control', assumptions: [], next: null },
        operations,
      } as any;
    },
    completionCriteria: async (input) => {
      c.events.push({ kind: 'reviewer', input });
      assert(review < reviews.length, 'No additional criterion is fabricated');
      return reviews[review++];
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
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      storageState: {
        cookies: [],
        origins: [
          {
            origin,
            localStorage: [
              { name: 'atelier.start-direct', value: 'true' },
              { name: 'atelier.session.v2', value: serializeSession(before) },
              {
                name: 'atelier.conversation.v2',
                value: JSON.stringify(history),
              },
            ],
          },
        ],
      },
    });
    await context.route('**/*', (r) =>
      new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
    );
    const p = await context.newPage();
    await p.goto(origin);
    await expect(p.getByTestId('viewport')).toBeVisible({ timeout: 45000 });
    const current = async () =>
      parseSession(
        await p.evaluate(() => localStorage.getItem('atelier.session.v2')!),
      );
    assert(equalData(state(await current()), state(before)));
    await p
      .getByRole('textbox', { name: 'Message Atelier' })
      .fill(prompts[turn - 1]);
    await p.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect
      .poll(
        async () =>
          !(await modelingActive(p)) &&
          (await p.evaluate(
            () =>
              JSON.parse(
                localStorage.getItem('atelier.conversation.v2') ?? '[]',
              ).length,
          )) >=
            history.length + 2,
        { timeout: 120000 },
      )
      .toBe(true);
    c.after = await current();
    c.originalIntact = equalData(state(before), state(c.after));
    c.feedback = c.events.find((e: any) => e.input.validationFeedback)?.input
      .validationFeedback;
    c.status = !c.originalIntact
      ? 'FALSE_SAVE'
      : c.feedback?.verification?.checks.some(
            (x: any) => x.outcome === 'incorrect',
          )
        ? 'BLOCKED_MEASURED'
        : 'BLOCKED_UNRESOLVED_OR_OTHER';
    await p.reload();
    await expect(p.getByTestId('viewport')).toBeVisible();
    c.reloadIntact = equalData(state(before), state(await current()));
    await p.screenshot({ path: join(folder, `negative-${turn}.png`) });
  } catch (e) {
    c.status = 'CONTROL_INCOMPLETE';
    c.error = String(e);
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    save(output, {
      label:
        'Offline controlled perturbations; captured criteria unchanged; no fresh AI',
      controls,
    });
  }
}
save(output, {
  label:
    'Offline controlled perturbations; captured criteria unchanged; no fresh AI',
  controls,
});
console.log(
  JSON.stringify(
    controls.map(({ turn, status, originalIntact, reloadIntact, error }) => ({
      turn,
      status,
      originalIntact,
      reloadIntact,
      error,
    })),
  ),
);
