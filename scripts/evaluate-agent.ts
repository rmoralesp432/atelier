/** Explicitly authorized, opt-in live evaluation. Never included in CI.
 * Run a local dev server first, then: node --use-env-proxy --import tsx
 * scripts/evaluate-agent.ts --paid <case> <model> [legacy]
 * Pricing estimates use the published LiteLLM table (2026-11-12), ignoring
 * cached discounts. This is a conservative local ledger, not an account cap.
 */
import assert from 'node:assert/strict';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createProvider, requestSchema } from '../server/provider';
import { stagedPlan } from '../src/intelligence/checkedPlanner';
import {
  newSession,
  serializeSession,
  type Session,
} from '../src/intelligence/engine';
import { sceneContext, defaultCamera } from '../src/intelligence/context';
import { solidStats, isProfile } from '../src/geometry/kernel';
import type { SceneObservation } from '../src/intelligence/observation';

assert(
  process.argv[2] === '--paid',
  'Paid generation requires explicit --paid opt-in.',
);
const scenario = process.argv[3];
const runId = Date.now().toString(36);
const model = process.argv[4] ?? 'gpt-6.1-sol';
const agent = process.argv[5] !== 'legacy';
const prices: Record<string, [number, number]> = {
  'gpt-4.1': [2, 8],
  'gpt-6.1-sol': [2, 10],
  'gpt-6-astra': [10, 50],
};
assert(prices[model], 'No reviewed price for this model.');
const folder = '.cloud/agent-evaluation';
mkdirSync(folder, { recursive: true });
const ledgerPath = `${folder}/ledger.json`;
assert(
  existsSync(ledgerPath),
  'Evaluation ledger is missing. Restore prior spend before starting paid tests; never reset a lost ledger to zero.',
);
const ledger: { carryForwardUsd: number; calls: any[]; results: any[] } =
  JSON.parse(readFileSync(ledgerPath, 'utf8'));
assert(
  Number.isFinite(ledger.carryForwardUsd) && ledger.carryForwardUsd >= 0,
  'Missing carried-forward spend.',
);
const persist = () =>
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
const charged = () =>
  ledger.carryForwardUsd +
  ledger.calls.reduce((n, c) => n + (c.estimated ?? c.reserved), 0);
let turnCalls = 0;
const paidFetch: typeof fetch = async (url, init) => {
  assert(
    [
      'https://api.openai.com/v1/responses',
      'https://api.openai.com/v1/chat/completions',
    ].includes(String(url)),
  );
  assert(typeof init?.body === 'string');
  const body = JSON.parse(init.body);
  assert.equal(body.model, model);
  let images = 0;
  const text = JSON.stringify(body, (_key, value) => {
    if (typeof value === 'string' && value.startsWith('data:image/')) {
      images++;
      return '[image]';
    }
    return value;
  });
  const maximum = body.max_output_tokens ?? body.max_completion_tokens;
  assert(maximum <= 10000);
  const [inputRate, outputRate] = prices[model];
  const reserve =
    (1.25 *
      ((Buffer.byteLength(text) + 4096 + images * 16000) * inputRate +
        maximum * outputRate)) /
    1e6;
  assert(
    charged() + reserve <= 3,
    `Budget guard: estimated/reserved $${charged().toFixed(3)} plus next reservation $${reserve.toFixed(3)} exceeds $3.`,
  );
  assert(
    ledger.calls.length < 40 && ++turnCalls <= 8,
    'Evaluation call limit reached.',
  );
  const record: any = {
    scenario,
    model,
    agent,
    reserved: reserve,
    started: new Date().toISOString(),
  };
  ledger.calls.push(record);
  persist();
  console.log(
    `Call ${ledger.calls.length} ${model} ${scenario}; estimated/reserved $${charged().toFixed(3)}`,
  );
  const result = await fetch(url, init);
  const data = await result.clone().json();
  record.status = result.status;
  record.modelReturned = data.model;
  record.elapsedMs = Date.now() - Date.parse(record.started);
  if ([400, 401, 403, 404].includes(result.status)) record.reserved = 0;
  if (data.usage) {
    record.usage = data.usage;
    record.estimated =
      ((data.usage.input_tokens ?? data.usage.prompt_tokens) * inputRate +
        (data.usage.output_tokens ?? data.usage.completion_tokens) *
          outputRate) /
      1e6;
  }
  // Do not persist headers, credentials or authentication error bodies.
  if (result.status === 400) record.schemaError = data.error?.message;
  record.output = data.output ?? data.choices;
  persist();
  return result;
};
process.env.ATELIER_TEXT_MODEL = model;
const provider = createProvider(
  process.env.ATELIER_OPENAI_API_KEY ?? '',
  paidFetch,
  { agent, textApi: 'responses', maxOutputTokens: 10000 },
);
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4173');
let session = newSession({ volumes: [], selectedId: null });
const history: { role: 'user' | 'assistant'; content: string }[] = [];
let turn = 0;
async function design(message: string) {
  turn++;
  turnCalls = 0;
  const label = `${scenario}-${model}-${agent ? 'agent' : 'legacy'}-${runId}-${turn}`;
  const started = Date.now();
  let revision = -1,
    observation: SceneObservation | undefined;
  const requests: any[] = [];
  try {
    const result = await stagedPlan(
      session,
      defaultCamera,
      async (working, validationFeedback, execution) => {
        const next = (execution?.receipts ?? []).filter(
          (r) => r.created.length || r.changed.length || r.removed.length,
        ).length;
        if (agent && revision !== next) {
          observation = await page.evaluate(
            async (project) => {
              const { renderObservation } =
                await import('/src/intelligence/renderObservation.ts');
              return renderObservation(project);
            },
            JSON.parse(JSON.stringify(working.project)),
          );
          revision = next;
          for (let i = 0; i < (observation?.views.length ?? 0); i++)
            writeFileSync(
              `${folder}/${label}-stage${next}-${i}.jpg`,
              Buffer.from(observation!.views[i].image.split(',')[1], 'base64'),
            );
        }
        const input = requestSchema.parse({
          message,
          history,
          scene: sceneContext(working.project, working.context, defaultCamera),
          validationFeedback,
          execution,
          observation,
          workspace: {
            mapVisible: false,
            mapConfigured: true,
            view: 'perspective',
            theme: 'day',
            renderMode: 'studio',
          },
        });
        const plan = await provider.plan(input, AbortSignal.timeout(120000));
        requests.push({
          scene: input.scene,
          validationFeedback,
          execution,
          observation: observation
            ? {
                ...observation,
                views: observation.views.map((v) => ({ label: v.label })),
              }
            : null,
          plan,
        });
        writeFileSync(
          `${folder}/${label}-steps.json`,
          JSON.stringify(requests, null, 2),
        );
        console.log(
          `${label}: ${plan.intent} ${plan.operations.map((o) => o.type).join(',')}`,
        );
        return plan;
      },
      console.log,
      undefined,
      { agent },
    );
    assert(
      result.prepared,
      `No model committed: ${result.plan.intent}: ${result.plan.message}`,
    );
    assert(
      !result.reviewRequired,
      'Requires user review (not automatically accepted in evaluation).',
    );
    session = result.prepared.session;
    const stats = [];
    for (const v of session.project.volumes)
      if (!isProfile(v)) {
        const s = await solidStats(v);
        assert.equal(s.status, 'NoError');
        assert(s.volume > 0);
        stats.push({ id: v.id, volume: s.volume });
      }
    writeFileSync(`${folder}/${label}-session.json`, serializeSession(session));
    history.push(
      { role: 'user', content: message },
      { role: 'assistant', content: result.plan.message },
    );
    ledger.results.push({
      label,
      message,
      status: 'executed',
      elapsedMs: Date.now() - started,
      objects: session.project.volumes.length,
      stages: result.stages,
      final: result.plan.message,
      stats,
    });
    persist();
    return result;
  } catch (error) {
    ledger.results.push({
      label,
      message,
      status: 'failed',
      elapsedMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    persist();
    throw error;
  }
}
const near = (n: number, e: number) =>
  assert(Math.abs(n - e) < 0.02, `Expected ${e}, observed ${n}`);
try {
  if (scenario === 'array') {
    await design(
      'Make an arrangement of 7 rows by 9 columns of separate two-metre cubes, with their centres five metres apart in both directions. Centre the whole arrangement on the origin.',
    );
    const cubes = session.project.volumes;
    assert.equal(cubes.length, 63);
    assert.equal(
      new Set(cubes.map((v) => `${v.position.x},${v.position.z}`)).size,
      63,
    );
    near(Math.min(...cubes.map((v) => v.position.x)), -20);
    near(Math.max(...cubes.map((v) => v.position.z)), 15);
    const ids = cubes.map((v) => v.id);
    await design(
      'Make only the northernmost row twice as tall. Keep their bases on the ground and leave all other cubes alone.',
    );
    assert.deepEqual(
      session.project.volumes.map((v) => v.id),
      ids,
    );
    for (const v of session.project.volumes) {
      near(v.dimensions.height, v.position.z === -15 ? 4 : 2);
      near(v.position.y, 0);
    }
  } else if (scenario === 'building') {
    await design(
      'Create a four-storey building, 18 metres wide and 12 deep. Make the ground floor 6 metres high and each upper floor 3.5 metres high. Give it separate editable slabs, a roof, columns, and a glazed facade. Keep it a simple architectural study.',
    );
    const roles = new Set(
      session.project.volumes.map((v) => v.component?.role),
    );
    for (const role of ['floor', 'roof', 'column'])
      assert(roles.has(role), `Missing ${role}`);
    assert(
      session.project.volumes.some((v) => v.material === 'glass'),
      'Missing actual glazing',
    );
    await design(
      'The columns feel too close to the edge. Bring them one metre farther into the building without moving the facade or changing the floors.',
    );
  } else if (scenario === 'chair') {
    await design(
      'Model a simple sculptural lounge chair: two curved timber side supports, a suspended seat between them and a separate inclined backrest. Overall about 75 cm wide, 90 cm deep and 85 cm high. Use a calm continuous curve for the supports; keep the main pieces separately editable.',
    );
    await design(
      'Make the backrest more upright so it works as a reading chair. Keep the side supports and overall width unchanged.',
    );
  } else if (scenario === 'environment') {
    await design(
      'Add a six-metre cube, show it in an orthographic view from the northeast at a 45-degree elevation, then show the sun path and animate the time.',
    );
  } else throw new Error('Unknown evaluation case');
  ledger.results.push({
    scenario,
    model,
    agent,
    status:
      scenario === 'array'
        ? 'acceptance-passed'
        : 'execution-only-needs-review',
  });
  persist();
} catch (error) {
  console.log(
    'EVALUATION FAILURE:',
    error instanceof Error ? error.message : String(error),
  );
  ledger.results.push({
    scenario,
    model,
    agent,
    status: 'acceptance-failed',
    error: error instanceof Error ? error.message : String(error),
  });
  persist();
  process.exitCode = 1;
} finally {
  await browser.close();
  console.log(
    `Estimated/reserved total $${charged().toFixed(4)}; ledger ${ledgerPath}`,
  );
}
