export type Vec3 = { x: number; y: number; z: number };
export type Dimensions = { width: number; depth: number; height: number };
export type Volume = {
  id: string;
  name: string;
  dimensions: Dimensions;
  position: Vec3;
  rotation: number;
};
export type Project = { volumes: Volume[]; selectedId: string | null };
export const STORAGE_KEY = 'atelier.project.v1';
export const MAX_VOLUMES = 200;
export const round = (n: number) => Math.round(n * 1000) / 1000;
type FootprintPoint = { x: number; z: number };
type FootprintEdge = {
  a: FootprintPoint;
  b: FootprintPoint;
  polygonIndex: number;
};

function footprintCorners(volume: Volume): FootprintPoint[] {
  const halfWidth = volume.dimensions.width / 2;
  const halfDepth = volume.dimensions.depth / 2;
  const angle = (volume.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    { x: -halfWidth, z: -halfDepth },
    { x: halfWidth, z: -halfDepth },
    { x: halfWidth, z: halfDepth },
    { x: -halfWidth, z: halfDepth },
  ].map(({ x, z }) => ({
    x: volume.position.x + x * cos + z * sin,
    z: volume.position.z - x * sin + z * cos,
  }));
}

function edgeIntersection(first: FootprintEdge, second: FootprintEdge) {
  const r = { x: first.b.x - first.a.x, z: first.b.z - first.a.z };
  const s = { x: second.b.x - second.a.x, z: second.b.z - second.a.z };
  const denominator = r.x * s.z - r.z * s.x;
  if (Math.abs(denominator) < 1e-10) return null;
  const offset = {
    x: second.a.x - first.a.x,
    z: second.a.z - first.a.z,
  };
  const t = (offset.x * s.z - offset.z * s.x) / denominator;
  const u = (offset.x * r.z - offset.z * r.x) / denominator;
  if (t < -1e-10 || t > 1 + 1e-10 || u < -1e-10 || u > 1 + 1e-10)
    return null;
  return {
    x: first.a.x + t * r.x,
    z: first.a.z + t * r.z,
  };
}

function pointStrictlyInside(polygon: FootprintPoint[], point: FootprintPoint) {
  return polygon.every((a, index) => {
    const b = polygon[(index + 1) % polygon.length];
    return (
      (b.x - a.x) * (point.z - a.z) -
        (b.z - a.z) * (point.x - a.x) >
      1e-9
    );
  });
}

function unionLengthAtX(polygons: FootprintPoint[][], x: number) {
  const intervals: [number, number][] = [];
  for (const polygon of polygons) {
    const crossings: number[] = [];
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      if (Math.abs(b.x - a.x) < 1e-10) continue;
      const t = (x - a.x) / (b.x - a.x);
      if (t > 0 && t < 1) crossings.push(a.z + t * (b.z - a.z));
    }
    if (crossings.length >= 2) {
      crossings.sort((a, b) => a - b);
      intervals.push([crossings[0], crossings[crossings.length - 1]]);
    }
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let length = 0;
  let start = 0;
  let end = 0;
  for (const interval of intervals) {
    if (!length && start === end) {
      [start, end] = interval;
    } else if (interval[0] <= end + 1e-10) {
      end = Math.max(end, interval[1]);
    } else {
      length += end - start;
      [start, end] = interval;
    }
  }
  return intervals.length ? length + end - start : 0;
}

/** Exact union area of every rotated rectangular volume projected to X/Z. */
export function grossFootprint(volumes: Volume[]): number {
  if (!volumes.length) return 0;
  const polygons = volumes.map(footprintCorners);
  const edges = polygons.flatMap((polygon, polygonIndex) =>
    polygon.map((a, index) => ({
      a,
      b: polygon[(index + 1) % polygon.length],
      polygonIndex,
    })),
  );
  const criticalX = polygons.flatMap((polygon) => polygon.map((p) => p.x));
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      if (edges[i].polygonIndex === edges[j].polygonIndex) continue;
      const point = edgeIntersection(edges[i], edges[j]);
      if (
        point &&
        !polygons.some(
          (polygon, polygonIndex) =>
            polygonIndex !== edges[i].polygonIndex &&
            polygonIndex !== edges[j].polygonIndex &&
            pointStrictlyInside(polygon, point),
        )
      )
        criticalX.push(point.x);
    }
  }
  criticalX.sort((a, b) => a - b);
  const uniqueX = criticalX.filter(
    (x, index) => index === 0 || Math.abs(x - criticalX[index - 1]) > 1e-9,
  );
  let area = 0;
  for (let i = 0; i < uniqueX.length - 1; i += 1) {
    const left = uniqueX[i];
    const right = uniqueX[i + 1];
    const width = right - left;
    if (width <= 1e-10) continue;
    const firstThird = left + width / 3;
    const secondThird = right - width / 3;
    area +=
      ((unionLengthAtX(polygons, firstThird) +
        unionLengthAtX(polygons, secondThird)) /
        2) *
      width;
  }
  return round(area);
}
export function validateVolume(v: Volume): void {
  if (
    !v.id ||
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
        v.dimensions[k as keyof Dimensions] >= 0.1 &&
        v.dimensions[k as keyof Dimensions] <= 500,
    )
  )
    throw new Error('Dimensions must be between 0.1 and 500 meters.');
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
export function updateVolume(
  project: Project,
  id: string,
  patch: Partial<Omit<Volume, 'id'>>,
): Project {
  return {
    ...project,
    volumes: project.volumes.map((v) => {
      if (v.id !== id) return v;
      const next = { ...v, ...patch };
      validateVolume(next);
      return next;
    }),
  };
}
export function parseProject(text: string): Project {
  const raw = JSON.parse(text);
  if (
    raw.version !== 1 ||
    !Array.isArray(raw.volumes) ||
    raw.volumes.length > MAX_VOLUMES
  )
    throw new Error('Unsupported project file.');
  const ids = new Set<string>();
  for (const v of raw.volumes) {
    if (!v || typeof v.id !== 'string' || ids.has(v.id))
      throw new Error('Invalid volume identifier.');
    validateVolume(v);
    ids.add(v.id);
  }
  return {
    volumes: raw.volumes,
    selectedId: ids.has(raw.selectedId) ? raw.selectedId : null,
  };
}
export function serializeProject(p: Project): string {
  return JSON.stringify({ version: 1, ...p }, null, 2);
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
      project: { volumes: [...project.volumes, v], selectedId: v.id },
      message: `Created ${v.name} · ${m[1]} × ${m[2]} × ${m[3]} m`,
    };
  }
  const selected = project.volumes.find((v) => v.id === project.selectedId);
  const requireSelection = () => {
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
        volumes: project.volumes.filter((item) => item.id !== v.id),
        selectedId: null,
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
      project: { volumes: [...project.volumes, copy], selectedId: copy.id },
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
