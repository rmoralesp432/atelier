import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { verifyCompletion } from './completion';
import { completionVerifier } from './completionVerifier';
import { stagedPlan } from './checkedPlanner';
import { defaultCamera, sceneContext } from './context';
import { sceneReference } from './sceneReference';
import { inspectScene } from '../../server/sceneInspection';
import { requestSchema } from '../../server/provider';
import { binaryCorrection } from '../../tests/fixtures/workshop-reliability/repair';
import { criteria, measure, selector } from '../../tests/fixtures/completion';
import { calculation } from '../../tests/fixtures/calculations';
import { newSession, resolveIds, type Session } from './engine';
import { makeVolume } from '../model';
import { acceptCriteriaRevision } from './criteriaAudit';
import { completionSelection } from './completionSelection';
import type { CompletionCriteria } from './completionSchema';
const fixture = (
  name: string,
): { before: Session; candidate: Session; criteria: CompletionCriteria } =>
  JSON.parse(
    readFileSync(`tests/fixtures/workshop-reliability/${name}.json`, 'utf8'),
  );

it('replays the saved group-ID rejection: inspection, modeling and verification identify the same real members', async () => {
  const f = fixture('group'),
    group = f.candidate.project.groups!.find(
      (g) => g.name === 'Roller assembly',
    )!;
  const members = f.candidate.project.volumes
    .filter((v) => v.groupId === group.id)
    .map((v) => v.id);
  expect(members).toHaveLength(5);
  const scene = sceneContext(
    f.candidate.project,
    f.candidate.context,
    defaultCamera,
  );
  const input = requestSchema.parse({
    message: 'Inspect this assembly',
    history: [],
    scene,
    sceneReference: sceneReference(f.candidate, scene, defaultCamera),
  });
  for (const ref of [
    group.id,
    group.name,
    `$group:${group.id}`,
    `$group:${group.name}`,
  ]) {
    expect(resolveIds([ref], f.candidate)).toEqual(members);
    for (const snapshot of ['current', 'before', 'compare'] as const) {
      const inspected = inspectScene(input, {
        ids: [ref],
        snapshot,
        role: null,
        relativeTo: null,
      }) as any;
      expect(inspected.available).toBe(true);
      expect(inspected.matched).toBe(5);
      expect(inspected.missingIds).toEqual([]);
    }
    const c = structuredClone(f.criteria);
    (
      c.checks.find((c) => c.requirement.kind === 'group')!.requirement as any
    ).name = ref;
    const report = await verifyCompletion(c, f.before, f.candidate);
    expect(report.canCommit).toBe(true);
    expect(report.checks.find((c) => c.id === 'check-3')!.outcome).toBe(
      'verified',
    );
  }
});
it('uses the actual snapshot membership, handles object names, and refuses ambiguous references', () => {
  const f = fixture('group'),
    group = f.candidate.project.groups![1];
  const original = structuredClone(f.candidate),
    current = structuredClone(original);
  current.project.volumes.find((v) => v.groupId === group.id)!.groupId =
    undefined;
  const scene = sceneContext(current.project, current.context, defaultCamera);
  const input = requestSchema.parse({
    message: 'Inspect',
    history: [],
    scene,
    sceneReference: sceneReference(original, scene, defaultCamera),
  });
  for (const snapshot of ['before', 'current', 'compare'] as const) {
    const out = inspectScene(input, {
      ids: [`$group:${group.id}`],
      snapshot,
      role: null,
      relativeTo: null,
    }) as any;
    expect(out.matched).toBe(snapshot === 'current' ? 4 : 5);
  }
  const target = current.project.volumes[0];
  expect(
    (
      inspectScene(input, {
        ids: [`$name:${target.name}`],
        snapshot: 'current',
        role: null,
        relativeTo: `$name:${current.project.volumes[1].name}`,
      }) as any
    ).relations,
  ).toHaveLength(1);
  current.project.groups!.push({ ...group, id: 'duplicate' });
  expect(() => resolveIds([`$group:${group.name}`], current)).toThrow(
    'ambiguous',
  );
  expect(resolveIds([`$group:${group.id}`], current)).toHaveLength(4);
});
it('replays the malformed reflection: bounded reviewer correction verifies the correct solids and blocks displacement', async () => {
  const f = fixture('reflection');
  for (const displaced of [false, true]) {
    const next = structuredClone(f.candidate);
    if (displaced)
      next.project.volumes.find((v) => v.id === 'display-1')!.position.x +=
        0.04;
    const raw = await verifyCompletion(f.criteria, f.before, next);
    expect(raw.status).toBe('unverified');
    expect(raw.canCommit).toBe(false);
    expect(raw.criterionIssues).toHaveLength(3);
    expect(raw.checks.filter((c) => c.outcome === 'incorrect')).toHaveLength(0);
    const read = vi
      .fn()
      .mockResolvedValueOnce(f.criteria)
      .mockResolvedValueOnce(binaryCorrection(f.criteria));
    const report = await completionVerifier(
      f.before,
      'Reflect the positions',
      read,
    )(next);
    expect(read).toHaveBeenCalledTimes(2);
    expect(report.status).toBe(displaced ? 'incorrect' : 'verified');
    expect(report.canCommit).toBe(!displaced);
    expect(
      report.checks.find((c) => c.id === 'check-1')!.calculation!.expectedUnit,
    ).toBe('m');
  }
});
it('unresolved placement holds the transaction without asking the executor to repair geometry; qualitative uncertainty remains honest', async () => {
  const f = fixture('reflection'),
    read = vi.fn().mockResolvedValue(f.criteria),
    request = vi.fn().mockResolvedValue({
      intent: 'apply',
      message: 'Done',
      operations: f.candidate.project.volumes
        .filter((v) => v.id.startsWith('display-'))
        .map((v) => ({ type: 'position', targets: [v.id], ...v.position })),
    });
  const verify = completionVerifier(f.before, 'Reflect the positions', read);
  await expect(
    stagedPlan(f.before, defaultCamera, request, undefined, undefined, {
      agent: true,
      verifyCompletion: verify,
    }),
  ).rejects.toThrow('have not been saved');
  expect(request).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledTimes(2);
  await verify(f.candidate);
  expect(read).toHaveBeenCalledTimes(2);
  const c = criteria([
    {
      kind: 'unavailable',
      id: 'appearance',
      label: 'Appearance',
      reason: 'Elegance cannot be measured',
    },
  ]);
  expect((await verifyCompletion(c, f.before, f.before)).canCommit).toBe(true);
  c.checks[0].requirement = {
    kind: 'unavailable',
    id: 'alignment',
    label: 'Alignment',
    reason: 'Required placement has no supported measurement',
    required: true,
  };
  expect((await verifyCompletion(c, f.before, f.before)).canCommit).toBe(false);
});
it('transfers the correction to a rotated solid and mixed units, without changing the intended mathematics or tolerance', async () => {
  const original = newSession({
    volumes: [{ ...makeVolume(), id: 'fixed' }],
    selectedId: null,
  });
  const candidate = structuredClone(original),
    v = {
      ...makeVolume(),
      id: 'prism',
      rotation: 27,
      geometry: { kind: 'cylinder' as const },
      dimensions: { width: 0.7, height: 0.5, depth: 0.3 },
      position: { x: 1.53, y: 0, z: 0 },
    };
  candidate.project.volumes.push(v);
  const c = criteria([measure('offset', 'x', 0, selector(['prism']))]);
  const b = calculation(),
    x = b.op(
      'add',
      b.quantity(1.2, 'm', '1.2 m'),
      b.quantity(30, 'cm', '30 cm'),
      b.quantity(30, 'mm', '30 mm'),
    );
  c.checks[0].calculation = b.value(x);
  const read = vi
    .fn()
    .mockResolvedValueOnce(c)
    .mockResolvedValueOnce(binaryCorrection(c));
  expect(
    (await completionVerifier(original, 'request', read)(candidate)).canCommit,
  ).toBe(true);
  const bad = structuredClone(candidate);
  bad.project.volumes[1].position.x += 0.02;
  expect(
    (await verifyCompletion(binaryCorrection(c), original, bad)).canCommit,
  ).toBe(false);
  const issues = (await verifyCompletion(c, original, candidate))
    .criterionIssues!;
  for (const attack of [
    'source',
    'operator',
    'tolerance',
    'scope',
    'drop',
  ] as const) {
    const next = binaryCorrection(c);
    if (attack === 'source')
      (next.checks[0].calculation!.nodes[0] as any).value = 1.22;
    if (attack === 'operator')
      (next.checks[0].calculation!.nodes.at(-1) as any).op = 'subtract';
    if (attack === 'tolerance')
      (next.checks[0].requirement as any).tolerance = 0.1;
    if (attack === 'scope') next.editable = ['fixed'];
    if (attack === 'drop') delete next.checks[0].calculation;
    expect(() =>
      acceptCriteriaRevision(
        c,
        next,
        issues,
        completionSelection(original, candidate),
      ),
    ).toThrow();
  }
});

it('the correction wire carries a repaired expression without rewriting scope or evidence', async () => {
  const { compactCompletionCriteria, expandCompletionCorrections } =
    await import('../../server/completionWire');
  const f = fixture('reflection'),
    corrected = binaryCorrection(f.criteria),
    compact = compactCompletionCriteria(corrected);
  const roundtrip = expandCompletionCorrections(
    {
      corrections: corrected.checks
        .filter((c) => c.calculation)
        .map((c) => {
          const index = corrected.checks.indexOf(c);
          return {
            checkId: c.requirement.id,
            test: compact.checks[index].test,
            calculation: c.calculation,
          };
        }),
    },
    f.criteria,
  );
  expect(roundtrip).toEqual(corrected);
  const report = await verifyCompletion(roundtrip, f.before, f.candidate);
  expect(report.status).toBe('verified');
});

it('accepts a proven unit-bearing scalar zero correction from the fresh failed shelving trace, while displacement remains incorrect', async () => {
  const f = JSON.parse(
    readFileSync('tests/fixtures/workshop-reliability/zero.json', 'utf8'),
  );
  for (const displaced of [false, true]) {
    const candidate = structuredClone(f.candidate);
    if (displaced)
      candidate.project.volumes.find((v: any) =>
        v.name.startsWith('Shelf at 250'),
      )!.position.x += 0.025;
    const read = vi
      .fn()
      .mockResolvedValueOnce(f.criteria)
      .mockResolvedValueOnce(f.correctedCriteria);
    const report = await completionVerifier(
      f.before,
      f.prompt,
      read,
    )(candidate);
    expect(report.canCommit).toBe(!displaced);
    expect(report.checks.find((c) => c.id === 'check-15')!.outcome).toBe(
      displaced ? 'incorrect' : 'verified',
    );
    expect(read).toHaveBeenCalledTimes(2);
  }
});
it('zero equivalence preserves sources and does not erase arrays or undefined expressions', async () => {
  const { equivalentCalculation } = await import('./calculationEquivalence');
  const b = calculation(),
    length = b.quantity(28, 'cm', '28 cm'),
    zero = b.constant(0);
  const old = b.value(zero),
    correct = b.value(b.op('multiply', length, zero));
  expect(equivalentCalculation(old, correct)).toBe(true);
  const array = b.op('range', length, length, b.constant(3));
  const arrayProduct = b.value(b.op('multiply', array, zero));
  const sameSources = { ...arrayProduct, output: old.output };
  expect(equivalentCalculation(sameSources, arrayProduct)).toBe(false);
  const undefinedProduct = b.value(
    b.op('multiply', b.op('divide', length, zero), zero),
  );
  expect(
    equivalentCalculation(
      { ...undefinedProduct, output: old.output },
      undefinedProduct,
    ),
  ).toBe(false);
  const changed = structuredClone(correct);
  (changed.nodes[0] as any).value = 29;
  expect(equivalentCalculation(old, changed)).toBe(false);
});
