import type { Manifold, ManifoldToplevel, CrossSection } from 'manifold-3d';
import type { GeometryRecipe } from '../model';

export type BuildingRecipe = Extract<GeometryRecipe, { kind: 'building' }>;
export type SolidPart = {
  material: 'solid' | 'glass' | 'frame';
  solid: Manifold;
};

// All parts are actual closed Manifold solids, in the source's local frame.
// A separate glass material changes appearance, not the underlying geometry.
export function buildingParts(
  m: ManifoldToplevel,
  source: Manifold,
  recipe: BuildingRecipe,
  keep: (solid: Manifold) => Manifold,
): SolidPart[] {
  const { width: w, height: h, depth: d } = recipe.base;
  const { floors, slabThickness: t, mullionWidth: mw } = recipe;
  if (h / floors < t + 0.3)
    throw new Error('There is not enough height between these floor slabs.');
  const band = (y: number, height: number) =>
    keep(
      keep(m.Manifold.cube([w + 2, height, d + 2])).translate([
        -w / 2 - 1,
        y,
        -d / 2 - 1,
      ]),
    );
  const slabBands = Array.from({ length: floors }, (_, i) =>
    band((i * h) / floors, t),
  );
  slabBands.push(band(h - t, t));
  const slabs = keep(source.intersect(keep(m.Manifold.union(slabBands))));
  const result: SolidPart[] = [{ material: 'solid', solid: slabs }];
  if (!recipe.facade) return result;

  const sections: CrossSection[] = [];
  const section = (s: CrossSection) => {
    sections.push(s);
    return s;
  };
  try {
    const upright = keep(source.rotate([90, 0, 0]));
    const footprint = section(upright.slice(h / 2));
    // Uniform vertical envelopes support genuine panelized curtain walls.
    // Reject sloping/curved-in-height forms instead of fabricating a facade.
    for (const y of [0.001, h * 0.25, h * 0.75, h - 0.001]) {
      const other = section(upright.slice(y));
      const difference =
        section(footprint.subtract(other)).area() +
        section(other.subtract(footprint)).area();
      if (difference > Math.max(1e-5, footprint.area() * 1e-5))
        throw new Error(
          'Curtain walls currently need a vertical, constant footprint. Slabs alone can follow this solid.',
        );
    }
    const inset = section(footprint.offset(-Math.max(0.12, mw * 2), 'Miter'));
    if (inset.isEmpty())
      throw new Error('This footprint is too narrow for curtain-wall frames.');
    const frameSection = section(footprint.subtract(inset));
    const extrude = (s: CrossSection, height: number, y = 0) =>
      keep(
        keep(keep(s.extrude(height)).rotate([-90, 0, 0])).translate([0, y, 0]),
      );
    const columns: Manifold[] = [];
    let count = 0;
    for (const polygon of footprint.toPolygons()) {
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i],
          b = polygon[(i + 1) % polygon.length];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const divisions = Math.max(1, Math.ceil(length / recipe.panelWidth));
        if ((count += divisions) > 800)
          throw new Error(
            'Use wider curtain-wall panels for this footprint (maximum 800 frames).',
          );
        for (let j = 0; j < divisions; j++) {
          const u = j / divisions;
          const x = a[0] + (b[0] - a[0]) * u;
          const z = -(a[1] + (b[1] - a[1]) * u);
          columns.push(
            keep(
              keep(m.Manifold.cube([mw * 2, h, mw * 2])).translate([
                x - mw,
                0,
                z - mw,
              ]),
            ),
          );
        }
      }
    }
    for (let i = 0; i <= floors; i++)
      columns.push(
        extrude(frameSection, mw, Math.min(h - mw, (i * h) / floors)),
      );
    const frames = keep(
      keep(source.intersect(keep(m.Manifold.union(columns)))).subtract(slabs),
    );
    const outerGlass = section(footprint.offset(-0.02, 'Miter'));
    const innerGlass = section(footprint.offset(-0.06, 'Miter'));
    const glassRing = section(outerGlass.subtract(innerGlass));
    const glass = keep(
      keep(
        keep(extrude(glassRing, h).intersect(source)).subtract(slabs),
      ).subtract(frames),
    );
    result.push(
      { material: 'frame', solid: frames },
      { material: 'glass', solid: glass },
    );
    return result;
  } finally {
    sections.reverse().forEach((s) => s.delete());
  }
}
