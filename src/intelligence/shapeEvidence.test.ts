import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeVolume, type Volume } from '../model';
import { meshData, orientVolume } from '../geometry/kernel';
import { newSession, parseSession } from './engine';
import { shapeEvidence } from './shapeEvidence';
import { verifyCompletion } from './completion';
import { completionCriteriaSchema } from './completionSchema';
import { criteria, measure, selector } from '../../tests/fixtures/completion';
const part = (
  kind: 'sphere' | 'cylinder' | 'box',
  width: number,
  height: number,
  depth = width,
): Volume => ({
  ...makeVolume(),
  geometry: { kind },
  dimensions: { width, height, depth },
  position: { x: -3.7, y: 6, z: 2.3 },
  rotation: 31,
});
async function bake(v: Volume): Promise<Volume> {
  const data = await meshData(v),
    scale = [v.dimensions.width, v.dimensions.height, v.dimensions.depth];
  return {
    ...v,
    geometry: {
      kind: 'mesh',
      positions: Array.from(data.positions, (n, i) => n / scale[i % 3]),
      indices: Array.from(data.indices),
      solid: true,
      source: 'Geometry contract regression',
    },
  };
}
it('replays the exact real reader and live scene: accepts the correct assembly and rejects both stretched balls', async () => {
  const root = 'docs/evaluations/2026-11-18-completion-final-5usd/evidence/';
  const json = (file: string) => JSON.parse(readFileSync(root + file, 'utf8'));
  const c = completionCriteriaSchema.parse(json('channel-criteria.json'));
  const original = parseSession(
    JSON.stringify({ version: 2, ...json('channel-original.json') }),
  );
  const candidate = parseSession(
    JSON.stringify({ version: 2, ...json('channel-last-candidate.json') }),
  );
  expect((await verifyCompletion(c, original, candidate)).status).toBe(
    'verified',
  );
  for (const axis of ['height', 'depth']) {
    const wrong = parseSession(
      JSON.stringify({
        version: 2,
        ...json(`channel-wrong-ball-${axis}.json`),
      }),
    );
    const report = await verifyCompletion(c, original, wrong);
    expect(report.status).toBe('incorrect');
    expect(report.canCommit).toBe(false);
  }
});
it.each([0.73, 1.26, 2.9])(
  'establishes roundness at unfamiliar diameter %s, independently of recipe',
  async (d) => {
    for (const kind of ['sphere', 'cylinder'] as const) {
      const p = part(kind, d, kind === 'sphere' ? d : 1.73);
      expect((await shapeEvidence(p, kind)).met).toBe(true);
      expect((await shapeEvidence(await bake(p), kind)).met).toBe(true);
      const wrong = { ...p, dimensions: { ...p.dimensions, depth: d * 1.3 } };
      expect((await shapeEvidence(wrong, kind)).met).toBe(false);
      expect((await shapeEvidence(await bake(wrong), kind)).met).not.toBe(true);
      expect(
        (
          await shapeEvidence(
            wrong,
            kind === 'sphere' ? 'ellipsoid' : 'elliptic_cylinder',
          )
        ).met,
      ).toBe(true);
    }
  },
);
it.each(['sphere', 'cylinder', 'box'] as const)(
  'accepts actual %s meshes with arbitrary baked XYZ rotation',
  async (kind) => {
    const p = part(
      kind,
      1.22,
      kind === 'sphere' ? 1.22 : 2.31,
      kind === 'box' ? 0.82 : 1.22,
    );
    const rotated = await orientVolume(p, { x: 23, y: 17, z: 41 });
    expect((await shapeEvidence(rotated, kind)).met).toBe(true);
    expect((await shapeEvidence(await bake(rotated), kind)).met).toBe(true);
  },
);
it('does not turn construction labels or bounding boxes into claims of shape or wall thickness', async () => {
  const p = part('box', 3.2, 1.7, 0.8),
    candidate = newSession({ volumes: [p], selectedId: null });
  const result = await verifyCompletion(
    criteria([
      {
        kind: 'shape',
        id: 's',
        label: 'Freeform',
        selector: selector(),
        shape: 'mesh',
      },
      { ...measure('wall', 'width', 0.8), metric: 'thickness' },
    ]),
    newSession({ volumes: [], selectedId: null }),
    candidate,
  );
  expect(result.status).toBe('unverified');
  expect(result.checks.filter((c) => c.outcome === 'incorrect')).toEqual([]);
});
it('measures intrinsic diameter on a tilted round member without confusing world width with diameter', async () => {
  const p = await bake(
    await orientVolume(part('cylinder', 0.86, 2.72), { x: 63, y: 12, z: 28 }),
  );
  const c = criteria([
    {
      kind: 'diameter',
      id: 'd',
      label: 'Round section',
      shape: 'cylinder',
      selector: selector(),
      value: 0.86,
      tolerance: 0.001,
    },
  ]);
  const original = newSession({ volumes: [], selectedId: null });
  const candidate = newSession({ volumes: [p], selectedId: null });
  expect((await verifyCompletion(c, original, candidate)).status).toBe(
    'verified',
  );
  c.checks[0].requirement = { ...c.checks[0].requirement, value: 0.91 } as any;
  expect((await verifyCompletion(c, original, candidate)).status).toBe(
    'incorrect',
  );
});
it('distinguishes bounds alignment, true contact, positive overlap, and metric gap', async () => {
  const a = part('box', 1.8, 1.2, 0.7),
    b = { ...part('box', 1.8, 1.2, 0.7), id: 'b' };
  a.rotation = b.rotation = 0;
  b.position.x = a.position.x + 1.8;
  const original = newSession({ volumes: [], selectedId: null }),
    candidate = newSession({ volumes: [a, b], selectedId: null });
  const r = {
    kind: 'relationship' as const,
    id: 'r',
    label: 'Contact',
    first: selector([a.id]),
    second: selector([b.id]),
    quantifier: 'all' as const,
    relation: 'touching' as const,
    distance: 0,
    tolerance: 0.001,
  };
  expect(
    (await verifyCompletion(criteria([r]), original, candidate)).status,
  ).toBe('verified');
  b.position.x -= 0.03;
  expect(
    (await verifyCompletion(criteria([r]), original, candidate)).status,
  ).toBe('incorrect');
  expect(
    (
      await verifyCompletion(
        criteria([{ ...r, relation: 'intersects' }]),
        original,
        candidate,
      )
    ).status,
  ).toBe('verified');
  b.position.x += 0.23;
  expect(
    (
      await verifyCompletion(
        criteria([{ ...r, relation: 'distance', distance: 0.2 }]),
        original,
        candidate,
      )
    ).status,
  ).toBe('verified');
});
