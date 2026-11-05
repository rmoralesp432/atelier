// Explicit opt-in paid evaluation. Synthetic projects only; never runs in CI.
// Pricing cross-checked 2026-11-05 against the public LiteLLM model table:
// GPT-4.1 $2/M input, $8/M output. Cached discounts deliberately ignored.
// Reserve 125% of a conservative request maximum before sending. Keep failed
// or interrupted calls fully reserved. The ledger survives separate invocations.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createProvider } from '../server/provider';
import { stagedPlan } from '../src/intelligence/checkedPlanner';
import { newSession, type Session } from '../src/intelligence/engine';
import { defaultCamera, sceneContext } from '../src/intelligence/context';
import { solidStats, isProfile } from '../src/geometry/kernel';
import { makeVolume, type Volume } from '../src/model';

const folder = '/tmp/atelier-budgeted-evaluation';
mkdirSync(folder, { recursive: true });
const ledgerPath = `${folder}/ledger.json`;
const ledger: { calls: any[]; results: any[] } = existsSync(ledgerPath)
  ? JSON.parse(readFileSync(ledgerPath, 'utf8'))
  : { calls: [], results: [] };
const persist = () =>
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
const charged = () => ledger.calls.reduce((s, c) => s + c.reserved, 0);
const estimated = () =>
  ledger.calls.reduce((s, c) => s + (c.estimated ?? 0), 0);
let currentCase = '',
  caseCalls = 0;
const paidFetch: typeof fetch = async (url, init) => {
  assert(
    String(url) === 'https://api.openai.com/v1/responses',
    'Unexpected paid endpoint',
  );
  assert(typeof init?.body === 'string');
  const body = JSON.parse(init.body);
  assert(body.model === 'gpt-4.1');
  assert(body.max_output_tokens <= 16000);
  // Body includes system prompt, schema, scene and image bytes. UTF-8 bytes
  // upper-bound text tokens; add 4096 for serialization/tokenizer overhead.
  const reserve =
    1.25 *
    ((Buffer.byteLength(init.body) + 4096) * 0.000002 +
      body.max_output_tokens * 0.000008);
  if (charged() + reserve > 2.8 || ledger.calls.length >= 40 || ++caseCalls > 5)
    throw new Error(
      'Evaluation budget reached before sending another paid request.',
    );
  const item: any = {
    case: currentCase,
    reserved: reserve,
    started: new Date().toISOString(),
  };
  ledger.calls.push(item);
  persist();
  console.log(
    `CALL ${ledger.calls.length} ${currentCase}; estimated spend $${estimated().toFixed(4)}`,
  );
  const response = await fetch(url, init);
  const data = await response.clone().json();
  item.status = response.status;
  // Authentication rejection happened before generation: no token charge.
  if (response.status === 401) item.reserved = 0;
  if (data.usage) {
    item.usage = data.usage;
    item.estimated =
      data.usage.input_tokens * 0.000002 + data.usage.output_tokens * 0.000008;
    item.reserved = item.estimated * 1.25;
  }
  // Never log headers, credentials or authentication error bodies.
  if (response.status === 400) item.schemaError = data.error?.message;
  item.output = data.output;
  persist();
  return response;
};
process.env.ATELIER_TEXT_MODEL = 'gpt-4.1';
const provider = createProvider(
  process.env.ATELIER_OPENAI_API_KEY ?? '',
  paidFetch,
);
const near = (actual: number, expected: number, tolerance = 0.02) =>
  assert(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${expected}, got ${actual}`,
  );
const blank = () => newSession({ volumes: [], selectedId: null });
const box = (
  name: string,
  width: number,
  depth: number,
  height: number,
  x = 0,
  y = 0,
  z = 0,
): Volume => ({
  ...makeVolume(1, { width, depth, height }),
  name,
  position: { x, y, z },
});
const seeded = (...volumes: Volume[]) =>
  newSession({
    volumes,
    selectedId: volumes[0]?.id ?? null,
    selectedIds: volumes[0] ? [volumes[0].id] : [],
  });
const save = (name: string, s: Session) =>
  writeFileSync(`${folder}/${name}.json`, JSON.stringify(s));
const restore = (name: string): Session =>
  JSON.parse(readFileSync(`${folder}/${name}.json`, 'utf8'));
async function design(s: Session, message: string) {
  const result = await stagedPlan(
    s,
    defaultCamera,
    async (working, validationFeedback, execution) => {
      const plan = await provider.plan({
        message,
        scene: sceneContext(working.project, working.context, defaultCamera),
        history: [],
        historyAvailability: {
          undo: working.past.length,
          redo: working.future.length,
        },
        validationFeedback,
        execution,
        workspace: {
          mapVisible: false,
          mapConfigured: true,
          view: 'perspective',
          theme: 'day',
          renderMode: 'studio',
        },
      });
      writeFileSync(
        `${folder}/${currentCase}-plan-${caseCalls}.json`,
        JSON.stringify(plan, null, 2),
      );
      return plan;
    },
  );
  if (!result.prepared)
    throw new Error(`Needs clarification: ${result.plan.message}`);
  for (const v of result.prepared.session.project.volumes)
    if (!isProfile(v)) {
      const stats = await solidStats(v);
      assert.equal(stats.status, 'NoError');
      assert(stats.volume > 0, `Empty solid: ${v.name}`);
    }
  save(currentCase, result.prepared.session);
  return result;
}
const cases: Record<string, () => Promise<void>> = {
  async dimensions() {
    const r = await design(
      blank(),
      'Create one rectangular volume called Atrium, 10 meters wide, 6 meters deep and 4 meters tall, raised 2 meters above ground. Center it at x=0 and z=0.',
    );
    const [v] = r.prepared!.session.project.volumes;
    assert.equal(r.prepared!.session.project.volumes.length, 1);
    near(v.dimensions.width, 10);
    near(v.dimensions.depth, 6);
    near(v.dimensions.height, 4);
    near(v.position.y, 2);
    near((await solidStats(v)).volume, 240);
  },
  async correction() {
    const s = restore('dimensions'),
      old = s.project.volumes[0];
    const r = await design(
      s,
      'Actually make it 6 meters tall, move it two meters to my right and rotate it 45 degrees. Keep its 10 by 6 meter footprint and its base at the same height.',
    );
    const v = r.prepared!.session.project.volumes[0];
    assert.equal(v.id, old.id);
    near(v.dimensions.height, 6);
    near(v.dimensions.width, 10);
    near(v.dimensions.depth, 6);
    near(v.position.x, 2);
    near(v.position.y, 2);
    near(v.rotation, 45);
  },
  async polar_array() {
    const r = await design(
      blank(),
      'Create exactly 10 rectangular volumes, each 2 by 4 meters and 3 meters high, in a circular array around the origin. Place their centers at radius 5 meters, equally spaced. Ground level.',
    );
    const vs = r.prepared!.session.project.volumes;
    assert.equal(vs.length, 10);
    for (const v of vs) {
      near(Math.hypot(v.position.x, v.position.z), 5);
      near(v.dimensions.height, 3);
      near((await solidStats(v)).volume, 24);
    }
    const angles = vs
      .map((v) => Math.atan2(v.position.z, v.position.x))
      .sort((a, b) => a - b);
    for (let i = 1; i < 10; i++) near(angles[i] - angles[i - 1], Math.PI / 5);
  },
  async subtract() {
    const r = await design(
      seeded(box('Block', 4, 4, 4), box('Cutter', 2, 2, 4)),
      'Subtract Cutter from Block to create a square hole through the full height. I confirm the subtraction; retain only the result in the scene.',
    );
    const vs = r.prepared!.session.project.volumes;
    assert.equal(vs.length, 1);
    near((await solidStats(vs[0])).volume, 48);
    assert.equal(vs[0].geometry?.kind, 'boolean');
  },
  async undo_intersect() {
    const r = await design(
      restore('subtract'),
      'Actually, undo that and intersect the same two original volumes instead. I confirm the intersection.',
    );
    const vs = r.prepared!.session.project.volumes;
    assert.equal(vs.length, 1);
    near((await solidStats(vs[0])).volume, 16);
    assert.equal(vs[0].geometry?.kind, 'boolean');
  },
  async gallery() {
    const r = await design(
      blank(),
      'Create a two-level gallery, 12 by 8 meters. Two occupied slabs, 20 cm thick, with base elevations 0 and 3.2 m, plus a 20 cm roof slab at elevation 6.2 m. Six round columns, 30 cm diameter, in two rows of three, run from the ground slab top to the roof underside. Glaze the long sides and leave the short ends open. Make slabs, columns, glass and frames independent editable members, grouped as Gallery.',
    );
    const vs = r.prepared!.session.project.volumes;
    assert.equal(vs.filter((v) => v.component?.role === 'floor').length, 2);
    assert.equal(vs.filter((v) => v.component?.role === 'roof').length, 1);
    const cs = vs.filter((v) => v.component?.role === 'column');
    assert.equal(cs.length, 6);
    for (const c of cs) {
      near(c.dimensions.width, 0.3);
      near(c.dimensions.depth, 0.3);
      near(
        (await solidStats(c)).volume,
        Math.PI * 0.15 ** 2 * c.dimensions.height,
        0.01,
      );
    }
    assert(vs.some((v) => v.material === 'glass'));
  },
  async scoped_columns() {
    const s = restore('gallery'),
      before = s.project.volumes;
    const r = await design(
      s,
      'Change only the Gallery columns to 40 cm diameter. Keep their positions and heights, and leave every slab, frame and pane exactly unchanged.',
    );
    for (const v of before) {
      const n = r.prepared!.session.project.volumes.find((n) => n.id === v.id);
      assert(n, 'Lost stable identity');
      if (v.component?.role === 'column') {
        near(n.dimensions.width, 0.4);
        near(n.dimensions.depth, 0.4);
        near(n.dimensions.height, v.dimensions.height);
        assert.deepEqual(n.position, v.position);
      } else assert.deepEqual(n, v);
    }
  },
  async organic() {
    const r = await design(
      blank(),
      'Create a simplified architectural massing: a continuous curved roof ribbon spanning 20 meters along X, 6 meters wide, about 30 cm thick. It rises smoothly from 3 meters at both ends to 8 meters at the center. Use an editable curved form, with a solid thickness, not a rectangular block.',
    );
    const vs = r.prepared!.session.project.volumes;
    assert(vs.length >= 1 && vs.length <= 4);
    assert(
      vs.some((v) => ['form', 'sculpt'].includes(v.geometry?.kind ?? '')),
      'Expected retained editable form',
    );
  },
  async extrusion() {
    const r = await design(
      blank(),
      'Draw a rectangular 2D footprint 6 by 8 meters on the ground and extrude it upward 3 meters into a solid. Keep only the resulting solid.',
    );
    const vs = r.prepared!.session.project.volumes;
    assert.equal(vs.length, 1);
    near((await solidStats(vs[0])).volume, 144);
    near(vs[0].dimensions.height, 3);
  },
  async workspace() {
    const s = seeded(box('Existing model', 6, 4, 3));
    const r = await design(
      s,
      'Turn on the map, switch to orthographic view, use night mode and show hidden lines. Do not edit my model.',
    );
    const actions = r.plan.operations
      .filter((o) => o.type === 'workspace')
      .map((o) => o.action);
    for (const action of [
      'map_on',
      'view_orthographic',
      'theme_night',
      'display_hidden_line',
    ])
      assert(actions.includes(action as any), `Missing ${action}`);
    assert.deepEqual(r.prepared!.session.project.volumes, s.project.volumes);
  },
};
const requested = process.argv
  .filter((v) => v.startsWith('--case='))
  .map((v) => v.slice(7));
if (!process.argv.includes('--live')) {
  console.log(
    JSON.stringify(
      {
        cases: Object.keys(cases),
        targetUSD: 2,
        conservativeLedgerLimitUSD: 2.8,
        maximumAuthorizedUSD: 3,
        estimatedUSD: estimated(),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
assert(
  requested.length,
  'Choose explicit --case= names; never run every case implicitly.',
);
const firstResult = ledger.results.length;
for (const name of requested) {
  assert(cases[name], `Unknown case ${name}`);
  currentCase = name;
  caseCalls = 0;
  const start = Date.now();
  try {
    await cases[name]();
    ledger.results.push({
      case: name,
      status: 'PASS',
      seconds: (Date.now() - start) / 1000,
    });
  } catch (e) {
    const error = e as any;
    ledger.results.push({
      case: name,
      status: 'FAIL',
      seconds: (Date.now() - start) / 1000,
      error: error.status
        ? `Provider ${error.status} ${error.code ?? ''}`
        : String(error.message).slice(0, 2000),
    });
    if (error.status === 401 || error.status === 429) {
      persist();
      break;
    }
  }
  persist();
  console.log(JSON.stringify(ledger.results.at(-1)));
}
console.log(
  JSON.stringify(
    {
      calls: ledger.calls.length,
      estimatedUSD: estimated(),
      conservativeLedgerUSD: charged(),
      results: ledger.results,
    },
    null,
    2,
  ),
);

if (ledger.results.slice(firstResult).some((r) => r.status !== 'PASS'))
  process.exitCode = 1;
