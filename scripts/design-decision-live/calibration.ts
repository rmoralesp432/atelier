/** Scripted responses ONLY for preflight harness calibration, never used in live mode. */
import {
  directPlan,
  applyPlan,
  newSession,
  type Session,
} from '../../src/intelligence/engine';
import { defaultCamera } from '../../src/intelligence/context';
import { prompts, originalQuote } from './config';
import { criteria, selector } from '../../tests/fixtures/completion';
import { bind, inventory, oracle } from './geometry';
const box = (
  name: string,
  w: number,
  h: number,
  d: number,
  x = 0,
  y = 0,
  z = 0,
  shape = 'box',
) => ({
  type: 'assembly',
  name: name + ' assembly',
  origin: { x: 0, y: 0, z: 0 },
  rotation: 0,
  elements: [
    {
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
    },
  ],
});
const edit = (id: string, axis: string, value: number) => ({
  type: 'edit_components',
  edits: [
    {
      targets: [id],
      where: [],
      translation: null,
      resize: { axis, mode: 'set', value, anchor: axis === 'height' ? 0 : 0.5 },
    },
  ],
});
export const empty = () => newSession({ volumes: [], selectedId: null });
export function operations(turn: number, s: Session) {
  const find = (n: string) => s.project.volumes.find((v) => v.name === n)!.id;
  const capture = (quote: string) => ({
    type: 'design_note',
    topic: 'Sample loading',
    text: quote,
    source: 'user',
    capture: {
      quote,
      revises:
        s.project.design?.notes?.find((n) => n.decision)?.decision?.id ?? null,
    },
  });
  if (turn === 1)
    return [
      box('Turntable', 0.7, 0.24, 0.7, 0, 0, 0, 'cylinder'),
      box('Light panel', 0.8, 0.03, 0.65, 0, 0.56),
      box('Post left', 0.04, 0.62, 0.04, -0.44),
      box('Post right', 0.04, 0.62, 0.04, 0.44),
      box('Crossbeam', 0.92, 0.03, 0.04, 0, 0.59),
      box('Storage cube', 0.4, 0.4, 0.4, -2),
      capture(originalQuote),
    ];
  if ([2, 3, 4, 10].includes(turn))
    return [
      edit(
        find('Storage cube'),
        turn === 3 ? 'width' : turn === 4 ? 'depth' : 'height',
        turn === 2 ? 0.5 : turn === 3 ? 0.55 : turn === 4 ? 0.45 : 0.6,
      ),
    ];
  if (turn === 5)
    return [
      {
        type: 'move',
        targets: [find('Storage cube')],
        direction: 'west',
        distance: 0.2,
      },
    ];
  if (turn === 6)
    return [box('Sample puck', 0.12, 0.03, 0.12, -1.5, 0, 0, 'cylinder')];
  if ([7, 8, 11].includes(turn))
    return turn === 8
      ? [
          edit(find('Sample puck'), 'width', 0.16),
          edit(find('Sample puck'), 'depth', 0.16),
        ]
      : [edit(find('Sample puck'), 'height', turn === 7 ? 0.05 : 0.04)];
  if (turn === 9)
    return [
      {
        type: 'move',
        targets: [find('Sample puck')],
        direction: 'north',
        distance: 0.15,
      },
    ];
  const dy = turn === 12 ? 0.11 : turn === 13 ? -0.14 : 0.07;
  const ops: any[] = [
    {
      type: 'edit_components',
      edits: [
        {
          targets: [find('Light panel'), find('Crossbeam')],
          where: [],
          translation: { x: 0, y: dy, z: 0 },
          resize: null,
        },
      ],
    },
  ];
  for (const name of ['Post left', 'Post right'])
    ops.push(
      edit(
        find(name),
        'height',
        s.project.volumes.find((v) => v.name === name)!.dimensions.height + dy,
      ),
    );
  if (turn !== 13)
    ops.push(edit(find('Turntable'), 'height', turn === 12 ? 0.35 : 0.42));
  if (turn === 13) ops.push(capture(prompts[12]));
  return ops;
}
export function checks(turn: number, s: Session) {
  const sel = (name: string) => selector(['$name:' + name]);
  const measure = (name: string, metric: string, value: number) => ({
    kind: 'measure',
    id: metric + name,
    label: metric + name,
    selector: sel(name),
    metric,
    aggregation: 'each',
    comparison: 'equal',
    value,
    tolerance: 0.001,
    relativeTolerance: 0,
  });
  const req: any[] = [];
  if (turn === 1) req.push(measure('Turntable', 'top', 0.24));
  if ([2, 3, 4, 10].includes(turn))
    req.push(
      measure(
        'Storage cube',
        turn === 3 ? 'width' : turn === 4 ? 'depth' : 'height',
        turn === 2 ? 0.5 : turn === 3 ? 0.55 : turn === 4 ? 0.45 : 0.6,
      ),
    );
  if (turn === 5) req.push(measure('Storage cube', 'x', -2.2));
  if (turn === 6) req.push(measure('Sample puck', 'height', 0.03));
  if ([7, 8, 11].includes(turn))
    req.push(
      measure(
        'Sample puck',
        turn === 8 ? 'width' : 'height',
        turn === 7 ? 0.05 : turn === 8 ? 0.16 : 0.04,
      ),
    );
  if (turn === 9) req.push(measure('Sample puck', 'z', -0.15));
  if ([12, 14].includes(turn))
    req.push(measure('Turntable', 'top', turn === 12 ? 0.35 : 0.42));
  if ([1, 12, 13, 14].includes(turn))
    req.push({
      kind: 'offset',
      id: 'loading-clearance',
      label: 'Sample-loading clearance',
      first: sel('Turntable'),
      second: sel('Light panel'),
      axis: 'y',
      firstAnchor: 'max',
      secondAnchor: 'min',
      value: turn >= 13 ? 0.18 : 0.32,
      tolerance: 0.001,
    });
  const out = criteria(
    req,
    s.project.volumes.map((v) => v.id),
    prompts[turn - 1].slice(0, 300),
  );
  if ([12, 14].includes(turn)) {
    const gap = out.checks.at(-1)!;
    gap.source = 'decision';
    gap.evidence = s.project.design!.notes!.find(
      (n) => n.decision,
    )!.decision!.quote;
  }
  return out;
}
export const offlinePlan = (turn: number, s: Session) => ({
  intent: 'apply',
  message: 'Offline harness calibration only.',
  planning: { stage: 'Calibrate', assumptions: [], next: null },
  operations: operations(turn, s),
});
export async function calibrateGeometry() {
  let s = empty(),
    binding: any;
  const results = [];
  for (let turn = 1; turn <= 14; turn++) {
    const before = s;
    s = (
      await applyPlan(s, offlinePlan(turn, s), defaultCamera, true, {
        id: 'calibration-' + turn,
        text: prompts[turn - 1],
      })
    ).session;
    binding ??= bind(await inventory(s));
    const measured = await oracle(turn, before, s, binding);
    if (!measured.fullyMeasured)
      throw Error(
        JSON.stringify({
          turn,
          failures: measured.facts.filter((f) => f.status !== 'verified'),
        }),
      );
    results.push({ turn, checks: measured.facts.length, correct: true });
  }
  const wrong = structuredClone(s);
  wrong.project.volumes.find((v) => v.id === binding.light)!.position.y -= 0.05;
  const rejected = await oracle(14, s, wrong, binding);
  if (rejected.correct)
    throw Error('Displaced panel was not measured incorrect');
  return { paidCalls: 0, results, wrongPanelBlocked: !rejected.correct };
}
