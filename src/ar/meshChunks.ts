import type { Volume } from '../model';
import type { RenderPart } from '../geometry/kernel';
import { isReference } from '../imports/mesh';

export const AR_INPUT_CHUNK_TRIANGLES = 100_000;
/** Read the canonical imported mesh in bounded pieces. This avoids allocating a
 * second full-size float/index mesh before the AR simplifier can even start.
 * Chunk boundaries are retained by the simplifier; no source buffer is detached. */
export function* importedARChunks(v: Volume): Generator<RenderPart> {
  if (v.geometry?.kind !== 'mesh') return;
  const { positions, indices } = v.geometry;
  if (indices.length % 3 || positions.length % 3)
    throw new Error('Invalid imported mesh for AR.');
  const stride = AR_INPUT_CHUNK_TRIANGLES * 3;
  const scale = [v.dimensions.width, v.dimensions.height, v.dimensions.depth];
  for (let start = 0; start < indices.length; start += stride) {
    const length = Math.min(stride, indices.length - start);
    const remap = new Map<number, number>();
    const p = new Float32Array(length * 3),
      index = new Uint32Array(length);
    let used = 0;
    for (let i = 0; i < length; i++) {
      const source = indices[start + i];
      if (
        !Number.isInteger(source) ||
        source < 0 ||
        source * 3 + 2 >= positions.length
      )
        throw new Error('Invalid imported mesh index for AR.');
      let target = remap.get(source);
      if (target === undefined) {
        target = used++;
        remap.set(source, target);
        for (let axis = 0; axis < 3; axis++) {
          const value = positions[source * 3 + axis] * scale[axis];
          if (!Number.isFinite(value))
            throw new Error('Invalid imported mesh coordinate for AR.');
          p[target * 3 + axis] = value;
        }
      }
      index[i] = target;
    }
    remap.clear();
    yield {
      positions: p.subarray(0, used * 3),
      indices: index,
      volume: 0,
      material: v.material ?? (isReference(v) ? 'reference' : 'solid'),
    };
  }
}
