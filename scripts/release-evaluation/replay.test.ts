import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertReplayScene, replayResponse } from './replay';

test('replay permits regenerated IDs, but never changed geometry or grouping', () => {
  const old = {
    message: 'A general modeling request',
    scene: {
      units: 'm',
      objects: [
        {
          id: 'a',
          name: 'Part',
          position: { x: 3, y: 1, z: -2 },
          groupId: 'g',
        },
      ],
      groups: [{ id: 'g', name: 'Assembly', members: ['a'] }],
    },
  };
  const next = structuredClone(old);
  next.scene.objects[0].id = 'b';
  next.scene.objects[0].groupId = 'h';
  next.scene.groups[0].id = 'h';
  next.scene.groups[0].members = ['b'];
  assertReplayScene(old, next);
  assert.deepEqual(replayResponse(old, next, { targets: ['a', 'g'] }), {
    targets: ['b', 'h'],
  });
  next.scene.objects[0].position.y = 2;
  assert.throws(() => assertReplayScene(old, next), /scene objects changed/);
  next.scene.objects[0].position.y = 1;
  next.scene.groups[0].members = [];
  assert.throws(() => assertReplayScene(old, next), /scene groups changed/);
});
