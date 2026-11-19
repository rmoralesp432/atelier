/** Compare immutable JSON model data without visiting shared geometry arrays. */
export function equalData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, i) => equalData(value, b[i]))
    );
  const x = a as Record<string, unknown>,
    y = b as Record<string, unknown>;
  const keys = Object.keys(x).filter((k) => x[k] !== undefined);
  return (
    keys.length === Object.keys(y).filter((k) => y[k] !== undefined).length &&
    keys.every((k) => equalData(x[k], y[k]))
  );
}
