// Optional live evaluation, never part of npm test or CI. Uses the actual model
// and checks evaluated geometry; no prerecorded plans, building templates or
// language parser. Model calls are bounded and can incur API charges.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { createProvider } from '../server/provider';
import { stagedPlan } from '../src/intelligence/checkedPlanner';
import {
  applyPlan,
  directPlan,
  newSession,
  type Session,
} from '../src/intelligence/engine';
import { defaultCamera, sceneContext } from '../src/intelligence/context';
import { solidStats, isProfile } from '../src/geometry/kernel';
import { makeVolume } from '../src/model';

const seedArg = process.argv.find((v) => v.startsWith('--seed='));
const seed = Number(seedArg?.split('=')[1] ?? 17);
if (!Number.isFinite(seed)) throw new Error('Use a numeric --seed.');
const width = 12 + Math.abs(seed % 5) * 2,
  depth = 8 + Math.abs(seed % 3) * 2;
const folder = '/tmp/atelier-architecture-evaluation';
await mkdir(folder, { recursive: true });
async function references() {
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/chromium')
      ? '/usr/bin/chromium'
      : undefined,
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1000, height: 650 },
    });
    const images: string[] = [];
    for (const [name, drawing] of [
      [
        'plan',
        `<text x="50" y="55">FLOOR PLAN · same outline at both levels</text><rect x="160" y="150" width="640" height="360" fill="none" stroke="black" stroke-width="8"/><text x="430" y="125">${width} m outside</text><text x="820" y="330">${depth} m</text><text x="190" y="550">Walls 0.20 m · no partitions</text>`,
      ],
      [
        'section',
        `<text x="50" y="55">SECTION · two occupied levels + roof</text><path d="M160 500H800 M160 340H800 M160 180H800" fill="none" stroke="black" stroke-width="12"/><path d="M160 500V180 M800 500V180" stroke="black" stroke-width="8"/><text x="820" y="505">+0.00 m</text><text x="820" y="345">+3.20 m</text><text x="820" y="185">+6.20 m</text><text x="170" y="575">Slabs 0.20 m · roof top +6.40 m</text>`,
      ],
    ]) {
      await page.setContent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="650" style="background:white;font:22px sans-serif">${drawing}</svg>`,
      );
      const image = await page.screenshot({ path: `${folder}/${name}.png` });
      images.push(`data:image/png;base64,${image.toString('base64')}`);
    }
    return images;
  } finally {
    await browser.close();
  }
}
const images = await references();
if (!process.argv.includes('--live')) {
  console.log(
    `Prepared varied plan/section references in ${folder}. No model called. Run npm run test:live-architecture -- --live --seed=${seed} with a configured key to evaluate real language/vision.`,
  );
  process.exit(0);
}
if (!process.env.ATELIER_OPENAI_API_KEY) {
  console.error(
    'NOT RUN: configure ATELIER_OPENAI_API_KEY securely; never put it in command arguments.',
  );
  process.exit(2);
}
const provider = createProvider(process.env.ATELIER_OPENAI_API_KEY);
let calls = 0;
const results: { test: string; status: string; detail: string }[] = [];
async function design(session: Session, message: string, refs?: string[]) {
  const result = await stagedPlan(
    session,
    defaultCamera,
    async (working, validationFeedback, execution) => {
      if (++calls > 16)
        throw new Error('Evaluation model-call budget exhausted.');
      return provider.plan({
        message,
        images: refs,
        scene: sceneContext(working.project, working.context, defaultCamera),
        history: [],
        historyAvailability: {
          undo: working.past.length,
          redo: working.future.length,
        },
        validationFeedback,
        execution,
      });
    },
  );
  if (!result.prepared)
    throw new Error(`Needs user input: ${result.plan.message}`);
  for (const v of result.prepared.session.project.volumes)
    if (!isProfile(v)) {
      const stats = await solidStats(v);
      assert.equal(stats.status, 'NoError');
      assert(stats.volume > 0);
    }
  return result.prepared.session;
}
async function evaluate(name: string, work: () => Promise<void>) {
  try {
    await work();
    results.push({
      test: name,
      status: 'PASS',
      detail: 'Actual model output executed and geometric assertions passed.',
    });
  } catch (error) {
    const e = error as { status?: number; code?: string; message?: string };
    // Do not print raw provider errors, which may contain sensitive prompts.
    if (e.status) {
      results.push({
        test: name,
        status: 'BLOCKED',
        detail: `Provider status ${e.status}; code ${e.code ?? 'unknown'}. Live capability not verified.`,
      });
      await writeFile(
        `${folder}/results.json`,
        JSON.stringify({ seed, calls, results }, null, 2),
      );
      console.log(JSON.stringify({ seed, calls, results }, null, 2));
      process.exit(2);
    }
    results.push({
      test: name,
      status: 'FAIL',
      detail: (e.message ?? 'Evaluation failed').slice(0, 1000),
    });
  }
}
await evaluate(
  'unfamiliar editable assembly and scoped modification',
  async () => {
    const marker = {
      ...makeVolume(),
      name: 'Existing neighbor',
      position: { x: -60, y: 0, z: 0 },
    };
    let s = await design(
      newSession({ volumes: [marker], selectedId: null }),
      `Create a small two-level gallery, ${width} by ${depth} m. Two 20 cm occupied slabs at base elevations 0 and 3.2 m, and a 20 cm roof slab at 6.2 m. Six round columns, 30 cm diameter, in two rows of three, run from the ground slab top to the roof underside. Glaze the long sides and leave the short ends open. Make the slabs, columns, glass and frames independent editable members, grouped as Gallery; choose sensible framing. Keep the existing neighbor untouched. Verify the floor count and column diameters.`,
    );
    assert.deepEqual(
      s.project.volumes.find((v) => v.id === marker.id),
      marker,
    );
    assert.equal(
      s.project.volumes.filter((v) => v.component?.role === 'floor').length,
      2,
    );
    assert.equal(
      s.project.volumes.filter((v) => v.component?.role === 'roof').length,
      1,
    );
    const columns = s.project.volumes.filter(
      (v) => v.component?.role === 'column',
    );
    assert.equal(columns.length, 6);
    for (const column of columns) {
      const expectedVolume = Math.PI * 0.15 ** 2 * column.dimensions.height;
      assert(
        Math.abs((await solidStats(column)).volume - expectedVolume) /
          expectedVolume <
          0.01,
        'Column does not have circular solid volume',
      );
      assert(Math.abs(column.dimensions.width - 0.3) < 0.001);
      assert(Math.abs(column.dimensions.depth - 0.3) < 0.001);
    }
    assert(s.project.volumes.some((v) => v.material === 'glass'));
    const before = s.project.volumes;
    s = await design(
      s,
      'Make only the Gallery columns 40 cm in diameter. Keep their heights and positions, and leave all glass, slabs and neighboring geometry exactly as it is.',
    );
    for (const previous of before) {
      const v = s.project.volumes.find((v) => v.id === previous.id)!;
      assert(v, 'A stable identity disappeared');
      if (previous.component?.role !== 'column') assert.deepEqual(v, previous);
      else {
        assert(Math.abs(v.dimensions.width - 0.4) < 0.001);
        assert(Math.abs(v.dimensions.depth - 0.4) < 0.001);
        assert.equal(v.dimensions.height, previous.dimensions.height);
        assert.deepEqual(v.position, previous.position);
      }
    }
  },
);
await evaluate(
  'multi-drawing reconstruction with varied dimensions',
  async () => {
    const s = await design(
      newSession({ volumes: [], selectedId: null }),
      'Reconstruct an editable architectural concept from the attached plan and section. Use the labeled dimensions and levels. Model the two occupied slabs, roof and enclosing walls as separate elements, and record any assumptions. No extra floors or furniture. Verify the measured envelope dimensions and slab elevations against these drawings.',
      images,
    );
    const floors = s.project.volumes.filter(
      (v) => v.component?.role === 'floor',
    );
    const roofs = s.project.volumes.filter((v) => v.component?.role === 'roof');
    assert.equal(floors.length, 2);
    assert.equal(roofs.length, 1);
    assert.deepEqual(
      floors.map((v) => v.position.y).sort((a, b) => a - b),
      [0, 3.2],
    );
    for (const v of [...floors, ...roofs]) {
      assert(Math.abs(v.dimensions.width - width) < 0.05);
      assert(Math.abs(v.dimensions.depth - depth) < 0.05);
      assert(Math.abs(v.dimensions.height - 0.2) < 0.01);
    }
    assert(Math.abs(roofs[0].position.y - 6.2) < 0.01);
    assert(s.project.volumes.some((v) => v.component?.role === 'wall'));
    const restored = await applyPlan(s, directPlan({ type: 'undo', count: 1 }));
    assert.equal(restored.session.project.volumes.length, 0);
  },
);
await writeFile(
  `${folder}/results.json`,
  JSON.stringify({ seed, calls, results }, null, 2),
);
console.log(JSON.stringify({ seed, calls, results }, null, 2));
if (results.some((r) => r.status !== 'PASS')) process.exitCode = 1;
