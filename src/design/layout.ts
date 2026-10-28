import { makeVolume, type Project, type Volume } from '../model';
import { envelopeBounds } from '../geometry/spatial';

/** Concept layouts use explicit rectangular room envelopes. Clearance is a
 * geometric perimeter, not a fire-egress or accessibility compliance claim. */
export function furnishRoom(
  project: Project,
  room: Volume,
  layout: 'meeting' | 'classroom' | 'lounge',
  clearance: number,
): Volume[] {
  if (room.component?.role !== 'room')
    throw new Error(
      'Identify a rectangular room first using its component role.',
    );
  if (room.geometry && !['box', 'rectangle'].includes(room.geometry.kind))
    throw new Error(
      'Automatic layouts currently need a rectangular room envelope.',
    );
  const w = room.dimensions.width - 2 * clearance,
    d = room.dimensions.depth - 2 * clearance;
  if (w < 2.4 || d < 2.4)
    throw new Error('This room is too small for that layout and clearance.');
  const result: Volume[] = [];
  const groupId = crypto.randomUUID();
  const add = (
    name: string,
    width: number,
    depth: number,
    height: number,
    x: number,
    z: number,
    y = 0,
  ) => {
    const a = (room.rotation * Math.PI) / 180;
    const v = makeVolume(1, { width, depth, height });
    v.name = name;
    v.rotation = room.rotation;
    v.position = {
      x: room.position.x + x * Math.cos(a) + z * Math.sin(a),
      y: room.position.y + y,
      z: room.position.z - x * Math.sin(a) + z * Math.cos(a),
    };
    v.groupId = groupId;
    v.color = name.includes('table') ? '#c8ad89' : '#6e8587';
    v.component = {
      role: 'furniture',
      hostId: room.id,
      level: room.component?.level ?? null,
      motion: 'none',
      travel: 1,
    };
    result.push(v);
  };
  const table = (x: number, z: number, tw: number, td: number) => {
    add('Concept table top', tw, td, 0.1, x, z, 0.65);
    for (const dx of [-1, 1])
      for (const dz of [-1, 1])
        add(
          'Table leg',
          0.1,
          0.1,
          0.65,
          x + dx * (tw / 2 - 0.1),
          z + dz * (td / 2 - 0.1),
        );
  };
  const seat = (x: number, z: number) =>
    add('Concept seat', 0.5, 0.5, 0.45, x, z);
  if (layout === 'meeting') {
    const tw = Math.min(w - 1.8, 4),
      td = Math.min(d - 1.8, 1.4);
    table(0, 0, tw, td);
    const count = Math.max(1, Math.floor(tw / 0.8));
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * 0.8;
      seat(x, -td / 2 - 0.5);
      seat(x, td / 2 + 0.5);
    }
  } else if (layout === 'classroom') {
    const columns = Math.min(3, Math.floor(w / 1.9)),
      rows = Math.min(4, Math.floor(d / 2.1));
    if (!columns || !rows)
      throw new Error('Not enough room for desks and chair clearance.');
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < columns; c++) {
        const x = (c - (columns - 1) / 2) * 1.9,
          z = (r - (rows - 1) / 2) * 2.1;
        table(x, z, 1.1, 0.6);
        seat(x, z + 0.85);
      }
  } else {
    table(0, 0, 0.8, 0.8);
    for (const x of [-0.95, 0.95]) for (const z of [-0.65, 0.65]) seat(x, z);
  }
  if (project.volumes.length + result.length > 200)
    throw new Error('This layout would exceed the workspace object limit.');
  const roomYaw = (room.rotation * Math.PI) / 180;
  for (const v of result) {
    const dx = v.position.x - room.position.x,
      dz = v.position.z - room.position.z;
    const x = dx * Math.cos(roomYaw) - dz * Math.sin(roomYaw),
      z = dx * Math.sin(roomYaw) + dz * Math.cos(roomYaw);
    if (
      Math.abs(x) + v.dimensions.width / 2 > w / 2 + 1e-6 ||
      Math.abs(z) + v.dimensions.depth / 2 > d / 2 + 1e-6
    )
      throw new Error(
        'The furniture would violate the requested room clearance.',
      );
    const b = envelopeBounds(v);
    for (const other of project.volumes) {
      if (
        other.id === room.id ||
        other.visible === false ||
        other.component?.role === 'room'
      )
        continue;
      const a = envelopeBounds(other);
      if (
        ['x', 'y', 'z'].every(
          (axis) =>
            Math.min(a.max[axis as 'x'], b.max[axis as 'x']) -
              Math.max(a.min[axis as 'x'], b.min[axis as 'x']) >
            0.005,
        )
      )
        throw new Error(
          `The layout may intersect ${other.name}. Move it or choose another room/layout; no furniture was added.`,
        );
    }
  }
  return result;
}
