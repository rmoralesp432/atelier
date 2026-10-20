import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { emptyPanoramas, parsePanoramas } from './data';
import { orientationQuaternion } from './orientation';
it('retains per-project panorama metadata and rejects unsafe sources, duplicates and excessive coverage', () => {
  const item = {
    id: 'photo',
    name: 'Lobby',
    image: 'data:image/jpeg;base64,/9j/',
    width: 2048,
    height: 1024,
    horizontalAngle: 360,
  };
  expect(parsePanoramas(undefined)).toEqual(emptyPanoramas());
  expect(parsePanoramas({ version: 1, items: [item] }).items[0]).toEqual(item);
  for (const patch of [
    { image: 'https://example.com/photo.jpg' },
    { horizontalAngle: 720 },
    { width: 0 },
  ])
    expect(() =>
      parsePanoramas({ version: 1, items: [{ ...item, ...patch }] }),
    ).toThrow();
  expect(() => parsePanoramas({ version: 1, items: [item, item] })).toThrow(
    'unique',
  );
});
it('maps real orientation axes into a camera and accounts for screen rotation', () => {
  const upright = orientationQuaternion(0, 90, 0, 0)!;
  expect(new Vector3(0, 0, -1).applyQuaternion(upright).z).toBeCloseTo(-1);
  const turned = orientationQuaternion(90, 90, 0, 0)!;
  expect(new Vector3(0, 0, -1).applyQuaternion(turned).x).toBeCloseTo(-1);
  expect(orientationQuaternion(0, 90, 0, 90)!.equals(upright)).toBe(false);
  expect(orientationQuaternion(null, 0, 0, 0)).toBeNull();
  expect(orientationQuaternion(0, NaN, 0, 0)).toBeNull();
});
