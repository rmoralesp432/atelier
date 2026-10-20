import Module, { type Manifold, type ManifoldToplevel } from 'manifold-3d';
import type { Dimensions, GeometryRecipe, Vec3, Volume } from '../model';
import { validateVolume } from '../model';
import { isFlat } from './spatial';
import { validatePolygon } from './polygon';
import { validateMesh, isReference } from '../imports/mesh';
import { validateForm } from './forms';
import { buildingParts } from './architecture';
import { entourageSolid } from './entourage';
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
      'mesh',
      'person',
      'tree',
      'mirror',
      'form',
      'oriented',
      'hollow',
    ].includes(recipe.kind)
  )
    throw new Error('Unsupported geometry type.');
  if (
    recipe.kind === 'extrusion' &&
    !['rectangle', 'circle'].includes(recipe.profile)
  )
    throw new Error('Unsupported extrusion profile.');
  if (recipe.kind === 'mesh') validateMesh(recipe);
  if (recipe.kind === 'form') {
    validateMesh(recipe.mesh);
    validateForm(recipe.definition);
    if (!recipe.mesh.solid) throw new Error('A generated form must be solid.');
  }
  if (recipe.kind === 'oriented' || recipe.kind === 'hollow') {
    validateVolume(recipe.source, false);
    validateRecipe(recipe.source.geometry, depth + 1, budget);
    if (recipe.kind === 'oriented') {
      if (
        ![recipe.degrees, recipe.origin].every(
          (p) =>
            p &&
            ['x', 'y', 'z'].every(
              (k) =>
                Number.isFinite(p[k as keyof Vec3]) &&
                Math.abs(p[k as keyof Vec3]) <= 10000,
            ),
        ) ||
        !recipe.base ||
        !Object.values(recipe.base).every(
          (n) => Number.isFinite(n) && n >= 0.1 && n <= 500,
        )
      )
        throw new Error('Invalid spatial rotation.');
    } else if (
      !Number.isFinite(recipe.thickness) ||
      recipe.thickness < 0.05 ||
      recipe.thickness > 100 ||
      typeof recipe.openTop !== 'boolean'
    )
      throw new Error('Invalid shell thickness.');
  }

  if (recipe.kind === 'mirror') {
    if (!['x', 'z'].includes(recipe.axis))
      throw new Error('Invalid mirror plane.');
    validateVolume(recipe.source, false);
    validateRecipe(recipe.source.geometry, depth + 1, budget);
  }
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
      (recipe.fixedWindowWidth !== undefined &&
        (!Number.isFinite(recipe.fixedWindowWidth) ||
          recipe.fixedWindowWidth < 0.3 ||
          recipe.fixedWindowWidth > 10)) ||
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
  if (g?.kind === 'oriented') {
    solid = evaluated(m, g.source, false, allocated, depth + 1);
    solid = keep(solid.rotate([0, g.source.rotation, 0]));
    solid = keep(solid.translate([0, -g.source.dimensions.height / 2, 0]));
    solid = keep(solid.rotate([g.degrees.x, g.degrees.y, g.degrees.z]));
    solid = keep(solid.translate([-g.origin.x, -g.origin.y, -g.origin.z]));
    solid = keep(
      solid.scale([
        d.width / g.base.width,
        d.height / g.base.height,
        d.depth / g.base.depth,
      ]),
    );
  } else if (g?.kind === 'hollow') {
    const source = g.source,
      sd = source.dimensions,
      shape = source.geometry;
    if (
      shape &&
      !['box', 'cylinder', 'extrusion', 'polygon'].includes(shape.kind)
    )
      throw new Error(
        'Hollowing currently needs a vertical box, cylinder or extruded footprint.',
      );
    const originalCircle =
      shape?.kind === 'cylinder' ||
      (shape?.kind === 'extrusion' && shape.profile === 'circle')
        ? m.CrossSection.circle(1, 64)
        : null;
    const section =
      shape?.kind === 'polygon'
        ? new m.CrossSection([
            shape.points.map(
              (p) => [p.x * sd.width, -p.z * sd.depth] as [number, number],
            ),
          ])
        : shape?.kind === 'cylinder' ||
            (shape?.kind === 'extrusion' && shape.profile === 'circle')
          ? originalCircle!.scale([sd.width / 2, sd.depth / 2])
          : m.CrossSection.square([sd.width, sd.depth], true);
    const inset = section.offset(-g.thickness, 'Round', 2, 64);
    try {
      const height = sd.height - g.thickness * (g.openTop ? 1 : 2);
      if (inset.isEmpty() || height < 0.05)
        throw new Error('That wall thickness leaves no interior space.');
      let cutter = keep(inset.extrude(height + (g.openTop ? 0.01 : 0)));
      cutter = keep(cutter.rotate([-90, 0, 0]));
      cutter = keep(cutter.translate([0, g.thickness, 0]));
      solid = keep(
        evaluated(m, source, false, allocated, depth + 1).subtract(cutter),
      );
      solid = keep(
        solid.scale([
          d.width / sd.width,
          d.height / sd.height,
          d.depth / sd.depth,
        ]),
      );
    } finally {
      inset.delete();
      section.delete();
      originalCircle?.delete();
    }
  } else if (g?.kind === 'form') {
    solid = keep(
      new m.Manifold(
        new m.Mesh({
          numProp: 3,
          vertProperties: new Float32Array(g.mesh.positions),
          triVerts: new Uint32Array(g.mesh.indices),
        }),
      ),
    );
    solid = keep(solid.scale([d.width, d.height, d.depth]));
  } else if (g?.kind === 'mirror') {
    const source = evaluated(m, g.source, false, allocated, depth + 1);
    solid = keep(source.mirror(g.axis === 'x' ? [1, 0, 0] : [0, 0, 1]));
    solid = keep(
      solid.scale([
        d.width / g.source.dimensions.width,
        d.height / g.source.dimensions.height,
        d.depth / g.source.dimensions.depth,
      ]),
    );
  } else if (g?.kind === 'tree' || g?.kind === 'person') {
    solid = keep(
      entourageSolid(m, g.kind, keep).scale([d.width, d.height, d.depth]),
    );
  } else if (g?.kind === 'mesh') {
    if (!g.solid)
      throw new Error(
        'This imported surface is a reference mesh, not a closed solid. It can be moved, rotated or resized; solid cuts require a watertight mesh.',
      );
    solid = keep(
      new m.Manifold(
        new m.Mesh({
          numProp: 3,
          vertProperties: new Float32Array(g.positions),
          triVerts: new Uint32Array(g.indices),
        }),
      ),
    );
    solid = keep(solid.scale([d.width, d.height, d.depth]));
  } else if (g?.kind === 'building') {
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
export type RenderPart = {
  positions: Float32Array;
  indices: Uint32Array;
  volume: number;
  material: 'solid' | 'glass' | 'frame' | 'reference' | 'foliage';
};
function inheritedMaterial(v: Volume): RenderPart['material'] {
  if (v.geometry?.kind === 'tree') return 'foliage';
  if (v.geometry?.kind === 'oriented' || v.geometry?.kind === 'mirror')
    return inheritedMaterial(v.geometry.source);
  return v.material ?? 'solid';
}
export async function renderMeshData(v: Volume): Promise<RenderPart[]> {
  validateVolume(v);
  if (v.geometry?.kind === 'building' && v.display?.mode === 'volume')
    return renderMeshData({
      ...v.geometry.source,
      dimensions: v.dimensions,
      display: undefined,
    });
  if (v.geometry?.kind === 'mirror') {
    const g = v.geometry,
      parts = await renderMeshData(g.source);
    const scale = [
      v.dimensions.width / g.source.dimensions.width,
      v.dimensions.height / g.source.dimensions.height,
      v.dimensions.depth / g.source.dimensions.depth,
    ];
    const axis = g.axis === 'x' ? 0 : 2;
    return parts.map((part) => {
      const positions = new Float32Array(
        part.positions.map(
          (n, i) => n * scale[i % 3] * (i % 3 === axis ? -1 : 1),
        ),
      );
      const indices = new Uint32Array(part.indices);
      for (let i = 0; i < indices.length; i += 3)
        [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
      return {
        ...part,
        positions,
        indices,
        volume: part.volume * scale[0] * scale[1] * scale[2],
      };
    });
  }

  if (v.geometry?.kind === 'mesh') {
    const scale = [v.dimensions.width, v.dimensions.height, v.dimensions.depth];
    const positions = new Float32Array(v.geometry.positions.length);
    for (let i = 0; i < positions.length; i++)
      positions[i] = v.geometry.positions[i] * scale[i % 3];
    return [
      {
        positions,
        indices: new Uint32Array(v.geometry.indices),
        volume: 0,
        material:
          v.material ??
          (isReference(v) ? ('reference' as const) : ('solid' as const)),
      },
    ];
  }
  if (v.geometry?.kind !== 'building')
    return [
      {
        ...(await meshData(v)),
        material: inheritedMaterial(v),
      },
    ];
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
      .filter(
        (p) =>
          !p.solid.isEmpty() &&
          (p.material === 'solid'
            ? v.display?.floors !== false
            : v.display?.glass !== false),
      )
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

export async function orientVolume(v: Volume, degrees: Vec3): Promise<Volume> {
  return withSolid(
    v,
    (s) => {
      const allocated: Manifold[] = [];
      const keep = (a: Manifold) => {
        allocated.push(a);
        return a;
      };
      try {
        let result = keep(s.rotate([0, v.rotation, 0]));
        result = keep(result.translate([0, -v.dimensions.height / 2, 0]));
        result = keep(result.rotate([degrees.x, degrees.y, degrees.z]));
        const b = result.boundingBox();
        const origin = {
          x: (b.min[0] + b.max[0]) / 2,
          y: b.min[1],
          z: (b.min[2] + b.max[2]) / 2,
        };
        const base = {
          width: b.max[0] - b.min[0],
          height: b.max[1] - b.min[1],
          depth: b.max[2] - b.min[2],
        };
        const next: Volume = {
          ...v,
          rotation: 0,
          position: {
            x: v.position.x + origin.x,
            y: v.position.y + v.dimensions.height / 2 + origin.y,
            z: v.position.z + origin.z,
          },
          dimensions: base,
          geometry: {
            kind: 'oriented',
            source: structuredClone(v),
            degrees,
            origin,
            base,
          },
        };
        if (next.position.y < -1e-6)
          throw new Error(
            'This rotation would put geometry below ground. Lift it first or choose a smaller angle.',
          );
        next.position.y = Math.max(0, next.position.y);
        validateVolume(next);
        return next;
      } finally {
        allocated.reverse().forEach((s) => s.delete());
      }
    },
    false,
  );
}

/** Bake real building parts into editable solids in world placement. Undo retains
 * the full procedural envelope. No hidden duplicate geometry is left behind. */
export async function editableBuildingComponents(v: Volume): Promise<Volume[]> {
  if (v.geometry?.kind !== 'building')
    throw new Error('Select a building with floors or glazing.');
  validateVolume(v);
  const recipe = v.geometry,
    m = await getKernel(),
    allocated: Manifold[] = [];
  const keep = (s: Manifold) => {
    allocated.push(s);
    return s;
  };
  try {
    const source = evaluated(m, recipe.source, false, allocated, 1);
    const parts = buildingParts(m, source, recipe, keep, true);
    const counts = { solid: 0, frame: 0, glass: 0 };
    return parts
      .filter((p) => !p.solid.isEmpty())
      .map((part, index) => {
        const solid = keep(
          part.solid.scale([
            v.dimensions.width / recipe.base.width,
            v.dimensions.height / recipe.base.height,
            v.dimensions.depth / recipe.base.depth,
          ]),
        );
        if (solid.status() !== 'NoError')
          throw new Error('Invalid architectural component.');
        const b = solid.boundingBox(),
          mesh = solid.getMesh();
        const width = Math.max(0.001, b.max[0] - b.min[0]),
          height = Math.max(0.001, b.max[1] - b.min[1]),
          depth = Math.max(0.001, b.max[2] - b.min[2]);
        const x = (b.min[0] + b.max[0]) / 2,
          z = (b.min[2] + b.max[2]) / 2;
        const a = (v.rotation * Math.PI) / 180;
        const positions: number[] = [];
        for (let i = 0; i < mesh.numVert; i++)
          positions.push(
            (mesh.vertProperties[i * mesh.numProp] - x) / width,
            (mesh.vertProperties[i * mesh.numProp + 1] - b.min[1]) / height,
            (mesh.vertProperties[i * mesh.numProp + 2] - z) / depth,
          );
        const box =
          Math.min(width, height, depth) >= 0.1 &&
          mesh.triVerts.length === 36 &&
          positions.every((n, i) =>
            i % 3 === 1
              ? Math.min(Math.abs(n), Math.abs(n - 1)) < 1e-7
              : Math.abs(Math.abs(n) - 0.5) < 1e-7,
          );
        const label =
          part.material === 'solid'
            ? 'Slab'
            : part.material === 'glass'
              ? 'Window'
              : 'Frame';
        const component: Volume = {
          id: index === 0 ? v.id : crypto.randomUUID(),
          name: `${v.name.slice(0, 55)} · ${label} ${++counts[part.material]}`,
          groupId: v.groupId,
          material: part.material,
          color: part.material === 'glass' ? '#b8d7d6' : (v.color ?? '#e2e7e6'),
          dimensions: { width, height, depth },
          position: {
            x: v.position.x + x * Math.cos(a) + z * Math.sin(a),
            y: Math.max(0, v.position.y + b.min[1]),
            z: v.position.z - x * Math.sin(a) + z * Math.cos(a),
          },
          rotation: v.rotation,
          geometry: box
            ? { kind: 'box' }
            : {
                kind: 'mesh',
                positions,
                indices: Array.from(mesh.triVerts),
                solid: true,
                source: 'Editable architectural component',
              },
        };
        validateVolume(component);
        return component;
      });
  } finally {
    allocated.reverse().forEach((s) => s.delete());
  }
}
