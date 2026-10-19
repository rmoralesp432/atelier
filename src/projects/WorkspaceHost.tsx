import { useCallback, useEffect, useRef, useState } from 'react';
import { FolderOpen, X, Plus, Check } from 'lucide-react';
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
        if (mounted.current) setError((e as Error).message);
        throw e;
      });
    },
    [enqueue],
  );
  useEffect(() => {
    if (open) {
      setRename(active.current?.name ?? '');
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
  if (!ready)
    return <div className="workspace-loading">Opening your workspace…</div>;
  return (
    <App
      key={generation}
      initialWorkspace={initial ?? undefined}
      onSnapshot={capture}
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
                if (switching.current) e.preventDefault();
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
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const name = rename.trim();
                  if (!name || !active.current) return;
                  setWorking(true);
                  try {
                    const p = {
                      ...active.current,
                      name,
                      updatedAt: Date.now(),
                    };
                    await enqueue(p);
                    active.current = p;
                    setIdentity({ id: p.id, name });
                    setEntries(await listProjects());
                    setError('');
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setWorking(false);
                  }
                }}
              >
                <label>
                  Current project name
                  <input
                    aria-label="Current project name"
                    value={rename}
                    maxLength={80}
                    onChange={(e) => setRename(e.target.value)}
                    disabled={working}
                  />
                </label>
                <button type="submit" disabled={working || !rename.trim()}>
                  Rename
                </button>
              </form>
              <div className="project-list">
                {entries.map((p) => (
                  <button
                    key={p.id}
                    className="project-entry"
                    disabled={working || !available.current}
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
                  disabled={working || !newName.trim() || !available.current}
                >
                  <Plus size={16} />
                  Create
                </button>
              </form>
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
