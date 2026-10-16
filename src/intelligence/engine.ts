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
  sharedVolume,
} from '../geometry/kernel';
import {
  projectedExtent as extent,
  center,
  envelopeBounds,
  groupBounds,
} from '../geometry/spatial';
import { isReference } from '../imports/mesh';
import { normalizePolygon, polygonArea } from '../geometry/polygon';
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
    (raw.context.lastOperation === null ||
      (typeof raw.context.lastOperation === 'string' &&
        raw.context.lastOperation.length <= 100)) &&
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
function uniqueName(base: string, volumes: Volume[]) {
  const names = new Set(volumes.map((v) => v.name));
  let name = base.slice(0, 80),
    n = 2;
  while (names.has(name)) name = `${base.slice(0, 70)} (${n++})`;
  return name;
}
const small = (v: Volume) =>
  round(Math.max(0.25, Math.max(...Object.values(v.dimensions)) * 0.1));
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
    // Workspace effects run only after the complete geometric transaction validates.
    // They neither edit project data nor replace the last modeling context.
    if (op.type === 'workspace') continue;
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
      s.context.focusIds = (
        s.project.selectedIds?.length
          ? s.project.selectedIds
          : s.project.selectedId
            ? [s.project.selectedId]
            : []
      ).filter((id) => s.project.volumes.some((v) => v.id === id));
      reports.push(
        `${op.type === 'undo' ? 'Undid' : 'Restored'} ${op.count} change(s).`,
      );
      continue;
    }
    if (op.type === 'measure') {
      const vs = targets(op.targets, s);
      if (vs.some(isReference)) {
        reports.push(
          vs
            .map(
              (v) =>
                `${v.name}: ${v.dimensions.width} × ${v.dimensions.depth} × ${v.dimensions.height} m envelope. ${isReference(v) ? 'Imported reference surface; solid volume is unavailable.' : 'Closed solid; ask about this object separately for material measurements.'}`,
            )
            .join('\n'),
        );
        continue;
      }
      if (op.metric === 'relationship') {
        if (vs.length !== 2)
          throw new Error('Which two volumes should I compare?');
        const [a, b] = vs,
          ca = center(a),
          cb = center(b);
        const ba = envelopeBounds(a),
          bb = envelopeBounds(b);
        const gaps = (['x', 'y', 'z'] as const).map((axis) =>
          round(
            Math.max(
              0,
              bb.min[axis] - ba.max[axis],
              ba.min[axis] - bb.max[axis],
            ),
          ),
        );
        const overlap =
          isProfile(a) || isProfile(b) ? null : await sharedVolume(a, b);
        reports.push(
          `${a.name} and ${b.name}: center distance ${round(Math.hypot(ca.x - cb.x, ca.y - cb.y, ca.z - cb.z))} m. World-envelope gaps X/Y/Z: ${gaps.join(' / ')} m (bounding-envelope distances, not nearest surface distance).${overlap === null ? ' Extrude profiles to measure shared solid volume.' : ` Shared solid volume ${round(overlap)} m³.`}`,
        );
      } else
        for (const v of vs) {
          if (isProfile(v)) {
            const area =
              v.geometry?.kind === 'circle'
                ? (Math.PI * v.dimensions.width * v.dimensions.depth) / 4
                : v.geometry?.kind === 'polygon'
                  ? polygonArea(v.geometry.points) *
                    v.dimensions.width *
                    v.dimensions.depth
                  : v.dimensions.width * v.dimensions.depth;
            reports.push(
              `${v.name}: profile area ${round(area)} m²; elevation ${v.position.y} m. No solid volume until extruded.`,
            );
          } else {
            const stats = await solidStats(v);
            reports.push(
              `${report(v)} Material volume ${round(stats.volume)} m³; surface area ${round(stats.surfaceArea)} m²; lowest/highest elevation ${round(stats.bounds.min[1])} / ${round(stats.bounds.max[1])} m.${v.geometry?.kind === 'building' ? ' Material volume includes slabs, glass and frames; it is not enclosed interior volume.' : ''}`,
            );
          }
        }
      continue;
    }
    if (op.type === 'select') {
      focus(s, resolveIds(op.targets, s));
      reports.push(`Selected ${s.context.focusIds.length} object(s).`);
      continue;
    }
    beforeEdit ??= structuredClone(s.project);
    if (op.type === 'color') {
      const vs = targets(op.targets, s);
      for (const v of vs)
        s.project = updateVolume(s.project, v.id, { color: op.color });
      focus(
        s,
        vs.map((v) => v.id),
      );
      reports.push(`Updated ${vs.length} object color(s) to ${op.color}.`);
    } else if (op.type === 'person') {
      const related = s.project.volumes.filter(
        (v) => v.geometry?.kind !== 'person',
      );
      const bounds = related.length ? groupBounds(related) : null;
      const v = makeVolume(s.project.volumes.length + 1, {
        width: (0.5 * op.height) / 1.75,
        depth: (0.3 * op.height) / 1.75,
        height: op.height,
      });
      v.name = uniqueName('Scale person', s.project.volumes);
      v.color = '#d58b69';
      v.geometry = { kind: 'person' };
      v.position = op.position ?? {
        x: bounds ? bounds.max.x + 1.5 : 0,
        y: 0,
        z: bounds ? bounds.max.z + 1.5 : 0,
      };
      validateVolume(v);
      s.project.volumes.push(v);
      s.context.lastCreatedIds = [v.id];
      focus(s, [v.id]);
      reports.push(
        `Added a ${op.height} m tall person ${op.position ? 'at the requested position' : 'beside your model'}.`,
      );
    } else if (op.type === 'scale') {
      const vs = targets(op.targets, s),
        bounds = groupBounds(vs);
      const pivot = op.pivot ?? {
        x: (bounds.min.x + bounds.max.x) / 2,
        y: bounds.min.y,
        z: (bounds.min.z + bounds.max.z) / 2,
      };
      for (const v of vs)
        s.project = updateVolume(s.project, v.id, {
          geometry: v.geometry,
          dimensions: {
            width: round(v.dimensions.width * op.factor),
            height: round(v.dimensions.height * op.factor),
            depth: round(v.dimensions.depth * op.factor),
          },
          position: {
            x: round(pivot.x + (v.position.x - pivot.x) * op.factor),
            y: round(pivot.y + (v.position.y - pivot.y) * op.factor),
            z: round(pivot.z + (v.position.z - pivot.z) * op.factor),
          },
        });
      focus(
        s,
        vs.map((v) => v.id),
      );
      reports.push(
        `Scaled ${vs.length} objects and their spacing by ${op.factor}, about (${pivot.x}, ${pivot.y}, ${pivot.z}) m.`,
      );
    } else if (op.type === 'stretch') {
      const vs = targets(op.targets, s);
      for (const v of vs) {
        const g = v.geometry;
        if (
          g &&
          !(
            g.kind === 'box' ||
            g.kind === 'rectangle' ||
            (g.kind === 'extrusion' && g.profile === 'rectangle')
          )
        )
          throw new Error(
            'End-face stretch currently supports rectangular volumes and profiles. Which rectangular face should move?',
          );
        if (isProfile(v) && op.axis === 'height')
          throw new Error('Extrude this profile before stretching its height.');
        const sign = op.side === 'max' ? 1 : -1,
          a = (v.rotation * Math.PI) / 180;
        const shift = (op.distance * sign) / 2;
        const position = { ...v.position };
        if (op.axis === 'height')
          position.y += op.side === 'min' ? -op.distance : 0;
        else {
          position.x +=
            shift * (op.axis === 'width' ? Math.cos(a) : Math.sin(a));
          position.z +=
            shift * (op.axis === 'width' ? -Math.sin(a) : Math.cos(a));
        }
        s.project = updateVolume(s.project, v.id, {
          dimensions: {
            ...v.dimensions,
            [op.axis]: round(v.dimensions[op.axis] + op.distance),
          },
          position,
        });
      }
      focus(
        s,
        vs.map((v) => v.id),
      );
      reports.push(
        `Stretched ${op.side} ${op.axis} face by ${op.distance} m, holding the opposite face fixed.`,
      );
    } else if (op.type === 'mirror') {
      const vs = targets(op.targets, s),
        created: Volume[] = [];
      if (op.copy && s.project.volumes.length + vs.length > MAX_VOLUMES)
        throw new Error('This workspace supports up to 200 objects.');
      for (const v of vs) {
        if (isProfile(v) || isReference(v))
          throw new Error(
            'Mirror currently requires a closed 3D solid. Extrude the profile or import a watertight solid first.',
          );
        const next: Volume = {
          ...structuredClone(v),
          id: op.copy ? crypto.randomUUID() : v.id,
          name: op.copy
            ? uniqueName(`${v.name} mirrored`, [
                ...s.project.volumes,
                ...created,
              ])
            : v.name,
          position: {
            ...v.position,
            [op.axis]: 2 * op.coordinate - v.position[op.axis],
          },
          rotation: ((-v.rotation % 360) + 360) % 360,
          geometry: {
            kind: 'mirror',
            source: structuredClone(v),
            axis: op.axis,
          },
        };
        validateVolume(next);
        await solidStats(next);
        if (op.copy) created.push(next);
        else s.project = updateVolume(s.project, v.id, next);
      }
      s.project.volumes.push(...created);
      const result = op.copy ? created : vs;
      if (op.copy) s.context.lastCreatedIds = created.map((v) => v.id);
      focus(
        s,
        result.map((v) => v.id),
      );
      reports.push(
        `Mirrored ${vs.length} solid(s) across ${op.axis.toUpperCase()}=${op.coordinate} m; ${op.copy ? 'originals retained' : 'original geometry retained in operation history'}.`,
      );
    } else if (op.type === 'array_grid' || op.type === 'array_polar') {
      const vs = targets(op.targets, s),
        created: Volume[] = [];
      const count = op.type === 'array_grid' ? op.rows * op.columns : op.count;
      if (
        count > 100 ||
        s.project.volumes.length + vs.length * (count - 1) > MAX_VOLUMES
      )
        throw new Error(
          'This array exceeds the 200-object workspace limit or 100-instance array limit.',
        );
      for (let i = 1; i < count; i++)
        for (const v of vs) {
          const copy = {
            ...structuredClone(v),
            id: crypto.randomUUID(),
            name: uniqueName(`${v.name} copy`, [
              ...s.project.volumes,
              ...created,
            ]),
          };
          if (op.type === 'array_grid') {
            copy.position.x += (i % op.columns) * op.spacingX;
            copy.position.z += Math.floor(i / op.columns) * op.spacingZ;
          } else {
            const degrees =
                (op.angle * i) /
                (Math.abs(op.angle) === 360 ? count : count - 1),
              a = (degrees * Math.PI) / 180;
            const x = v.position.x - op.center.x,
              z = v.position.z - op.center.z;
            copy.position.x = round(
              op.center.x + x * Math.cos(a) + z * Math.sin(a),
            );
            copy.position.z = round(
              op.center.z - x * Math.sin(a) + z * Math.cos(a),
            );
            if (op.rotate)
              copy.rotation = (((v.rotation + degrees) % 360) + 360) % 360;
          }
          validateVolume(copy);
          created.push(copy);
        }
      s.project.volumes.push(...created);
      s.context.lastCreatedIds = created.map((v) => v.id);
      focus(
        s,
        [...vs, ...created].map((v) => v.id),
      );
      reports.push(
        `Created ${count} array instances including the original group (${created.length} new objects).`,
      );
    } else if (op.type === 'footprint') {
      if (s.project.volumes.some((v) => v.name === op.name))
        throw new Error('Use a distinct name for the new footprint.');
      const p = normalizePolygon(op.points);
      const v = makeVolume(s.project.volumes.length + 1, {
        width: p.width,
        depth: p.depth,
        height: op.extruded ? op.height : 0.1,
      });
      v.name = op.name;
      v.geometry = { kind: 'polygon', points: p.points, extruded: op.extruded };
      v.position = { x: op.x, y: op.y, z: op.z };
      v.rotation = ((op.rotation % 360) + 360) % 360;
      validateVolume(v);
      if (op.extruded) await solidStats(v);
      s.project.volumes.push(v);
      s.context.lastCreatedIds = [v.id];
      focus(s, [v.id]);
      reports.push(
        `${report(v)} Footprint area ${round(polygonArea(op.points))} m².`,
      );
    } else if (op.type === 'rename') {
      const v = one(op.target, s);
      const name = op.name.trim();
      if (
        s.project.volumes.some(
          (other) => other.id !== v.id && other.name === name,
        )
      )
        throw new Error(
          'Another volume already has that name. Choose a distinct name.',
        );
      s.project = updateVolume(s.project, v.id, { name });
      focus(s, [v.id]);
      reports.push(`Named ${v.name} “${name}”.`);
    } else if (op.type === 'rotate_group') {
      const vs = targets(op.targets, s);
      const bounds = groupBounds(vs);
      const pivot = op.pivot
        ? center(one(op.pivot, s))
        : {
            x: (bounds.min.x + bounds.max.x) / 2,
            y: 0,
            z: (bounds.min.z + bounds.max.z) / 2,
          };
      const a = (op.degrees * Math.PI) / 180;
      for (const v of vs) {
        const x = v.position.x - pivot.x,
          z = v.position.z - pivot.z;
        s.project = updateVolume(s.project, v.id, {
          position: {
            x: round(pivot.x + x * Math.cos(a) + z * Math.sin(a)),
            y: v.position.y,
            z: round(pivot.z - x * Math.sin(a) + z * Math.cos(a)),
          },
          rotation: round((((v.rotation + op.degrees) % 360) + 360) % 360),
        });
      }
      focus(
        s,
        vs.map((v) => v.id),
      );
      reports.push(
        `Rotated ${vs.length} volumes together ${op.degrees}° around ${op.pivot ? 'the reference volume' : 'their shared center'}; relative layout and elevations preserved.`,
      );
    } else if (op.type === 'align_edges') {
      const vs = targets(op.targets, s);
      if (vs.length < 2)
        throw new Error('Which volumes should I align? I need at least two.');
      const value = (v: Volume) =>
        op.edge === 'center'
          ? center(v)[op.axis]
          : envelopeBounds(v)[op.edge][op.axis];
      const reference = value(vs[0]);
      for (const v of vs.slice(1))
        s.project = updateVolume(s.project, v.id, {
          position: {
            ...v.position,
            [op.axis]: round(v.position[op.axis] + reference - value(v)),
          },
        });
      focus(
        s,
        vs.map((v) => v.id),
      );
      reports.push(
        `Aligned ${vs.length} volumes by ${op.edge === 'max' && op.axis === 'y' ? 'top elevation' : `${op.edge} world-envelope ${op.axis.toUpperCase()}`} at ${round(reference)} m.`,
      );
    } else if (op.type === 'create_at') {
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
    } else if (op.type === 'move') {
      const d = directionVector(op.direction, camera);
      const vs = targets(op.targets, s);
      const n = op.distance ?? Math.max(...vs.map(small));
      for (const v of vs) {
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
      const projections = vs.map((v) => ({
        center: center(v).x * d.x + center(v).y * d.y + center(v).z * d.z,
        half: extent(v, d) / 2,
      }));
      const step =
        op.distance ??
        Math.max(...projections.map((p) => p.center + p.half)) -
          Math.min(...projections.map((p) => p.center - p.half)) +
          2;
      if (s.project.volumes.length + vs.length * op.count > MAX_VOLUMES)
        throw new Error('This workspace supports up to 200 objects.');
      for (const v of vs)
        for (let i = 1; i <= op.count; i++) {
          const copy = {
            ...structuredClone(v),
            id: crypto.randomUUID(),
            name: uniqueName(`${v.name.slice(0, 65)} copy ${i}`, [
              ...s.project.volumes,
              ...created,
            ]),
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
        `Created ${created.length} copies. ${op.distance === null ? `Center spacing: group extent + 2 m (${round(step)} m).` : `Center spacing: ${op.distance} m.`}`,
      );
    } else if (op.type === 'spread') {
      const vs = targets(op.targets, s);
      if (vs.length < 2)
        throw new Error(
          'Which volumes should I spread apart? I need at least two.',
        );
      const d = directionVector(op.direction, camera);
      const currentGaps = vs.slice(1).map((v, i) => {
        const a = center(vs[i]),
          b = center(v);
        return (
          (b.x - a.x) * d.x +
          (b.y - a.y) * d.y +
          (b.z - a.z) * d.z -
          (extent(vs[i], d) + extent(v, d)) / 2
        );
      });
      const gap =
        op.gap ??
        round(Math.max(0, ...currentGaps) + Math.max(...vs.map(small)));
      let offset = 0;
      for (let i = 1; i < vs.length; i++) {
        offset += (extent(vs[i - 1], d) + extent(vs[i], d)) / 2 + gap;
        s.project = updateVolume(s.project, vs[i].id, {
          position: {
            x: round(vs[0].position.x + d.x * offset),
            y: round(
              vs[0].position.y +
                (d.y
                  ? vs[0].dimensions.height / 2 - vs[i].dimensions.height / 2
                  : 0) +
                d.y * offset,
            ),
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
      if (
        !isProfile(v) &&
        v.geometry?.kind !== 'extrusion' &&
        v.geometry?.kind !== 'polygon'
      )
        throw new Error('Which flat footprint should I extrude?');
      s.project = updateVolume(s.project, v.id, {
        dimensions: { ...v.dimensions, height: op.height },
        geometry:
          v.geometry?.kind === 'polygon'
            ? { ...v.geometry, extruded: true }
            : {
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
      const wallAngle = (base.rotation * Math.PI) / 180;
      const localOffset =
        (cutter.position.x - base.position.x) * Math.cos(wallAngle) -
        (cutter.position.z - base.position.z) * Math.sin(wallAngle);
      if (
        Math.abs(localOffset) + cutter.dimensions.width / 2 >=
          base.dimensions.width / 2 ||
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
    for (const v of s.project.volumes) {
      const previous = beforeEdit.volumes.find((old) => old.id === v.id);
      if (
        !isProfile(v) &&
        !isReference(v) &&
        (!previous ||
          JSON.stringify([previous.dimensions, previous.geometry]) !==
            JSON.stringify([v.dimensions, v.geometry]))
      ) {
        const stats = await solidStats(v);
        if (stats.volume < 0.000001)
          throw new Error(
            'This change leaves no solid. Your previous geometry was preserved.',
          );
      }
    }
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
