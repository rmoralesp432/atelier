import { expect, it } from 'vitest';
import { makeVolume, type Project } from '../model';
import { explosionOffsets } from './explosion';
import { explorationTransform } from './model';
import type { ComponentInfo } from './schema';
const component = (
  role: ComponentInfo['role'],
  hostId: string | null = null,
): ComponentInfo => ({ role, hostId, level: null, motion: 'none', travel: 1 });
function assembly() {
  const floor = makeVolume(1, { width: 10, depth: 6, height: 0.3 });
  floor.id = 'floor';
  floor.component = component('floor');
  floor.position = { x: 100, y: 4, z: 200 };
  const roof = makeVolume(2, { width: 10, depth: 6, height: 0.3 });
  roof.id = 'roof';
  roof.component = component('roof');
  roof.position = { x: 100, y: 8, z: 200 };
  const door = makeVolume(3, { width: 1, depth: 0.1, height: 2.2 });
  door.id = 'door';
  door.component = component('door');
  door.position = { x: 100, y: 4.3, z: 203 };
  const handle = makeVolume(4, { width: 0.1, depth: 0.1, height: 0.3 });
  handle.id = 'handle';
  handle.component = component('element', 'door');
  handle.position = { x: 100.4, y: 5.2, z: 203.1 };
  const tree = makeVolume(5);
  tree.id = 'tree';
  tree.geometry = { kind: 'tree' };
  tree.position = { x: 150, y: 0, z: 200 };
  return {
    volumes: [handle, roof, floor, door, tree],
    selectedId: null,
  } satisfies Project;
}
it('exploded diagrams align slabs, lift roofs and retain hosted assemblies without editing source geometry', () => {
  const p = assembly(),
    before = JSON.stringify(p),
    state = { mode: 'exploded' as const, amount: 1, targets: [] };
  const o = explosionOffsets(p, state);
  expect(o.get('floor')).toEqual({ x: 0, y: 0, z: 0 });
  expect(o.get('roof')!.y).toBeGreaterThan(o.get('door')!.y);
  expect(o.get('door')!.z).toBeGreaterThan(0);
  expect(o.get('handle')).toEqual(o.get('door'));
  expect(o.has('tree')).toBe(false);
  for (const v of p.volumes)
    expect(explorationTransform(v, p, { ...state, amount: 0 })).toEqual({
      position: v.position,
      rotation: v.rotation,
    });
  expect(JSON.stringify(p)).toBe(before);
});
it('selection explosion includes descendants in any file order and keeps other objects stationary', () => {
  const p = assembly(),
    state = { mode: 'exploded' as const, amount: 0.5, targets: ['door'] };
  const o = explosionOffsets(p, state);
  expect([...o.keys()].sort()).toEqual(['door', 'handle']);
  expect(o.get('handle')).toEqual(o.get('door'));
  const roof = p.volumes.find((v) => v.id === 'roof')!;
  expect(explorationTransform(roof, p, state).position).toEqual(roof.position);
});
it('explosion distances depend on the assembly, not its elevation or project origin', () => {
  const p = assembly(),
    state = { mode: 'exploded' as const, amount: 1, targets: [] };
  const first = explosionOffsets(p, state);
  const moved = {
    ...p,
    volumes: p.volumes.map((v) => ({
      ...v,
      position: {
        x: v.position.x + 500,
        y: v.position.y + 60,
        z: v.position.z - 800,
      },
    })),
  };
  const translated = explosionOffsets(moved, state);
  for (const [id, offset] of first)
    for (const axis of ['x', 'y', 'z'] as const)
      expect(translated.get(id)![axis]).toBeCloseTo(offset[axis]);
  const half = explosionOffsets(p, { ...state, amount: 0.5 });
  for (const [id, offset] of first)
    for (const axis of ['x', 'y', 'z'] as const)
      expect(half.get(id)![axis]).toBeCloseTo(offset[axis] / 2);
});
it('all four facades exit along a single local normal and never move vertically or toward the building', () => {
  for (const rotation of [0, 45, 90]) {
    const floor = makeVolume(1, { width: 20, depth: 10, height: 0.3 });
    floor.component = component('floor');
    floor.rotation = rotation;
    const a = (rotation * Math.PI) / 180;
    const faces = [
      [-10, 0, 0.1, 10],
      [10, 0, 0.1, 10],
      [0, -5, 20, 0.1],
      [0, 5, 20, 0.1],
    ].map(([x, z, width, depth], i) => {
      const v = makeVolume(i + 2, { width, depth, height: 3 });
      v.rotation = rotation;
      v.component = component('window');
      v.position = {
        x: x * Math.cos(a) + z * Math.sin(a),
        y: 0.3,
        z: -x * Math.sin(a) + z * Math.cos(a),
      };
      return v;
    });
    const offsets = explosionOffsets(
      { volumes: [floor, ...faces], selectedId: null },
      { mode: 'exploded', amount: 1, targets: [] },
    );
    for (const v of faces) {
      const o = offsets.get(v.id)!;
      expect(o.y).toBe(0);
      expect(o.x * v.position.x + o.z * v.position.z).toBeGreaterThan(0);
      const x = o.x * Math.cos(a) - o.z * Math.sin(a),
        z = o.x * Math.sin(a) + o.z * Math.cos(a);
      expect(Math.min(Math.abs(x), Math.abs(z))).toBeLessThan(1e-8);
    }
  }
});
it('a distant second building does not reverse the first building facade', () => {
  const p = assembly(),
    far = makeVolume(9, { width: 30, depth: 20, height: 0.3 });
  far.component = component('floor');
  far.position = { x: 100, y: 4, z: 450 };
  const o = explosionOffsets(
    { ...p, volumes: [...p.volumes, far] },
    { mode: 'exploded', amount: 1, targets: [] },
  );
  expect(o.get('door')!.z).toBeGreaterThan(0);
  expect(o.get('door')!.y).toBe(0);
});
