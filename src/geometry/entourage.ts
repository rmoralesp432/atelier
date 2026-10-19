import type { Manifold, ManifoldToplevel } from 'manifold-3d';

// Original architectural cutout drawings. Y is up; silhouettes remain legible
// without a texture download, including exports and offline/AR viewing.
const modulor: [number, number][] = [
  [-0.31, 0],
  [-0.08, 0],
  [-0.07, 0.025],
  [-0.15, 0.04],
  [-0.12, 0.26],
  [-0.025, 0.43],
  [0.045, 0.4],
  [0.12, 0.21],
  [0.13, 0.035],
  [0.1, 0],
  [0.32, 0],
  [0.33, 0.025],
  [0.24, 0.05],
  [0.23, 0.26],
  [0.15, 0.48],
  [0.13, 0.6],
  [0.2, 0.66],
  [0.29, 0.73],
  [0.33, 0.84],
  [0.34, 0.94],
  [0.38, 0.965],
  [0.37, 1],
  [0.3, 1],
  [0.28, 0.97],
  [0.26, 0.94],
  [0.25, 0.83],
  [0.2, 0.75],
  [0.12, 0.7],
  [0.05, 0.7],
  [0.04, 0.735],
  [0.1, 0.755],
  [0.105, 0.79],
  [0.07, 0.81],
  [-0.01, 0.81],
  [-0.065, 0.79],
  [-0.065, 0.755],
  [-0.025, 0.735],
  [-0.035, 0.7],
  [-0.12, 0.69],
  [-0.18, 0.65],
  [-0.26, 0.55],
  [-0.32, 0.5],
  [-0.35, 0.47],
  [-0.32, 0.455],
  [-0.28, 0.47],
  [-0.23, 0.5],
  [-0.15, 0.58],
  [-0.115, 0.6],
  [-0.1, 0.5],
  [-0.16, 0.4],
  [-0.23, 0.25],
  [-0.24, 0.045],
  [-0.32, 0.025],
];
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
    kind === 'person'
      ? modulor.map(([x, y]) => [(x + 0.35) / 0.73 - 0.5, y])
      : crown;
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
