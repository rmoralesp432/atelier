import Module, { type Manifold, type ManifoldToplevel } from 'manifold-3d';
import type { Dimensions, GeometryRecipe, Vec3, Volume } from '../model';
import { validateVolume } from '../model';
let wasmUrl: string | undefined;
let kernel: Promise<ManifoldToplevel> | undefined;
export const setKernelWasmUrl = (url: string) => {
  wasmUrl = url;
};
export function getKernel() {
  return (kernel ??= Module(
    wasmUrl ? { locateFile: () => wasmUrl! } : undefined,
  ).then((m) => {
    m.setup();
    return m;
  }));
}
export const isProfile = (v: Volume) =>
  v.geometry?.kind === 'rectangle' || v.geometry?.kind === 'circle';
export function validateRecipe(
  recipe: GeometryRecipe | undefined,
  depth = 0,
  budget = { nodes: 0 },
): void {
  if (!recipe) return;
  if (depth > 10 || ++budget.nodes > 100)
    throw new Error(
      'Operation history exceeds the supported geometry complexity.',
    );
  if (
    ![
      'box',
      'cylinder',
      'sphere',
      'rectangle',
      'circle',
      'extrusion',
      'boolean',
    ].includes(recipe.kind)
  )
    throw new Error('Unsupported geometry type.');
  if (
    recipe.kind === 'extrusion' &&
    !['rectangle', 'circle'].includes(recipe.profile)
  )
    throw new Error('Unsupported extrusion profile.');
  if (recipe.kind === 'boolean') {
    if (
      !['union', 'subtract', 'intersect'].includes(recipe.operation) ||
      !Array.isArray(recipe.operands) ||
      recipe.operands.length !== 2
    )
      throw new Error('Invalid boolean recipe.');
    validateVolume(
      {
        id: 'recipe',
        name: 'recipe',
        position: recipe.origin,
        dimensions: recipe.base,
        rotation: 0,
      },
      false,
    );
    recipe.operands.forEach((v) => {
      validateVolume(v, false);
      validateRecipe(v.geometry, depth + 1, budget);
    });
  }
}
function evaluated(
  m: ManifoldToplevel,
  v: Volume,
  world: boolean,
  allocated: Manifold[],
  depth = 0,
): Manifold {
  if (depth > 10) throw new Error('Geometry tree is too deep.');
  const keep = (s: Manifold) => {
    allocated.push(s);
    return s;
  };
  const d = v.dimensions;
  const g = v.geometry;
  let solid: Manifold;
  if (g?.kind === 'boolean') {
    const a = evaluated(m, g.operands[0], true, allocated, depth + 1),
      b = evaluated(m, g.operands[1], true, allocated, depth + 1);
    solid = keep(
      g.operation === 'union'
        ? a.add(b)
        : g.operation === 'subtract'
          ? a.subtract(b)
          : a.intersect(b),
    );
    solid = keep(solid.translate([-g.origin.x, -g.origin.y, -g.origin.z]));
    solid = keep(
      solid.scale([
        d.width / g.base.width,
        d.height / g.base.height,
        d.depth / g.base.depth,
      ]),
    );
  } else if (isProfile(v))
    throw new Error('Extrude the 2D shape before applying solid operations.');
  else if (g?.kind === 'sphere') {
    solid = keep(m.Manifold.sphere(1, 48));
    solid = keep(solid.scale([d.width / 2, d.height / 2, d.depth / 2]));
    solid = keep(solid.translate([0, d.height / 2, 0]));
  } else if (g?.kind === 'cylinder' || g?.kind === 'extrusion') {
    const profile = g.kind === 'extrusion' ? g.profile : 'circle';
    const originalSection =
      profile === 'circle'
        ? m.CrossSection.circle(1, 64)
        : m.CrossSection.square([d.width, d.depth], true);
    const section =
      profile === 'circle'
        ? originalSection.scale([d.width / 2, d.depth / 2])
        : originalSection;
    try {
      solid = keep(section.extrude(d.height));
    } finally {
      section.delete();
      if (section !== originalSection) originalSection.delete();
    }
    solid = keep(solid.rotate([-90, 0, 0]));
  } else {
    solid = keep(m.Manifold.cube([d.width, d.height, d.depth]));
    solid = keep(solid.translate([-d.width / 2, 0, -d.depth / 2]));
  }
  if (world) {
    solid = keep(solid.rotate([0, v.rotation, 0]));
    solid = keep(solid.translate([v.position.x, v.position.y, v.position.z]));
  }
  return solid;
}
export async function withSolid<T>(
  v: Volume,
  read: (solid: Manifold) => T,
  world = true,
): Promise<T> {
  validateVolume(v);
  const m = await getKernel();
  const allocated: Manifold[] = [];
  try {
    const s = evaluated(m, v, world, allocated);
    if (s.status() !== 'NoError')
      throw new Error(`Invalid solid: ${s.status()}`);
    return read(s);
  } finally {
    allocated.reverse().forEach((s) => s.delete());
  }
}
export async function meshData(v: Volume) {
  return withSolid(
    v,
    (s) => {
      const mesh = s.getMesh();
      const positions = new Float32Array(mesh.numVert * 3);
      for (let i = 0; i < mesh.numVert; i++)
        positions.set(
          mesh.vertProperties.subarray(i * mesh.numProp, i * mesh.numProp + 3),
          i * 3,
        );
      return {
        positions,
        indices: new Uint32Array(mesh.triVerts),
        volume: s.volume(),
      };
    },
    false,
  );
}
export async function solidStats(v: Volume) {
  return withSolid(v, (s) => ({
    volume: s.volume(),
    bounds: s.boundingBox(),
    triangles: s.numTri(),
    status: s.status(),
  }));
}
export async function booleanVolume(
  a: Volume,
  b: Volume,
  operation: 'union' | 'subtract' | 'intersect',
  opening = false,
): Promise<Volume> {
  if (a.id === b.id) throw new Error('Choose two different solids.');
  const m = await getKernel();
  const allocated: Manifold[] = [];
  try {
    const sa = evaluated(m, a, true, allocated),
      sb = evaluated(m, b, true, allocated);
    const result =
      operation === 'union'
        ? sa.add(sb)
        : operation === 'subtract'
          ? sa.subtract(sb)
          : sa.intersect(sb);
    allocated.push(result);
    if (
      result.status() !== 'NoError' ||
      result.isEmpty() ||
      result.volume() < 0.000001
    )
      throw new Error(
        'This operation produces no solid. The original objects were kept.',
      );
    if (
      operation === 'subtract' &&
      Math.abs(result.volume() - sa.volume()) < 0.000001
    )
      throw new Error(
        'The cutter does not intersect the target. The original objects were kept.',
      );
    const bounds = result.boundingBox();
    const origin: Vec3 = {
      x: (bounds.min[0] + bounds.max[0]) / 2,
      y: Math.max(0, bounds.min[1]),
      z: (bounds.min[2] + bounds.max[2]) / 2,
    };
    const base: Dimensions = {
      width: bounds.max[0] - bounds.min[0],
      height: bounds.max[1] - bounds.min[1],
      depth: bounds.max[2] - bounds.min[2],
    };
    const v: Volume = {
      ...a,
      name: opening
        ? `${a.name.slice(0, 60)} · opening`
        : `${operation} · ${a.name.slice(0, 60)}`,
      position: origin,
      rotation: 0,
      dimensions: base,
      geometry: {
        kind: 'boolean',
        operation,
        operands: structuredClone([a, b]),
        origin,
        base,
        opening,
      },
    };
    validateVolume(v);
    return v;
  } finally {
    allocated.reverse().forEach((s) => s.delete());
  }
}

// Cutter-local axes need their actual transformed lengths after nonuniform
// scaling of a rotated Boolean result; a world-X scale alone is insufficient.
export function openingScale(v: Volume): { width: number; height: number } {
  const g = v.geometry;
  if (g?.kind !== 'boolean' || !g.opening)
    throw new Error('No editable opening.');
  const angle = (g.operands[1].rotation * Math.PI) / 180;
  return {
    width: Math.hypot(
      (Math.cos(angle) * v.dimensions.width) / g.base.width,
      (Math.sin(angle) * v.dimensions.depth) / g.base.depth,
    ),
    height: v.dimensions.height / g.base.height,
  };
}
