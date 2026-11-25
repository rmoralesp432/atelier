import { expect, it } from 'vitest';
import { makeVolume, type Volume } from '../model';
import { newSession } from './engine';
import { verifyCompletion, completionFeedback } from './completion';
import {
  completionReportSchema,
  type CompletionCriteria,
} from './completionSchema';
import {
  compactCompletionCriteria,
  expandCompletionWire,
} from '../../server/completionWire';
import { criteria, selector } from '../../tests/fixtures/completion';

const piece = (
  id: string,
  x: number,
  z: number,
  shape: 'box' | 'sphere' | 'cylinder' = 'box',
): Volume => ({
  ...makeVolume(),
  id,
  name: id,
  position: { x, y: 0.37, z },
  rotation: shape === 'box' ? 32 : 0,
  dimensions: { width: 0.26, depth: 0.26, height: 0.26 },
  geometry: { kind: shape },
});
const setup = () => {
  // Luminaire lenses and housings, deliberately unlike shelves or conveyors.
  const s = newSession({
    volumes: [
      piece('lens-a', -2.3, 0.57, 'sphere'),
      piece('lens-b', 1.4, -0.23, 'sphere'),
      piece('housing-a', -2.3, 0.4, 'cylinder'),
      piece('housing-b', 1.4, 0.4, 'cylinder'),
      piece('unrelated', 9, 8),
    ],
    selectedId: null,
  });
  const r: CompletionCriteria['checks'][number]['requirement'] = {
    id: 'gaps',
    label: 'Retain lens-to-housing alignment',
    kind: 'preserve_offsets',
    first: selector(['$original'], 'lens'),
    second: selector(['$original'], 'housing'),
    axis: 'z',
    firstAnchor: 'center',
    secondAnchor: 'center',
    tolerance: 0.001,
  };
  const c = criteria(
    [r],
    ['lens-a', 'lens-b', 'housing-a', 'housing-b'],
    'Move the luminaires and preserve their existing lens offsets.',
  );
  const next = structuredClone(s);
  next.project.volumes
    .filter((v) => v.id !== 'unrelated')
    .forEach((v) => (v.position.z += 0.86));
  return { s, next, c };
};
it('measures signed original offsets on a different family and round-trips the reviewer wire contract', async () => {
  const { s, next, c } = setup();
  const wire = compactCompletionCriteria(c);
  const restored = expandCompletionWire(wire);
  expect(restored.checks[0].requirement.kind).toBe('preserve_offsets');
  const report = await verifyCompletion(c, s, next);
  expect(report.canCommit).toBe(true);
  expect(completionReportSchema.safeParse(report).success).toBe(true);
  const trace = report.checks.find((v) => v.id === 'gaps')!.offsets!;
  expect(trace).toMatchObject({
    source: 'original',
    frame: 'world_xyz_y_up',
    unit: 'm',
    pairs: 2,
    formula: 'second - first',
  });
  expect(trace.samples.map((v) => v.expected)).toEqual([
    expect.closeTo(-0.17, 6),
    expect.closeTo(0.63, 6),
  ]);
  expect(trace.maxError).toBeLessThan(1e-7);
  // Same tolerance at and just outside the permitted deviation.
  next.project.volumes[0].position.z += 0.001;
  expect((await verifyCompletion(c, s, next)).canCommit).toBe(true);
  next.project.volumes[0].position.z += 0.0001;
  const wrong = await verifyCompletion(c, s, next);
  expect(wrong.status).toBe('incorrect');
  expect(wrong.canCommit).toBe(false);
  expect(
    wrong.checks.find((v) => v.id === 'gaps')!.offsets!.samples[0].expected,
  ).toBeCloseTo(-0.17);
});
it('never rematches displaced or replaced objects to a convenient candidate partner', async () => {
  const { s, next, c } = setup();
  const [a, b] = next.project.volumes.filter((v) => v.id.startsWith('housing'));
  [a.position, b.position] = [b.position, a.position];
  // Make the alternative partner satisfy the lens offset while its original fails.
  a.position.z += 0.4;
  const wrong = await verifyCompletion(c, s, next);
  expect(wrong.canCommit).toBe(false);
  expect(
    wrong.checks
      .find((v) => v.id === 'gaps')!
      .offsets!.samples.find((v) => v.first === 'lens-a')!.second,
  ).toBe('housing-a');
  const replaced = structuredClone(s);
  replaced.project.volumes[2].id = 'replacement';
  const missing = await verifyCompletion(c, s, replaced);
  expect(missing.checks.find((v) => v.id === 'gaps')!.outcome).toBe(
    'incorrect',
  );
  expect(missing.canCommit).toBe(false);
});
it('ambiguous original pairing is unresolved and cannot commit or request a geometry repair', async () => {
  const { s, next, c } = setup();
  s.project.volumes[3].position = { ...s.project.volumes[2].position };
  const report = await verifyCompletion(c, s, next);
  expect(report.canCommit).toBe(false);
  expect(report.checks.find((v) => v.id === 'gaps')!.outcome).toBe(
    'unverified',
  );
  expect(report.checks.find((v) => v.id === 'gaps')!.observed).toContain(
    'ambiguous',
  );
  expect(completionFeedback(report)).not.toContain('gaps (');
});
it('uses actual rotated world bounds, not local widths, and retains unrelated scope protection', async () => {
  const { s, next, c } = setup();
  for (const scene of [s, next]) {
    const v = scene.project.volumes[0];
    v.geometry = { kind: 'box' };
    v.rotation = 37;
    v.dimensions = { width: 0.51, depth: 0.32, height: 0.24 };
  }
  const r = c.checks[0].requirement;
  if (r.kind !== 'preserve_offsets') throw Error('wrong fixture');
  r.firstAnchor = 'max';
  r.secondAnchor = 'min';
  expect((await verifyCompletion(c, s, next)).canCommit).toBe(true);
  next.project.volumes[0].rotation += 45;
  expect((await verifyCompletion(c, s, next)).canCommit).toBe(false);
  next.project.volumes[0].rotation -= 45;
  next.project.volumes.at(-1)!.position.x += 0.4;
  const report = await verifyCompletion(c, s, next);
  expect(report.checks.find((v) => v.id === 'gaps')!.met).toBe(true);
  expect(report.checks.find((v) => v.id === 'preserved-scope')!.outcome).toBe(
    'incorrect',
  );
  expect(report.canCommit).toBe(false);
});
