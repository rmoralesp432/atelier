import { describe, it, expect } from 'vitest';
import { transformSelection } from './selectionTransform';
import type { Project } from '../model';
const scene = (): Project => ({
  volumes: [
    {
      id: 'a',
      name: 'A',
      dimensions: { width: 2, depth: 3, height: 4 },
      position: { x: 0, y: 2, z: 0 },
      rotation: 0,
    },
    {
      id: 'b',
      name: 'B',
      dimensions: { width: 2, depth: 3, height: 4 },
      position: { x: 5, y: 0, z: 0 },
      rotation: 20,
    },
  ],
  selectedId: 'a',
  selectedIds: ['a', 'b'],
});
describe('selection transforms', () => {
  it('moves all selected objects, preserving spacing and grounding as one group', () => {
    const p = scene(),
      next = transformSelection(p, 'a', { position: { x: 3, y: 0, z: 2 } });
    expect(next.volumes.map((v) => v.position)).toEqual([
      { x: 3, y: 2, z: 2 },
      { x: 8, y: 0, z: 2 },
    ]);
    expect(p.volumes[0].position.x).toBe(0);
  });
  it('rotates positions and orientations about the active pivot', () => {
    const next = transformSelection(scene(), 'a', { rotation: 90 });
    expect(next.volumes[1].position).toEqual({ x: 0, y: 0, z: -5 });
    expect(next.volumes[1].rotation).toBe(110);
  });
  it('leaves hidden and locked members untouched', () => {
    const p = scene();
    p.groups = [{ id: 'g', name: 'Locked', visible: true, locked: true }];
    p.volumes[1].groupId = 'g';
    expect(
      transformSelection(p, 'a', { position: { x: 3, y: 2, z: 0 } }).volumes[1],
    ).toEqual(p.volumes[1]);
  });
});

it('moves hosted components once regardless of selection ordering, and protects locked children', () => {
  const p = scene();
  p.volumes[1].component = {
    role: 'window',
    hostId: 'a',
    level: null,
    motion: 'none',
    travel: 0,
  };
  p.volumes.reverse();
  const patch = { position: { x: 3, y: 2, z: 0 } };
  const moved = transformSelection(p, 'a', patch);
  expect(moved.volumes.find((v) => v.id === 'b')!.position.x).toBe(8);
  p.selectedIds = ['a'];
  expect(
    transformSelection(p, 'a', patch).volumes.find((v) => v.id === 'b')!
      .position.x,
  ).toBe(8);
  p.groups = [{ id: 'g', name: 'Locked window', visible: true, locked: true }];
  p.volumes[0].groupId = 'g';
  expect(() => transformSelection(p, 'a', patch)).toThrow(/locked component/);
  expect(p.volumes[0].position.x).toBe(5);
});
