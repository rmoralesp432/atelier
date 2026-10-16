import {
  makeVolume,
  MAX_VOLUMES,
  parseProject,
  round,
  serializeProject,
  updateVolume,
  validateVolume,
  type Project,
  type Volume,
} from '../model';
import {
  booleanVolume,
  isProfile,
  openingScale,
  solidStats,
} from '../geometry/kernel';
import {
  defaultCamera,
  directionVector,
  emptyContext,
  type CameraContext,
  type ConversationContext,
} from './context';
import {
  parsePlan,
  needsConfirmation,
  type Operation,
  type Plan,
} from './plan';
export type Session = {
  project: Project;
  past: Project[];
  future: Project[];
  context: ConversationContext;
};
export const newSession = (project: Project): Session => ({
  project,
  past: [],
  future: [],
  context: emptyContext(),
});
export function parseSession(text: string): Session {
  const raw = JSON.parse(text);
  if (
    raw.version !== 2 ||
    !Array.isArray(raw.past) ||
    !Array.isArray(raw.future) ||
    raw.past.length > 50 ||
    raw.future.length > 50
  )
    throw new Error('Invalid session history.');
  const read = (p: unknown) =>
    parseProject(JSON.stringify({ version: 2, ...(p as object) }));
  const session: Session = {
    project: read(raw.project),
    past: raw.past.map(read),
    future: raw.future.map(read),
    context: emptyContext(),
  };
  if (
    raw.context &&
    ['focusIds', 'lastCreatedIds', 'lastOperands'].every(
      (k) =>
        Array.isArray(raw.context[k]) &&
        raw.context[k].length <= 200 &&
        raw.context[k].every((id: unknown) => typeof id === 'string'),
    )
  )
    session.context = raw.context;
  return session;
}
export const serializeSession = (s: Session) =>
  JSON.stringify({ version: 2, ...s });
export function commitProject(s: Session, project: Project): Session {
  if (serializeProject(s.project) === serializeProject(project)) return s;
  return { ...s, project, past: [...s.past.slice(-49), s.project], future: [] };
}
function resolveIds(refs: string[], s: Session): string[] {
  const result = refs.flatMap((ref) =>
    ref === '$selected'
      ? s.project.selectedIds?.length
        ? s.project.selectedIds
        : s.project.selectedId
          ? [s.project.selectedId]
          : []
      : ref === '$focus'
        ? s.context.focusIds
        : ref === '$created'
          ? s.context.lastCreatedIds
          : ref === '$operands'
            ? s.context.lastOperands
            : ref.startsWith('$name:')
              ? (() => {
                  const matches = s.project.volumes.filter(
                    (v) => v.name === ref.slice(6),
                  );
                  if (matches.length !== 1)
                    throw new Error(
                      'That name does not identify one volume. Which one do you mean? Describe its position or give its name.',
                    );
                  return [matches[0].id];
                })()
              : [ref],
  );
  if (!result.length)
    throw new Error(
      'Which object should I use? Describe it or give its name; you can also select it in the scene.',
    );
  const unique = [...new Set(result)];
  for (const id of unique)
    if (!s.project.volumes.some((v) => v.id === id))
      throw new Error(
        'That object is no longer in the scene. Which existing volume do you mean?',
      );
  return unique;
}
function targets(refs: string[], s: Session) {
  return resolveIds(refs, s).map((id) =>
    s.project.volumes.find((v) => v.id === id)!,
  );
}
function one(ref: string, s: Session) {
  const result = targets([ref], s);
  if (result.length !== 1)
    throw new Error('Which single volume should I change?');
  return result[0];
}
function focus(s: Session, ids: string[]) {
  s.context.focusIds = ids;
  s.project = {
    ...s.project,
    selectedId: ids.at(-1) ?? null,
    selectedIds: ids,
  };
}
const small = (v: Volume) =>
  round(Math.max(0.25, Math.max(...Object.values(v.dimensions)) * 0.1));
function extent(v: Volume, d: { x: number; y: number; z: number }) {
  const a = (v.rotation * Math.PI) / 180;
  return (
    Math.abs(d.x) *
      (Math.abs(Math.cos(a)) * v.dimensions.width +
        Math.abs(Math.sin(a)) * v.dimensions.depth) +
    Math.abs(d.y) * (isProfile(v) ? 0 : v.dimensions.height) +
    Math.abs(d.z) *
      (Math.abs(Math.sin(a)) * v.dimensions.width +
        Math.abs(Math.cos(a)) * v.dimensions.depth)
  );
}
const report = (v: Volume) =>
  `${v.name}: ${round(v.dimensions.width)} × ${round(v.dimensions.depth)} × ${round(v.dimensions.height)} m; base (${round(v.position.x)}, ${round(v.position.y)}, ${round(v.position.z)}) m.`;
export async function applyPlan(
  original: Session,
  raw: unknown,
  camera: CameraContext = defaultCamera,
  confirmed = false,
): Promise<{ session: Session; message: string }> {
  const plan = parsePlan(raw);
  if (plan.intent !== 'apply')
    return { session: original, message: plan.message };
  if (needsConfirmation(plan) && !confirmed)
    throw new Error(
      'Review the identified operands before applying this change.',
    );
  const s = structuredClone(original);
  const reports: string[] = [];
  let beforeEdit: Project | null = null;
  for (const op of plan.operations) {
    if (op.type === 'undo' || op.type === 'redo') {
      if (beforeEdit)
        throw new Error(
          'Undo/redo must precede new operations in a single request.',
        );
      const source = op.type === 'undo' ? s.past : s.future,
        destination = op.type === 'undo' ? s.future : s.past;
      if (source.length < op.count)
        throw new Error(`There are not ${op.count} changes to ${op.type}.`);
      for (let i = 0; i < op.count; i++) {
        destination.push(s.project);
        s.project = source.pop()!;
      }
      reports.push(
        `${op.type === 'undo' ? 'Undid' : 'Restored'} ${op.count} change(s).`,
      );
      continue;
    }
    beforeEdit ??= structuredClone(s.project);
    if (op.type === 'create_at') {
      if (s.project.volumes.some((v) => v.name === op.name))
        throw new Error('Use a distinct name for the new volume.');
      const v = makeVolume(s.project.volumes.length + 1, {
        width: op.width,
        depth: op.depth,
        height: ['rectangle', 'circle'].includes(op.shape) ? 0.1 : op.height,
      });
      v.name = op.name;
      v.geometry = { kind: op.shape };
      v.position = { x: op.x, y: op.y, z: op.z };
      v.rotation = ((op.rotation % 360) + 360) % 360;
      validateVolume(v);
      s.project.volumes.push(v);
      s.context.lastCreatedIds = [v.id];
      focus(s, [v.id]);
      reports.push(report(v));
    } else if (op.type === 'position') {
      const vs = targets(op.targets, s);
      for (const v of vs) {
        s.project = updateVolume(s.project, v.id, {
          position: {
            x: op.x ?? v.position.x,
            y: op.y ?? v.position.y,
            z: op.z ?? v.position.z,
          },
        });
        reports.push(
          report(s.project.volumes.find((item) => item.id === v.id)!),
        );
      }
      focus(
        s,
        vs.map((v) => v.id),
      );
    } else if (op.type === 'offset_base') {
      const upper = one(op.target, s);
      if (upper.geometry && !['box', 'rectangle'].includes(upper.geometry.kind))
        throw new Error(
          'Footprint offsets currently require a rectangular volume.',
        );
      if (s.project.volumes.some((v) => v.name === op.name))
        throw new Error('Use a distinct name for the new base.');
      const lower = makeVolume(s.project.volumes.length + 1, {
        width: upper.dimensions.width + 2 * op.offset,
        depth: upper.dimensions.depth + 2 * op.offset,
        height: op.height,
      });
      lower.name = op.name;
      lower.position = { ...upper.position, y: upper.position.y - op.height };
      lower.rotation = upper.rotation;
      validateVolume(lower);
      s.project.volumes.push(lower);
      s.context.lastCreatedIds = [lower.id];
      s.context.lastOperands = [upper.id, lower.id];
      focus(s, [upper.id]);
      reports.push(
        `${report(lower)} Footprint offset ${op.offset} m on each side. Upper volume remains selected.`,
      );
    } else if (op.type === 'center_on') {
      const v = one(op.target, s),
        ref = one(op.reference, s);
      if (v.id === ref.id)
        throw new Error('Placement needs two different objects.');
      const y =
        op.vertical === 'base'
          ? ref.position.y
          : op.vertical === 'center'
            ? ref.position.y + (ref.dimensions.height - v.dimensions.height) / 2
            : op.vertical === 'above'
              ? ref.position.y + ref.dimensions.height + op.gap
              : ref.position.y - v.dimensions.height - op.gap;
      s.project = updateVolume(s.project, v.id, {
        position: { x: ref.position.x, y, z: ref.position.z },
      });
      focus(s, [v.id]);
      s.context.lastOperands = [ref.id, v.id];
      reports.push(
        `Centered ${v.name} ${op.vertical === 'above' ? 'above' : op.vertical === 'below' ? 'below' : 'on'} ${ref.name}; base elevation ${round(y)} m.`,
      );
    } else if (op.type === 'building') {
      const v = one(op.target, s);
      if (isProfile(v))
        throw new Error('Extrude this shape before creating floors.');
      const source = structuredClone(
        v.geometry?.kind === 'building'
          ? { ...v.geometry.source, dimensions: v.dimensions }
          : v,
      );
      source.position = { x: 0, y: 0, z: 0 };
      source.rotation = 0;
      const next: Volume = {
        ...v,
        geometry: {
          kind: 'building',
          source,
          base: { ...v.dimensions },
          floors: op.floors,
          slabThickness: op.slabThickness,
          facade: op.facade,
          panelWidth: op.panelWidth,
          mullionWidth: op.mullionWidth,
        },
      };
      await solidStats(next);
      s.project = updateVolume(s.project, v.id, next);
      focus(s, [v.id]);
      reports.push(
        `${v.name}: ${op.floors} floor slabs plus a roof, ${op.slabThickness} m thick; total height ${v.dimensions.height} m and base elevation ${v.position.y} m preserved.${op.facade ? ` Curtain wall with real glass panels and frames, maximum panel width ${op.panelWidth} m.` : ''} Original envelope preserved for editing and undo.`,
      );
    } else if (op.type === 'create') {
      const created: Volume[] = [];
      for (let i = 0; i < op.count; i++) {
        const v = makeVolume(s.project.volumes.length + i + 1, {
          width: op.width,
          depth: op.depth,
          height: ['rectangle', 'circle'].includes(op.shape) ? 0.1 : op.height,
        });
        v.geometry = { kind: op.shape };
        v.position.x = i * (op.width + 2);
        created.push(v);
      }
      s.project.volumes.push(...created);
      s.context.lastCreatedIds = created.map((v) => v.id);
      focus(s, s.context.lastCreatedIds);
      reports.push(...created.map(report));
    } else if (op.type === 'select') {
      focus(s, resolveIds(op.targets, s));
      reports.push(`Selected ${s.context.focusIds.length} object(s).`);
    } else if (op.type === 'move') {
      const d = directionVector(op.direction, camera);
      const vs = targets(op.targets, s);
      for (const v of vs) {
        const n = op.distance ?? small(v);
        s.project = updateVolume(s.project, v.id, {
          position: {
            x: round(v.position.x + d.x * n),
            y: round(v.position.y + d.y * n),
            z: round(v.position.z + d.z * n),
          },
        });
        reports.push(`Moved ${v.name} ${n} m ${op.direction}.`);
      }
      focus(
        s,
        vs.map((v) => v.id),
      );
    } else if (op.type === 'resize') {
      const vs = targets(op.targets, s);
      for (const v of vs) {
        const old = v.dimensions[op.axis];
        const value =
          op.value ??
          (op.mode === 'scale' ? 1.1 : op.mode === 'add' ? small(v) : old);
        const next = round(
          op.mode === 'set'
            ? value
            : op.mode === 'add'
              ? old + value
              : old * value,
        );
        s.project = updateVolume(s.project, v.id, {
          dimensions: { ...v.dimensions, [op.axis]: next },
        });
        reports.push(`${v.name}: ${op.axis} ${next} m.`);
      }
      focus(
        s,
        vs.map((v) => v.id),
      );
    } else if (op.type === 'rotate') {
      const vs = targets(op.targets, s);
      for (const v of vs) {
        const rotation = round(
          ((((op.relative ? v.rotation : 0) + op.degrees) % 360) + 360) % 360,
        );
        s.project = updateVolume(s.project, v.id, { rotation });
        reports.push(`${v.name}: yaw ${rotation}°.`);
      }
      focus(
        s,
        vs.map((v) => v.id),
      );
    } else if (op.type === 'duplicate') {
      const vs = targets(op.targets, s);
      const d = directionVector(op.direction, camera),
        created: Volume[] = [];
      for (const v of vs)
        for (let i = 1; i <= op.count; i++) {
          const step = op.distance ?? extent(v, d) + 2;
          const copy = {
            ...structuredClone(v),
            id: crypto.randomUUID(),
            name: `${v.name.slice(0, 65)} copy ${i}`,
            position: {
              x: round(v.position.x + d.x * step * i),
              y: round(v.position.y + d.y * step * i),
              z: round(v.position.z + d.z * step * i),
            },
          };
          validateVolume(copy);
          created.push(copy);
        }
      s.project.volumes.push(...created);
      s.context.lastCreatedIds = created.map((v) => v.id);
      focus(s, [...vs.map((v) => v.id), ...created.map((v) => v.id)]);
      reports.push(
        `Created ${created.length} copies. ${op.distance === null ? 'Spacing: object extent + 2 m.' : `Center spacing: ${op.distance} m.`}`,
      );
    } else if (op.type === 'spread') {
      const vs = targets(op.targets, s);
      if (vs.length < 2)
        throw new Error(
          'Which volumes should I spread apart? I need at least two.',
        );
      const d = directionVector(op.direction, camera);
      const gap = op.gap ?? small(vs[0]);
      let offset = 0;
      for (let i = 1; i < vs.length; i++) {
        offset += (extent(vs[i - 1], d) + extent(vs[i], d)) / 2 + gap;
        s.project = updateVolume(s.project, vs[i].id, {
          position: {
            x: round(vs[0].position.x + d.x * offset),
            y: round(vs[0].position.y + d.y * offset),
            z: round(vs[0].position.z + d.z * offset),
          },
        });
      }
      focus(
        s,
        vs.map((v) => v.id),
      );
      reports.push(`Spread ${vs.length} objects with ${gap} m clear gaps.`);
    } else if (op.type === 'align') {
      const vs = targets(op.targets, s);
      if (vs.length < 2)
        throw new Error('Which volumes should I align? I need at least two.');
      for (const v of vs.slice(1))
        s.project = updateVolume(s.project, v.id, {
          position: { ...v.position, [op.axis]: vs[0].position[op.axis] },
        });
      focus(
        s,
        vs.map((v) => v.id),
      );
      reports.push(
        `Aligned base centers on ${op.axis.toUpperCase()} = ${vs[0].position[op.axis]} m.`,
      );
    } else if (op.type === 'place') {
      const v = one(op.target, s),
        ref = one(op.reference, s);
      if (v.id === ref.id)
        throw new Error('Placement needs two different objects.');
      const d = directionVector(op.direction, camera);
      const n =
        (extent(v, d) + extent(ref, d)) *
          (op.relation === 'overlap' ? 0.25 : 0.5) +
        (op.relation === 'overlap' ? 0 : (op.gap ?? 1));
      s.project = updateVolume(s.project, v.id, {
        position: {
          x: round(ref.position.x + d.x * n),
          y: round(
            d.y
              ? ref.position.y +
                  ref.dimensions.height / 2 +
                  d.y * n -
                  v.dimensions.height / 2
              : ref.position.y,
          ),
          z: round(ref.position.z + d.z * n),
        },
      });
      focus(s, [v.id]);
      s.context.lastOperands = [ref.id, v.id];
      reports.push(
        `${op.relation === 'overlap' ? 'Overlapped' : 'Placed'} ${v.name} with ${ref.name}. ${op.relation === 'next_to' ? `Gap ${op.gap ?? 1} m.` : '50% of combined bounding extents.'}`,
      );
    } else if (op.type === 'boolean') {
      const vs = targets(op.targets, s);
      if (vs.length !== 2)
        throw new Error('A Boolean needs exactly two distinct solids.');
      const result = await booleanVolume(vs[0], vs[1], op.operation);
      s.project.volumes = s.project.volumes
        .filter((v) => v.id !== vs[1].id)
        .map((v) => (v.id === vs[0].id ? result : v));
      s.context.lastOperands = vs.map((v) => v.id);
      focus(s, [result.id]);
      reports.push(
        `${op.operation}: ${round((await solidStats(result)).volume)} m³. Original operands preserved.`,
      );
    } else if (op.type === 'extrude') {
      const v = one(op.target, s);
      if (!isProfile(v) && v.geometry?.kind !== 'extrusion')
        throw new Error(
          'I can extrude a rectangular or circular profile. Which profile should I use?',
        );
      s.project = updateVolume(s.project, v.id, {
        dimensions: { ...v.dimensions, height: op.height },
        geometry: {
          kind: 'extrusion',
          profile:
            v.geometry?.kind === 'circle'
              ? 'circle'
              : v.geometry?.kind === 'extrusion'
                ? v.geometry.profile
                : 'rectangle',
        },
      });
      focus(s, [v.id]);
      reports.push(`Extruded ${v.name} to ${op.height} m.`);
    } else if (op.type === 'opening') {
      const v = one(op.target, s);
      if (
        op.width >= v.dimensions.width ||
        op.height + op.sill > v.dimensions.height ||
        Math.abs(op.offset) + op.width / 2 >= v.dimensions.width / 2
      )
        throw new Error(
          'The opening must fit within the wall width and height.',
        );
      const a = (v.rotation * Math.PI) / 180;
      const cutter = makeVolume(1, {
        width: op.width,
        height: op.height,
        depth: v.dimensions.depth + 2,
      });
      cutter.name = 'Opening cutter';
      cutter.position = {
        x: v.position.x + Math.cos(a) * op.offset,
        y: v.position.y + op.sill,
        z: v.position.z - Math.sin(a) * op.offset,
      };
      cutter.rotation = v.rotation;
      const result = await booleanVolume(v, cutter, 'subtract', true);
      s.project.volumes = s.project.volumes.map((item) =>
        item.id === v.id ? result : item,
      );
      focus(s, [v.id]);
      reports.push(
        `Cut an opening ${op.width} m wide × ${op.height} m high, sill ${op.sill} m, through local wall depth.`,
      );
    } else if (op.type === 'edit_opening') {
      const v = one(op.target, s);
      const g = v.geometry;
      if (g?.kind !== 'boolean' || !g.opening)
        throw new Error('Which existing wall opening should I change?');
      const [base, cutter] = structuredClone(g.operands);
      if (op.width !== null)
        cutter.dimensions.width = op.width / openingScale(v).width;
      if (op.height !== null)
        cutter.dimensions.height = op.height / openingScale(v).height;
      if (
        cutter.dimensions.width >= base.dimensions.width ||
        cutter.position.y + cutter.dimensions.height >
          base.position.y + base.dimensions.height
      )
        throw new Error('The opening must fit within the wall.');
      const updated = await booleanVolume(base, cutter, 'subtract', true);
      s.project = updateVolume(s.project, v.id, { geometry: updated.geometry });
      focus(s, [v.id]);
      reports.push(
        `Opening: ${op.width ?? round(cutter.dimensions.width * openingScale(v).width)} × ${op.height ?? round(cutter.dimensions.height * openingScale(v).height)} m.`,
      );
    } else if (op.type === 'delete') {
      const ids = resolveIds(op.targets, s);
      s.project.volumes = s.project.volumes.filter((v) => !ids.includes(v.id));
      focus(s, []);
      reports.push(`Removed ${ids.length} object(s); undo is available.`);
    }
    if (s.project.volumes.length > MAX_VOLUMES)
      throw new Error('This workspace supports up to 200 objects.');
    s.project.volumes.forEach((v) => validateVolume(v));
    s.context.lastOperation = op.type;
  }
  if (beforeEdit) {
    s.past = [...s.past.slice(-49), beforeEdit];
    s.future = [];
  }
  return { session: s, message: reports.join('\n') };
}
export const directPlan = (op: Operation): Plan => ({
  intent: 'apply',
  message: 'Geometry edit',
  operations: [op],
});
