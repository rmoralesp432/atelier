import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  DoubleSide,
} from 'three';
import { prepareARPart, type ARPartJob } from './preparation';
import { disposeARModel, exportARModel } from './model';

export type PackedARMesh = {
  positions: Float32Array;
  indices: Uint32Array;
  matrix: number[];
  color: number;
  opacity: number;
  roughness: number;
  transparent: boolean;
};
export type ARWorkerJob =
  | { type: 'part'; part: ARPartJob }
  | {
      type: 'export';
      meshes: PackedARMesh[];
      scale: number;
      rotation: number;
      transparent: boolean;
      height: number;
    };

onmessage = async ({ data }: MessageEvent<ARWorkerJob>) => {
  try {
    if (data.type === 'part') {
      const part = await prepareARPart(data.part);
      postMessage(
        { part },
        { transfer: [part.positions.buffer, part.indices.buffer] },
      );
    } else {
      const root = new Group();
      try {
        for (const part of data.meshes) {
          const g = new BufferGeometry();
          g.setAttribute('position', new BufferAttribute(part.positions, 3));
          g.setIndex(new BufferAttribute(part.indices, 1));
          g.computeVertexNormals();
          const mesh = new Mesh(
            g,
            new MeshStandardMaterial({
              color: part.color,
              opacity: part.opacity,
              roughness: part.roughness,
              transparent: part.transparent,
              flatShading: true,
              side: DoubleSide,
            }),
          );
          mesh.matrix.fromArray(part.matrix);
          mesh.matrixAutoUpdate = false;
          root.add(mesh);
        }
        const bytes = await exportARModel(
          root,
          data.scale,
          data.rotation,
          data.transparent,
          data.height,
        );
        postMessage({ bytes }, { transfer: [bytes.buffer] });
      } finally {
        disposeARModel(root);
      }
    }
  } catch (e) {
    postMessage({
      error: e instanceof Error ? e.message : 'Could not prepare the AR copy.',
    });
  }
};
