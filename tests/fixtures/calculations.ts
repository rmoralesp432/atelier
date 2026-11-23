import type { Calculation } from '../../src/intelligence/calculationSchema';

/** Test-only notation builder. It constructs descriptions, never their results. */
export function calculation() {
  const nodes: Calculation['nodes'] = [];
  const add = (node: Calculation['nodes'][number]) => nodes.push(node) - 1;
  return {
    quantity: (
      value: number,
      unit: Extract<Calculation['nodes'][number], { kind: 'quantity' }>['unit'],
      evidence: string,
      source: 'request' | 'history' = 'request',
    ) => add({ kind: 'quantity', value, unit, evidence, source }),
    constant: (value: number) => add({ kind: 'constant', value }),
    original: (
      objectId: string,
      metric: Extract<
        Calculation['nodes'][number],
        { kind: 'original' }
      >['metric'],
    ) => add({ kind: 'original', objectId, metric }),
    op: (
      op: Extract<Calculation['nodes'][number], { kind: 'operation' }>['op'],
      ...args: number[]
    ) => add({ kind: 'operation', op, args }),
    value: (node: number): Calculation => ({
      frame: 'world_xyz_y_up',
      nodes,
      output: { kind: 'value', node },
    }),
    points: (x: number, y: number, z: number): Calculation => ({
      frame: 'world_xyz_y_up',
      nodes,
      output: { kind: 'points', x, y, z },
    }),
  };
}

/** Manual independent encoding of the SAVED request; not a new AI response. */
export function savedStaggeredRelationship(): Calculation {
  const c = calculation();
  const pitch = c.quantity(72, 'cm', 'Centers along each row are 72 cm apart');
  const gap = c.quantity(64, 'cm', 'the rows are 64 cm apart');
  const angle = c.quantity(
    31,
    'deg',
    'The rows run 31 degrees from east toward north, with X east and Z north.',
  );
  const count = c.quantity(5, 'scalar', 'two rows of five');
  const zero = c.constant(0),
    one = c.constant(1),
    two = c.constant(2);
  const half = c.op('divide', c.op('subtract', count, one), two);
  const along = c.op(
    'multiply',
    c.op('range', c.op('negate', half), one, count),
    pitch,
  );
  // A half-pitch lead is shared equally about the whole-array origin.
  const shift = c.op('divide', c.op('divide', pitch, two), two);
  const across = c.op('divide', gap, two);
  const u = c.op(
    'concat',
    c.op('subtract', along, shift),
    c.op('add', along, shift),
  );
  const zeroLength = c.op('multiply', zero, gap);
  const v = c.op(
    'concat',
    c.op('range', c.op('negate', across), zeroLength, count),
    c.op('range', across, zeroLength, count),
  );
  const cos = c.op('cos', angle),
    sin = c.op('sin', angle);
  return c.points(
    c.op('subtract', c.op('multiply', u, cos), c.op('multiply', v, sin)),
    zero,
    c.op('add', c.op('multiply', u, sin), c.op('multiply', v, cos)),
  );
}
