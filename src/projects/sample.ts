import { makeVolume, type Volume, type Project } from '../model';
import { newSession, serializeSession } from '../intelligence/engine';
import type { SavedProject } from './library';

/** A conceptual, editable study inspired by Farnsworth House, not a measured replica. */
export function sampleHouse(): SavedProject {
  const groups = [
    'Envelope',
    'Structure',
    'Interior',
    'Terraces & steps',
    'Landscape',
  ].map((name) => ({
    id: crypto.randomUUID(),
    name,
    visible: true,
    locked: false,
  }));
  const volumes: Volume[] = [];
  const add = (
    name: string,
    w: number,
    d: number,
    h: number,
    x: number,
    y: number,
    z: number,
    group: number,
    color = '#e9e7dd',
  ) => {
    const v: Volume = {
      ...makeVolume(volumes.length + 1, { width: w, depth: d, height: h }),
      name,
      position: { x, y, z },
      groupId: groups[group].id,
      color,
    };
    volumes.push(v);
    return v;
  };
  const pavilion = add('Glass pavilion', 18, 8, 3.2, 2, 1.5, 0, 0);
  pavilion.geometry = {
    kind: 'building',
    source: structuredClone(pavilion),
    base: { ...pavilion.dimensions },
    floors: 1,
    slabThickness: 0.25,
    facade: true,
    panelWidth: 3,
    mullionWidth: 0.1,
    fixedWindowWidth: 3,
  };
  pavilion.display = { mode: 'architecture', floors: true, glass: true };
  add('Porch floor', 6, 8, 0.25, -10, 1.5, 0, 0);
  add('Porch roof', 6, 8, 0.25, -10, 4.45, 0, 0);
  for (const [side, z] of [
    ['North', -4.15],
    ['South', 4.15],
  ] as const)
    [-12.6, -5.1, 2.4, 10.6].forEach((x, i) =>
      add(`${side} column ${i + 1}`, 0.18, 0.22, 4.7, x, 0, z, 1, '#f3f0e7'),
    );
  const terrace = add('Lower terrace', 12, 6, 0.25, -7, 0.5, 8, 3, '#c9c3b1');
  for (let i = 0; i < 4; i++)
    add(
      `Porch step ${i + 1}`,
      3,
      0.4,
      0.25,
      -10,
      0.75 + i * 0.25,
      5.05 - i * 0.35,
      3,
      '#d9d3c1',
    );
  for (let i = 0; i < 3; i++)
    add(
      `Garden step ${i + 1}`,
      3,
      0.4,
      0.25,
      -10,
      i * 0.25,
      11.5 - i * 0.35,
      3,
      '#d9d3c1',
    );
  add('Timber service core', 4, 2.4, 2.7, 1.5, 1.75, -0.5, 2, '#ab8260');
  add('Kitchen counter', 3, 0.75, 0.9, 2, 1.75, 1.4, 2, '#827a6c');
  const person = add(
    'Person for scale',
    0.6,
    0.4,
    1.75,
    -8,
    1.75,
    2,
    4,
    '#aa8e71',
  );
  person.geometry = { kind: 'person' };
  for (const [i, x, z] of [
    [1, 16, 6],
    [2, -17, -5],
  ]) {
    const tree = add(`Garden tree ${i}`, 4.8, 4.8, 6, x, 0, z, 4, '#718270');
    tree.geometry = { kind: 'tree' };
  }
  const project: Project = {
    volumes,
    groups,
    selectedId: terrace.id,
    selectedIds: [terrace.id],
  };
  return {
    id: crypto.randomUUID(),
    name: 'Glass pavilion · sample',
    updatedAt: Date.now(),
    session: serializeSession(newSession(project)),
    messages: [
      {
        role: 'assistant',
        content:
          'Your editable glass pavilion is ready, inspired by Farnsworth House. Select the terrace to reshape it, or describe a change when AI is connected. Your other projects are preserved.',
      },
    ],
  };
}
