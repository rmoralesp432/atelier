import type { Manifold, ManifoldToplevel } from 'manifold-3d';

// Original architectural cutout drawings. Y is up; silhouettes remain legible
// without a texture download, including exports and offline/AR viewing.
// Drawn in meters: head 1.83 m, raised fingertips 2.26 m. Curved contours
// retain a readable head/neck, shoulders, hands, calves and separated feet.
// This is an original scale drawing, not a traced third-party graphic.
export const scaleFigureOutline: [number, number][] = (() => {
  const points: [number, number][] = [[-0.31, 0]];
  const line = (x: number, y: number) => points.push([x, y]);
  const curve = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    x: number,
    y: number,
  ) => {
    const [sx, sy] = points[points.length - 1];
    for (let i = 1; i <= 8; i++) {
      const t = i / 8,
        u = 1 - t;
      points.push([
        u * u * u * sx +
          3 * u * u * t * ax +
          3 * u * t * t * bx +
          t * t * t * x,
        u * u * u * sy +
          3 * u * u * t * ay +
          3 * u * t * t * by +
          t * t * t * y,
      ]);
    }
  };
  line(-0.08, 0);
  curve(-0.06, 0.015, -0.09, 0.035, -0.15, 0.05);
  curve(-0.15, 0.2, -0.1, 0.42, -0.085, 0.56);
  curve(-0.06, 0.7, -0.02, 0.85, 0.005, 0.92);
  curve(0.04, 0.86, 0.08, 0.68, 0.105, 0.53);
  curve(0.12, 0.35, 0.13, 0.13, 0.14, 0.05);
  line(0.11, 0);
  line(0.34, 0);
  curve(0.36, 0.025, 0.28, 0.05, 0.235, 0.065);
  curve(0.225, 0.2, 0.25, 0.43, 0.22, 0.58);
  curve(0.205, 0.75, 0.17, 0.94, 0.15, 1.04);
  curve(0.12, 1.17, 0.17, 1.33, 0.2, 1.43);
  curve(0.27, 1.48, 0.31, 1.62, 0.335, 1.78);
  curve(0.35, 1.9, 0.355, 2.04, 0.365, 2.12);
  curve(0.39, 2.17, 0.405, 2.22, 0.39, 2.26);
  line(0.33, 2.26);
  curve(0.31, 2.24, 0.31, 2.19, 0.305, 2.13);
  curve(0.285, 2.0, 0.27, 1.87, 0.25, 1.79);
  curve(0.22, 1.66, 0.19, 1.57, 0.1, 1.53);
  line(0.065, 1.57);
  curve(0.09, 1.6, 0.105, 1.64, 0.105, 1.7);
  curve(0.105, 1.78, 0.08, 1.83, 0, 1.83);
  curve(-0.085, 1.83, -0.115, 1.78, -0.115, 1.7);
  curve(-0.115, 1.64, -0.09, 1.59, -0.065, 1.57);
  line(-0.08, 1.53);
  curve(-0.15, 1.53, -0.21, 1.48, -0.25, 1.41);
  curve(-0.3, 1.32, -0.32, 1.2, -0.385, 1.11);
  curve(-0.42, 1.08, -0.45, 1.03, -0.425, 1.005);
  curve(-0.4, 0.98, -0.365, 1.025, -0.345, 1.065);
  curve(-0.3, 1.13, -0.225, 1.25, -0.175, 1.34);
  curve(-0.16, 1.22, -0.145, 1.13, -0.15, 1.04);
  curve(-0.185, 0.88, -0.23, 0.7, -0.235, 0.56);
  curve(-0.24, 0.38, -0.225, 0.22, -0.235, 0.075);
  curve(-0.26, 0.045, -0.34, 0.03, -0.31, 0);
  points.pop(); // CrossSection closes the contour.
  const min = Math.min(...points.map(([x]) => x)),
    max = Math.max(...points.map(([x]) => x));
  return points.map(([x, y]) => [(x - min) / (max - min) - 0.5, y / 2.26]);
})();
// Branching crown with broken, angular leaf edges; no spheres or ellipsoids.
const crown: [number, number][] = [
  [-0.035, 0],
  [0.035, 0],
  [0.025, 0.35],
  [0.12, 0.44],
  [0.22, 0.46],
  [0.29, 0.5],
  [0.38, 0.49],
  [0.43, 0.55],
  [0.5, 0.57],
  [0.46, 0.61],
  [0.49, 0.66],
  [0.41, 0.69],
  [0.44, 0.74],
  [0.35, 0.75],
  [0.37, 0.8],
  [0.27, 0.82],
  [0.29, 0.87],
  [0.2, 0.86],
  [0.2, 0.92],
  [0.12, 0.91],
  [0.09, 0.97],
  [0.025, 0.95],
  [0, 1],
  [-0.06, 0.96],
  [-0.12, 0.98],
  [-0.15, 0.92],
  [-0.24, 0.94],
  [-0.22, 0.88],
  [-0.32, 0.87],
  [-0.29, 0.82],
  [-0.4, 0.81],
  [-0.38, 0.74],
  [-0.46, 0.73],
  [-0.43, 0.68],
  [-0.5, 0.65],
  [-0.46, 0.59],
  [-0.48, 0.55],
  [-0.38, 0.54],
  [-0.34, 0.48],
  [-0.27, 0.51],
  [-0.22, 0.46],
  [-0.15, 0.47],
  [-0.025, 0.35],
];
export function entourageSolid(
  m: ManifoldToplevel,
  kind: 'tree' | 'person',
  keep: (s: Manifold) => Manifold,
): Manifold {
  const points: [number, number][] =
    kind === 'person' ? scaleFigureOutline : crown;
  const section = new m.CrossSection([points]);
  try {
    // Thin extruded silhouette, centered in depth. Trees use two perpendicular
    // cutouts so they do not disappear when the camera orbits around them.
    const thickness = kind === 'tree' ? 0.018 : 1;
    const face = keep(
      keep(section.extrude(thickness)).translate([0, 0, -thickness / 2]),
    );
    if (kind === 'person') return face;
    return keep(m.Manifold.union([face, keep(face.rotate([0, 90, 0]))]));
  } finally {
    section.delete();
  }
}
