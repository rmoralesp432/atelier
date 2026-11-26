import { BufferAttribute, BufferGeometry } from 'three';
import { optimizeGeometry } from '../imports/optimize';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

export const AR_TRIANGLE_LIMIT = 100_000;
export type ARMeshData = { positions: Float32Array; indices: Uint32Array };
export type ARPartJob = ARMeshData & { target: number; cutY?: number };

/** AR is a disposable viewing copy, not the canonical editing mesh. Relax seam
 * protection only here: independently exported triangles otherwise cannot be
 * reduced at all. Spatial clustering retains an actual surface approximation,
 * never random face sampling. Small details can disappear in this copy. */
export async function fitARBudget(
  data: ARMeshData,
  target: number,
): Promise<ARMeshData> {
  if (data.indices.length / 3 <= target) return data;
  await MeshoptSimplifier.ready;
  let indices = data.indices;
  const locks = new Uint8Array(data.positions.length / 3);
  for (let axis = 0; axis < 3; axis++) {
    let min = 0,
      max = 0;
    for (let i = 1; i < locks.length; i++) {
      if (data.positions[i * 3 + axis] < data.positions[min * 3 + axis])
        min = i;
      if (data.positions[i * 3 + axis] > data.positions[max * 3 + axis])
        max = i;
    }
    locks[min] = locks[max] = 1;
  }

  for (const error of [0.005, 0.02, 0.1, 1]) {
    const result = MeshoptSimplifier.simplifySloppy(
      data.indices,
      data.positions,
      3,
      locks,
      Math.max(3, Math.floor(target) * 3),
      error,
    );
    if (result[0].length && result[0].length < indices.length)
      indices = result[0];
    if (indices.length / 3 <= target) break;
  }
  if (indices.length / 3 > target)
    throw new Error(
      'This surface could not be reduced safely for AR. Your full import remains available; try an AR floor cut or selected objects.',
    );
  const [remap, count] = MeshoptSimplifier.compactMesh(indices);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < remap.length; i++)
    if (remap[i] !== 0xffffffff)
      positions.set(data.positions.subarray(i * 3, i * 3 + 3), remap[i] * 3);
  return { positions, indices };
}

/** Cut actual triangles, not a material clipping effect. Only an AR copy is changed.
 * The input has already been bounded by the simplifier, keeping allocations small.
 * Cut surfaces stay open; this is a viewing section, not a watertight BIM export. */
export function clipAbove(data: ARMeshData, y: number): ARMeshData {
  const { positions: p, indices: index } = data;
  const output = new Float32Array(index.length * 6); // at most two triangles per input
  let size = 0;
  type Point = [number, number, number];
  for (let i = 0; i < index.length; i += 3) {
    const points: Point[] = [0, 1, 2].map((j) => {
      const k = index[i + j] * 3;
      return [p[k], p[k + 1], p[k + 2]];
    });
    const polygon: Point[] = [];
    for (let j = 0; j < 3; j++) {
      const a = points[j],
        b = points[(j + 1) % 3];
      const insideA = a[1] >= y,
        insideB = b[1] >= y;
      if (insideA) polygon.push(a);
      if (insideA !== insideB) {
        const t = (y - a[1]) / (b[1] - a[1]);
        polygon.push([a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t]);
      }
    }
    for (let j = 1; j + 1 < polygon.length; j++) {
      const [a, b, c] = [polygon[0], polygon[j], polygon[j + 1]];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
        v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      if (
        Math.hypot(
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ) < 1e-12
      )
        continue;
      for (const point of [a, b, c]) {
        output.set(point, size);
        size += 3;
      }
    }
  }
  const indices = new Uint32Array(size / 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i;
  return { positions: output.slice(0, size), indices };
}

export async function prepareARPart(job: ARPartJob): Promise<ARMeshData> {
  let source = new BufferGeometry();
  source.setAttribute('position', new BufferAttribute(job.positions, 3));
  source.setIndex(new BufferAttribute(job.indices, 1));
  // Border/extremum protection deliberately may exceed the target. Never drop
  // whole components or random triangles just to meet a memory limit.
  const target = Math.max(
    12,
    Math.floor(job.target / (job.cutY === undefined ? 1 : 2)),
  );
  try {
    if (job.indices.length / 3 > target) {
      const reduced = await optimizeGeometry(source, target, true);
      source.dispose();
      source = reduced.geometry;
    }
    let data: ARMeshData = {
      positions: source.getAttribute('position').array as Float32Array,
      indices: source.index!.array as Uint32Array,
    };
    if (job.cutY !== undefined) {
      data = clipAbove(data, job.cutY);
      // Compact the new cut vertices without changing their actual faces.
      if (data.indices.length) {
        const cut = new BufferGeometry();
        cut.setAttribute('position', new BufferAttribute(data.positions, 3));
        cut.setIndex(new BufferAttribute(data.indices, 1));
        try {
          const { geometry } = await optimizeGeometry(cut, job.target, false);
          data = {
            positions: geometry.getAttribute('position').array as Float32Array,
            indices: geometry.index!.array as Uint32Array,
          };
          geometry.dispose();
        } finally {
          cut.dispose();
        }
      }
    }
    return await fitARBudget(data, job.target);
  } finally {
    source.dispose();
  }
}
