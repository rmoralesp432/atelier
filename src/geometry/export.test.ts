import { it, expect } from 'vitest';
import { exportObj } from './export';
import { makeVolume } from '../model';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { Box3 } from 'three';
it('exports real world-space triangles with units and excludes hidden layers', async () => {
  const v = {
    ...makeVolume(1, { width: 10, depth: 4, height: 6 }),
    position: { x: 20, y: 3, z: -8 },
    rotation: 90,
  };
  const hidden = { ...makeVolume(), groupId: 'hidden' };
  const text = await exportObj({
    volumes: [v, hidden],
    selectedId: null,
    groups: [{ id: 'hidden', name: 'Hidden', visible: false, locked: false }],
  });
  const object = new OBJLoader().parse(text),
    bounds = new Box3().setFromObject(object);
  expect(text).toContain('Units: meters');
  expect(object.children).toHaveLength(1);
  expect(bounds.min.y).toBeCloseTo(3);
  expect(bounds.max.y).toBeCloseTo(9);
  expect(bounds.max.x - bounds.min.x).toBeCloseTo(4);
  expect(bounds.max.z - bounds.min.z).toBeCloseTo(10);
});
