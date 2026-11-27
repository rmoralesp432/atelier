/** Known starting models/controls for offline calibration and labeled diagnostics only. */
import { newSession, type Session } from '../../src/intelligence/engine';
import type { Volume } from '../../src/model';
import {
  K,
  asVolume,
  axial,
  box,
  mapSolid,
  subtract,
  vertical,
  direction,
  rad,
  type V3,
} from './geometry';

export const group = {
  id: 'phase3-marker-group',
  name: 'Existing independent samples',
  visible: true,
  locked: false,
};
export function seed(episode: string): Session {
  const markers = [
    asVolume(box(0.62, 0.91, 0.47, 8, 0, 6), 'marker-box', 'Existing sample'),
    asVolume(
      mapSolid(vertical(0.7, 0.14), (s) => s.translate([6, 0, -5])),
      'marker-post',
      'Independent support sample',
    ),
  ];
  markers.forEach((v) => {
    v.groupId = group.id;
    v.materialSpec = 'ceramic';
  });
  if (episode === 'F')
    markers.push(
      asVolume(
        box(0.7, 0.9, 0.5, 3, 0, 0),
        'calibration-block',
        'Calibration block',
      ),
    );
  return newSession({ volumes: markers, groups: [group], selectedId: null });
}
export function ring(length: number, center: V3) {
  return subtract(
    axial(length, 0.25, 29, center),
    axial(length + 0.02, 0.14, 29, center),
  );
}
export function lantern() {
  const h = 1.4,
    r = (y: number) => 0.55 - (0.18 * y) / h;
  const shear = [1, 0, 0, 0, 0.22 / h, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as any;
  return mapSolid(
    subtract(
      vertical(h, 0.55, 0.37),
      mapSolid(
        vertical(h - 0.08 + 0.02, r(0.08) - 0.06, r(h + 0.02) - 0.06),
        (s) => s.translate([0, 0.08, 0]),
      ),
    ),
    (s) => s.transform(shear),
  );
}
export function openingProbe(radius = 0.08) {
  return mapSolid(K.Manifold.cylinder(0.7, radius, radius, 128), (s) =>
    s.translate([(0.22 * 0.6) / 1.4, 0.6, -0.75]),
  );
}
export function wedge() {
  return K.Manifold.hull([
    [-0.65, 0, -0.3],
    [-0.65, 0, 0.3],
    [0.65, 0, -0.3],
    [0.65, 0, 0.3],
    [-0.65, 0.2, -0.3],
    [-0.65, 0.2, 0.3],
    [0.65, 0.55, -0.3],
    [0.65, 0.55, 0.3],
  ]);
}
export function arrayPoints(pitch: number): V3[] {
  const a = rad(31);
  return Array.from({ length: 10 }, (_, k) => {
    const j = Math.floor(k / 5),
      i = k % 5,
      x = (i - 2) * pitch + ((j - 0.5) * pitch) / 2,
      z = (j - 0.5) * 0.64;
    return [
      x * Math.cos(a) - z * Math.sin(a),
      0,
      x * Math.sin(a) + z * Math.cos(a),
    ];
  });
}
export function fixture(id: string): Volume[] {
  const e = id[0],
    edit = id.endsWith('2');
  const p: Volume[] = [];
  const add = (s: any, name: string, material = 'solid', spec?: string) => {
    const v = asVolume(s, `${e}-${name}`, name);
    v.material = material as any;
    if (spec) v.materialSpec = spec;
    p.push(v);
    return v;
  };
  if (e === 'A') {
    const clear = edit ? 3.25 : 2.7,
      roof = 0.18 + clear;
    add(box(4.8, 0.18, 3.2), 'Platform');
    add(box(4.8, 0.16, 3.2, 0, roof), 'Roof');
    for (const x of [-2.1, 2.1])
      for (const z of [-1.3, 1.3])
        add(
          mapSolid(vertical(clear, 0.08), (s) => s.translate([x, 0.18, z])),
          `Post ${x} ${z}`,
        );
    for (const x of [-2.4, 2.4])
      add(box(0.012, clear, 3.2, x, 0.18, 0), `Side glazing ${x}`, 'glass');
  } else if (e === 'B') {
    const w = edit ? 2.5 : 2.1,
      legX = w / 2 - 0.16;
    add(box(w, 0.06, 0.75, 0, 0.84), 'Top', 'solid', 'oak');
    for (const x of [-legX, legX])
      for (const z of [-0.215, 0.215])
        add(
          box(0.08, 0.84, 0.08, x, 0, z),
          `Leg ${Math.sign(x)} ${Math.sign(z)}`,
          'solid',
          'timber',
        );
    for (const z of [-0.215, 0.215])
      add(
        box(w - 0.4, 0.12, 0.05, 0, 0.72, z),
        `Apron ${z}`,
        'solid',
        'timber',
      );
  } else if (e === 'C') {
    const d = direction(29),
      at = (t: number): V3 => [d[0] * t, 0.8, d[2] * t];
    add(ring(0.16, at(-0.45)), 'Southwest bushing', 'solid', 'POM');
    add(ring(0.16, at(edit ? 0.7 : 0.45)), 'Northeast bushing', 'solid', 'POM');
    add(
      axial(edit ? 1.55 : 1.3, 0.12, 29, at(edit ? 0.125 : 0)),
      'Shaft',
      'solid',
      'stainless steel',
    );
  } else if (e === 'D')
    add(edit ? subtract(lantern(), openingProbe()) : lantern(), 'Lantern');
  else if (e === 'E')
    for (const [i, pos] of arrayPoints(edit ? 0.9 : 0.72).entries())
      add(
        mapSolid(
          vertical(0.46, 0.3 / Math.sqrt(3), 0.3 / Math.sqrt(3), 6),
          (s) => s.translate(pos),
        ),
        `Prism ${i + 1}`,
      );
  else if (e === 'F' && edit)
    add(
      mapSolid(wedge(), (s) => s.translate([-2, 0, 0])),
      'Wedge',
    );
  return p;
}
export function assembled(id: string): Session {
  const original = seed(id[0]);
  return newSession({
    ...original.project,
    volumes: [...original.project.volumes, ...fixture(id)],
    selectedId: null,
  });
}
