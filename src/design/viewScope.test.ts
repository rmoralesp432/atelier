import { it, expect } from 'vitest';
import { Vector3 } from 'three';
import { makeVolume } from '../model';
import { viewScope } from './viewScope';
it('room cutaway retains intersecting elements but clips outside its rotated envelope without changing geometry', () => {
  const room = makeVolume(1, { width: 8, depth: 4, height: 3 });
  room.rotation = 45;
  room.component = {
    role: 'room',
    hostId: null,
    level: 'Ground',
    motion: 'none',
    travel: 0,
  };
  const floor = makeVolume(2, { width: 20, depth: 20, height: 0.2 }),
    outside = makeVolume(3);
  outside.position.x = 100;
  const p = { volumes: [room, floor, outside], selectedId: null };
  const original = JSON.stringify(p);
  const scope = viewScope(p, {
    name: 'Room',
    targets: [room.id],
    pose: null,
    section: null,
  });
  expect(scope.ids?.has(floor.id)).toBe(true);
  expect(scope.ids?.has(outside.id)).toBe(false);
  expect(
    scope.planes.every(
      (plane) => plane.distanceToPoint(new Vector3(0, 1, 0)) >= 0,
    ),
  ).toBe(true);
  expect(
    scope.planes.some(
      (plane) => plane.distanceToPoint(new Vector3(10, 1, 0)) < 0,
    ),
  ).toBe(true);
  expect(JSON.stringify(p)).toBe(original);
});
