import type { Calculation } from './calculationSchema';

/** Prove a correction preserves the original expression, not the candidate's
 * answer. Allows associative add/multiply regrouping and DAG reordering only.
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
