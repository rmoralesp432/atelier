import {
  makeVolume,
  MAX_VOLUMES,
  validateVolume,
  type Project,
  type Volume,
} from '../model';
import type { Assembly } from './architectureSchema';

/** A generic local-coordinate assembly, not a building template. Each emitted
 * member is an ordinary editable solid; no hidden master mesh or AI-only data. */
export function constructAssembly(project: Project, spec: Assembly) {
  const count = spec.elements.reduce(
    (n, e) => n + (e.repeat ? e.repeat.x * e.repeat.y * e.repeat.z : 1),
    0,
  );
  if (project.volumes.length + count > MAX_VOLUMES)
    throw new Error(
      `Assembly needs ${count} elements; only ${MAX_VOLUMES - project.volumes.length} object slots remain. Reduce repetitions without omitting requested systems, or ask to separate the study.`,
    );
  const matches = (project.groups ?? []).filter((g) => g.name === spec.name);
  if (matches.length > 1)
    throw new Error('Assembly group name is ambiguous. Use a unique name.');
  const group = matches[0] ?? {
    id: crypto.randomUUID(),
    name: spec.name,
    visible: true,
    locked: false,
  };
  if (group.locked)
    throw new Error('Unlock this assembly before adding members.');
  if (!matches.length && (project.groups?.length ?? 0) >= 50)
    throw new Error('This project already has 50 groups.');
  const keys = new Map<string, Volume[]>(),
    created: Volume[] = [],
    names = new Set(project.volumes.map((v) => v.name));
  const angle = (spec.rotation * Math.PI) / 180;
  for (const e of spec.elements) {
    if (keys.has(e.key)) throw new Error(`Duplicate assembly key: ${e.key}.`);
    const instances: Volume[] = [];
    keys.set(e.key, instances);
    const r = e.repeat ?? { x: 1, y: 1, z: 1, step: { x: 0, y: 0, z: 0 } };
    if (
      ['x', 'y', 'z'].some(
        (axis) => r[axis as 'x'] > 1 && r.step[axis as 'x'] === 0,
      )
    )
      throw new Error(
        `Repeated ${e.name} members need nonzero spacing on repeated axes.`,
      );
    for (let y = 0; y < r.y; y++)
      for (let z = 0; z < r.z; z++)
        for (let x = 0; x < r.x; x++) {
          const v = makeVolume(project.volumes.length + created.length + 1);
          v.dimensions = { ...e.dimensions };
          v.name =
            countFor(e) === 1 ? e.name : `${e.name} ${instances.length + 1}`;
          if (names.has(v.name))
            throw new Error(
              `An element named ${v.name} already exists. Choose a distinct member name.`,
            );
          names.add(v.name);
          const px = e.position.x + x * r.step.x,
            pz = e.position.z + z * r.step.z;
          v.position = {
            x: spec.origin.x + px * Math.cos(angle) + pz * Math.sin(angle),
            y: spec.origin.y + e.position.y + y * r.step.y,
            z: spec.origin.z - px * Math.sin(angle) + pz * Math.cos(angle),
          };
          v.rotation = (((spec.rotation + e.rotation) % 360) + 360) % 360;
          v.geometry = { kind: e.shape };
          v.material = e.material;
          v.color = e.color;
          v.groupId = group.id;
          v.component = {
            role: e.role,
            level: e.level,
            hostId: null,
            motion: 'none',
            travel: 1,
          };
          instances.push(v);
          created.push(v);
        }
  }
  // Resolve after creation: child-before-parent declarations are safe. Repeated
  // pairs map by instance; one host may carry multiple children.
  for (const e of spec.elements)
    if (e.host) {
      const children = keys.get(e.key)!;
      const hosts = e.host.startsWith('$part:')
        ? keys.get(e.host.slice(6))
        : project.volumes.filter((v) => v.id === e.host);
      if (
        !hosts?.length ||
        (hosts.length !== 1 && hosts.length !== children.length)
      )
        throw new Error(
          `Host for ${e.name} must identify one member or a matching repeated set.`,
        );
      children.forEach((v, i) => {
        v.component!.hostId = hosts[hosts.length === 1 ? 0 : i].id;
      });
    }
  const all = new Map([...project.volumes, ...created].map((v) => [v.id, v]));
  for (const v of created) {
    const seen = new Set<string>();
    let parent: Volume | undefined = v;
    while (parent) {
      if (seen.has(parent.id))
        throw new Error('Assembly host relationships cannot contain cycles.');
      seen.add(parent.id);
      parent = parent.component?.hostId
        ? all.get(parent.component.hostId)
        : undefined;
    }
    validateVolume(v);
  }
  return { created, group, newGroup: !matches.length };
}
const countFor = (e: Assembly['elements'][number]) =>
  e.repeat ? e.repeat.x * e.repeat.y * e.repeat.z : 1;

/** Remap hosts within each copied instance. A copied child without its host is
 * detached, so moving the source cannot unexpectedly move a copy. */
export function remapCopiedHosts(source: Volume[], copies: Volume[]) {
  const mapping = new Map(source.map((v, i) => [v.id, copies[i].id]));
  copies.forEach((v) => {
    if (v.component?.hostId)
      v.component = {
        ...v.component,
        hostId: mapping.get(v.component.hostId) ?? null,
      };
  });
}
