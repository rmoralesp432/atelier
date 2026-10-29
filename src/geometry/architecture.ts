import type { Manifold, ManifoldToplevel, CrossSection } from 'manifold-3d';
import type { GeometryRecipe } from '../model';

export function fixedWindowLayout(
  length: number,
  width: number,
  mullion: number,
) {
  const pitch = width + 2 * mullion,
    count = Math.floor((length - 2 * mullion) / pitch);
  if (count < 1)
    throw new Error(
      'That facade edge cannot fit a full fixed-width window. Use a smaller window or release the width constraint.',
    );
  return { count, pitch, infill: (length - (count * pitch + 2 * mullion)) / 2 };
}

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
  separate = false,
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
  const result: SolidPart[] = separate
    ? slabs
        .decompose()
        .map((solid) => ({ material: 'solid', solid: keep(solid) }))
    : [{ material: 'solid', solid: slabs }];
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
        const pitch =
          recipe.fixedWindowWidth === undefined
            ? null
            : recipe.fixedWindowWidth + 2 * mw;
        const layout =
          recipe.fixedWindowWidth === undefined
            ? null
            : fixedWindowLayout(length, recipe.fixedWindowWidth, mw);
        const divisions =
          layout?.count ?? Math.max(1, Math.ceil(length / recipe.panelWidth));
        if (divisions < 1)
          throw new Error(
            'That facade edge cannot fit a full fixed-width window. Use a smaller window or release the width constraint.',
          );
        if ((count += divisions + 1) > 800)
          throw new Error(
            'Use wider curtain-wall panels for this footprint (maximum 800 frames).',
          );
        const remainder = layout?.infill ?? 0;
        const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
        const strip = (center: number, width: number) => {
          const u = center / length,
            x = a[0] + (b[0] - a[0]) * u,
            z = -(a[1] + (b[1] - a[1]) * u);
          let part = keep(m.Manifold.cube([width, h, Math.max(0.3, mw * 4)]));
          part = keep(
            part.translate([-width / 2, 0, -Math.max(0.3, mw * 4) / 2]),
          );
          part = keep(part.rotate([0, angle, 0]));
          columns.push(keep(part.translate([x, 0, z])));
        };
        if (pitch) {
          if (remainder > 1e-6) {
            strip(remainder / 2, remainder);
            strip(length - remainder / 2, remainder);
          }
          for (let j = 0; j <= divisions; j++)
            strip(remainder + mw + j * pitch, 2 * mw);
        } else
          for (let j = 0; j < divisions; j++)
            strip((j * length) / divisions, 2 * mw);
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
    if (separate) {
      if (columns.length > 180)
        throw new Error(
          'Use wider panels or fewer floors before editing components (maximum 180 frame members).',
        );
      // Partition the actual evaluated frame, avoiding overlapping members.
      let remaining = frames;
      for (const column of columns) {
        const member = keep(remaining.intersect(column));
        if (!member.isEmpty()) {
          for (const solid of member.decompose())
            result.push({ material: 'frame', solid: keep(solid) });
          remaining = keep(remaining.subtract(member));
        }
      }
      if (!remaining.isEmpty())
        for (const solid of remaining.decompose())
          result.push({ material: 'frame', solid: keep(solid) });
      for (const solid of glass.decompose())
        result.push({ material: 'glass', solid: keep(solid) });
    } else
      result.push(
        { material: 'frame', solid: frames },
        { material: 'glass', solid: glass },
      );
    return result;
  } finally {
    sections.reverse().forEach((s) => s.delete());
  }
}
