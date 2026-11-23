import { MAX_SCENE_OBJECTS } from '../limits';
import { solidStats } from '../geometry/kernel';
import { isFlat } from '../geometry/spatial';
import { flatPhysicalBounds } from './completionGeometry';
import type { Session } from './engine';
import {
  calculationSchema,
  type Calculation,
  type CalculationTrace,
} from './calculationSchema';
import {
  completionCriteriaSchema,
  type CompletionCriteria,
} from './completionSchema';

type Quantity = { values: number[]; length: number; angle: number };
const q = (values: number[], length = 0, angle = 0): Quantity => ({
  values,
  length,
  angle,
});
const unit = (q: Quantity) =>
  q.angle
    ? `m^${q.length} rad^${q.angle}`
    : (['scalar', 'm', 'm²', 'm³'][q.length] ?? `m^${q.length}`);
const scalar = (q: Quantity) => q.length === 0 && q.angle === 0;
const sameUnit = (a: Quantity, b: Quantity) =>
  a.length === b.length && a.angle === b.angle;
const compatible = (a: Quantity, b: Quantity) => {
  if (!sameUnit(a, b)) throw Error('Calculation combines incompatible units.');
};
const size = (qs: Quantity[]) => {
  const n = Math.max(...qs.map((q) => q.values.length));
  if (
    !n ||
    n > MAX_SCENE_OBJECTS ||
    qs.some((q) => q.values.length !== 1 && q.values.length !== n)
  )
    throw Error(
      'Calculation array sizes do not agree or exceed scene capacity.',
    );
  return n;
};
const at = (q: Quantity, i: number) => q.values[q.values.length === 1 ? 0 : i];
const asLength = (a: Quantity) => {
  // Exact mathematical zero is a valid world origin coordinate in any unit.
  if (scalar(a) && a.values.every((v) => v === 0)) return q(a.values, 1);
  if (a.length !== 1 || a.angle !== 0)
    throw Error('World coordinates require length units.');
  return a;
};

/** Compile only expected values, then run the unchanged geometric predicates.
 * This function deliberately has no candidate parameter or geometry access. */
export async function compileCalculations(
  raw: CompletionCriteria,
  original: Session,
  signal?: AbortSignal,
) {
  const traces = new Map<string, CalculationTrace>();
  const originals = new Map(original.project.volumes.map((v) => [v.id, v]));
  const stats = new Map<string, ReturnType<typeof solidStats>>();
  let totalCells = 0;
  async function evaluate(input: Calculation) {
    const definition = calculationSchema.parse(input),
      values: Quantity[] = [];
    const sources: CalculationTrace['sources'] = [];
    let cells = 0;
    for (const [index, node] of definition.nodes.entries()) {
      if (signal?.aborted) throw Error('Calculation cancelled.');
      let value: Quantity;
      if (node.kind === 'quantity') {
        const factor = {
          scalar: 1,
          m: 1,
          cm: 0.01,
          mm: 0.001,
          deg: Math.PI / 180,
          rad: 1,
        }[node.unit];
        value = q(
          [node.value * factor],
          ['m', 'cm', 'mm'].includes(node.unit) ? 1 : 0,
          ['deg', 'rad'].includes(node.unit) ? 1 : 0,
        );
      } else if (node.kind === 'constant') value = q([node.value]);
      else if (node.kind === 'original') {
        const v = originals.get(node.objectId);
        if (!v) throw Error('Calculation source is not an original object.');
        if (node.metric === 'rotation_y')
          value = q([(v.rotation * Math.PI) / 180], 0, 1);
        else {
          if (!isFlat(v) && !stats.has(v.id)) stats.set(v.id, solidStats(v));
          const s = isFlat(v) ? undefined : await stats.get(v.id)!;
          if (node.metric === 'volume') {
            if (!s) throw Error('Original volume requires a solid.');
            value = q([s.volume], 3);
          } else {
            const b = s?.bounds ?? flatPhysicalBounds(v);
            const axis = ['x', 'width'].includes(node.metric)
              ? 0
              : ['z', 'depth'].includes(node.metric)
                ? 2
                : 1;
            value = q(
              [
                ['width', 'height', 'depth'].includes(node.metric)
                  ? b.max[axis] - b.min[axis]
                  : node.metric === 'top'
                    ? b.max[1]
                    : node.metric === 'y'
                      ? b.min[1]
                      : (b.min[axis] + b.max[axis]) / 2,
              ],
              1,
            );
          }
        }
      } else {
        if (node.args.some((i) => i >= index))
          throw Error(
            'Calculation must reference earlier nodes; cycles and forward references are forbidden.',
          );
        const args = node.args.map((i) => values[i]);
        const [a, b] = args;
        const arity =
          node.op === 'range'
            ? 3
            : ['negate', 'sin', 'cos'].includes(node.op)
              ? 1
              : node.op === 'concat'
                ? args.length
                : 2;
        if (args.length !== arity)
          throw Error('Incorrect calculation operand count.');
        if (node.op === 'concat') {
          args.forEach((v) => compatible(a, v));
          value = { ...a, values: args.flatMap((v) => v.values) };
        } else if (node.op === 'range') {
          compatible(a, b);
          const count = args[2];
          if (
            args.some((v) => v.values.length !== 1) ||
            !scalar(count) ||
            !Number.isInteger(count.values[0]) ||
            count.values[0] < 1 ||
            count.values[0] > MAX_SCENE_OBJECTS
          )
            throw Error(
              'Range requires a scalar start/step and a bounded integer count.',
            );
          value = {
            ...a,
            values: Array.from(
              { length: count.values[0] },
              (_, i) => a.values[0] + i * b.values[0],
            ),
          };
        } else if (['sin', 'cos'].includes(node.op)) {
          if (a.length !== 0 || a.angle !== 1)
            throw Error('Trigonometry requires explicit angular units.');
          value = q(
            a.values.map((v) =>
              node.op === 'sin' ? Math.sin(v) : Math.cos(v),
            ),
          );
        } else if (node.op === 'negate')
          value = { ...a, values: a.values.map((v) => -v) };
        else {
          if (['add', 'subtract'].includes(node.op)) compatible(a, b);
          const length =
            node.op === 'multiply'
              ? a.length + b.length
              : node.op === 'divide'
                ? a.length - b.length
                : a.length;
          const angle =
            node.op === 'multiply'
              ? a.angle + b.angle
              : node.op === 'divide'
                ? a.angle - b.angle
                : a.angle;
          value = q(
            Array.from({ length: size(args) }, (_, i) => {
              const x = at(a, i),
                y = at(b, i);
              if (node.op === 'divide' && y === 0)
                throw Error('Calculation division by zero.');
              return node.op === 'add'
                ? x + y
                : node.op === 'subtract'
                  ? x - y
                  : node.op === 'multiply'
                    ? x * y
                    : x / y;
            }),
            length,
            angle,
          );
        }
      }
      cells += value.values.length;
      totalCells += value.values.length;
      if (
        value.values.length > MAX_SCENE_OBJECTS ||
        cells > 32768 ||
        totalCells > 131072 ||
        value.values.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e12)
      )
        throw Error('Calculation exceeds finite-value or resource limits.');
      values.push(value);
      if (node.kind !== 'operation')
        sources.push({ node: index, unit: unit(value), values: value.values });
    }
    const read = (index: number) => {
      if (!values[index]) throw Error('Unknown calculation output node.');
      return values[index];
    };
    const out = definition.output;
    if (out.kind === 'value') {
      const value = read(out.node);
      if (value.values.length !== 1)
        throw Error('A scalar measurement requires one calculated value.');
      return {
        value,
        trace: {
          definition,
          sources,
          expectedUnit: unit(value),
          expected: value.values[0],
        },
      };
    }
    const coordinates = [out.x, out.y, out.z].map((i) => asLength(read(i)));
    const points = Array.from({ length: size(coordinates) }, (_, i) => ({
      x: at(coordinates[0], i),
      y: at(coordinates[1], i),
      z: at(coordinates[2], i),
    }));
    return {
      trace: { definition, sources, expectedUnit: 'm', expected: points },
      points,
    };
  }
  const checks: CompletionCriteria['checks'] = [];
  for (const check of raw.checks) {
    // A calculation can replace only an expected numeric target. It cannot
    // suppress a shape/property/preservation check, which has no such target.
    if (
      !check.calculation ||
      !['measure', 'diameter', 'offset', 'positions'].includes(
        check.requirement.kind,
      )
    ) {
      checks.push(check);
      continue;
    }
    try {
      const result = await evaluate(check.calculation),
        r = check.requirement;
      let requirement;
      if (r.kind === 'positions' && result.points)
        requirement = { ...r, points: result.points };
      else if (
        ['measure', 'diameter', 'offset'].includes(r.kind) &&
        result.value
      ) {
        const power =
          r.kind === 'measure' && r.metric === 'count'
            ? 0
            : r.kind === 'measure' && r.metric === 'volume'
              ? 3
              : 1;
        if (result.value.angle !== 0 || result.value.length !== power)
          throw Error('Calculated measurement has incompatible units.');
        requirement = { ...r, value: result.value.values[0] };
      } else
        throw Error('Calculation output is not supported for this predicate.');
      const parsed = completionCriteriaSchema.shape.checks.element.parse({
        ...check,
        requirement,
      });
      checks.push(parsed);
      traces.set(r.id, result.trace);
    } catch (error) {
      if (signal?.aborted) throw error;
      checks.push({
        ...check,
        requirement: {
          kind: 'unavailable',
          id: check.requirement.id,
          label: check.requirement.label,
          reason:
            `Expected measurement could not be derived: ${error instanceof Error ? error.message : 'invalid calculation'}`.slice(
              0,
              400,
            ),
        },
      });
    }
  }
  return { criteria: { ...raw, checks }, traces };
}
