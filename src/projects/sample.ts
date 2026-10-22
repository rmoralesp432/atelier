import {
  makeVolume,
  validateVolume,
  type Volume,
  type Project,
} from '../model';
import { newSession, serializeSession } from '../intelligence/engine';
import type { SavedProject } from './library';

// A normalized, closed box also permits real thin glazing/frame dimensions.
const boxMesh = {
  kind: 'mesh' as const,
  solid: true,
  source: 'Editable sample component',
  positions: [
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 1, -0.5, -0.5, 1, -0.5, -0.5, 0, 0.5, 0.5,
    0, 0.5, 0.5, 1, 0.5, -0.5, 1, 0.5,
  ],
  indices: [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0,
    4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
  ],
};
/** A conceptual, editable Farnsworth study, not a measured conservation model. */
export function sampleHouse(): SavedProject {
  const groups = [
    'Slabs & roof',
    'Steel structure',
    'Glazing & doors',
    'Interior & furniture',
    'Terraces & steps',
    'Landscape & scale',
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
    material: Volume['material'] = 'solid',
  ) => {
    const v: Volume = {
      ...makeVolume(volumes.length + 1),
      name,
      dimensions: { width: w, depth: d, height: h },
      position: { x, y, z },
      groupId: groups[group].id,
      color,
      material,
      geometry:
        Math.min(w, d, h) >= 0.1 ? { kind: 'box' } : structuredClone(boxMesh),
    };
    validateVolume(v);
    volumes.push(v);
    return v;
  };
  // The enclosed room and sheltered porch share continuous horizontal edges.
  add('Pavilion · travertine floor', 18, 8.8, 0.25, 2, 1.5, 0, 0);
  add('Pavilion · roof', 18, 8.8, 0.25, 2, 4.45, 0, 0);
  add('Porch · travertine floor', 6, 8.8, 0.25, -10, 1.5, 0, 0);
  add('Porch · roof', 6, 8.8, 0.25, -10, 4.45, 0, 0);
  for (const [side, z] of [
    ['North', -4.52],
    ['South', 4.52],
  ] as const) {
    [-11.231, -4.525, 2.18, 8.886].forEach((x, i) => {
      const column = add(
        `${side} · steel column ${i + 1}`,
        0.2,
        0.25,
        4.7,
        x,
        0,
        z,
        1,
        '#f2f0e9',
      );
      column.geometry = {
        kind: 'polygon',
        extruded: true,
        points: [
          { x: -0.5, z: -0.5 },
          { x: 0.5, z: -0.5 },
          { x: 0.5, z: -0.35 },
          { x: 0.09, z: -0.35 },
          { x: 0.09, z: 0.35 },
          { x: 0.5, z: 0.35 },
          { x: 0.5, z: 0.5 },
          { x: -0.5, z: 0.5 },
          { x: -0.5, z: 0.35 },
          { x: -0.09, z: 0.35 },
          { x: -0.09, z: -0.35 },
          { x: -0.5, z: -0.35 },
        ],
      };
      add(
        `${side} · column base ${i + 1}`,
        0.4,
        0.4,
        0.08,
        x,
        0,
        z,
        1,
        '#b8b5aa',
      );
    });
    add(
      `${side} · floor edge`,
      24,
      0.1,
      0.3,
      -1,
      1.45,
      Math.sign(z) * 4.45,
      1,
      '#f2f0e9',
    );
    add(
      `${side} · roof edge`,
      24,
      0.1,
      0.3,
      -1,
      4.4,
      Math.sign(z) * 4.45,
      1,
      '#f2f0e9',
    );
  }
  for (const x of [-13.05, 11.05])
    for (const y of [1.45, 4.4])
      add(
        `${x < 0 ? 'West' : 'East'} · ${y < 2 ? 'floor' : 'roof'} edge`,
        0.1,
        8.96,
        0.3,
        x,
        y,
        0,
        1,
        '#f2f0e9',
      );
  // Each pane and mullion is an independent, named object with a true thickness.
  const facade = (
    side: string,
    axis: 'x' | 'z',
    fixed: number,
    start: number,
    length: number,
    count: number,
  ) => {
    const pitch = length / count;
    for (let i = 0; i < count; i++) {
      const center = start + (i + 0.5) * pitch;
      const door = side === 'West' && i === 1;
      add(
        `${side} · ${door ? 'entry door' : 'window'} ${i + 1}`,
        axis === 'x' ? pitch - 0.06 : 0.025,
        axis === 'z' ? pitch - 0.06 : 0.025,
        2.6,
        axis === 'x' ? center : fixed,
        1.8,
        axis === 'z' ? center : fixed,
        2,
        '#b8d7d6',
        'glass',
      );
      if (door)
        add(
          'Entry · door handle',
          0.1,
          0.025,
          0.32,
          fixed - 0.08,
          2.65,
          center + 0.65,
          2,
          '#676a64',
          'frame',
        );
    }
    for (let i = 0; i <= count; i++) {
      const center = start + i * pitch;
      add(
        `${side} · mullion ${i + 1}`,
        axis === 'x' ? 0.06 : 0.1,
        axis === 'z' ? 0.06 : 0.1,
        2.7,
        axis === 'x' ? center : fixed,
        1.75,
        axis === 'z' ? center : fixed,
        2,
        '#efeee7',
        'frame',
      );
    }
    for (const [name, y] of [
      ['sill', 1.75],
      ['head', 4.4],
    ] as const)
      add(
        `${side} · ${name}`,
        axis === 'x' ? length : 0.1,
        axis === 'z' ? length : 0.1,
        0.05,
        axis === 'x' ? start + length / 2 : fixed,
        y,
        axis === 'z' ? start + length / 2 : fixed,
        2,
        '#efeee7',
        'frame',
      );
  };
  facade('North', 'x', -4.3, -7, 18, 6);
  facade('South', 'x', 4.3, -7, 18, 6);
  facade('East', 'z', 10.9, -4.3, 8.6, 3);
  facade('West', 'z', -6.9, -4.3, 8.6, 3);
  // Reference reconstruction: lower bed 16.679 × 6.876 m; its west edge
  // projects 6.571 m beyond the upper slab. Keep the sample's local axes.
  // Unlike the previous west-aligned 12 m platform, this forms the staggered plan.
  const terrace = add(
    'Lower terrace',
    16.68,
    6.88,
    0.25,
    -11.23,
    0.5,
    8.08,
    4,
    '#d9d3c1',
  );
  for (let i = 0; i < 4; i++)
    add(
      `Porch step ${i + 1}`,
      3.66,
      0.4,
      0.08,
      -9.66,
      0.75 + (i + 1) * 0.2 - 0.08,
      5.8 - i * 0.4,
      4,
      '#d9d3c1',
    );
  for (let i = 0; i < 4; i++)
    add(
      `Garden step ${i + 1}`,
      3.66,
      0.4,
      0.08,
      -9.66,
      (i + 1) * 0.15 - 0.08,
      12.92 - i * 0.4,
      4,
      '#d9d3c1',
    );
  // Three front posts and one west return; the two porch-side posts are
  // shared with the upper pavilion's frame, as in the reference arrangement.
  const columnProfile = volumes.find(
    (v) => v.name === 'North · steel column 1',
  )!.geometry;
  for (const [x, z] of [
    [-17.937, 4.52],
    [-17.937, 11.64],
    [-11.231, 11.64],
    [-4.525, 11.64],
  ]) {
    const support = add('Terrace · support', 0.2, 0.25, 0.5, x, 0, z, 4);
    support.geometry = structuredClone(columnProfile);
  }
  // Core panels, hearth, counter and furniture remain individually editable.
  add(
    'Core · north timber wall',
    4.4,
    0.14,
    2.5,
    1.6,
    1.75,
    -1.7,
    3,
    '#9b7756',
  );
  add('Core · south timber wall', 4.4, 0.14, 2.5, 1.6, 1.75, 0.7, 3, '#9b7756');
  add('Core · east timber wall', 0.14, 2.4, 2.5, 3.8, 1.75, -0.5, 3, '#9b7756');
  add(
    'Core · west timber wall',
    0.14,
    2.4,
    2.5,
    -0.6,
    1.75,
    -0.5,
    3,
    '#9b7756',
  );
  add('Core · bathroom door', 0.05, 0.8, 2.1, -0.69, 1.75, -0.6, 3, '#ae8965');
  add('Hearth · stone ledge', 2.4, 0.6, 0.18, 1.4, 1.75, 1.0, 3, '#9b978b');
  add('Hearth · firebox', 1.4, 0.07, 0.65, 1.4, 1.93, 0.81, 3, '#363733');
  add('Kitchen · cabinet', 3.4, 0.7, 0.85, 1.6, 1.75, -2.1, 3, '#a78b67');
  add('Kitchen · counter', 3.5, 0.78, 0.05, 1.6, 2.6, -2.1, 3, '#dfdcd1');
  add('Kitchen · sink inset', 0.6, 0.42, 0.015, 1.9, 2.65, -2.1, 3, '#686f70');
  add('Dining · tabletop', 1.8, 0.85, 0.07, -3.4, 2.44, 1.2, 3, '#b2956e');
  for (const x of [-4.1, -2.7])
    for (const z of [0.9, 1.5])
      add('Dining · table leg', 0.05, 0.05, 0.69, x, 1.75, z, 3, '#454945');
  for (const [i, x, z] of [
    [1, -4, 2.1],
    [2, -2.8, 2.1],
    [3, -4, 0.3],
    [4, -2.8, 0.3],
  ]) {
    add(`Chair ${i} · seat`, 0.48, 0.48, 0.07, x, 2.17, z, 3, '#a28a6b');
    add(
      `Chair ${i} · back`,
      0.48,
      0.06,
      0.43,
      x,
      2.17,
      z + (z > 1 ? 0.21 : -0.21),
      3,
      '#a28a6b',
    );
    for (const dx of [-0.18, 0.18])
      add(
        `Chair ${i} · support`,
        0.05,
        0.4,
        0.42,
        x + dx,
        1.75,
        z,
        3,
        '#4b4c47',
      );
  }
  add('Lounge · seat', 2.1, 0.82, 0.25, 6.6, 2.0, 1.7, 3, '#d4c8af');
  add('Lounge · back', 2.1, 0.12, 0.6, 6.6, 2.0, 2.05, 3, '#d4c8af');
  for (const x of [5.75, 7.45])
    add('Lounge · steel base', 0.1, 0.7, 0.25, x, 1.75, 1.7, 3, '#595b55');
  add(
    'Coffee table · top',
    1.2,
    0.65,
    0.04,
    6.6,
    2.15,
    0.1,
    3,
    '#adc6c6',
    'glass',
  );
  add('Coffee table · base', 0.9, 0.45, 0.4, 6.6, 1.75, 0.1, 3, '#686a60');
  add('Sleeping · platform', 2.0, 2.1, 0.28, 7.6, 1.75, -2, 3, '#a08865');
  add('Sleeping · mattress', 1.9, 2.0, 0.22, 7.6, 2.03, -2, 3, '#e1dbcd');
  const person = add(
    'Modulor · 1.83 m head / 2.26 m reach',
    0.85,
    0.025,
    2.26,
    -9,
    1.75,
    2.3,
    5,
    '#4f5652',
  );
  person.geometry = { kind: 'person' };
  for (const [i, x, z, w, h] of [
    [1, 17, 9, 7, 10],
    [2, -19, -7, 8, 11],
    [3, 13, -12, 6, 8],
    [4, -18, 16, 6, 9],
  ]) {
    const tree = add(`Tree silhouette ${i}`, w, w, h, x, 0, z, 5, '#718270');
    tree.geometry = { kind: 'tree' };
  }
  const project: Project = {
    volumes,
    groups,
    selectedId: terrace.id,
    selectedIds: [terrace.id],
    site: {
      latitude: 41.6354,
      longitude: -88.5357,
      bearing: 0,
      style: 'satellite',
      coverage: 250,
    },
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
          'Your Farnsworth-inspired study is ready. Every window, mullion, steel column, slab and furniture piece is editable: select a part in the model or Objects. Use groups to move assemblies together. Location is prefilled near Edith Farnsworth House, Plano, Illinois; open Map to see it. This is a conceptual reconstruction, not a measured replica. Survey topography is not included yet: verified elevation data is required. Your other projects are preserved.',
      },
    ],
  };
}
