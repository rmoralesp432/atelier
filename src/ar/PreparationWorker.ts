import { Mesh, type Group, type MeshStandardMaterial } from 'three';
import type { ARPartJob, ARMeshData } from './preparation';
import type { ARWorkerJob, PackedARMesh } from './preparation.worker';

/** One transferable part at a time. Never clone an entire project/history into a worker. */
export class PreparationWorker {
  private worker: Worker;
  private reject?: (error: Error) => void;
  private timer?: ReturnType<typeof setTimeout>;
  private closed = false;
  constructor(private signal: AbortSignal) {
    signal.throwIfAborted();
    this.worker = new Worker(
      new URL('./preparation.worker.ts', import.meta.url),
      { type: 'module' },
    );
    signal.addEventListener('abort', this.dispose, { once: true });
  }
  private run(job: ARWorkerJob, transfers: Transferable[]): Promise<any> {
    if (this.closed)
      return Promise.reject(
        new DOMException('Preparation cancelled.', 'AbortError'),
      );
    return new Promise((resolve, reject) => {
      this.reject = reject;
      const finish = () => {
        clearTimeout(this.timer);
        this.reject = undefined;
      };
      this.worker.onmessage = ({ data }) => {
        finish();
        if (data.error) reject(new Error(data.error));
        else resolve(data);
      };
      this.worker.onerror = (event) => {
        event.preventDefault();
        finish();
        reject(
          new Error(
            'AR preparation stopped. Try fewer selected objects or refresh to load the latest AR files.',
          ),
        );
        this.dispose();
      };
      this.timer = setTimeout(() => {
        finish();
        reject(
          new Error(
            'AR preparation took too long. Try fewer selected objects. Your project is unchanged.',
          ),
        );
        this.dispose();
      }, 60000);
      try {
        this.worker.postMessage(job, transfers);
      } catch (e) {
        finish();
        reject(e);
        this.dispose();
      }
    });
  }
  async part(part: ARPartJob): Promise<ARMeshData> {
    return (
      await this.run({ type: 'part', part }, [
        part.positions.buffer,
        part.indices.buffer,
      ])
    ).part;
  }
  async export(
    root: Group,
    scale: number,
    rotation: number,
    transparent: boolean,
    height: number,
  ): Promise<Uint8Array> {
    const meshes: PackedARMesh[] = [],
      transfers: Transferable[] = [];
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const positions = new Float32Array(o.geometry.attributes.position.array);
      const indices = new Uint32Array(o.geometry.index!.array);
      const m = o.material as MeshStandardMaterial;
      meshes.push({
        positions,
        indices,
        matrix: o.matrixWorld.toArray(),
        color: m.color.getHex(),
        opacity: m.opacity,
        roughness: m.roughness,
        transparent: m.transparent,
      });
      transfers.push(positions.buffer, indices.buffer);
    });
    return (
      await this.run(
        { type: 'export', meshes, scale, rotation, transparent, height },
        transfers,
      )
    ).bytes;
  }
  dispose = () => {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    this.worker.terminate();
    this.reject?.(new DOMException('Preparation cancelled.', 'AbortError'));
    this.reject = undefined;
    this.signal.removeEventListener('abort', this.dispose);
  };
}
