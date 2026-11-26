import { describe, it, expect } from 'vitest';
import { parsePlan } from './plan';
import {
  directionVector,
  defaultCamera,
  sceneContext,
  emptyContext,
} from './context';
import { initialProject } from '../model';
describe('model output validation', () => {
  it('accepts structured edits without interpreting user keywords locally', () => {
    expect(
      parsePlan({
        intent: 'apply',
        message: 'Two new boxes.',
        operations: [
          {
            type: 'create',
            shape: 'box',
            width: 20,
            depth: 8,
            height: 6,
            count: 2,
          },
        ],
      }).operations,
    ).toHaveLength(1);
  });
  it('rejects arbitrary execution, unknown fields, unsafe ranges and clarification edits', () => {
    for (const operations of [
      [{ type: 'eval', code: 'delete everything' }],
      [{ type: 'undo', count: 100 }],
      [{ type: 'move', targets: ['x'], direction: 'right', distance: 5000 }],
    ])
      expect(() =>
        parsePlan({ intent: 'apply', message: 'x', operations }),
      ).toThrow();
    expect(() =>
      parsePlan({
        intent: 'clarify',
        message: 'Which one?',
        operations: [{ type: 'undo', count: 1 }],
      }),
    ).toThrow();
  });
  it('distinguishes camera right from project east and north', () => {
    const camera = { ...defaultCamera, right: { x: 0, y: 0, z: 1 } };
    expect(directionVector('right', camera)).toEqual({ x: 0, y: 0, z: 1 });
    expect(directionVector('north', camera)).toEqual({ x: 0, y: 0, z: -1 });
    expect(directionVector('left', camera).z).toBe(-1);
  });
  it('allows conversational approval/cancellation without smuggling new edits', () => {
    for (const intent of ['confirm', 'cancel']) {
      expect(
        parsePlan({ intent, message: 'Review response', operations: [] })
          .intent,
      ).toBe(intent);
      expect(() =>
        parsePlan({
          intent,
          message: 'Review response',
          operations: [{ type: 'delete', targets: ['$selected'] }],
        }),
      ).toThrow('cannot contain new operations');
    }
  });
  it('includes stable IDs, ordinals, selection and recent operation context', () => {
    const p = initialProject();
    const c = sceneContext(
      p,
      { ...emptyContext(), lastOperands: p.volumes.map((v) => v.id) },
      defaultCamera,
    );
    expect(c.selectedIds).toEqual([p.selectedId]);
    expect(c.objects[1].ordinal).toBe(2);
    expect(c.conversation.lastOperands).toHaveLength(2);
  });
});
