import { validateMesh, type MeshRecipe } from '../imports/mesh';

// Large mesh arrays are shared across geometry history instead of serialized
// fifty times. Version 2 remains readable; small sessions keep its plain format.
export const MAX_IMPORT_SESSION_CHARS = 256_000_000;
export function encodeSession(session: object): string {
  const meshes: MeshRecipe[] = [];
  const identities = new WeakMap<object, number>();
  const contents = new Map<string, number>();
  let weight = 0;
  const body = JSON.stringify(session, (_key, value) => {
    if (value?.kind !== 'mesh' || !Array.isArray(value.positions)) return value;
    weight += value.positions.length + value.indices.length;
    let id = identities.get(value);
    if (id === undefined) {
      const key = JSON.stringify(value);
      id = contents.get(key);
      if (id === undefined) {
        id = meshes.length;
        meshes.push(value);
        contents.set(key, id);
      }
      identities.set(value, id);
    }
    return { $mesh: id };
  });
  if (weight < 150_000) return JSON.stringify({ version: 2, ...session });
  return `{"version":3,"meshes":${JSON.stringify(meshes)},${body.slice(1)}`;
}

export function decodeSession(raw: any): any {
  if (raw?.version !== 3) return raw;
  if (!Array.isArray(raw.meshes) || raw.meshes.length > 10000)
    throw new Error('Invalid mesh library in project history.');
  raw.meshes.forEach(validateMesh);
  const hydrate = (value: any, depth = 0): any => {
    if (depth > 64) throw new Error('Project history is nested too deeply.');
    if (!value || typeof value !== 'object') return value;
    if ('$mesh' in value) {
      if (
        Object.keys(value).length !== 1 ||
        !Number.isInteger(value.$mesh) ||
        value.$mesh < 0 ||
        value.$mesh >= raw.meshes.length
      )
        throw new Error('Invalid mesh reference in project history.');
      return raw.meshes[value.$mesh];
    }
    if (Array.isArray(value)) return value.map((v) => hydrate(v, depth + 1));
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, hydrate(v, depth + 1)]),
    );
  };
  return {
    version: 2,
    project: hydrate(raw.project),
    past: hydrate(raw.past),
    future: hydrate(raw.future),
    context: raw.context,
  };
}
