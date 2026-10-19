import { validateSite, type Site } from './studio/site';
import type { MeshRecipe } from './imports/mesh';
import { validateRecipe } from './geometry/kernel';
export type Vec3 = { x: number; y: number; z: number };
export type Dimensions = { width: number; depth: number; height: number };
import type { FormRecipe } from './geometry/forms';
export type GeometryRecipe =
  | FormRecipe
  | {
      kind: 'oriented';
      source: Volume;
      degrees: Vec3;
      origin: Vec3;
      base: Dimensions;
    }
  | { kind: 'hollow'; source: Volume; thickness: number; openTop: boolean }
  | MeshRecipe
  | { kind: 'person' | 'tree' }
  | { kind: 'mirror'; source: Volume; axis: 'x' | 'z' }
  | { kind: 'box' | 'cylinder' | 'sphere' | 'rectangle' | 'circle' }
  | { kind: 'extrusion'; profile: 'rectangle' | 'circle' }
  | { kind: 'polygon'; points: { x: number; z: number }[]; extruded: boolean }
  | {
      kind: 'building';
      source: Volume;
      base: Dimensions;
      floors: number;
      slabThickness: number;
      facade: boolean;
      panelWidth: number;
      fixedWindowWidth?: number;
      mullionWidth: number;
    }
  | {
      kind: 'boolean';
      operation: 'union' | 'subtract' | 'intersect';
      operands: Volume[];
      origin: Vec3;
      base: Dimensions;
      opening?: boolean;
    };
export type Volume = {
  /** Material of an independently editable architectural component. */
  material?: 'solid' | 'glass' | 'frame';
  geometry?: GeometryRecipe;
  groupId?: string;
  display?: {
    mode: 'architecture' | 'volume';
    floors: boolean;
    glass: boolean;
  };
  color?: string;
  id: string;
  name: string;
  dimensions: Dimensions;
  position: Vec3;
  rotation: number;
};
export type ObjectGroup = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
};
export const isVisible = (v: Volume, p: Project) =>
  p.groups?.find((g) => g.id === v.groupId)?.visible !== false;
export const isLocked = (v: Volume, p: Project) =>
  p.groups?.find((g) => g.id === v.groupId)?.locked === true;
export type Project = {
  groups?: ObjectGroup[];
  site?: Site;
  volumes: Volume[];
  selectedId: string | null;
  selectedIds?: string[];
};
export const STORAGE_KEY = 'atelier.project.v1';
export const MAX_VOLUMES = 200;
export const round = (n: number) => Math.round(n * 1000) / 1000 + 0;
export function validateVolume(v: Volume, checkGeometry = true): void {
  if (
    typeof v.id !== 'string' ||
    !v.id ||
    v.id.length > 100 ||
    typeof v.name !== 'string' ||
    !v.name.trim() ||
    v.name.length > 80
  )
    throw new Error('Give the volume a name between 1 and 80 characters.');
  if (
    !v.dimensions ||
    Object.values(v.dimensions).length !== 3 ||
    !['width', 'depth', 'height'].every(
      (k) =>
        Number.isFinite(v.dimensions[k as keyof Dimensions]) &&
        v.dimensions[k as keyof Dimensions] >=
          (v.geometry?.kind === 'mesh' ? 0.001 : 0.1) &&
        v.dimensions[k as keyof Dimensions] <= 500,
    )
  )
    throw new Error(
      `Dimensions must be between ${v.geometry?.kind === 'mesh' ? '0.001' : '0.1'} and 500 meters.`,
    );
  if (
    !v.position ||
    !['x', 'y', 'z'].every(
      (k) =>
        Number.isFinite(v.position[k as keyof Vec3]) &&
        Math.abs(v.position[k as keyof Vec3]) <= 1000,
    ) ||
    v.position.y < 0
  )
    throw new Error(
      'Coordinates must be within ±1,000 m; elevation Y cannot be negative.',
    );
  if (
    v.display &&
    (!['architecture', 'volume'].includes(v.display.mode) ||
      typeof v.display.floors !== 'boolean' ||
      typeof v.display.glass !== 'boolean')
  )
    throw new Error('Invalid building display settings.');
  if (
    v.material !== undefined &&
    !['solid', 'glass', 'frame'].includes(v.material)
  )
    throw new Error('Invalid component material.');
  if (v.color !== undefined && !/^#[0-9a-f]{6}$/i.test(v.color))
    throw new Error('Use a six-digit hex object color.');
  if (checkGeometry) validateRecipe(v.geometry);
  if (!Number.isFinite(v.rotation))
    throw new Error('Rotation must be a finite number.');
}
export function makeVolume(
  index = 1,
  dimensions: Dimensions = { width: 12, depth: 8, height: 6 },
): Volume {
  const v = {
    id: crypto.randomUUID(),
    name: `Volume ${String(index).padStart(2, '0')}`,
    dimensions,
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
  };
  validateVolume(v);
  return v;
}
export function initialProject(): Project {
  const a = makeVolume(1, { width: 14, depth: 9, height: 5 });
  a.name = 'Main pavilion';
  a.position = { x: -3, y: 0, z: 0 };
  const b = makeVolume(2, { width: 5, depth: 9, height: 9 });
  b.name = 'Vertical annex';
  b.position = { x: 6.5, y: 0, z: 0 };
  return { volumes: [a, b], selectedId: a.id };
}
export function buildingSettings(v: Volume) {
  const g = v.geometry;
  if (g?.kind !== 'building') return null;
  return {
    floors: g.floors,
    facade: g.facade,
    slabThickness: (g.slabThickness * v.dimensions.height) / g.base.height,
    panelWidth: (g.panelWidth * v.dimensions.width) / g.base.width,
    mullionWidth: (g.mullionWidth * v.dimensions.width) / g.base.width,
  };
}
export function updateVolume(
  project: Project,
  id: string,
  patch: Partial<Omit<Volume, 'id'>>,
): Project {
  return {
    ...project,
    volumes: project.volumes.map((v) => {
      if (v.id !== id) return v;
      if (isLocked(v, project))
        throw new Error(
          'This group is locked. Unlock it before editing its objects.',
        );
      const next = { ...v, ...patch };
      if (
        patch.dimensions &&
        !patch.geometry &&
        v.geometry?.kind === 'building'
      ) {
        // Resize the envelope without silently scaling stated slab/frame sizes.
        next.geometry = {
          ...v.geometry,
          ...buildingSettings(v),
          base: { ...next.dimensions },
          source: { ...v.geometry.source, dimensions: { ...next.dimensions } },
        };
      }
      if (patch.dimensions && !patch.geometry && v.geometry?.kind === 'hollow')
        next.geometry = {
          ...v.geometry,
          source: { ...v.geometry.source, dimensions: { ...next.dimensions } },
        };
      validateVolume(next);
      return next;
    }),
  };
}
export function parseProject(text: string): Project {
  const raw = JSON.parse(text);
  if (
    ![1, 2].includes(raw.version) ||
    !Array.isArray(raw.volumes) ||
    raw.volumes.length > MAX_VOLUMES
  )
    throw new Error('Unsupported project file.');
  if (raw.site !== undefined) validateSite(raw.site);
  if (
    raw.groups !== undefined &&
    (!Array.isArray(raw.groups) ||
      raw.groups.length > 50 ||
      raw.groups.some(
        (g: any) =>
          !g ||
          typeof g.id !== 'string' ||
          !g.id ||
          g.id.length > 100 ||
          typeof g.name !== 'string' ||
          !g.name.trim() ||
          g.name.length > 80 ||
          typeof g.visible !== 'boolean' ||
          typeof g.locked !== 'boolean',
      ) ||
      new Set(raw.groups.map((g: any) => g.id)).size !== raw.groups.length)
  )
    throw new Error('Invalid project groups.');
  const ids = new Set<string>();
  for (const v of raw.volumes) {
    if (!v || typeof v.id !== 'string' || ids.has(v.id))
      throw new Error('Invalid volume identifier.');
    validateVolume(v);
    if (v.groupId && !raw.groups?.some((g: any) => g.id === v.groupId))
      throw new Error('Object refers to a missing group.');
    ids.add(v.id);
  }
  return {
    ...(raw.groups ? { groups: raw.groups } : {}),
    ...(raw.site ? { site: raw.site } : {}),
    volumes: raw.volumes,
    selectedId: ids.has(raw.selectedId) ? raw.selectedId : null,
    ...(Array.isArray(raw.selectedIds)
      ? { selectedIds: raw.selectedIds.filter((id: string) => ids.has(id)) }
      : {}),
  };
}
export function serializeProject(p: Project): string {
  return JSON.stringify({ version: 2, ...p }, null, 2);
}

export const COMMAND_EXAMPLES = [
  'create volume width 12 depth 8 height 6',
  'move selected x 4 y 0 z -2',
  'resize selected width 16 depth 10 height 8',
  'rotate selected 45',
  'duplicate selected',
  'delete selected',
];
// Deliberately bounded grammar: no remote model, execution, or inferred units.
export function executeCommand(
  project: Project,
  input: string,
): { project: Project; message: string } {
  const text = input.trim().toLowerCase().replace(/\s+/g, ' ');
  const number = '(-?(?:\\d+(?:\\.\\d*)?|\\.\\d+))';
  const match = (pattern: string) => text.match(new RegExp(`^${pattern}$`));
  let m: RegExpMatchArray | null;
  if (
    (m = match(
      `create (?:volume|box) width ${number} depth ${number} height ${number}`,
    )) ||
    (m = match(
      `create (?:volume|box) ${number}\\s*[x×]\\s*${number}\\s*[x×]\\s*${number}`,
    ))
  ) {
    if (project.volumes.length >= MAX_VOLUMES)
      throw new Error('This workspace supports up to 200 volumes.');
    const v = makeVolume(project.volumes.length + 1, {
      width: +m[1],
      depth: +m[2],
      height: +m[3],
    });
    return {
      project: {
        ...project,
        volumes: [...project.volumes, v],
        selectedId: v.id,
        selectedIds: [v.id],
      },
      message: `Created ${v.name} · ${m[1]} × ${m[2]} × ${m[3]} m`,
    };
  }
  const selected = project.volumes.find((v) => v.id === project.selectedId);
  const requireSelection = () => {
    if (selected && isLocked(selected, project))
      throw new Error('This group is locked. Unlock it before editing.');
    if (!selected) throw new Error('Select a volume first.');
    return selected;
  };
  let patch: Partial<Volume>;
  if ((m = match(`move selected x ${number} y ${number} z ${number}`))) {
    requireSelection();
    patch = { position: { x: +m[1], y: +m[2], z: +m[3] } };
  } else if (
    (m = match(
      `resize selected width ${number} depth ${number} height ${number}`,
    ))
  ) {
    requireSelection();
    patch = { dimensions: { width: +m[1], depth: +m[2], height: +m[3] } };
  } else if ((m = match(`rotate selected ${number}`))) {
    requireSelection();
    patch = { rotation: ((+m[1] % 360) + 360) % 360 };
  } else if (text === 'delete selected') {
    const v = requireSelection();
    return {
      project: {
        ...project,
        volumes: project.volumes.filter((item) => item.id !== v.id),
        selectedId: null,
        selectedIds: [],
      },
      message: `Deleted ${v.name}`,
    };
  } else if (text === 'duplicate selected') {
    const v = requireSelection();
    if (project.volumes.length >= MAX_VOLUMES)
      throw new Error('This workspace supports up to 200 volumes.');
    const copy = {
      ...v,
      id: crypto.randomUUID(),
      name: `${v.name.slice(0, 73)} copy`,
      position: { ...v.position, x: v.position.x + 2, z: v.position.z + 2 },
    };
    validateVolume(copy);
    return {
      project: {
        ...project,
        volumes: [...project.volumes, copy],
        selectedId: copy.id,
        selectedIds: [copy.id],
      },
      message: `Duplicated ${v.name}`,
    };
  } else
    throw new Error(
      'Command not recognized. Open Command guide for supported examples.',
    );
  const v = requireSelection();
  return {
    project: updateVolume(project, v.id, patch),
    message: `Updated ${v.name}`,
  };
}
