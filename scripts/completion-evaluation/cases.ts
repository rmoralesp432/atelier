// Held-out evaluation data and external geometry oracles. Never imported by
// the application, sent as implementation examples, or used to repair a model.
import { randomUUID } from 'node:crypto';
import { makeVolume, type Volume } from '../../src/model';
import { newSession, type Session } from '../../src/intelligence/engine';
import {
  booleanVolume,
  meshData,
  sharedVolume,
  solidStats,
} from '../../src/geometry/kernel';
import { equalData } from '../../src/projects/equalData';

export const specification = {
  stand: {
    x: 5,
    z: 2,
    width: 2.6,
    depth: 0.9,
    thickness: 0.12,
    upperBase: 1.44,
    diameter: 0.14,
    inset: 0.18,
    raise: 0.36,
  },
  ring: { x: 3, z: -2, radius: 1.65, count: 7, diameter: 0.22, height: 1.1 },
  plate: {
    x: 6,
    z: -3,
    width: 1.8,
    depth: 1,
    height: 0.16,
    slotWidth: 0.46,
    slotDepth: 0.28,
    slotX: 0.36,
    slotZ: -0.19,
  },
};
export const prompts = {
  stand:
    'Make a freestanding two-shelf display stand centered at x=5 m, z=2 m. Both horizontal shelves are 2.6 m wide along X, 0.9 m deep along Z and 12 cm thick. The lower shelf rests on the ground; the underside of the upper shelf is 1.44 m above ground. Four round posts, 14 cm in diameter, connect the top of the lower shelf to the underside of the upper one. Their centers are inset 18 cm from each pair of shelf edges. Make the six pieces independently editable and group them as Display stand. Keep everything that was already in the scene unchanged.',
  edit: 'Increase the clear vertical space between the display stand shelves by 36 cm: raise the upper shelf and lengthen its four posts to meet it. Keep the lower shelf, shelf thicknesses, post diameters, horizontal locations and all other objects unchanged. Modify the same six pieces rather than replacing them.',
  ring: 'Create seven separate upright round pegs, 22 cm in diameter and 1.1 m tall, resting on the ground. Space their centers equally around a circle of radius 1.65 m centered at x=3 m, z=-2 m, with one peg directly on its positive X side. Keep all existing objects unchanged.',
  plate:
    'Create one solid rectangular mounting plate, 1.8 m along X, 1 m along Z and 16 cm thick, resting on the ground and centered at x=6 m, z=-3 m. Cut a rectangular through-slot, 46 cm along X and 28 cm along Z, whose center is offset from the plate center by +36 cm in X and -19 cm in Z. Leave no cutter object behind. Preserve everything already in the scene.',
};
export type CaseId = keyof typeof prompts;
export type Evidence = {
  id: string;
  passed: boolean;
  expected: unknown;
  observed: unknown;
};
const near = (a: number, b: number, tolerance = 0.005) =>
  Math.abs(a - b) <= tolerance;
export function piece(
  name: string,
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  cylinder = false,
): Volume {
  return {
    ...makeVolume(),
    id: randomUUID(),
    name,
    position: { x, y, z },
    dimensions: { width, depth, height },
    rotation: 0,
    geometry: { kind: cylinder ? 'cylinder' : 'box' },
  };
}
export function initialSession() {
  return newSession({
    volumes: [
      piece('Existing post', -7, 0, 1, 0.4, 0.4, 1.5, true),
      piece('Existing shelf', -8, 0.6, -2, 1.8, 0.9, 0.16),
    ],
    selectedId: null,
  });
}
export function standPieces(raised = false) {
  const s = specification.stand,
    top = s.upperBase + (raised ? s.raise : 0);
  return [
    piece('Lower shelf', s.x, 0, s.z, s.width, s.depth, s.thickness),
    piece('Upper shelf', s.x, top, s.z, s.width, s.depth, s.thickness),
    ...[-1, 1].flatMap((dx) =>
      [-1, 1].map((dz) =>
        piece(
          'Display post',
          s.x + dx * (s.width / 2 - s.inset),
          s.thickness,
          s.z + dz * (s.depth / 2 - s.inset),
          s.diameter,
          s.diameter,
          top - s.thickness,
          true,
        ),
      ),
    ),
  ];
}
export function ringPieces() {
  const r = specification.ring;
  return Array.from({ length: r.count }, (_, i) =>
    piece(
      `Peg ${i + 1}`,
      r.x + r.radius * Math.cos((i * Math.PI * 2) / r.count),
      0,
      r.z - r.radius * Math.sin((i * Math.PI * 2) / r.count),
      r.diameter,
      r.diameter,
      r.height,
      true,
    ),
  );
}
export function slotProbe() {
  const p = specification.plate;
  return piece(
    'Slot probe',
    p.x + p.slotX,
    0,
    p.z + p.slotZ,
    p.slotWidth,
    p.slotDepth,
    p.height,
  );
}
export async function platePiece() {
  const p = specification.plate;
  return booleanVolume(
    piece('Mounting plate', p.x, 0, p.z, p.width, p.depth, p.height),
    slotProbe(),
    'subtract',
  );
}
export async function baked(v: Volume): Promise<Volume> {
  const mesh = await meshData(v);
  const scale = [v.dimensions.width, v.dimensions.height, v.dimensions.depth];
  return {
    ...v,
    geometry: {
      kind: 'mesh',
      positions: Array.from(mesh.positions, (n, i) => n / scale[i % 3]),
      indices: Array.from(mesh.indices),
      solid: true,
      source: 'Equivalent solid evaluation control',
    },
  };
}
export async function oracle(
  id: CaseId,
  original: Session,
  candidate: Session,
): Promise<Evidence[]> {
  const result: Evidence[] = [];
  const add = (
    id: string,
    passed: boolean,
    expected: unknown,
    observed: unknown,
  ) => result.push({ id, passed, expected, observed });
  const before = new Map(original.project.volumes.map((v) => [v.id, v]));
  const after = new Map(candidate.project.volumes.map((v) => [v.id, v]));
  const newParts = candidate.project.volumes.filter((v) => !before.has(v.id));
  let targets = newParts;
  if (id === 'edit') {
    targets = candidate.project.volumes.filter(
      (v) =>
        v.groupId === 'evaluation-stand' ||
        (original.project.volumes.find((o) => o.id === v.id)?.position.x ??
          -100) > 3,
    );
    // Classification is spatial and numerical, independent of AI roles/names.
    const originals = original.project.volumes.filter((v) => v.position.x > 3);
    add(
      'same-identities',
      originals.length === 6 &&
        targets.length === 6 &&
        originals.every((v) => after.has(v.id)) &&
        newParts.length === 0,
      originals.map((v) => v.id),
      targets.map((v) => v.id),
    );
    for (const v of originals) {
      const next = after.get(v.id);
      const expected = structuredClone(v);
      if (
        near(v.dimensions.height, specification.stand.thickness) &&
        v.position.y > 1
      )
        expected.position.y += specification.stand.raise;
      else if (v.dimensions.height > 1)
        expected.dimensions.height += specification.stand.raise;
      // Verify permitted numeric changes, not a particular retained recipe.
      add(
        `edit-${v.id}`,
        !!next &&
          (['x', 'y', 'z'] as const).every((k) =>
            near(next.position[k], expected.position[k]),
          ) &&
          Object.entries(expected.dimensions).every(([k, n]) =>
            near(next.dimensions[k as keyof typeof next.dimensions], n),
          ) &&
          next.rotation === v.rotation &&
          next.id === v.id,
        { position: expected.position, dimensions: expected.dimensions },
        next && { position: next.position, dimensions: next.dimensions },
      );
      if (v.position.y === 0)
        add('lower-shelf-preservation', equalData(v, next), v, next);
    }
  }
  const allowed = new Set(
    id === 'edit'
      ? original.project.volumes
          .filter((v) => v.position.x > 3)
          .map((v) => v.id)
      : [],
  );
  const collateral = original.project.volumes.filter(
    (v) => !allowed.has(v.id) && !equalData(v, after.get(v.id)),
  );
  add(
    'unrelated-geometry',
    collateral.length === 0,
    'All originals outside the requested edit are identical',
    collateral.map((v) => v.id),
  );
  const expected =
    id === 'stand' || id === 'edit'
      ? standPieces(id === 'edit')
      : id === 'ring'
        ? ringPieces()
        : [await platePiece()];
  add(
    'count',
    targets.length === expected.length,
    expected.length,
    targets.length,
  );
  const used = new Set<string>();
  const measured = new Map(
    await Promise.all(
      targets.map(async (v) => [v.id, await solidStats(v)] as const),
    ),
  );
  for (let i = 0; i < expected.length; i++) {
    const wanted = expected[i];
    const ideal = await solidStats(wanted);
    const found = targets.find(
      (v) =>
        !used.has(v.id) &&
        (['min', 'max'] as const).every((edge) =>
          measured
            .get(v.id)!
            .bounds[edge].every((n, j) => near(n, ideal.bounds[edge][j])),
        ),
    );
    if (!found) {
      add(
        `position-${i}`,
        false,
        ideal.bounds,
        targets.map((v) => ({ id: v.id, bounds: measured.get(v.id)!.bounds })),
      );
      continue;
    }
    used.add(found.id);
    const actual = measured.get(found.id)!;
    add(
      `solid-${i}`,
      actual.status === 'NoError' &&
        actual.volume > 0 &&
        Math.abs(actual.volume - ideal.volume) <=
          Math.max(1e-5, ideal.volume * 0.01) &&
        ['min', 'max'].every((edge) =>
          (actual.bounds[edge as 'min'] as number[]).every((n, j) =>
            near(n, ideal.bounds[edge as 'min'][j]),
          ),
        ),
      { bounds: ideal.bounds, volume: ideal.volume },
      { id: found.id, bounds: actual.bounds, volume: actual.volume },
    );
  }
  if (id === 'stand') {
    const groups = new Set(targets.map((v) => v.groupId));
    add(
      'editable-assembly',
      groups.size === 1 &&
        !!targets[0]?.groupId &&
        new Set(targets.map((v) => v.id)).size === 6,
      'Six separate pieces in one group',
      { groups: [...groups], ids: targets.map((v) => v.id) },
    );
  }
  if (id === 'plate' && targets.length === 1) {
    const overlap = await sharedVolume(targets[0], slotProbe());
    add(
      'through-slot-position',
      overlap < 1e-6,
      'No material anywhere in the specified through-slot',
      overlap,
    );
  }
  return result;
}
export async function controls(
  id: CaseId,
  original: Session,
  candidate: Session,
) {
  const variants: { name: string; expectedPass: boolean; session: Session }[] =
    [];
  const clone = () => structuredClone(candidate);
  const beforeIds = new Set(original.project.volumes.map((v) => v.id));
  const targetIndex = candidate.project.volumes.findIndex(
    (v) =>
      !beforeIds.has(v.id) ||
      (id === 'edit' && v.position.x > 3 && v.dimensions.height > 1),
  );
  if (targetIndex < 0) return variants;
  let s = clone();
  s.project.volumes.splice(targetIndex, 1);
  variants.push({ name: 'missing-piece', expectedPass: false, session: s });
  s = clone();
  // Boolean recipes may share their base/origin objects with current metadata.
  // Replace transforms as the engine does, so a probe changes the actual solid.
  s.project.volumes[targetIndex].dimensions = {
    ...s.project.volumes[targetIndex].dimensions,
    height: s.project.volumes[targetIndex].dimensions.height + 0.27,
  };
  variants.push({ name: 'wrong-height', expectedPass: false, session: s });
  s = clone();
  s.project.volumes[targetIndex].position = {
    ...s.project.volumes[targetIndex].position,
    x: s.project.volumes[targetIndex].position.x + 0.23,
  };
  variants.push({ name: 'wrong-placement', expectedPass: false, session: s });
  s = clone();
  s.project.volumes.find(
    (v) => v.id === original.project.volumes[0].id,
  )!.position.z += 1;
  variants.push({ name: 'collateral-edit', expectedPass: false, session: s });
  if (id === 'plate') {
    s = clone();
    s.project.volumes[targetIndex].geometry = { kind: 'box' };
    variants.push({ name: 'filled-in-slot', expectedPass: false, session: s });
  }
  if (id === 'edit') {
    s = clone();
    s.project.volumes[targetIndex].id = randomUUID();
    variants.push({
      name: 'identity-replacement',
      expectedPass: false,
      session: s,
    });
  }
  if (id !== 'edit') {
    s = clone();
    for (let i = 0; i < s.project.volumes.length; i++)
      if (!beforeIds.has(s.project.volumes[i].id))
        s.project.volumes[i] = await baked(s.project.volumes[i]);
    variants.push({
      name: 'equivalent-baked-solids',
      expectedPass: true,
      session: s,
    });
    const rebased = structuredClone(s);
    for (const v of rebased.project.volumes)
      if (!beforeIds.has(v.id) && v.geometry?.kind === 'mesh') {
        const xyz = v.geometry.positions;
        v.geometry.positions = xyz.map((n, i) =>
          i % 3 === 0 ? -xyz[i + 2] : i % 3 === 2 ? xyz[i - 2] : n,
        );
        v.dimensions = {
          ...v.dimensions,
          width: v.dimensions.depth,
          depth: v.dimensions.width,
        };
        v.rotation = (v.rotation + 90) % 360;
      }
    variants.push({
      name: 'equivalent-local-axes',
      expectedPass: true,
      session: rebased,
    });
  }
  return variants;
}
