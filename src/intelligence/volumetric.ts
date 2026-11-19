import {
  makeVolume,
  validateVolume,
  type Volume,
  type Vec3,
  type Dimensions,
} from '../model';
import { formMesh } from '../geometry/forms';
import { sectionOutline } from '../geometry/parametric';
import {
  getKernel,
  booleanVolume,
  sharedVolume,
  withSolid,
} from '../geometry/kernel';
import type { ProfileSolid, VolumetricOperation } from './volumetricSchema';

export async function profileVolume(
  previous: Volume | null,
  op: ProfileSolid,
): Promise<Volume> {
  const dims = op.dimensions ?? previous?.dimensions;
  if (!dims) throw new Error('A new profile solid needs dimensions.');
  const [width, height, length] =
    op.axis === 'y'
      ? [dims.width, dims.depth, dims.height]
      : op.axis === 'z'
        ? [dims.width, dims.height, dims.depth]
        : [dims.depth, dims.height, dims.width];
  const definition = {
    method: 'profile' as const,
    axis: op.axis,
    length,
    shape: op.shape,
    web: op.web,
    flange: op.flange,
    profile: sectionOutline(
      op.shape,
      width,
      height,
      op.web,
      op.flange,
      op.points,
    ),
  };
  const result = formMesh(await getKernel(), definition);
  const volume: Volume = {
    ...(previous ?? makeVolume()),
    name: previous?.name ?? op.name,
    position: previous?.position ?? op.position,
    dimensions: { ...dims },
    component: previous?.component ?? {
      role: 'element',
      hostId: null,
      level: null,
      motion: 'none',
      travel: 1,
    },
    geometry: { kind: 'form', definition, mesh: result.mesh },
  };
  validateVolume(volume);
  return volume;
}

/** Build independent panes and real annular frames in the retained cutter's
 * coordinates, then apply the wall's current affine transform. This also handles
 * openings cut before a wall was rotated or nonuniformly scaled. */
export async function glazeOpening(
  wall: Volume,
  existing: Volume[],
  settings: { frameWidth: number; frameDepth: number; paneThickness: number },
): Promise<Volume[]> {
  const g = wall.geometry;
  if (g?.kind !== 'boolean' || !g.opening)
    throw new Error('Choose a wall with an editable opening.');
  const cutter = g.operands[1],
    cg = cutter.geometry;
  const shape =
    cg?.kind === 'form' && cg.definition.method === 'profile'
      ? cg.definition.shape
      : 'rectangle';
  if (!['rectangle', 'ellipse'].includes(shape))
    throw new Error(
      'Glazing currently fits rectangular or elliptical wall openings.',
    );
  const sx = wall.dimensions.width / g.base.width,
    sy = wall.dimensions.height / g.base.height,
    sz = wall.dimensions.depth / g.base.depth;
  const angle = (cutter.rotation * Math.PI) / 180;
  const widthScale = Math.hypot(Math.cos(angle) * sx, Math.sin(angle) * sz);
  const depthScale = Math.hypot(Math.sin(angle) * sx, Math.cos(angle) * sz);
  const innerWidth =
    cutter.dimensions.width - (2 * settings.frameWidth) / widthScale;
  const innerHeight = cutter.dimensions.height - (2 * settings.frameWidth) / sy;
  if (innerWidth < 0.005 || innerHeight < 0.005)
    throw new Error('The frame leaves no clear glazing area.');
  if (settings.paneThickness > settings.frameDepth)
    throw new Error('Pane thickness must fit within frame depth.');
  const profile = async (width: number, height: number, depth: number) => {
    const p = await profileVolume(null, {
      type: 'profile_solid',
      targets: [],
      name: 'Opening member',
      position: {
        ...cutter.position,
        y: cutter.position.y + (cutter.dimensions.height - height) / 2,
      },
      dimensions: { width, height, depth },
      axis: 'z',
      shape: shape as 'rectangle' | 'ellipse',
      web: null,
      flange: null,
      points: null,
    });
    return { ...p, rotation: cutter.rotation };
  };
  const outer = await profile(
    cutter.dimensions.width,
    cutter.dimensions.height,
    settings.frameDepth / depthScale,
  );
  const inner = await profile(
    innerWidth,
    innerHeight,
    settings.frameDepth / depthScale + 0.1,
  );
  const frame = await booleanVolume(outer, inner, 'subtract');
  const pane = await profile(
    innerWidth,
    innerHeight,
    settings.paneThickness / depthScale,
  );
  const result: Volume[] = [];
  for (const [part, source] of [
    ['frame', frame],
    ['pane', pane],
  ] as const) {
    const previous = existing.find(
      (v) =>
        v.component?.hostId === wall.id &&
        v.geometry?.kind === 'mesh' &&
        v.geometry.openingSystem?.cutterId === cutter.id &&
        v.geometry.openingSystem.part === part,
    );
    const volume = await withSolid(source, (solid) => {
      const mesh = solid.getMesh(),
        positions: number[] = [];
      const a = (wall.rotation * Math.PI) / 180;
      for (let i = 0; i < mesh.numVert; i++) {
        const x = (mesh.vertProperties[i * mesh.numProp] - g.origin.x) * sx;
        const y = (mesh.vertProperties[i * mesh.numProp + 1] - g.origin.y) * sy;
        const z = (mesh.vertProperties[i * mesh.numProp + 2] - g.origin.z) * sz;
        positions.push(
          wall.position.x + x * Math.cos(a) + z * Math.sin(a),
          wall.position.y + y,
          wall.position.z - x * Math.sin(a) + z * Math.cos(a),
        );
      }
      const min = [Infinity, Infinity, Infinity],
        max = [-Infinity, -Infinity, -Infinity];
      positions.forEach((n, i) => {
        min[i % 3] = Math.min(min[i % 3], n);
        max[i % 3] = Math.max(max[i % 3], n);
      });
      const spans = max.map((n, i) => n - min[i]),
        origin = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
      const v: Volume = {
        ...(previous ?? makeVolume()),
        name:
          previous?.name ??
          `${wall.name.slice(0, 55)} · ${part === 'pane' ? 'glazing' : 'frame'}`,
        dimensions: { width: spans[0], height: spans[1], depth: spans[2] },
        position: { x: origin[0], y: origin[1], z: origin[2] },
        rotation: 0,
        groupId: wall.groupId,
        component: {
          role: part === 'pane' ? 'window' : 'frame',
          hostId: wall.id,
          level: wall.component?.level ?? null,
          motion: 'none',
          travel: 1,
        },
        material: part === 'pane' ? 'glass' : 'frame',
        geometry: {
          kind: 'mesh',
          solid: true,
          source: 'opening-system',
          positions: positions.map(
            (n, i) => (n - origin[i % 3]) / spans[i % 3],
          ),
          indices: Array.from(mesh.triVerts),
          openingSystem: { ...settings, cutterId: cutter.id, part },
        },
      };
      validateVolume(v);
      return v;
    });
    if ((await sharedVolume(volume, wall)) > 1e-5)
      throw new Error(
        'The glazing system intersects the wall. Original geometry retained.',
      );
    result.push(volume);
  }
  return result;
}

export function anchoredDimensions(
  v: Volume,
  dimensions: Dimensions,
  anchor: Vec3,
  rotation = v.rotation,
): Volume {
  const a = (v.rotation * Math.PI) / 180;
  const b = (rotation * Math.PI) / 180;
  const x = v.dimensions.width * anchor.x,
    z = v.dimensions.depth * anchor.z;
  const nx = dimensions.width * anchor.x,
    nz = dimensions.depth * anchor.z;
  const next = {
    ...v,
    dimensions,
    rotation,
    position: {
      x:
        v.position.x +
        x * Math.cos(a) +
        z * Math.sin(a) -
        nx * Math.cos(b) -
        nz * Math.sin(b),
      y: v.position.y + (v.dimensions.height - dimensions.height) * anchor.y,
      z:
        v.position.z -
        x * Math.sin(a) +
        z * Math.cos(a) +
        nx * Math.sin(b) -
        nz * Math.cos(b),
    },
  };
  validateVolume(next);
  return next;
}

export function constrainedResize(
  v: Volume,
  op: Extract<VolumetricOperation, { type: 'constrained_resize' }>,
) {
  const dimensions = { ...v.dimensions, [op.axis]: op.value };
  if (op.preserveVolume) {
    const compensation = Math.sqrt(v.dimensions[op.axis] / op.value);
    for (const axis of ['width', 'height', 'depth'] as const)
      if (axis !== op.axis) dimensions[axis] *= compensation;
  }
  return anchoredDimensions(v, dimensions, op.anchor);
}

export async function splitLevels(
  v: Volume,
  op: Extract<VolumetricOperation, { type: 'split_levels' }>,
): Promise<Volume[]> {
  if (
    Math.abs(
      op.levels.reduce((n, l) => n + l.height, 0) - v.dimensions.height,
    ) > 1e-6
  )
    throw new Error(
      'Level heights must sum to the existing height. Resize explicitly first if a different total height is intended.',
    );
  if (new Set(op.levels.map((l) => l.name)).size !== op.levels.length)
    throw new Error('Level names must be distinct.');
  // Clip in source-local space, retaining its shape/voids and yaw, then apply
  // each explicit level transform. Bounds are never substituted for geometry.
  const source = { ...v, position: { x: 0, y: 0, z: 0 }, rotation: 0 };
  const result: Volume[] = [];
  let base = 0;
  const a = (v.rotation * Math.PI) / 180;
  for (const [i, level] of op.levels.entries()) {
    const cutter = {
      ...makeVolume(),
      dimensions: {
        width: v.dimensions.width,
        depth: v.dimensions.depth,
        height: level.height,
      },
      position: { x: 0, y: base, z: 0 },
    };
    const piece = await booleanVolume(source, cutter, 'intersect');
    // Center from actual intersection matters for tapering/asymmetric sources.
    const x = piece.position.x + level.offsetX,
      z = piece.position.z + level.offsetZ;
    const next: Volume = {
      ...piece,
      id: i === 0 ? v.id : crypto.randomUUID(),
      name: `${v.name.slice(0, 27)} · ${level.name}`,
      position: {
        x: v.position.x + x * Math.cos(a) + z * Math.sin(a),
        y: v.position.y + piece.position.y,
        z: v.position.z - x * Math.sin(a) + z * Math.cos(a),
      },
      dimensions: {
        ...piece.dimensions,
        width: piece.dimensions.width * level.scaleX,
        depth: piece.dimensions.depth * level.scaleZ,
      },
      rotation: v.rotation + level.rotation,
      component: {
        role: v.component?.role ?? 'building',
        hostId: v.component?.hostId ?? null,
        level: level.name,
        motion: 'none',
        travel: 1,
      },
    };
    validateVolume(next);
    result.push(next);
    base += level.height;
  }
  return result;
}

export async function bridgeVolume(
  a: Volume,
  b: Volume,
  op: Extract<VolumetricOperation, { type: 'bridge' }>,
): Promise<Volume> {
  const dx = b.position.x - a.position.x,
    dz = b.position.z - a.position.z,
    distance = Math.hypot(dx, dz);
  if (distance < 0.01)
    throw new Error('The bridge needs two horizontally separated volumes.');
  const ux = dx / distance,
    uz = dz / distance;
  const exit = (v: Volume) => {
    const angle = (v.rotation * Math.PI) / 180;
    const x = ux * Math.cos(angle) - uz * Math.sin(angle),
      z = ux * Math.sin(angle) + uz * Math.cos(angle);
    return Math.min(
      Math.abs(x) < 1e-9 ? Infinity : v.dimensions.width / (2 * Math.abs(x)),
      Math.abs(z) < 1e-9 ? Infinity : v.dimensions.depth / (2 * Math.abs(z)),
    );
  };
  const start = exit(a) - op.embed,
    end = distance - exit(b) + op.embed;
  if (end - start <= 2 * op.embed)
    throw new Error('These envelopes overlap or touch; a bridge needs a gap.');
  const v: Volume = {
    ...makeVolume(),
    name: op.name,
    dimensions: { width: end - start, depth: op.width, height: op.thickness },
    position: {
      x: a.position.x + (ux * (start + end)) / 2,
      y: op.elevation,
      z: a.position.z + (uz * (start + end)) / 2,
    },
    rotation: (Math.atan2(-uz, ux) * 180) / Math.PI,
    component: {
      role: 'floor',
      hostId: null,
      level: null,
      motion: 'none',
      travel: 1,
    },
  };
  validateVolume(v);
  if ((await sharedVolume(v, a)) < 1e-6 || (await sharedVolume(v, b)) < 1e-6)
    throw new Error(
      'The proposed bridge does not connect both actual solids at this elevation. Choose supported landing locations or use an explicit sweep.',
    );
  return v;
}
