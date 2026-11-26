import { renderMeshData } from './kernel';
import { isFlat } from './spatial';
import { isVisible, type Project } from '../model';
// OBJ has no standard units declaration: explicit meter comment and unchanged
// numeric coordinates retain project scale. No proprietary CAD/BIM claims.
export async function exportObj(project: Project): Promise<string> {
  const lines = [
    '# ATELIER geometry export',
    '# Units: meters. Coordinates: Y up; project north -Z.',
    '# Visible objects and the current building representation.',
    '# Import at 1 unit = 1 meter. Profiles must be extruded to export as solids.',
  ];
  let offset = 1,
    count = 0;
  for (const v of project.volumes.filter((v) => isVisible(v, project))) {
    if (isFlat(v)) continue;
    const angle = (v.rotation * Math.PI) / 180,
      c = Math.cos(angle),
      s = Math.sin(angle),
      parts = await renderMeshData(v);
    for (let p = 0; p < parts.length; p++) {
      const part = parts[p];
      lines.push(`o ${v.name.replace(/[^\p{L}\p{N}_-]/gu, '_')}_${p + 1}`);
      for (let i = 0; i < part.positions.length; i += 3) {
        const x = part.positions[i],
          y = part.positions[i + 1],
          z = part.positions[i + 2];
        lines.push(
          `v ${(x * c + z * s + v.position.x).toFixed(6)} ${(y + v.position.y).toFixed(6)} ${(-x * s + z * c + v.position.z).toFixed(6)}`,
        );
      }
      lines.push('s off');
      for (let i = 0; i < part.indices.length; i += 3)
        lines.push(
          `f ${part.indices[i] + offset} ${part.indices[i + 1] + offset} ${part.indices[i + 2] + offset}`,
        );
      offset += part.positions.length / 3;
      count++;
    }
  }
  if (!count)
    throw new Error(
      'There is no visible 3D geometry to export. Show a layer or extrude a profile first.',
    );
  return lines.join('\n') + '\n';
}
