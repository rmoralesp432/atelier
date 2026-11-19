import { expect, it, vi } from 'vitest';
import {
  applyPlan,
  directPlan,
  newSession,
  serializeSession,
  parseSession,
} from './engine';
import { verifyCompletion } from './completion';
import { completionVerifier } from './completionVerifier';
import { auditCriteria, acceptCriteriaRevision } from './criteriaAudit';
import { completionSelection } from './completionSelection';
import { criteria, measure, selector } from '../../tests/fixtures/completion';
import { reportedCriteriaIncident } from '../../tests/fixtures/criteria-contracts';
import type { CompletionCriteria } from './completionSchema';
import { solidStats } from '../geometry/kernel';

const batch = (...ops: Parameters<typeof directPlan>[0][]) => ({
  ...directPlan(ops[0]),
  operations: ops,
});
const empty = () => newSession({ volumes: [], selectedId: null });
const box = (name: string, x: number, y = 0, z = 0, rotation = 0) => ({
  type: 'create_at' as const,
  name,
  shape: 'box' as const,
  width: 1.6,
  depth: 0.8,
  height: 0.4,
  x,
  y,
  z,
  rotation,
});

it('reproduces the reported reversed elevation and unsupported material without treating either as bad geometry', async () => {
  const { original, candidate, criteria: c } = await reportedCriteriaIncident();
  const report = await verifyCompletion(c, original, candidate);
  expect(report).toMatchObject({
    status: 'unverified',
    passed: false,
    canCommit: true,
  });
  expect(report.criterionIssues?.map((i) => [i.checkId, i.code])).toEqual([
    ['reversed-offset', 'contradiction'],
    ['substance', 'unsupported_property'],
  ]);
  expect(
    report.checks
      .filter((c) => c.id.startsWith('datum'))
      .every((c) => c.outcome === 'verified'),
  ).toBe(true);
  expect(
    report.checks.find((c) => c.id === 'reversed-offset')?.observed,
  ).toContain('-3.5');
  expect(candidate.project.volumes.some((v) => v.materialSpec)).toBe(false);
});

it.each([
  ['x', -4.2, 1.6, 29],
  ['x', 6.1, -2.4, 75],
  ['z', -3.7, 2.8, 41],
  ['z', 4.4, -1.1, 90],
  ['y', 1.2, 5.9, 18],
  ['y', 8.4, 2.1, 0],
] as const)(
  'signed %s offsets use world anchors at %s/%s with rotated parts',
  async (axis, a, b, rotation) => {
    const original = empty();
    const coords = (n: number) => ({
      x: axis === 'x' ? n : 0,
      y: axis === 'y' ? n : 0,
      z: axis === 'z' ? n : 0,
    });
    const candidate = (
      await applyPlan(
        original,
        batch(
          ...[a, b].map((n, i) => ({
            ...box(`Bracket ${i}`, 0),
            ...coords(n),
            rotation,
          })),
        ),
      )
    ).session;
    const [p, q] = candidate.project.volumes;
    const r = {
      kind: 'offset' as const,
      id: 'spacing',
      label: 'Bracket spacing',
      first: selector([p.id]),
      second: selector([q.id]),
      axis,
      firstAnchor: axis === 'y' ? ('min' as const) : ('center' as const),
      secondAnchor: axis === 'y' ? ('min' as const) : ('center' as const),
      value: b - a,
      tolerance: 0.0001,
    };
    const c = criteria([
      measure('p', axis, a, selector([p.id])),
      measure('q', axis, b, selector([q.id])),
      r,
    ]);
    expect((await verifyCompletion(c, original, candidate)).status).toBe(
      'verified',
    );
    const reversed = structuredClone(c);
    (reversed.checks[2].requirement as typeof r).value = a - b;
    expect((await verifyCompletion(reversed, original, candidate)).status).toBe(
      'unverified',
    );
    const moved = structuredClone(candidate);
    moved.project.volumes[1].position[axis] += 0.6;
    const bad = await verifyCompletion(reversed, original, moved);
    expect(bad).toMatchObject({ status: 'incorrect', canCommit: false });
    expect(bad.checks.find((c) => c.id === 'q')?.outcome).toBe('incorrect');
    // No contradictory supporting criteria: a genuinely wrong displacement blocks.
    expect(
      (await verifyCompletion(criteria([r]), original, moved)).status,
    ).toBe('incorrect');
  },
);

it('respects min/center/max datums of differently oriented solids, not their local dimensions', async () => {
  const original = empty();
  let candidate = (
    await applyPlan(
      original,
      batch(box('Rail', -3, 2), box('Stop', 2, 2, 0, 60)),
    )
  ).session;
  const [p, q] = candidate.project.volumes;
  candidate = (
    await applyPlan(
      candidate,
      batch({
        type: 'orient',
        targets: [p.id],
        x: 25,
        y: 15,
        z: 35,
      }),
    )
  ).session;
  const ps = await solidStats(candidate.project.volumes[0]),
    qs = await solidStats(q);
  const c = criteria([
    {
      kind: 'offset',
      id: 'gap',
      label: 'World X gap',
      first: selector([p.id]),
      second: selector([q.id]),
      axis: 'x',
      firstAnchor: 'max',
      secondAnchor: 'min',
      value: qs.bounds.min[0] - ps.bounds.max[0],
      tolerance: 0.0001,
    },
  ]);
  expect((await verifyCompletion(c, original, candidate)).status).toBe(
    'verified',
  );
  const bad = structuredClone(c);
  (bad.checks[0].requirement as any).value += 0.3;
  expect((await verifyCompletion(bad, original, candidate)).status).toBe(
    'incorrect',
  );
});

it('corrects a relative cycle using independent equations, without a floor template', async () => {
  const original = empty(),
    candidate = (
      await applyPlan(original, batch(box('A', 0), box('B', 2), box('C', 5)))
    ).session;
  const [a, b, c] = candidate.project.volumes;
  const r = (id: string, first: string, second: string, value: number) => ({
    kind: 'offset' as const,
    id,
    label: id,
    first: selector([first]),
    second: selector([second]),
    axis: 'x' as const,
    firstAnchor: 'center' as const,
    secondAnchor: 'center' as const,
    value,
    tolerance: 0.0001,
  });
  const broken = criteria([
    r('ab', a.id, b.id, 2),
    r('bc', b.id, c.id, 3),
    r('ac', a.id, c.id, 12),
  ]);
  const select = completionSelection(original, candidate),
    issues = auditCriteria(broken, select);
  expect(issues).toHaveLength(3);
  const fixed = structuredClone(broken);
  (fixed.checks[2].requirement as any).value = 5;
  expect(
    (
      await verifyCompletion(
        acceptCriteriaRevision(broken, fixed, issues, select),
        original,
        candidate,
      )
    ).status,
  ).toBe('verified');
});

it('material designations are assignable, persisted metadata, never inferred from names or colors', async () => {
  const original = empty();
  const s = (
    await applyPlan(original, batch(box('Titanium alloy Ti-6Al-4V', 0)))
  ).session;
  const id = s.project.volumes[0].id;
  const c = criteria([
    {
      kind: 'property',
      id: 'spec',
      label: 'Alloy designation',
      selector: selector([id]),
      property: 'materialSpec',
      value: 'Ti-6Al-4V',
    },
  ]);
  expect((await verifyCompletion(c, original, s)).status).toBe('incorrect');
  const assigned = (
    await applyPlan(
      s,
      batch({
        type: 'material',
        targets: [id],
        material: 'solid',
        specification: 'Ti-6Al-4V',
      }),
    )
  ).session;
  expect(assigned.project.volumes[0].id).toBe(id);
  const report = await verifyCompletion(c, original, assigned);
  expect(report.status).toBe('verified');
  expect(report.checks.at(-1)?.observed).toContain('not certified');
  const restored = parseSession(serializeSession(assigned));
  expect(restored.project).toEqual(assigned.project);
  const appearanceOnly = (
    await applyPlan(
      restored,
      batch({
        type: 'material',
        targets: [id],
        material: 'frame',
        specification: null,
      }),
    )
  ).session;
  expect(appearanceOnly.project.volumes[0].materialSpec).toBe('Ti-6Al-4V');
  const undone = (await applyPlan(restored, batch({ type: 'undo', count: 1 })))
    .session;
  expect(undone.project).toEqual(s.project);
  expect(
    (await applyPlan(undone, batch({ type: 'redo', count: 1 }))).session
      .project,
  ).toEqual(assigned.project);
});

it('conflicting absolute datums are unverified, while a single valid but unmet datum still fails', async () => {
  const original = empty(),
    candidate = (await applyPlan(original, batch(box('Seat', 0, 1)))).session;
  const id = candidate.project.volumes[0].id;
  const first = measure('seat', 'y', 1, selector([id]));
  const second = measure('other-base', 'y', 2, selector([id]));
  expect(
    await verifyCompletion(criteria([first, second]), original, candidate),
  ).toMatchObject({ status: 'unverified', passed: false });
  expect(
    await verifyCompletion(criteria([second]), original, candidate),
  ).toMatchObject({ status: 'incorrect', canCommit: false });
});

it('one independent criterion correction retains valid failures and then permits an ordinary metadata repair', async () => {
  const { original, candidate, criteria: c } = await reportedCriteriaIncident();
  const corrected = structuredClone(c);
  (corrected.checks[4].requirement as any).value = -3.5;
  (corrected.checks[5].requirement as any).property = 'materialSpec';
  const reader = vi
    .fn()
    .mockResolvedValueOnce(c)
    .mockImplementationOnce(async (_s, revision) => {
      expect(revision.criteria).toEqual(c);
      expect(revision.issues).toHaveLength(2);
      return corrected;
    });
  const verify = completionVerifier(original, 'reconstructed incident', reader);
  const first = await verify(candidate);
  expect(first).toMatchObject({ status: 'incorrect', canCommit: false });
  expect(
    first.checks.filter((c) => c.outcome === 'incorrect').map((c) => c.id),
  ).toEqual(['substance']);
  const fixed = (
    await applyPlan(
      candidate,
      batch({
        type: 'material',
        targets: candidate.project.volumes.map((v) => v.id),
        material: 'solid',
        specification: 'concrete',
      }),
    )
  ).session;
  expect((await verify(fixed)).status).toBe('verified');
  expect(reader).toHaveBeenCalledTimes(2);
});

it('an unavailable correction is bounded and never sends correct geometry into a repair loop', async () => {
  const { original, candidate, criteria: c } = await reportedCriteriaIncident();
  const read = vi
    .fn()
    .mockResolvedValueOnce(c)
    .mockRejectedValueOnce(new Error('Review interrupted'));
  const verify = completionVerifier(original, 'request', read);
  expect(await verify(candidate)).toMatchObject({
    status: 'unverified',
    canCommit: true,
  });
  expect(await verify(candidate)).toMatchObject({
    status: 'unverified',
    canCommit: true,
  });
  expect(read).toHaveBeenCalledTimes(2);
});

it('cannot use criterion repair to remove valid failures, change scope or fit observed geometry', async () => {
  const { original, candidate, criteria: c } = await reportedCriteriaIncident();
  c.checks.push(...criteria([measure('height', 'height', 2)]).checks);
  const select = completionSelection(original, candidate),
    issues = auditCriteria(c, select);
  for (const change of [
    (n: CompletionCriteria) => {
      n.checks.pop();
    },
    (n: CompletionCriteria) => {
      n.editable = ['$all'];
    },
    (n: CompletionCriteria) => {
      (n.checks.at(-1)!.requirement as any).value = 0.2;
    },
    (n: CompletionCriteria) => {
      (n.checks[4].requirement as any).tolerance = 0.1;
    },
    (n: CompletionCriteria) => {
      (n.checks[4].requirement as any).value = 0;
    },
  ]) {
    const n = structuredClone(c);
    change(n);
    expect(() => acceptCriteriaRevision(c, n, issues, select)).toThrow();
  }
  expect(await verifyCompletion(c, original, candidate)).toMatchObject({
    status: 'incorrect',
    canCommit: false,
  });
});

it('invalid reviewer IDs cannot mask host-owned preservation failures', async () => {
  const original = (await applyPlan(empty(), batch(box('Keep this object', 4))))
    .session;
  const candidate = structuredClone(original);
  candidate.project.volumes[0].position.x += 2;
  const c = criteria([
    {
      kind: 'property',
      id: 'preserved-scope',
      label: 'Invalid material check',
      selector: selector(['$all']),
      property: 'material',
      value: 'copper',
    },
  ]);
  const result = await verifyCompletion(c, original, candidate);
  expect(result.checks[0]).toMatchObject({
    id: 'preserved-scope',
    outcome: 'incorrect',
  });
  expect(result.checks[1]).toMatchObject({
    id: 'preserved-scope',
    outcome: 'unverified',
  });
  expect(result).toMatchObject({ status: 'incorrect', canCommit: false });
});
