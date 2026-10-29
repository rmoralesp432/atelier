import { it, expect } from 'vitest';
import { makeVolume, parseProject, serializeProject } from '../model';
import {
  applyPlan,
  directPlan,
  newSession,
  parseSession,
  serializeSession,
} from '../intelligence/engine';
import { defaultCamera, sceneContext } from '../intelligence/context';
import { requestSchema } from '../../server/provider';
import { explorationTransform } from './model';
import { furnishRoom } from './layout';
import type { Operation } from '../intelligence/plan';
const settings = {
  role: 'door' as const,
  hostId: null,
  level: 'Ground',
  motion: 'hinge-left' as const,
  travel: 1,
};
it('hinged presentation preserves a world hinge at arbitrary yaw and restores assembly without editing geometry', () => {
  const v = makeVolume(1, { width: 1, depth: 0.1, height: 2.1 });
  v.component = settings;
  v.rotation = 37;
  v.position = { x: 5, y: 1, z: 4 };
  const p = { volumes: [v], selectedId: v.id },
    original = JSON.stringify(p);
  const opened = explorationTransform(v, p, {
    mode: 'open',
    amount: 1,
    targets: [v.id],
  });
  const pivot = (position: typeof v.position, rotation: number) => ({
    x: position.x - Math.cos((rotation * Math.PI) / 180) / 2,
    z: position.z + Math.sin((rotation * Math.PI) / 180) / 2,
  });
  expect(pivot(opened.position, opened.rotation).x).toBeCloseTo(
    pivot(v.position, v.rotation).x,
  );
  expect(pivot(opened.position, opened.rotation).z).toBeCloseTo(
    pivot(v.position, v.rotation).z,
  );
  expect(
    explorationTransform(v, p, { mode: 'assembled', amount: 1, targets: [] }),
  ).toEqual({ position: v.position, rotation: v.rotation });
  expect(JSON.stringify(p)).toBe(original);
});
it('component metadata, alternatives and camera views survive session roundtrip and restore with undo', async () => {
  const v = makeVolume();
  let s = newSession({ volumes: [v], selectedId: v.id });
  const camera = {
    ...defaultCamera,
    pose: {
      position: { x: 20, y: 10, z: 30 },
      target: { x: 0, y: 2, z: 0 },
      projection: 'perspective' as const,
      zoom: 1,
      fov: 50,
    },
  };
  const run = async (op: Operation) => {
    s = (await applyPlan(s, directPlan(op), camera, true)).session;
  };
  await run({ type: 'component', targets: [v.id], settings });
  await run({ type: 'alternative', action: 'save', name: 'Original' });
  await run({ type: 'move', targets: [v.id], direction: 'right', distance: 3 });
  await run({ type: 'alternative', action: 'save', name: 'Moved' });
  await run({
    type: 'save_view',
    name: 'Entrance',
    targets: [],
    cutaway: false,
  });
  s = parseSession(serializeSession(s));
  expect(s.project.design?.views[0].pose).toEqual(camera.pose);
  await run({ type: 'alternative', action: 'restore', name: 'Original' });
  expect(s.project.volumes[0].position.x).toBe(0);
  await run({ type: 'undo', count: 1 });
  expect(s.project.volumes[0].position.x).toBe(3);
  expect(
    parseProject(serializeProject(s.project)).volumes[0].component,
  ).toEqual(settings);
  expect(
    requestSchema.parse({
      message: 'Open the door',
      history: [],
      scene: sceneContext(s.project, s.context, camera),
    }).scene.objects[0].component?.role,
  ).toBe('door');
});
it('a multi-step room layout and cutaway transaction validates actual geometry and can be undone once', async () => {
  const room = makeVolume(1, { width: 10, depth: 8, height: 3 });
  room.name = 'Meeting room';
  const initial = newSession({ volumes: [room], selectedId: room.id });
  const result = await applyPlan(
    initial,
    {
      intent: 'apply',
      message: 'Identify and furnish the room, then save its view.',
      operations: [
        {
          type: 'component',
          targets: [room.id],
          settings: { ...settings, role: 'room', motion: 'none' },
        },
        { type: 'furnish', room: room.id, layout: 'meeting', clearance: 0.8 },
        { type: 'room_views' },
      ],
    },
    defaultCamera,
    true,
  );
  expect(result.session.project.volumes.length).toBeGreaterThan(10);
  expect(result.session.project.design?.views[0].section?.enabled).toBe(true);
  expect(
    result.session.project.volumes
      .slice(1)
      .every((v) => v.component?.hostId === room.id),
  ).toBe(true);
  const undone = await applyPlan(
    result.session,
    directPlan({ type: 'undo', count: 1 }),
  );
  expect(undone.session.project).toEqual(initial.project);
});
it('layout collisions fail atomically, and host cycles are rejected', async () => {
  const room = makeVolume(1, { width: 10, depth: 8, height: 3 });
  room.component = { ...settings, role: 'room', motion: 'none' };
  const obstacle = makeVolume(2, { width: 2, depth: 2, height: 2 });
  const p = { volumes: [room, obstacle], selectedId: room.id };
  expect(() => furnishRoom(p, room, 'meeting', 0.8)).toThrow('intersect');
  const original = JSON.stringify(p);
  await expect(
    applyPlan(
      newSession(p),
      directPlan({
        type: 'furnish',
        room: room.id,
        layout: 'meeting',
        clearance: 0.8,
      }),
      defaultCamera,
      true,
    ),
  ).rejects.toThrow('intersect');
  expect(JSON.stringify(p)).toBe(original);
  room.component.hostId = obstacle.id;
  await expect(
    applyPlan(
      newSession(p),
      directPlan({
        type: 'component',
        targets: [obstacle.id],
        settings: { ...settings, hostId: room.id },
      }),
    ),
  ).rejects.toThrow('cycles');
});
it('unconfigured opening and missing saved views do not report success', async () => {
  const v = makeVolume(),
    s = newSession({ volumes: [v], selectedId: v.id });
  await expect(
    applyPlan(
      s,
      directPlan({ type: 'explore', mode: 'open', amount: 1, targets: [v.id] }),
    ),
  ).rejects.toThrow('hinge');
  await expect(
    applyPlan(s, directPlan({ type: 'show_view', name: 'Missing' })),
  ).rejects.toThrow('saved view');
});

it('hosted windows retain their width as a host narrows, move with it and undo together', async () => {
  const host = makeVolume(1, { width: 20, depth: 10, height: 8 }),
    window = makeVolume(2, { width: 2, depth: 0.2, height: 3 });
  window.position = { x: 8, y: 2, z: 5 };
  window.component = {
    ...settings,
    role: 'window',
    hostId: host.id,
    motion: 'none',
  };
  const start = newSession({ volumes: [host, window], selectedId: host.id });
  const narrowed = (
    await applyPlan(
      start,
      directPlan({
        type: 'resize',
        targets: [host.id],
        axis: 'width',
        mode: 'set',
        value: 10,
      }),
    )
  ).session;
  expect(narrowed.project.volumes[1].position.x).toBe(4);
  expect(narrowed.project.volumes[1].dimensions.width).toBe(2);
  expect(start.project.volumes[1].position.x).toBe(8);
  const moved = (
    await applyPlan(
      narrowed,
      directPlan({
        type: 'move',
        targets: [host.id],
        direction: 'right',
        distance: 3,
      }),
    )
  ).session;
  expect(moved.project.volumes[1].position.x).toBe(7);
  const undone = (
    await applyPlan(moved, directPlan({ type: 'undo', count: 1 }))
  ).session;
  expect(undone.project.volumes[1].position.x).toBe(4);
});
it('a door handle follows the same presentation hinge without altering the handle coordinates', () => {
  const door = makeVolume(1, { width: 1, depth: 0.1, height: 2 });
  door.component = settings;
  const handle = makeVolume(2, { width: 0.1, depth: 0.1, height: 0.2 });
  handle.position = { x: 0.4, y: 1, z: 0.1 };
  handle.component = {
    ...settings,
    role: 'element',
    hostId: door.id,
    motion: 'none',
  };
  const p = { volumes: [door, handle], selectedId: door.id };
  const result = explorationTransform(handle, p, {
    mode: 'open',
    amount: 1,
    targets: [door.id],
  });
  expect(result.position.x).toBeCloseTo(-0.6);
  expect(result.position.z).toBeCloseTo(0.9);
  expect(handle.position.x).toBe(0.4);
});

it('resolves a named host created in the same conversational plan', async () => {
  const result = await applyPlan(
    newSession({ volumes: [], selectedId: null }),
    {
      intent: 'apply',
      message: 'Create a room and a hosted door.',
      operations: [
        {
          type: 'create_at',
          shape: 'box',
          name: 'New room',
          width: 8,
          depth: 6,
          height: 3,
          x: 0,
          y: 0,
          z: 0,
          rotation: 0,
        },
        {
          type: 'create_at',
          shape: 'box',
          name: 'New door',
          width: 1,
          depth: 0.1,
          height: 2,
          x: 0,
          y: 0,
          z: 3,
          rotation: 0,
        },
        {
          type: 'component',
          targets: ['$name:New door'],
          settings: { ...settings, hostId: '$name:New room' },
        },
      ],
    },
  );
  const [host, door] = result.session.project.volumes;
  expect(door.component?.hostId).toBe(host.id);
});
