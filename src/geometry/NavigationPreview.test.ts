import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { NavigationPreview } from './NavigationPreview';

it('uses temporary display geometry while exact picking and release retain original faces', () => {
  const requests: any[] = [];
  let worker: any;
  class FakeWorker {
    onmessage?: (event: any) => void;
    onerror?: () => void;
    constructor() {
      worker = this;
    }
    postMessage(message: any) {
      requests.push(message);
    }
    terminate() {}
  }
  vi.stubGlobal('Worker', FakeWorker);
  try {
    const previews = new NavigationPreview(() => {});
    const full = new THREE.PlaneGeometry(20, 20, 100, 100);
    const indices = full.index!.array.slice();
    const mesh = new THREE.Mesh(
      full,
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
    const group = new THREE.Group();
    group.add(mesh);
    previews.add(mesh, 100);
    // Display copy deliberately has no face at the center where we will pick.
    worker.onmessage({
      data: {
        id: requests[0].id,
        positions: new Float32Array([-10, -10, 0, -9, -10, 0, -10, -9, 0]),
        indices: new Uint32Array([0, 1, 2]),
      },
    });
    expect(previews.ready).toBe(1);
    expect(previews.setActive(true)).toBe(true);
    expect(mesh.geometry.index!.count).toBe(3);
    const ray = new THREE.Raycaster(
      new THREE.Vector3(0.1, 0.2, 5),
      new THREE.Vector3(0, 0, -1),
    );
    expect(ray.intersectObject(mesh)[0].point.toArray()).toEqual([0.1, 0.2, 0]);
    expect(full.index!.array).toEqual(indices);
    previews.setActive(false);
    expect(mesh.geometry).toBe(full);
    previews.setActive(true);
    previews.release(group);
    expect(mesh.geometry).toBe(full);
    expect(previews.ready).toBe(0);
    previews.dispose();
    full.dispose();
    mesh.material.dispose();
  } finally {
    vi.unstubAllGlobals();
  }
});

it('ignores stale worker output for deleted objects and falls back on worker failure', () => {
  let worker: any;
  class FakeWorker {
    onmessage?: (event: any) => void;
    onerror?: () => void;
    constructor() {
      worker = this;
    }
    postMessage() {}
    terminate() {}
  }
  vi.stubGlobal('Worker', FakeWorker);
  try {
    const previews = new NavigationPreview(() => {});
    const full = new THREE.PlaneGeometry(20, 20, 100, 100);
    const mesh = new THREE.Mesh(full, new THREE.MeshBasicMaterial());
    previews.add(mesh, 100);
    previews.release(mesh);
    worker.onmessage({
      data: {
        id: 1,
        positions: new Float32Array(9),
        indices: new Uint32Array(3),
      },
    });
    expect(previews.ready).toBe(0);
    previews.add(mesh, 100);
    worker.onerror();
    previews.setActive(true);
    expect(mesh.geometry).toBe(full);
    previews.dispose();
    full.dispose();
    mesh.material.dispose();
  } finally {
    vi.unstubAllGlobals();
  }
});
