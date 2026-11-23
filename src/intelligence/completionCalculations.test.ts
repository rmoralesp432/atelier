import { expect, it } from 'vitest';
import { compileCalculations } from './completionCalculations';
import { verifyCompletion } from './completion';
import { completionReportSchema } from './completionSchema';
import { acceptCriteriaRevision } from './criteriaAudit';
import { completionSelection } from './completionSelection';
import { makeVolume } from '../model';
import {
  newSession,
  applyPlan,
  directPlan,
  parseSession,
  serializeSession,
} from './engine';
import { solidStats } from '../geometry/kernel';
import { criteria, measure, selector } from '../../tests/fixtures/completion';
import { calculation } from '../../tests/fixtures/calculations';
import { savedRepair } from '../../tests/fixtures/saved-repair';
import type { Calculation } from './calculationSchema';

const empty = () => newSession({ volumes: [], selectedId: null });
const attached = (calculation: Calculation) => {
  const c = criteria([measure('height', 'height', 999)]);
  c.checks[0].calculation = calculation;
  return c;
};

it('replays the saved real-AI repair: keeps the old failure, accepts corrected coordinates and still blocks the 19 cm displacement', async () => {
  const { original, injected, repaired, correctBefore, legacy, derived } =
    savedRepair();
  const saved = JSON.stringify({
    original,
    injected,
    repaired,
    legacy,
    derived,
  });
  expect((await verifyCompletion(legacy, original, repaired)).canCommit).toBe(
    false,
  );
  const report = await verifyCompletion(derived, original, repaired);
  const positions = report.checks.find((c) => c.id === 'check-5')!;
  expect(positions.outcome).toBe('verified');
  expect(report).toMatchObject({ status: 'unverified', canCommit: true });
  // The old unsupported hexagonal shape classifier is still disclosed, not upgraded to verified.
  expect(
    report.checks.filter((c) => c.outcome === 'unverified').map((c) => c.id),
  ).toEqual(['check-4']);
  expect(completionReportSchema.parse(report)).toEqual(report);
  const trace = positions.calculation!;
  expect(trace.definition.frame).toBe('world_xyz_y_up');
  expect(trace.sources[0]).toEqual({ node: 0, unit: 'm', values: [0.72] });
  expect(trace.sources[2].values[0]).toBeCloseTo((31 * Math.PI) / 180, 15);
  expect((trace.expected as { z: number }[])[2].z).toBeCloseTo(
    -0.3670003897084857,
    14,
  );
  expect(derived.checks[4].requirement).toEqual(legacy.checks[4].requirement);
  const bad = await verifyCompletion(derived, original, injected);
  expect(bad).toMatchObject({ status: 'incorrect', canCommit: false });
  expect(bad.checks.find((c) => c.id === 'check-5')!.outcome).toBe('incorrect');
  const repairedId = '0901ed2d-d519-4c83-b924-9750b321eedf';
  expect(repaired.project.volumes.filter((v) => v.id !== repairedId)).toEqual(
    correctBefore.project.volumes.filter((v) => v.id !== repairedId),
  );
  const oldPart = correctBefore.project.volumes.find(
    (v) => v.id === repairedId,
  )!;
  const newPart = repaired.project.volumes.find((v) => v.id === repairedId)!;
  expect({ ...newPart, position: oldPart.position }).toEqual(oldPart);
  for (const axis of ['x', 'y', 'z'] as const)
    expect(newPart.position[axis]).toBeCloseTo(oldPart.position[axis], 14);
  expect(repaired.project.groups).toEqual(correctBefore.project.groups);
  expect(repaired.project.volumes.slice(0, 2)).toEqual(
    original.project.volumes,
  );
  expect(
    JSON.stringify({ original, injected, repaired, legacy, derived }),
  ).toBe(saved);
});

it('derives an editable spherical handle from pre-edit world geometry, signed trigonometry and millimeters; original sources never move with the candidate', async () => {
  const plate = {
    ...makeVolume(),
    id: 'plate',
    name: 'Tilted mounting plate',
    dimensions: { width: 2.3, depth: 0.7, height: 0.15 },
    position: { x: 0.4, y: 1, z: -0.8 },
    rotation: 27,
  };
  const handle = {
    ...makeVolume(),
    id: 'handle',
    name: 'Spherical handle',
    geometry: { kind: 'sphere' as const },
    dimensions: { width: 0.42, depth: 0.42, height: 0.42 },
    position: { x: -1, y: 1.25, z: 4 },
  };
  const unrelated = {
    ...makeVolume(),
    id: 'neighbor',
    name: 'Unrelated',
    position: { x: 9, y: 0, z: -8 },
  };
  const original = (
    await applyPlan(
      newSession({ volumes: [plate, handle, unrelated], selectedId: null }),
      directPlan({ type: 'orient', targets: ['plate'], x: 17, y: 27, z: 8 }),
    )
  ).session;
  const c = calculation();
  const x = c.original('handle', 'x'),
    z = c.original('handle', 'z'),
    top = c.original('plate', 'top');
  const distance = c.quantity(37, 'cm', 'Move the handle 37 cm'),
    angle = c.quantity(-23, 'deg', '-23 degrees from +X toward +Z');
  const clearance = c.quantity(65, 'mm', '65 mm above the original plate top');
  const positions = c.points(
    c.op('add', x, c.op('multiply', distance, c.op('cos', angle))),
    c.op('add', top, clearance),
    c.op('add', z, c.op('multiply', distance, c.op('sin', angle))),
  );
  const d = calculation();
  const diameter = d.value(
    d.op(
      'add',
      d.original('handle', 'width'),
      d.quantity(18, 'mm', 'increase the original diameter by 18 mm'),
    ),
  );
  const checks = criteria(
    [
      {
        kind: 'positions',
        id: 'placement',
        label: 'Placement',
        selector: selector(['handle']),
        points: [{ x: 0, y: 0, z: 0 }],
        tolerance: 0.001,
      },
      {
        kind: 'diameter',
        id: 'diameter',
        label: 'Diameter',
        selector: selector(['handle']),
        shape: 'sphere',
        value: 1,
        tolerance: 0.001,
      },
      {
        kind: 'editable',
        id: 'editable',
        label: 'Independent handle',
        selector: selector(['handle']),
      },
    ],
    ['handle'],
  );
  checks.checks[0].calculation = positions;
  checks.checks[1].calculation = diameter;
  // Independent construction uses the engine's real bounds, not the calculation evaluator.
  const b = (await solidStats(original.project.volumes[0])).bounds;
  const desired = {
    x: -1 + 0.37 * Math.cos((-23 * Math.PI) / 180),
    y: b.max[1] + 0.065,
    z: 4 + 0.37 * Math.sin((-23 * Math.PI) / 180),
  };
  const candidate = structuredClone(original);
  candidate.project.volumes[1] = {
    ...handle,
    position: desired,
    dimensions: { width: 0.438, height: 0.438, depth: 0.438 },
  };
  const before = serializeSession(original);
  const report = await verifyCompletion(checks, original, candidate);
  expect(report).toMatchObject({ status: 'verified', canCommit: true });
  expect(
    report.checks.find((c) => c.id === 'placement')!.calculation!.sources[2],
  ).toMatchObject({ unit: 'm', values: [b.max[1]] });
  const wrong = structuredClone(candidate);
  wrong.project.volumes[1].position.z += 0.012;
  expect((await verifyCompletion(checks, original, wrong)).canCommit).toBe(
    false,
  );
  const collateral = structuredClone(candidate);
  collateral.project.volumes[0].position.y += 0.2;
  const collateralReport = await verifyCompletion(checks, original, collateral);
  expect(collateralReport.canCommit).toBe(false);
  expect(
    collateralReport.checks.find((c) => c.id === 'placement')!.outcome,
  ).toBe('verified');
  expect(serializeSession(original)).toBe(before);
  // These exact solids, identity and untouched neighbors survive the serialization boundary.
  const restored = parseSession(serializeSession(candidate));
  expect(restored.project).toEqual(candidate.project);
  expect((await verifyCompletion(checks, original, restored)).status).toBe(
    'verified',
  );
});

it.each([-0.27, 0.43])(
  'derives signed offset changes of %s m in either comparison direction without changing tolerances',
  async (shift) => {
    const original = newSession({
      selectedId: null,
      volumes: [
        {
          ...makeVolume(),
          id: 'first',
          dimensions: { width: 0.6, height: 0.8, depth: 0.4 },
          position: { x: -2, y: 1, z: 3 },
          rotation: 47,
        },
        {
          ...makeVolume(),
          id: 'second',
          geometry: { kind: 'cylinder' },
          dimensions: { width: 0.3, height: 0.9, depth: 0.3 },
          position: { x: 1, y: 2, z: 3 },
          rotation: 72,
        },
      ],
    });
    const candidate = structuredClone(original);
    candidate.project.volumes[1].position.x += shift;
    for (const reversed of [false, true]) {
      const b = calculation();
      let expected = b.op(
        'add',
        b.op('subtract', b.original('second', 'x'), b.original('first', 'x')),
        b.quantity(shift * 1000, 'mm', `${shift * 1000} mm`),
      );
      if (reversed) expected = b.op('negate', expected);
      const c = criteria(
        [
          {
            kind: 'offset',
            id: 'gap',
            label: 'Signed center displacement',
            first: selector([reversed ? 'second' : 'first']),
            second: selector([reversed ? 'first' : 'second']),
            axis: 'x',
            firstAnchor: 'center',
            secondAnchor: 'center',
            value: 0,
            tolerance: 0.0001,
          },
        ],
        ['second'],
      );
      c.checks[0].calculation = b.value(expected);
      const report = await verifyCompletion(c, original, candidate);
      expect(report).toMatchObject({ status: 'verified', canCommit: true });
      expect(
        report.checks.find((c) => c.id === 'gap')!.calculation!.expected,
      ).toBeCloseTo((3 + shift) * (reversed ? -1 : 1), 12);
      const wrong = structuredClone(candidate);
      wrong.project.volumes[1].position.x += 0.01;
      expect((await verifyCompletion(c, original, wrong)).canCommit).toBe(
        false,
      );
      expect(c.checks[0].requirement).toMatchObject({
        value: 0,
        tolerance: 0.0001,
      });
    }
  },
);

it('uses pre-edit mesh volume and world bounds rather than recipe dimensions', async () => {
  let original = (
    await applyPlan(
      empty(),
      directPlan({
        type: 'create_at',
        name: 'Source sphere',
        shape: 'sphere',
        width: 0.6,
        height: 0.6,
        depth: 0.6,
        x: 0,
        y: 0,
        z: 0,
        rotation: 0,
      }),
    )
  ).session;
  const id = original.project.volumes[0].id,
    s = await solidStats(original.project.volumes[0]);
  const b = calculation(),
    c = criteria([measure('material', 'volume', 999)]);
  c.checks[0].calculation = b.value(
    b.op('divide', b.original(id, 'volume'), b.constant(2)),
  );
  const out = await compileCalculations(c, original);
  expect(out.criteria.checks[0].requirement).toMatchObject({
    value: s.volume / 2,
    tolerance: 0.00001,
    relativeTolerance: 0,
  });
  expect(out.traces.get('material')!.expectedUnit).toBe('m³');
});

const invalidCalculations: [
  string,
  (b: ReturnType<typeof calculation>) => number,
][] = [
  [
    'forward/cyclic reference',
    (b: ReturnType<typeof calculation>) => b.op('negate', 1),
  ],
  [
    'division by zero',
    (b: ReturnType<typeof calculation>) =>
      b.op('divide', b.quantity(2, 'm', '2 m'), b.constant(0)),
  ],
  [
    'incompatible sums',
    (b: ReturnType<typeof calculation>) =>
      b.op('add', b.quantity(2, 'm', '2 m'), b.constant(1)),
  ],
  [
    'unitless trigonometry',
    (b: ReturnType<typeof calculation>) => b.op('sin', b.constant(30)),
  ],
  [
    'candidate-only source',
    (b: ReturnType<typeof calculation>) =>
      b.original('new-candidate', 'height'),
  ],
  [
    'wrong measurement units',
    (b: ReturnType<typeof calculation>) => b.constant(2),
  ],
  ['missing output', (_b: ReturnType<typeof calculation>) => 63],
  [
    'oversized range',
    (b: ReturnType<typeof calculation>) =>
      b.op(
        'range',
        b.quantity(0, 'm', 'origin'),
        b.quantity(1, 'm', '1 m'),
        b.constant(4097),
      ),
  ],
  [
    'zero range',
    (b: ReturnType<typeof calculation>) =>
      b.op(
        'range',
        b.quantity(0, 'm', 'origin'),
        b.quantity(1, 'm', '1 m'),
        b.constant(0),
      ),
  ],
  [
    'bad arity',
    (b: ReturnType<typeof calculation>) =>
      b.op('subtract', b.quantity(1, 'm', '1 m')),
  ],
  [
    'nonfinite calculation',
    (b: ReturnType<typeof calculation>) =>
      b.op('multiply', b.quantity(1e12, 'm', 'large'), b.constant(1e12)),
  ],
];
it.each(invalidCalculations)(
  'invalid %s is unverified, never a fabricated pass or fallback to literal targets',
  async (_name, define) => {
    const b = calculation();
    b.constant(0);
    const c = attached(b.value(define(b)));
    const original = empty(),
      candidate = newSession({
        volumes: [{ ...makeVolume(), id: 'new-candidate' }],
        selectedId: null,
      });
    const report = await verifyCompletion(c, original, candidate);
    expect(report).toMatchObject({
      status: 'unverified',
      passed: false,
      canCommit: false,
    });
    expect(report.checks.find((c) => c.id === 'height')!.observed).toContain(
      'could not be derived',
    );
    // An independent, supported geometry failure still blocks the transaction.
    c.checks.push(...criteria([measure('count', 'count', 5)]).checks);
    expect((await verifyCompletion(c, original, candidate)).canCommit).toBe(
      false,
    );
  },
);

it('bounds total work, rejects incompatible arrays, and honors cancellation without changing tolerance or scope', async () => {
  const b = calculation(),
    a = b.quantity(1, 'm', '1 m'),
    two = b.constant(2),
    three = b.constant(3);
  const mismatch = attached(
    b.value(b.op('add', b.op('range', a, a, two), b.op('range', a, a, three))),
  );
  expect((await compileCalculations(mismatch, empty())).issues[0].code).toBe(
    'invalid_calculation',
  );
  const large = calculation(),
    zero = large.quantity(0, 'm', 'origin'),
    one = large.quantity(1, 'm', '1 m'),
    count = large.constant(4096);
  let prev = large.op('range', zero, one, count);
  for (let i = 0; i < 9; i++) prev = large.op('negate', prev);
  const c = attached(large.points(prev, zero, zero));
  expect((await compileCalculations(c, empty())).issues[0]).toMatchObject({
    code: 'invalid_calculation',
    detail: expect.stringContaining('resource limits'),
  });
  const stop = new AbortController();
  stop.abort();
  await expect(compileCalculations(c, empty(), stop.signal)).rejects.toThrow(
    'cancelled',
  );
});

it('does not let an independent criteria correction rewrite calculation sources or arithmetic', () => {
  const b = calculation(),
    original = attached(b.value(b.quantity(2, 'm', '2 meters')));
  const revised = structuredClone(original);
  (revised.checks[0].calculation!.nodes[0] as { value: number }).value = 8;
  const session = empty();
  expect(() =>
    acceptCriteriaRevision(
      original,
      revised,
      [],
      completionSelection(session, session),
    ),
  ).toThrow('independently valid requirement');
});

it('a stray calculation cannot suppress a genuine shape failure or preservation check', async () => {
  const v = {
    ...makeVolume(),
    id: 'preserved',
    position: { x: 0, y: 0, z: 0 },
  };
  const original = newSession({ volumes: [v], selectedId: null });
  const candidate = structuredClone(original);
  candidate.project.volumes[0].position.x = 2;
  const c = criteria(
    [
      {
        kind: 'shape',
        id: 'round',
        label: 'Required sphere',
        selector: selector(['preserved']),
        shape: 'sphere',
      },
      {
        kind: 'preserve',
        id: 'fixed',
        label: 'Retained position',
        selector: selector(['preserved']),
        properties: ['position'],
      },
    ],
    ['preserved'],
  );
  const b = calculation(),
    invalid = b.value(b.op('divide', b.constant(1), b.constant(0)));
  c.checks.forEach((check) => (check.calculation = invalid));
  const report = await verifyCompletion(c, original, candidate);
  expect(report).toMatchObject({ status: 'incorrect', canCommit: false });
  expect(
    report.checks.filter((c) => c.outcome === 'incorrect').map((c) => c.id),
  ).toEqual(['round', 'fixed']);
});
