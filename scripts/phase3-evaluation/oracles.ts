/** Independent outcome measurements; no application verifier imports. */
import type { Manifold } from 'manifold-3d';
import type { Session } from '../../src/intelligence/engine';
import { equalData } from '../../src/projects/equalData';
import { isLocked, isVisible, type Volume } from '../../src/model';
import { arrayPoints, fixture, lantern, openingProbe, wedge } from './fixtures';
import {
  K,
  box,
  cloneSolid,
  difference,
  direction,
  frame,
  hull,
  intersect,
  length,
  localToWorld,
  mapSolid,
  near,
  overlap,
  rad,
  sameSolid,
  sections,
  stats,
  subtract,
  union,
  vertical,
  vertices,
  worldToLocal,
  type Frame,
} from './geometry';

export type Fact = {
  name: string;
  status: 'verified' | 'incorrect' | 'unverified';
  expected?: unknown;
  actual?: unknown;
};
export const passed = (facts: Fact[]) =>
  facts.length > 0 && facts.every((f) => f.status === 'verified');
export const incorrect = (facts: Fact[]) =>
  facts.some((f) => f.status === 'incorrect');
type Part = { v: Volume; s: Manifold; data: ReturnType<typeof stats> };
export async function oracle(
  id: string,
  seed: Session,
  before: Session,
  after: Session,
): Promise<Fact[]> {
  const facts: Fact[] = [],
    owned: Manifold[] = [];
  const keep = (s: Manifold) => {
    owned.push(s);
    return s;
  };
  const add = (
    name: string,
    ok: boolean,
    expected?: unknown,
    actual?: unknown,
  ) =>
    facts.push({
      name,
      status: ok ? 'verified' : 'incorrect',
      expected,
      actual,
    });
  const unknown = (name: string, actual: unknown) =>
    facts.push({ name, status: 'unverified', actual });
  const protectedIds = new Set(seed.project.volumes.map((v) => v.id));
  const editing = id.endsWith('2') && id[0] !== 'F';
  const originalTargets = before.project.volumes.filter(
    (v) => !protectedIds.has(v.id),
  );
  const ids = editing
    ? new Set(originalTargets.map((v) => v.id))
    : new Set(
        after.project.volumes
          .filter((v) => !before.project.volumes.some((o) => o.id === v.id))
          .map((v) => v.id),
      );
  const targets = after.project.volumes.filter((v) => ids.has(v.id));
  add(
    'Unrelated objects preserved exactly',
    before.project.volumes
      .filter((v) => !editing || !ids.has(v.id))
      .every((v) =>
        equalData(
          v,
          after.project.volumes.find((n) => n.id === v.id),
        ),
      ),
  );
  add(
    'Protected group metadata preserved',
    seed.project.groups?.every((g) =>
      equalData(
        g,
        after.project.groups?.find((n) => n.id === g.id),
      ),
    ) ?? true,
  );
  add(
    'Scene identities unique',
    new Set(after.project.volumes.map((v) => v.id)).size ===
      after.project.volumes.length,
  );
  if (id === 'F1') {
    add(
      'Contradictory dimensions cause no model commit',
      equalData(before.project, after.project) &&
        equalData(before.past, after.past) &&
        equalData(before.future, after.future),
    );
    return facts;
  }
  add('Required geometry exists', targets.length > 0);
  add(
    'Independent selectable visible objects',
    targets.every(
      (v) => !isLocked(v, after.project) && isVisible(v, after.project),
    ),
  );
  if (editing) {
    add(
      'Original assembly identities retained, no substitutes',
      after.project.volumes.length === before.project.volumes.length &&
        originalTargets.every((v) => targets.some((n) => n.id === v.id)),
    );
    for (const v of originalTargets) {
      const n = targets.find((n) => n.id === v.id);
      add(
        `Retained designation and visibility: ${v.id}`,
        !!n &&
          v.material === n.material &&
          v.materialSpec === n.materialSpec &&
          v.visible === n.visible,
      );
    }
  }
  try {
    const parts: Part[] = [];
    for (const v of targets) {
      const s = keep(await cloneSolid(v)),
        data = stats(s);
      parts.push({ v, s, data });
      add(
        `Closed positive solid and independent mesh volume: ${v.id}`,
        data.volume > 0 &&
          Math.abs(data.volume - data.triangleVolume) <=
            Math.max(1e-8, data.volume * 1e-5),
        data.volume,
        data.triangleVolume,
      );
    }
    const closeSolid = (
      name: string,
      s: Manifold,
      expected: Manifold,
      relative = 0.001,
    ) => {
      keep(expected);
      const d = difference(s, expected);
      add(
        name,
        sameSolid(s, expected, relative),
        {
          bounds: stats(expected).bounds,
          volume: expected.volume(),
          relativeTolerance: relative,
        },
        { bounds: stats(s).bounds, volume: s.volume(), symmetricDifference: d },
      );
    };
    if (id[0] === 'A' || id[0] === 'B') {
      const e = id[0];
      // Infer the frame from an actual occupied horizontal plate, not its name/recipe.
      const plateCandidates = parts.filter(
        (p) => p.data.size[1] <= 0.3 && p.data.size[0] * p.data.size[2] > 1,
      );
      const anchor =
        e === 'A'
          ? plateCandidates.sort(
              (a, b) => a.data.bounds.min[1] - b.data.bounds.min[1],
            )[0]
          : plateCandidates.sort(
              (a, b) => b.data.bounds.max[1] - a.data.bounds.max[1],
            )[0];
      if (!anchor) {
        add('Requested horizontal platform/tabletop exists', false);
        return facts;
      }
      const f = frame(anchor.s),
        local = parts.map((p) => ({ ...p, s: keep(worldToLocal(p.s, f)) }));
      for (const p of local) p.data = stats(p.s);
      if (e === 'A') {
        const clear = editing ? 3.25 : 2.7,
          roof = 0.18 + clear;
        const platforms = local.filter(
          (p) =>
            near(p.data.bounds.min[1], 0) &&
            p.data.size[1] <= 0.3 &&
            p.data.size[0] * p.data.size[2] > 1,
        );
        const roofs = local.filter(
          (p) =>
            p.data.bounds.min[1] > 1 &&
            p.data.size[1] <= 0.3 &&
            p.data.size[0] * p.data.size[2] > 1,
        );
        if (platforms.length)
          closeSolid(
            'Platform occupied footprint and thickness',
            keep(union(platforms.map((p) => p.s.translate([0, 0, 0])))),
            box(4.8, 0.18, 3.2),
          );
        else add('Platform exists', false);
        if (roofs.length)
          closeSolid(
            'Roof occupied footprint, thickness and underside',
            keep(union(roofs.map((p) => p.s.translate([0, 0, 0])))),
            box(4.8, 0.16, 3.2, 0, roof),
          );
        else add('Roof exists', false);
        const matched = new Set<string>();
        for (const x of [-2.1, 2.1])
          for (const z of [-1.3, 1.3]) {
            const expected = keep(
              mapSolid(vertical(clear, 0.08), (s) => s.translate([x, 0.18, z])),
            );
            const match = local.find(
              (p) => !matched.has(p.v.id) && sameSolid(p.s, expected, 0.02),
            );
            add(
              `Circular connected support at ${x},${z}`,
              !!match,
              { diameter: 0.16, bottom: 0.18, top: roof },
              match?.data,
            );
            if (match) matched.add(match.v.id);
          }
        add('Four distinct supports', matched.size === 4, 4, matched.size);
        const glass = local.filter((p) => p.v.material === 'glass');
        for (const side of [-1, 1]) {
          const panes = glass.filter(
            (p) => Math.sign(p.data.center[0]) === side,
          );
          add(`Side ${side}: glazing exists`, panes.length > 0);
          if (!panes.length) continue;
          const combined = keep(
              union(panes.map((p) => p.s.translate([0, 0, 0]))),
            ),
            d = stats(combined);
          // Aligning to inset columns or to the platform edge are both valid enclosures.
          add(
            `Side ${side}: floor-to-roof glazing span`,
            near(d.bounds.min[1], 0.18, 0.003) &&
              near(d.bounds.max[1], roof, 0.003) &&
              d.size[2] >= 2.6 - 0.003 &&
              d.size[2] <= 3.2 + 0.03 &&
              Math.abs(d.center[0]) >= 2.1 - 0.02 &&
              Math.abs(d.center[0]) <= 2.4 + 0.02,
            { bottom: 0.18, top: roof, minimumDepth: 2.6 },
            d,
          );
          let hits = 0;
          for (const yf of [0.1, 0.3, 0.5, 0.7, 0.9])
            for (const z of [-1.1, -0.55, 0, 0.55, 1.1])
              if (
                combined.rayCast(
                  [-3, 0.18 + yf * clear, z],
                  [3, 0.18 + yf * clear, z],
                ).length
              )
                hits++;
          add(
            `Side ${side}: continuous side-enclosure samples`,
            hits === 25,
            25,
            hits,
          );
        }
        const otherOpaque = local.filter(
          (p) =>
            p.v.material !== 'glass' &&
            !platforms.includes(p) &&
            !roofs.includes(p) &&
            !matched.has(p.v.id),
        );
        const interior = box(3.8, clear - 0.1, 2.2, 0, 0.23, 0);
        const occupied = otherOpaque.length
          ? overlap(
              keep(union(otherOpaque.map((p) => p.s.translate([0, 0, 0])))),
              interior,
            )
          : (interior.delete(), 0);
        add('Canopy central space remains open', occupied < 1e-6, 0, occupied);
        const enclosure = keep(
          union(
            local
              .filter((p) => !platforms.includes(p) && !roofs.includes(p))
              .map((p) => p.s.translate([0, 0, 0])),
          ),
        );
        let frontBackHits = 0;
        for (const x of [-1.8, -0.9, 0, 0.9, 1.8])
          for (const yf of [0.25, 0.5, 0.75])
            if (
              enclosure.rayCast(
                [x, 0.18 + yf * clear, -2],
                [x, 0.18 + yf * clear, 2],
              ).length
            )
              frontBackHits++;
        add(
          'Front and back remain open',
          frontBackHits === 0,
          0,
          frontBackHits,
        );
        if (editing) {
          const old = before.project.volumes.find((v) => v.id === anchor.v.id);
          add('Platform model data unchanged', equalData(old, anchor.v));
        }
      } else {
        const width = editing ? 2.5 : 2.1,
          top = local.find((p) => p.v.id === anchor.v.id)!;
        add(
          'Seven separately editable bench parts',
          parts.length === 7,
          7,
          parts.length,
        );
        closeSolid(
          'Top dimensions and working height',
          top.s,
          box(width, 0.06, 0.75, 0, 0.84),
        );
        add(
          'Oak assigned explicitly',
          /\boak\b/i.test(top.v.materialSpec ?? ''),
          'oak',
          top.v.materialSpec,
        );
        const legIds = new Set<string>(),
          legX = width / 2 - 0.16;
        for (const x of [-legX, legX])
          for (const z of [-0.215, 0.215]) {
            const target = keep(box(0.08, 0.84, 0.08, x, 0, z)),
              p = local.find(
                (p) => !legIds.has(p.v.id) && sameSolid(p.s, target),
              );
            add(`Leg section, setback and elevation ${x},${z}`, !!p);
            if (p) legIds.add(p.v.id);
          }
        const legs = local.filter((p) => legIds.has(p.v.id)),
          rails = local.filter(
            (p) => p.v.id !== top.v.id && !legIds.has(p.v.id),
          );
        add('Two long connecting rails', rails.length === 2, 2, rails.length);
        add(
          'Both end-frame leg pairs connected',
          legs.length === 4 &&
            legs.every((l) =>
              rails.some((r) => r.s.minGap(l.s, 0.02) <= 0.003),
            ),
        );
        if (rails.length === 2)
          add(
            'Apron rails are not duplicated occupied solids',
            overlap(rails[0].s, rails[1].s.translate([0, 0, 0])) < 1e-8,
          );
        for (const p of rails) {
          const connections = legs.filter(
            (l) => p.s.minGap(l.s, 0.02) <= 0.003,
          );
          add(
            `Rail ${p.v.id}: connects both end frames under top`,
            connections.some((l) => l.data.center[0] < 0) &&
              connections.some((l) => l.data.center[0] > 0) &&
              p.data.bounds.max[1] <= 0.843 &&
              p.s.minGap(top.s, 0.02) <= 0.003,
            undefined,
            connections.map((l) => l.v.id),
          );
          if (editing) {
            const old = originalTargets.find((v) => v.id === p.v.id);
            if (old) {
              const o = keep(worldToLocal(keep(await cloneSolid(old)), f)),
                d = stats(o);
              add(
                `Rail ${p.v.id}: original section and height`,
                near(p.data.size[1], d.size[1]) &&
                  near(p.data.size[2], d.size[2]) &&
                  near(p.data.center[1], d.center[1]),
              );
            }
          }
        }
      }
      if (editing) {
        const prior = originalTargets.find((v) => v.id === anchor.v.id);
        if (prior) {
          const old = keep(await cloneSolid(prior)),
            d = stats(old);
          add(
            'Assembly horizontal datum unchanged',
            near(anchor.data.center[0], d.center[0]) &&
              near(anchor.data.center[2], d.center[2]),
          );
        }
      }
    } else if (id[0] === 'C') {
      const ideal = fixture(id),
        used = new Set<string>();
      add(
        'Three independent mechanical parts',
        parts.length === 3,
        3,
        parts.length,
      );
      for (const v of ideal) {
        const target = keep(await cloneSolid(v));
        const match = parts.find(
          (p) => !used.has(p.v.id) && sameSolid(p.s, target, 0.02),
        );
        add(
          `Intrinsic occupied geometry, bore, axis and placement: ${v.name}`,
          !!match,
          stats(target),
          match?.data,
        );
        if (match) {
          used.add(match.v.id);
          add(
            `Material designation: ${v.name}`,
            (match.v.materialSpec ?? '').toLowerCase() ===
              (v.materialSpec ?? '').toLowerCase(),
            v.materialSpec,
            match.v.materialSpec,
          );
        }
      }
      const d = direction(29),
        axis = parts.map((p) => ({
          p,
          t: p.data.center[0] * d[0] + p.data.center[2] * d[2],
        }));
      if (editing) {
        const fixed = originalTargets
          .map((v) => ({ v, t: v.position.x * d[0] + v.position.z * d[2] }))
          .sort((a, b) => a.t - b.t)[0];
        add(
          'Southwest bushing unchanged exactly',
          !!fixed &&
            equalData(
              fixed.v,
              after.project.volumes.find((v) => v.id === fixed.v.id),
            ),
        );
      }
      for (let i = 0; i < parts.length; i++)
        for (let j = i + 1; j < parts.length; j++)
          add(
            `Mechanical parts ${i}/${j}: no interpenetration`,
            overlap(parts[i].s, parts[j].s.translate([0, 0, 0])) < 1e-8,
          );
    } else if (id[0] === 'D') {
      add(
        'One solid shell, no leftover cutter',
        parts.length === 1,
        1,
        parts.length,
      );
      if (parts.length !== 1) return facts;
      const p = parts[0],
        expected = keep(
          editing ? subtract(lantern(), openingProbe()) : lantern(),
        );
      closeSolid(
        'Offset tapered shell occupied geometry',
        p.s,
        expected.translate([0, 0, 0]),
        0.02,
      );
      const heights = editing
        ? [0.04, 0.12, 0.3, 0.9, 1.2, 1.38]
        : [0.04, 0.12, 0.3, 0.6, 0.9, 1.2, 1.38];
      for (const section of sections(p.s, heights)) {
        const r = 0.55 - (0.18 * section.y) / 1.4,
          cx = (0.22 * section.y) / 1.4;
        const area =
          Math.PI * (r * r - (section.y > 0.08 ? (r - 0.06) ** 2 : 0));
        add(
          `Physical shell section at ${section.y}m`,
          Math.abs(section.area - area) <= area * 0.02,
          { area },
          section.area,
        );
        const radii = section.polygons.flatMap((poly) =>
          poly.map((v) => Math.hypot(v[0] - cx, v[1])),
        );
        add(
          `Profile radius and radial thickness at ${section.y}m`,
          radii.every(
            (a) =>
              near(a, r, 0.003) ||
              (section.y > 0.08 && near(a, r - 0.06, 0.003)),
          ),
          { outer: r, inner: section.y > 0.08 ? r - 0.06 : null },
          { min: Math.min(...radii), max: Math.max(...radii) },
        );
      }
      add(
        'Top is open into the cavity',
        overlap(p.s, box(0.2, 0.05, 0.2, 0.22, 1.36, 0)) < 1e-8,
      );
      if (editing) {
        add(
          'Requested front hole actually empty',
          overlap(p.s, openingProbe(0.074)) < 1e-8,
        );
        const old = keep(await cloneSolid(originalTargets[0]));
        const back = keep(box(3, 3, 1.2, 0, 0, 0.6));
        const oldBack = keep(old.intersect(back)),
          newBack = keep(p.s.intersect(back));
        add(
          'Opposite wall preserved',
          difference(oldBack, newBack) <=
            Math.max(1e-8, oldBack.volume() * 0.001),
        );
        const bottom = keep(box(3, 0.075, 3));
        add(
          'Closed base preserved',
          difference(keep(old.intersect(bottom)), keep(p.s.intersect(bottom))) <
            1e-6,
        );
      }
    } else if (id[0] === 'E') {
      add('Ten independent prisms', parts.length === 10, 10, parts.length);
      const points = arrayPoints(editing ? 0.9 : 0.72),
        used = new Set<string>();
      for (const q of points) {
        const p = parts.find(
          (p) =>
            !used.has(p.v.id) &&
            near(p.data.center[0], q[0]) &&
            near(p.data.center[2], q[2]) &&
            near(p.data.bounds.min[1], 0),
        );
        add(`Distinct array position ${q.join(',')}`, !!p);
        if (p) used.add(p.v.id);
      }
      for (const p of parts) {
        const sec = sections(p.s, [p.data.bounds.min[1] + 0.23])[0],
          poly = hull(sec.polygons.flat());
        const edges = poly.map((v, i) =>
          length([
            v[0] - poly[(i + 1) % poly.length][0],
            v[1] - poly[(i + 1) % poly.length][1],
          ]),
        );
        const cx = poly.reduce((n, p) => n + p[0], 0) / poly.length,
          cz = poly.reduce((n, p) => n + p[1], 0) / poly.length;
        const radii = poly.map((p) => Math.hypot(p[0] - cx, p[1] - cz));
        add(
          `Regular hexagonal section and height: ${p.v.id}`,
          poly.length === 6 &&
            edges.every((e) => near(e, 0.3 / Math.sqrt(3))) &&
            radii.every((r) => near(r, 0.3 / Math.sqrt(3))) &&
            near(p.data.size[1], 0.46) &&
            near(p.data.volume, (Math.sqrt(3) * 0.3 ** 2 * 0.46) / 2, 1e-5),
          { sides: 6, acrossFlats: 0.3, height: 0.46 },
          {
            sides: poly.length,
            edges,
            radii,
            height: p.data.size[1],
            volume: p.data.volume,
          },
        );
        if (editing) {
          const old = originalTargets.find((v) => v.id === p.v.id);
          if (old) {
            const s = keep(await cloneSolid(old));
            const delta = p.data.center.map((v, i) => v - stats(s).center[i]);
            add(
              `Same shape and orientation: ${p.v.id}`,
              sameSolid(p.s, keep(s.translate(delta as any))),
              undefined,
              delta,
            );
          }
        }
      }
    } else if (id === 'F2') {
      add('One new wedge', parts.length === 1, 1, parts.length);
      if (parts.length !== 1) return facts;
      const p = parts[0],
        d = p.data;
      closeSolid(
        'Sloped wedge geometry and ground datum',
        p.s,
        mapSolid(wedge(), (s) => s.translate([d.center[0], 0, d.center[2]])),
      );
      add(
        'Analytic wedge volume',
        near(d.volume, 0.2925, 0.00001),
        0.2925,
        d.volume,
      );
    } else unknown('Unknown benchmark case', id);
    return facts;
  } catch (e) {
    unknown(
      'Measurement could not be completed',
      e instanceof Error ? e.message : String(e),
    );
    return facts;
  } finally {
    owned.reverse().forEach((s) => s.delete());
  }
}
