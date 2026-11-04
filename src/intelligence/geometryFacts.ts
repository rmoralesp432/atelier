import type { Volume } from '../model';
export function semanticShape(v: Volume): string {
  const g = v.geometry;
  return g?.kind === 'form'
    ? g.definition.method === 'profile'
      ? g.definition.shape === 'rectangle'
        ? 'box'
        : g.definition.shape
      : g.definition.method
    : (g?.kind ?? 'box');
}
