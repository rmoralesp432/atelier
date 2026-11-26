/** Offline calibration only. No provider or paid-call path. Never imported by ATELIER. */
import assert from 'node:assert/strict';
import {
  applyPlan,
  newSession,
  type Session,
} from '../../src/intelligence/engine';
import { solidStats } from '../../src/geometry/kernel';
import { equalData } from '../../src/projects/equalData';
import type { Plan, Operation } from '../../src/intelligence/plan';
import type { CompletionCriteria } from '../../src/intelligence/completionSchema';

export const decision =
  'Leave exactly 30 cm clear between the back edge of the tabletop and the display panel so I can reach the cables. Keep that access space usable as we develop the station.';
export const revision =
  'The cables will now be reached from the side, so change the access gap to exactly 15 cm instead of 30 cm. Move only the display panel and its supports; leave the table and side pieces alone.';
export const prompts = [
  `Make an editable sample-review station: a simple table 1.8 m wide and 80 cm deep, with its working surface 75 cm above the floor, and a freestanding display panel centered behind it. Add a low sample plinth off to the left. ${decision} Keep the table, supports, panel and plinth as separate editable pieces. Choose reasonable dimensions for the unspecified parts.`,
  'Make the sample plinth 80 cm wide and 60 cm high. Leave the station alone.',
  'Add a simple round stool to the left of the table, clear of the plinth, 42 cm in diameter and 45 cm high.',
  'Widen the tabletop to 2.1 m about its center and keep the legs sensibly under its corners. Leave the other objects alone.',
  'Move the plinth and stool 50 cm farther left. Leave everything else where it is.',
  'Make the table 1.2 m deep by extending its back. Keep the front edge and working height where they are.',
  revision,
  'Make the table 1.4 m deep, again extending the back while keeping the front edge and working height fixed.',
];
export const label =
  'Scripted executor AND reviewer, actual browser/geometry/persistence; no fresh AI and no claim of autonomous recall.';
const part = (
  name: string,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  shape = 'box',
) => ({
  key: name.replaceAll(' ', '-'),
  name,
  shape,
  dimensions: { width: w, height: h, depth: d },
  position: { x, y, z },
  rotation: 0,
  role: 'element',
  level: null,
  material: 'solid',
  color: '#bfc4c7',
  host: null,
  repeat: null,
});
const assembly = (name: string, elements: any[]) => ({
  type: 'assembly',
  name,
  origin: { x: 0, y: 0, z: 0 },
  rotation: 0,
  elements,
});
const edit = (
  targets: string[],
  translation: any = null,
  resize: any = null,
) => ({
  type: 'edit_components',
  edits: [{ targets, where: [], translation, resize }],
});
const move = (targets: string[], x = 0, z = 0) => edit(targets, { x, y: 0, z });
const resize = (target: string, axis: string, value: number, anchor: number) =>
  edit([target], null, { axis, mode: 'set', value, anchor });
const note = (text: string) => ({
  type: 'design_note',
  topic: 'Cable access',
  text,
  source: 'user',
});
export const panelNames = [
  'Display panel',
  'Panel foot left',
  'Panel foot right',
  'Panel post left',
  'Panel post right',
];
export const legNames = [
  'Leg front left',
  'Leg front right',
  'Leg back left',
  'Leg back right',
];
export const operations: any[][] = [
  [
    assembly('Review table', [
      part('Tabletop', 1.8, 0.04, 0.8, 0, 0.71, 0),
      ...legNames.map((n, i) =>
        part(
          n,
          0.07,
          0.71,
          0.07,
          i % 2 ? 0.825 : -0.825,
          0,
          i < 2 ? -0.325 : 0.325,
        ),
      ),
    ]),
    assembly('Display assembly', [
      part('Display panel', 1.8, 1.4, 0.04, 0, 0.15, 0.72),
      part('Panel foot left', 0.3, 0.05, 0.35, -0.65, 0, 0.72),
      part('Panel foot right', 0.3, 0.05, 0.35, 0.65, 0, 0.72),
      part('Panel post left', 0.05, 0.1, 0.05, -0.65, 0.05, 0.72),
      part('Panel post right', 0.05, 0.1, 0.05, 0.65, 0.05, 0.72),
    ]),
    assembly('Side pieces', [part('Sample plinth', 0.6, 0.4, 0.6, -3, 0, 0.3)]),
    note(decision),
    {
      type: 'design_note',
      topic: 'Initial construction assumptions',
      text: 'Assumed a 40 mm tabletop, four square legs and a 1.8 m wide display panel. These are reversible choices, not user requirements.',
      source: 'assumption',
    },
  ],
  [
    resize('Sample plinth', 'width', 0.8, 0.5),
    resize('Sample plinth', 'height', 0.6, 0),
  ],
  [
    assembly('Stool', [
      part('Round stool', 0.42, 0.45, 0.42, -1.8, 0, -0.7, 'cylinder'),
    ]),
  ],
  [
    resize('Tabletop', 'width', 2.1, 0.5),
    move(['Leg front left', 'Leg back left'], -0.15),
    move(['Leg front right', 'Leg back right'], 0.15),
  ],
  [move(['Sample plinth', 'Round stool'], -0.5)],
  [
    resize('Tabletop', 'depth', 1.2, 0),
    move(['Leg back left', 'Leg back right'], 0, 0.4),
    move(panelNames, 0, 0.4),
  ],
  [move(panelNames, 0, -0.15), note(revision)],
  [
    resize('Tabletop', 'depth', 1.4, 0),
    move(['Leg back left', 'Leg back right'], 0, 0.2),
    move(panelNames, 0, 0.2),
  ],
];
export const changedNames = [
  [],
  ['Sample plinth'],
  [],
  ['Tabletop', ...legNames],
  ['Sample plinth', 'Round stool'],
  ['Tabletop', 'Leg back left', 'Leg back right', ...panelNames],
  panelNames,
  ['Tabletop', 'Leg back left', 'Leg back right', ...panelNames],
];
export const plan = (
  ops: any[],
  message = 'Offline calibration: execute the stated design step.',
): Plan => ({
  intent: 'apply',
  message,
  operations: ops as Operation[],
  brief: null,
  planning: { stage: message, assumptions: [], next: null },
});
export const empty = () =>
  newSession({ volumes: [], selectedId: null, groups: [] });
export const selector = (refs: string[]) => ({
  refs,
  role: null,
  level: null,
  nameContains: null,
});
const v = (s: Session, name: string) => {
  const a = s.project.volumes.filter((v) => v.name === name);
  assert.equal(a.length, 1, name);
  return a[0];
};

export async function facts(s: Session, turn: number, before?: Session) {
  const out: any[] = [];
  const check = (
    label: string,
    ok: boolean,
    expected?: unknown,
    actual?: unknown,
  ) => out.push({ label, passed: ok, expected, actual });
  const near = (label: string, a: number, e: number, tol = 0.001) =>
    check(label, Math.abs(a - e) <= tol, e, a);
  const top = v(s, 'Tabletop'),
    panel = v(s, 'Display panel');
  const ts = await solidStats(top),
    ps = await solidStats(panel);
  const width = turn >= 3 ? 2.1 : 1.8,
    depth = turn >= 7 ? 1.4 : turn >= 5 ? 1.2 : 0.8;
  const gap = turn >= 6 ? 0.15 : 0.3;
  near('Table width', ts.bounds.max[0] - ts.bounds.min[0], width);
  near('Table depth', ts.bounds.max[2] - ts.bounds.min[2], depth);
  near('Working height', ts.bounds.max[1], 0.75);
  near('Fixed front edge', ts.bounds.min[2], -0.4);
  near('Clear cable access', ps.bounds.min[2] - ts.bounds.max[2], gap);
  near(
    'Panel centered laterally',
    (ps.bounds.min[0] + ps.bounds.max[0]) / 2,
    0,
  );
  check(
    'Exact fixture roster',
    s.project.volumes.length === (turn >= 2 ? 12 : 11),
    turn >= 2 ? 12 : 11,
    s.project.volumes.length,
  );
  const px = turn >= 4 ? -3.5 : -3,
    pl = v(s, 'Sample plinth');
  near('Plinth X', pl.position.x, px);
  near('Plinth width', pl.dimensions.width, turn >= 1 ? 0.8 : 0.6);
  near('Plinth height', pl.dimensions.height, turn >= 1 ? 0.6 : 0.4);
  if (turn >= 2) {
    const st = v(s, 'Round stool');
    const stats = await solidStats(st);
    near('Stool X', st.position.x, turn >= 4 ? -2.3 : -1.8);
    near('Stool height', stats.bounds.max[1], 0.45);
    near('Stool diameter', stats.bounds.max[0] - stats.bounds.min[0], 0.42);
    near(
      'Stool occupied volume',
      stats.volume,
      Math.PI * 0.21 * 0.21 * 0.45,
      Math.PI * 0.21 * 0.21 * 0.45 * 0.02,
    );
  }
  for (const [i, name] of legNames.entries()) {
    const leg = v(s, name);
    near(name + ' X', leg.position.x, (i % 2 ? 1 : -1) * (width / 2 - 0.075));
    near(name + ' Z', leg.position.z, i < 2 ? -0.325 : depth - 0.475);
    near(name + ' support top', leg.position.y + leg.dimensions.height, 0.71);
  }
  for (const name of panelNames) {
    const p = v(s, name);
    near(name + ' common Z', p.position.z, depth - 0.4 + gap + 0.02);
  }
  for (const object of s.project.volumes) {
    const g = await solidStats(object);
    check(object.name + ' occupied solid', g.volume > 0);
    check(
      object.name + ' editable identity',
      typeof object.id === 'string' &&
        !s.project.groups?.find((g) => g.id === object.groupId)?.locked,
    );
  }
  const cable = s.project.design?.notes?.find(
    (n) => n.topic === 'Cable access',
  );
  check(
    'Active user decision retained',
    cable?.source === 'user' &&
      cable.text === (turn >= 6 ? revision : decision),
    turn >= 6 ? revision : decision,
    cable,
  );
  check(
    'Assumption remains labeled',
    s.project.design?.notes?.find(
      (n) => n.topic === 'Initial construction assumptions',
    )?.source === 'assumption',
  );
  if (before) {
    for (const old of before.project.volumes) {
      const now = s.project.volumes.find((q) => q.id === old.id);
      check(old.name + ' retains identity', !!now);
      if (!changedNames[turn].includes(old.name))
        check(old.name + ' unrelated unchanged', equalData(old, now));
    }
    check(
      'Existing groups retained',
      before.project.groups?.every((g) =>
        s.project.groups?.some((n) => equalData(n, g)),
      ) ?? true,
    );
  }
  return out;
}

/** Scripted host checks calibrate the browser only; they are never supplied in future live prompts. */
export function criteria(turn: number, original: Session): CompletionCriteria {
  const checks: any[] = [];
  const add = (
    r: any,
    source = 'request',
    evidence = prompts[turn].slice(0, 300),
  ) =>
    checks.push({
      source,
      evidence,
      requirement: { id: 'check-' + checks.length, label: r.kind, ...r },
    });
  const measure = (name: string, metric: string, value: number) =>
    add({
      kind: 'measure',
      selector: selector(['$name:' + name]),
      metric,
      aggregation: 'each',
      comparison: 'equal',
      value,
      tolerance: 0.001,
      relativeTolerance: 0,
    });
  if (turn === 0) {
    measure('Tabletop', 'width', 1.8);
    measure('Tabletop', 'depth', 0.8);
    measure('Tabletop', 'top', 0.75);
    add({ kind: 'editable', selector: selector(['$new']) });
  }
  if (turn === 1) {
    measure('Sample plinth', 'width', 0.8);
    measure('Sample plinth', 'height', 0.6);
  }
  if (turn === 2) {
    measure('Round stool', 'height', 0.45);
    add({
      kind: 'diameter',
      selector: selector(['$name:Round stool']),
      shape: 'cylinder',
      value: 0.42,
      tolerance: 0.001,
    });
  }
  if (turn === 3) measure('Tabletop', 'width', 2.1);
  if (turn === 4) {
    measure('Sample plinth', 'x', -3.5);
    measure('Round stool', 'x', -2.3);
  }
  if (turn === 5 || turn === 7) {
    measure('Tabletop', 'depth', turn === 5 ? 1.2 : 1.4);
    measure('Tabletop', 'top', 0.75);
  }
  if ([0, 5, 6, 7].includes(turn))
    add(
      {
        kind: 'offset',
        first: selector(['$name:Tabletop']),
        second: selector(['$name:Display panel']),
        axis: 'z',
        firstAnchor: 'max',
        secondAnchor: 'min',
        value: turn >= 6 ? 0.15 : 0.3,
        tolerance: 0.001,
      },
      turn === 0 || turn === 6 ? 'request' : 'decision',
      turn >= 6 ? revision : decision,
    );
  return {
    modeling: true,
    editable: original.project.volumes
      .filter((v) => changedNames[turn].includes(v.name))
      .map((v) => v.id),
    checks,
    qualitativeLimits: [],
  };
}

export async function referenceSession() {
  let s = empty();
  const records: any[] = [];
  for (let i = 0; i < prompts.length; i++) {
    const before = structuredClone(s);
    s = (
      await applyPlan(s, plan(capturedOperations(i, s)), undefined, true, {
        id: 'offline-turn-' + i,
        text: prompts[i],
      })
    ).session;
    const f = await facts(s, i, before);
    assert(
      f.every((x) => x.passed),
      JSON.stringify(f.filter((x) => !x.passed)),
    );
    records.push({
      turn: i + 1,
      prompt: prompts[i],
      before,
      after: structuredClone(s),
      facts: f,
    });
  }
  return records;
}

/** Host captures are submitted as model operation arguments. Expected geometry
 * and scripted responses are evaluation-only, never application templates. */
export function capturedOperations(turn: number, original: Session): any[] {
  return operations[turn].map((op) =>
    op.type === 'design_note' && op.source === 'user'
      ? {
          ...op,
          capture: {
            quote: op.text,
            revises:
              turn === 6
                ? original.project.design?.notes?.find(
                    (n) => n.topic === 'Cable access',
                  )?.decision?.id
                : null,
          },
        }
      : op,
  );
}
export type Step = {
  base?: number;
  prompt: string;
  filler?: {
    name: string;
    metric: 'height' | 'width' | 'depth' | 'x';
    value: number;
  };
};
const editStep = (
  name: string,
  metric: 'height' | 'width' | 'depth',
  value: number,
): Step => ({
  prompt: `Make the ${name.toLowerCase()} ${value} meters ${metric === 'height' ? 'high' : metric === 'width' ? 'wide' : 'deep'}. Keep everything else unchanged.`,
  filler: { name, metric, value },
});
const base = (n: number): Step => ({ base: n, prompt: prompts[n] });
export const sequence: Step[] = [
  ...[0, 1, 2, 3, 4].map(base),
  editStep('Round stool', 'height', 0.48),
  editStep('Round stool', 'height', 0.45),
  editStep('Sample plinth', 'depth', 0.7),
  editStep('Sample plinth', 'depth', 0.6),
  editStep('Sample plinth', 'width', 0.85),
  editStep('Sample plinth', 'width', 0.8),
  base(5),
  base(6),
  editStep('Sample plinth', 'width', 0.82),
  editStep('Sample plinth', 'width', 0.8),
  editStep('Sample plinth', 'depth', 0.72),
  editStep('Sample plinth', 'depth', 0.6),
  editStep('Round stool', 'height', 0.5),
  editStep('Round stool', 'height', 0.45),
  editStep('Sample plinth', 'height', 0.65),
  editStep('Sample plinth', 'height', 0.6),
  editStep('Round stool', 'height', 0.47),
  editStep('Round stool', 'height', 0.45),
  base(7),
];
export function stepOperations(step: number, original: Session) {
  const current = sequence[step];
  if (current.base !== undefined)
    return capturedOperations(current.base, original);
  const f = current.filler!;
  return [resize(f.name, f.metric, f.value, f.metric === 'height' ? 0 : 0.5)];
}
export function stepCriteria(
  step: number,
  original: Session,
): CompletionCriteria {
  const current = sequence[step];
  if (current.base !== undefined) return criteria(current.base, original);
  const f = current.filler!;
  return {
    modeling: true,
    editable: [v(original, f.name).id],
    qualitativeLimits: [],
    checks: [
      {
        source: 'request',
        evidence: current.prompt,
        requirement: {
          id: 'filler-dimension',
          label: 'Intervening dimension',
          kind: 'measure',
          selector: selector([v(original, f.name).id]),
          metric: f.metric,
          aggregation: 'each',
          comparison: 'equal',
          value: f.value,
          tolerance: 0.001,
          relativeTolerance: 0,
        },
      },
    ],
  };
}
export async function stepFacts(s: Session, step: number, before: Session) {
  const current = sequence[step];
  if (current.base !== undefined) return facts(s, current.base, before);
  const f = current.filler!,
    part = v(s, f.name),
    stat = await solidStats(part);
  const axis = f.metric === 'height' ? 1 : f.metric === 'width' ? 0 : 2;
  const value = stat.bounds.max[axis] - stat.bounds.min[axis];
  return [
    {
      label: 'Intervening solid dimension',
      passed: Math.abs(value - f.value) <= 0.001,
      expected: f.value,
      actual: value,
    },
    {
      label: 'Unrelated components preserved',
      passed: before.project.volumes
        .filter((o) => o.name !== f.name)
        .every((o) =>
          equalData(
            o,
            s.project.volumes.find((n) => n.id === o.id),
          ),
        ),
    },
    {
      label: 'Decisions unchanged',
      passed: equalData(before.project.design, s.project.design),
    },
  ];
}
