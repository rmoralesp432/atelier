import { MAX_IMPORT_BYTES, MAX_IMPORT_TRIANGLES, type MeshAsset } from './mesh';

/** Stream source text without OBJLoader's expanded normals/UVs/face arrays.
 * Full-detail indices are retained; only optional import copies are simplified. */
export async function readOBJFile(
  file: Blob & { name: string },
  progress: (s: string) => void = () => {},
): Promise<MeshAsset> {
  if (file.size > MAX_IMPORT_BYTES)
    throw new Error('Import files must be 512 MB or smaller.');
  const positions: number[] = [],
    indices: number[] = [];
  const decoder = new TextDecoder();
  let pending = '',
    read = 0,
    skippingComment = false;
  const line = (raw: string) => {
    const text = raw.trim();
    if (!text || text.startsWith('#')) return;
    const fields = text.split(/\s+/);
    if (fields[0] === 'v') {
      const p = fields.slice(1, 4).map(Number);
      if (p.length !== 3 || !p.every(Number.isFinite))
        throw new Error('Invalid OBJ vertex.');
      positions.push(...p);
      if (positions.length > MAX_IMPORT_TRIANGLES * 9)
        throw new Error('Too many OBJ vertices for full-detail editing.');
    } else if (fields[0] === 'f') {
      const vertices = fields
        .slice(1, fields.indexOf('#') > 0 ? fields.indexOf('#') : undefined)
        .map((field) => {
          const raw = Number(field.split('/')[0]);
          const index = raw < 0 ? positions.length / 3 + raw : raw - 1;
          if (
            !Number.isInteger(raw) ||
            raw === 0 ||
            index < 0 ||
            index >= positions.length / 3
          )
            throw new Error('Invalid OBJ face index.');
          return index;
        });
      if (vertices.length < 3)
        throw new Error('An OBJ face needs at least three vertices.');
      for (let j = 1; j < vertices.length - 1; j++)
        indices.push(vertices[0], vertices[j], vertices[j + 1]);
      if (indices.length > MAX_IMPORT_TRIANGLES * 3)
        throw new Error(
          'Full detail supports 5,000,000 triangles. Choose Balanced or Phone detail to reduce a copy.',
        );
    }
  };
  // Blob slices also work on Safari versions without streaming TextDecoderStream.
  for (let offset = 0; offset < file.size; offset += 1024 * 1024) {
    const bytes = await file.slice(offset, offset + 1024 * 1024).arrayBuffer();
    read += bytes.byteLength;
    let text = decoder.decode(bytes, { stream: true });
    if (skippingComment) {
      const end = text.indexOf('\n');
      skippingComment = end < 0;
      text = end < 0 ? '' : text.slice(end + 1);
    }
    if (!skippingComment) {
      pending += text;
      let start = 0,
        end: number;
      while ((end = pending.indexOf('\n', start)) !== -1) {
        line(pending.slice(start, end));
        start = end + 1;
      }
      pending = pending.slice(start);
      // OBJ exporters may write megabytes of metadata on one comment line.
      // Discard it incrementally instead of retaining or rejecting that file.
      if (pending.trimStart().startsWith('#')) {
        pending = '';
        skippingComment = true;
      } else if (pending.length > 2_000_000) {
        throw new Error('An OBJ geometry line is too long.');
      }
    }
    progress(
      `Reading full-detail OBJ · ${Math.round((read / file.size) * 100)}%`,
    );
  }
  const finalText = decoder.decode();
  if (!skippingComment) line(pending + finalText);
  if (!indices.length)
    throw new Error('No triangle surfaces were found in this file.');
  return {
    name: file.name.replace(/\.[^.]+$/, '').slice(0, 70),
    format: 'obj',
    positions,
    indices,
    sourceTriangles: indices.length / 3,
    detail: 'full',
  };
}
