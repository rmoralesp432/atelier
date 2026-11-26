import * as THREE from 'three';
export function sampleGlb(external = false, modify?: (json: any) => void) {
  const g = new THREE.BoxGeometry(2, 3, 4),
    p = g.getAttribute('position'),
    idx = g.getIndex()!;
  const positions = new Float32Array(p.array),
    indices = new Uint16Array(idx.array);
  const bin = new Uint8Array(positions.byteLength + indices.byteLength);
  bin.set(new Uint8Array(positions.buffer));
  bin.set(new Uint8Array(indices.buffer), positions.byteLength);
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, translation: [10, 0, 0], scale: [-1, 1, 1] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [
      {
        byteLength: bin.length,
        ...(external ? { uri: 'https://example.invalid/secret.bin' } : {}),
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
      {
        buffer: 0,
        byteOffset: positions.byteLength,
        byteLength: indices.byteLength,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: p.count,
        type: 'VEC3',
        min: [-1, -1.5, -2],
        max: [1, 1.5, 2],
      },
      { bufferView: 1, componentType: 5123, count: idx.count, type: 'SCALAR' },
    ],
  };
  modify?.(json);
  const text = new TextEncoder().encode(JSON.stringify(json)),
    len = (text.length + 3) & ~3,
    bytes = new ArrayBuffer(28 + len + bin.length),
    v = new DataView(bytes),
    out = new Uint8Array(bytes);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, bytes.byteLength, true);
  v.setUint32(12, len, true);
  v.setUint32(16, 0x4e4f534a, true);
  out.fill(32, 20, 20 + len);
  out.set(text, 20);
  v.setUint32(20 + len, bin.length, true);
  v.setUint32(24 + len, 0x004e4942, true);
  out.set(bin, 28 + len);
  g.dispose();
  return bytes;
}
