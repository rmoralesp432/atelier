import type { CompletionCriteria } from '../../../src/intelligence/completionSchema';
/** Scripted reviewer correction for an offline saved-response replay. Not AI. */
export function binaryCorrection(criteria: CompletionCriteria) {
  const corrected = structuredClone(criteria);
  for (const check of corrected.checks) {
    const old = check.calculation;
    if (!old) continue;
    const nodes: typeof old.nodes = [],
      map: number[] = [];
    old.nodes.forEach((node, i) => {
      if (node.kind !== 'operation') {
        nodes.push(node);
        map[i] = nodes.length - 1;
        return;
      }
      const args = node.args.map((j) => map[j]);
      if (['add', 'multiply'].includes(node.op) && args.length > 2) {
        let left = args[0];
        for (const right of args.slice(1)) {
          nodes.push({ kind: 'operation', op: node.op, args: [left, right] });
          left = nodes.length - 1;
        }
        map[i] = left;
      } else {
        nodes.push({ ...node, args });
        map[i] = nodes.length - 1;
      }
    });
    check.calculation = {
      ...old,
      nodes,
      output:
        old.output.kind === 'value'
          ? { kind: 'value', node: map[old.output.node] }
          : {
              kind: 'points',
              x: map[old.output.x],
              y: map[old.output.y],
              z: map[old.output.z],
            },
    };
  }
  return corrected;
}
