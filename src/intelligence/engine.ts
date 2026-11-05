import { sculptVolume, smoothBoolean, reviseBlend } from '../geometry/sculpt';
import { organicMesh } from '../geometry/organic';
import type { OrganicDefinition } from '../geometry/organicSchema';
import { solarPosition } from '../studio/solar';
import { solarDay, shadowOnLevelGround } from '../studio/solarAnalysis';
import { constructAssembly, remapCopiedHosts } from './assembly';
import {
  profileVolume,
  anchoredDimensions,
  constrainedResize,
  splitLevels,
  bridgeVolume,
  glazeOpening,
} from './volumetric';
import { isVisible } from '../model';
import { equalData } from '../projects/equalData';
import { designBriefSchema } from './designBriefSchema';
import { furnishRoom } from '../design/layout';
import { componentInfo, propagateHosted } from '../design/model';
import { resolveWalkPlacement } from '../studio/walkPlacement';
import { encodeSession, decodeSession } from '../projects/sessionCodec';
import { setObjectVisibility } from '../studio/visibility';
import {
  isLocked,
  makeVolume,
  MAX_VOLUMES,
  parseProject,
  parseProjectValue,
  round,
  serializeProject,
  updateVolume as updateSingleVolume,
  validateVolume,
  type Project,
  type Volume,
  type Vec3,
} from '../model';
import {
  getKernel,
  editableBuildingComponents,
  orientVolume,
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
import { formMesh, type FormDefinition } from '../geometry/forms';
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
// Apply host constraints once per complete operation, so explicit group edits
// are not applied twice to components.
const updateVolume = (
  p: Project,
  id: string,
  patch: Partial<Omit<Volume, 'id'>>,
) => updateSingleVolume(p, id, patch, false);
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
  const raw = decodeSession(JSON.parse(text));
  if (
    raw.version !== 2 ||
    !Array.isArray(raw.past) ||
    !Array.isArray(raw.future) ||
    raw.past.length > 50 ||
    raw.future.length > 50
  )
    throw new Error('Invalid session history.');
  const read = (p: unknown) =>
    parseProjectValue({ version: 2, ...(p as object) });
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
  ) {
    // A stale or malformed optional reasoning record must never prevent the
    // user's otherwise valid project and history from loading.
    const { lastBrief, ...context } = raw.context;
    const parsedBrief = designBriefSchema.safeParse(lastBrief);
    session.context = {
      ...context,
      ...(parsedBrief.success ? { lastBrief: parsedBrief.data } : {}),
    };
  }
  return session;
}
export const serializeSession = (s: Session) => encodeSession(s);
export function commitProject(s: Session, project: Project): Session {
  if (serializeProject(s.project) === serializeProject(project)) return s;
  return { ...s, project, past: [...s.past.slice(-49), s.project], future: [] };
}
export function resolveIds(refs: string[], s: Session): string[] {
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
            : ref.startsWith('$group:')
              ? (() => {
                  const name = ref.slice(7);
                  const groups = (s.project.groups ?? []).filter(
                    (g) => g.id === name || g.name === name,
                  );
                  if (groups.length !== 1)
                    throw new Error(
                      'That group does not identify one assembly. Use a unique group name or ID.',
                    );
                  return s.project.volumes
                    .filter((v) => v.groupId === groups[0].id)
                    .map((v) => v.id);
                })()
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
async function separateBuilding(s: Session, v: Volume): Promise<string> {
  if (isLocked(v, s.project))
    throw new Error('Unlock this group before editing its components.');
  const components = await editableBuildingComponents(v);
  if (s.project.volumes.length - 1 + components.length > MAX_VOLUMES)
    throw new Error(
      'The components would exceed the 200-object workspace limit. Use fewer floors or wider panels first.',
    );
  if (!v.groupId) {
    if ((s.project.groups?.length ?? 0) >= 50)
      throw new Error('The workspace already has 50 groups.');
    const group = {
      id: crypto.randomUUID(),
      name: v.name,
      visible: true,
      locked: false,
    };
    s.project.groups = [...(s.project.groups ?? []), group];
    components.forEach((c) => (c.groupId = group.id));
  }
  s.project.volumes = s.project.volumes.flatMap((o) =>
    o.id === v.id ? components : [o],
  );
  s.context.lastCreatedIds = components.map((c) => c.id);
  focus(s, [components[0].id]);
  return `${v.name}: ${components.length} editable slabs, windows and frame members. Select any part to move, resize or recolor it. Parts stay grouped; Undo restores the preceding model.`;
}

export async function applyPlan(
  original: Session,
  raw: unknown,
  camera: CameraContext = defaultCamera,
  confirmed = false,
): Promise<{ session: Session; message: string }> {
  let current: { type: string; index: number } | undefined;
  try {
    return await applyTransaction(
      original,
      raw,
      camera,
      confirmed,
      (op, index) => {
        current = op ? { type: op.type, index } : undefined;
      },
    );
  } catch (error) {
    if (!current) throw error;
    throw new Error(
      `Step ${current.index + 1} (${current.type}): ${error instanceof Error ? error.message : 'Geometry validation failed.'}`,
    );
  }
}

async function applyTransaction(
  original: Session,
  raw: unknown,
  camera: CameraContext,
  confirmed: boolean,
  operationStarted: (op: Operation | null, index: number) => void,
): Promise<{ session: Session; message: string }> {
  const plan = parsePlan(raw);
  if (plan.intent !== 'apply')
    return { session: original, message: plan.message };
  if (needsConfirmation(plan) && !confirmed)
    throw new Error(
      'Review the identified operands before applying this change.',
    );
  const copyProject = (p: Project): Project => ({
    ...p,
    volumes: p.volumes.map((v) => ({
      ...v,
      position: { ...v.position },
      dimensions: { ...v.dimensions },
      component: v.component ? { ...v.component } : undefined,
    })),
    groups: p.groups?.map((g) => ({ ...g })),
    selectedIds: p.selectedIds ? [...p.selectedIds] : undefined,
    design: p.design
      ? {
          ...p.design,
          views: [...p.design.views],
          options: [...p.design.options],
          notes: p.design.notes?.map((n) => ({ ...n })),
        }
      : undefined,
  });
  const s: Session = {
    project: copyProject(original.project),
    past: [...original.past],
    future: [...original.future],
    context: structuredClone(original.context),
  };
  const reports: string[] = [];
  let beforeEdit: Project | null = null;
  for (const [operationIndex, op] of plan.operations.entries()) {
    operationStarted(op, operationIndex);
    // Workspace effects run only after the complete geometric transaction validates.
    // They neither edit project data nor replace the last modeling context.
    if (
      op.type === 'workspace' ||
      op.type === 'section' ||
      op.type === 'walk_to' ||
      op.type === 'explore' ||
      op.type === 'show_view'
    )
      continue;
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
        s.project = copyProject(source.pop()!);
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
    if (op.type === 'solar_study') {
      const site = s.project.site;
      if (!site)
        throw new Error(
          'Set the project site location before calculating a solar study.',
        );
      const sun = solarPosition(site, op),
        day = solarDay(site, op);
      reports.push(
        `Solar study ${op.date}, ${String(Math.floor(op.minutes / 60)).padStart(2, '0')}:${String(op.minutes % 60).padStart(2, '0')} UTC${op.utcOffset >= 0 ? '+' : ''}${op.utcOffset}: altitude ${round(sun.altitude)}°, azimuth ${round(sun.azimuth)}° clockwise from true north. Sunrise ${day.sunrise ?? 'none'}, solar noon ${day.noon}, sunset ${day.sunset ?? 'none'} (site civil time).${day.polar ? ` Polar ${day.polar}.` : ''}`,
      );
      if (op.targets.length) {
        const vs = targets(op.targets, s);
        for (const v of vs.slice(0, 20)) {
          const shadow = shadowOnLevelGround(
            site,
            op,
            v.position.y + v.dimensions.height,
          );
          const a = (v.rotation * Math.PI) / 180;
          const fronts = [
            ['front', Math.sin(a), Math.cos(a)],
            ['back', -Math.sin(a), -Math.cos(a)],
            ['right', Math.cos(a), -Math.sin(a)],
            ['left', -Math.cos(a), Math.sin(a)],
          ] as const;
          const facing =
            sun.altitude > 0
              ? fronts
                  .filter(
                    ([, x, z]) =>
                      x * sun.direction.x + z * sun.direction.z > 0.01,
                  )
                  .map(([side]) => side)
                  .join(', ')
              : 'none';
          reports.push(
            `${v.name}: potentially sun-facing local sides: ${facing}. ${shadow ? `Top-point shadow on level project ground: ${round(shadow.length)} m horizontally.` : 'Sun below horizon; no direct solar shadow.'}`,
          );
        }
        if (vs.length > 20)
          reports.push(
            `Showing the first 20 of ${vs.length} targets; narrow selection for individual analysis.`,
          );
      }
      reports.push(
        'Directional concept analysis only: neighboring occlusion, terrain, weather and energy performance are not evaluated.',
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
    if (op.type === 'verify') {
      const vs = targets(op.targets, s);
      const values =
        op.metric === 'count'
          ? [vs.length]
          : await Promise.all(
              vs.map(async (v) =>
                op.metric === 'volume'
                  ? (await solidStats(v)).volume
                  : op.metric === 'base'
                    ? v.position.y
                    : op.metric === 'top'
                      ? v.position.y + v.dimensions.height
                      : v.dimensions[op.metric as 'width' | 'height' | 'depth'],
              ),
            );
      const ok = values.every((n) =>
        op.comparison === 'equal'
          ? Math.abs(n - op.value) <= op.tolerance + 1e-8
          : op.comparison === 'at_least'
            ? n >= op.value - op.tolerance
            : n <= op.value + op.tolerance,
      );
      if (!ok)
        throw new Error(
          `Verification failed: ${op.metric} expected ${op.comparison} ${op.value}, measured ${values.map(round).join(', ')}. No changes committed.`,
        );
      reports.push(
        `Verified ${op.metric}: ${values.map(round).join(', ')} (${vs.length} element(s)).`,
      );
      continue;
    }
    if (op.type === 'verify_relation') {
      const vs = targets(op.targets, s);
      if (vs.length !== 2)
        throw new Error('A relation needs two distinct solids.');
      const shared = await sharedVolume(vs[0], vs[1]);
      const ok =
        op.relation === 'disjoint'
          ? shared <= op.tolerance
          : op.relation === 'intersects'
            ? shared > op.tolerance
            : Math.abs((await solidStats(vs[0])).volume - shared) <=
              op.tolerance;
      if (!ok)
        throw new Error(
          `Verification failed: ${op.relation}; shared volume is ${round(shared)} m³. No changes committed.`,
        );
      reports.push(
        `Verified ${op.relation}: shared solid volume ${round(shared)} m³. Boundary contact alone is not a volume intersection.`,
      );
      continue;
    }
    if (op.type === 'select_query') {
      const scope = op.scope ? new Set(resolveIds(op.scope, s)) : null;
      const matches = s.project.volumes.filter(
        (v) =>
          (!scope || scope.has(v.id)) &&
          (op.role === null || componentInfo(v).role === op.role) &&
          (op.level === null || v.component?.level === op.level) &&
          (op.material === null || (v.material ?? 'solid') === op.material) &&
          (op.nameContains === null ||
            v.name
              .toLocaleLowerCase()
              .includes(op.nameContains.toLocaleLowerCase())) &&
          (op.visible === null || isVisible(v, s.project) === op.visible),
      );
      if (!matches.length)
        throw new Error(
          'No elements match that component query. Inspect the current scene roles, levels and groups.',
        );
      focus(
        s,
        matches.map((v) => v.id),
      );
      reports.push(
        `Selected ${matches.length} matching element(s): ${matches.map((v) => v.name).join(', ')}.`,
      );
      continue;
    }
    if (op.type === 'select') {
      focus(s, resolveIds(op.targets, s));
      reports.push(`Selected ${s.context.focusIds.length} object(s).`);
      continue;
    }
    const operationBefore = s.project.volumes;
    const lockedBefore = s.project.volumes
      .filter((v) => isLocked(v, s.project))
      .map((v) => ({
        ...v,
        position: { ...v.position },
        dimensions: { ...v.dimensions },
        component: v.component ? { ...v.component } : undefined,
      }));
    beforeEdit ??= copyProject(s.project);
    if (op.type === 'profile_solid') {
      const vs = op.targets.length ? targets(op.targets, s) : [null];
      const made: Volume[] = [];
      for (const v of vs) made.push(await profileVolume(v, op));
      for (const v of made) {
        const index = s.project.volumes.findIndex((o) => o.id === v.id);
        if (index >= 0) s.project.volumes[index] = v;
        else {
          v.name = uniqueName(v.name, s.project.volumes);
          s.project.volumes.push(v);
        }
      }
      focus(
        s,
        made.map((v) => v.id),
      );
      if (!op.targets.length) s.context.lastCreatedIds = made.map((v) => v.id);
      reports.push(
        `Created or replaced ${made.length} ${op.shape} section(s), extruded along local ${op.axis.toUpperCase()}. Existing identities and placements retained.`,
        ...made.map(report),
      );
    } else if (op.type === 'glaze_opening') {
      const wall = one(op.target, s);
      if (isLocked(wall, s.project))
        throw new Error('Unlock the wall group before adding glazing.');
      const parts = await glazeOpening(wall, s.project.volumes, op);
      const created: string[] = [];
      for (const part of parts) {
        const index = s.project.volumes.findIndex((v) => v.id === part.id);
        if (index >= 0) s.project.volumes[index] = part;
        else {
          part.name = uniqueName(part.name, s.project.volumes);
          s.project.volumes.push(part);
          created.push(part.id);
        }
      }
      if (created.length) s.context.lastCreatedIds = created;
      focus(s, [wall.id]);
      reports.push(
        `Fitted editable glazing and a solid frame to the latest opening. Frame inset ${op.frameWidth} m, frame depth ${op.frameDepth} m, pane ${op.paneThickness} m.`,
        ...parts.map(report),
      );
    } else if (op.type === 'opening_shape') {
      const v = one(op.target, s),
        g = v.geometry;
      if (g?.kind !== 'boolean' || !g.opening)
        throw new Error(
          'Select the wall with the most recent editable opening.',
        );
      const [base, cutter] = g.operands;
      const nextCutter = await profileVolume(cutter, {
        type: 'profile_solid',
        targets: [cutter.id],
        name: cutter.name,
        position: cutter.position,
        dimensions: null,
        axis: 'z',
        shape: op.shape,
        web: null,
        flange: null,
        points: null,
      });
      const result = await booleanVolume(base, nextCutter, 'subtract', true);
      // Keep the outer transform: edits also work after moving/scaling the wall.
      s.project = updateVolume(s.project, v.id, { geometry: result.geometry });
      focus(s, [v.id]);
      reports.push(
        `Rebuilt the latest opening as ${op.shape}; earlier cuts and wall identity retained.`,
      );
    } else if (op.type === 'constrained_resize') {
      const vs = targets(op.targets, s);
      for (const v of vs) {
        const next = constrainedResize(v, op);
        if (op.preserveVolume) {
          const before = (await solidStats(v)).volume,
            after = (await solidStats(next)).volume;
          if (Math.abs(before - after) > Math.max(1e-6, before * 1e-6))
            throw new Error(
              'The volume constraint could not be satisfied. Original geometry retained.',
            );
        }
        s.project = updateVolume(s.project, v.id, {
          dimensions: next.dimensions,
          position: next.position,
          // Explicit affine resize: do not regenerate shells at fixed thickness.
          geometry: next.geometry,
        });
      }
      focus(
        s,
        vs.map((v) => v.id),
      );
      reports.push(
        `Resized ${vs.length} element(s) about the specified local anchor${op.preserveVolume ? ', preserving evaluated volume by compensating both other axes' : ''}.`,
      );
    } else if (op.type === 'split_levels') {
      const v = one(op.target, s);
      if (s.project.volumes.some((o) => o.component?.hostId === v.id))
        throw new Error(
          'This volume hosts editable components. Split an independent mass or explicitly reorganize its children first.',
        );
      if (s.project.volumes.length + op.levels.length - 1 > MAX_VOLUMES)
        throw new Error('The level schedule exceeds the scene object limit.');
      const pieces = await splitLevels(v, op);
      s.project.volumes = s.project.volumes.flatMap((o) =>
        o.id === v.id ? pieces : [o],
      );
      s.context.lastCreatedIds = pieces.map((v) => v.id);
      focus(s, s.context.lastCreatedIds);
      reports.push(
        `Split into ${pieces.length} independently editable levels using real solid intersections. Original source retained in each recipe.`,
        ...pieces.map(report),
      );
    } else if (op.type === 'progressive_array') {
      const v = one(op.target, s);
      if (s.project.volumes.some((o) => o.component?.hostId === v.id))
        throw new Error(
          'This element hosts components. Use a group array to preserve the assembly, or select an independent solid.',
        );
      if (s.project.volumes.length + op.count - 1 > MAX_VOLUMES)
        throw new Error(
          'The progressive array exceeds the scene object limit.',
        );
      const copies: Volume[] = [];
      for (let i = 1; i < op.count; i++) {
        const copy = anchoredDimensions(
          v,
          {
            width: v.dimensions.width * op.scaleStep.x ** i,
            height: v.dimensions.height * op.scaleStep.y ** i,
            depth: v.dimensions.depth * op.scaleStep.z ** i,
          },
          op.anchor,
          v.rotation + op.rotationStep * i,
        );
        copy.id = crypto.randomUUID();
        copy.name = uniqueName(`${v.name} ${i + 1}`, [
          ...s.project.volumes,
          ...copies,
        ]);
        copy.position = {
          x: copy.position.x + op.step.x * i,
          y: copy.position.y + op.step.y * i,
          z: copy.position.z + op.step.z * i,
        };
        if (copy.component)
          copy.component = { ...copy.component, hostId: null };
        validateVolume(copy);
        copies.push(copy);
      }
      s.project.volumes.push(...copies);
      s.context.lastCreatedIds = copies.map((v) => v.id);
      focus(s, [v.id, ...s.context.lastCreatedIds]);
      reports.push(
        `${op.count} elements including the original; multiplicative scale increments and world-space spacing.`,
        ...copies.map(report),
      );
    } else if (op.type === 'bridge') {
      const vs = targets(op.targets, s);
      if (vs.length !== 2)
        throw new Error('Choose two different volumes to connect.');
      const v = await bridgeVolume(vs[0], vs[1], op);
      v.name = uniqueName(v.name, s.project.volumes);
      s.project.volumes.push(v);
      s.context.lastCreatedIds = [v.id];
      focus(s, [v.id]);
      reports.push(
        `${report(v)} Verified a solid connection to both landings; this is geometric, not structural certification.`,
      );
    } else if (op.type === 'assembly') {
      const result = constructAssembly(s.project, op);
      if (result.newGroup)
        s.project.groups = [...(s.project.groups ?? []), result.group];
      s.project.volumes.push(...result.created);
      s.context.lastCreatedIds = result.created.map((v) => v.id);
      focus(s, s.context.lastCreatedIds);
      reports.push(
        `${op.name}: ${result.created.length} independently editable elements.`,
        ...result.created.map(report),
      );
    } else if (op.type === 'design_note') {
      const design = s.project.design ?? { views: [], options: [] };
      const notes = [
        ...(design.notes ?? []).filter((n) => n.topic !== op.topic),
        { topic: op.topic, text: op.text, source: op.source },
      ];
      if (notes.length > 40)
        throw new Error(
          'Design memory has 40 topics. Update an existing topic instead.',
        );
      s.project.design = { ...design, notes };
      reports.push(
        `Recorded ${op.source} design note: ${op.topic}. ${op.text}`,
      );
    } else if (op.type === 'material') {
      const vs = targets(op.targets, s);
      for (const v of vs)
        s.project = updateVolume(s.project, v.id, { material: op.material });
      focus(
        s,
        vs.map((v) => v.id),
      );
      reports.push(`Set ${vs.length} element(s) to ${op.material}.`);
    } else if (op.type === 'component') {
      const ids = resolveIds(op.targets, s);
      const hostId = op.settings.hostId ? one(op.settings.hostId, s).id : null;
      if (hostId && ids.includes(hostId))
        throw new Error('An element cannot host itself.');
      s.project.volumes = s.project.volumes.map((v) =>
        ids.includes(v.id)
          ? { ...v, component: { ...op.settings, hostId } }
          : v,
      );
      for (const v of s.project.volumes) {
        const visited = new Set<string>();
        let parent: Volume | undefined = v;
        while (parent?.component?.hostId) {
          if (visited.has(parent.id))
            throw new Error('Component relationships cannot contain cycles.');
          visited.add(parent.id);
          parent = s.project.volumes.find(
            (o) => o.id === parent!.component!.hostId,
          );
        }
      }
      reports.push(`Identified ${ids.length} ${op.settings.role} element(s).`);
    } else if (op.type === 'alternative') {
      const library = s.project.design ?? { views: [], options: [] };
      const option = library.options.find((o) => o.name === op.name);
      if (op.action === 'save') {
        if (!option && library.options.length >= 6)
          throw new Error(
            'Keep up to six alternatives. Delete an unused option first.',
          );
        s.project.design = {
          ...library,
          options: [
            ...library.options.filter((o) => o.name !== op.name),
            {
              name: op.name,
              volumes: s.project.volumes.map((v) => ({ ...v })),
              groups: (s.project.groups ?? []).map((g) => ({ ...g })),
            },
          ],
        };
        reports.push(`Saved editable alternative “${op.name}”.`);
      } else {
        if (!option) throw new Error('Which saved alternative should I use?');
        if (op.action === 'delete')
          s.project.design = {
            ...library,
            options: library.options.filter((o) => o !== option),
          };
        else {
          s.project = {
            ...s.project,
            volumes: option.volumes.map((v) => ({ ...v })),
            groups: option.groups.map((g) => ({ ...g })),
            selectedId: null,
            selectedIds: [],
          };
          focus(s, []);
        }
        reports.push(
          op.action === 'restore'
            ? `Applied “${op.name}”. Undo restores your previous composition.`
            : `Removed alternative “${op.name}”; current geometry is unchanged.`,
        );
      }
    } else if (op.type === 'save_view' || op.type === 'room_views') {
      const library = s.project.design ?? { views: [], options: [] };
      const requests =
        op.type === 'room_views'
          ? s.project.volumes
              .filter((v) => v.component?.role === 'room')
              .map((v) => ({ name: v.name, targets: [v.id], cutaway: true }))
          : [
              {
                name: op.name,
                targets: op.targets.length ? resolveIds(op.targets, s) : [],
                cutaway: op.cutaway,
              },
            ];
      if (!requests.length)
        throw new Error(
          'Identify the room envelopes first; imported triangles do not describe rooms automatically.',
        );
      let views = [...library.views];
      for (const request of requests) {
        const vs = request.targets.map((id) =>
          s.project.volumes.find((v) => v.id === id)!,
        );
        const b = vs.length ? groupBounds(vs) : null;
        if (!vs.length && !camera.pose)
          throw new Error(
            'The camera is not ready. Try saving the view again.',
          );
        const saved = {
          name: request.name,
          pose: vs.length ? null : camera.pose!,
          targets: request.targets,
          section:
            request.cutaway && b
              ? {
                  enabled: true,
                  planeVisible: false,
                  axis: 'y' as const,
                  position: b.min.y + (b.max.y - b.min.y) * 0.65,
                  flip: false,
                }
              : null,
        };
        views = [...views.filter((v) => v.name !== saved.name), saved];
      }
      if (views.length > 30)
        throw new Error('This project supports thirty saved views.');
      s.project.design = { ...library, views };
      reports.push(`Saved ${requests.length} view(s). Geometry is unchanged.`);
    } else if (op.type === 'furnish') {
      const room = one(op.room, s),
        created = furnishRoom(s.project, room, op.layout, op.clearance);
      if ((s.project.groups?.length ?? 0) >= 50)
        throw new Error('The workspace already has fifty groups.');
      s.project.groups = [
        ...(s.project.groups ?? []),
        {
          id: created[0].groupId!,
          name: `${room.name} · ${op.layout}`,
          visible: true,
          locked: false,
        },
      ];
      s.project.volumes.push(...created);
      focus(
        s,
        created.map((v) => v.id),
      );
      reports.push(
        `Placed ${created.length} editable concept furniture parts in ${room.name}, with ${op.clearance} m perimeter clearance. Checked room fit and existing-object envelope collisions; this is not a code or egress assessment.`,
      );
    } else if (op.type === 'visibility') {
      const ids = resolveIds(op.targets, s);
      s.project = setObjectVisibility(s.project, ids, op.visible);
      s.context.focusIds = ids;
      reports.push(
        `${op.visible ? 'Shown' : 'Hidden'} ${ids.length} object(s).${op.visible ? '' : ' Nothing deleted; use Show all in Objects to restore them.'}`,
      );
    } else if (op.type === 'show_all') {
      s.project = setObjectVisibility(s.project, 'all', true);
      reports.push('All objects and layers are visible.');
    } else if (op.type === 'group_create') {
      if ((s.project.groups?.length ?? 0) >= 50)
        throw new Error('This project supports up to 50 groups.');
      const ids = op.targets.length ? resolveIds(op.targets, s) : [],
        id = crypto.randomUUID();
      s.project.groups = [
        ...(s.project.groups ?? []),
        { id, name: op.name, visible: true, locked: false },
      ];
      s.project.volumes = s.project.volumes.map((v) =>
        ids.includes(v.id) ? { ...v, groupId: id } : v,
      );
      reports.push(`Created group ${op.name} with ${ids.length} objects.`);
    } else if (op.type === 'group_edit') {
      if (!s.project.groups?.some((g) => g.id === op.id))
        throw new Error('Which existing group should I change?');
      s.project.groups = s.project.groups.map((g) =>
        g.id === op.id
          ? {
              ...g,
              name: op.name ?? g.name,
              visible: op.visible ?? g.visible,
              locked: op.locked ?? g.locked,
            }
          : g,
      );
      reports.push('Group settings updated.');
    } else if (op.type === 'map_rotation') {
      if (!s.project.site)
        throw new Error('Set a map location before rotating it.');
      const angle = op.degrees + (op.relative ? s.project.site.bearing : 0);
      s.project.site = {
        ...s.project.site,
        bearing: ((((angle + 180) % 360) + 360) % 360) - 180,
      };
      reports.push(
        `Map rotation ${s.project.site.bearing}°. Model axes unchanged.`,
      );
    } else if (op.type === 'window_module') {
      const v = one(op.target, s);
      if (v.geometry?.kind !== 'building' || !v.geometry.facade)
        throw new Error(
          'Create a floor and glass assembly before setting a window module.',
        );
      const geometry = { ...v.geometry };
      if (op.width === null) delete geometry.fixedWindowWidth;
      else geometry.fixedWindowWidth = op.width;
      s.project = updateVolume(s.project, v.id, { geometry });
      focus(s, [v.id]);
      reports.push(
        op.width === null
          ? 'Released the fixed window width.'
          : `Window clear width fixed at ${op.width} m. Full windows repeat; solid end infill absorbs remaining width when the building changes.`,
      );
    } else if (op.type === 'building_display') {
      const vs = targets(op.targets, s);
      for (const v of vs) {
        if (v.geometry?.kind !== 'building')
          throw new Error(
            'This object has no floor/glass assembly yet. Create floors and glazing first; its original volume will be retained.',
          );
        s.project = updateVolume(s.project, v.id, {
          display: { mode: op.mode, floors: op.floors, glass: op.glass },
        });
      }
      reports.push(
        `Building display: ${op.mode === 'volume' ? 'original massing' : `${op.floors ? 'floors' : 'no floors'}, ${op.glass ? 'glass and frames' : 'no glass'}`}. Geometry parameters preserved.`,
      );
    } else if (op.type === 'attach') {
      let ref = one(op.target, s);
      if (isProfile(ref)) throw new Error('Extrude the reference first.');
      let y = ref.position.y,
        x = op.offsetX,
        z = op.offsetZ;
      if (op.side === 'below') {
        y = ref.position.y - op.height - op.gap;
        if (y < 0) {
          if (!op.liftExisting)
            throw new Error(
              'There is no room underneath. Ask whether to lift the existing volume before adding the lower floor.',
            );
          s.project = updateVolume(s.project, ref.id, {
            position: { ...ref.position, y: ref.position.y - y },
          });
          ref = one(ref.id, s);
          y = 0;
        }
      } else if (op.side === 'above')
        y = ref.position.y + ref.dimensions.height + op.gap;
      else if (op.side === 'left' || op.side === 'right')
        x +=
          (op.side === 'left' ? -1 : 1) *
          ((ref.dimensions.width + op.width) / 2 + op.gap);
      else
        z +=
          (op.side === 'front' ? 1 : -1) *
          ((ref.dimensions.depth + op.depth) / 2 + op.gap);
      const a = (ref.rotation * Math.PI) / 180;
      const v = {
        ...makeVolume(s.project.volumes.length + 1, {
          width: op.width,
          depth: op.depth,
          height: op.height,
        }),
        name: uniqueName(op.name, s.project.volumes),
        position: {
          x: ref.position.x + x * Math.cos(a) + z * Math.sin(a),
          y,
          z: ref.position.z - x * Math.sin(a) + z * Math.cos(a),
        },
        rotation: ref.rotation,
      };
      validateVolume(v);
      s.project.volumes.push(v);
      s.context.lastCreatedIds = [v.id];
      s.context.lastOperands = [ref.id, v.id];
      focus(s, [v.id]);
      reports.push(
        `${report(v)} Added ${op.side} ${ref.name}; both parts remain independently editable. Union can join them when needed.`,
      );
    } else if (op.type === 'edit_blend') {
      const v = one(op.target, s);
      const next = await reviseBlend(v, op.radius, op.resolution);
      s.project = updateVolume(s.project, v.id, next);
      focus(s, [v.id]);
      reports.push(`${report(next)} Blend revised from original operands.`);
    } else if (op.type === 'sculpt') {
      const v = one(op.target, s);
      const next = await sculptVolume(v, op.settings, op.replaceLast);
      s.project = updateVolume(s.project, v.id, next);
      focus(s, [v.id]);
      reports.push(`${report(next)} Sculpt controls and source retained.`);
    } else if (op.type === 'smooth_boolean') {
      const vs = targets(op.targets, s);
      if (vs.length < 2 || vs.length > 4)
        throw new Error('Choose two to four distinct solids.');
      const next = await smoothBoolean(
        vs,
        op.operation,
        op.radius,
        op.resolution,
      );
      const removed = vs.slice(1).map((v) => v.id);
      s.project.volumes = s.project.volumes
        .filter((v) => !removed.includes(v.id))
        .map((v) =>
          v.id === next.id
            ? next
            : v.component?.hostId && removed.includes(v.component.hostId)
              ? { ...v, component: { ...v.component, hostId: null } }
              : v,
        );
      s.context.lastOperands = vs.map((v) => v.id);
      focus(s, [next.id]);
      reports.push(
        `${report(next)} Smooth ${op.operation}, ${op.resolution} m field spacing; original operands retained.`,
      );
    } else if (
      op.type === 'organic_form' ||
      op.type === 'edit_control_points'
    ) {
      const previous =
        op.type === 'edit_control_points'
          ? one(op.target, s)
          : op.target
            ? one(op.target, s)
            : null;
      let definition: OrganicDefinition;
      if (op.type === 'organic_form')
        definition = structuredClone(op.definition);
      else {
        if (
          previous?.geometry?.kind !== 'form' ||
          ![
            'nurbs',
            'subdivision',
            'organic_sweep',
            'smooth_loft',
            'field',
          ].includes(previous.geometry.definition.method)
        )
          throw new Error(
            'Choose a retained organic form to edit its controls.',
          );
        definition = structuredClone(
          previous.geometry.definition,
        ) as OrganicDefinition;
        const controls: Vec3[] =
          definition.method === 'nurbs'
            ? definition.points.flat()
            : definition.method === 'subdivision'
              ? definition.vertices
              : definition.method === 'organic_sweep'
                ? definition.path
                : definition.method === 'field'
                  ? definition.elements.map((e) => e.center)
                  : [];
        if (!controls.length)
          throw new Error(
            'Use organic_form with the updated loft sections; its existing recipe is in the scene context.',
          );
        for (const change of op.changes) {
          const point = controls[change.index];
          if (!point) throw new Error('Control index is outside this form.');
          Object.assign(point, change.point);
          if ('weight' in point && change.weight !== null)
            point.weight = change.weight;
        }
      }
      const result = organicMesh(await getKernel(), definition);
      const position =
        op.type === 'organic_form' ? op.position : { ...previous!.position };
      let dimensions = result.dimensions;
      if (
        op.type === 'edit_control_points' &&
        previous?.geometry?.kind === 'form'
      ) {
        const old = previous.geometry.origin ?? { x: 0, y: 0, z: 0 },
          base = previous.geometry.base ?? previous.dimensions;
        const sx = previous.dimensions.width / base.width,
          sy = previous.dimensions.height / base.height,
          sz = previous.dimensions.depth / base.depth;
        const dx = (result.origin.x - old.x) * sx,
          dz = (result.origin.z - old.z) * sz,
          a = (previous.rotation * Math.PI) / 180;
        position.x += dx * Math.cos(a) + dz * Math.sin(a);
        position.z += -dx * Math.sin(a) + dz * Math.cos(a);
        position.y += (result.origin.y - old.y) * sy;
        dimensions = {
          width: dimensions.width * sx,
          height: dimensions.height * sy,
          depth: dimensions.depth * sz,
        };
      }
      const v: Volume = {
        ...(previous ?? makeVolume(s.project.volumes.length + 1)),
        name:
          op.type === 'organic_form'
            ? uniqueName(
                op.name,
                s.project.volumes.filter((v) => v.id !== previous?.id),
              )
            : previous!.name,
        dimensions,
        position,
        geometry: {
          kind: 'form',
          mesh: result.mesh,
          definition,
          origin: result.origin,
          base: result.dimensions,
        },
      };
      validateVolume(v);
      if (previous) s.project = updateVolume(s.project, v.id, v);
      else s.project.volumes.push(v);
      s.context.lastCreatedIds = [v.id];
      focus(s, [v.id]);
      reports.push(
        `${report(v)} Editable ${definition.method} solid; control geometry retained.`,
      );
    } else if (op.type === 'inset_layout') {
      const ref = one(op.reference, s),
        vs = targets(op.targets, s),
        a = (ref.rotation * Math.PI) / 180;
      for (const v of vs) {
        const dx = v.position.x - ref.position.x,
          dz = v.position.z - ref.position.z;
        let x = dx * Math.cos(a) - dz * Math.sin(a),
          z = dx * Math.sin(a) + dz * Math.cos(a);
        const inset = (n: number) => {
          if (Math.abs(n) < 1e-7) return 0;
          if (op.distance > Math.abs(n))
            throw new Error(
              'That inset would cross the layout center. Use a smaller inset.',
            );
          return n - Math.sign(n) * op.distance;
        };
        if (op.axes.includes('x')) x = inset(x);
        if (op.axes.includes('z')) z = inset(z);
        s.project = updateVolume(s.project, v.id, {
          position: {
            x: ref.position.x + x * Math.cos(a) + z * Math.sin(a),
            y: v.position.y,
            z: ref.position.z - x * Math.sin(a) + z * Math.cos(a),
          },
        });
      }
      focus(
        s,
        vs.map((v) => v.id),
      );
      reports.push(
        `Moved ${vs.length} existing components ${op.distance} m inward along ${op.axes.toUpperCase()} in ${ref.name}'s axes; dimensions and identities preserved.`,
      );
    } else if (
      op.type === 'sweep' ||
      op.type === 'loft' ||
      op.type === 'revolve'
    ) {
      const previous = op.target ? one(op.target, s) : null;
      if (
        s.project.volumes.some(
          (v) => v.id !== previous?.id && v.name === op.name,
        )
      )
        throw new Error('Choose a unique name for the new form.');
      const definition: FormDefinition =
        op.type === 'sweep'
          ? {
              method: 'sweep',
              profile: op.profile,
              path: op.path,
              smooth: op.smooth,
            }
          : op.type === 'loft'
            ? { method: 'loft', sections: op.sections }
            : {
                method: 'revolve',
                degrees: op.degrees,
                profile: op.profile.map((p) => ({ x: p.radius, z: p.height })),
              };
      const result = formMesh(await getKernel(), definition);
      const v: Volume = {
        ...(previous ??
          makeVolume(s.project.volumes.length + 1, result.dimensions)),
        dimensions: result.dimensions,
        name: op.name,
        position: op.position,
        rotation: 0,
        geometry: { kind: 'form', mesh: result.mesh, definition },
      };
      validateVolume(v);
      if (previous)
        s.project.volumes = s.project.volumes.map((o) =>
          o.id === v.id ? v : o,
        );
      else s.project.volumes.push(v);
      s.context.lastCreatedIds = [v.id];
      focus(s, [v.id]);
      reports.push(
        `${report(v)} Closed ${op.type} solid; profile/path parameters preserved.`,
      );
    } else if (op.type === 'orient') {
      const vs = targets(op.targets, s);
      for (const v of vs) {
        const next = await orientVolume(v, { x: op.x, y: op.y, z: op.z });
        s.project.volumes = s.project.volumes.map((o) =>
          o.id === v.id ? next : o,
        );
      }
      focus(
        s,
        vs.map((v) => v.id),
      );
      reports.push(
        `Rotated ${vs.length} solid(s) about their centers: X ${op.x}°, Y ${op.y}°, Z ${op.z}°. Source geometry retained.`,
      );
    } else if (op.type === 'hollow') {
      const v = one(op.target, s);
      const source = v.geometry?.kind === 'hollow' ? v.geometry.source : v;
      s.project = updateVolume(s.project, v.id, {
        geometry: {
          kind: 'hollow',
          source: {
            ...structuredClone(source),
            dimensions: { ...v.dimensions },
          },
          thickness: op.thickness,
          openTop: op.openTop,
        },
      });
      focus(s, [v.id]);
      reports.push(
        `Hollowed ${v.name}: ${op.thickness} m walls and floor, ${op.openTop ? 'open top' : 'closed roof'}.`,
      );
    } else if (op.type === 'color') {
      const vs = targets(op.targets, s);
      for (const v of vs)
        s.project = updateVolume(s.project, v.id, { color: op.color });
      focus(
        s,
        vs.map((v) => v.id),
      );
      reports.push(`Updated ${vs.length} object color(s) to ${op.color}.`);
    } else if (op.type === 'trees') {
      const target = op.target ? one(op.target, s) : null;
      const margin = op.clearance + op.crown / 2;
      const w = target ? target.dimensions.width + 2 * margin : 0;
      const d = target ? target.dimensions.depth + 2 * margin : 0;
      const perimeter = 2 * (w + d);
      const count =
        op.count ??
        (target
          ? Math.max(4, Math.min(60, Math.floor(perimeter / (op.crown * 1.5))))
          : 1);
      if (!target && count > 1)
        throw new Error(
          'Choose a volume to arrange trees around, or add a single tree at a position.',
        );
      if (target && count > 1 && perimeter / count < op.crown * 1.42)
        throw new Error(
          'These tree crowns would overlap. Use fewer trees, smaller crowns or more clearance.',
        );
      const obstacles = s.project.volumes.filter(
        (o) =>
          o.id !== target?.id &&
          !isProfile(o) &&
          o.geometry?.kind !== 'person' &&
          o.position.y < op.height,
      );
      const created: string[] = [];
      for (let i = 0; i < count; i++) {
        const v = makeVolume(s.project.volumes.length + 1, {
          width: op.crown,
          depth: op.crown,
          height: op.height,
        });
        v.name = uniqueName('Tree', s.project.volumes);
        v.geometry = { kind: 'tree' };
        v.color = '#88a68b';
        if (target) {
          const t = ((i + 0.5) * perimeter) / count;
          const x =
            t < w
              ? -w / 2 + t
              : t < w + d
                ? w / 2
                : t < 2 * w + d
                  ? w / 2 - (t - w - d)
                  : -w / 2;
          const z =
            t < w
              ? -d / 2
              : t < w + d
                ? -d / 2 + t - w
                : t < 2 * w + d
                  ? d / 2
                  : d / 2 - (t - 2 * w - d);
          const a = (target.rotation * Math.PI) / 180;
          v.position = {
            x: target.position.x + x * Math.cos(a) + z * Math.sin(a),
            y: 0,
            z: target.position.z - x * Math.sin(a) + z * Math.cos(a),
          };
        } else v.position = op.position ?? { x: 0, y: 0, z: 0 };
        const blocked =
          target &&
          obstacles.some((o) => {
            const a = (o.rotation * Math.PI) / 180,
              dx = v.position.x - o.position.x,
              dz = v.position.z - o.position.z;
            const x = dx * Math.cos(a) - dz * Math.sin(a),
              z = dx * Math.sin(a) + dz * Math.cos(a);
            return (
              Math.hypot(
                Math.max(0, Math.abs(x) - o.dimensions.width / 2),
                Math.max(0, Math.abs(z) - o.dimensions.depth / 2),
              ) <
              op.crown / 2 + 0.1
            );
          });
        if (blocked) {
          if (op.count !== null)
            throw new Error(
              'Another object blocks this tree arrangement. Increase clearance, change the count, or allow automatic spacing.',
            );
          continue;
        }
        validateVolume(v);
        s.project.volumes.push(v);
        created.push(v.id);
      }
      if (!created.length)
        throw new Error(
          'There is no clear ground around this footprint for the trees. Increase clearance or choose another volume.',
        );
      s.context.lastCreatedIds = created;
      focus(s, created);
      reports.push(
        `Added ${created.length} tree silhouette(s), ${op.height} m tall with ${op.crown} m crowns${target ? ` around ${target.name}, at least ${op.clearance} m clear of its footprint` : ''}.${created.length < count ? ' Positions blocked by other object envelopes were skipped.' : ''}`,
      );
    } else if (op.type === 'person') {
      const related = s.project.volumes.filter(
        (v) => v.geometry?.kind !== 'person',
      );
      const bounds = related.length ? groupBounds(related) : null;
      const v = makeVolume(s.project.volumes.length + 1, {
        width: (0.85 * op.height) / 2.26,
        depth: 0.1,
        height: op.height,
      });
      v.dimensions.depth = 0.025;
      v.name = uniqueName('Modulor scale figure', s.project.volumes);
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
        `Added a Modulor-inspired silhouette with ${op.height} m raised-arm reach (head height ${round(op.height * 0.81)} m) ${op.position ? 'at the requested position' : 'beside your model'}.`,
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
      if (op.copy) remapCopiedHosts(vs, created);
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
      for (let i = 0; i < created.length; i += vs.length)
        remapCopiedHosts(vs, created.slice(i, i + vs.length));
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
    } else if (op.type === 'components') {
      const v = one(op.target, s);
      reports.push(await separateBuilding(s, v));
    } else if (op.type === 'building' || op.type === 'building_components') {
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
          ...(v.geometry?.kind === 'building' &&
          v.geometry.fixedWindowWidth !== undefined
            ? { fixedWindowWidth: v.geometry.fixedWindowWidth }
            : {}),
          mullionWidth: op.mullionWidth,
        },
      };
      await solidStats(next);
      s.project = updateVolume(s.project, v.id, next);
      focus(s, [v.id]);
      reports.push(
        `${v.name}: ${op.floors} floor slabs plus a roof, ${op.slabThickness} m thick; total height ${v.dimensions.height} m and base elevation ${v.position.y} m preserved.${op.facade ? ` Curtain wall with real glass panels and frames, maximum panel width ${op.panelWidth} m.` : ''} Original envelope preserved for editing and undo.`,
      );
      if (op.type === 'building_components')
        reports.push(await separateBuilding(s, next));
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
      for (let i = 1; i <= op.count; i++) {
        const instance: Volume[] = [];
        for (const v of vs) {
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
          instance.push(copy);
        }
        remapCopiedHosts(vs, instance);
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
        .map((v) => (v.id === vs[0].id ? result : v))
        .map((v) =>
          v.component?.hostId === vs[1].id
            ? { ...v, component: { ...v.component, hostId: null } }
            : v,
        );
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
      s.project.volumes = s.project.volumes
        .filter((v) => !ids.includes(v.id))
        .map((v) =>
          v.component?.hostId && ids.includes(v.component.hostId)
            ? { ...v, component: { ...v.component, hostId: null } }
            : v,
        );
      focus(s, []);
      reports.push(`Removed ${ids.length} object(s); undo is available.`);
    }
    if (op.type === 'opening_shape' || op.type === 'edit_opening') {
      const wall = one(op.target, s),
        g = wall.geometry;
      if (g?.kind === 'boolean' && g.opening) {
        const previousPart = operationBefore.find(
          (v) =>
            v.component?.hostId === wall.id &&
            v.geometry?.kind === 'mesh' &&
            v.geometry.openingSystem?.cutterId === g.operands[1].id,
        );
        if (
          previousPart?.geometry?.kind === 'mesh' &&
          previousPart.geometry.openingSystem
        ) {
          const parts = await glazeOpening(
            wall,
            s.project.volumes,
            previousPart.geometry.openingSystem,
          );
          s.project.volumes = s.project.volumes.map(
            (v) => parts.find((p) => p.id === v.id) ?? v,
          );
          reports.push(
            'Updated the linked glazing and frame to match, preserving their identities and stated inset/thickness.',
          );
        }
      }
    }
    if (
      [
        'move',
        'position',
        'resize',
        'scale',
        'rotate',
        'rotate_group',
        'stretch',
        'constrained_resize',
        'profile_solid',
      ].includes(op.type)
    )
      s.project.volumes = propagateHosted(operationBefore, s.project.volumes);
    if (
      op.type !== 'visibility' &&
      op.type !== 'show_all' &&
      lockedBefore.some(
        (v) =>
          !equalData(
            s.project.volumes.find((o) => o.id === v.id),
            v,
          ),
      )
    )
      throw new Error('This change affects a locked group. Unlock it first.');
    if (s.project.volumes.length > MAX_VOLUMES)
      throw new Error('This workspace supports up to 200 objects.');
    s.project.volumes.forEach((v) =>
      validateVolume(
        v,
        v.geometry !== operationBefore.find((old) => old.id === v.id)?.geometry,
      ),
    );
    s.context.lastOperation = op.type;
  }
  operationStarted(null, 0);
  validateWorkspaceEffects(s, plan.operations);
  if (beforeEdit) {
    for (const v of s.project.volumes) {
      const previous = beforeEdit.volumes.find((old) => old.id === v.id);
      if (
        !isProfile(v) &&
        !isReference(v) &&
        (!previous ||
          !equalData(
            [previous.dimensions, previous.geometry],
            [v.dimensions, v.geometry],
          ))
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

/** Resolve transient selection aliases while their stage context still exists. */
export function freezeWorkspaceOperation(op: Operation, s: Session): Operation {
  if (op.type === 'walk_to') {
    const targets = op.targets.flatMap((ref) =>
      ref.startsWith('$') ? resolveIds([ref], s) : [ref],
    );
    const placement = resolveWalkPlacement(s.project, { ...op, targets });
    return {
      ...op,
      placement: 'coordinates',
      targets: [],
      position: placement.position,
      lookAt: placement.lookAt,
    };
  }
  if (op.type === 'explore' && op.targets.length)
    return { ...op, targets: resolveIds(op.targets, s) };
  return op;
}
export function validateWorkspaceEffects(s: Session, operations: Operation[]) {
  for (const raw of operations) {
    const op = freezeWorkspaceOperation(raw, s);
    if (op.type === 'walk_to') resolveWalkPlacement(s.project, op);
    if (
      op.type === 'show_view' &&
      !s.project.design?.views.some((v) => v.name === op.name)
    )
      throw new Error('Which saved view should I show?');
    if (op.type === 'explore') {
      const ids = op.targets.length
        ? resolveIds(op.targets, s)
        : s.project.volumes.map((v) => v.id);
      if (
        op.mode === 'open' &&
        !s.project.volumes.some(
          (v) => ids.includes(v.id) && componentInfo(v).motion !== 'none',
        )
      )
        throw new Error(
          'Set a hinge or slide on the component before opening it.',
        );
    }
  }
}
