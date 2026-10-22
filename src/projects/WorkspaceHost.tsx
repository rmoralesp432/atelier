import { downloadProject, projectFile, readProjectCopy } from './transfer';
import { MAX_IMPORT_BYTES } from '../imports/mesh';
import { parsePanoramas } from '../panorama/data';
import { sampleHouse } from './sample';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FolderOpen, X, Plus, Check, Pencil, Trash2 } from 'lucide-react';
import App from '../App';
import { parseBoard } from '../moodboard/data';
import {
  newSession,
  parseSession,
  serializeSession,
} from '../intelligence/engine';
import {
  activeProject,
  listProjects,
  saveProject,
  renameProject,
  deleteProject,
  type SavedProject,
  type WorkspaceSnapshot,
} from './library';
export default function WorkspaceHost() {
  const [ready, setReady] = useState(false),
    [initial, setInitial] = useState<SavedProject | null>(null),
    [generation, setGeneration] = useState(0);
  const [identity, setIdentity] = useState<{ id: string; name: string } | null>(
      null,
    ),
    [open, setOpen] = useState(false),
    [entries, setEntries] = useState<SavedProject[]>([]),
    [working, setWorking] = useState(false),
    [error, setError] = useState('');
  const [newName, setNewName] = useState(''),
    [rename, setRename] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedProject | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const transferInput = useRef<HTMLInputElement>(null);
  const [transferNotice, setTransferNotice] = useState('');
  const active = useRef<SavedProject | null>(null),
    latest = useRef<WorkspaceSnapshot | null>(null),
    queue = useRef(Promise.resolve()),
    switching = useRef(false),
    available = useRef(true),
    mounted = useRef(true);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    void activeProject()
      .then((p) => {
        if (cancelled) return;
        if (p) {
          parseSession(p.session);
          parseBoard(p.moodboard);
          parsePanoramas(p.panoramas);
          if (
            !Array.isArray(p.messages) ||
            p.messages.some(
              (m) =>
                !m ||
                !['user', 'assistant'].includes(m.role) ||
                typeof m.content !== 'string',
            )
          )
            throw new Error('Invalid saved conversation');
          // The synchronous active-workspace checkpoint covers a reload immediately after an edit.
          try {
            const c = JSON.parse(
              localStorage.getItem('atelier.project.checkpoint') || 'null',
            );
            const session = localStorage.getItem('atelier.session.v2');
            if (c?.id === p.id && c.updatedAt >= p.updatedAt && session) {
              parseSession(session);
              const messages = JSON.parse(
                localStorage.getItem('atelier.conversation.v2') || '[]',
              );
              if (
                !Array.isArray(messages) ||
                messages.some(
                  (m) =>
                    !m ||
                    !['user', 'assistant'].includes(m.role) ||
                    typeof m.content !== 'string',
                )
              )
                throw new Error('Invalid conversation checkpoint');
              p = {
                ...p,
                session,
                messages: messages.slice(-80),
              };
            }
          } catch {
            /* IndexedDB remains the validated durable fallback. */
          }
          active.current = p;
          latest.current = p;
          setInitial(p);
          setIdentity({ id: p.id, name: p.name });
        }
      })
      .catch(() => {
        available.current = false;
        setError(
          'Project storage could not be opened. Your existing workspace remains available; export a backup.',
        );
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, []);
  const enqueue = useCallback((p: SavedProject, activate = false) => {
    const task = queue.current
      .catch(() => {})
      .then(() => saveProject(p, activate));
    queue.current = task;
    return task;
  }, []);
  const capture = useCallback(
    (snapshot: WorkspaceSnapshot, safe: boolean) => {
      if (!safe) {
        available.current = false;
        setError(
          'The existing workspace needs recovery. Project switching is disabled to preserve the saved data.',
        );
        return;
      }
      if (!available.current || switching.current)
        return Promise.reject(
          new Error('Project storage is not available. Export a backup.'),
        );
      const previousActive = active.current,
        previousLatest = latest.current;
      latest.current = snapshot;
      const first = !active.current;
      const record: SavedProject = {
        ...snapshot,
        id: active.current?.id ?? crypto.randomUUID(),
        name: active.current?.name ?? 'Untitled study',
        updatedAt: Math.max(Date.now(), (active.current?.updatedAt ?? 0) + 1),
      };
      active.current = record;
      if (first) setIdentity({ id: record.id, name: record.name });
      try {
        if (
          localStorage.getItem('atelier.session.v2') === snapshot.session &&
          localStorage.getItem('atelier.conversation.v2') ===
            JSON.stringify(snapshot.messages)
        )
          localStorage.setItem(
            'atelier.project.checkpoint',
            JSON.stringify({ id: record.id, updatedAt: record.updatedAt }),
          );
      } catch {
        /* Durable save below still works. */
      }
      return enqueue(record, true).catch((e) => {
        if (active.current === record) active.current = previousActive;
        if (latest.current === snapshot) latest.current = previousLatest;
        if (mounted.current) setError((e as Error).message);
        throw e;
      });
    },
    [enqueue],
  );
  useEffect(() => {
    if (open) {
      setRename(active.current?.name ?? '');
      setRenameId(active.current?.id ?? null);
      setDeleteTarget(null);
      dialog.current?.showModal();
    }
  }, [open]);
  const refresh = async () => {
    setWorking(true);
    try {
      await queue.current;
      setEntries(await listProjects());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  };
  const switchTo = async (record: SavedProject) => {
    setWorking(true);
    switching.current = true;
    setError('');
    try {
      parseSession(record.session);
      parseBoard(record.moodboard);
      parsePanoramas(record.panoramas);
      // Complete every pending save, then atomically store and activate the destination.
      if (active.current && latest.current)
        await enqueue({
          ...active.current,
          ...latest.current,
          updatedAt: Date.now(),
        });
      await enqueue(record, true);
      active.current = record;
      latest.current = record;
      setInitial(record);
      setIdentity({ id: record.id, name: record.name });
      setGeneration((n) => n + 1);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      switching.current = false;
      setWorking(false);
    }
  };
  const renameEntry = async () => {
    if (
      !renameId ||
      !rename.trim() ||
      working ||
      deleteTarget ||
      !available.current
    )
      return;
    setWorking(true);
    switching.current = true;
    setError('');
    try {
      await queue.current;
      const renamed = await renameProject(renameId, rename);
      if (active.current?.id === renamed.id) {
        active.current = renamed;
        setIdentity({ id: renamed.id, name: renamed.name });
      }
      setEntries(await listProjects());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      switching.current = false;
      setWorking(false);
    }
  };
  const removeEntry = async () => {
    if (!deleteTarget || working || !available.current) return;
    setWorking(true);
    switching.current = true;
    setError('');
    try {
      await queue.current;
      const replacement: SavedProject | undefined =
        active.current?.id === deleteTarget.id
          ? {
              id: crypto.randomUUID(),
              name: 'Untitled study',
              updatedAt: Date.now(),
              session: serializeSession(
                newSession({ volumes: [], selectedId: null }),
              ),
              messages: [],
            }
          : undefined;
      await deleteProject(deleteTarget.id, replacement);
      if (replacement) {
        active.current = replacement;
        latest.current = replacement;
        setInitial(replacement);
        setIdentity({ id: replacement.id, name: replacement.name });
        setGeneration((n) => n + 1);
        setOpen(false);
      } else {
        setEntries(await listProjects());
        if (renameId === deleteTarget.id) {
          setRenameId(active.current?.id ?? null);
          setRename(active.current?.name ?? '');
        }
      }
      setDeleteTarget(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      switching.current = false;
      setWorking(false);
    }
  };
  if (!ready)
    return <div className="workspace-loading">Opening your workspace…</div>;
  return (
    <App
      key={generation}
      initialWorkspace={initial ?? undefined}
      projectName={identity?.name}
      onSnapshot={capture}
      onOpenSample={() => {
        if (!working && available.current && !switching.current)
          void switchTo(sampleHouse());
      }}
      sampleBusy={working || !available.current}
      projectMenu={(blocked) => (
        <>
          <button
            className="project-switcher"
            aria-label="Projects"
            title={
              blocked
                ? 'Finish the current conversation or review before switching projects.'
                : (identity?.name ?? 'Projects')
            }
            disabled={blocked}
            onClick={() => {
              setOpen(true);
              void refresh();
            }}
          >
            <FolderOpen size={16} />
            <span>{identity?.name ?? 'Projects'}</span>
          </button>
          {open && (
            <dialog
              className="projects-dialog"
              ref={dialog}
              onCancel={(e) => {
                if (working || switching.current) e.preventDefault();
                else setOpen(false);
              }}
            >
              <div className="dialog-heading">
                <h2>Your projects</h2>
                <button
                  aria-label="Close projects"
                  disabled={working}
                  onClick={() => setOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <p>
                Separate spaces for separate ideas. Saved in this browser;
                export a backup to take a project elsewhere.
              </p>
              <section
                className="project-transfer"
                aria-label="Take to another device"
              >
                <strong>Take to another device</strong>
                <p>
                  Download this project and send the file through email, iCloud
                  Drive or Google Drive. On your other device, open ATELIER →
                  Projects → Open project copy. Copies do not sync
                  automatically.
                </p>
                <div>
                  <button
                    disabled={working || !latest.current || !!deleteTarget}
                    onClick={() => {
                      try {
                        downloadProject(
                          projectFile(
                            latest.current!,
                            identity?.name ?? 'Untitled study',
                          ),
                        );
                        setTransferNotice(
                          'Project file downloaded. Send it to your other device, or share a link to the file in your own Drive.',
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Download project copy
                  </button>
                  <button
                    disabled={working || !available.current || !!deleteTarget}
                    onClick={() => transferInput.current?.click()}
                  >
                    Open project copy
                  </button>
                </div>
                <input
                  ref={transferInput}
                  hidden
                  type="file"
                  accept=".json,application/json"
                  aria-label="Open project copy file"
                  onChange={async (e) => {
                    const element = e.currentTarget,
                      file = element.files?.[0];
                    element.value = '';
                    if (
                      !file ||
                      working ||
                      switching.current ||
                      !available.current
                    )
                      return;
                    setWorking(true);
                    try {
                      if (file.size > MAX_IMPORT_BYTES)
                        throw new Error(
                          'Project files must be 512 MB or smaller.',
                        );
                      const record = readProjectCopy(await file.text());
                      await switchTo(record);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setWorking(false);
                    }
                  }}
                />
                {transferNotice && (
                  <small role="status">{transferNotice}</small>
                )}
              </section>
              <button
                className="sample-project-card"
                disabled={working || !!deleteTarget || !available.current}
                onClick={() => void switchTo(sampleHouse())}
              >
                <span className="sample-pavilion-icon" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <strong>Open sample house</strong>
                  <small>
                    A raised glass pavilion inspired by Farnsworth House. Start
                    an editable copy; keep your current project.
                  </small>
                </span>
              </button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void renameEntry();
                }}
              >
                <label>
                  {renameId === identity?.id
                    ? 'Current project name'
                    : 'Selected project name'}
                  <input
                    ref={nameInput}
                    aria-label={
                      renameId === identity?.id
                        ? 'Current project name'
                        : 'Selected project name'
                    }
                    value={rename}
                    maxLength={80}
                    onChange={(e) => setRename(e.target.value)}
                    disabled={working}
                  />
                </label>
                <button
                  type="submit"
                  disabled={
                    working ||
                    !!deleteTarget ||
                    !available.current ||
                    !rename.trim()
                  }
                >
                  Rename
                </button>
              </form>
              <div className="project-list">
                {entries.map((p) => (
                  <div className="project-row" key={p.id}>
                    <button
                      className="project-entry"
                      disabled={working || !!deleteTarget || !available.current}
                      aria-current={p.id === identity?.id ? 'true' : undefined}
                      onClick={() => {
                        if (p.id === identity?.id) setOpen(false);
                        else void switchTo(p);
                      }}
                    >
                      <FolderOpen size={18} />
                      <span>
                        <strong>{p.name}</strong>
                        <small>
                          {new Date(p.updatedAt).toLocaleDateString()}
                        </small>
                      </span>
                      {p.id === identity?.id && <Check size={17} />}
                    </button>
                    <button
                      className="project-row-action"
                      aria-label={`Rename project ${p.name}`}
                      title="Rename project"
                      disabled={working || !!deleteTarget || !available.current}
                      onClick={() => {
                        setRenameId(p.id);
                        setRename(p.name);
                        nameInput.current?.focus();
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="project-row-action"
                      aria-label={`Delete project ${p.name}`}
                      title="Delete project"
                      disabled={working || !!deleteTarget || !available.current}
                      onClick={() => setDeleteTarget(p)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newName.trim()) return;
                  void switchTo({
                    id: crypto.randomUUID(),
                    name: newName.trim(),
                    updatedAt: Date.now(),
                    session: serializeSession(
                      newSession({ volumes: [], selectedId: null }),
                    ),
                    messages: [],
                  });
                  setNewName('');
                }}
              >
                <label>
                  New project
                  <input
                    aria-label="New project name"
                    placeholder="e.g. Courtyard house"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={80}
                    disabled={working}
                  />
                </label>
                <button
                  type="submit"
                  disabled={
                    working ||
                    !!deleteTarget ||
                    !newName.trim() ||
                    !available.current
                  }
                >
                  <Plus size={16} />
                  Create
                </button>
              </form>
              {deleteTarget && (
                <div
                  className="project-delete-confirm"
                  role="alertdialog"
                  aria-label="Confirm project deletion"
                >
                  <strong>Delete “{deleteTarget.name}”?</strong>
                  <p>
                    This removes its model, conversation, moodboard and undo
                    history from this browser. This cannot be undone. Export a
                    backup first if you need one.
                  </p>
                  {deleteTarget.id === identity?.id && (
                    <p>A new blank workspace will open.</p>
                  )}
                  <div>
                    <button
                      autoFocus
                      disabled={working}
                      onClick={() => setDeleteTarget(null)}
                    >
                      Keep project
                    </button>
                    <button
                      disabled={working}
                      onClick={() => void removeEntry()}
                    >
                      Delete permanently
                    </button>
                  </div>
                </div>
              )}
              {working && <p role="status">Saving your workspace…</p>}
              {error && <p role="alert">{error}</p>}
            </dialog>
          )}
          {!open && error && (
            <span className="project-storage-warning" role="alert">
              {error}
            </span>
          )}
        </>
      )}
    />
  );
}
