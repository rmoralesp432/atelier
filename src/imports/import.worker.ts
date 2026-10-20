import {
  parseMeshAsset,
  prepareImport,
  type MeshAsset,
  type PreparedImport,
} from './mesh';
import { setKernelWasmUrl } from '../geometry/kernel';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import type { ImportRequest, ImportReply } from './protocol';

setKernelWasmUrl(wasmUrl);
// FBX cameras are discarded, but Three's loader reads a viewport while parsing them.
// No DOM, textures, or network credentials are exposed to the worker.
(
  globalThis as unknown as {
    window: { innerWidth: number; innerHeight: number };
  }
).window = { innerWidth: 1, innerHeight: 1 };
let asset: MeshAsset | undefined;
let prepared: PreparedImport | undefined;
let revision = -1;
const send = (reply: ImportReply) => postMessage(reply);
let queue = Promise.resolve();
onmessage = (event: MessageEvent<ImportRequest>) => {
  const request = event.data;
  // Serialize kernel use. UI revisions discard obsolete previews.
  queue = queue.then(async () => {
    try {
      if (request.type === 'load') {
        send({ type: 'progress', text: 'Reading the file on this device…' });
        asset = await parseMeshAsset(
          request.file.name,
          await request.file.arrayBuffer(),
          request.detail,
          (text) => send({ type: 'progress', text }),
        );
        send({
          type: 'loaded',
          info: {
            name: asset.name,
            format: asset.format,
            triangles: asset.indices.length / 3,
            sourceTriangles: asset.sourceTriangles ?? asset.indices.length / 3,
            parts: asset.parts?.length,
            warnings: asset.warnings ?? [],
          },
        });
      } else if (request.type === 'prepare') {
        if (!asset) throw new Error('Choose a file first.');
        prepared = undefined;
        revision = request.revision;
        send({ type: 'progress', text: 'Preparing dimensions and geometry…' });
        prepared = await prepareImport(
          asset,
          request.options,
          request.separate,
          request.checkSolids,
        );
        send({
          type: 'preview',
          revision,
          preview: {
            dimensions: prepared.dimensions,
            count: prepared.volumes.length,
            solids: prepared.volumes.filter(
              (v) => v.geometry?.kind === 'mesh' && v.geometry.solid,
            ).length,
          },
        });
      } else {
        if (!prepared || request.revision !== revision)
          throw new Error('Wait for the current preview before adding.');
        send({ type: 'result', revision, prepared });
      }
    } catch (error) {
      send({
        type: 'error',
        revision: 'revision' in request ? request.revision : undefined,
        text:
          error instanceof Error ? error.message : 'Could not read this model.',
      });
    }
  });
};
