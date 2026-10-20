import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getKernel } from '../geometry/kernel';
import { validateVolume, type Volume } from '../model';

export const MAX_IMPORT_BYTES = 200_000_000;
export const MAX_IMPORT_TRIANGLES = 1_000_000;
export type MeshAsset = {
  name: string;
  format: string;
  positions: number[];
  indices: number[];
  /** FBX mesh nodes in their shared source coordinate system. */
  parts?: MeshAsset[];
  color?: string;
  metersPerUnit?: number;
  warnings?: string[];
};
export type ImportOptions = {
  units: 'source' | 'm' | 'cm' | 'mm' | 'ft';
  up: 'Y' | 'Z';
};
export type MeshRecipe = {
  kind: 'mesh';
  positions: number[];
  indices: number[];
  solid: boolean;
  source: string;
};
export const isReference = (v: Volume) =>
  v.geometry?.kind === 'mesh' && !v.geometry.solid;
export function validateMesh(g: MeshRecipe) {
  if (
    !Array.isArray(g.positions) ||
    !Array.isArray(g.indices) ||
    !g.indices.length ||
    g.indices.length % 3 ||
    g.positions.length % 3 ||
    g.positions.length < 9 ||
    g.indices.length > MAX_IMPORT_TRIANGLES * 3 ||
    g.positions.length > MAX_IMPORT_TRIANGLES * 9 ||
    typeof g.solid !== 'boolean' ||
    typeof g.source !== 'string' ||
    g.source.length > 100 ||
    g.positions.some((x) => !Number.isFinite(x) || Math.abs(x) > 1.00001) ||
    g.indices.some(
      (i) => !Number.isInteger(i) || i < 0 || i >= g.positions.length / 3,
    )
  )
    throw new Error('Invalid or oversized imported mesh.');
}
function geometryOnlyGlb(bytes: ArrayBuffer) {
  const view = new DataView(bytes);
  if (
    bytes.byteLength < 20 ||
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.byteLength
  )
    throw new Error('This is not a valid GLB 2 file.');
  let json: any, bin: Uint8Array | undefined;
  for (let offset = 12; offset < bytes.byteLength;) {
    if (offset + 8 > bytes.byteLength) throw new Error('Incomplete GLB chunk.');
    const length = view.getUint32(offset, true),
      type = view.getUint32(offset + 4, true);
    offset += 8;
    if (length % 4 || offset + length > bytes.byteLength)
      throw new Error('Invalid GLB chunk length.');
    if (type === 0x4e4f534a)
      json = JSON.parse(
        new TextDecoder().decode(bytes.slice(offset, offset + length)),
      );
    else if (type === 0x004e4942)
      bin = new Uint8Array(bytes.slice(offset, offset + length));
    offset += length;
  }
  if (!json || !bin || json.buffers?.length !== 1 || json.buffers[0].uri)
    throw new Error(
      'Use a self-contained GLB with embedded geometry. External files are not loaded.',
    );
  if (
    json.extensionsRequired?.some(
      (e: string) => !['KHR_mesh_quantization'].includes(e),
    ) ||
    json.meshes?.some((m: any) =>
      m.primitives?.some((p: any) => p.extensions?.KHR_draco_mesh_compression),
    ) ||
    json.bufferViews?.some((b: any) => b.extensions?.EXT_meshopt_compression) ||
    json.nodes?.some((n: any) => n.extensions?.EXT_mesh_gpu_instancing)
  )
    throw new Error(
      'Compressed or extension-dependent GLB geometry is not supported. Export an uncompressed GLB.',
    );
  if (
    json.skins?.length ||
    json.meshes?.some((m: any) => m.primitives?.some((p: any) => p.targets))
  )
    throw new Error('Export a static GLB without skinning or morph targets.');
  // Import geometry only. Embedded/external textures are not decoded or fetched.
  delete json.images;
  delete json.textures;
  delete json.materials;
  delete json.animations;
  for (const m of json.meshes ?? [])
    for (const p of m.primitives ?? []) {
      if (p.mode !== undefined && p.mode !== 4)
        throw new Error('GLB import requires triangle meshes.');
      delete p.material;
      delete p.extensions;
    }
  for (const n of json.nodes ?? []) delete n.extensions;
  delete json.extensions;
  delete json.extensionsUsed;
  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const padded = (encoded.length + 3) & ~3;
  const out = new ArrayBuffer(12 + 8 + padded + 8 + bin.byteLength),
    data = new DataView(out),
    raw = new Uint8Array(out);
  data.setUint32(0, 0x46546c67, true);
  data.setUint32(4, 2, true);
  data.setUint32(8, out.byteLength, true);
  data.setUint32(12, padded, true);
  data.setUint32(16, 0x4e4f534a, true);
  raw.fill(32, 20, 20 + padded);
  raw.set(encoded, 20);
  data.setUint32(20 + padded, bin.byteLength, true);
  data.setUint32(24 + padded, 0x004e4942, true);
  raw.set(bin, 28 + padded);
  return out;
}
export async function parseMeshAsset(
  name: string,
  bytes: ArrayBuffer,
): Promise<MeshAsset> {
  if (bytes.byteLength > MAX_IMPORT_BYTES)
    throw new Error('Import files must be 200 MB or smaller.');
  const format = name.split('.').at(-1)?.toLowerCase();
  let root: THREE.Object3D;
  if (format === 'obj')
    root = new OBJLoader().parse(new TextDecoder().decode(bytes));
  else if (format === 'stl')
    root = new THREE.Mesh(new STLLoader().parse(bytes));
  else if (format === 'glb') {
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(() => {
      throw new Error(
        'External asset requests are disabled. Use a self-contained GLB.',
      );
    });
    root = (
      await new GLTFLoader(manager).parseAsync(geometryOnlyGlb(bytes), '')
    ).scene;
  } else if (format === 'fbx') {
    const { readFbx } = await import('./fbx');
    root = readFbx(bytes);
  } else
    throw new Error('Choose an FBX, OBJ, STL, GLB or ATELIER JSON project.');
  const positions: number[] = [],
    indices: number[] = [],
    parts: MeshAsset[] = [],
    warnings = new Set<string>();
  const sourceUnit = root.userData.unitScaleFactor;
  const metersPerUnit = format === 'fbx' ? (sourceUnit ?? 1) / 100 : undefined;
  if (format === 'fbx' && sourceUnit === undefined)
    warnings.add(
      'No FBX unit metadata. Assuming centimeters; check the dimensions below.',
    );
  root.updateMatrixWorld(true);
  try {
    root.traverse((o) => {
      if (o instanceof THREE.Line || o instanceof THREE.Points)
        warnings.add('Curves and points are not imported; only mesh surfaces.');
      if (!(o instanceof THREE.Mesh)) return;
      if (
        o instanceof THREE.SkinnedMesh ||
        Object.keys(o.geometry.morphAttributes).length
      )
        throw new Error(
          'Export a static FBX without skinning or morph targets.',
        );
      if (o.animations.length || root.animations.length)
        warnings.add(
          'Animation is not imported. The exported static pose is used.',
        );
      const p = o.geometry.getAttribute('position'),
        index = o.geometry.getIndex();
      if (!p) return;
      const count = index?.count ?? p.count;
      if (count % 3 || indices.length + count > MAX_IMPORT_TRIANGLES * 3)
        throw new Error(
          'Use a model with at most 1,000,000 triangles. Simplify the Revit 3D view or export it in smaller sections.',
        );
      const indexStart = indices.length;
      const start = positions.length / 3,
        v = new THREE.Vector3();
      if (start + p.count > MAX_IMPORT_TRIANGLES * 3)
        throw new Error('The imported mesh has too many vertices.');
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        if (![v.x, v.y, v.z].every(Number.isFinite))
          throw new Error('The mesh contains invalid coordinates.');
        positions.push(v.x, v.y, v.z);
      }
      const reverse = o.matrixWorld.determinant() < 0;
      for (let i = 0; i < count; i += 3)
        indices.push(
          start + (index?.getX(i) ?? i),
          start + (index?.getX(i + (reverse ? 2 : 1)) ?? i + (reverse ? 2 : 1)),
          start + (index?.getX(i + (reverse ? 1 : 2)) ?? i + (reverse ? 1 : 2)),
        );
      if (format === 'fbx' && count) {
        if (parts.length >= 2000)
          throw new Error(
            'This FBX has more than 2,000 source elements. Export a smaller 3D view.',
          );
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        const material = materials[0] as THREE.MeshPhongMaterial;
        if (materials.length > 1 || o.geometry.hasAttribute('color'))
          warnings.add(
            'Each element uses its first material’s basic color. Per-face colors and textures are not imported.',
          );
        parts.push({
          name:
            String(
              o.userData.originalName ||
                o.name ||
                `Element ${parts.length + 1}`,
            )
              .trim()
              .slice(0, 70) || 'Imported element',
          format: 'fbx',
          positions: positions.slice(start * 3),
          indices: indices.slice(indexStart).map((i) => i - start),
          ...(material?.color
            ? { color: `#${material.color.getHexString()}` }
            : {}),
          metersPerUnit,
        });
      }
    });
  } finally {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          for (const value of Object.values(m))
            if (value instanceof THREE.Texture) value.dispose();
          m.dispose();
        });
      }
    });
  }
  if (!indices.length)
    throw new Error('No triangle surfaces were found in this file.');
  return {
    name: name.replace(/\.[^.]+$/, '').slice(0, 70) || 'Imported element',
    format: format!,
    positions,
    indices,
    ...(format === 'fbx'
      ? { parts, metersPerUnit, warnings: [...warnings] }
      : {}),
  };
}
function convertedBounds(asset: MeshAsset, options: ImportOptions) {
  const scale =
    options.units === 'source'
      ? (asset.metersPerUnit ?? 1)
      : { m: 1, cm: 0.01, mm: 0.001, ft: 0.3048 }[options.units];
  if (!Number.isFinite(scale) || scale <= 0)
    throw new Error('Invalid source units. Choose file units explicitly.');
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity],
    points: number[] = [];
  for (let i = 0; i < asset.positions.length; i += 3) {
    const [x, y, z] = asset.positions.slice(i, i + 3);
    const point = options.up === 'Z' ? [x, z, -y] : [x, y, z];
    point.forEach((n, axis) => {
      const value = n * scale;
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
      points.push(value);
    });
  }
  const size = max.map((n, i) => n - min[i]);
  if (
    size.some((n) => !Number.isFinite(n) || n > 500) ||
    Math.max(...size) < 0.001
  )
    throw new Error(
      'Check the source units: imported elements must fit within 500 meters and be at least 1 mm across.',
    );
  return { min, max, points, size };
}
export async function prepareMesh(
  asset: MeshAsset,
  options: ImportOptions,
  checkSolid = true,
): Promise<Volume> {
  const { min, max, points, size } = convertedBounds(asset, options);
  const d = size.map((n) => Math.max(n, 0.001));
  const normalized = points.map(
    (n, i) =>
      (n - (i % 3 === 1 ? min[1] : (min[i % 3] + max[i % 3]) / 2)) / d[i % 3],
  );
  // Weld coincident export seams without filling holes or inventing surfaces.
  const positions: number[] = [],
    indices: number[] = [],
    vertices = new Map<string, number>();
  for (const i of asset.indices) {
    if (!Number.isInteger(i) || i < 0 || i * 3 + 2 >= normalized.length)
      throw new Error('Invalid mesh triangle index.');
    const p = normalized
      .slice(i * 3, i * 3 + 3)
      .map((n) => Number(n.toFixed(8)));
    const key = p.map((n) => n.toFixed(8)).join(',');
    let vertex = vertices.get(key);
    if (vertex === undefined) {
      vertex = positions.length / 3;
      positions.push(...p);
      vertices.set(key, vertex);
    }
    indices.push(vertex);
  }
  let solid = false;
  if (checkSolid) {
    const m = await getKernel();
    try {
      const shape = new m.Manifold(
        new m.Mesh({
          numProp: 3,
          vertProperties: new Float32Array(positions),
          triVerts: new Uint32Array(indices),
        }),
      );
      try {
        solid =
          shape.status() === 'NoError' &&
          !shape.isEmpty() &&
          shape.volume() > 1e-8;
      } finally {
        shape.delete();
      }
    } catch {
      /* Open/non-manifold meshes stay visible references, never fake solids. */
    }
  }
  const volume: Volume = {
    id: crypto.randomUUID(),
    name: asset.name,
    ...(asset.color ? { color: asset.color } : {}),
    dimensions: { width: d[0], height: d[1], depth: d[2] },
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    geometry: { kind: 'mesh', positions, indices, solid, source: asset.format },
  };
  validateVolume(volume);
  return volume;
}

export type PreparedImport = {
  name: string;
  volumes: Volume[];
  dimensions: Volume['dimensions'];
};
/** Center the assembly once, preserving all element offsets and elevations. */
export async function prepareImport(
  asset: MeshAsset,
  options: ImportOptions,
  separate = true,
  checkSolids = true,
): Promise<PreparedImport> {
  const whole = convertedBounds(asset, options);
  const parts = separate && asset.parts?.length ? asset.parts : [asset];
  const volumes: Volume[] = [];
  for (const part of parts) {
    const v = await prepareMesh(part, options, checkSolids);
    const b = convertedBounds(part, options);
    v.position = {
      x: (b.min[0] + b.max[0] - whole.min[0] - whole.max[0]) / 2,
      y: Math.max(0, b.min[1] - whole.min[1]),
      z: (b.min[2] + b.max[2] - whole.min[2] - whole.max[2]) / 2,
    };
    validateVolume(v);
    volumes.push(v);
  }
  return {
    name: asset.name,
    volumes,
    dimensions: {
      width: whole.size[0],
      height: whole.size[1],
      depth: whole.size[2],
    },
  };
}
