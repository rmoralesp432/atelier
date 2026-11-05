import { describe, it, expect } from 'vitest';
import { profileOperation, snapPoint, drawingPoint } from './profile';
import { applyPlan, directPlan, newSession } from '../intelligence/engine';
import { defaultCamera } from '../intelligence/context';
import { isProfile, solidStats } from '../geometry/kernel';
import { spatialGrid } from '../geometry/spatialGrid';
import * as THREE from 'three';
describe('drawn faces share the modeling engine', () => {
  it('preserves clicked position and elevation, extrudes a face and undoes the whole operation', async () => {
    const op = profileOperation(
      'rectangle',
      [
        { x: 12, z: 20 },
        { x: 4, z: 14 },
      ],
      4,
      'Drawing',
    );
    let s = (
      await applyPlan(
        newSession({ volumes: [], selectedId: null }),
        directPlan(op),
        defaultCamera,
      )
    ).session;
    const face = s.project.volumes[0];
    expect(face.position).toEqual({ x: 8, y: 4, z: 17 });
    expect(face.dimensions.width).toBe(8);
    expect(face.dimensions.depth).toBe(6);
    expect(isProfile(face)).toBe(true);
    s = (
      await applyPlan(
        s,
        directPlan({ type: 'extrude', target: '$selected', height: 5 }),
        defaultCamera,
      )
    ).session;
    expect((await solidStats(s.project.volumes[0])).volume).toBeCloseTo(240);
    expect(s.project.volumes[0].id).toBe(face.id);
    s = (
      await applyPlan(s, directPlan({ type: 'undo', count: 1 }), defaultCamera)
    ).session;
    expect(s.project.volumes[0]).toEqual(face);
  });
  it('keeps a concave outline in place instead of centering it at the origin', async () => {
    const points = [
      { x: 20, z: 20 },
      { x: 28, z: 20 },
      { x: 28, z: 24 },
      { x: 24, z: 24 },
      { x: 24, z: 28 },
      { x: 20, z: 28 },
    ];
    let s = (
      await applyPlan(
        newSession({ volumes: [], selectedId: null }),
        directPlan(profileOperation('outline', points, 0, 'L plan')),
        defaultCamera,
      )
    ).session;
    expect(s.project.volumes[0].position).toEqual({ x: 24, y: 0, z: 24 });
    s = (
      await applyPlan(
        s,
        directPlan({ type: 'extrude', target: '$selected', height: 3 }),
        defaultCamera,
      )
    ).session;
    expect((await solidStats(s.project.volumes[0])).volume).toBeCloseTo(144);
  });
  it('measures a circle by radius and rejects collapsed/crossing/oversized faces', () => {
    expect(
      profileOperation(
        'circle',
        [
          { x: 5, z: 2 },
          { x: 8, z: 6 },
        ],
        0,
        'Circle',
      ),
    ).toMatchObject({ width: 10, depth: 10, x: 5, z: 2 });
    expect(() =>
      profileOperation(
        'rectangle',
        [
          { x: 1, z: 1 },
          { x: 1, z: 8 },
        ],
        0,
        'Flat',
      ),
    ).toThrow();
    expect(() =>
      profileOperation(
        'outline',
        [
          { x: 0, z: 0 },
          { x: 8, z: 8 },
          { x: 0, z: 8 },
          { x: 8, z: 0 },
        ],
        0,
        'Cross',
      ),
    ).toThrow();
    expect(() =>
      profileOperation(
        'circle',
        [
          { x: 0, z: 0 },
          { x: 300, z: 0 },
        ],
        0,
        'Huge',
      ),
    ).toThrow();
    expect(
      drawingPoint('rectangle', { x: 3, z: -5 }, 0.5, { x: 0, z: 0 }, true),
    ).toEqual({ x: 5, z: -5 });
    expect(snapPoint({ x: 2.24, z: 3.8 }, 0.5, { x: 0, z: 0 }, true)).toEqual({
      x: 0,
      z: 4,
    });
  });
  it('extends the grid beyond the camera clipping distance and adapts spacing without moving world lines', () => {
    const grid = spatialGrid(),
      camera = new THREE.PerspectiveCamera(40, 1, 0.1, 5000),
      target = new THREE.Vector3();
    camera.position.set(15, 20, 30);
    expect(grid.update(camera, target)).toBe(1);
    camera.position.set(3000, 2000, 1000);
    expect(grid.update(camera, target)).toBe(100);
    expect(grid.mesh.scale.x).toBeGreaterThan(camera.far * 2);
    expect(grid.mesh.position.x).toBe(3000);
    grid.mesh.geometry.dispose();
    grid.mesh.material.dispose();
  });
});
