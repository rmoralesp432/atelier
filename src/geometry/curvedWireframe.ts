import type { Volume } from '../model';
/** Sparse descriptive curves, independent of the tessellation used by the solid kernel. */
export function curvedWireframe(v: Volume): number[] {
  const kind = v.geometry?.kind;
  if (
    kind !== 'sphere' &&
    kind !== 'tree' &&
    kind !== 'cylinder' &&
    !(kind === 'extrusion' && v.geometry?.profile === 'circle')
  )
    return [];
  const { width: w, depth: d, height: h } = v.dimensions;
  const points: number[] = [];
  const line = (a: number[], b: number[]) => points.push(...a, ...b);
  if (kind === 'sphere' || kind === 'tree') {
    const point = (a: number, b: number) => [
      (Math.cos(a) * Math.sin(b) * w) / 2,
      kind === 'tree'
        ? (0.66 + Math.cos(b) * 0.34) * h
        : ((Math.cos(b) + 1) * h) / 2,
      (Math.sin(a) * Math.sin(b) * d) / 2,
    ];
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 48; i++)
        line(
          point((j * Math.PI) / 4, (i * Math.PI) / 48),
          point((j * Math.PI) / 4, ((i + 1) * Math.PI) / 48),
        );
    for (let j = 1; j < 6; j++)
      for (let i = 0; i < 64; i++)
        line(
          point((i * Math.PI) / 32, (j * Math.PI) / 6),
          point(((i + 1) * Math.PI) / 32, (j * Math.PI) / 6),
        );
  } else {
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4;
      line(
        [(Math.cos(a) * w) / 2, 0, (Math.sin(a) * d) / 2],
        [(Math.cos(a) * w) / 2, h, (Math.sin(a) * d) / 2],
      );
    }
  }
  if (kind === 'tree')
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 2;
      line(
        [Math.cos(a) * w * 0.055, 0, Math.sin(a) * d * 0.055],
        [Math.cos(a) * w * 0.055, h * 0.34, Math.sin(a) * d * 0.055],
      );
    }
  return points;
}
