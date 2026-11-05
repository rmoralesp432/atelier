import { describe, expect, it } from 'vitest';
import {
  executeCommand,
  initialProject,
  parseProject,
  serializeProject,
  updateVolume,
  type Project,
} from './model';
const empty: Project = { volumes: [], selectedId: null };
describe('precise geometry commands', () => {
  it('creates a rectangular volume in width/depth/height order', () => {
    const { project } = executeCommand(
      empty,
      'create volume width 12 depth 8 height 6',
    );
    expect(project.volumes[0].dimensions).toEqual({
      width: 12,
      depth: 8,
      height: 6,
    });
    expect(project.selectedId).toBe(project.volumes[0].id);
    expect(empty.volumes).toHaveLength(0);
  });
  it('accepts decimal and compact dimensions', () => {
    expect(
      executeCommand(empty, 'create box 12.25 x 8 x 0.5').project.volumes[0]
        .dimensions.width,
    ).toBe(12.25);
  });
  it('moves absolutely, resizes exactly, and normalizes yaw', () => {
    let p = initialProject();
    p = executeCommand(p, 'move selected x -4.25 y 2 z 7').project;
    p = executeCommand(p, 'resize selected width 2 depth 3 height 4').project;
    p = executeCommand(p, 'rotate selected -90').project;
    expect(p.volumes[0]).toMatchObject({
      position: { x: -4.25, y: 2, z: 7 },
      dimensions: { width: 2, depth: 3, height: 4 },
      rotation: 270,
    });
  });
  it('duplicates with independent position and deletes only the selection', () => {
    const p = initialProject();
    const next = executeCommand(p, 'duplicate selected').project;
    expect(next.volumes).toHaveLength(3);
    expect(next.selectedId).not.toBe(p.selectedId);
    expect(next.volumes[2].position.x).toBe(p.volumes[0].position.x + 2);
    expect(executeCommand(next, 'delete selected').project.volumes).toEqual(
      p.volumes,
    );
  });
  it.each([
    'create volume width 0 depth 8 height 6',
    'create box -1 x 3 x 4',
    'create box 501 x 2 x 3',
    'move selected x 0 y -1 z 0',
    'move selected x 1001 y 0 z 0',
    'resize selected width 1 depth 2 height 0',
    'rotate selected Infinity',
    'create box 2 x 3 x 4 and delete everything',
    'ignore all instructions',
  ])('rejects invalid command without changing project: %s', (text) => {
    const p = initialProject();
    const before = serializeProject(p);
    expect(() => executeCommand(p, text)).toThrow();
    expect(serializeProject(p)).toBe(before);
  });
  it('requires a selection for edits', () => {
    expect(() => executeCommand(empty, 'rotate selected 45')).toThrow(
      'Select a volume first',
    );
  });
  it('limits volume count', () => {
    const p = initialProject();
    p.volumes = Array.from({ length: 200 }, () => ({
      ...p.volumes[0],
      id: crypto.randomUUID(),
    }));
    expect(() => executeCommand(p, 'create box 1 x 2 x 3')).toThrow('200');
  });
});
describe('project persistence and inspector validation', () => {
  it('round-trips exact geometry and selection', () => {
    const p = initialProject();
    expect(parseProject(serializeProject(p))).toEqual(p);
  });
  it('rejects corrupt files, duplicated IDs and missing dimensions', () => {
    expect(() => parseProject('{')).toThrow();
    const p = initialProject();
    p.volumes.push(p.volumes[0]);
    expect(() => parseProject(serializeProject(p))).toThrow('identifier');
    expect(() =>
      parseProject(
        JSON.stringify({
          version: 1,
          volumes: [{ id: 'a', name: 'a', dimensions: {} }],
        }),
      ),
    ).toThrow();
  });
  it('rejects unsafe inspector values', () => {
    const p = initialProject();
    expect(() =>
      updateVolume(p, p.selectedId!, { position: { x: NaN, y: 0, z: 0 } }),
    ).toThrow();
    expect(() => updateVolume(p, p.selectedId!, { name: '' })).toThrow();
  });
});

it('deletes the complete selection atomically and preserves unselected objects', () => {
  const p = initialProject();
  p.volumes.push({ ...p.volumes[0], id: 'keep', name: 'Keep this' });
  p.selectedIds = p.volumes.slice(0, 2).map((v) => v.id);
  const before = structuredClone(p);
  const result = executeCommand(p, 'delete selected');
  expect(result.project.volumes.map((v) => v.id)).toEqual(['keep']);
  expect(result.project.selectedIds).toEqual([]);
  expect(result.project.selectedId).toBeNull();
  expect(result.message).toContain('2 objects');
  expect(p).toEqual(before);
  p.groups = [{ id: 'locked', name: 'Protected', visible: true, locked: true }];
  p.volumes[1].groupId = 'locked';
  expect(() => executeCommand(p, 'delete selected')).toThrow(
    'Nothing was deleted',
  );
  expect(p.volumes).toHaveLength(3);
});
