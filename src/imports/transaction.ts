import { groupBounds } from '../geometry/spatial';
import { serializeSession, type Session } from '../intelligence/engine';
import { MAX_VOLUMES, validateVolume } from '../model';
import type { PreparedImport } from './mesh';
import { MAX_IMPORT_SESSION_CHARS } from '../projects/sessionCodec';

/** Build and validate the entire undoable import before touching the workspace. */
export function importedSession(
  session: Session,
  asset: PreparedImport,
): Session {
  const p = session.project;
  if (
    !asset.volumes.length ||
    p.volumes.length + asset.volumes.length > MAX_VOLUMES
  )
    throw new Error(
      `This workspace supports up to ${MAX_VOLUMES} objects. Start a new project, combine the import, or export a smaller Revit view.`,
    );
  const grouped = asset.volumes.length > 1;
  if (grouped && (p.groups?.length ?? 0) >= 50)
    throw new Error(
      'This workspace already has 50 groups. Use another project for this import.',
    );
  const groupId = grouped ? crypto.randomUUID() : undefined;
  const bounds = groupBounds(asset.volumes);
  const dx = p.volumes.length
    ? groupBounds(p.volumes).max.x + 2 - bounds.min.x
    : 0;
  const names = new Set(p.volumes.map((v) => v.name));
  const volumes = asset.volumes.map((v) => {
    let name = v.name,
      n = 2;
    while (names.has(name)) name = `${v.name.slice(0, 65)} ${n++}`;
    names.add(name);
    const next = {
      ...v,
      id: crypto.randomUUID(),
      name,
      ...(groupId ? { groupId } : {}),
      position: { ...v.position, x: v.position.x + dx },
    };
    validateVolume(next);
    return next;
  });
  const ids = volumes.map((v) => v.id);
  const project = {
    ...p,
    volumes: [...p.volumes, ...volumes],
    selectedId: ids[0],
    selectedIds: ids,
    ...(groupId
      ? {
          groups: [
            ...(p.groups ?? []),
            {
              id: groupId,
              name: asset.name,
              visible: true,
              locked: false,
            },
          ],
        }
      : {}),
  };
  const candidate: Session = {
    ...session,
    project,
    past: [...session.past.slice(-49), p],
    future: [],
    context: { ...session.context, focusIds: ids, lastCreatedIds: ids },
  };
  // Retain the storage guard: increasing the parser cap is not permission to
  // exhaust local storage or evict previous work/history on a large import.
  if (serializeSession(candidate).length > MAX_IMPORT_SESSION_CHARS)
    throw new Error(
      'This import exceeds the 64 MB project-history budget. Import a lighter model or use a new project; your project has not changed.',
    );
  return candidate;
}
