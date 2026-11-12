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
  parseSession,
  type Session,
} from '../src/intelligence/engine';
import { sceneContext, defaultCamera } from '../src/intelligence/context';
import { solidStats, isProfile } from '../src/geometry/kernel';
import { groupBounds } from '../src/geometry/spatial';
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
let blockedReason: string | undefined;
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
  if (
    charged() >= 2.9 ||
    charged() + reserve > 4 ||
    ledger.calls.length >= 40 ||
    ++turnCalls > 12
  ) {
    blockedReason = `Evaluation stopped before another paid call: estimated/reserved $${charged().toFixed(3)}, next reservation $${reserve.toFixed(3)}; target $3, authorized ceiling $4, per-turn call limit 12.`;
    throw new Error(blockedReason);
  }
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
process.env.ATELIER_AGENT_MODEL = model;
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
await page.route('**/__agent_evaluation', (r) =>
  r.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Local geometry observation</title>',
  }),
);
await page.goto('http://127.0.0.1:4173/__agent_evaluation');
await page.evaluate(async () => {
  const { setKernelWasmUrl } = await import('/src/geometry/kernel.ts');
  const wasm = await import('/node_modules/manifold-3d/manifold.wasm?url');
  setKernelWasmUrl(wasm.default);
});
const resume = process.argv.indexOf('--resume');
const resumePath = resume >= 0 ? process.argv[resume + 1] : null;
if (resumePath)
  assert(
    resumePath.startsWith('.cloud/agent-evaluation/') &&
      !resumePath.includes('..') &&
      /-(session|provisional)\.json$/.test(resumePath),
    'Resume only synthetic evaluation sessions.',
  );
let session = resumePath
  ? parseSession(readFileSync(resumePath, 'utf8'))
  : newSession({ volumes: [], selectedId: null });
const history: { role: 'user' | 'assistant'; content: string }[] = [];
let turn = 0;
let referenceImages: string[] | undefined;
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
        writeFileSync(
          `${folder}/${label}-provisional.json`,
          serializeSession(working),
        );
        const input = requestSchema.parse({
          message,
          images: referenceImages,
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
      error:
        blockedReason ??
        (error instanceof Error ? error.message : String(error)),
    });
    persist();
    throw error;
  }
}
const near = (n: number, e: number) =>
  assert(Math.abs(n - e) < 0.02, `Expected ${e}, observed ${n}`);
try {
  if (scenario === 'reference') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><rect width="640" height="640" fill="white"/><g font-family="Arial" fill="black" font-size="20"><text x="70" y="27">PLAN — dimensions in metres</text><path d="M70 80 H490 V200 H310 V350 H70 Z" fill="#dedede" stroke="black" stroke-width="3"/><g stroke="black" fill="none"><path d="M70 60 H490 M70 53 V67 M490 53 V67 M45 80 V350 M38 80 H52 M38 350 H52 M310 220 H490 M520 200 V350"/></g><text x="255" y="53">14 m</text><text x="3" y="220">9 m</text><text x="378" y="248">6 m</text><text x="530" y="280">5 m</text><text x="170" y="378">8 m</text><text x="550" y="60">N</text><path d="M558 98 V72 l-5 9 m5 -9 l5 9" stroke="black" fill="none"/><text x="70" y="440">SECTION THROUGH LONG WING</text><path d="M70 480 H490 V570 H70 Z" fill="#dedede" stroke="black" stroke-width="3"/><path d="M45 480 V570 M38 480 H52 M38 570 H52" stroke="black" fill="none"/><text x="3" y="530">3 m</text><text x="70" y="607">Flat roof. Solid conceptual mass.</text></g></svg>`;
    await page.setContent(svg);
    const image = await page.screenshot({
      clip: { x: 0, y: 0, width: 640, height: 640 },
    });
    writeFileSync(`${folder}/unfamiliar-reference.png`, image);
    referenceImages = ['data:image/png;base64,' + image.toString('base64')];
    await design(
      'Use this unfamiliar floor plan and section to reconstruct an editable volumetric interpretation of the overall building mass. Follow the dimensions and shape shown, including the missing corner. No facade details.',
    );
    assert.equal(
      session.project.volumes.length,
      1,
      'Expected one editable mass',
    );
    const v = session.project.volumes[0];
    near(v.dimensions.width, 14);
    near(v.dimensions.depth, 9);
    near(v.dimensions.height, 3);
    near((await solidStats(v)).volume, 288);
  } else if (scenario === 'followup') {
    const at = process.argv.indexOf('--instruction');
    assert(at >= 0 && process.argv[at + 1], 'Missing follow-up instruction');
    await design(process.argv[at + 1]);
  } else if (scenario === 'array') {
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
    const floors = session.project.volumes
      .filter((v) => v.component?.role === 'floor')
      .sort((a, b) => a.position.y - b.position.y);
    assert.equal(floors.length, 4, 'Expected four occupied floors');
    floors.forEach((v) => {
      near(v.dimensions.width, 18);
      near(v.dimensions.depth, 12);
    });
    near(floors[1].position.y - floors[0].position.y, 6);
    near(floors[2].position.y - floors[1].position.y, 3.5);
    near(floors[3].position.y - floors[2].position.y, 3.5);
    const before = structuredClone(session.project.volumes);
    await design(
      'The columns feel too close to the edge. Bring them one metre farther into the building without moving the facade or changing the floors.',
    );
    const after = new Map(session.project.volumes.map((v) => [v.id, v]));
    for (const v of before) {
      const next = after.get(v.id);
      assert(next, 'Original object identity was lost');
      if (v.component?.role !== 'column')
        assert.deepEqual(next, v, 'An unrelated element changed');
      else {
        assert.deepEqual(next.dimensions, v.dimensions);
        near(next.position.y, v.position.y);
      }
    }
    const oldBounds = groupBounds(
      before.filter((v) => v.component?.role === 'column'),
    );
    const newBounds = groupBounds(
      session.project.volumes.filter((v) => v.component?.role === 'column'),
    );
    near(newBounds.min.x, oldBounds.min.x + 1);
    near(newBounds.max.x, oldBounds.max.x - 1);
    near(newBounds.min.z, oldBounds.min.z + 1);
    near(newBounds.max.z, oldBounds.max.z - 1);
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
    status: ['array', 'building', 'reference'].includes(scenario)
      ? 'acceptance-passed'
      : 'execution-only-needs-review',
  });
  persist();
} catch (error) {
  console.log(
    'EVALUATION FAILURE:',
    blockedReason ?? (error instanceof Error ? error.message : String(error)),
  );
  ledger.results.push({
    scenario,
    model,
    agent,
    status: 'acceptance-failed',
    error:
      blockedReason ?? (error instanceof Error ? error.message : String(error)),
  });
  persist();
  process.exitCode = 1;
} finally {
  await browser.close();
  console.log(
    `Estimated/reserved total $${charged().toFixed(4)}; ledger ${ledgerPath}`,
  );
}
