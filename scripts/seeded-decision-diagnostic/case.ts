/** Evaluation fixtures only. Neither these criteria nor these recipes are
 * imported by ATELIER. All provider responses in this preparation are saved or
 * scripted; there is no SDK or paid execution path. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newSession, type Session } from '../../src/intelligence/engine';
import { defaultCamera } from '../../src/intelligence/context';
import { verifyCompletion } from '../../src/intelligence/completion';
import { selector, criteria } from '../../tests/fixtures/completion';
import { prompts, originalQuote } from '../design-decision-live/config';
import { oracle, inventory } from '../design-decision-live/geometry';
import { cloneSolid, vertical, mapSolid } from '../phase3-evaluation/geometry';
export { prompts, originalQuote, inventory };
export const frozen = 'deb730317cafe2e0b251a788693934196660140c';
export const source = 'docs/evaluations/design-decisions/live/live-1';
export const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
export const trace = read(`${source}/results.json`).turns[0];
export const startFrame = trace.events[0].input.scene.camera;
export const savedCriteria = trace.events[2].response;
export const savedBuild = trace.events[0].response;
export const savedFinish = trace.events[1].response;
export const empty = () => newSession({ volumes: [], selectedId: null });
export const object = (s: Session, name: string) => {
  const vs = s.project.volumes.filter((v) => v.name === name);
  assert.equal(vs.length, 1, `Unique fixture identity for ${name}`);
  return vs[0];
};
export const bindings = (s: Session) => ({
  turntable: object(s, 'Circular turntable').id,
  light: object(s, 'Overhead rectangular light panel').id,
  cube: object(s, 'Separate storage cube').id,
  ...(s.project.volumes.some((v) => v.name === 'Sample puck')
    ? { puck: object(s, 'Sample puck').id }
    : {}),
  frame: s.project.volumes
    .filter(
      (v) =>
        v.name.startsWith('Frame ') ||
        v.name.startsWith('Light panel ') ||
        v.name === 'Overhead rectangular light panel',
    )
    .map((v) => v.id),
});
export const asPlan = (
  operations: any[],
  message = 'Offline scripted diagnostic response.',
) => ({
  intent: 'apply',
  message,
  operations,
  planning: { stage: message, assumptions: [], next: null },
});
export const shape = (
  name: string,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  kind = 'box',
) => ({
  type: 'assembly',
  name: `${name} assembly`,
  origin: { x: 0, y: 0, z: 0 },
  rotation: 0,
  elements: [
    {
      key: 'part',
      name,
      shape: kind,
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
export const obstruction = shape(
  'Offline obstruction',
  0.08,
  0.12,
  0.08,
  0,
  0.3,
  0,
);
export const corner = shape(
  'Offline corner occupancy',
  0.02,
  0.1,
  0.02,
  0.32,
  0.3,
  0.32,
);

// This is a sufficient enclosing box, NOT an insertion path and NOT an exact
// circular-volume classifier. Passing proves the circle is empty; a failure
// outside the circle alone cannot prove the user's circular space is blocked.
export const envelope = (top: number, gap: number, diameter = 0.7) => ({
  id: 'check-12',
  label: 'Conservative loading envelope (no path claim)',
  kind: 'region',
  selector: selector(['$all']),
  center: { x: 0, y: top + gap / 2, z: 0 },
  size: { x: diameter, y: gap, z: diameter },
  rotation: 0,
  occupancy: 'empty',
  tolerance: 0.001,
});
export function scannerCriteria(frame = startFrame) {
  const c = structuredClone(savedCriteria);
  c.checks.find((x: any) => x.requirement.id === 'check-12').requirement =
    envelope(0.24, 0.32);
  const left = c.checks.find((x: any) => x.requirement.id === 'check-18');
  left.requirement.value = -2 * frame.right.x;
  c.checks.push({
    ...structuredClone(left),
    requirement: {
      ...left.requirement,
      id: 'check-left-z',
      axis: 'z',
      value: -2 * frame.right.z,
    },
  });
  c.qualitativeLimits = c.qualitativeLimits.filter(
    (x: string) => !x.startsWith('Interpret two meters'),
  );
  c.qualitativeLimits.push(
    'Offline diagnostic: a 0.70 × 0.32 × 0.70 m world box encloses the requested circular loading volume. No insertion path or structural certification is asserted.',
  );
  return c;
}
export function seed() {
  const provisional: Session = read(
    `${source}/offline-forensics/first-proposal.session.json`,
  );
  // Fixture injection is explicit. Discard provisional operation history rather
  // than pretending it represents a successful browser creation commit.
  const s = newSession(structuredClone(provisional.project));
  s.context = structuredClone(provisional.context);
  return s;
}
export function seedMessages(s: Session) {
  const d = s.project.design!.notes![0].decision!;
  return [
    { role: 'user', content: d.origin.text, id: d.origin.id },
    {
      role: 'assistant',
      content:
        'Offline seeded diagnostic: this validated starting model was reconstructed from the preserved rejected proposal. This is not a successful fresh-AI creation commit.',
    },
  ];
}
const resize = (id: string, axis: string, value: number, mode = 'set') => ({
  targets: [id],
  where: [],
  translation: null,
  resize: { axis, mode, value, anchor: axis === 'height' ? 0 : 0.5 },
});
const translate = (targets: string[], dy: number) => ({
  targets,
  where: [],
  translation: { x: 0, y: dy, z: 0 },
  resize: null,
});
export function sidePlan(turn: number, s: Session) {
  const b = bindings(s),
    c = object(s, 'Separate storage cube');
  if ([2, 3, 4, 10].includes(turn))
    return asPlan([
      {
        type: 'edit_components',
        edits: [
          resize(
            b.cube,
            turn === 3 ? 'width' : turn === 4 ? 'depth' : 'height',
            turn === 2 ? 0.5 : turn === 3 ? 0.55 : turn === 4 ? 0.45 : 0.6,
          ),
        ],
      },
    ]);
  if (turn === 5)
    return asPlan([
      { type: 'move', targets: [b.cube], direction: 'left', distance: 0.2 },
    ]);
  if (turn === 6)
    return asPlan([
      shape(
        'Sample puck',
        0.12,
        0.03,
        0.12,
        c.position.x,
        0,
        c.position.z - 0.7,
        'cylinder',
      ),
    ]);
  if (turn === 9)
    return asPlan([
      { type: 'move', targets: [b.puck], direction: 'forward', distance: 0.15 },
    ]);
  assert(b.puck);
  if (turn === 8)
    return asPlan([
      { type: 'edit_components', edits: [resize(b.puck, 'width', 0.16)] },
      { type: 'edit_components', edits: [resize(b.puck, 'depth', 0.16)] },
    ]);
  return asPlan([
    {
      type: 'edit_components',
      edits: [resize(b.puck, 'height', turn === 7 ? 0.05 : 0.04)],
    },
  ]);
}
export function connectedPlan(turn: 12 | 13, s: Session, wrong = false) {
  const b = bindings(s),
    dy = turn === 12 ? 0.11 : -0.14;
  const edits: any[] = [];
  if (turn === 12) {
    edits.push(translate([b.turntable], dy));
    edits.push(resize(object(s, 'Turntable pedestal').id, 'height', dy, 'add'));
  }
  if (!wrong) {
    edits.push(
      translate(
        [
          b.light,
          ...[
            'Frame crossbeam',
            'Light panel left hanger',
            'Light panel right hanger',
          ].map((n) => object(s, n).id),
        ],
        dy,
      ),
    );
    for (const name of ['Frame left post', 'Frame right post'])
      edits.push(resize(object(s, name).id, 'height', dy, 'add'));
  }
  const ops: any[] = edits.length ? [{ type: 'edit_components', edits }] : [];
  if (turn === 13)
    ops.push({
      type: 'design_note',
      topic: s.project.design!.notes![0].topic,
      text: 'The user now wants exactly 18 cm of sample-loading clearance for flatter samples.',
      source: 'user',
      capture: {
        quote: prompts[12],
        revises: s.project.design!.notes![0].decision!.id,
      },
    });
  return asPlan(ops);
}
const measured = (
  id: string,
  selection: any,
  metric: string,
  value: number,
) => ({
  id,
  label: id,
  kind: 'measure',
  selector: selection,
  metric,
  aggregation: 'each',
  comparison: 'equal',
  value,
  tolerance: 0.001,
  relativeTolerance: 0,
});
export function sideCriteria(turn: number, s: Session, frame = defaultCamera) {
  const b = bindings(s),
    req: any[] = [],
    named = selector(['$new'], 'Sample puck');
  let allowed: string[] = [];
  if ([2, 3, 4, 10].includes(turn)) {
    allowed = [b.cube];
    req.push(
      measured(
        'side-dimension',
        selector(allowed),
        turn === 3 ? 'width' : turn === 4 ? 'depth' : 'height',
        turn === 2 ? 0.5 : turn === 3 ? 0.55 : turn === 4 ? 0.45 : 0.6,
      ),
    );
  } else if ([5, 9].includes(turn)) {
    const id = turn === 5 ? b.cube : b.puck!,
      v = s.project.volumes.find((o) => o.id === id)!;
    allowed = [id];
    const basis = turn === 5 ? frame.right : frame.forward,
      distance = turn === 5 ? -0.2 : 0.15;
    for (const axis of ['x', 'z'] as const)
      req.push(
        measured(
          'side-' + axis,
          selector([id]),
          axis,
          v.position[axis] + distance * basis[axis],
        ),
      );
  } else if (turn === 6)
    req.push(measured('puck-height', named, 'height', 0.03), {
      id: 'puck-round',
      label: 'puck-round',
      kind: 'diameter',
      selector: named,
      shape: 'cylinder',
      value: 0.12,
      tolerance: 0.001,
    });
  else {
    allowed = [b.puck!];
    req.push(
      measured(
        'puck-height-or-width',
        selector(allowed),
        turn === 8 ? 'width' : 'height',
        turn === 7 ? 0.05 : turn === 8 ? 0.16 : 0.04,
      ),
    );
  }
  return criteria(req, allowed, prompts[turn - 1]);
}
export function connectedCriteria(turn: 12 | 13, s: Session) {
  const b = bindings(s),
    top = 0.35,
    gap = turn === 12 ? 0.32 : 0.18;
  const sel = (id: string) => selector([id]);
  const allowed =
    turn === 13
      ? b.frame
      : s.project.volumes
          .filter((v) => ![b.cube, b.puck].includes(v.id))
          .map((v) => v.id);
  const req: any[] = [
    measured('turntable-top', sel(b.turntable), 'top', top),
    {
      id: 'diameter',
      label: 'diameter',
      kind: 'diameter',
      selector: sel(b.turntable),
      shape: 'cylinder',
      value: 0.7,
      tolerance: 0.001,
    },
    {
      id: 'clearance',
      label: 'clearance',
      kind: 'offset',
      first: sel(b.turntable),
      second: sel(b.light),
      axis: 'y',
      firstAnchor: 'max',
      secondAnchor: 'min',
      value: gap,
      tolerance: 0.001,
    },
    ...(['x', 'z'] as const).map((axis) => ({
      id: 'alignment-' + axis,
      label: 'alignment-' + axis,
      kind: 'offset',
      first: sel(b.turntable),
      second: sel(b.light),
      axis,
      firstAnchor: 'center',
      secondAnchor: 'center',
      value: 0,
      tolerance: 0.001,
    })),
    envelope(top, gap),
    {
      id: 'editable',
      label: 'editable',
      kind: 'editable',
      selector: selector(['$all']),
    },
  ];
  // Preserve horizontal position independently from the pre-edit model.
  const v = object(s, 'Circular turntable');
  req.push(
    measured('preserve-x', sel(b.turntable), 'x', v.position.x),
    measured('preserve-z', sel(b.turntable), 'z', v.position.z),
  );
  const c = criteria(req, allowed, prompts[turn - 1]);
  c.checks[0].calculation = {
    frame: 'world_xyz_y_up',
    nodes:
      turn === 12
        ? [
            { kind: 'original', objectId: b.turntable, metric: 'top' },
            {
              kind: 'quantity',
              value: 11,
              unit: 'cm',
              source: 'request',
              evidence: 'Raise the turntable surface by 11 cm.',
            },
            { kind: 'operation', op: 'add', args: [0, 1] },
          ]
        : [{ kind: 'original', objectId: b.turntable, metric: 'top' }],
    output: { kind: 'value', node: turn === 12 ? 2 : 0 },
  };
  for (const check of c.checks)
    if (
      ['clearance', 'check-12'].includes(check.requirement.id) &&
      turn === 12
    ) {
      check.source = 'decision';
      check.evidence = originalQuote;
    }
  return c;
}
export async function inspectSolids(
  turn: number,
  before: Session,
  after: Session,
  frame = startFrame,
) {
  const m = await oracle(turn, before, after, bindings(after), frame);
  const pedestal = await cloneSolid(object(after, 'Turntable pedestal')),
    platter = await cloneSolid(object(after, 'Circular turntable'));
  try {
    const gap = pedestal.minGap(platter, 0.02);
    m.facts.push({
      name: 'Turntable supported by pedestal',
      status: gap <= 0.001 ? 'verified' : 'incorrect',
      expected: 0,
      actual: gap,
    });
  } finally {
    pedestal.delete();
    platter.delete();
  }
  m.correct = !m.facts.some((f) => f.status === 'incorrect');
  m.fullyMeasured = m.facts.every((f) => f.status === 'verified');
  return m;
}
export async function circularOccupancy(s: Session, top = 0.24, gap = 0.32) {
  const probe = mapSolid(vertical(gap, 0.35), (q) => q.translate([0, top, 0]));
  const rows: any[] = [];
  try {
    for (const v of s.project.volumes) {
      const q = await cloneSolid(v);
      try {
        const hit = q.intersect(probe);
        try {
          rows.push({ id: v.id, name: v.name, occupiedM3: hit.volume() });
        } finally {
          hit.delete();
        }
      } finally {
        q.delete();
      }
    }
  } finally {
    probe.delete();
  }
  return {
    label:
      'Independent circular occupancy diagnostic, not an application predicate',
    rows,
    occupiedM3: rows.reduce((n, r) => n + r.occupiedM3, 0),
  };
}
export async function validateSeed() {
  const s = seed(),
    c = scannerCriteria();
  const report = await verifyCompletion(c, empty(), s);
  const measurements = await inspectSolids(1, empty(), s);
  assert(report.canCommit && measurements.fullyMeasured);
  return { session: s, criteria: c, report, measurements };
}
