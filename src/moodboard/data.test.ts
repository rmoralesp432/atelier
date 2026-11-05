import { describe, it, expect } from 'vitest';
import { emptyBoard, parseBoard } from './data';
import { initialProject } from '../model';
describe('moodboard persistence boundary', () => {
  const base = {
    id: 'ref',
    title: 'Courtyard',
    position: { x: 1, y: 2, z: -3 },
    rotation: 30,
    scale: 1,
  };
  it('keeps model geometry in a detached, validated snapshot', () => {
    const source = initialProject();
    const board = parseBoard({
      version: 1,
      items: [{ ...base, kind: 'model', project: source }],
    });
    const restored = parseBoard(JSON.parse(JSON.stringify(board)));
    expect(restored).toEqual(board);
    if (restored.items[0].kind === 'model')
      restored.items[0].project.volumes[0].name = 'Board only';
    expect(source.volumes[0].name).not.toBe('Board only');
    expect(parseBoard(undefined)).toEqual(emptyBoard());
  });
  it('rejects unsafe references, duplicate identities, invalid transforms and oversized boards', () => {
    const note = {
      ...base,
      kind: 'note',
      text: 'Light through the roof',
      url: 'https://example.com/ref',
    };
    expect(parseBoard({ version: 1, items: [note] }).items).toHaveLength(1);
    for (const items of [
      [{ ...note, url: 'javascript:alert(1)' }],
      [note, note],
      [{ ...note, scale: -1 }],
      [{ ...base, kind: 'image', image: 'https://tracker.example/image' }],
      [{ ...note, text: 'a'.repeat(4_000_001) }],
    ]) {
      expect(() => parseBoard({ version: 1, items })).toThrow();
    }
  });
});
