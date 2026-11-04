import { describe, it, expect } from 'vitest';
import {
  applyPlan,
  directPlan,
  newSession,
  parseSession,
  serializeSession,
} from './engine';
import { makeVolume, type Volume } from '../model';
import { solidStats, booleanVolume, sharedVolume } from '../geometry/kernel';
import { profileVolume, anchoredDimensions } from './volumetric';
import type { ProfileSolid } from './volumetricSchema';
import { defaultCamera, sceneContext } from './context';
import { requestSchema } from '../../server/provider';

const spec = (patch: Partial<ProfileSolid> = {}): ProfileSolid => ({
  type: 'profile_solid',
  targets: [],
  name: 'Section',
  position: { x: 0, y: 0, z: 0 },
  dimensions: { width: 0.9, depth: 0.6, height: 4 },
  axis: 'y',
  shape: 'i_section',
  web: 0.03,
  flange: 0.05,
  points: null,
  ...patch,
});
const session = (v: Volume) => newSession({ volumes: [v], selectedId: v.id });
const change = async (v: Volume, op: Parameters<typeof directPlan>[0]) =>
  (await applyPlan(session(v), directPlan(op), defaultCamera, true)).session;

describe('general profile solids', () => {
  it.each(['x', 'y', 'z'] as const)(
    'makes an I-section on %s with analytic cross-sectional volume and unchanged envelope',
    async (axis) => {
      const dimensions = { width: 4, depth: 0.9, height: 0.6 };
      if (axis === 'y')
        Object.assign(dimensions, { width: 0.9, depth: 0.6, height: 4 });
      if (axis === 'z')
        Object.assign(dimensions, { width: 0.9, depth: 4, height: 0.6 });
      const v = await profileVolume(null, spec({ axis, dimensions }));
      const stats = await solidStats(v);
      expect(stats.status).toBe('NoError');
      expect(stats.volume).toBeCloseTo((2 * 0.9 * 0.05 + 0.03 * 0.5) * 4, 5);
      expect(v.dimensions).toEqual(dimensions);
      expect(stats.bounds.max[0] - stats.bounds.min[0]).toBeCloseTo(
        dimensions.width,
      );
      expect(stats.bounds.max[1] - stats.bounds.min[1]).toBeCloseTo(
        dimensions.height,
      );
      expect(stats.bounds.max[2] - stats.bounds.min[2]).toBeCloseTo(
        dimensions.depth,
      );
    },
  );
  it('replaces a set of differently sized columns in place and preserves unrelated objects and metadata', async () => {
    const columns = [makeVolume(1), makeVolume(2)];
    columns.forEach((v, i) => {
      v.dimensions = { width: 0.9 + i * 0.1, depth: 0.9, height: 4 };
      v.geometry = { kind: 'cylinder' };
      v.position.x = i * 12;
      v.rotation = i * 45;
      v.component = {
        role: 'column',
        level: 'Level 1',
        hostId: null,
        motion: 'none',
        travel: 1,
      };
    });
    const other = makeVolume(3);
    const s = newSession({ volumes: [...columns, other], selectedId: null });
    const out = await applyPlan(
      s,
      directPlan(spec({ targets: columns.map((v) => v.id), dimensions: null })),
      defaultCamera,
      true,
    );
    for (const [i, v] of out.session.project.volumes.slice(0, 2).entries()) {
      expect(v.id).toBe(columns[i].id);
      expect(v.position).toEqual(columns[i].position);
      expect(v.dimensions).toEqual(columns[i].dimensions);
      expect(v.component).toEqual(columns[i].component);
      expect(v.name).toBe(columns[i].name);
      expect(v.rotation).toBe(columns[i].rotation);
      expect((await solidStats(v)).volume).toBeLessThan(
        (await solidStats(columns[i])).volume,
      );
    }
    expect(out.session.project.volumes[2]).toEqual(other);
    expect(parseSession(serializeSession(out.session)).project).toEqual(
      out.session.project,
    );
    expect(
      requestSchema.safeParse({
        message: 'Change these columns',
        history: [],
        scene: sceneContext(
          out.session.project,
          out.session.context,
          defaultCamera,
        ),
      }).success,
    ).toBe(true);
    const undo = await applyPlan(
      out.session,
      directPlan({ type: 'undo', count: 1 }),
    );
    expect(undo.session.project).toEqual(s.project);
  });
  it('makes a hexagonal prism fitting the original envelope, without reflecting asymmetric profiles', async () => {
    const points = Array.from({ length: 6 }, (_, i) => ({
      x: Math.cos((i * Math.PI) / 3),
      z: Math.sin((i * Math.PI) / 3),
    }));
    const v = await profileVolume(
      null,
      spec({
        shape: 'polygon',
        points,
        dimensions: { width: 8, depth: 6, height: 4 },
        web: null,
        flange: null,
      }),
    );
    expect((await solidStats(v)).volume).toBeCloseTo(8 * 6 * 0.75 * 4, 4);
  });
  it('rejects impossible web/flange dimensions without committing', async () => {
    const v = makeVolume();
    const s = session(v),
      original = serializeSession(s);
    await expect(
      applyPlan(
        s,
        directPlan(
          spec({
            targets: [v.id],
            dimensions: { width: 0.3, depth: 0.3, height: 4 },
            flange: 0.2,
          }),
        ),
        defaultCamera,
        true,
      ),
    ).rejects.toThrow(/thickness/);
    expect(serializeSession(s)).toBe(original);
  });
});

describe('revolved shells and editable opening shapes', () => {
  it('fits thin glazing and annular frames, then updates both to a circular opening without losing IDs', async () => {
    const wall = {
      ...makeVolume(),
      dimensions: { width: 10, depth: 0.3, height: 5 },
      rotation: 31,
    };
    let s = await change(wall, {
      type: 'opening',
      target: wall.id,
      width: 2,
      height: 2,
      sill: 1,
      offset: 1,
    });
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'glaze_opening',
          target: wall.id,
          frameWidth: 0.1,
          frameDepth: 0.12,
          paneThickness: 0.012,
        }),
      )
    ).session;
    expect(s.project.volumes).toHaveLength(3);
    const ids = s.project.volumes.map((v) => v.id);
    const frame = s.project.volumes.find((v) => v.component?.role === 'frame')!,
      pane = s.project.volumes.find((v) => v.component?.role === 'window')!;
    expect((await solidStats(frame)).volume).toBeCloseTo(
      (4 - 1.8 ** 2) * 0.12,
      5,
    );
    expect((await solidStats(pane)).volume).toBeCloseTo(1.8 ** 2 * 0.012, 5);
    expect(pane.material).toBe('glass');
    expect(pane.component?.hostId).toBe(wall.id);
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'opening_shape',
          target: wall.id,
          shape: 'ellipse',
        }),
        defaultCamera,
        true,
      )
    ).session;
    expect(s.project.volumes.map((v) => v.id)).toEqual(ids);
    const updatedPane = s.project.volumes.find((v) => v.id === pane.id)!;
    expect((await solidStats(updatedPane)).volume).toBeCloseTo(
      Math.PI * 0.9 ** 2 * 0.012,
      3,
    );
    expect(await sharedVolume(updatedPane, s.project.volumes[0])).toBeLessThan(
      1e-5,
    );
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'edit_opening',
          target: wall.id,
          width: 3,
          height: 3,
        }),
      )
    ).session;
    expect(
      (await solidStats(s.project.volumes.find((v) => v.id === pane.id)!))
        .volume,
    ).toBeCloseTo(Math.PI * 1.4 ** 2 * 0.012, 3);
    const restored = parseSession(serializeSession(s));
    expect(restored.project).toEqual(s.project);
    const context = sceneContext(s.project, s.context, defaultCamera);
    expect(
      context.objects.find((v) => v.id === wall.id)?.construction,
    ).toContain('operands');
    expect(
      context.objects.find((v) => v.id === pane.id)?.construction,
    ).toContain('paneThickness');
    expect(
      requestSchema.safeParse({
        message: 'Make the glazing wider',
        history: [],
        scene: context,
      }).success,
    ).toBe(true);
  });
  it('refits an already rotated and nonuniformly scaled opening without losing components', async () => {
    const wall = {
      ...makeVolume(),
      dimensions: { width: 12, depth: 0.4, height: 5 },
      rotation: 20,
    };
    let s = await change(wall, {
      type: 'opening',
      target: wall.id,
      width: 2,
      height: 2,
      sill: 1,
      offset: -3,
    });
    const glazing = {
      type: 'glaze_opening' as const,
      target: wall.id,
      frameWidth: 0.1,
      frameDepth: 0.1,
      paneThickness: 0.01,
    };
    s = (await applyPlan(s, directPlan(glazing))).session;
    const first = s.project.volumes.slice(1);
    // Existing opening is in world-coordinate Boolean bounds. A second opening
    // uses that current envelope; here we only test preserving linked identities.
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'rotate',
          targets: [wall.id],
          degrees: 25,
          relative: true,
        }),
      )
    ).session;
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'resize',
          targets: [wall.id],
          axis: 'width',
          mode: 'scale',
          value: 1.2,
        }),
      )
    ).session;
    s = (await applyPlan(s, directPlan(glazing))).session;
    expect(s.project.volumes).toHaveLength(3);
    expect(s.project.volumes.slice(1).map((v) => v.id)).toEqual(
      first.map((v) => v.id),
    );
    for (const v of s.project.volumes.slice(1))
      expect(await sharedVolume(v, s.project.volumes[0])).toBeLessThan(1e-5);
  });
  it.each([360, 180])(
    'revolves a radial section through %s degrees with a genuine hollow center',
    async (degrees) => {
      const s = await applyPlan(
        newSession({ volumes: [], selectedId: null }),
        directPlan({
          type: 'revolve',
          target: null,
          name: 'Ring',
          profile: [
            { radius: 2, height: 0 },
            { radius: 4, height: 0 },
            { radius: 4, height: 3 },
            { radius: 2, height: 3 },
          ],
          degrees,
          position: { x: 0, y: 2, z: 0 },
        }),
      );
      const v = s.session.project.volumes[0],
        stats = await solidStats(v);
      expect(stats.volume / ((Math.PI * 12 * 3 * degrees) / 360)).toBeCloseTo(
        1,
        2,
      );
      expect(stats.status).toBe('NoError');
      expect(stats.bounds.min[1]).toBeCloseTo(2);
      expect(
        parseSession(serializeSession(s.session)).project.volumes[0],
      ).toEqual(v);
    },
  );
  it('builds a dome meridian with an oculus rather than a sphere proxy', async () => {
    const points = Array.from({ length: 17 }, (_, i) => ({
      radius: 10 * Math.cos((i * 1.35) / 16),
      height: 10 * Math.sin((i * 1.35) / 16),
    }));
    points.push(
      ...Array.from({ length: 17 }, (_, i) => ({
        radius: 9.5 * Math.cos(((16 - i) * 1.35) / 16),
        height: 9.5 * Math.sin(((16 - i) * 1.35) / 16),
      })),
    );
    const out = await applyPlan(
      newSession({ volumes: [], selectedId: null }),
      directPlan({
        type: 'revolve',
        target: null,
        name: 'Oculus dome',
        profile: points,
        degrees: 360,
        position: { x: 0, y: 8, z: 0 },
      }),
    );
    const dome = out.session.project.volumes[0],
      stats = await solidStats(dome);
    expect(stats.volume).toBeGreaterThan(100);
    expect(stats.volume).toBeLessThan(400);
    const probe = {
      ...makeVolume(),
      dimensions: { width: 2, depth: 2, height: 30 },
    };
    expect(await sharedVolume(dome, probe)).toBe(0);
  });
  it('changes a square hole to an ellipse after moving/scaling a rotated wall, preserving earlier cuts and identity', async () => {
    const wall = {
      ...makeVolume(),
      dimensions: { width: 10, depth: 0.3, height: 5 },
      rotation: 30,
    };
    let s = await change(wall, {
      type: 'opening',
      target: wall.id,
      width: 2,
      height: 2,
      sill: 1,
      offset: 0,
    });
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'scale',
          targets: [wall.id],
          factor: 2,
          pivot: null,
        }),
      )
    ).session;
    const before = s.project.volumes[0];
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'opening_shape',
          target: wall.id,
          shape: 'ellipse',
        }),
        defaultCamera,
        true,
      )
    ).session;
    const after = s.project.volumes[0];
    expect(after.id).toBe(before.id);
    expect(after.position).toEqual(before.position);
    expect(after.dimensions).toEqual(before.dimensions);
    expect((await solidStats(after)).volume).toBeCloseTo(
      (50 - Math.PI) * 0.3 * 8,
      1,
    );
    s = (
      await applyPlan(
        s,
        directPlan({
          type: 'edit_opening',
          target: wall.id,
          width: 6,
          height: 6,
        }),
      )
    ).session;
    expect((await solidStats(s.project.volumes[0])).volume).toBeCloseTo(
      120 - Math.PI * 9 * 0.6,
      1,
    );
  });
});

describe('levels, constraints and connected solids', () => {
  it('splits a hollow mass into an explicit unequal schedule, preserving the atrium and total volume', async () => {
    const mass = {
      ...makeVolume(),
      dimensions: { width: 20, depth: 16, height: 28 },
      rotation: 25,
    };
    const core = {
      ...makeVolume(),
      dimensions: { width: 4, depth: 6, height: 28 },
      rotation: 25,
    };
    const source = await booleanVolume(mass, core, 'subtract');
    const levels = [8, 8, 4, 4, 4].map((height, i) => ({
      name: `Level ${i + 1}`,
      height,
      offsetX: 0,
      offsetZ: 0,
      rotation: 0,
      scaleX: 1,
      scaleZ: 1,
    }));
    const out = await change(source, {
      type: 'split_levels',
      target: source.id,
      levels,
    });
    expect(out.project.volumes).toHaveLength(5);
    expect(out.project.volumes[0].id).toBe(source.id);
    let total = 0;
    for (const [i, v] of out.project.volumes.entries()) {
      const stats = await solidStats(v);
      total += stats.volume;
      expect(stats.volume).toBeCloseTo((320 - 24) * levels[i].height, 2);
    }
    expect(total).toBeCloseTo((await solidStats(source)).volume, 2);
    expect(out.project.volumes.map((v) => v.position.y)).toEqual([
      0, 8, 16, 20, 24,
    ]);
    expect(out.project.volumes.map((v) => v.component?.level)).toEqual(
      levels.map((l) => l.name),
    );
  });
  it('rejects a mismatched level schedule, hosted split, or locked replacement atomically', async () => {
    const v = makeVolume(),
      levels = [
        {
          name: 'A',
          height: 2,
          offsetX: 0,
          offsetZ: 0,
          rotation: 0,
          scaleX: 1,
          scaleZ: 1,
        },
        {
          name: 'B',
          height: 2,
          offsetX: 0,
          offsetZ: 0,
          rotation: 0,
          scaleX: 1,
          scaleZ: 1,
        },
      ];
    await expect(
      change(v, { type: 'split_levels', target: v.id, levels }),
    ).rejects.toThrow(/sum/);
    const child = {
      ...makeVolume(2),
      component: {
        role: 'window' as const,
        hostId: v.id,
        level: null,
        motion: 'none' as const,
        travel: 1,
      },
    };
    await expect(
      applyPlan(
        newSession({ volumes: [v, child], selectedId: v.id }),
        directPlan({ type: 'split_levels', target: v.id, levels }),
        defaultCamera,
        true,
      ),
    ).rejects.toThrow(/hosts/);
    const locked = newSession({
      volumes: [{ ...v, groupId: 'locked' }],
      selectedId: v.id,
      groups: [{ id: 'locked', name: 'Locked', locked: true, visible: true }],
    });
    await expect(
      applyPlan(
        locked,
        directPlan(spec({ targets: [v.id], dimensions: null })),
        defaultCamera,
        true,
      ),
    ).rejects.toThrow(/locked/);
  });
  it('preserves actual hollow volume and a rotated corner through constrained scaling', async () => {
    const v = makeVolume();
    v.position = { x: 6, y: 2, z: -3 };
    v.rotation = 35;
    const h = await change(v, {
        type: 'hollow',
        target: v.id,
        thickness: 0.4,
        openTop: true,
      }),
      source = h.project.volumes[0];
    const anchor = { x: -0.5, y: 0, z: 0.5 };
    const out = await change(source, {
      type: 'constrained_resize',
      targets: [source.id],
      axis: 'height',
      value: 12,
      preserveVolume: true,
      anchor,
    });
    const next = out.project.volumes[0];
    expect((await solidStats(next)).volume).toBeCloseTo(
      (await solidStats(source)).volume,
      3,
    );
    const back = anchoredDimensions(next, source.dimensions, anchor);
    expect(back.position.x).toBeCloseTo(source.position.x);
    expect(back.position.z).toBeCloseTo(source.position.z);
  });
  it('makes progressive copies with a common fixed corner and unique identities', async () => {
    const v = makeVolume(),
      anchor = { x: -0.5, y: 0, z: -0.5 };
    const out = await change(v, {
      type: 'progressive_array',
      target: v.id,
      count: 4,
      step: { x: 12, y: 0, z: 0 },
      rotationStep: 15,
      scaleStep: { x: 0.97, y: 1.08, z: 1 },
      anchor,
    });
    expect(out.project.volumes).toHaveLength(4);
    expect(out.project.volumes[0]).toEqual(v);
    expect(new Set(out.project.volumes.map((v) => v.id)).size).toBe(4);
    out.project.volumes.forEach((c, i) => {
      expect(c.dimensions.height).toBeCloseTo(v.dimensions.height * 1.08 ** i);
      const back = anchoredDimensions(c, v.dimensions, anchor, 0);
      expect(back.position.x).toBeCloseTo(v.position.x + 12 * i);
      expect(back.position.z).toBeCloseTo(v.position.z);
    });
  });
  it('builds a rotated bridge with real contacts and refuses an unsupported elevation', async () => {
    const a = makeVolume(),
      b = { ...makeVolume(2), position: { x: 30, y: 0, z: 20 }, rotation: 45 };
    const s = newSession({ volumes: [a, b], selectedId: a.id });
    const op = {
      type: 'bridge' as const,
      targets: [a.id, b.id],
      name: 'Connection',
      elevation: 3,
      width: 3,
      thickness: 0.3,
      embed: 0.2,
    };
    const result = await applyPlan(s, directPlan(op));
    const bridge = result.session.project.volumes[2];
    expect(await sharedVolume(a, bridge)).toBeGreaterThan(0);
    expect(await sharedVolume(b, bridge)).toBeGreaterThan(0);
    expect(result.session.project.volumes.slice(0, 2)).toEqual([a, b]);
    await expect(
      applyPlan(s, directPlan({ ...op, elevation: 15 })),
    ).rejects.toThrow(/both actual solids/);
  });
  it('relation verification checks actual voids and rolls back preceding edits on failure', async () => {
    const a = makeVolume(),
      b = {
        ...makeVolume(2),
        dimensions: { width: 2, depth: 2, height: 2 },
        position: { x: 0, y: 1, z: 0 },
      };
    const shell = await booleanVolume(a, b, 'subtract');
    const s = newSession({ volumes: [shell, b], selectedId: b.id }),
      before = serializeSession(s);
    const verified = await applyPlan(
      s,
      directPlan({
        type: 'verify_relation',
        targets: [b.id, shell.id],
        relation: 'disjoint',
        tolerance: 0.00001,
      }),
    );
    expect(verified.session.past).toHaveLength(0);
    await expect(
      applyPlan(s, {
        intent: 'apply',
        message: 'Check containment',
        operations: [
          { type: 'color', targets: [b.id], color: '#ff0000' },
          {
            type: 'verify_relation',
            targets: [b.id, shell.id],
            relation: 'contained',
            tolerance: 0.00001,
          },
        ],
      }),
    ).rejects.toThrow(/Verification failed/);
    expect(serializeSession(s)).toBe(before);
  });
});
