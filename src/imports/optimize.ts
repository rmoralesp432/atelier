import { BufferAttribute, BufferGeometry, Vector3, type Matrix4 } from 'three';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

function compactPositions(indices: Uint32Array, positions: Float32Array) {
  const [remap, unique] = MeshoptSimplifier.compactMesh(indices);
  const compact = new Float32Array(unique * 3);
  for (let i = 0; i < remap.length; i++)
    if (remap[i] !== 0xffffffff)
      compact.set(positions.subarray(i * 3, i * 3 + 3), remap[i] * 3);
  return compact;
}
/** Weld identical positions without deleting faces; optionally simplify a reviewed copy. */
export async function optimizeGeometry(
  source: BufferGeometry,
  targetTriangles: number,
  reduce: boolean,
  worldTransform?: Matrix4,
) {
  await MeshoptSimplifier.ready;
  const p = source.getAttribute('position');
  let positions: Float32Array = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    positions[i * 3] = p.getX(i);
    positions[i * 3 + 1] = p.getY(i);
    positions[i * 3 + 2] = p.getZ(i);
  }
  if (positions.some((v) => !Number.isFinite(v)))
    throw new Error('The mesh contains invalid coordinates.');
  const sourceIndex = source.getIndex();
  const welded = MeshoptSimplifier.generatePositionRemap(positions, 3);
  let indices: Uint32Array = new Uint32Array(sourceIndex?.count ?? p.count);
  for (let i = 0; i < indices.length; i++) {
    const index = sourceIndex ? sourceIndex.getX(i) : i;
    if (!Number.isInteger(index) || index < 0 || index >= p.count)
      throw new Error('Invalid mesh triangle index.');
    indices[i] = welded[index];
  }
  // Remove unused duplicate positions BEFORE simplification. Otherwise the
  // simplifier classifies the unused OBJ/STL seam vertices as locked seams.
  positions = compactPositions(indices, positions);
  let error = 0;
  if (reduce && indices.length > targetTriangles * 3) {
    const count = positions.length / 3;
    // Keep one original extremum on each axis so placement/bounds survive.
    const lock = new Uint8Array(count);
    for (let axis = 0; axis < 3; axis++) {
      let min = 0,
        max = 0;
      for (let i = 1; i < count; i++) {
        if (positions[i * 3 + axis] < positions[min * 3 + axis]) min = i;
        if (positions[i * 3 + axis] > positions[max * 3 + axis]) max = i;
      }
      lock[min] = lock[max] = 1;
    }
    // Rotated FBX nodes have different world-axis extrema. Keep those too,
    // so reducing an element does not change the assembly's preview envelope.
    if (worldTransform) {
      const min = [Infinity, Infinity, Infinity],
        max = [-Infinity, -Infinity, -Infinity];
      const minIndex = [0, 0, 0],
        maxIndex = [0, 0, 0],
        point = new Vector3();
      for (let i = 0; i < count; i++) {
        point.fromArray(positions, i * 3).applyMatrix4(worldTransform);
        for (let axis = 0; axis < 3; axis++) {
          const value = point.getComponent(axis);
          if (value < min[axis]) {
            min[axis] = value;
            minIndex[axis] = i;
          }
          if (value > max[axis]) {
            max[axis] = value;
            maxIndex[axis] = i;
          }
        }
      }
      for (const i of [...minIndex, ...maxIndex]) lock[i] = 1;
    }
    const result = MeshoptSimplifier.simplifyWithAttributes(
      indices,
      positions,
      3,
      new Float32Array(0),
      0,
      [],
      lock,
      Math.max(3, Math.floor(targetTriangles) * 3),
      0.001,
      ['LockBorder'],
    );
    // Never drop an entire element to meet a target; targets can be exceeded.
    if (result[0].length) {
      indices = result[0];
      error = result[1];
    }
    positions = compactPositions(indices, positions);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  return { geometry, error };
}
