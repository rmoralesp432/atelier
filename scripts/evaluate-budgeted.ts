// Explicit opt-in paid evaluation. Synthetic projects only; never runs in CI.
// Pricing cross-checked 2026-11-05 against the public LiteLLM model table:
// GPT-4.1 $2/M input, $8/M output. Cached discounts deliberately ignored.
// Reserve 125% of a conservative request maximum before sending. Keep failed
// or interrupted calls fully reserved. The ledger survives separate invocations.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createProvider } from '../server/provider';
import { parsePlan } from '../src/intelligence/plan';
import { stagedPlan } from '../src/intelligence/checkedPlanner';
import { newSession, type Session } from '../src/intelligence/engine';
import { defaultCamera, sceneContext } from '../src/intelligence/context';
import { solidStats, isProfile } from '../src/geometry/kernel';
import { equalData } from '../src/projects/equalData';
import { makeVolume, type Volume } from '../src/model';

const folder = '/tmp/atelier-budgeted-evaluation';
mkdirSync(folder, { recursive: true });
const ledgerPath = `${folder}/ledger.json`;
const ledger: { calls: any[]; results: any[] } = existsSync(ledgerPath)
  ? JSON.parse(readFileSync(ledgerPath, 'utf8'))
  : { calls: [], results: [] };
const persist = () =>
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
const charged = () =>
  ledger.calls.reduce((s, c) => s + (c.estimated ?? c.reserved), 0);
const estimated = () =>
  ledger.calls.reduce((s, c) => s + (c.estimated ?? 0), 0);
const replay = process.argv.includes('--replay');
let currentCase = '',
  caseCalls = 0;
const paidFetch: typeof fetch = async (url, init) => {
  assert(!replay, 'Replay must never spend credits');
  assert(
    String(url) === 'https://api.openai.com/v1/chat/completions',
    'Unexpected paid endpoint',
  );
  assert(typeof init?.body === 'string');
  const body = JSON.parse(init.body);
  assert(body.model === 'gpt-4.1');
  assert(body.max_completion_tokens <= 16000);
  // Body includes system prompt, schema, scene and image bytes. UTF-8 bytes
  // upper-bound text tokens; add 4096 for serialization/tokenizer overhead.
  const reserve =
    1.25 *
    ((Buffer.byteLength(init.body) + 4096) * 0.000002 +
      body.max_completion_tokens * 0.000008);
  if (
    estimated() >= 2.9 ||
    charged() + reserve > 3.4 ||
    ledger.calls.length >= 60 ||
    ++caseCalls > 5
  )
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
      data.usage.prompt_tokens * 0.000002 +
      data.usage.completion_tokens * 0.000008;
    item.reserved = item.estimated * 1.25;
  }
  // Never log headers, credentials or authentication error bodies.
  if (response.status === 400) item.schemaError = data.error?.message;
  item.output = data.choices;
  persist();
  return response;
};
process.env.ATELIER_TEXT_MODEL = 'gpt-4.1';
const provider = createProvider(
  process.env.ATELIER_OPENAI_API_KEY ?? '',
  paidFetch,
  { textApi: 'chat_completions', maxOutputTokens: 6000 },
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
      if (replay) {
        if (++caseCalls > 1)
          throw new Error(
            'Saved first response needs additional corrections; replay stops without network.',
          );
        return parsePlan(
          JSON.parse(
            readFileSync(`${folder}/${currentCase}-plan-1.json`, 'utf8'),
          ),
        );
      }
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
  async grid_ipr() {
    const r = await design(
      blank(),
      'Crea una retícula de 3 líneas por 3 líneas, separadas 12 metros, centrada en el origen. En cada uno de sus 9 cruces coloca una columna IPR de 4 metros de altura, con sección exterior de 30 por 30 cm, alma de 12 mm y patines de 20 mm. Cada columna debe ser una sección I real, no un prisma rectangular. Apóyalas en el suelo y agrúpalas como Estructura.',
    );
    const vs = r.prepared!.session.project.volumes;
    assert.equal(vs.length, 9);
    const occupied = new Set<string>();
    for (const v of vs) {
      near(v.dimensions.width, 0.3);
      near(v.dimensions.depth, 0.3);
      near(v.dimensions.height, 4);
      near(v.position.y, 0);
      assert(
        v.geometry?.kind === 'form' &&
          v.geometry.definition.method === 'profile' &&
          v.geometry.definition.shape === 'i_section',
        'Expected retained I-section',
      );
      near(
        (await solidStats(v)).volume,
        (2 * 0.3 * 0.02 + (0.3 - 2 * 0.02) * 0.012) * 4,
        0.001,
      );
      for (const n of [v.position.x, v.position.z])
        assert([-12, 0, 12].some((e) => Math.abs(n - e) < 0.01));
      occupied.add(`${v.position.x},${v.position.z}`);
    }
    assert.equal(occupied.size, 9);
  },
  async mixed_levels() {
    const r = await design(
      blank(),
      'Crea un edificio volumétrico de 5 plantas ocupadas, de 20 por 12 metros. Las dos primeras plantas tienen cada una una altura entre niveles de 8 metros (doble altura); las tres restantes tienen cada una 4 metros. Las caras superiores de las losas ocupadas deben estar a 0.2, 8.2, 16.2, 20.2 y 24.2 metros. Cubierta con base a 28 metros. Todas las losas de 20 cm. Crea las losas y cubierta como componentes separados y editables. No añadas fachada, columnas ni detalles en esta primera prueba.',
    );
    const vs = r.prepared!.session.project.volumes;
    const slabs = vs
      .filter((v) => v.component?.role === 'floor')
      .sort((a, b) => a.position.y - b.position.y);
    assert.equal(slabs.length, 5);
    const bases = [0, 8, 16, 20, 24];
    slabs.forEach((v, i) => {
      near(v.position.y, bases[i]);
      near(v.dimensions.height, 0.2);
      near(v.dimensions.width, 20);
      near(v.dimensions.depth, 12);
    });
    const roofs = vs.filter((v) => v.component?.role === 'roof');
    assert.equal(roofs.length, 1);
    near(roofs[0].position.y, 28);
    assert.equal(vs.length, 6);
  },
  async bridge() {
    const s = seeded(box('East', 8, 8, 6, 10), box('West', 8, 8, 6, -10));
    const r = await design(
      s,
      'Añade una pasarela recta de 3 metros de ancho y 30 cm de espesor que conecte East con West a nivel de cubierta. El tablero debe tener su cara superior a 6 metros. Une sus caras enfrentadas, sin mover ni modificar los dos edificios. No añadas barandales.',
    );
    const vs = r.prepared!.session.project.volumes;
    assert.equal(vs.length, 3);
    for (const v of s.project.volumes)
      assert(
        equalData(
          v,
          vs.find((n) => n.id === v.id),
        ),
      );
    const link = vs.find((v) => !s.project.volumes.some((n) => n.id === v.id))!;
    near(link.position.y + link.dimensions.height, 6);
    near(link.dimensions.height, 0.3);
    near(link.position.x, 0);
    near(link.position.z, 0);
    near(link.dimensions.width * link.dimensions.depth, 12 * 3);
  },
  async window() {
    const r = await design(
      blank(),
      'Crea un muro llamado Muro de 8 metros de ancho, 30 cm de espesor y 4 metros de alto, en el suelo. Abre un hueco circular de 2 metros de diámetro centrado horizontalmente, con el centro a 2 metros de altura. Añade vidrio de 2 cm y marco circular de 8 cm de ancho y 10 cm de profundidad, como componentes independientes vinculados al muro. Confirmo el corte.',
    );
    const vs = r.prepared!.session.project.volumes;
    const wall = vs.find((v) => v.name === 'Muro');
    assert(wall);
    near((await solidStats(wall)).volume, 8 * 0.3 * 4 - Math.PI * 0.3, 0.04);
    assert(
      vs.some((v) => v.material === 'glass' && v.component?.hostId === wall.id),
    );
    assert(
      vs.some(
        (v) => v.component?.role === 'frame' && v.component?.hostId === wall.id,
      ),
    );
  },
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
      } else assert(equalData(n, v), `Unrelated component changed: ${v.name}`);
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
    assert(equalData(r.prepared!.session.project.volumes, s.project.volumes));
  },
};
const requested = process.argv
  .filter((v) => v.startsWith('--case='))
  .map((v) => v.slice(7));
if (!process.argv.includes('--live') && !replay) {
  console.log(
    JSON.stringify(
      {
        cases: Object.keys(cases),
        targetUSD: 2,
        targetStopUSD: 2.9,
        conservativeLedgerLimitUSD: 3.4,
        maximumAuthorizedUSD: 4,
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
      mode: replay ? 'offline replay of live response' : 'live',
      status: 'PASS',
      seconds: (Date.now() - start) / 1000,
    });
  } catch (e) {
    const wrapped = e as any;
    const error = wrapped.cause?.message?.includes('Evaluation budget')
      ? wrapped.cause
      : wrapped;
    ledger.results.push({
      case: name,
      mode: replay ? 'offline replay of live response' : 'live',
      status:
        error.message?.includes('Evaluation budget') || error.code === 'ENOENT'
          ? 'BLOCKED'
          : 'FAIL',
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
