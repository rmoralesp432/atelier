import * as THREE from 'three';

type Entry = {
  mesh: THREE.Mesh;
  full: THREE.BufferGeometry;
  preview?: THREE.BufferGeometry;
  target: number;
  originalRaycast: THREE.Mesh['raycast'];
};

/** Disposable, display-only copies. One worker job in flight bounds transfer
 * memory. Model recipes, exact picking, exports and persistence never use these. */
export class NavigationPreview {
  private entries = new Map<number, Entry>();
  private queue: number[] = [];
  private worker?: Worker;
  private busy = false;
  private failed = false;
  private nextId = 0;
  private active = false;
  constructor(private changed: () => void) {}
  get ready() {
    return [...this.entries.values()].filter((e) => e.preview).length;
  }
  add(mesh: THREE.Mesh, target: number) {
    if (
      this.failed ||
      !mesh.geometry.index ||
      mesh.geometry.index.count / 3 < Math.max(2000, target * 1.5)
    )
      return;
    const id = ++this.nextId,
      entry: Entry = {
        mesh,
        full: mesh.geometry,
        target,
        originalRaycast: mesh.raycast,
      };
    this.entries.set(id, entry);
    // Selection always hits the exact original surface, even during motion.
    mesh.raycast = function (ray, hits) {
      const displayed = this.geometry;
      this.geometry = entry.full;
      try {
        entry.originalRaycast.call(this, ray, hits);
      } finally {
        this.geometry = displayed;
      }
    };
    this.queue.push(id);
    this.pump();
  }
  private pump() {
    if (this.busy || this.failed) return;
    const id = this.queue.shift();
    if (id === undefined) return;
    const entry = this.entries.get(id);
    if (!entry) {
      this.pump();
      return;
    }
    try {
      if (!this.worker) {
        this.worker = new Worker(
          new URL('./navigation.worker.ts', import.meta.url),
          { type: 'module' },
        );
        this.worker.onerror = () => {
          this.failed = true;
          this.busy = false;
          this.queue = [];
          this.worker?.terminate();
          this.changed();
        };
        this.worker.onmessage = (event) => {
          const reply = event.data;
          const e = this.entries.get(reply.id);
          if (
            e &&
            !reply.failed &&
            reply.indices.length < e.full.index!.count
          ) {
            const g = new THREE.BufferGeometry();
            g.setAttribute(
              'position',
              new THREE.BufferAttribute(reply.positions, 3),
            );
            g.setIndex(new THREE.BufferAttribute(reply.indices, 1));
            g.computeVertexNormals();
            // Keep framing stable while the display copy changes.
            g.boundingBox = e.full.boundingBox?.clone() ?? null;
            g.boundingSphere = e.full.boundingSphere?.clone() ?? null;
            e.preview = g;
            if (this.active) e.mesh.geometry = g;
          }
          this.busy = false;
          this.changed();
          this.pump();
        };
      }
      this.busy = true;
      const positions = new Float32Array(
        entry.full.getAttribute('position').array,
      );
      const indices = new Uint32Array(entry.full.index!.array);
      this.worker.postMessage(
        { id, positions, indices, target: entry.target },
        [positions.buffer, indices.buffer],
      );
    } catch {
      this.failed = true;
      this.busy = false;
      this.queue = [];
      this.worker?.terminate();
      this.changed();
    }
  }
  setActive(active: boolean) {
    let changed = false;
    this.active = active;
    for (const e of this.entries.values()) {
      const geometry = active && e.preview ? e.preview : e.full;
      if (e.mesh.geometry !== geometry) {
        e.mesh.geometry = geometry;
        changed = true;
      }
    }
    return changed;
  }
  release(root: THREE.Object3D) {
    root.traverse((object) => {
      for (const [id, e] of this.entries)
        if (e.mesh === object) {
          e.mesh.geometry = e.full;
          e.mesh.raycast = e.originalRaycast;
          e.preview?.dispose();
          this.entries.delete(id);
        }
    });
  }
  dispose() {
    this.worker?.terminate();
    this.queue = [];
    for (const e of this.entries.values()) {
      e.mesh.geometry = e.full;
      e.mesh.raycast = e.originalRaycast;
      e.preview?.dispose();
    }
    this.entries.clear();
  }
}
