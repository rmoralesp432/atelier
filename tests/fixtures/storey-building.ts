import { makeVolume, type Project, type Volume } from '../../src/model';
import type { ComponentEdit } from '../../src/intelligence/componentEdits';

/** Synthetic geometry, deliberately independent of the agent's prompts/tools.
 * 3 × (16 columns + 16 panes + 16 uprights + 16 sills + 16 heads),
 * three occupied slabs and one roof = 244 independently editable components. */
export function storeyBuilding(base = 0, rotation = 0): Project {
  const volumes: Volume[] = [];
  const groupId = 'building';
  const a = (rotation * Math.PI) / 180;
  const add = (
    id: string,
    role: NonNullable<Volume['component']>['role'],
    level: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    hostId: string | null = null,
  ) => {
    const v: Volume = {
      ...makeVolume(volumes.length + 1),
      dimensions: { width, height, depth },
      id,
      name: id.replaceAll('-', ' '),
      groupId,
      rotation,
      position: {
        x: 20 + x * Math.cos(a) + z * Math.sin(a),
        y: base + y,
        z: -10 - x * Math.sin(a) + z * Math.cos(a),
      },
      geometry: { kind: role === 'column' ? 'cylinder' : 'box' },
      material:
        role === 'window' ? 'glass' : role === 'frame' ? 'frame' : 'solid',
      component: { role, level, hostId, motion: 'none', travel: 1 },
    };
    volumes.push(v);
    return v;
  };
  for (let level = 0; level < 3; level++) {
    const y = level * 3.5;
    const slab = add(
      `floor-${level}`,
      'floor',
      `Level ${level}`,
      0,
      y,
      0,
      18,
      0.25,
      18,
    );
    for (let i = 0; i < 16; i++) {
      const x = (i % 4) * 4 - 6,
        z = Math.floor(i / 4) * 4 - 6;
      const column = add(
        `column-${level}-${i}`,
        'column',
        `Level ${level}`,
        x,
        y + 0.25,
        z,
        0.3,
        3.25,
        0.3,
        slab.id,
      );
      const pane = add(
        `pane-${level}-${i}`,
        'window',
        `Level ${level}`,
        x + 1.75,
        y + 0.3,
        z,
        3.4,
        3.15,
        0.025,
        column.id,
      );
      add(
        `upright-${level}-${i}`,
        'frame',
        `Level ${level}`,
        x + 3.5,
        y + 0.25,
        z,
        0.05,
        3.25,
        0.08,
        slab.id,
      );
      add(
        `sill-${level}-${i}`,
        'frame',
        `Level ${level}`,
        x + 1.75,
        y + 0.25,
        z,
        3.4,
        0.05,
        0.08,
        column.id,
      );
      add(
        `head-${level}-${i}`,
        'frame',
        `Level ${level}`,
        x + 1.75,
        y + 3.45,
        z,
        3.4,
        0.05,
        0.08,
        pane.id,
      );
    }
  }
  add('roof', 'roof', 'Roof', 0, 10.5, 0, 18, 0.25, 18);
  return {
    volumes,
    groups: [
      { id: groupId, name: 'Courtyard study', visible: true, locked: false },
    ],
    selectedId: null,
  };
}

export function buildingWithNeighbors(base = 0, rotation = 0): Project {
  const project = storeyBuilding(base, rotation);
  // Same level/role labels outside the building catch overbroad selectors.
  project.volumes.push({
    ...makeVolume(),
    id: 'neighbor',
    name: 'Neighbor',
    position: { x: -40, y: base + 3.5, z: 0 },
    component: {
      role: 'column',
      level: 'Level 1',
      hostId: null,
      motion: 'none',
      travel: 1,
    },
  });
  return project;
}

/** Independent expectation: only the lowest storey grows; upper storeys translate. */
export function expectedStoreyEdit(project: Project, delta = 1): Project {
  return {
    ...project,
    volumes: project.volumes.map((v) => {
      if (
        v.groupId !== 'building' ||
        v.id === 'floor-0' ||
        v.id.startsWith('sill-0-')
      )
        return v;
      if (v.component?.level === 'Level 0' && !v.id.startsWith('head-0-'))
        return {
          ...v,
          dimensions: { ...v.dimensions, height: v.dimensions.height + delta },
        };
      return { ...v, position: { ...v.position, y: v.position.y + delta } };
    }),
  };
}

/** Offline provider proposal only; never used by application/model prompts. */
export function storeyEdit(project: Project, delta = 1): ComponentEdit {
  const base = project.volumes.find((v) => v.id === 'floor-0')!.position.y;
  return {
    type: 'edit_components',
    edits: [
      {
        targets: ['$group:building'],
        where: [
          { property: 'level', equals: 'Level 0' },
          { property: 'height', min: 1, max: null },
        ],
        translation: null,
        resize: { axis: 'height', mode: 'add', value: delta, anchor: 0 },
      },
      {
        targets: ['$group:building'],
        where: [{ property: 'y', min: base + 3.45, max: null }],
        translation: { x: 0, y: delta, z: 0 },
        resize: null,
      },
    ],
  };
}
