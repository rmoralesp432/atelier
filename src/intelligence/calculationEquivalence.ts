import type { Calculation } from './calculationSchema';

/** Prove a correction preserves the original expression, not the candidate's
 * answer. Allows associative add/multiply regrouping, DAG reordering and finite scalar zero.
 * No arithmetic targets, source values, units, frames or citations may change.
 * Invalid units, cycles and unknown operations cannot be pardoned here. */
export function equivalentCalculation(a: Calculation, b: Calculation): boolean {
  function canonical(c: Calculation) {
    let work = 0;
    type Tree = { op: string; args: Tree[] } | { leaf: unknown };
    const visit = (index: number, path: Set<number>): Tree => {
      if (++work > 4096 || path.has(index) || !c.nodes[index])
        throw Error('Unprovable calculation');
      const n = c.nodes[index];
      if (n.kind !== 'operation') return { leaf: n };
      const ancestors = new Set([...path, index]);
      const args = n.args.map((i) => visit(i, ancestors));
      // A dimensional zero may be expressed as 0 * an existing finite scalar
      // quantity. This changes no desired number or source. Do not cancel
      // arrays, measurements or compound expressions: that could erase shape
      // information or hide undefined arithmetic such as 0 * (1 / 0).
      const zero = (t: Tree) =>
        'leaf' in t &&
        (t.leaf as any).kind === 'constant' &&
        (t.leaf as any).value === 0;
      const finiteScalarSource = (t: Tree) =>
        'leaf' in t &&
        ['constant', 'quantity'].includes((t.leaf as any).kind) &&
        Number.isFinite((t.leaf as any).value);
      if (
        n.op === 'multiply' &&
        args.length === 2 &&
        ((zero(args[0]) && finiteScalarSource(args[1])) ||
          (zero(args[1]) && finiteScalarSource(args[0])))
      )
        return { leaf: { kind: 'constant', value: 0 } };
      return {
        op: n.op,
        args: ['add', 'multiply'].includes(n.op)
          ? args.flatMap((v) => ('op' in v && v.op === n.op ? v.args : [v]))
          : args,
      };
    };
    return JSON.stringify({
      frame: c.frame,
      sources: c.nodes
        .filter((n) => n.kind !== 'operation')
        .map((n) => JSON.stringify(n))
        .sort(),
      output:
        c.output.kind === 'value'
          ? { value: visit(c.output.node, new Set()) }
          : {
              points: [c.output.x, c.output.y, c.output.z].map((i) =>
                visit(i, new Set()),
              ),
            },
    });
  }
  try {
    return canonical(a) === canonical(b);
  } catch {
    return false;
  }
}
