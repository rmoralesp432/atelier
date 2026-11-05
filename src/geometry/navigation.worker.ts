import { BufferAttribute, BufferGeometry } from 'three';
import { optimizeGeometry } from '../imports/optimize';

onmessage = async (
  event: MessageEvent<{
    id: number;
    positions: Float32Array;
    indices: Uint32Array;
    target: number;
  }>,
) => {
  const { id, positions, indices, target } = event.data;
  const source = new BufferGeometry();
  source.setAttribute('position', new BufferAttribute(positions, 3));
  source.setIndex(new BufferAttribute(indices, 1));
  try {
    const { geometry } = await optimizeGeometry(source, target, true);
    const p = geometry.getAttribute('position').array as Float32Array;
    const i = geometry.index!.array as Uint32Array;
    postMessage(
      { id, positions: p, indices: i },
      { transfer: [p.buffer, i.buffer] },
    );
    geometry.dispose();
  } catch {
    postMessage({ id, failed: true }); // Full detail remains usable on failure.
  } finally {
    source.dispose();
  }
};
