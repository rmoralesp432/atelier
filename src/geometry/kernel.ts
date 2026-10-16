import Module, { type Manifold, type ManifoldToplevel } from 'manifold-3d';
import type { Dimensions, GeometryRecipe, Vec3, Volume } from '../model';
import { validateVolume } from '../model';
import { isFlat } from './spatial';
import { validatePolygon } from './polygon';
import { buildingParts } from './architecture';
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
export const isProfile = isFlat;
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
      'building',
      'polygon',
    ].includes(recipe.kind)
  )
    throw new Error('Unsupported geometry type.');
  if (
    recipe.kind === 'extrusion' &&
    !['rectangle', 'circle'].includes(recipe.profile)
  )
    throw new Error('Unsupported extrusion profile.');
  if (recipe.kind === 'polygon') {
    validatePolygon(recipe.points);
    if (
      typeof recipe.extruded !== 'boolean' ||
      recipe.points.some(
        (p) => Math.abs(p.x) > 0.500001 || Math.abs(p.z) > 0.500001,
      ) ||
      (['x', 'z'] as const).some(
        (axis) =>
          Math.abs(Math.min(...recipe.points.map((p) => p[axis])) + 0.5) >
            1e-6 ||
          Math.abs(Math.max(...recipe.points.map((p) => p[axis])) - 0.5) > 1e-6,
      )
    )
      throw new Error('Invalid normalized footprint.');
  }
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
  if (recipe.kind === 'building') {
    if (
      !Number.isInteger(recipe.floors) ||
      recipe.floors < 1 ||
      recipe.floors > 30 ||
      !Number.isFinite(recipe.slabThickness) ||
      recipe.slabThickness < 0.1 ||
      recipe.slabThickness > 1 ||
      !Number.isFinite(recipe.panelWidth) ||
      recipe.panelWidth < 0.5 ||
      recipe.panelWidth > 10 ||
      !Number.isFinite(recipe.mullionWidth) ||
      recipe.mullionWidth < 0.03 ||
      recipe.mullionWidth > 0.3 ||
      typeof recipe.facade !== 'boolean'
    )
      throw new Error('Invalid floor or curtain-wall parameters.');
    validateVolume(
      {
        id: 'base',
        name: 'base',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        dimensions: recipe.base,
      },
      false,
    );
    validateVolume(recipe.source, false);
    if (recipe.base.height / recipe.floors < recipe.slabThickness + 0.3)
      throw new Error('There is not enough height between these floor slabs.');
    validateRecipe(recipe.source.geometry, depth + 1, budget);
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
  if (g?.kind === 'building') {
    const source = evaluated(m, g.source, false, allocated, depth + 1);
    const parts = buildingParts(m, source, g, keep);
    solid = keep(m.Manifold.union(parts.map((p) => p.solid)));
    solid = keep(
      solid.scale([
        d.width / g.base.width,
        d.height / g.base.height,
        d.depth / g.base.depth,
      ]),
    );
  } else if (g?.kind === 'boolean') {
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
  else if (g?.kind === 'polygon') {
    // CrossSection XY becomes world XZ after -90° X rotation; invert Z
    // before extrusion so asymmetric footprints keep their intended side.
    const section = new m.CrossSection(
      [
        g.points.map(
          (p) => [p.x * d.width, -p.z * d.depth] as [number, number],
        ),
      ],
      'EvenOdd',
    );
    try {
      solid = keep(section.extrude(d.height));
    } finally {
      section.delete();
    }
    solid = keep(solid.rotate([-90, 0, 0]));
  } else if (g?.kind === 'sphere') {
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
    return await read(s);
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
export async function renderMeshData(v: Volume) {
  if (v.geometry?.kind !== 'building')
    return [{ ...(await meshData(v)), material: 'solid' as const }];
  validateVolume(v);
  const m = await getKernel(),
    allocated: Manifold[] = [];
  const keep = (s: Manifold) => {
    allocated.push(s);
    return s;
  };
  const recipe = v.geometry;
  try {
    const source = evaluated(m, recipe.source, false, allocated, 1);
    return buildingParts(m, source, recipe, keep)
      .filter((p) => !p.solid.isEmpty())
      .map((part) => {
        const s = keep(
          part.solid.scale([
            v.dimensions.width / recipe.base.width,
            v.dimensions.height / recipe.base.height,
            v.dimensions.depth / recipe.base.depth,
          ]),
        );
        if (s.status() !== 'NoError')
          throw new Error('Invalid architectural component.');
        const mesh = s.getMesh();
        const positions = new Float32Array(mesh.numVert * 3);
        for (let i = 0; i < mesh.numVert; i++)
          positions.set(
            mesh.vertProperties.subarray(
              i * mesh.numProp,
              i * mesh.numProp + 3,
            ),
            i * 3,
          );
        return {
          material: part.material,
          positions,
          indices: new Uint32Array(mesh.triVerts),
          volume: s.volume(),
        };
      });
  } finally {
    allocated.reverse().forEach((s) => s.delete());
  }
}
export async function solidStats(v: Volume) {
  return withSolid(v, (s) => ({
    volume: s.volume(),
    surfaceArea: s.surfaceArea(),
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

export async function sharedVolume(a: Volume, b: Volume) {
  return withSolid(a, async (sa) =>
    withSolid(b, (sb) => {
      const intersection = sa.intersect(sb);
      try {
        if (intersection.status() !== 'NoError')
          throw new Error('The solids could not be compared.');
        return intersection.volume();
      } finally {
        intersection.delete();
      }
    }),
  );
}
